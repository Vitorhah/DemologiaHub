export type AffiliationType = 'none' | 'dor' | 'medo' | 'nirvana' | 'corpo' | 'cura' | 'alma' | 'membrana';

export type CaseStatus = 'ativo' | 'arquivado' | 'critico';

export type CaseDangerLevel = 'baixo' | 'medio' | 'alto' | 'extremo';

export type ClueType = 'fisica' | 'testemunho' | 'oculta' | 'forense' | 'documento' | 'local';

export type ClueReliability = 'confirmada' | 'suspeita' | 'falsa';

export type SuspectRole = 'suspeito' | 'testemunha' | 'vitima' | 'aliado' | 'culpado';

export type TheoryStatus = 'aberta' | 'comprovada' | 'refutada';

export type CadernoWorkspaceTab = 'dossie' | 'pistas' | 'quadro' | 'suspeitos' | 'deducao';

export interface CadernoClue {
  id: string;
  t: string; // Título / Resumo da pista (mantido 't' para retrocompatibilidade)
  ok: boolean; // Pista analisada / confirmada (mantido 'ok' para retrocompatibilidade)
  type: ClueType;
  rel: ClueReliability;
  loc?: string; // Local onde foi encontrada
  foundBy?: string; // Agente que encontrou
  notes?: string; // Detalhes técnicos / observação forense
  createdAt?: number;
}

export interface CadernoSuspect {
  id: string;
  name: string;
  role: SuspectRole;
  suspicion: number; // 0 a 100
  alibi: string;
  motive: string;
  notes: string;
  linkedClueIds: string[];
}

export interface CadernoTimelineEvent {
  id: string;
  time: string; // Ex: "22:40" ou "Dia 1 - Noite"
  title: string;
  desc: string;
  verified: boolean;
}

export interface CadernoConnection {
  id: string;
  fromId: string; // ID de pista ou suspeito
  toId: string;   // ID de pista ou suspeito
  label: string;  // Razão do vínculo (ex: "Impressões digitais no local", "Contradição no álibi")
  color?: 'red' | 'amber' | 'emerald' | 'cyan';
}

export interface CadernoTheory {
  id: string;
  statement: string;
  status: TheoryStatus;
  createdAt: number;
}

export interface CadernoCase {
  id: string;
  title: string;
  status: CaseStatus;
  danger?: CaseDangerLevel;
  aff: AffiliationType;
  loc: string;
  lead: string;
  date: string;
  desc: string;
  notes: string;
  clues: CadernoClue[];
  suspects: CadernoSuspect[];
  timeline: CadernoTimelineEvent[];
  connections: CadernoConnection[];
  phenomena: string[]; // IDs dos fenômenos paranormais/forenses observados em campo
  theories: CadernoTheory[];
  updatedAt?: number;
}

export interface CadernoSharedPayload {
  type: 'caderno_campo_shared_v1';
  cases: CadernoCase[];
  updatedAt: number;
  updatedBy?: string;
}

export interface PhenomenonDefinition {
  id: string;
  label: string;
  category: 'oculto' | 'ambiental' | 'biologico' | 'psiquico';
  desc: string;
  affinities: AffiliationType[];
  weight: number;
}

export const AFFILIATION_META: Record<AffiliationType, {
  label: string;
  shortLabel: string;
  color: string;
  bgColor: string;
  borderColor: string;
  dotColor: string;
  hex: string;
  signature: string;
}> = {
  none: {
    label: 'Desconhecido',
    shortLabel: 'N/A',
    color: 'text-[#9a9aa6]',
    bgColor: 'bg-[#17171f]',
    borderColor: 'border-[#2c2c38]',
    dotColor: 'bg-[#70707c]',
    hex: '#70707c',
    signature: 'Sem ressonância paranormal catalogada até o momento.',
  },
  dor: {
    label: 'Dor',
    shortLabel: 'DOR',
    color: 'text-[#ff4d4d]',
    bgColor: 'bg-[#2a0808]/80',
    borderColor: 'border-[#d30000]/60',
    dotColor: 'bg-[#e60000]',
    hex: '#e60000',
    signature: 'Hemorragia anômala, lacerações simétricas, calor residual e ecos de agonia física.',
  },
  medo: {
    label: 'Medo',
    shortLabel: 'MEDO',
    color: 'text-[#c084fc]',
    bgColor: 'bg-[#1d0f30]/80',
    borderColor: 'border-[#9333ea]/60',
    dotColor: 'bg-[#a855f7]',
    hex: '#a855f7',
    signature: 'Paralisia, sombras estáticas, perda de memória recente e pavor irracional.',
  },
  nirvana: {
    label: 'Nirvana',
    shortLabel: 'NIRVANA',
    color: 'text-[#facc15]',
    bgColor: 'bg-[#282006]/80',
    borderColor: 'border-[#eab308]/60',
    dotColor: 'bg-[#eab308]',
    hex: '#eab308',
    signature: 'Euforia delirante, luzes fractais, apatia ao perigo e devoção hipnótica.',
  },
  corpo: {
    label: 'Corpo',
    shortLabel: 'CORPO',
    color: 'text-[#fb923c]',
    bgColor: 'bg-[#2b1406]/80',
    borderColor: 'border-[#f97316]/60',
    dotColor: 'bg-[#f97316]',
    hex: '#f97316',
    signature: 'Hipertrofia tecidual, mutação óssea, biomassa orgânica e força desumana.',
  },
  cura: {
    label: 'Cura',
    shortLabel: 'CURA',
    color: 'text-[#4ade80]',
    bgColor: 'bg-[#062612]/80',
    borderColor: 'border-[#22c55e]/60',
    dotColor: 'bg-[#22c55e]',
    hex: '#22c55e',
    signature: 'Regeneração celular descontrolada, esporos luminescentes e vitalidade parasitária.',
  },
  alma: {
    label: 'Alma',
    shortLabel: 'ALMA',
    color: 'text-[#38bdf8]',
    bgColor: 'bg-[#061e2e]/80',
    borderColor: 'border-[#0ea5e9]/60',
    dotColor: 'bg-[#38bdf8]',
    hex: '#38bdf8',
    signature: 'Queda brusca de temperatura, vozes em frequências de rádio e projeções espectrais.',
  },
  membrana: {
    label: 'Membrana',
    shortLabel: 'MEMBRANA',
    color: 'text-[#e879f9]',
    bgColor: 'bg-[#28092e]/80',
    borderColor: 'border-[#d946ef]/60',
    dotColor: 'bg-[#e879f9]',
    hex: '#e879f9',
    signature: 'Distorção gravitacional, falha em relógios/bússolas, geometria não-euclidiana.',
  },
};

export const STATUS_META: Record<CaseStatus, {
  label: string;
  color: string;
  bgColor: string;
  borderColor: string;
  dotColor: string;
}> = {
  ativo: {
    label: 'EM INVESTIGAÇÃO',
    color: 'text-[#ff4d4d]',
    bgColor: 'bg-[#260707]',
    borderColor: 'border-[#d30000]/60',
    dotColor: 'bg-[#ff3333]',
  },
  critico: {
    label: 'ALERTA CRÍTICO',
    color: 'text-amber-300',
    bgColor: 'bg-amber-950/60',
    borderColor: 'border-amber-500/60',
    dotColor: 'bg-amber-400',
  },
  arquivado: {
    label: 'CASO ENCERRADO',
    color: 'text-emerald-300',
    bgColor: 'bg-emerald-950/50',
    borderColor: 'border-emerald-500/50',
    dotColor: 'bg-emerald-400',
  },
};

export const CLUE_TYPE_META: Record<ClueType, {
  label: string;
  code: string;
  color: string;
  border: string;
  bg: string;
}> = {
  fisica: {
    label: 'Vestígio Físico',
    code: 'FIS',
    color: 'text-amber-300',
    border: 'border-amber-500/40',
    bg: 'bg-amber-950/30',
  },
  forense: {
    label: 'Análise Forense',
    code: 'FOR',
    color: 'text-red-300',
    border: 'border-red-500/40',
    bg: 'bg-red-950/30',
  },
  testemunho: {
    label: 'Depoimento',
    code: 'DEP',
    color: 'text-sky-300',
    border: 'border-sky-500/40',
    bg: 'bg-sky-950/30',
  },
  documento: {
    label: 'Documento / Registro',
    code: 'DOC',
    color: 'text-stone-200',
    border: 'border-stone-500/40',
    bg: 'bg-stone-900/50',
  },
  local: {
    label: 'Cena / Local',
    code: 'LOC',
    color: 'text-emerald-300',
    border: 'border-emerald-500/40',
    bg: 'bg-emerald-950/30',
  },
  oculta: {
    label: 'Anomalia Oculta',
    code: 'OCU',
    color: 'text-purple-300',
    border: 'border-purple-500/40',
    bg: 'bg-purple-950/30',
  },
};

export const CLUE_RELIABILITY_META: Record<ClueReliability, {
  label: string;
  color: string;
  border: string;
}> = {
  confirmada: {
    label: 'Confirmada',
    color: 'text-emerald-400',
    border: 'border-emerald-500/40',
  },
  suspeita: {
    label: 'Em Análise',
    color: 'text-amber-400',
    border: 'border-amber-500/40',
  },
  falsa: {
    label: 'Pista Falsa',
    color: 'text-red-400',
    border: 'border-red-500/40',
  },
};

export const SUSPECT_ROLE_META: Record<SuspectRole, {
  label: string;
  color: string;
  border: string;
  bg: string;
}> = {
  suspeito: {
    label: 'Suspeito',
    color: 'text-amber-300',
    border: 'border-amber-500/45',
    bg: 'bg-amber-950/35',
  },
  culpado: {
    label: 'Alvo / Culpado',
    color: 'text-red-300',
    border: 'border-red-500/55',
    bg: 'bg-red-950/45',
  },
  testemunha: {
    label: 'Testemunha',
    color: 'text-sky-300',
    border: 'border-sky-500/45',
    bg: 'bg-sky-950/35',
  },
  vitima: {
    label: 'Vítima / Desaparecido',
    color: 'text-purple-300',
    border: 'border-purple-500/45',
    bg: 'bg-purple-950/35',
  },
  aliado: {
    label: 'Informante / Aliado',
    color: 'text-emerald-300',
    border: 'border-emerald-500/45',
    bg: 'bg-emerald-950/35',
  },
};

export const CADERNO_LOCAL_STORAGE_KEY = 'demologia_caderno_v1';
export const CADERNO_SUPABASE_RECORD_ID = 'CADERNO_CAMPO_SHARED';
