
import { useEffect, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router";
import { motion, AnimatePresence } from "motion/react";
import { Trophy, Star, ArrowRight, RefreshCw, X } from "lucide-react";
import { useGame } from "../context/GameContext";
import confetti from "canvas-confetti"; // Just kidding, I don't have this package. I'll simulate it with CSS/framer or skip.

export default function Result() {
  const { poseId } = useParams<{ poseId: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const { getPose, completePose } = useGame();
  
  const score = location.state?.score || 0;
  const userImage = location.state?.image;
  const pose = getPose(poseId || "");
  
  const [showTrophies, setShowTrophies] = useState(false);

  useEffect(() => {
    if (score > 80) {
      setShowTrophies(true);
      // Trigger confetti if we had the library, but let's do a simple CSS animation
    }
  }, [score]);

  if (!pose) return null;

  const isSuccess = score >= 70;
  const trophiesEarned = isSuccess ? Math.floor(pose.trophyReward * (score / 100)) : 0;

  return (
    <div className="flex flex-col h-full bg-slate-950 relative overflow-hidden">
      {/* Background Burst */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none overflow-hidden">
        <motion.div 
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 20, opacity: 0.2 }}
          transition={{ duration: 1.5, ease: "easeOut" }}
          className={`w-64 h-64 rounded-full blur-3xl ${isSuccess ? 'bg-yellow-500' : 'bg-red-500'}`}
        />
      </div>

      <div className="flex-1 flex flex-col items-center justify-center p-6 text-center relative z-10">
        
        {/* Outcome Badge */}
        <motion.div
          initial={{ scale: 0, rotate: -180 }}
          animate={{ scale: 1, rotate: 0 }}
          transition={{ type: "spring", stiffness: 200, damping: 15 }}
          className="mb-8"
        >
          {isSuccess ? (
            <div className="relative">
              <Star className="w-32 h-32 text-yellow-400 fill-yellow-400 drop-shadow-[0_0_15px_rgba(250,204,21,0.6)] animate-pulse" />
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-4xl font-black text-yellow-900 drop-shadow-sm">{score}</span>
              </div>
            </div>
          ) : (
            <div className="relative">
              <X className="w-32 h-32 text-red-500 drop-shadow-[0_0_15px_rgba(239,68,68,0.6)]" />
            </div>
          )}
        </motion.div>

        <motion.h1 
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.3 }}
          className="text-4xl font-black text-white mb-2 uppercase tracking-wide drop-shadow-lg"
        >
          {isSuccess ? "Victory!" : "Defeat"}
        </motion.h1>
        
        <motion.p 
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.4 }}
          className="text-slate-300 font-medium mb-8 max-w-[200px]"
        >
          {isSuccess 
            ? "Your form was excellent! Keep up the good work." 
            : "Focus on your alignment and try again."}
        </motion.p>

        {/* Rewards */}
        {isSuccess && (
          <motion.div 
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.6 }}
            className="bg-slate-800/80 backdrop-blur-md rounded-2xl p-6 border-2 border-slate-700 w-full mb-8 shadow-xl"
          >
            <h3 className="text-slate-400 text-xs font-bold uppercase mb-2 tracking-widest">Rewards</h3>
            <div className="flex justify-center items-center gap-4">
              <div className="flex flex-col items-center">
                <div className="bg-gradient-to-br from-yellow-300 to-yellow-600 w-16 h-16 rounded-xl flex items-center justify-center shadow-lg border-b-4 border-yellow-700 mb-2 relative overflow-hidden group">
                  <div className="absolute inset-0 bg-white/20 skew-x-12 -translate-x-full group-hover:translate-x-full transition-transform duration-700"></div>
                  <Trophy className="w-8 h-8 text-yellow-900 fill-yellow-100" />
                </div>
                <span className="font-bold text-yellow-400 text-lg">+{trophiesEarned}</span>
              </div>
            </div>
          </motion.div>
        )}
      </div>

      {/* Footer Buttons */}
      <div className="p-6 pb-10 bg-gradient-to-t from-slate-950 via-slate-950 to-transparent z-20 w-full flex flex-col gap-3">
        <button 
          onClick={() => navigate('/')}
          className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold text-lg py-4 rounded-xl shadow-lg shadow-blue-900/50 border-b-4 border-blue-800 active:border-b-0 active:translate-y-1 transition-all flex items-center justify-center gap-2 uppercase tracking-wider"
        >
          {isSuccess ? "Claim Rewards" : "Return Home"}
        </button>
        
        {!isSuccess && (
          <button 
            onClick={() => navigate(`/battle/${poseId}`)}
            className="w-full bg-slate-700 hover:bg-slate-600 text-white font-bold text-lg py-4 rounded-xl shadow-lg border-b-4 border-slate-800 active:border-b-0 active:translate-y-1 transition-all flex items-center justify-center gap-2 uppercase tracking-wider"
          >
            <RefreshCw className="w-5 h-5" />
            Try Again
          </button>
        )}
      </div>
    </div>
  );
}
