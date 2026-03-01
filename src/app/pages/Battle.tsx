import { useParams, useNavigate } from "react-router";
import { useEffect, useRef, useState, useMemo } from "react";
import { useGame } from "../context/GameContext";
import { Camera, ArrowLeft, Zap } from "lucide-react";

function pickBestMimeType() {
  const candidates = [
    "video/mp4;codecs=h264,aac",
    "video/mp4",
    "video/webm;codecs=vp9,opus",
    "video/webm;codecs=vp8,opus",
    "video/webm",
  ];

  for (const c of candidates) {
    try {
      if (typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported?.(c)) return c;
    } catch {}
  }
  return "";
}

export default function Battle() {
  const { poseId } = useParams<{ poseId: string }>();
  const navigate = useNavigate();
  const { getPose } = useGame();

  const pose = getPose(poseId || "");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  const [stream, setStream] = useState<MediaStream | null>(null);
  const [cameraOn, setCameraOn] = useState(false);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const stopTimerRef = useRef<number | null>(null);

  const [videoBlob, setVideoBlob] = useState<Blob | null>(null);
  const [videoObjectUrl, setVideoObjectUrl] = useState<string | null>(null);

  const [recording, setRecording] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [imagePreview, setImagePreview] = useState<string | null>(null);

  const chosenMime = useMemo(() => pickBestMimeType(), []);

  // ✅ NEW: Attach stream to the <video> AFTER it mounts (fixes black/blank live preview)
  useEffect(() => {
    if (!cameraOn || !stream || !videoRef.current) return;

    const v = videoRef.current;
    v.srcObject = stream;
    v.muted = true;
    v.playsInline = true;

    // Best-effort play (some browsers need an explicit call)
    v.play().catch(() => {});
  }, [cameraOn, stream]);

  async function startCamera() {
    // reset any old media
    setImagePreview(null);
    setVideoBlob(null);
    if (videoObjectUrl) URL.revokeObjectURL(videoObjectUrl);
    setVideoObjectUrl(null);

    // stop previous stream if any
    stopStreamOnly();

    try {
      const s = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user" },
        audio: false,
      });

      // ✅ Just set state; the useEffect above will bind srcObject once <video> exists
      setStream(s);
      setCameraOn(true);
    } catch (e) {
      console.error(e);
      alert("Could not access camera. Please allow camera permissions.");
    }
  }

  function stopStreamOnly() {
    if (stopTimerRef.current) {
      window.clearTimeout(stopTimerRef.current);
      stopTimerRef.current = null;
    }

    if (stream) {
      stream.getTracks().forEach((t) => t.stop());
    }
    setStream(null);
    setCameraOn(false);

    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  }

  function stopRecorderOnly() {
    const mr = mediaRecorderRef.current;
    if (mr && mr.state === "recording") {
      try {
        mr.stop();
      } catch {}
    }
  }

  function stopCamera() {
    stopRecorderOnly();
    if (!recording) stopStreamOnly();
  }

  function startRecording() {
    if (!stream || recording || processing) return;

    setVideoBlob(null);
    if (videoObjectUrl) URL.revokeObjectURL(videoObjectUrl);
    setVideoObjectUrl(null);

    chunksRef.current = [];

    let mr: MediaRecorder;
    try {
      mr = chosenMime ? new MediaRecorder(stream, { mimeType: chosenMime }) : new MediaRecorder(stream);
    } catch {
      mr = new MediaRecorder(stream);
    }

    mediaRecorderRef.current = mr;

    mr.ondataavailable = (e) => {
      if (e.data && e.data.size > 0) chunksRef.current.push(e.data);
    };

    mr.onstop = () => {
      const mime = mr.mimeType || chosenMime || "video/webm";
      const blob = new Blob(chunksRef.current, { type: mime });

      setVideoBlob(blob);
      const url = URL.createObjectURL(blob);
      setVideoObjectUrl(url);

      setRecording(false);
      setProcessing(false);

      // OPTIONAL:
      // If you want the camera preview to stay live after recording, comment this out.
      stopStreamOnly();
    };

    setRecording(true);
    setProcessing(false);

    try {
      mr.start(200);
    } catch {
      mr.start();
    }

    stopTimerRef.current = window.setTimeout(() => {
      if (mr.state === "recording") {
        setProcessing(true);
        try {
          mr.stop();
        } catch {
          setProcessing(false);
        }
      }
    }, 4000);
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setVideoBlob(null);
    if (videoObjectUrl) URL.revokeObjectURL(videoObjectUrl);
    setVideoObjectUrl(null);

    const reader = new FileReader();
    reader.onloadend = () => setImagePreview(reader.result as string);
    reader.readAsDataURL(file);
  };

  const startAnalysis = () => {
    if (videoObjectUrl) {
      navigate(`/analysis/${poseId}`, { state: { videoUrl: videoObjectUrl } });
      return;
    }

    if (videoBlob) {
      const url = URL.createObjectURL(videoBlob);
      setVideoObjectUrl(url);
      navigate(`/analysis/${poseId}`, { state: { videoUrl: url } });
      return;
    }

    if (imagePreview) {
      navigate(`/analysis/${poseId}`, { state: { image: imagePreview } });
      return;
    }
  };

  useEffect(() => {
    return () => {
      try {
        const mr = mediaRecorderRef.current;
        if (mr && mr.state === "recording") mr.stop();
      } catch {}

      if (stream) stream.getTracks().forEach((t) => t.stop());
      // ❌ DO NOT revoke videoObjectUrl here (analysis may need it)
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stream]);

  if (!pose) return <div className="p-10 text-center text-white">Pose not found!</div>;

  const canOpenCamera = !cameraOn && !imagePreview && !videoObjectUrl && !videoBlob;
  const canRecord = cameraOn && !videoBlob && !videoObjectUrl;
  const canAnalyze = !!videoObjectUrl || !!videoBlob || !!imagePreview;

  return (
    <div className="flex flex-col h-full bg-slate-950 relative">
      {/* Header */}
      <div className="absolute top-0 left-0 right-0 p-4 z-20 flex justify-between items-center bg-gradient-to-b from-black/80 to-transparent">
        <button
          onClick={() => navigate(-1)}
          className="p-2 bg-black/40 backdrop-blur-md rounded-full text-white hover:bg-white/20 transition-colors"
        >
          <ArrowLeft className="w-6 h-6" />
        </button>
        <h1 className="text-xl font-bold text-white drop-shadow-md uppercase tracking-wider">{pose.name}</h1>
        <div className="w-10" />
      </div>

      {/* Main Visual */}
      <div className="flex-1 relative overflow-hidden flex flex-col">
        {/* Target */}
        <div className="h-1/2 relative bg-indigo-900/20">
          <img src={pose.imageUrl} alt="Target" className="w-full h-full object-cover opacity-80" />
          <div className="absolute bottom-4 left-4 bg-black/60 backdrop-blur-md px-3 py-1 rounded-lg text-sm text-white font-medium border border-white/10">
            Target Pose
          </div>
        </div>

        {/* User */}
        <div className="h-1/2 relative bg-slate-900 border-t-4 border-yellow-500 flex items-center justify-center overflow-hidden">
          {cameraOn ? (
            <>
              <video ref={videoRef} playsInline muted autoPlay className="w-full h-full object-cover" />
              <button
                onClick={stopCamera}
                className="absolute top-4 right-4 bg-red-500/80 p-2 rounded-full text-white hover:bg-red-600 transition-colors"
              >
                X
              </button>

              {recording && (
                <div className="absolute top-4 left-4 bg-red-600/80 px-3 py-1 rounded-full text-white text-xs font-bold">
                  REC
                </div>
              )}
              {processing && (
                <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-black/70 px-3 py-1 rounded-full text-white text-xs font-bold">
                  Finalizing…
                </div>
              )}
            </>
          ) : imagePreview ? (
            <>
              <img src={imagePreview} alt="User" className="w-full h-full object-cover" />
              <button
                onClick={() => setImagePreview(null)}
                className="absolute top-4 right-4 bg-red-500/80 p-2 rounded-full text-white hover:bg-red-600 transition-colors"
              >
                X
              </button>
            </>
          ) : videoObjectUrl ? (
            <>
              <video src={videoObjectUrl} controls playsInline className="w-full h-full object-cover" />
              <button
                onClick={() => {
                  if (videoObjectUrl) URL.revokeObjectURL(videoObjectUrl);
                  setVideoObjectUrl(null);
                  setVideoBlob(null);
                }}
                className="absolute top-4 right-4 bg-red-500/80 p-2 rounded-full text-white hover:bg-red-600 transition-colors"
              >
                X
              </button>
            </>
          ) : (
            <div className="text-center p-6 flex flex-col items-center gap-4 animate-pulse">
              <div className="w-20 h-20 rounded-full bg-slate-800 flex items-center justify-center border-4 border-dashed border-slate-600">
                <Camera className="w-8 h-8 text-slate-400" />
              </div>
              <div>
                <p className="text-slate-400 font-medium mb-1">Take a photo of yourself</p>
                <p className="text-xs text-slate-500">Match the pose above!</p>
              </div>
            </div>
          )}

          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileChange}
            accept="image/*"
            capture="user"
            className="hidden"
          />
        </div>

        {/* VS Badge */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-10">
          <div className="bg-red-600 text-white font-black text-2xl px-4 py-2 rounded-xl border-4 border-white shadow-xl rotate-12 transform scale-125">
            VS
          </div>
        </div>
      </div>

      {/* Action Bar */}
      <div className="bg-slate-900 p-4 border-t border-slate-800">
        {canOpenCamera ? (
          <button
            onClick={startCamera}
            className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold text-lg py-4 rounded-xl shadow-lg shadow-blue-900/50 transition-all flex items-center justify-center gap-2"
          >
            <Camera className="w-6 h-6" />
            OPEN CAMERA
          </button>
        ) : canRecord ? (
          <button
            onClick={startRecording}
            disabled={recording || processing}
            className="w-full bg-red-600 hover:bg-red-500 disabled:opacity-60 text-white font-bold text-lg py-4 rounded-xl shadow-lg transition-all flex items-center justify-center gap-2"
          >
            {processing ? "FINALIZING..." : recording ? "RECORDING..." : "RECORD 4s"}
          </button>
        ) : (
          <button
            onClick={startAnalysis}
            disabled={!canAnalyze}
            className="w-full bg-gradient-to-r from-yellow-500 to-orange-600 hover:from-yellow-400 hover:to-orange-500 disabled:opacity-60 text-white font-black text-xl py-4 rounded-xl shadow-lg shadow-orange-900/50 border-b-4 border-orange-800 active:border-b-0 active:translate-y-1 transition-all flex items-center justify-center gap-2"
          >
            <Zap className="w-6 h-6 fill-white" />
            ANALYZE
          </button>
        )}
      </div>
    </div>
  );
}