export interface RPGCharacter {
  id: string;
  roomId: string;
  ownerId: string;
  name: string;
  isNPC: boolean;
  hp: { current: number; max: number };
  pe: { current: number; max: number };
  sm?: { current: number; max: number }; // Sanidade Mental (SM)
  ep?: number; // Exposição Paranormal (0-1000, editável apenas pelo Mestre)
  lv?: number; // Nível do personagem (>= 1, define o limite máximo dos atributos)
  profile?: import("./utils/profiles").CharacterProfileId;
  san: { current: number; max: number }; // PV and PE in rules are PV, PE, Sanidade
  attributes: {
    AGL: number;
    FOR: number;
    INT: number;
    PRE: number;
    VIT: number;
    OCU: number;
    SAN: number; // SAN acts as attribute in rules? "SAN * 2"
  };
  skills: {
    id: number;
    name: string;
    cost: number;
    desc: string;
    test: string;
    damage: string;
  }[];
  tributes: {
    name: string;
    desc: string;
    passivo: string;
    ativo: string;
  };
  inventory: string[];
  status: string[]; // e.g. "SANG", "FRAT", "MED", "CORR", "LOUC"
  statusEffects?: import("./utils/statusEffects").StatusEffect[];
  ultimoSuspiro?: import("./utils/ultimoSuspiro").UltimoSuspiroState;
  pdis?: import("./utils/pdi").PdiItem[];
  rituals?: import("./utils/rituals").RitualItem[];
  initiativeRoll?: number;
}

export interface Room {
  id: string;
  masterId: string;
  name: string;
  createdAt: number;
}

export type GameMode = "demologia" | "rl";

export interface GameModeConfig {
  globalMode: GameMode;
  playerModes?: Record<string, GameMode>;
  skipTransition?: boolean;
}

export * from "./types/events";
export * from "./types/handouts";
export type { StatusEffect } from "./utils/statusEffects";
export type { UltimoSuspiroState } from "./utils/ultimoSuspiro";
export {
  DEMOLOGIA_STAT_KEYS,
  DEMOLOGIA_STAT_LABELS,
  VALID_PDI_DICE,
  DEFAULT_PDIS,
  normalizePdis,
} from "./utils/pdi";
export type {
  DemologiaStatKey,
  PdiDiceValue,
  PdiStatModifier,
  PdiItem,
} from "./utils/pdi";
export {
  CHARACTER_PROFILES,
  CHARACTER_PROFILE_LIST,
  DEFAULT_CHARACTER_PROFILE,
  normalizeCharacterProfile,
} from "./utils/profiles";
export type {
  CharacterProfileId,
  CharacterProfileSymbol,
  CharacterProfileDefinition,
} from "./utils/profiles";
export {
  RITUAL_AFFILIATIONS,
  RITUAL_AFFILIATION_LIST,
  RITUAL_TEST_FORMULA,
  normalizeRituals,
  getRitualLimit,
  getRitualCapacityState,
  evaluateRitualTestOutcome,
} from "./utils/rituals";
export type {
  RitualAffiliationId,
  RitualAffiliationDefinition,
  RitualLevel,
  RitualItem,
  RitualCapacityState,
  RitualTestOutcome,
} from "./utils/rituals";


