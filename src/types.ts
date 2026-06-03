export interface RPGCharacter {
  id: string;
  roomId: string;
  ownerId: string;
  name: string;
  isNPC: boolean;
  hp: { current: number; max: number };
  pe: { current: number; max: number };
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
  initiativeRoll?: number;
}

export interface Room {
  id: string;
  masterId: string;
  name: string;
  createdAt: number;
}
