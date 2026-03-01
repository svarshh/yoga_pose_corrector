import { FilesetResolver, PoseLandmarker } from "@mediapipe/tasks-vision";
import { useEffect, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router";
import { CheckCircle, Loader2 } from "lucide-react";
import { useGame } from "../context/GameContext";

type PoseKey = "boat" | "corpse" | "crow";

async function loadLandmarker() {
  const fileset = await FilesetResolver.forVisionTasks(
    "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm"
  );

  return PoseLandmarker.createFromOptions(fileset, {
    baseOptions: { modelAssetPath: "/pose_landmarker.task" },
    runningMode: "VIDEO",
    numPoses: 1,
  });
}

function getPoseKey(name: string): PoseKey | null {
  const n = name.toLowerCase();
  if (n.includes("boat")) return "boat";
  if (n.includes("corpse") || n.includes("savasana") || n.includes("shavasana")) return "corpse";
  if (n.includes("crow") || n.includes("bakasana")) return "crow";
  return null;
}

function packLandmarks(lm: any[]) {
  // Flask accepts list-of-lists or list-of-dicts; lists are most consistent.
  return lm.map((p) => [p.x, p.y, p.z ?? 0, p.visibility ?? p.presence ?? 0]);
}

async function scorePose(poseKey: PoseKey, landmarks: any[]) {
  const res = await fetch("http://127.0.0.1:5000/score_pose", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ pose: poseKey, landmarks }),
  });

  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

async function loadVideo(url: string): Promise<HTMLVideoElement> {
  const v = document.createElement("video");
  v.src = url;
  v.muted = true;
  v.playsInline = true;
  v.preload = "auto";

  // important
  v.load();

  await new Promise<void>((resolve, reject) => {
    const onReady = () => {
      cleanup();
      resolve();
    };
    const onErr = () => {
      cleanup();
      reject(new Error("Failed to load video"));
    };
    const cleanup = () => {
      v.removeEventListener("loadeddata", onReady);
      v.removeEventListener("error", onErr);
    };

    // loadeddata is more reliable for seek + decode
    v.addEventListener("loadeddata", onReady, { once: true });
    v.addEventListener("error", onErr, { once: true });
  });

  return v;
}

export default function Analysis() {
  const { poseId } = useParams<{ poseId: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const { getPose, completePose } = useGame();

  const pose = getPose(poseId || "");
  const videoUrl = location.state?.videoUrl as string | undefined;

  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState("Initializing...");

  useEffect(() => {
    let cancelled = false;
    let landmarker: PoseLandmarker | null = null;

    async function run() {
      if (!pose || !videoUrl) {
        setStatus("Missing pose/video. Returning home...");
        setTimeout(() => navigate("/"), 800);
        return;
      }

      try {
        setProgress(5);
        setStatus("Loading vision model...");
        landmarker = await loadLandmarker();

        if (cancelled) return;

        setProgress(15);
        setStatus("Loading video...");
        const video = await loadVideo(videoUrl);

        const poseKey = getPoseKey(pose.name);
        if (!poseKey) throw new Error(`Pose not supported: ${pose.name}`);

        // We don't need to render it; we just need frames.
        // Try to "prime" playback; if it fails, that's okay since seeking still works.
        try {
          await video.play();
        } catch {
          // ignore autoplay restrictions
        }

        // Analyze
        setProgress(25);
        setStatus("Analyzing frames...");

        const sampleFps = 5;
        const step = 1 / sampleFps;

        // If you record 4s, ignoring first ~1s is enough
        const startT = video.duration >= 4 ? 1.0 : 0.0;

        let correctFrames = 0;
        let totalFrames = 0;
        let lastMetrics: any[] = [];

        const denom = Math.max(video.duration - startT, 0.001);

        for (let t = startT; t < video.duration; t += step) {
          if (cancelled) return;

          // Seek
          await new Promise<void>((resolve) => {
            const onSeeked = () => {
              video.removeEventListener("seeked", onSeeked);
              resolve();
            };
            video.addEventListener("seeked", onSeeked);
            video.currentTime = t;
          });

          if (cancelled) return;

          const result = landmarker.detectForVideo(video, t * 1000);
          const lm = result.landmarks?.[0];
          if (!lm || lm.length !== 33) continue;

          // IMPORTANT: send packed numeric lists
          const scored = await scorePose(poseKey, packLandmarks(lm));

          totalFrames++;
          if (scored.correct) correctFrames++;
          lastMetrics = scored.metrics || [];

          const pct = 25 + Math.min(65, Math.round(((t - startT) / denom) * 65));
          setProgress(pct);
        }

        setProgress(92);
        setStatus("Finalizing...");

        const correctRate = totalFrames ? correctFrames / totalFrames : 0;

        // If we couldn't score anything, treat as failure but explain why
        if (totalFrames === 0) {
          setProgress(100);
          setStatus("No full pose detected. Try full-body in frame + better lighting.");
          completePose(pose.id, 0);

          setTimeout(() => {
            navigate(`/result/${poseId}`, {
              state: {
                score: 0,
                videoUrl,
                correct: false,
                correctRate: 0,
                metrics: [],
                poseKey,
                reason: "no_frames_scored",
              },
            });
          }, 600);

          return;
        }

        const score = Math.round(correctRate * 100);
        const isCorrect = correctRate >= 0.7;

        setProgress(100);
        setStatus(isCorrect ? "Correct pose ✅" : "Incorrect pose ❌");

        completePose(pose.id, score);

        setTimeout(() => {
          navigate(`/result/${poseId}`, {
            state: {
              score,
              videoUrl,
              correct: isCorrect,
              correctRate,
              metrics: lastMetrics,
              poseKey,
            },
          });
        }, 600);
      } catch (e: any) {
        console.error(e);
        if (cancelled) return;

        setProgress(0);
        setStatus(`Error: ${e?.message || String(e)}`);
        setTimeout(() => navigate("/"), 1200);
      } finally {
        try {
          landmarker?.close();
        } catch {
          // ignore
        }
      }
    }

    run();

    return () => {
      cancelled = true;
      try {
        landmarker?.close();
      } catch {
        // ignore
      }
    };
  }, [pose, videoUrl, navigate, completePose, poseId]);

  if (!pose || !videoUrl) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-950 text-white">
        <Loader2 className="w-10 h-10 animate-spin text-indigo-500" />
      </div>
    );
  }

  const done = progress >= 100;

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center px-6">
      <div className="w-full max-w-md bg-slate-900/70 border border-slate-700 rounded-3xl p-6 shadow-2xl">
        <div className="flex items-center justify-between mb-3">
          <div className="text-slate-200 font-black uppercase tracking-wider">Analyzing</div>
          <div className="text-slate-200 font-mono font-bold">{progress}%</div>
        </div>

        <div className="h-2 bg-slate-800 rounded-full overflow-hidden border border-slate-700 mb-4">
          <div
            className="h-full bg-gradient-to-r from-cyan-500 to-blue-600"
            style={{ width: `${progress}%` }}
          />
        </div>

        <div className="flex items-center justify-center gap-2 text-slate-300 text-sm">
          {done ? <CheckCircle className="w-4 h-4 text-green-500" /> : <Loader2 className="w-4 h-4 animate-spin" />}
          <span>{status}</span>
        </div>

        {/* Keep the video element offscreen if you want debugging later, but we’re using a created video element above */}
      </div>
    </div>
  );
}