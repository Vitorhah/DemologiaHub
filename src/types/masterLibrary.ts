import type { RitualItem } from "../utils/rituals";
import type { PdiItem } from "../utils/pdi";
import type { MasterPushSkillInput, MasterPushTributoInput } from "./masterDataPush";

export type MasterLibraryItemType = "ritual" | "skill" | "pdi" | "tributo";

export interface MasterLibrarySkillData extends MasterPushSkillInput {
  id: number;
  testVar: string;
  damageVar: string;
  testPostVar: string;
  testPostFormula: string;
  damagePostVar: string;
  damagePostFormula: string;
}

export type MasterLibraryTributoData = MasterPushTributoInput;

export interface MasterLibraryFolder {
  id: string;
  name: string;
  parentId: string | null;
  createdAt: number;
  updatedAt: number;
}

export interface MasterLibraryItemBase {
  id: string;
  type: MasterLibraryItemType;
  folderId: string | null;
  createdAt: number;
  updatedAt: number;
}

export type MasterLibraryRitualItem = MasterLibraryItemBase & {
  type: "ritual";
  data: RitualItem;
};

export type MasterLibrarySkillItem = MasterLibraryItemBase & {
  type: "skill";
  data: MasterLibrarySkillData;
};

export type MasterLibraryPdiItem = MasterLibraryItemBase & {
  type: "pdi";
  data: PdiItem;
};

export type MasterLibraryTributoItem = MasterLibraryItemBase & {
  type: "tributo";
  data: MasterLibraryTributoData;
};

export type MasterLibraryItem =
  | MasterLibraryRitualItem
  | MasterLibrarySkillItem
  | MasterLibraryPdiItem
  | MasterLibraryTributoItem;

export interface MasterLibraryExportEnvelope {
  format: "demologia-library-item";
  version: 1;
  type: MasterLibraryItemType;
  exportedAt: string;
  data: RitualItem | MasterLibrarySkillData | PdiItem | MasterLibraryTributoData;
}

export interface MasterLibraryState {
  folders: MasterLibraryFolder[];
  items: MasterLibraryItem[];
}

export const MASTER_LIBRARY_TYPE_META: Record<
  MasterLibraryItemType,
  {
    label: string;
    pluralLabel: string;
    shortTag: string;
    description: string;
  }
> = {
  ritual: {
    label: "Ritual",
    pluralLabel: "Rituais",
    shortTag: "RITUAL",
    description: "Conjurações paranormais com nível (1-4), afiliações, dificuldade e teste 2d6+OCU.",
  },
  skill: {
    label: "Skill",
    pluralLabel: "Skills",
    shortTag: "SKILL",
    description: "Habilidades de personagem com custo de PE, fórmulas de teste/dano e variáveis.",
  },
  pdi: {
    label: "PDI",
    pluralLabel: "PDIs",
    shortTag: "PDI",
    description: "Poderes de Intenção com modificadores de dado e bônus/penalidades por atributo.",
  },
  tributo: {
    label: "Tributo",
    pluralLabel: "Tributos",
    shortTag: "TRIBUTO",
    description: "Tributos paranormais com descrição, efeito passivo e efeito ativo.",
  },
};
