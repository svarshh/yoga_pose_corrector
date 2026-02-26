
import { useParams, useNavigate } from "react-router";
import { useState, useRef } from "react";
import { useGame } from "../context/GameContext";
import { motion, AnimatePresence } from "motion/react";
import { Camera, ArrowLeft, Upload, Zap } from "lucide-react";

export default function Battle() {
  const { poseId } = useParams<{ poseId: string }>();
  const navigate = useNavigate();
  const { getPose } = useGame();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);

  const pose = getPose(poseId || "");

  if (!pose) return <div className="p-10 text-center text-white">Pose not found!</div>;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const startAnalysis = () => {
    if (imagePreview) {
      // Navigate to analysis with the image (in a real app, pass via context or state)
      // For this mockup, we'll just assume the Analysis page can access it or we simulate it.
      // We'll pass the image via route state or just simulate "analyzing" the preview we have here.
      // Actually, let's keep it simple: Battle -> Analysis
      navigate(`/analysis/${poseId}`, { state: { image: imagePreview } });
    }
  };

  return (
    <div className="flex flex-col h-full bg-slate-950 relative">
      {/* Header */}
      <div className="absolute top-0 left-0 right-0 p-4 z-20 flex justify-between items-center bg-gradient-to-b from-black/80 to-transparent">
        <button onClick={() => navigate(-1)} className="p-2 bg-black/40 backdrop-blur-md rounded-full text-white hover:bg-white/20 transition-colors">
          <ArrowLeft className="w-6 h-6" />
        </button>
        <h1 className="text-xl font-bold text-white drop-shadow-md uppercase tracking-wider">{pose.name}</h1>
        <div className="w-10" /> {/* Spacer */}
      </div>

      {/* Main Visual - Split Screen or Toggle? */}
      <div className="flex-1 relative overflow-hidden flex flex-col">
        {/* Target Pose (Top Half) */}
        <div className="h-1/2 relative bg-indigo-900/20">
          <img src={pose.imageUrl} alt="Target" className="w-full h-full object-cover opacity-80" />
          <div className="absolute bottom-4 left-4 bg-black/60 backdrop-blur-md px-3 py-1 rounded-lg text-sm text-white font-medium border border-white/10">
            Target Pose
          </div>
        </div>

        {/* User Pose (Bottom Half) */}
        <div className="h-1/2 relative bg-slate-900 border-t-4 border-yellow-500 flex items-center justify-center group overflow-hidden">
          {imagePreview ? (
            <>
              <img src={imagePreview} alt="User" className="w-full h-full object-cover" />
              <button 
                onClick={() => setImagePreview(null)}
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
          
          {/* Hidden File Input */}
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
        {!imagePreview ? (
          <button 
            onClick={() => fileInputRef.current?.click()}
            className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold text-lg py-4 rounded-xl shadow-lg shadow-blue-900/50 transition-all flex items-center justify-center gap-2"
          >
            <Camera className="w-6 h-6" />
            OPEN CAMERA
          </button>
        ) : (
          <button 
            onClick={startAnalysis}
            className="w-full bg-gradient-to-r from-yellow-500 to-orange-600 hover:from-yellow-400 hover:to-orange-500 text-white font-black text-xl py-4 rounded-xl shadow-lg shadow-orange-900/50 border-b-4 border-orange-800 active:border-b-0 active:translate-y-1 transition-all flex items-center justify-center gap-2"
          >
            <Zap className="w-6 h-6 fill-white" />
            ANALYZE
          </button>
        )}
      </div>
    </div>
  );
}
