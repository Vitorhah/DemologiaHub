export type MinigameType = "timing" | "lockpick" | "emf" | "aim";

export type MinigameDifficulty = "facil" | "normal" | "dificil" | "pesadelo" | "custom";

export interface MinigameConfig {
  type: MinigameType;
  rounds: number;      // Total de rodadas / pontos necessários (1..12)
  speed: number;       // Velocidade / intensidade (1..10)
  maxErrors: number;   // Número de chances / erros permitidos (1..10)
  difficulty: MinigameDifficulty;
}

export interface MinigameAssignment {
  id: string;
  config: MinigameConfig;
  targetPlayerIds: string[];
  createdAt: number;
  senderName?: string;
}

export interface MinigameResultPayload {
  id: string;
  assignmentId: string;
  minigameType: MinigameType;
  playerId: string;
  playerName: string;
  hits: number;
  totalRounds: number;
  errors: number;
  maxErrors: number;
  success: boolean;
  finishedAt: number;
}

export interface MinigameToastNotification {
  id: string;
  result: MinigameResultPayload;
}

export interface MinigameMeta {
  type: MinigameType;
  label: string;
  shortDesc: string;
  playerInstruction: string;
}

export const MINIGAME_META: Record<MinigameType, MinigameMeta> = {
  timing: {
    type: "timing",
    label: "Timing",
    shortDesc: "Círculo com ponteiro giratório e zona de acerto.",
    playerInstruction: "Toque ou pressione Espaço quando o ponteiro cruzar a zona verde.",
  },
  lockpick: {
    type: "lockpick",
    label: "Fechadura",
    shortDesc: "Alinhar o controle com a zona certa em múltiplos pinos.",
    playerInstruction: "Mova o controle até alinhar o pino na faixa verde e trave.",
  },
  emf: {
    type: "emf",
    label: "Detector EMF",
    shortDesc: "Segurar e soltar para estabilizar a agulha na faixa.",
    playerInstruction: "Segure para subir e solte para descer mantendo a agulha na faixa verde.",
  },
  aim: {
    type: "aim",
    label: "Mira Tática",
    shortDesc: "Rastreio geométrico com alvos móveis e interferências.",
    playerInstruction: "Acerte os alvos verdes antes que o anel feche. Evite os decoys vermelhos.",
  },
};

export const DIFFICULTY_PRESETS: Record<
  Exclude<MinigameDifficulty, "custom">,
  { label: string; rounds: number; speed: number; maxErrors: number }
> = {
  facil: { label: "Fácil", rounds: 3, speed: 3, maxErrors: 4 },
  normal: { label: "Normal", rounds: 5, speed: 5, maxErrors: 3 },
  dificil: { label: "Difícil", rounds: 7, speed: 7, maxErrors: 2 },
  pesadelo: { label: "Pesadelo", rounds: 9, speed: 9, maxErrors: 1 },
};
