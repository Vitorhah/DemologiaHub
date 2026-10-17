export interface CadernoClue {
  t: string;       // Clue / evidence description
  ok: boolean;     // Confirmed / checked status
}

export type AffiliationType =
  | 'dor'
  | 'medo'
  | 'nirvana'
  | 'corpo'
  | 'cura'
  | 'alma'
  | 'membrana'
  | 'indefinida';

export type CaseStatus = 'invest' | 'resolvido' | 'arquivado';

export type DepartmentType =
  | 'indef'
  | 'inteligencia'
  | 'ciencia'
  | 'autoridade'
  | 'comando';

export type MembraneStatus = 'nenhum' | 'suspeita' | 'confirmada';

export interface CadernoCase {
  id: string;               // Unique case ID (e.g. 'c1742081234')
  title: string;            // Dossier title
  el: AffiliationType;      // Element / Affiliation
  status: CaseStatus;       // Investigation status
  dept: DepartmentType;     // Department handling
  mem: MembraneStatus;      // Membrane integrity status
  ent: string;              // Entity or tribute involved
  loc: string;              // Location of incident
  text: string;             // Detailed field notes / report
  clues: CadernoClue[];     // Evidence checklist
  created: number;          // Timestamp (ms)
  updated: number;          // Timestamp (ms)
  authorUid?: string;       // Agent UID who created
  authorName?: string;      // Agent name
}

export const CADERNO_ELEMENTS: Record<AffiliationType, [string, string]> = {
  dor: ['Dor', '#e0202f'],
  medo: ['Medo', '#9b5cff'],
  nirvana: ['Nirvana', '#4fc3d9'],
  corpo: ['Corpo', '#e07a3a'],
  cura: ['Cura', '#3fb27f'],
  alma: ['Alma', '#f0e6c8'],
  membrana: ['Membrana', '#d94fa0'],
  indefinida: ['Indefinida', '#8a8a94'],
};

export const CADERNO_DEPARTMENTS: Record<DepartmentType, string> = {
  indef: 'Não definido',
  inteligencia: 'Inteligência',
  ciencia: 'Ciência',
  autoridade: 'Autoridade',
  comando: 'Comando Operacional',
};

export const CADERNO_MEMBRANE: Record<MembraneStatus, string> = {
  nenhum: 'Sem indício',
  suspeita: 'Suspeita',
  confirmada: 'Confirmada',
};

export const CADERNO_STATUS: Record<CaseStatus, [string, string]> = {
  invest: ['Em investigação', '#e0a526'],
  resolvido: ['Resolvido', '#3fb27f'],
  arquivado: ['Arquivado', '#8a8a94'],
};

export const CADERNO_LOCAL_STORAGE_KEY = 'demologia_caderno_v1';
export const CADERNO_OLD_STORAGE_KEY = 'op_caderno_v1';
export const CADERNO_SUPABASE_RECORD_ID = 'CADERNO_CAMPO_SHARED';
