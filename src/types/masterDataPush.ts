import { DEFAULT_STATUS_KEYS } from "../utils/statusVariables";
import type { RitualItem } from "../utils/rituals";
import type { PdiItem } from "../utils/pdi";

export type DefaultStatusKey = (typeof DEFAULT_STATUS_KEYS)[number];

export type DefaultSixStatuses = Record<DefaultStatusKey, number>;

export interface MasterPushSkillInput {
  name: string;
  cost: number;
  desc: string;
  test: string;
  damage: string;
  needsTest: boolean;
  testVar?: string;
  damageVar?: string;
  testPostVar?: string;
  testPostFormula?: string;
  damagePostVar?: string;
  damagePostFormula?: string;
}

export interface MasterPushTributoInput {
  name: string;
  desc: string;
  passivo: string;
  ativo: string;
}

export interface MasterDataPushPayload {
  skill?: MasterPushSkillInput;
  tributo?: MasterPushTributoInput;
  ritual?: RitualItem;
  pdi?: PdiItem;
  statuses?: DefaultSixStatuses;
}

export interface MasterDataPushEnvelope {
  id: string;
  targetPlayerIds: string[];
  payload: MasterDataPushPayload;
  sentAt: number;
}
