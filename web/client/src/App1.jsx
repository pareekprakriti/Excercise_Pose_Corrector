import React, { useState, useEffect, useRef } from "react";
import "./index.css";

// ─── Exercises list ───────────────────────────────────────────────────────────
const EXERCISES = [
  { id: "hand_raise",      label: "Hand Raise",      icon: "🖐",  desc: "Shoulder mobility & range" },
  { id: "bicep_curl",      label: "Bicep Curl",       icon: "💪",  desc: "Elbow flexion form check" },
  { id: "plank",           label: "Plank",            icon: "🏋",  desc: "Core alignment & hold" },
  { id: "squat",           label: "Squat",            icon: "🦵",  desc: "Knee & hip mechanics" },
  { id: "lunge",           label: "Lunge",            icon: "🚶",  desc: "Balance & leg tracking" },
  { id: "tree_pose",       label: "Tree Pose",        icon: "🌳",  desc: "Balance & posture" },
  { id: "lateral_raise",   label: "Lateral Raise",    icon: "🦅",  desc: "Shoulder abduction" },
  { id: "tricep_kickback", label: "Tricep Kickback",  icon: "⚡",  desc: "Elbow extension form" },
  { id: "push_up",         label: "Push-Up",          icon: "🤸",  desc: "Chest & arm alignment" },
  { id: "wall_sit",        label: "Wall Sit",         icon: "🪑",  desc: "Quad endurance & hold" },
  { id: "sit_up",          label: "Sit-Up",           icon: "🔄",  desc: "Core flexion tracking" },
];

// ─── Index / Landing ──────────────────────────────────────────────────────────
function IndexPage({ onNavigate }) {
  return (
    <div className="center-wrap">
      <div className="hero-section">
        <div className="hero-badge">PC</div>
        <h1 className="hero-title">POSE CORRECTOR AI</h1>
        <p className="hero-sub">Real-time AI exercise correction for 11 movements.<br />Instant feedback, every rep.</p>
        <div className="button-row">
          <button className="btn primary" onClick={() => onNavigate("signin")}>Sign In</button>
          <button className="btn outline" onClick={() => onNavigate("signup")}>Create Account</button>
        </div>
      </div>
    </div>
  );
}

// ─── Sign In ──────────────────────────────────────────────────────────────────
function SignIn({ onNavigate, onLogin }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem("pc_demo_email");
    if (saved) { setEmail(saved); setRemember(true); }
  }, []);

  async function submit(e) {
    e.preventDefault();
    setError("");
    if (!email.trim()) return setError("Email is required");
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!re.test(email)) return setError("Enter a valid email");
    if (!password) return setError("Password is required");

    setLoading(true);
    try {
      const res = await fetch("http://localhost:8000/api/auth/signin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (data.error) { setError(data.error); setLoading(false); return; }
      if (remember) localStorage.setItem("pc_demo_email", email);
      else localStorage.removeItem("pc_demo_email");
      onLogin({ email: data.email, name: data.name });
    } catch (err) {
      setError("Cannot connect to server. Make sure Django is running.");
      setLoading(false);
    }
  }

  return (
    <div className="center-wrap">
      <div className="card form-card">
        <div className="card-title">SIGN IN</div>
        <div className="card-sub">Welcome back — let's train smart</div>
        <form onSubmit={submit} className="form">
          <label>Email
            <input type="email" value={email} onChange={e => setEmail(e.target.value)}
              placeholder="you@example.com" autoComplete="email" />
          </label>
          <label>Password
            <input type="password" value={password} onChange={e => setPassword(e.target.value)}
              placeholder="••••••••" autoComplete="current-password" />
          </label>
          <label className="row-inline">
            <input type="checkbox" checked={remember} onChange={e => setRemember(e.target.checked)} />
            <span>Remember me</span>
          </label>
          {error && <div className="error">{error}</div>}
          <div className="button-row">
            <button type="submit" className="btn primary" disabled={loading}>
              {loading ? "Signing in..." : "Sign In →"}
            </button>
            <button type="button" className="btn ghost" onClick={() => onNavigate("index")}>Back</button>
          </div>
        </form>
        <div className="card-footer">
          No account? <span className="link" onClick={() => onNavigate("signup")}>Create one free</span>
        </div>
      </div>
    </div>
  );
}

// ─── Sign Up ──────────────────────────────────────────────────────────────────
function SignUp({ onNavigate, onLogin }) {
  const [form, setForm] = useState({
    firstName: "", lastName: "", age: "", email: "", height: "", weight: "", password: ""
  });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  function update(k, v) { setForm(s => ({ ...s, [k]: v })); }

  async function submit(e) {
    e.preventDefault();
    setError("");
    if (!form.firstName.trim()) return setError("First name is required");
    if (!form.age || Number(form.age) <= 0) return setError("Enter a valid age");
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!re.test(form.email)) return setError("Enter a valid email");
    if (!form.height || Number(form.height) <= 0) return setError("Enter a valid height (cm)");
    if (!form.weight || Number(form.weight) <= 0) return setError("Enter a valid weight (kg)");
    if (!form.password || form.password.length < 6) return setError("Password must be at least 6 characters");
    setLoading(true);
    try {
      const res = await fetch("http://localhost:8000/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          firstName: form.firstName,
          lastName: form.lastName,
          email: form.email,
          age: form.age,
          height: form.height,
          weight: form.weight,
          password: form.password,
        }),
      });
      const data = await res.json();
      if (data.error) { setError(data.error); setLoading(false); return; }
      onLogin({ email: data.email, name: data.name });
    } catch (err) {
      setError("Cannot connect to server. Make sure Django is running.");
      setLoading(false);
    }
  }

  return (
    <div className="center-wrap">
      <div className="card form-card wide">
        <div className="card-title">CREATE ACCOUNT</div>
        <div className="card-sub">Start your AI-powered training journey</div>
        <form onSubmit={submit} className="form grid">
          <label>First Name
            <input type="text" value={form.firstName} onChange={e => update("firstName", e.target.value)} placeholder="Jane" />
          </label>
          <label>Last Name
            <input type="text" value={form.lastName} onChange={e => update("lastName", e.target.value)} placeholder="Doe" />
          </label>
          <label className="full-col">Email
            <input type="email" value={form.email} onChange={e => update("email", e.target.value)} placeholder="you@example.com" />
          </label>
          <label>Age
            <input type="number" value={form.age} onChange={e => update("age", e.target.value)} min="1" placeholder="25" />
          </label>
          <label>Height (cm)
            <input type="number" value={form.height} onChange={e => update("height", e.target.value)} placeholder="170" />
          </label>
          <label>Weight (kg)
            <input type="number" value={form.weight} onChange={e => update("weight", e.target.value)} placeholder="70" />
          </label>
          <label className="full-col">Password
            <input type="password" value={form.password} onChange={e => update("password", e.target.value)} placeholder="Min 6 characters" />
          </label>
          {error && <div className="error full-col">{error}</div>}
          <div className="button-row fullwidth">
            <button className="btn primary" type="submit" disabled={loading}>
              {loading ? "Creating..." : "Create Account →"}
            </button>
            <button type="button" className="btn ghost" onClick={() => onNavigate("index")}>Cancel</button>
          </div>
        </form>
        <div className="card-footer">
          Already have an account? <span className="link" onClick={() => onNavigate("signin")}>Sign in</span>
        </div>
      </div>
    </div>
  );
}

// ─── Dashboard ────────────────────────────────────────────────────────────────
function Dashboard({ user, onLogout }) {
  const [activeEx, setActiveEx] = useState(null);
  const [streaming, setStreaming] = useState(false);
  const [feedback, setFeedback] = useState(null);
  const [repCount, setRepCount] = useState(0);
  const [mode, setMode] = useState("live");
  const [uploadFile, setUploadFile] = useState(null);
  const [uploadPreview, setUploadPreview] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState(null);
  const [dragOver, setDragOver] = useState(false);

  const intervalRef = useRef(null);
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const canvasRef = useRef(null);
  const uploadVideoRef = useRef(null);
  const fileInputRef = useRef(null);

  const ex = EXERCISES.find(e => e.id === activeEx);

  function startSession(id) {
    setActiveEx(id);
    setFeedback(null);
    setRepCount(0);
    setStreaming(false);
    setMode("live");
    setUploadFile(null);
    setUploadPreview(null);
    setUploadResult(null);
  }

  function stopStream() {
    clearInterval(intervalRef.current);
    if (window._mpCamera) { try { window._mpCamera.stop(); } catch(e){} window._mpCamera = null; }
    window._poseRunning = false;
    window._isSending = false;
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
    if (videoRef.current) videoRef.current.srcObject = null;
    if (canvasRef.current) {
      const ctx = canvasRef.current.getContext("2d");
      ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
    }
    setStreaming(false);
    setFeedback(null);
  }

  function goBack() {
    stopStream();
    setActiveEx(null);
    setUploadFile(null);
    setUploadPreview(null);
    setUploadResult(null);
  }

  function handleFileSelect(file) {
    if (!file) return;
    const allowed = ["video/mp4", "video/webm", "video/quicktime", "video/avi", "video/mov"];
    if (!allowed.includes(file.type) && !file.name.match(/\.(mp4|webm|mov|avi|mkv)$/i)) {
      alert("Please upload a video file (mp4, webm, mov, avi)");
      return;
    }
    setUploadFile(file);
    setUploadPreview(URL.createObjectURL(file));
    setUploadResult(null);
  }

  function handleDrop(e) {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFileSelect(file);
  }

  async function submitVideo() {
    if (!uploadFile) return;
    setUploading(true);
    setUploadResult(null);
    const formData = new FormData();
    formData.append("file", uploadFile);
    try {
      const res = await fetch(
        `http://localhost:8000/api/video/upload?type=${activeEx}`,
        { method: "POST", body: formData }
      );
      const data = await res.json();
      setUploadResult(data);
    } catch (err) {
      setUploadResult({ error: "Failed to connect to server. Make sure Django is running." });
    } finally {
      setUploading(false);
    }
  }

  function toggleStream() {
    if (streaming) { stopStream(); return; }
    navigator.mediaDevices.getUserMedia({ video: true, audio: false })
      .then(stream => {
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play();
        }
        setStreaming(true);
        startMediaPipe(activeEx);
      })
      .catch(err => {
        alert("Camera access denied. Please allow camera access and try again.");
        console.error("Camera error:", err);
      });
  }

  function startMediaPipe(exId) {
    if (window._poseRunning) return;
    window._poseRunning = true;

    const loadScript = (src) => new Promise((res, rej) => {
      if (document.querySelector(`script[src="${src}"]`)) return res();
      const s = document.createElement("script");
      s.src = src; s.onload = res; s.onerror = rej;
      document.head.appendChild(s);
    });

    Promise.all([
      loadScript("https://cdn.jsdelivr.net/npm/@mediapipe/camera_utils/camera_utils.js"),
      loadScript("https://cdn.jsdelivr.net/npm/@mediapipe/pose/pose.js"),
    ]).then(() => {
      const { Pose, Camera } = window;
      const pose = new Pose({
        locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/pose/${file}`,
      });
      pose.setOptions({
        modelComplexity: 1, smoothLandmarks: true,
        enableSegmentation: false,
        minDetectionConfidence: 0.5, minTrackingConfidence: 0.5,
      });
      window._postureColor = "#00d4ff";

      const drawSkeleton = (lms, color) => {
        const canvas = canvasRef.current;
        const video = videoRef.current;
        if (!canvas || !video) return;
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        const ctx = canvas.getContext("2d");
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        const CONNECTIONS = [
          [11,12],[11,13],[13,15],[12,14],[14,16],
          [11,23],[12,24],[23,24],[23,25],[24,26],
          [25,27],[26,28],[27,29],[28,30],[29,31],[30,32]
        ];
        ctx.strokeStyle = color; ctx.lineWidth = 3;
        ctx.shadowColor = color; ctx.shadowBlur = 8;
        CONNECTIONS.forEach(([a, b]) => {
          const pa = lms[a], pb = lms[b];
          if (!pa || !pb || pa.visibility < 0.5 || pb.visibility < 0.5) return;
          ctx.beginPath();
          ctx.moveTo(pa.x * canvas.width, pa.y * canvas.height);
          ctx.lineTo(pb.x * canvas.width, pb.y * canvas.height);
          ctx.stroke();
        });
        ctx.shadowBlur = 0;
        lms.forEach(lm => {
          if (lm.visibility < 0.5) return;
          ctx.beginPath();
          ctx.arc(lm.x * canvas.width, lm.y * canvas.height, 5, 0, 2 * Math.PI);
          ctx.fillStyle = color; ctx.fill();
          ctx.strokeStyle = "#000"; ctx.lineWidth = 1; ctx.stroke();
        });
      };

      pose.onResults((results) => {
        if (!results.poseLandmarks) return;
        const lms = results.poseLandmarks;
        drawSkeleton(lms, window._postureColor);
        if (window._isSending) return;
        window._isSending = true;
        fetch(`http://localhost:8000/api/video/stream?type=${exId}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ landmarks: lms }),
        })
          .then(res => res.json())
          .then(data => {
            window._isSending = false;
            window._postureColor = data.posture_ok ? "#00ff87" : "#ff4757";
            setFeedback({ posture_ok: data.posture_ok, accuracy: data.accuracy || 0, message: data.message || "" });
            if (data.counter !== undefined) setRepCount(data.counter);
          })
          .catch(() => { window._isSending = false; });
      });

      const camera = new Camera(videoRef.current, {
        onFrame: async () => { await pose.send({ image: videoRef.current }); },
        width: 640, height: 480,
      });
      camera.start();
      window._mpCamera = camera;
    }).catch(err => console.error("MediaPipe load error:", err));
  }

  return (
    <div className="dashboard">
      <div className="topbar">
        <div className="topbar-logo" onClick={goBack}>
          <div className="logo-badge-sm">PC</div>
          <span className="topbar-title">POSE CORRECTOR AI</span>
        </div>
        <div className="topbar-right">
          <div className="user-info">
            <div className="user-name">{user.name}</div>
            <div className="user-email">{user.email}</div>
          </div>
          <div className="avatar">{user.name[0].toUpperCase()}</div>
          <button className="btn ghost" onClick={onLogout}>Sign Out</button>
        </div>
      </div>

      <div className="dash-body">
        {!activeEx ? (
          <>
            <div className="section-title">CHOOSE YOUR EXERCISE</div>
            <div className="section-sub">Select an exercise to start real-time AI form correction</div>
            <div className="ex-grid">
              {EXERCISES.map((ex, i) => (
                <div key={ex.id} className="ex-card" onClick={() => startSession(ex.id)}
                  style={{ animationDelay: `${i * 0.05}s` }}>
                  <div className="ex-card-icon">{ex.icon}</div>
                  <div className="ex-card-name">{ex.label}</div>
                  <div className="ex-card-desc">{ex.desc}</div>
                  <div className="ex-card-cta">Select →</div>
                </div>
              ))}
            </div>
          </>
        ) : (
          <div className="session-layout">
            <div className="session-left">
              <div className="session-header">
                <button className="btn ghost sm" onClick={goBack}>← Back</button>
                <div>
                  <div className="session-title">{ex.icon} {ex.label.toUpperCase()}</div>
                  <div className="session-desc">{ex.desc}</div>
                </div>
              </div>

              {/* Mode tabs */}
              <div className="mode-tabs">
                <button className={`mode-tab ${mode === "live" ? "active" : ""}`}
                  onClick={() => { stopStream(); setMode("live"); setUploadResult(null); }}>
                  📷 Live Camera
                </button>
                <button className={`mode-tab ${mode === "upload" ? "active" : ""}`}
                  onClick={() => { stopStream(); setMode("upload"); }}>
                  📁 Upload Video
                </button>
              </div>

              {mode === "live" ? (
                <>
                  <div className={`cam-box ${feedback ? (feedback.posture_ok ? "ok" : "bad") : ""}`}>
                    {streaming && <div className={`scan-line ${feedback?.posture_ok ? "" : "bad"}`} />}
                    <div className="corner tl" /><div className="corner tr" />
                    <div className="corner bl" /><div className="corner br" />
                    {streaming && (
                      <div className="live-badge">
                        <div className="live-dot" /><span>LIVE</span>
                      </div>
                    )}
                    <video ref={videoRef} autoPlay playsInline muted style={{
                      position: "absolute", inset: 0, width: "100%", height: "100%",
                      objectFit: "cover", borderRadius: 14,
                      display: streaming ? "block" : "none",
                    }} />
                    <canvas ref={canvasRef} style={{
                      position: "absolute", inset: 0, width: "100%", height: "100%",
                      borderRadius: 14, pointerEvents: "none",
                      display: streaming ? "block" : "none",
                    }} />
                    {!streaming && (
                      <div className="cam-placeholder">
                        <div style={{ fontSize: 48, marginBottom: 12 }}>📷</div>
                        <div className="cam-label">Live Camera</div>
                        <div className="cam-hint">Click Start Analysis to enable webcam</div>
                      </div>
                    )}
                  </div>
                  <div className="cam-controls">
                    <button className={`btn ${streaming ? "danger" : "primary"}`}
                      onClick={toggleStream} style={{ flex: 1 }}>
                      {streaming ? "⏹ Stop" : "▶ Start Analysis"}
                    </button>
                    <button className="btn outline" onClick={() => setRepCount(0)}>Reset Count</button>
                  </div>
                </>
              ) : (
                <>
                  <div
                    className={`upload-box ${dragOver ? "drag-over" : ""} ${uploadPreview ? "has-video" : ""}`}
                    onDragOver={e => { e.preventDefault(); setDragOver(true); }}
                    onDragLeave={() => setDragOver(false)}
                    onDrop={handleDrop}
                    onClick={() => !uploadPreview && fileInputRef.current?.click()}
                  >
                    <input
                      ref={fileInputRef} type="file"
                      accept="video/mp4,video/webm,video/quicktime,video/avi,.mp4,.webm,.mov,.avi,.mkv"
                      style={{ display: "none" }}
                      onChange={e => handleFileSelect(e.target.files[0])}
                    />
                    {uploadPreview ? (
                      <video ref={uploadVideoRef} src={uploadPreview} controls
                        style={{ width: "100%", height: "100%", borderRadius: 12, objectFit: "contain" }} />
                    ) : (
                      <div className="upload-placeholder">
                        <div style={{ fontSize: 52, marginBottom: 14 }}>🎬</div>
                        <div className="upload-title">Drop video here or click to browse</div>
                        <div className="upload-hint">Supports MP4, MOV, WebM, AVI</div>
                      </div>
                    )}
                  </div>

                  <div className="cam-controls">
                    {uploadPreview && (
                      <>
                        <button className="btn primary" onClick={submitVideo}
                          disabled={uploading} style={{ flex: 1 }}>
                          {uploading ? "⏳ Analysing..." : "🔍 Analyse Video"}
                        </button>
                        <button className="btn outline" onClick={() => {
                          setUploadFile(null); setUploadPreview(null); setUploadResult(null);
                        }}>Change Video</button>
                      </>
                    )}
                    {!uploadPreview && (
                      <button className="btn primary" onClick={() => fileInputRef.current?.click()}
                        style={{ flex: 1 }}>
                        📁 Choose Video File
                      </button>
                    )}
                  </div>

                  {uploadResult && (
                    <div className="upload-result">
                      {uploadResult.error ? (
                        <div className="result-error">❌ {uploadResult.error}</div>
                      ) : (
                        <>
                          <div className="result-title">📊 Analysis Complete</div>
                          <div className={`feedback-status ${uploadResult.posture_ok ? "ok" : "bad"}`} style={{ marginBottom: 12 }}>
                            <div className={`status-dot ${uploadResult.posture_ok ? "ok" : "bad"}`} />
                            <span className={`status-text ${uploadResult.posture_ok ? "ok" : "bad"}`}>
                              {uploadResult.posture_ok ? "CORRECT FORM" : "NEEDS IMPROVEMENT"}
                            </span>
                          </div>
                          <div className="feedback-msg">{uploadResult.message}</div>
                          {uploadResult.accuracy !== undefined && (
                            <>
                              <div className="acc-row">
                                <span>ACCURACY</span><span className="acc-val">{uploadResult.accuracy}%</span>
                              </div>
                              <div className="acc-bar">
                                <div className="acc-fill" style={{
                                  width: `${uploadResult.accuracy}%`,
                                  background: uploadResult.accuracy > 80
                                    ? "linear-gradient(90deg,#00ff87,#00d4ff)"
                                    : uploadResult.accuracy > 50 ? "#ffb347" : "#ff4757"
                                }} />
                              </div>
                            </>
                          )}
                          {uploadResult.counter !== undefined && (
                            <div style={{ marginTop: 14, textAlign: "center" }}>
                              <div style={{ fontSize: 11, color: "var(--muted)", letterSpacing: 2, textTransform: "uppercase", marginBottom: 6 }}>Reps Detected</div>
                              <div style={{ fontFamily: "'Bebas Neue'", fontSize: 48, color: "var(--green)", textShadow: "0 0 20px rgba(0,255,135,.4)" }}>
                                {uploadResult.counter}
                              </div>
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Right: sidebar */}
            <div className="session-sidebar">
              <div className="side-card rep-card">
                <div className="side-label">Reps Completed</div>
                <div className="rep-count">{repCount}</div>
                <div className="rep-label">{ex.label}</div>
              </div>

              <div className="side-card">
                <div className="side-label">AI Feedback</div>
                {feedback ? (
                  <>
                    <div className={`feedback-status ${feedback.posture_ok ? "ok" : "bad"}`}>
                      <div className={`status-dot ${feedback.posture_ok ? "ok" : "bad"}`} />
                      <span className={`status-text ${feedback.posture_ok ? "ok" : "bad"}`}>
                        {feedback.posture_ok ? "CORRECT FORM" : "ADJUST FORM"}
                      </span>
                    </div>
                    <div className="feedback-msg">{feedback.message}</div>
                    <div className="acc-row">
                      <span>ACCURACY</span><span className="acc-val">{feedback.accuracy}%</span>
                    </div>
                    <div className="acc-bar">
                      <div className="acc-fill" style={{
                        width: `${feedback.accuracy}%`,
                        background: feedback.accuracy > 80
                          ? "linear-gradient(90deg,#00ff87,#00d4ff)"
                          : feedback.accuracy > 50 ? "#ffb347" : "#ff4757"
                      }} />
                    </div>
                  </>
                ) : (
                  <div className="no-feedback">
                    {streaming ? <><div className="spinner" />Initializing AI...</> : "Start analysis to see feedback"}
                  </div>
                )}
              </div>

              <div className="side-card">
                <div className="side-label">Exercise Info</div>
                <div style={{ fontSize: 28, marginBottom: 8 }}>{ex.icon}</div>
                <div className="info-name">{ex.label}</div>
                <div className="info-desc">{ex.desc}</div>
                <div className="api-hint">POST /api/video/stream?type={activeEx}</div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── App root ─────────────────────────────────────────────────────────────────
export default function App() {
  const [route, setRoute] = useState("index");
  const [user, setUser] = useState(null);

  useEffect(() => {
    const handler = () => {
      const h = window.location.hash.replace("#", "");
      if (h && !h.includes("dashboard")) setRoute(h);
    };
    window.addEventListener("hashchange", handler);
    handler();
    return () => window.removeEventListener("hashchange", handler);
  }, []);

  function navigate(to) { setRoute(to); window.location.hash = to; }
  function onLogin(u) { setUser(u); setRoute("dashboard"); window.location.hash = "dashboard"; }
  function onLogout() { setUser(null); setRoute("index"); window.location.hash = "index"; }

  return (
    <div className="app-bg">
      {route === "index"     && <IndexPage onNavigate={navigate} />}
      {route === "signin"    && <SignIn    onNavigate={navigate} onLogin={onLogin} />}
      {route === "signup"    && <SignUp    onNavigate={navigate} onLogin={onLogin} />}
      {route === "dashboard" && user && <Dashboard user={user} onLogout={onLogout} />}
      {route === "dashboard" && !user && navigate("signin")}
      <footer className="footer">© {new Date().getFullYear()} Pose Corrector AI</footer>
    </div>
  );
}
