export interface Pose {
  id: string;
  name: string;
  difficulty: "Easy" | "Medium" | "Hard";
  trophyReward: number;
  imageUrl: string;
  description: string;
  arena: number;
}

export const POSES: Pose[] = [
  {
    id: "corpse-pose",
    name: "Corpse Pose",
    difficulty: "Easy",
    trophyReward: 10,
    imageUrl:
      "https://images.unsplash.com/photo-1767611104976-86ce57776dc3?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHx5b2dhJTIwc2F2YXNhbmElMjBjb3Jwc2UlMjBwb3NlfGVufDF8fHx8MTc3MTkwMjQxMXww&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral",
    description:
      "A relaxation pose promoting deep rest and recovery.",
    arena: 1,
  },
  {
    id: "boat-pose",
    name: "Boat Pose",
    difficulty: "Medium",
    trophyReward: 15,
    imageUrl:
      "https://images.unsplash.com/photo-1767611127005-8806ecf76cc6?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHx5b2dhJTIwY29yZSUyMGJvYXR8ZW58MXx8fHwxNzcxOTAyNzM0fDA&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral",
    description: "Builds core strength and improves balance.",
    arena: 1,
  },
  {
    id: "crow-pose",
    name: "Crow Pose",
    difficulty: "Hard",
    trophyReward: 25,
    imageUrl:
      "https://images.unsplash.com/photo-1767611130016-bef9446bca68?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHx5b2dhJTIwYXJtJTIwYmFsYW5jZSUyMGNyb3d8ZW58MXx8fHwxNzcxOTAyODU5fDA&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral",
    description:
      "Advanced arm balance requiring strength and focus.",
    arena: 2,
  },
];

export interface UserState {
  trophies: number;
  completedPoses: string[];
}