"""
Patches stream_video/views.py to save exercise feedback and reps
to the database during live camera sessions.

Run:
    python patch_stream_db.py
"""

VIEWS_PATH = "/Users/perk/Desktop/MSSC/Capstone/Exercise-Correction/web/server/stream_video/views.py"

# ── The old stream_process signature ─────────────────────────────────────────
OLD_STREAM_START = '''@csrf_exempt
@api_view(["POST"])
@authentication_classes([])
@permission_classes([AllowAny])
def stream_process(request):
    """
    Real-time body landmark analysis.

    Expects:
    - query param: ?type=<exercise_type>
    - JSON body: { "landmarks": [ {x, y, z, visibility}, ... ], optional "reset_counter": true }
    """
    ex_type = request.query_params.get("type", "bicep_curl")
    landmarks = request.data.get("landmarks", [])
    reset_counter = request.data.get("reset_counter", False)'''

# ── Replace with wrapped version that saves to DB ────────────────────────────
NEW_STREAM_START = '''def _save_stream_feedback(request, ex_type, response_data):
    """Save live stream feedback + rep to DB after each frame."""
    try:
        from api.models import Session, ExerciseFeedback, Rep
        session_id = request.query_params.get("session_id") or request.data.get("session_id")
        if not session_id:
            return
        session = Session.objects.get(id=session_id)
        posture_ok = response_data.get("posture_ok", False)
        accuracy   = response_data.get("accuracy", 0) or 0
        message    = response_data.get("message", "")
        counter    = response_data.get("counter", 0) or 0

        ExerciseFeedback.objects.create(
            session=session,
            posture_ok=bool(posture_ok),
            accuracy=accuracy,
            feedback_message=message,
            counter=counter,
        )

        # Save rep when counter increases
        prev_counter = request.data.get("counter", 0) or 0
        if counter and int(counter) > int(prev_counter):
            Rep.objects.get_or_create(
                session=session,
                rep_number=int(counter),
                defaults={
                    "accuracy": accuracy,
                    "posture_ok": bool(posture_ok),
                    "feedback_message": message,
                }
            )
    except Exception as e:
        print(f"[DB save error - non fatal]: {e}")


@csrf_exempt
@api_view(["POST"])
@authentication_classes([])
@permission_classes([AllowAny])
def stream_process(request):
    """
    Real-time body landmark analysis.

    Expects:
    - query param: ?type=<exercise_type>
    - JSON body: { "landmarks": [ {x, y, z, visibility}, ... ], optional "reset_counter": true }
    """
    ex_type = request.query_params.get("type", "bicep_curl")
    landmarks = request.data.get("landmarks", [])
    reset_counter = request.data.get("reset_counter", False)'''

# ── Replace the final except block to save on every response ─────────────────
OLD_EXCEPT = '''    except Exception as e:
        print(f"Server Error in stream_process: {e}")
        return Response({"message": "AI Processing Error", "accuracy": 0, "posture_ok": False})'''

NEW_EXCEPT = '''    except Exception as e:
        print(f"Server Error in stream_process: {e}")
        return Response({"message": "AI Processing Error", "accuracy": 0, "posture_ok": False})


def _stream_process_with_db_save(request):
    """Wrapper that calls stream_process and saves result to DB."""
    response = stream_process(request)
    try:
        ex_type = request.query_params.get("type", "bicep_curl")
        data = response.data if hasattr(response, "data") else {}
        _save_stream_feedback(request, ex_type, data)
    except Exception as e:
        print(f"[DB wrapper error]: {e}")
    return response'''


def main():
    with open(VIEWS_PATH, "r") as f:
        content = f.read()

    changed = False

    # Step 1: Add _save_stream_feedback before stream_process
    if "_save_stream_feedback" not in content:
        if OLD_STREAM_START in content:
            content = content.replace(OLD_STREAM_START, NEW_STREAM_START)
            print("✅ Added _save_stream_feedback function")
            changed = True
        else:
            print("❌ Could not find stream_process start — manual edit needed")
    else:
        print("⚠️  _save_stream_feedback already exists, skipping")

    # Step 2: Add wrapper after stream_process except block
    if "_stream_process_with_db_save" not in content:
        if OLD_EXCEPT in content:
            content = content.replace(OLD_EXCEPT, NEW_EXCEPT)
            print("✅ Added _stream_process_with_db_save wrapper")
            changed = True
        else:
            print("❌ Could not find except block — manual edit needed")
    else:
        print("⚠️  wrapper already exists, skipping")

    if changed:
        with open(VIEWS_PATH, "w") as f:
            f.write(content)
        print("\n🎉 Patch applied!")
        print("\nNow update urls.py to use the wrapper:")
        print('   Change: path("api/video/stream", views.stream_process')
        print('   To:     path("api/video/stream", views._stream_process_with_db_save')
        print("\nThen restart Django:")
        print("   kill $(lsof -t -i:8000) && python manage.py runserver")
    else:
        print("\nNo changes made.")


if __name__ == "__main__":
    main()
