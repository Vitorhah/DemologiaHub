export type HandoutType = "documento" | "imagem" | "texto" | "pista" | "outro";

export type HandoutVisibility = "private" | "all" | "individual";

export interface HandoutFolder {
  id: string;
  name: string;
  createdAt: number;
}

export interface HandoutItem {
  id: string;
  title: string;
  description?: string;
  type: HandoutType;
  folderId: string | null;
  // Frente
  content: string;
  imageUrl: string;
  // Costas do papel / Verso
  hasBackSide: boolean;
  backText: string;
  backImageUrl: string;
  // Segredo revelável em tempo real
  secretText: string;
  secretImageUrl: string;
  secretRevealed: boolean;
  // Visibilidade
  visibility: HandoutVisibility;
  sharedWith: string[];
  // Metadados
  createdAt: number;
  updatedAt: number;
}

export interface HandoutsVaultPayload {
  items: HandoutItem[];
  folders: HandoutFolder[];
  updatedAt: number;
}

export interface HandoutBroadcastEvent {
  type: "shared" | "secret_revealed" | "updated" | "deleted";
  handoutId: string;
  visibility?: HandoutVisibility;
  sharedWith?: string[];
  handout?: HandoutItem;
  timestamp: number;
  senderNonce?: string;
}

export interface HandoutToastNotification {
  id: string;
  handout: HandoutItem;
  reason: "shared" | "secret_revealed";
  timestamp: number;
}

export const HANDOUT_TYPE_META: Record<
  HandoutType,
  { label: string; shortLabel: string; accentClass: string; borderClass: string }
> = {
  documento: {
    label: "Documentos e Cartas",
    shortLabel: "Documento",
    accentClass: "text-amber-300",
    borderClass: "border-amber-500/40",
  },
  imagem: {
    label: "Imagens e Fotografias",
    shortLabel: "Imagem",
    accentClass: "text-sky-300",
    borderClass: "border-sky-500/40",
  },
  texto: {
    label: "Textos e Anotações",
    shortLabel: "Texto",
    accentClass: "text-zinc-200",
    borderClass: "border-zinc-500/40",
  },
  pista: {
    label: "Pistas e Evidências",
    shortLabel: "Pista",
    accentClass: "text-[#ff6b72]",
    borderClass: "border-[#d30000]/50",
  },
  outro: {
    label: "Outros Materiais",
    shortLabel: "Outro",
    accentClass: "text-emerald-300",
    borderClass: "border-emerald-500/40",
  },
};

export const HANDOUT_VISIBILITY_META: Record<
  HandoutVisibility,
  { label: string; shortLabel: string; colorClass: string; borderClass: string; bgClass: string }
> = {
  private: {
    label: "Privado (Mestre)",
    shortLabel: "Privado",
    colorClass: "text-zinc-400",
    borderClass: "border-zinc-700",
    bgClass: "bg-zinc-900/80",
  },
  all: {
    label: "Todos os Jogadores",
    shortLabel: "Todos",
    colorClass: "text-emerald-300",
    borderClass: "border-emerald-500/50",
    bgClass: "bg-emerald-950/35",
  },
  individual: {
    label: "Individual (Selecionados)",
    shortLabel: "Individual",
    colorClass: "text-amber-300",
    borderClass: "border-amber-500/50",
    bgClass: "bg-amber-950/35",
  },
};
