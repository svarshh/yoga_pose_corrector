
import { useEffect, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router";
import { motion } from "motion/react";
import { Scan, CheckCircle, XCircle, Loader2 } from "lucide-react";
import { useGame } from "../context/GameContext";

export default function Analysis() {
  const { poseId } = useParams<{ poseId: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const { getPose, completePose } = useGame();
  
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState("Initializing vision system...");

  const pose = getPose(poseId || "");
  const userImage = location.state?.image;

  useEffect(() => {
    if (!pose || !userImage) {
      // Redirect back if missing data
      const timer = setTimeout(() => navigate("/"), 2000);
      return () => clearTimeout(timer);
    }

    const steps = [
      { p: 20, s: "Locating keypoints..." },
      { p: 45, s: "Analyzing spinal alignment..." },
      { p: 70, s: "Measuring joint angles..." },
      { p: 90, s: "Comparing with expert model..." },
      { p: 100, s: "Analysis complete!" }
    ];

    let stepIndex = 0;

    const interval = setInterval(() => {
      if (stepIndex >= steps.length) {
        clearInterval(interval);
        // Calculate mock score
        const mockScore = Math.floor(Math.random() * 30) + 70; // 70-100 score
        
        completePose(pose.id, mockScore);
        
        setTimeout(() => {
          navigate(`/result/${poseId}`, { state: { score: mockScore, image: userImage } });
        }, 1000);
        return;
      }
      
      setProgress(steps[stepIndex].p);
      setStatus(steps[stepIndex].s);
      stepIndex++;
    }, 800);

    return () => clearInterval(interval);
  }, [pose, userImage, navigate, completePose, poseId]);

  if (!pose || !userImage) {
    return (
      <div className="flex items-center justify-center h-full bg-slate-950 text-white">
        <Loader2 className="w-10 h-10 animate-spin text-indigo-500" />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-slate-950 relative overflow-hidden">
      {/* Scanning Overlay */}
      <div className="absolute inset-0 z-20 pointer-events-none">
        <motion.div 
          initial={{ top: "0%" }}
          animate={{ top: "100%" }}
          transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
          className="absolute left-0 right-0 h-1 bg-gradient-to-r from-transparent via-cyan-400 to-transparent shadow-[0_0_20px_rgba(34,211,238,0.8)]"
        />
        <div className="absolute inset-0 bg-[linear-gradient(rgba(16,185,129,0.1)_1px,transparent_1px),linear-gradient(90deg,rgba(16,185,129,0.1)_1px,transparent_1px)] bg-[size:40px_40px] opacity-20"></div>
      </div>

      {/* Main Image */}
      <div className="flex-1 relative">
        <img src={userImage} alt="Analysis" className="w-full h-full object-cover opacity-60 grayscale" />
        
        {/* Mock AI Dots */}
        {[...Array(5)].map((_, i) => (
          <motion.div
            key={i}
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: [0, 1.5, 1], opacity: [0, 1, 0.5] }}
            transition={{ delay: i * 0.5, duration: 1 }}
            className="absolute w-4 h-4 bg-cyan-400 rounded-full shadow-[0_0_10px_cyan]"
            style={{ 
              top: `${20 + Math.random() * 60}%`, 
              left: `${20 + Math.random() * 60}%` 
            }}
          />
        ))}
      </div>

      {/* Progress Bar / Console */}
      <div className="absolute bottom-0 left-0 right-0 bg-slate-900/90 backdrop-blur-xl border-t border-slate-700 p-6 rounded-t-3xl shadow-2xl z-30">
        <div className="flex items-center justify-between mb-2">
          <span className="text-cyan-400 font-mono text-xs uppercase tracking-widest animate-pulse">AI Vision v2.0</span>
          <span className="text-white font-bold font-mono">{progress}%</span>
        </div>
        
        <div className="h-2 bg-slate-800 rounded-full overflow-hidden mb-4 border border-slate-700">
          <motion.div 
            initial={{ width: 0 }}
            animate={{ width: `${progress}%` }}
            className="h-full bg-gradient-to-r from-cyan-500 to-blue-600 shadow-[0_0_10px_cyan]"
          />
        </div>

        <p className="text-center text-slate-300 font-medium text-sm flex items-center justify-center gap-2">
          {progress < 100 ? (
             <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
             <CheckCircle className="w-4 h-4 text-green-500" />
          )}
          {status}
        </p>
      </div>
    </div>
  );
}
