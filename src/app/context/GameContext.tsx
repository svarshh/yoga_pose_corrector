
import React, { createContext, useContext, useState, useEffect } from 'react';
import { POSES, Pose } from '../data';

interface GameState {
  trophies: number;
  completedPoses: string[];
  currentArena: number;
}

interface GameContextType {
  state: GameState;
  completePose: (poseId: string, accuracy: number) => void;
  getPose: (poseId: string) => Pose | undefined;
}

const GameContext = createContext<GameContextType | undefined>(undefined);

export const GameProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [state, setState] = useState<GameState>(() => {
    const saved = localStorage.getItem('yoga-clash-state');
    return saved ? JSON.parse(saved) : {
      trophies: 0,
      completedPoses: [],
      currentArena: 1
    };
  });

  useEffect(() => {
    localStorage.setItem('yoga-clash-state', JSON.stringify(state));
  }, [state]);

  const calculateArena = (trophies: number) => {
    if (trophies < 50) return 1;
    if (trophies < 150) return 2;
    return 3;
  };

  const completePose = (poseId: string, accuracy: number) => {
    const pose = POSES.find(p => p.id === poseId);
    if (!pose) return;

    // Only award full trophies if accuracy is high
    const reward = Math.floor(pose.trophyReward * (accuracy / 100));

    setState(prev => {
      const newTrophies = prev.trophies + reward;
      return {
        ...prev,
        trophies: newTrophies,
        currentArena: calculateArena(newTrophies),
        completedPoses: prev.completedPoses.includes(poseId) 
          ? prev.completedPoses 
          : [...prev.completedPoses, poseId]
      };
    });
  };

  const getPose = (poseId: string) => POSES.find(p => p.id === poseId);

  return (
    <GameContext.Provider value={{ state, completePose, getPose }}>
      {children}
    </GameContext.Provider>
  );
};

export const useGame = () => {
  const context = useContext(GameContext);
  if (!context) throw new Error('useGame must be used within a GameProvider');
  return context;
};
