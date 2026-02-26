
import { motion } from "motion/react";
import { Link } from "react-router";
import { Trophy, ShieldCheck, PlayCircle } from "lucide-react";
import { useGame } from "../context/GameContext";
import { POSES } from "../data";

export default function Home() {
  const { state } = useGame();

  const container = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1
      }
    }
  };

  const item = {
    hidden: { y: 20, opacity: 0 },
    show: { y: 0, opacity: 1 }
  };

  const getArenaName = (arena: number) => {
    switch (arena) {
      case 1: return "Digital Dojo";
      case 2: return "Zen Garden";
      case 3: return "Master's Temple";
      default: return "Legendary Arena";
    }
  };

  return (
    <div className="flex flex-col h-full bg-slate-950 p-4 pb-20 overflow-y-auto scrollbar-hide">
      {/* Header / Stats */}
      <motion.div 
        initial={{ y: -50, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="flex items-center justify-between bg-indigo-900/50 backdrop-blur-md rounded-2xl p-4 mb-6 border border-indigo-500/30 shadow-lg shadow-indigo-900/20 sticky top-0 z-20"
      >
        <div className="flex items-center gap-3">
          <div className="bg-yellow-500 p-2 rounded-xl shadow-inner border-2 border-yellow-300">
            <Trophy className="w-6 h-6 text-yellow-950 fill-yellow-950" />
          </div>
          <div>
            <h2 className="text-sm text-indigo-300 font-bold uppercase tracking-wider">Trophies</h2>
            <p className="text-2xl font-black text-white font-mono">{state.trophies}</p>
          </div>
        </div>
        <div className="flex flex-col items-end">
          <span className="text-xs text-indigo-300 font-bold uppercase">Arena {state.currentArena}</span>
          <span className="text-lg font-bold text-white">{getArenaName(state.currentArena)}</span>
        </div>
      </motion.div>

      {/* Main Content: The Deck */}
      <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
        <ShieldCheck className="w-5 h-5 text-indigo-400" />
        Your Deck
      </h3>

      <motion.div 
        variants={container}
        initial="hidden"
        animate="show"
        className="grid grid-cols-2 gap-4 pb-24"
      >
        {/* We can iterate over all available poses here */}
        {POSES.map((pose) => (
          <motion.div key={pose.id} variants={item}>
            <Link to={`/battle/${pose.id}`} className="block relative group">
              <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-transparent z-10 rounded-2xl opacity-60 group-hover:opacity-80 transition-opacity" />
              
              <div className={`
                bg-slate-800 rounded-2xl overflow-hidden border-2 transition-all shadow-lg relative aspect-[3/4]
                ${state.completedPoses.includes(pose.id) ? 'border-yellow-500 shadow-yellow-900/20' : 'border-slate-700 group-hover:border-indigo-500'}
              `}>
                <img 
                  src={pose.imageUrl} 
                  alt={pose.name} 
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                />
                
                {state.completedPoses.includes(pose.id) && (
                   <div className="absolute top-2 right-2 z-20 bg-yellow-500 text-yellow-950 p-1 rounded-full shadow-lg scale-75 rotate-12">
                     <Trophy className="w-4 h-4 fill-current" />
                   </div>
                )}
                
                <div className="absolute bottom-0 left-0 right-0 p-3 z-20">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-bold text-yellow-400 uppercase tracking-wider">{pose.difficulty}</span>
                    <div className="flex items-center gap-1 bg-black/50 backdrop-blur-sm px-2 py-0.5 rounded-full border border-white/10">
                      <Trophy className="w-3 h-3 text-yellow-500 fill-yellow-500" />
                      <span className="text-xs font-bold text-white">{pose.trophyReward}</span>
                    </div>
                  </div>
                  <h4 className="text-white font-bold text-lg leading-tight drop-shadow-md">{pose.name}</h4>
                </div>
              </div>
            </Link>
          </motion.div>
        ))}
      </motion.div>

      {/* Footer CTA */}
      <motion.div 
        initial={{ y: 50, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.5 }}
        className="fixed bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-slate-950 via-slate-950/90 to-transparent z-30 flex justify-center max-w-md mx-auto pointer-events-none"
      >
        <button className="pointer-events-auto bg-gradient-to-r from-yellow-500 to-orange-600 hover:from-yellow-400 hover:to-orange-500 text-white font-black text-xl py-4 px-8 rounded-2xl shadow-xl shadow-orange-900/50 border-b-4 border-orange-800 active:border-b-0 active:translate-y-1 transition-all flex items-center gap-3 w-full justify-center">
          <PlayCircle className="w-8 h-8 fill-white/20" />
          QUICK BATTLE
        </button>
      </motion.div>
    </div>
  );
}
