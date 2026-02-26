
import { Outlet } from "react-router";
import { GameProvider } from "../context/GameContext";

export default function AppLayout() {
  return (
    <GameProvider>
      <div className="w-full h-screen bg-neutral-900 text-white overflow-hidden relative font-sans">
        <div className="absolute inset-0 z-0">
          <img 
            src="https://images.unsplash.com/photo-1634735274669-113558eb6b8a?auto=format&fit=crop&w=1080&q=80" 
            alt="Background" 
            className="w-full h-full object-cover opacity-20 filter blur-sm"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/80 to-indigo-900/40 mix-blend-multiply" />
        </div>
        <div className="relative z-10 w-full h-full flex flex-col max-w-md mx-auto bg-slate-950/80 backdrop-blur-sm border-x border-slate-800 shadow-2xl">
          <Outlet />
        </div>
      </div>
    </GameProvider>
  );
}
