import { DEFAULT_STATUS_KEYS } from "../utils/statusVariables";

export type DefaultStatusKey = (typeof DEFAULT_STATUS_KEYS)[number];

export type DefaultSixStatuses = Record<DefaultStatusKey, number>;

export interface MasterPushSkillInput {
  name: string;
  cost: number;
  desc: string;
  test: string;
  damage: string;
  needsTest: boolean;
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
  statuses?: DefaultSixStatuses;
}

export interface MasterDataPushEnvelope {
  id: string;
  targetPlayerIds: string[];
  payload: MasterDataPushPayload;
  sentAt: number;
}
