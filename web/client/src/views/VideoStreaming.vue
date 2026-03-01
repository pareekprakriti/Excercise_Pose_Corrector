<script setup>
import { ref, onMounted } from 'vue';
import axios from 'axios';
import { Pose } from '@mediapipe/pose';
import * as cam from '@mediapipe/camera_utils';
import { drawConnectors, drawLandmarks } from '@mediapipe/drawing_utils';
import { POSE_CONNECTIONS } from '@mediapipe/pose';

// Allow overriding API base (e.g. when Django runs on a different host/port)
const API_BASE_URL = import.meta.env.VITE_API_BASE || "http://127.0.0.1:8000";

const videoElement = ref(null);
const canvasElement = ref(null);
const statusMessage = ref("Connecting to AI server...");
const accuracy = ref(0);
const currentExercise = ref("bicep_curl");
const connectionStatus = ref("connecting"); // 'connecting', 'connected', 'error'
const poseQuality = ref("unknown"); // 'good' | 'bad' | 'unknown'
const stage = ref("");
const repCount = ref(0);
const squatFeet = ref("");
const squatKnee = ref("");
// Ideal pose skeleton from backend (plank, squat, lunge, tree_pose). Keys: MediaPipe index string; values: [x, y] normalized 0–1.
const idealLandmarks = ref(null);
// Tricep kickback: which side is facing the camera (from posture), e.g. "left" | "right" | "unknown"
const profileSide = ref("");
// Wall sit: hold time in seconds (backend)
const holdSeconds = ref(0);

// --- Voice / trainer-style speech ---
// Requirement:
// - Do NOT speak instructions immediately
// - Wait 20s; if user still hasn't corrected pose, speak
// - Repeat every 20s until pose/message changes
const VOICE_REMINDER_MS = 20000;
const speechReady = ref(false); // unlocked by user gesture
const reminderTimeoutId = ref(null);
const reminderIntervalId = ref(null);
const pendingReminderKey = ref("");
const lastSpokenAt = ref(0);
const lastSpokenText = ref("");
const MIN_SPEAK_GAP_MS = 2500; // prevent stutter from rapid updates

const clearVoiceReminders = () => {
  if (reminderTimeoutId.value) {
    clearTimeout(reminderTimeoutId.value);
    reminderTimeoutId.value = null;
  }
  if (reminderIntervalId.value) {
    clearInterval(reminderIntervalId.value);
    reminderIntervalId.value = null;
  }
  pendingReminderKey.value = "";
};

const cleanForSpeech = (text) => {
  if (!text) return "";
  let s = String(text).replace(/^(Hand Raise|Bicep Curl|Plank|Squat|Lunge|Tree Pose|Lateral Raise|Tricep Kickback|Push-up|Knee push-up|Wall Sit|Sit-up)\s*:\s*/i, "").trim();
  // Remove confidence suffix for cleaner audio (e.g. plank)
  s = s.replace(/\s*\(Confidence:\s*\d+%\)\s*$/i, "").trim();
  return s;
};

const speakNow = (text) => {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
  if (!speechReady.value) return;

  const cleaned = cleanForSpeech(text);
  if (!cleaned) return;

  const now = Date.now();
  if (cleaned === lastSpokenText.value && now - lastSpokenAt.value < VOICE_REMINDER_MS) return;
  if (now - lastSpokenAt.value < MIN_SPEAK_GAP_MS) return;

  const utter = new SpeechSynthesisUtterance(cleaned);
  utter.rate = 0.95;
  utter.pitch = 1.0;
  utter.volume = 1.0;
  utter.lang = "en-US";

  // Avoid aggressive canceling which can cause stutter artifacts.
  // Only cancel if something is currently speaking AND the new text differs.
  if (window.speechSynthesis.speaking && cleaned !== lastSpokenText.value) {
    window.speechSynthesis.cancel();
  }
  window.speechSynthesis.speak(utter);
  lastSpokenAt.value = now;
  lastSpokenText.value = cleaned;
};

// Decide which messages are "instructions" that should be delayed/reminded.
const isInstructionMessage = (msg, acc) => {
  if (!msg) return false;
  if (msg.startsWith("Server error") || msg.startsWith("Network error")) return false;
  if (msg.includes("Connected to AI server")) return false;
  // Speak success immediately (don't delay)
  if (typeof acc === "number" && acc >= 90) return false;
  if (
    msg.includes("Good form") ||
    msg.includes("Good posture") ||
    msg.includes("Perfect") ||
    msg.includes("Great!") ||
    msg.includes("Great") ||
    msg.includes("Correct Form")
  ) {
    return false;
  }
  // If accuracy is 0, it's almost always "not ready / fix posture" guidance.
  if (typeof acc === "number" && acc === 0) return true;
  // Common guidance prefixes
  if (msg.startsWith("Positioning:")) return true;
  if (
    msg.startsWith("Hand Raise:") ||
    msg.startsWith("Bicep Curl:") ||
    msg.startsWith("Plank:") ||
    msg.startsWith("Squat:") ||
    msg.startsWith("Lunge:") ||
    msg.startsWith("Tree Pose:") ||
    msg.startsWith("Lateral Raise:") ||
    msg.startsWith("Tricep Kickback:") ||
    msg.startsWith("Push-up:") ||
    msg.startsWith("Knee push-up:") ||
    msg.startsWith("Wall Sit:") ||
    msg.startsWith("Sit-up:")
  ) {
    // Treat as instruction for mid/low-confidence or "do X" prompts.
    // (success cases above are excluded already)
    return true;
  }
  return false;
};

const scheduleVoiceReminder = (msg, acc) => {
  // If speech hasn't been unlocked by a user gesture, don't schedule.
  if (!speechReady.value) return;

  // Key reminders by message + accuracy bucket so voice matches current accuracy
  const accBucket =
    typeof acc === "number" ? (acc >= 90 ? "good" : acc >= 70 ? "mid" : "low") : "na";
  const key = `${msg}__${accBucket}`;

  // Avoid rescheduling for the same message/accuracy bucket
  if (pendingReminderKey.value === key) return;

  clearVoiceReminders();
  pendingReminderKey.value = key;

  reminderTimeoutId.value = setTimeout(() => {
    // Speak only if the message is still current
    if (statusMessage.value === msg) {
      speakNow(msg);
      // Repeat every 20s while still on the same message
      reminderIntervalId.value = setInterval(() => {
        // If message changed, stop repeating
        if (statusMessage.value !== msg) {
          clearVoiceReminders();
          return;
        }
        speakNow(msg);
      }, VOICE_REMINDER_MS);
    } else {
      clearVoiceReminders();
    }
  }, VOICE_REMINDER_MS);
};

// Throttle settings so we don't spam the backend every frame
const isSending = ref(false);
const lastSentAt = ref(0);
const SEND_INTERVAL_MS = 300; // ~3 requests/sec – smooth enough for real‑time feedback

const setExercise = (ex) => {
  currentExercise.value = ex;
  accuracy.value = 0;
  idealLandmarks.value = null;
  profileSide.value = "";
  holdSeconds.value = 0;
  const niceName = ex.replace('_', ' ');
  statusMessage.value = `Switched to ${niceName}. Waiting for body...`;

  // Unlock speech (browser requires user gesture)
  speechReady.value = true;

  // Don't speak the instruction immediately; schedule a reminder instead.
  clearVoiceReminders();
  scheduleVoiceReminder(statusMessage.value, accuracy.value);
};

const exercisesWithCounter = ["bicep_curl", "squat", "push_up", "sit_up", "wall_sit"];
const resetCountInProgress = ref(false);

const resetCount = async () => {
  if (!exercisesWithCounter.includes(currentExercise.value)) return;
  resetCountInProgress.value = true;
  try {
    const response = await axios.post(
      `${API_BASE_URL}/api/video/stream?type=${currentExercise.value}`,
      { landmarks: [], reset_counter: true },
      { timeout: 3000 }
    );
    if (response?.data) {
      repCount.value = typeof response.data.counter === "number" ? response.data.counter : 0;
      stage.value = typeof response.data.stage === "string" ? response.data.stage : "";
      holdSeconds.value = typeof response.data.hold_seconds === "number" ? response.data.hold_seconds : 0;
      statusMessage.value = response.data.message || "Count reset.";
    }
  } catch (err) {
    console.error("Reset count failed:", err);
    repCount.value = 0;
    stage.value = "";
    holdSeconds.value = 0;
    statusMessage.value = "Count reset (offline).";
  } finally {
    resetCountInProgress.value = false;
  }
};

const sendToBackend = async (landmarks) => {
  // Prevent overlapping requests
  if (isSending.value) return;

  const now = Date.now();
  if (now - lastSentAt.value < SEND_INTERVAL_MS) return;

  isSending.value = true;
  lastSentAt.value = now;

  try {
    const response = await axios.post(
      `${API_BASE_URL}/api/video/stream?type=${currentExercise.value}`,
      { landmarks },
      {
        timeout: 2000, // avoid hanging if backend is down
      }
    );

    if (response?.data) {
      connectionStatus.value = "connected";
      const msg = response.data.message ?? "AI server responded.";
      statusMessage.value = msg;
      accuracy.value =
        typeof response.data.accuracy === "number" ? response.data.accuracy : 0;
      stage.value = typeof response.data.stage === "string" ? response.data.stage : "";
      repCount.value = typeof response.data.counter === "number" ? response.data.counter : 0;
      squatFeet.value = typeof response.data.feet === "string" ? response.data.feet : "";
      squatKnee.value = typeof response.data.knee === "string" ? response.data.knee : "";
      idealLandmarks.value =
        response.data?.ideal_landmarks && typeof response.data.ideal_landmarks === "object"
          ? response.data.ideal_landmarks
          : null;
      profileSide.value =
        (currentExercise.value === "tricep_kickback" || currentExercise.value === "wall_sit") && response.data?.profile_side
          ? String(response.data.profile_side)
          : "";
      holdSeconds.value =
        currentExercise.value === "wall_sit" && typeof response.data?.hold_seconds === "number"
          ? response.data.hold_seconds
          : 0;

      // Update pose quality for skeleton: only green (correct) or red (wrong), never violet
      if (response.data && response.data.posture_ok === true) {
        poseQuality.value = "good";
      } else {
        poseQuality.value = "bad";
      }

      // Voice behavior:
      // - instructions are delayed (20s) and repeated every 20s until fixed
      // - plank corrections: speak once immediately (in sync with UI) then repeat every 20s
      // - success messages spoken immediately
      const isPlankCorrection =
        currentExercise.value === "plank" &&
        msg.startsWith("Plank:") &&
        (msg.includes("Hips too low") || msg.includes("Hips too high") || msg.includes("Get into plank") || msg.includes("Adjust your plank"));

      if (isPlankCorrection) {
        speakNow(msg);
        scheduleVoiceReminder(msg, accuracy.value);
      } else if (isInstructionMessage(msg, accuracy.value)) {
        scheduleVoiceReminder(msg, accuracy.value);
      } else {
        clearVoiceReminders();
        if (typeof accuracy.value === "number" && accuracy.value >= 80) {
          if (currentExercise.value === "tree_pose") {
            speakNow("Great tree pose. Hold and breathe steadily.");
          } else if (currentExercise.value === "plank") {
            speakNow("Good plank. Keep holding.");
          } else if (currentExercise.value === "lateral_raise") {
            speakNow("Good lateral raise.");
          } else if (currentExercise.value === "tricep_kickback") {
            speakNow("Good tricep kickback.");
          } else if (currentExercise.value === "push_up") {
            speakNow("Good push-up.");
          } else if (currentExercise.value === "wall_sit") {
            speakNow("Good wall sit. Keep holding.");
          } else if (currentExercise.value === "sit_up") {
            speakNow("Good sit-up.");
          } else {
            speakNow("Good posture.");
          }
        } else {
          speakNow(msg);
        }
      }
    }
  } catch (error) {
    connectionStatus.value = "error";
    clearVoiceReminders();
    poseQuality.value = "unknown";
    stage.value = "";
    repCount.value = 0;
    squatFeet.value = "";
    squatKnee.value = "";
    idealLandmarks.value = null;
    profileSide.value = "";
    holdSeconds.value = 0;
    // Distinguish between network errors and Django returning 4xx/5xx
    if (error.response) {
      const { status, data } = error.response;
      const serverMsg =
        (data && (data.detail || data.message || data.error)) ||
        "Check Django server logs.";
      statusMessage.value = `Server error (${status}): ${serverMsg}`;
    } else if (error.code === 'ECONNREFUSED' || error.message.includes('Network Error')) {
      statusMessage.value = `Connection failed: Cannot reach backend at ${API_BASE_URL}. Make sure Django is running on port 8000.`;
    } else {
      statusMessage.value =
        `Connection error: ${error.message || 'Cannot reach AI backend. Is Django running?'}`;
    }
    console.error("AI stream error:", error);
  } finally {
    isSending.value = false;
  }
};


// Face indices to exclude from ideal skeleton (same as user skeleton)
const FACE_IDX = new Set([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);

function drawIdealSkeleton(ctx, ideal, width, height) {
  if (!ideal || typeof ideal !== "object") return;
  const arr = [];
  for (let i = 0; i < 33; i++) {
    const v = ideal[String(i)];
    if (Array.isArray(v) && v.length >= 2) arr[i] = { x: v[0], y: v[1] };
    else arr[i] = null;
  }
  const bodyConnections = POSE_CONNECTIONS.filter(
    ([a, b]) => !FACE_IDX.has(a) && !FACE_IDX.has(b) && arr[a] && arr[b]
  );
  const magenta = "#c026d3";
  ctx.save();
  drawConnectors(ctx, arr, bodyConnections, { color: magenta, lineWidth: 3 });
  const bodyLandmarks = arr.filter((lm, i) => lm && !FACE_IDX.has(i));
  drawLandmarks(ctx, bodyLandmarks, { color: magenta, lineWidth: 2, radius: 3 });
  ctx.restore();
}

const onResults = async (results) => {
  // --- Ensure camera feed is always visible on the canvas ---
  const canvas = canvasElement.value;
  const videoCanvasCtx = canvas?.getContext('2d');

  if (canvas && videoCanvasCtx) {
    videoCanvasCtx.save();
    videoCanvasCtx.clearRect(0, 0, canvas.width, canvas.height);
    videoCanvasCtx.drawImage(results.image, 0, 0, canvas.width, canvas.height);

    // Draw ideal pose skeleton (magenta) when backend sends ideal_landmarks — skip for plank so only green/red show
    if (idealLandmarks.value && currentExercise.value !== "plank") {
      drawIdealSkeleton(videoCanvasCtx, idealLandmarks.value, canvas.width, canvas.height);
    }

    // Draw pose skeleton, excluding face landmarks
    if (results.poseLandmarks) {
      // Face-ish indices: nose/eyes/ears/mouth. (MediaPipe Pose has only these as "face".)
      const faceIdx = new Set([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);

      // IMPORTANT: drawConnectors expects the *original* landmark index space.
      // So we pass the full landmark array, but remove any connections that touch the face.
      const bodyConnections = POSE_CONNECTIONS.filter(
        ([a, b]) => !faceIdx.has(a) && !faceIdx.has(b)
      );
      // Only green (correct) or red (wrong); treat unknown as wrong
      const isGood = poseQuality.value === "good";
      const lineColor = isGood ? "#22c55e" : "#ef4444";
      const dotColor = isGood ? "#22c55e" : "#ef4444";
      drawConnectors(videoCanvasCtx, results.poseLandmarks, bodyConnections, {
        color: lineColor,
        lineWidth: 4,
      });

      // For dots, we can safely filter landmarks (no index mapping needed).
      const bodyLandmarks = results.poseLandmarks.filter((_, i) => !faceIdx.has(i));
      drawLandmarks(videoCanvasCtx, bodyLandmarks, {
        color: dotColor,
        lineWidth: 2,
        radius: 3,
      });
    }
    videoCanvasCtx.restore();
  }

  // If no body is detected yet, keep user informed and don't call backend
  if (!results.poseLandmarks) {
    statusMessage.value = "Positioning: Body not detected. Step back and ensure full body is visible.";
    accuracy.value = 0;
    return;
  }

  // Send landmarks to backend (throttled)
  await sendToBackend(results.poseLandmarks);
};

// Check backend connection on mount
const checkBackendConnection = async () => {
  try {
    // Try a simple POST with empty data to check if backend is reachable
    // This will fail with 400/405 but confirms server is running
    await axios.post(
      `${API_BASE_URL}/api/video/stream?type=bicep_curl`,
      { landmarks: [] },
      { timeout: 3000 }
    );
    connectionStatus.value = "connected";
    statusMessage.value = "Connected to AI server. Ready to track!";
  } catch (error) {
    // If we get a 400/405, server is running but request was invalid (expected)
    if (error.response && [400, 405].includes(error.response.status)) {
      connectionStatus.value = "connected";
      statusMessage.value = "Connected to AI server. Position yourself in front of the camera.";
      return;
    }
    
    // Otherwise, connection failed
    connectionStatus.value = "error";
    if (error.code === 'ECONNREFUSED' || error.message.includes('Network Error') || !error.response) {
      statusMessage.value = `Connection failed: Cannot reach backend at ${API_BASE_URL}. Make sure Django is running on port 8000.`;
    } else {
      statusMessage.value = `Connection check failed: ${error.message}`;
    }
    console.error("Backend connection check failed:", error);
  }
};

onMounted(async () => {
  // Check backend connection first
  await checkBackendConnection();

  const pose = new Pose({
    locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/pose/${file}`,
  });

  pose.setOptions({
    modelComplexity: 1,
    smoothLandmarks: true,
    minDetectionConfidence: 0.5,
    minTrackingConfidence: 0.5,
  });

  pose.onResults(onResults);

  if (videoElement.value) {
    const camera = new cam.Camera(videoElement.value, {
      onFrame: async () => {
        await pose.send({ image: videoElement.value });
      },
      width: 640,
      height: 480,
    });
    camera.start();
  } else {
    // Extra safety log to help when debugging camera binding
    console.warn("Video element not found; camera could not be started.");
  }
});
</script>

<template>
  <div class="container">
    <div class="button-group">
      <button @click="setExercise('hand_raise')" :class="{ active: currentExercise === 'hand_raise' }">HAND RAISE</button>
      <button @click="setExercise('bicep_curl')" :class="{ active: currentExercise === 'bicep_curl' }">BICEP CURL</button>
      <button @click="setExercise('plank')" :class="{ active: currentExercise === 'plank' }">PLANK</button>
      <button @click="setExercise('squat')" :class="{ active: currentExercise === 'squat' }">SQUAT</button>
      <button @click="setExercise('lunge')" :class="{ active: currentExercise === 'lunge' }">LUNGE</button>
      <button @click="setExercise('tree_pose')" :class="{ active: currentExercise === 'tree_pose' }">TREE POSE</button>
      <button @click="setExercise('lateral_raise')" :class="{ active: currentExercise === 'lateral_raise' }">LATERAL RAISE</button>
      <button @click="setExercise('tricep_kickback')" :class="{ active: currentExercise === 'tricep_kickback' }">TRICEP KICKBACK</button>
      <button @click="setExercise('push_up')" :class="{ active: currentExercise === 'push_up' }">PUSH-UP</button>
      <button @click="setExercise('wall_sit')" :class="{ active: currentExercise === 'wall_sit' }">WALL SIT</button>
      <button @click="setExercise('sit_up')" :class="{ active: currentExercise === 'sit_up' }">SIT-UP</button>
    </div>

    <p class="status-message" :class="{ 'text-danger': statusMessage.includes('Error') || connectionStatus === 'error' }">
      {{ statusMessage }}
    </p>
    <p v-if="currentExercise === 'tricep_kickback'" class="status-message hint">
      Stand sideways, bend forward at the hips, then extend your arm back.
      <span v-if="profileSide && profileSide !== 'unknown'"> Detected: {{ profileSide }} side.</span>
    </p>
    <p v-if="currentExercise === 'wall_sit'" class="status-message hint">
      Stand sideways. Sit down like a chair: hips back, knees about 90°, thighs parallel.
      <span v-if="profileSide && profileSide !== 'unknown'"> Detected: {{ profileSide }} side.</span>
    </p>
    <p v-if="currentExercise === 'squat' && (stage || squatFeet || squatKnee)" class="status-message">
      Stage: {{ stage || '...' }} | Reps: {{ repCount }} | Feet: {{ squatFeet || '...' }} | Knee: {{ squatKnee || '...' }}
    </p>
    <p v-if="currentExercise === 'bicep_curl'" class="status-message">
      Stage: {{ stage || '...' }} | Reps: {{ repCount }}
    </p>
    <p v-if="currentExercise === 'push_up'" class="status-message hint">
      Knee push-ups: keep a straight line from head to knees, hands under shoulders.
    </p>
    <p v-if="currentExercise === 'push_up'" class="status-message">
      Stage: {{ stage || '...' }} | Reps: {{ repCount }}
    </p>
    <p v-if="currentExercise === 'push_up'" class="status-message hint">
      100% = good form right now. Lower (bend elbows) then push up to count a rep.
    </p>
    <p v-if="currentExercise === 'wall_sit'" class="status-message">
      Hold: {{ typeof holdSeconds === 'number' ? holdSeconds : 0 }}s
    </p>
    <p v-if="currentExercise === 'sit_up'" class="status-message hint">
      Stand sideways. Lie on your back, curl up (shoulders toward knees), then lower.
    </p>
    <p v-if="currentExercise === 'sit_up'" class="status-message">
      Stage: {{ stage || '...' }} | Reps: {{ repCount }}
    </p>

    <div class="voice-row">
      <button
        v-if="exercisesWithCounter.includes(currentExercise)"
        class="voice-test"
        :disabled="resetCountInProgress"
        @click="resetCount"
      >
        {{ resetCountInProgress ? "Resetting…" : "Reset count" }}
      </button>
    </div>

    <div class="video-container">
      <video ref="videoElement" class="input_video" style="display:none"></video>
      <canvas ref="canvasElement" class="output_canvas" width="640" height="480"></canvas>
      <div class="accuracy-badge" :class="poseQuality === 'good' ? 'accuracy-good' : 'accuracy-bad'">Accuracy: {{ typeof accuracy === 'number' ? accuracy : '--' }}%</div>
    </div>
  </div>
</template>

<style scoped>
.container {
  text-align: center;
  padding: 0 20px 20px; /* less top space now that header is in navbar */
}

.button-group { 
  margin: 20px 0; 
  display: flex; 
  justify-content: center; 
  gap: 10px; 
  flex-wrap: wrap;
}

button { 
  padding: 8px 15px; 
  border-radius: 20px; 
  border: 1px solid #ddd; 
  cursor: pointer; 
  background: white;
  transition: all 0.2s;
}

button:hover {
  background: #f5f5f5;
}

button.active { 
  background: #35495e; 
  color: white; 
  border-color: #35495e;
}

.status-message { 
  font-weight: bold; 
  color: #41b883; 
  margin: 20px 0;
  font-size: 1.1rem;
}

.text-danger { 
  color: #ff4d4d; 
}

.status-message.hint {
  font-weight: normal;
  color: #8b9cad;
  font-size: 0.95rem;
}

.video-container { 
  position: relative; 
  display: inline-block; 
  border: 4px solid #41b883; 
  border-radius: 10px; 
  overflow: hidden; 
  background: #222; 
  margin-top: 20px;
}

.output_canvas { 
  display: block; 
}

.accuracy-badge {
  position: absolute;
  bottom: 10px;
  left: 50%;
  transform: translateX(-50%);
  background: rgba(0, 0, 0, 0.7);
  padding: 8px 16px;
  border-radius: 20px;
  font-weight: bold;
}
.accuracy-badge.accuracy-good {
  color: #22c55e;
}
.accuracy-badge.accuracy-bad {
  color: #ef4444;
}

.voice-row {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 12px;
  margin-bottom: 10px;
}

.voice-test {
  padding: 6px 12px;
  border-radius: 10px;
  border: 1px solid #ddd;
  background: #fff;
  cursor: pointer;
}

</style>
