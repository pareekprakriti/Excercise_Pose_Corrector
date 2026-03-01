"""
Run this AFTER train_models.py to register push_up and tree_pose
in views.py so they use the ML model instead of rule-based logic.

Usage:
    python register_models.py
"""

VIEWS_PATH = "/Users/perk/Desktop/MSSC/Capstone/Exercise-Correction/web/server/stream_video/views.py"

# ── 1. Add new models to get_models() cache ───────────────────────────────────
OLD_MODELS = '''"lunge": {
                "stage_model": load_machine_learning_model("lunge_stage_model.pkl"),
                "err_model": load_machine_learning_model("lunge_err_model.pkl"),
                "scaler": load_machine_learning_model("lunge_input_scaler.pkl"),
            },'''

NEW_MODELS = '''"lunge": {
                "stage_model": load_machine_learning_model("lunge_stage_model.pkl"),
                "err_model": load_machine_learning_model("lunge_err_model.pkl"),
                "scaler": load_machine_learning_model("lunge_input_scaler.pkl"),
            },
            # ── Newly trained models ──────────────────────────────────
            "push_up": {
                "model":  load_machine_learning_model("push_up_model.pkl"),
                "scaler": load_machine_learning_model("push_up_input_scaler.pkl"),
            },
            "tree_pose": {
                "model":  load_machine_learning_model("tree_pose_model.pkl"),
                "scaler": load_machine_learning_model("tree_pose_input_scaler.pkl"),
            },'''

# ── 2. Add push_up and tree_pose to ML_SUPPORTED list ─────────────────────────
OLD_SUPPORTED = 'ML_SUPPORTED = ["plank", "bicep_curl", "squat", "lunge"]'
NEW_SUPPORTED = 'ML_SUPPORTED = ["plank", "bicep_curl", "squat", "lunge", "push_up", "tree_pose"]'


def main():
    with open(VIEWS_PATH, "r") as f:
        content = f.read()

    changed = False

    # Step 1: Register models
    if '"push_up"' not in content:
        if OLD_MODELS in content:
            content = content.replace(OLD_MODELS, NEW_MODELS)
            print("✅ Registered push_up and tree_pose in get_models()")
            changed = True
        else:
            print("❌ Could not find lunge model block — add push_up and tree_pose to get_models() manually")
    else:
        print("⚠️  push_up already registered in get_models(), skipping")

    # Step 2: Add to ML_SUPPORTED
    if OLD_SUPPORTED in content:
        content = content.replace(OLD_SUPPORTED, NEW_SUPPORTED)
        print("✅ Added push_up and tree_pose to ML_SUPPORTED list")
        changed = True
    elif NEW_SUPPORTED in content:
        print("⚠️  ML_SUPPORTED already updated, skipping")
    else:
        print("❌ Could not find ML_SUPPORTED line — update it manually")

    if changed:
        with open(VIEWS_PATH, "w") as f:
            f.write(content)
        print("\n🎉 Done! Restart Django to apply changes.")
        print("   kill $(lsof -t -i:8000) && python manage.py runserver")
    else:
        print("\nNo changes made.")


if __name__ == "__main__":
    main()
