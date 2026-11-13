import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import {
  FolderOpen,
  Plus,
  Search,
  Check,
  X,
  Trash2,
  Edit3,
  Download,
  Upload,
  CheckCircle2,
  FolderPlus,
  Sparkles,
  ArrowLeft,
  Cloud,
  RefreshCw,
  Menu,
  Network,
  Users,
  Clock,
  FileText,
  Crosshair,
  AlertTriangle,
  Dices,
  Link2,
  ShieldAlert,
  Eye,
  Filter,
  ChevronDown,
  ChevronUp,
  HelpCircle,
} from 'lucide-react';
import {
  AffiliationType,
  CaseStatus,
  CaseDangerLevel,
  CadernoCase,
  CadernoClue,
  CadernoSuspect,
  CadernoTimelineEvent,
  CadernoConnection,
  CadernoTheory,
  CadernoWorkspaceTab,
  ClueType,
  ClueReliability,
  SuspectRole,
  TheoryStatus,
  AFFILIATION_META,
  STATUS_META,
  CLUE_TYPE_META,
  CLUE_RELIABILITY_META,
  SUSPECT_ROLE_META,
  CADERNO_LOCAL_STORAGE_KEY,
  CADERNO_SUPABASE_RECORD_ID,
} from '../types/caderno';
import {
  CADERNO_PHENOMENA,
  FIELD_NOTE_TEMPLATES,
  normalizeCase,
  deduceElementFromPhenomena,
  calculateCaseProgress,
  resolveNodeLabel,
} from '../utils/cadernoLogic';
import { supabase } from '../lib/supabase';

interface CadernoDeCampoViewProps {
  onBackToSheet?: () => void;
  onOpenSidebar?: () => void;
  userUid?: string;
  isOnline?: boolean;
  playerName?: string;
  onQuickRoll?: (formula: string, label?: string) => void;
}

const DANGER_META: Record<CaseDangerLevel, { label: string; color: string; border: string }> = {
  baixo: { label: 'RISCO BAIXO', color: 'text-emerald-400', border: 'border-emerald-500/40' },
  medio: { label: 'RISCO MODERADO', color: 'text-amber-300', border: 'border-amber-500/40' },
  alto: { label: 'RISCO ALTO', color: 'text-orange-400', border: 'border-orange-500/50' },
  extremo: { label: 'RISCO EXTREMO', color: 'text-[#ff4d4d]', border: 'border-[#d30000]/70' },
};

const THREAD_COLORS: Record<'red' | 'amber' | 'emerald' | 'cyan', { label: string; stroke: string; text: string; border: string; bg: string }> = {
  red: { label: 'Suspeita / Sangue', stroke: '#ef4444', text: 'text-red-400', border: 'border-red-500/50', bg: 'bg-red-950/30' },
  amber: { label: 'Cronologia / Local', stroke: '#f59e0b', text: 'text-amber-300', border: 'border-amber-500/50', bg: 'bg-amber-950/30' },
  emerald: { label: 'Álibi / Confirmado', stroke: '#10b981', text: 'text-emerald-300', border: 'border-emerald-500/50', bg: 'bg-emerald-950/30' },
  cyan: { label: 'Anomalia Oculta', stroke: '#38bdf8', text: 'text-sky-300', border: 'border-sky-500/50', bg: 'bg-sky-950/30' },
};

export const CadernoDeCampoView: React.FC<CadernoDeCampoViewProps> = ({
  onBackToSheet,
  onOpenSidebar,
  userUid,
  isOnline = true,
  playerName = 'Agente',
  onQuickRoll,
}) => {
  // Cases list state
  const [cases, setCases] = useState<CadernoCase[]>(() => {
    try {
      const saved = localStorage.getItem(CADERNO_LOCAL_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          return parsed
            .filter((c: any) => c?.id !== 'case_subsolo_04')
            .map(normalizeCase);
        }
      }
      const legacy = localStorage.getItem('op_caderno_v1');
      if (legacy) {
        const parsedLegacy = JSON.parse(legacy);
        if (Array.isArray(parsedLegacy)) {
          return parsedLegacy
            .filter((c: any) => c?.id !== 'case_subsolo_04')
            .map(normalizeCase);
        }
      }
    } catch (e) {
      console.error('Erro ao carregar Caderno de Campo:', e);
    }
    return [];
  });

  const [activeCaseId, setActiveCaseId] = useState<string | null>(() => {
    return cases[0]?.id ?? null;
  });

  const [workspaceTab, setWorkspaceTab] = useState<CadernoWorkspaceTab>('dossie');
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState<string>('all');
  const [mobileCasesDrawerOpen, setMobileCasesDrawerOpen] = useState(false);

  // Sync state
  const [syncStatus, setSyncStatus] = useState<'synced' | 'syncing' | 'offline'>('synced');
  const isRemoteUpdateRef = useRef(false);
  const lastSavedTimestampRef = useRef<number>(0);

  // Quick Investigative Dice Result Banner
  const [quickRollBanner, setQuickRollBanner] = useState<{
    skill: string;
    d20: number;
    total: number;
    crit: boolean;
    fumble: boolean;
  } | null>(null);

  // Clue Creation & Filtering State
  const [newClueText, setNewClueText] = useState('');
  const [newClueType, setNewClueType] = useState<ClueType>('fisica');
  const [newClueLoc, setNewClueLoc] = useState('');
  const [clueFilter, setClueFilter] = useState<'all' | 'confirmada' | 'suspeita' | 'falsa' | ClueType>('all');
  const [expandedClueId, setExpandedClueId] = useState<string | null>(null);

  // Mindboard / Connection Builder State
  const [connFromId, setConnFromId] = useState<string>('');
  const [connToId, setConnToId] = useState<string>('');
  const [connLabel, setConnLabel] = useState<string>('');
  const [connColor, setConnColor] = useState<'red' | 'amber' | 'emerald' | 'cyan'>('red');
  const [selectedBoardNodeId, setSelectedBoardNodeId] = useState<string | null>(null);

  // Suspect Creation State
  const [newSuspectName, setNewSuspectName] = useState('');
  const [newSuspectRole, setNewSuspectRole] = useState<SuspectRole>('suspeito');
  const [newSuspectAlibi, setNewSuspectAlibi] = useState('');
  const [newSuspectMotive, setNewSuspectMotive] = useState('');
  const [newSuspectSuspicion, setNewSuspectSuspicion] = useState<number>(50);

  // Timeline Creation State
  const [newEventTime, setNewEventTime] = useState('');
  const [newEventTitle, setNewEventTitle] = useState('');
  const [newEventDesc, setNewEventDesc] = useState('');

  // Theory Creation State
  const [newTheoryText, setNewTheoryText] = useState('');

  // Modal State for Creating / Editing a Case Dossier
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCaseId, setEditingCaseId] = useState<string | null>(null);
  const [formTitle, setFormTitle] = useState('');
  const [formStatus, setFormStatus] = useState<CaseStatus>('ativo');
  const [formDanger, setFormDanger] = useState<CaseDangerLevel>('medio');
  const [formAff, setFormAff] = useState<AffiliationType>('none');
  const [formLoc, setFormLoc] = useState('');
  const [formLead, setFormLead] = useState('');
  const [formDate, setFormDate] = useState('');
  const [formDesc, setFormDesc] = useState('');

  // Delete Confirmation Modal
  const [confirmDeleteModalOpen, setConfirmDeleteModalOpen] = useState(false);

  // Toast State
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const toastTimeoutRef = useRef<number | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const showToast = useCallback((msg: string) => {
    setToastMessage(msg);
    if (toastTimeoutRef.current) {
      window.clearTimeout(toastTimeoutRef.current);
    }
    toastTimeoutRef.current = window.setTimeout(() => {
      setToastMessage(null);
    }, 2600);
  }, []);

  // Ensure activeCaseId points to a valid case if cases exist
  useEffect(() => {
    if (cases.length > 0 && (!activeCaseId || !cases.some((c) => c.id === activeCaseId))) {
      setActiveCaseId(cases[0].id);
    } else if (cases.length === 0) {
      setActiveCaseId(null);
    }
  }, [cases, activeCaseId]);

  // Save to LocalStorage & Supabase
  const persistCases = useCallback(
    async (updatedCases: CadernoCase[], skipRemote = false) => {
      try {
        localStorage.setItem(CADERNO_LOCAL_STORAGE_KEY, JSON.stringify(updatedCases));
      } catch (e) {
        console.error('Erro ao salvar Caderno localmente:', e);
      }

      if (skipRemote || !isOnline) {
        if (!isOnline) setSyncStatus('offline');
        return;
      }

      const now = Date.now();
      lastSavedTimestampRef.current = now;
      setSyncStatus('syncing');

      try {
        const { error } = await supabase.from('players').upsert({
          id: CADERNO_SUPABASE_RECORD_ID,
          data: {
            type: 'caderno_campo_shared_v1',
            cases: updatedCases,
            updatedAt: now,
            updatedBy: userUid || 'anon',
          },
          updated_at: new Date(now).toISOString(),
        });

        if (error) {
          setSyncStatus('offline');
        } else {
          setSyncStatus('synced');
        }
      } catch {
        setSyncStatus('offline');
      }
    },
    [isOnline, userUid]
  );

  // Initial Fetch + Realtime Subscription from Supabase
  useEffect(() => {
    if (!isOnline) {
      setSyncStatus('offline');
      return;
    }

    let isMounted = true;

    const fetchSharedCaderno = async () => {
      try {
        const { data, error } = await supabase
          .from('players')
          .select('data, updated_at')
          .eq('id', CADERNO_SUPABASE_RECORD_ID)
          .maybeSingle();

        if (error || !isMounted) return;

        if (data?.data && Array.isArray(data.data.cases) && data.data.cases.length > 0) {
          const remoteCases = data.data.cases.map(normalizeCase);
          isRemoteUpdateRef.current = true;
          setCases(remoteCases);
          localStorage.setItem(CADERNO_LOCAL_STORAGE_KEY, JSON.stringify(remoteCases));
          setSyncStatus('synced');
        } else {
          setCases((currentLocal) => {
            if (currentLocal.length > 0) {
              persistCases(currentLocal, false);
            }
            return currentLocal;
          });
        }
      } catch {
        if (isMounted) setSyncStatus('offline');
      }
    };

    fetchSharedCaderno();

    const channel = supabase
      .channel('caderno_campo_realtime')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'players',
          filter: `id=eq.${CADERNO_SUPABASE_RECORD_ID}`,
        },
        (payload) => {
          if (!isMounted) return;
          const newRecord = payload.new as { data?: any } | undefined;
          if (!newRecord?.data || !Array.isArray(newRecord.data.cases)) return;

          const remoteTimestamp = Number(newRecord.data.updatedAt || 0);
          if (remoteTimestamp > 0 && remoteTimestamp <= lastSavedTimestampRef.current) {
            return;
          }

          const normalizedRemote = newRecord.data.cases.map(normalizeCase);
          isRemoteUpdateRef.current = true;
          setCases(normalizedRemote);
          try {
            localStorage.setItem(CADERNO_LOCAL_STORAGE_KEY, JSON.stringify(normalizedRemote));
          } catch {
            // ignore storage quota errors
          }
          setSyncStatus('synced');
        }
      )
      .subscribe();

    return () => {
      isMounted = false;
      supabase.removeChannel(channel);
    };
  }, [isOnline, persistCases]);

  useEffect(() => {
    if (isRemoteUpdateRef.current) {
      isRemoteUpdateRef.current = false;
      return;
    }
    const timer = window.setTimeout(() => {
      persistCases(cases, false);
    }, 350);

    return () => window.clearTimeout(timer);
  }, [cases, persistCases]);

  const activeCase = useMemo(
    () => cases.find((c) => c.id === activeCaseId) || null,
    [cases, activeCaseId]
  );

  // Helper to update the currently active case cleanly
  const updateActiveCase = useCallback(
    (updater: (current: CadernoCase) => CadernoCase) => {
      if (!activeCaseId) return;
      setCases((prev) =>
        prev.map((c) => {
          if (c.id !== activeCaseId) return c;
          return { ...updater(c), updatedAt: Date.now() };
        })
      );
    },
    [activeCaseId]
  );

  // Filtered cases for sidebar
  const filteredCases = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return cases.filter((c) => {
      const matchSearch =
        !q ||
        c.title.toLowerCase().includes(q) ||
        c.desc.toLowerCase().includes(q) ||
        c.loc.toLowerCase().includes(q) ||
        c.lead.toLowerCase().includes(q) ||
        c.notes.toLowerCase().includes(q) ||
        c.clues.some((clue) => clue.t.toLowerCase().includes(q)) ||
        c.suspects.some((s) => s.name.toLowerCase().includes(q));

      if (!matchSearch) return false;
      if (activeFilter === 'all') return true;
      if (activeFilter === 'ativo' || activeFilter === 'arquivado' || activeFilter === 'critico') {
        return c.status === activeFilter;
      }
      return c.aff === activeFilter;
    });
  }, [cases, searchQuery, activeFilter]);

  // Metrics & Deductions for Active Case
  const caseMetrics = useMemo(() => {
    if (!activeCase) return null;
    return calculateCaseProgress(activeCase);
  }, [activeCase]);

  const phenomenaDeductions = useMemo(() => {
    if (!activeCase) return [];
    return deduceElementFromPhenomena(activeCase.phenomena);
  }, [activeCase]);

  // Quick Investigative Roll Handler
  const handleInvestigativeRoll = (skillName: string) => {
    const d20 = Math.floor(Math.random() * 20) + 1;
    const bonus = skillName === 'Investigação' ? 5 : skillName === 'Percepção' ? 4 : 3;
    const total = d20 + bonus;
    setQuickRollBanner({
      skill: skillName,
      d20,
      total,
      crit: d20 === 20,
      fumble: d20 === 1,
    });
    if (onQuickRoll) {
      onQuickRoll(`1d20+${bonus}`, `Teste de ${skillName} (Caderno)`);
    }
  };

  // Modal Openers
  const openCreateModal = () => {
    setEditingCaseId(null);
    setFormTitle('');
    setFormStatus('ativo');
    setFormDanger('medio');
    setFormAff('none');
    setFormLoc('');
    setFormLead(playerName || '');
    const now = new Date();
    const formattedDate = `${String(now.getDate()).padStart(2, '0')}/${String(now.getMonth() + 1).padStart(2, '0')} · ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    setFormDate(formattedDate);
    setFormDesc('');
    setIsModalOpen(true);
  };

  const openEditModal = () => {
    if (!activeCase) return;
    setEditingCaseId(activeCase.id);
    setFormTitle(activeCase.title);
    setFormStatus(activeCase.status);
    setFormDanger(activeCase.danger || 'medio');
    setFormAff(activeCase.aff);
    setFormLoc(activeCase.loc);
    setFormLead(activeCase.lead);
    setFormDate(activeCase.date);
    setFormDesc(activeCase.desc);
    setIsModalOpen(true);
  };

  const handleSaveCaseModal = (e: React.FormEvent) => {
    e.preventDefault();
    const title = formTitle.trim();
    if (!title) return;

    if (editingCaseId) {
      setCases((prev) =>
        prev.map((c) =>
          c.id === editingCaseId
            ? {
                ...c,
                title,
                status: formStatus,
                danger: formDanger,
                aff: formAff,
                loc: formLoc.trim(),
                lead: formLead.trim(),
                date: formDate.trim(),
                desc: formDesc.trim(),
                updatedAt: Date.now(),
              }
            : c
        )
      );
      showToast('Dossiê atualizado');
    } else {
      const newId = 'case_' + Date.now();
      const newCase: CadernoCase = normalizeCase({
        id: newId,
        title,
        status: formStatus,
        danger: formDanger,
        aff: formAff,
        loc: formLoc.trim(),
        lead: formLead.trim(),
        date: formDate.trim(),
        desc: formDesc.trim(),
        notes: '',
        clues: [],
        suspects: [],
        timeline: [],
        connections: [],
        phenomena: [],
        theories: [],
        updatedAt: Date.now(),
      });
      setCases((prev) => [newCase, ...prev]);
      setActiveCaseId(newId);
      setWorkspaceTab('dossie');
      setMobileCasesDrawerOpen(false);
      showToast('Novo dossiê aberto');
    }

    setIsModalOpen(false);
  };

  const handleConfirmDelete = () => {
    if (!activeCaseId) return;
    const remaining = cases.filter((c) => c.id !== activeCaseId);
    setCases(remaining);
    setActiveCaseId(remaining[0]?.id ?? null);
    setConfirmDeleteModalOpen(false);
    showToast('Dossiê removido');
  };

  // Clues Handlers
  const handleAddClue = () => {
    const val = newClueText.trim();
    if (!val || !activeCase) return;
    const newClue: CadernoClue = {
      id: `${activeCase.id}_clue_${Date.now()}`,
      t: val,
      ok: false,
      type: newClueType,
      rel: 'suspeita',
      loc: newClueLoc.trim() || activeCase.loc || 'Cena Principal',
      foundBy: playerName || 'Agente',
      notes: '',
      createdAt: Date.now(),
    };
    updateActiveCase((c) => ({
      ...c,
      clues: [...c.clues, newClue],
    }));
    setNewClueText('');
    setNewClueLoc('');
    showToast('Evidência catalogada');
  };

  const handleToggleClueOk = (clueId: string) => {
    updateActiveCase((c) => ({
      ...c,
      clues: c.clues.map((cl) => {
        if (cl.id !== clueId) return cl;
        const nextOk = !cl.ok;
        return {
          ...cl,
          ok: nextOk,
          rel: nextOk ? 'confirmada' : cl.rel === 'confirmada' ? 'suspeita' : cl.rel,
        };
      }),
    }));
  };

  const handleChangeClueReliability = (clueId: string, rel: ClueReliability) => {
    updateActiveCase((c) => ({
      ...c,
      clues: c.clues.map((cl) =>
        cl.id === clueId ? { ...cl, rel, ok: rel === 'confirmada' } : cl
      ),
    }));
  };

  const handleUpdateClueNotes = (clueId: string, notes: string) => {
    updateActiveCase((c) => ({
      ...c,
      clues: c.clues.map((cl) => (cl.id === clueId ? { ...cl, notes } : cl)),
    }));
  };

  const handleDeleteClue = (clueId: string) => {
    updateActiveCase((c) => ({
      ...c,
      clues: c.clues.filter((cl) => cl.id !== clueId),
      connections: c.connections.filter((conn) => conn.fromId !== clueId && conn.toId !== clueId),
    }));
    showToast('Evidência descartada');
  };

  // Mindboard Connections Handlers
  const handleAddConnection = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeCase || !connFromId || !connToId || connFromId === connToId) {
      showToast('Selecione dois elementos distintos para vincular');
      return;
    }
    const label = connLabel.trim() || 'Vínculo Investigativo';
    const newConn: CadernoConnection = {
      id: `${activeCase.id}_conn_${Date.now()}`,
      fromId: connFromId,
      toId: connToId,
      label,
      color: connColor,
    };
    updateActiveCase((c) => ({
      ...c,
      connections: [...c.connections, newConn],
    }));
    setConnLabel('');
    showToast('Vínculo traçado no quadro');
  };

  const handleDeleteConnection = (connId: string) => {
    updateActiveCase((c) => ({
      ...c,
      connections: c.connections.filter((conn) => conn.id !== connId),
    }));
  };

  // Suspects Handlers
  const handleAddSuspect = (e: React.FormEvent) => {
    e.preventDefault();
    const name = newSuspectName.trim();
    if (!name || !activeCase) return;
    const newSuspect: CadernoSuspect = {
      id: `${activeCase.id}_susp_${Date.now()}`,
      name,
      role: newSuspectRole,
      suspicion: newSuspectSuspicion,
      alibi: newSuspectAlibi.trim(),
      motive: newSuspectMotive.trim(),
      notes: '',
      linkedClueIds: [],
    };
    updateActiveCase((c) => ({
      ...c,
      suspects: [...c.suspects, newSuspect],
    }));
    setNewSuspectName('');
    setNewSuspectAlibi('');
    setNewSuspectMotive('');
    setNewSuspectSuspicion(50);
    showToast('Pessoa de interesse registrada');
  };

  const handleUpdateSuspect = (suspectId: string, patch: Partial<CadernoSuspect>) => {
    updateActiveCase((c) => ({
      ...c,
      suspects: c.suspects.map((s) => (s.id === suspectId ? { ...s, ...patch } : s)),
    }));
  };

  const handleDeleteSuspect = (suspectId: string) => {
    updateActiveCase((c) => ({
      ...c,
      suspects: c.suspects.filter((s) => s.id !== suspectId),
      connections: c.connections.filter((conn) => conn.fromId !== suspectId && conn.toId !== suspectId),
    }));
    showToast('Registro removido');
  };

  // Timeline Handlers
  const handleAddTimelineEvent = (e: React.FormEvent) => {
    e.preventDefault();
    const title = newEventTitle.trim();
    if (!title || !activeCase) return;
    const newEv: CadernoTimelineEvent = {
      id: `${activeCase.id}_time_${Date.now()}`,
      time: newEventTime.trim() || '00:00',
      title,
      desc: newEventDesc.trim(),
      verified: false,
    };
    updateActiveCase((c) => ({
      ...c,
      timeline: [...c.timeline, newEv].sort((a, b) => a.time.localeCompare(b.time)),
    }));
    setNewEventTime('');
    setNewEventTitle('');
    setNewEventDesc('');
    showToast('Evento inserido na linha do tempo');
  };

  const handleToggleEventVerified = (eventId: string) => {
    updateActiveCase((c) => ({
      ...c,
      timeline: c.timeline.map((ev) =>
        ev.id === eventId ? { ...ev, verified: !ev.verified } : ev
      ),
    }));
  };

  const handleDeleteTimelineEvent = (eventId: string) => {
    updateActiveCase((c) => ({
      ...c,
      timeline: c.timeline.filter((ev) => ev.id !== eventId),
    }));
  };

  // Phenomena Deduction Toggle
  const handleTogglePhenomenon = (phenomenonId: string) => {
    updateActiveCase((c) => {
      const exists = c.phenomena.includes(phenomenonId);
      const next = exists
        ? c.phenomena.filter((id) => id !== phenomenonId)
        : [...c.phenomena, phenomenonId];
      return { ...c, phenomena: next };
    });
  };

  const handleApplyDeducedAffiliation = (aff: AffiliationType) => {
    updateActiveCase((c) => ({ ...c, aff }));
    showToast(`Afiliação atualizada para ${AFFILIATION_META[aff].label}`);
  };

  // Theories Handlers
  const handleAddTheory = (e: React.FormEvent) => {
    e.preventDefault();
    const statement = newTheoryText.trim();
    if (!statement || !activeCase) return;
    const newTh: CadernoTheory = {
      id: `${activeCase.id}_theo_${Date.now()}`,
      statement,
      status: 'aberta',
      createdAt: Date.now(),
    };
    updateActiveCase((c) => ({
      ...c,
      theories: [newTh, ...c.theories],
    }));
    setNewTheoryText('');
    showToast('Hipótese registrada');
  };

  const handleCycleTheoryStatus = (theoryId: string) => {
    const order: TheoryStatus[] = ['aberta', 'comprovada', 'refutada'];
    updateActiveCase((c) => ({
      ...c,
      theories: c.theories.map((th) => {
        if (th.id !== theoryId) return th;
        const nextStatus = order[(order.indexOf(th.status) + 1) % order.length];
        return { ...th, status: nextStatus };
      }),
    }));
  };

  const handleDeleteTheory = (theoryId: string) => {
    updateActiveCase((c) => ({
      ...c,
      theories: c.theories.filter((th) => th.id !== theoryId),
    }));
  };

  // Export & Import JSON
  const handleExportCases = () => {
    if (!cases.length) {
      showToast('Nenhum dossiê para exportar');
      return;
    }
    const str = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(cases, null, 2));
    const a = document.createElement('a');
    a.href = str;
    a.download = `caderno_investigacao_${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    showToast('Arquivo de investigação exportado');
  };

  const handleImportCases = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const imported = JSON.parse(ev.target?.result as string);
        if (Array.isArray(imported)) {
          const normalized = imported.map(normalizeCase);
          setCases(normalized);
          setActiveCaseId(normalized[0]?.id ?? null);
          showToast('Dossiês importados com sucesso');
        } else {
          showToast('Formato de arquivo inválido');
        }
      } catch {
        showToast('Erro ao ler arquivo JSON');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  // Filtered clues for the Clues tab
  const displayedClues = useMemo(() => {
    if (!activeCase) return [];
    return activeCase.clues.filter((cl) => {
      if (clueFilter === 'all') return true;
      if (clueFilter === 'confirmada' || clueFilter === 'suspeita' || clueFilter === 'falsa') {
        return cl.rel === clueFilter;
      }
      return cl.type === clueFilter;
    });
  }, [activeCase, clueFilter]);

  // All linkable nodes (Clues + Suspects) for the Mindboard
  const boardNodes = useMemo(() => {
    if (!activeCase) return [];
    const nodes: {
      id: string;
      kind: 'clue' | 'suspect';
      code: string;
      title: string;
      subtitle: string;
      accentHex: string;
      x: number;
      y: number;
    }[] = [];

    const totalClues = activeCase.clues.length;
    const totalSuspects = activeCase.suspects.length;

    // Position Suspects on upper row or inner ring, Clues on lower row or outer ring for clear visual lines
    activeCase.suspects.forEach((s, idx) => {
      const spread = Math.max(1, totalSuspects);
      const x = ((idx + 0.5) / spread) * 760 + 60;
      const y = 78 + (idx % 2) * 28;
      nodes.push({
        id: s.id,
        kind: 'suspect',
        code: `ALVO #${idx + 1}`,
        title: s.name,
        subtitle: `${SUSPECT_ROLE_META[s.role].label} · ${s.suspicion}% Suspeita`,
        accentHex: s.suspicion >= 70 ? '#ef4444' : '#f59e0b',
        x,
        y,
      });
    });

    activeCase.clues.forEach((cl, idx) => {
      const spread = Math.max(1, totalClues);
      const x = ((idx + 0.5) / spread) * 760 + 60;
      const y = totalSuspects > 0 ? 245 + (idx % 2) * 38 : 165 + (idx % 2) * 45;
      nodes.push({
        id: cl.id,
        kind: 'clue',
        code: `PISTA #${String(idx + 1).padStart(2, '0')}`,
        title: cl.t,
        subtitle: `${CLUE_TYPE_META[cl.type].label}${cl.loc ? ` · ${cl.loc}` : ''}`,
        accentHex: cl.rel === 'falsa' ? '#71717a' : cl.ok ? '#10b981' : '#38bdf8',
        x,
        y,
      });
    });

    return nodes;
  }, [activeCase]);

  const filterButtons: { id: string; label: string }[] = [
    { id: 'all', label: 'Todos' },
    { id: 'ativo', label: 'Ativos' },
    { id: 'critico', label: 'Críticos' },
    { id: 'arquivado', label: 'Arquivados' },
    { id: 'dor', label: 'Dor' },
    { id: 'medo', label: 'Medo' },
    { id: 'alma', label: 'Alma' },
    { id: 'membrana', label: 'Membrana' },
  ];

  const workspaceTabs: {
    id: CadernoWorkspaceTab;
    label: string;
    shortLabel: string;
    icon: React.FC<{ size?: number; className?: string }>;
    count?: number;
  }[] = [
    { id: 'dossie', label: 'Dossiê & Relatório', shortLabel: 'Dossiê', icon: FileText },
    {
      id: 'pistas',
      label: 'Pistas & Provas',
      shortLabel: 'Pistas',
      icon: Crosshair,
      count: activeCase?.clues.length || 0,
    },
    {
      id: 'quadro',
      label: 'Quadro de Conexões',
      shortLabel: 'Quadro',
      icon: Network,
      count: activeCase?.connections.length || 0,
    },
    {
      id: 'suspeitos',
      label: 'Pessoas de Interesse',
      shortLabel: 'Suspeitos',
      icon: Users,
      count: activeCase?.suspects.length || 0,
    },
    {
      id: 'deducao',
      label: 'Cronologia & Dedução',
      shortLabel: 'Dedução',
      icon: Clock,
      count: (activeCase?.phenomena.length || 0) + (activeCase?.timeline.length || 0),
    },
  ];

  return (
    <div className="w-full max-w-[1440px] mx-auto px-2.5 sm:px-4 lg:px-6 text-[#e4e4ec] font-sans select-none">
      {/* TOP COMMAND HEADER — Matches Demologya Tactical Dark Crimson / Obsidian Aesthetic */}
      <header className="bg-[#0d0d12] border border-[#24242e] border-t-2 border-t-[#d30000] p-3 sm:p-4 mb-4 shadow-[0_12px_32px_rgba(0,0,0,0.65)]">
        <div className="flex flex-wrap items-center justify-between gap-3">
          {/* Left: Menu Trigger + Title */}
          <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
            {onOpenSidebar && (
              <button
                type="button"
                onClick={onOpenSidebar}
                className="lg:hidden min-w-[44px] min-h-[44px] flex items-center justify-center bg-[#14141c] hover:bg-[#1e1e2a] text-[#d4d4dc] hover:text-white border border-[#2a2a36] rounded-none transition-colors cursor-pointer touch-manipulation shrink-0"
                title="Menu Principal"
                aria-label="Abrir menu lateral"
              >
                <Menu size={18} />
              </button>
            )}

            <button
              type="button"
              onClick={() => setMobileCasesDrawerOpen((prev) => !prev)}
              className="lg:hidden min-h-[44px] px-3 flex items-center gap-2 bg-[#16161f] hover:bg-[#20202c] text-[#e4e4ec] border border-[#2c2c3a] rounded-none text-xs font-mono uppercase tracking-wider cursor-pointer touch-manipulation shrink-0 whitespace-nowrap"
              title="Alternar arquivo de casos"
            >
              <FolderOpen size={15} className="text-[#ff4d4d]" />
              <span>Casos ({cases.length})</span>
            </button>

            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 bg-[#d30000] shadow-[0_0_8px_#d30000] shrink-0" />
                <span className="text-[10px] font-mono uppercase tracking-[0.22em] text-[#9a9aa8] truncate">
                  TERMINAL DE INTELIGÊNCIA · ARQUIVO FORENSE
                </span>
              </div>
              <h1 className="text-base sm:text-xl font-black uppercase tracking-[0.12em] text-white font-mono truncate">
                Caderno de Campo
              </h1>
            </div>
          </div>

          {/* Right: Sync Status + Quick Actions */}
          <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
            <div
              className={`hidden sm:flex items-center gap-1.5 px-2.5 min-h-[38px] border text-[10px] font-mono uppercase tracking-wider whitespace-nowrap ${
                syncStatus === 'synced'
                  ? 'bg-emerald-950/25 border-emerald-500/35 text-emerald-300'
                  : syncStatus === 'syncing'
                    ? 'bg-amber-950/25 border-amber-500/35 text-amber-300'
                    : 'bg-[#16161e] border-[#2b2b36] text-[#888896]'
              }`}
              title="Sincronização em tempo real com a mesa"
            >
              {syncStatus === 'syncing' ? (
                <RefreshCw size={12} className="animate-spin" />
              ) : (
                <Cloud size={12} />
              )}
              <span>
                {syncStatus === 'synced'
                  ? 'Mesa Sincronizada'
                  : syncStatus === 'syncing'
                    ? 'Sincronizando...'
                    : 'Modo Local'}
              </span>
            </div>

            {onBackToSheet && (
              <button
                type="button"
                onClick={onBackToSheet}
                className="min-h-[44px] lg:min-h-[38px] px-3 bg-[#14141c] hover:bg-[#1e1e28] text-[#c8c8d4] hover:text-white border border-[#2a2a36] rounded-none text-xs font-mono uppercase tracking-wider flex items-center gap-1.5 transition-colors cursor-pointer touch-manipulation whitespace-nowrap"
              >
                <ArrowLeft size={14} />
                <span className="hidden sm:inline">Voltar à Ficha</span>
              </button>
            )}

            <button
              type="button"
              onClick={handleExportCases}
              className="min-w-[44px] min-h-[44px] lg:min-h-[38px] px-2.5 bg-[#14141c] hover:bg-[#1e1e28] text-[#b4b4c2] hover:text-white border border-[#2a2a36] rounded-none text-xs font-mono uppercase flex items-center justify-center gap-1.5 transition-colors cursor-pointer touch-manipulation whitespace-nowrap"
              title="Exportar Dossiês (JSON)"
              aria-label="Exportar Dossiês"
            >
              <Download size={14} />
              <span className="hidden xl:inline">Exportar</span>
            </button>

            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="min-w-[44px] min-h-[44px] lg:min-h-[38px] px-2.5 bg-[#14141c] hover:bg-[#1e1e28] text-[#b4b4c2] hover:text-white border border-[#2a2a36] rounded-none text-xs font-mono uppercase flex items-center justify-center gap-1.5 transition-colors cursor-pointer touch-manipulation whitespace-nowrap"
              title="Importar Dossiês (JSON)"
              aria-label="Importar Dossiês"
            >
              <Upload size={14} />
              <span className="hidden xl:inline">Importar</span>
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".json"
              className="hidden"
              onChange={handleImportCases}
            />

            <button
              type="button"
              onClick={openCreateModal}
              className="min-h-[44px] lg:min-h-[38px] px-3.5 bg-[#b80000] hover:bg-[#d30000] active:scale-[0.99] text-white border border-[#ff4d4d]/60 rounded-none text-xs font-mono font-bold uppercase tracking-wider flex items-center gap-1.5 shadow-[0_0_16px_rgba(211,0,0,0.3)] transition-all cursor-pointer touch-manipulation whitespace-nowrap"
            >
              <Plus size={15} />
              <span>Novo Caso</span>
            </button>
          </div>
        </div>
      </header>

      {/* MAIN TWO-COLUMN INVESTIGATION WORKSPACE */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
        {/* LEFT COLUMN: CASE ARCHIVE SIDEBAR (Desktop persistent + Mobile Drawer) */}
        <aside
          className={`lg:col-span-4 xl:col-span-3 bg-[#0d0d12] border border-[#24242e] flex flex-col lg:sticky lg:top-4 ${
            mobileCasesDrawerOpen ? 'block mb-4' : 'hidden lg:flex'
          }`}
        >
          {/* Sidebar Header & Search */}
          <div className="p-3.5 border-b border-[#1e1e28] space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="w-[3px] h-3.5 bg-[#d30000]" />
                <span className="text-xs font-mono font-bold uppercase tracking-widest text-white">
                  Arquivo de Casos
                </span>
              </div>
              <span className="text-[11px] font-mono tabular-nums text-[#8e8e9c]">
                {filteredCases.length} / {cases.length}
              </span>
            </div>

            <div className="relative">
              <Search
                size={14}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-[#727282] pointer-events-none"
              />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Buscar caso, pista, suspeito..."
                className="w-full min-h-[40px] bg-[#13131b] border border-[#262632] focus:border-[#d30000] rounded-none pl-9 pr-3 py-2 text-xs text-white placeholder-[#686878] outline-none font-mono transition-colors"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-[#727282] hover:text-white cursor-pointer"
                  aria-label="Limpar busca"
                >
                  <X size={13} />
                </button>
              )}
            </div>

            {/* Compact Filter Bar */}
            <div className="flex gap-1 overflow-x-auto pb-1 no-scrollbar">
              {filterButtons.map((fb) => {
                const active = activeFilter === fb.id;
                return (
                  <button
                    key={fb.id}
                    type="button"
                    onClick={() => setActiveFilter(fb.id)}
                    className={`min-h-[32px] px-2.5 py-1 text-[10px] font-mono uppercase tracking-wider border rounded-none transition-colors cursor-pointer shrink-0 whitespace-nowrap ${
                      active
                        ? 'bg-[#2a0808] text-white border-[#d30000] font-bold'
                        : 'bg-[#13131b] text-[#8e8e9e] border-[#242430] hover:text-white'
                    }`}
                  >
                    {fb.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Case List */}
          <div className="divide-y divide-[#1a1a24] max-h-[420px] lg:max-h-[calc(100dvh-280px)] overflow-y-auto overscroll-contain">
            {filteredCases.length === 0 ? (
              <div className="p-6 text-center space-y-2">
                <p className="text-xs font-mono text-[#7c7c8c]">
                  Nenhum dossiê registrado.
                </p>
              </div>
            ) : (
              filteredCases.map((c) => {
                const isSelected = c.id === activeCaseId;
                const metrics = calculateCaseProgress(c);
                const affMeta = AFFILIATION_META[c.aff] || AFFILIATION_META.none;
                const statusMeta = STATUS_META[c.status] || STATUS_META.ativo;

                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => {
                      setActiveCaseId(c.id);
                      setMobileCasesDrawerOpen(false);
                    }}
                    className={`w-full text-left p-3.5 transition-colors cursor-pointer relative block ${
                      isSelected
                        ? 'bg-[#171216] border-l-[3px] border-l-[#d30000]'
                        : 'bg-transparent hover:bg-[#13131b]'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2 mb-1">
                      <span className="text-xs sm:text-sm font-bold text-white leading-snug line-clamp-1">
                        {c.title}
                      </span>
                      <span
                        className={`text-[10px] font-mono uppercase px-1.5 py-0.5 border shrink-0 whitespace-nowrap ${statusMeta.bgColor} ${statusMeta.color} ${statusMeta.borderColor}`}
                      >
                        {c.status === 'ativo' ? 'ATIVO' : c.status === 'critico' ? 'CRÍTICO' : 'ARQ'}
                      </span>
                    </div>

                    {/* Zero-pill static metadata row */}
                    <div className="text-[11px] font-mono text-[#888898] truncate mb-2">
                      {affMeta.shortLabel}
                      {c.loc ? ` · ${c.loc}` : ''}
                      {c.date ? ` · ${c.date}` : ''}
                    </div>

                    {/* Progress bar + tabular metrics */}
                    <div className="space-y-1">
                      <div className="flex items-center justify-between text-[10px] font-mono tabular-nums text-[#9a9aa8]">
                        <span>
                          {metrics.confirmedClues}/{metrics.activeClues} pistas · {c.suspects.length} suspeitos
                        </span>
                        <span className="text-white font-bold">{metrics.solvabilityPercent}%</span>
                      </div>
                      <div className="w-full h-1 bg-[#1b1b24] overflow-hidden">
                        <div
                          className="h-full bg-[#d30000] transition-all duration-300"
                          style={{ width: `${metrics.solvabilityPercent}%` }}
                        />
                      </div>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </aside>

        {/* RIGHT COLUMN: ACTIVE CASE WORKSPACE */}
        <section className="lg:col-span-8 xl:col-span-9 min-w-0">
          {!activeCase || !caseMetrics ? (
            <div className="bg-[#0d0d12] border border-[#24242e] p-8 sm:p-12 text-center space-y-4">
              <FolderPlus size={42} className="mx-auto text-[#d30000]" />
              <div className="space-y-1 max-w-md mx-auto">
                <h2 className="text-base sm:text-lg font-bold font-mono uppercase tracking-wider text-white">
                  Nenhum Dossiê Selecionado
                </h2>
                <p className="text-xs text-[#8e8e9e] leading-relaxed">
                  Inicie uma nova investigação para acessar o Dossiê Forense, Pistas, Quadro de Conexões, Pessoas de Interesse e Matriz de Dedução.
                </p>
              </div>
              <div className="flex flex-wrap justify-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={openCreateModal}
                  className="min-h-[44px] px-5 bg-[#b80000] hover:bg-[#d30000] text-white text-xs font-mono font-bold uppercase tracking-wider border border-[#ff4d4d]/50 cursor-pointer"
                >
                  + Criar Novo Dossiê
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {/* CASE DOSSIER HEADER CARD */}
              <div className="bg-[#0d0d12] border border-[#24242e] p-4 sm:p-5 relative overflow-hidden">
                <div
                  className="h-[3px] w-full absolute top-0 left-0"
                  style={{ backgroundColor: AFFILIATION_META[activeCase.aff].hex }}
                />

                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 pb-4 border-b border-[#1e1e28]">
                  <div className="space-y-1.5 min-w-0">
                    {/* Status + Danger + Affiliation Interactive Bar */}
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          const order: CaseStatus[] = ['ativo', 'critico', 'arquivado'];
                          const next = order[(order.indexOf(activeCase.status) + 1) % order.length];
                          updateActiveCase((c) => ({ ...c, status: next }));
                          showToast(`Status alterado: ${STATUS_META[next].label}`);
                        }}
                        className={`min-h-[28px] px-2.5 py-0.5 text-[10px] font-mono font-bold uppercase tracking-wider border flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${STATUS_META[activeCase.status].bgColor} ${STATUS_META[activeCase.status].color} ${STATUS_META[activeCase.status].borderColor}`}
                        title="Clique para alternar status do caso"
                      >
                        <span className={`w-1.5 h-1.5 ${STATUS_META[activeCase.status].dotColor}`} />
                        <span>{STATUS_META[activeCase.status].label}</span>
                      </button>

                      <span
                        className={`px-2 py-0.5 text-[10px] font-mono uppercase tracking-wider border ${
                          DANGER_META[activeCase.danger || 'medio'].color
                        } ${DANGER_META[activeCase.danger || 'medio'].border} bg-[#14141c]`}
                      >
                        {DANGER_META[activeCase.danger || 'medio'].label}
                      </span>

                      <span
                        className={`px-2 py-0.5 text-[10px] font-mono uppercase tracking-wider border ${
                          AFFILIATION_META[activeCase.aff].bgColor
                        } ${AFFILIATION_META[activeCase.aff].color} ${
                          AFFILIATION_META[activeCase.aff].borderColor
                        }`}
                      >
                        AFILIAÇÃO: {AFFILIATION_META[activeCase.aff].label.toUpperCase()}
                      </span>
                    </div>

                    <h2 className="text-lg sm:text-2xl font-black text-white tracking-wide leading-tight">
                      {activeCase.title}
                    </h2>

                    {/* Zero-pill static metadata string */}
                    <p className="text-xs font-mono text-[#9696a6]">
                      {[
                        activeCase.loc ? `LOCAL: ${activeCase.loc}` : null,
                        activeCase.lead ? `LÍDER: ${activeCase.lead}` : null,
                        activeCase.date ? `REGISTRO: ${activeCase.date}` : null,
                      ]
                        .filter(Boolean)
                        .join('  ·  ') || 'Sem metadados operacionais registrados'}
                    </p>
                  </div>

                  {/* Edit / Delete Case Controls */}
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={openEditModal}
                      className="min-h-[40px] px-3 bg-[#15151e] hover:bg-[#20202c] text-[#d4d4e0] hover:text-white border border-[#2a2a38] text-xs font-mono uppercase tracking-wider flex items-center gap-1.5 cursor-pointer touch-manipulation whitespace-nowrap"
                      title="Editar metadados do dossiê"
                    >
                      <Edit3 size={13} />
                      <span>Editar</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmDeleteModalOpen(true)}
                      className="min-w-[40px] min-h-[40px] px-2.5 bg-[#1a0909] hover:bg-[#2e0c0c] text-[#ff6666] border border-[#d30000]/40 text-xs font-mono uppercase flex items-center justify-center cursor-pointer touch-manipulation"
                      title="Excluir dossiê"
                      aria-label="Excluir dossiê"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>

                {/* TACTICAL PROGRESS METRICS + QUICK INVESTIGATIVE DICE BAR */}
                <div className="pt-3.5 flex flex-col gap-2.5">
                  {/* Metrics strip */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                    <div className="bg-[#12121a] border border-[#22222e] p-2.5">
                      <div className="text-[10px] font-mono uppercase text-[#7c7c8e]">
                        Solubilidade
                      </div>
                      <div className="flex items-baseline justify-between gap-2 mt-0.5">
                        <span className="text-base font-black font-mono tabular-nums text-white whitespace-nowrap">
                          {caseMetrics.solvabilityPercent}%
                        </span>
                        <span className="text-[10px] font-mono text-[#ff4d4d] font-bold whitespace-nowrap">
                          {caseMetrics.rankCode}
                        </span>
                      </div>
                    </div>

                    <div className="bg-[#12121a] border border-[#22222e] p-2.5">
                      <div className="text-[10px] font-mono uppercase text-[#7c7c8e]">
                        Evidências
                      </div>
                      <div className="flex items-baseline justify-between gap-2 mt-0.5">
                        <span className="text-base font-black font-mono tabular-nums text-emerald-400 whitespace-nowrap">
                          {caseMetrics.confirmedClues}/{caseMetrics.activeClues}
                        </span>
                        <span className="text-[10px] font-mono text-[#888898] whitespace-nowrap">
                          {caseMetrics.falseClues > 0 ? `${caseMetrics.falseClues} falsa(s)` : 'Ativas'}
                        </span>
                      </div>
                    </div>

                    <div className="bg-[#12121a] border border-[#22222e] p-2.5">
                      <div className="text-[10px] font-mono uppercase text-[#7c7c8e]">
                        Vínculos & Alvos
                      </div>
                      <div className="flex items-baseline justify-between gap-2 mt-0.5">
                        <span className="text-base font-black font-mono tabular-nums text-amber-300 whitespace-nowrap">
                          {caseMetrics.connectionsCount} fios
                        </span>
                        <span className="text-[10px] font-mono text-[#888898] whitespace-nowrap">
                          {activeCase.suspects.length} pessoa(s)
                        </span>
                      </div>
                    </div>

                    <div className="bg-[#12121a] border border-[#22222e] p-2.5">
                      <div className="text-[10px] font-mono uppercase text-[#7c7c8e]">
                        Ressonância
                      </div>
                      <div className="flex items-baseline justify-between gap-2 mt-0.5">
                        <span
                          className={`text-sm font-black font-mono uppercase whitespace-nowrap ${
                            AFFILIATION_META[caseMetrics.topElement].color
                          }`}
                        >
                          {AFFILIATION_META[caseMetrics.topElement].shortLabel}
                        </span>
                        <span className="text-[10px] font-mono tabular-nums text-[#888898] whitespace-nowrap">
                          {caseMetrics.topConfidence}% conf.
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Quick Investigative Dice Rollers */}
                  <div className="bg-[#12121a] border border-[#22222e] p-2 flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5 px-1.5 text-[10px] font-mono uppercase tracking-wider text-[#9a9aa8]">
                      <Dices size={14} className="text-[#ff4d4d]" />
                      <span>Testes Rápidos de Campo:</span>
                    </div>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {(['Investigação', 'Percepção', 'Ocultismo', 'Intuição'] as const).map(
                        (skill) => (
                          <button
                            key={skill}
                            type="button"
                            onClick={() => handleInvestigativeRoll(skill)}
                            className="min-h-[34px] px-3 py-1 bg-[#181822] hover:bg-[#25161a] hover:border-[#d30000] text-[#dcdce6] hover:text-white border border-[#2c2c3a] text-[11px] font-mono uppercase tracking-wider transition-colors cursor-pointer whitespace-nowrap"
                            title={`Rolar teste rápido de ${skill}`}
                          >
                            {skill}
                          </button>
                        )
                      )}
                    </div>
                  </div>
                </div>

                {/* Inline Result Banner when Quick Investigative Roll is triggered */}
                {quickRollBanner && (
                  <div className="mt-3 p-2.5 bg-[#181218] border border-[#d30000]/60 flex items-center justify-between gap-3 font-mono text-xs">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Dices size={15} className="text-[#ff4d4d]" />
                      <span className="uppercase font-bold text-white">
                        Teste de {quickRollBanner.skill}:
                      </span>
                      <span className="text-[#b0b0c0]">
                        Dado d20 = <strong className="text-white">{quickRollBanner.d20}</strong>
                      </span>
                      <span>→</span>
                      <span
                        className={`font-black text-sm px-2 py-0.5 border ${
                          quickRollBanner.crit
                            ? 'bg-emerald-950/60 text-emerald-300 border-emerald-500'
                            : quickRollBanner.fumble
                              ? 'bg-red-950/60 text-red-300 border-red-500'
                              : 'bg-[#222230] text-amber-300 border-amber-500/40'
                        }`}
                      >
                        TOTAL {quickRollBanner.total}
                        {quickRollBanner.crit ? ' (CRÍTICO!)' : quickRollBanner.fumble ? ' (FALHA CRÍTICA)' : ''}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setQuickRollBanner(null)}
                      className="text-[#888898] hover:text-white p-1 cursor-pointer"
                      aria-label="Fechar resultado de rolagem"
                    >
                      <X size={14} />
                    </button>
                  </div>
                )}
              </div>

              {/* 5 WORKSPACE NAVIGATION TABS */}
              <nav
                aria-label="Seções da Investigação"
                className="bg-[#0d0d12] border border-[#24242e] p-1 grid grid-cols-2 sm:grid-cols-5 gap-1"
              >
                {workspaceTabs.map((tab) => {
                  const Icon = tab.icon;
                  const active = workspaceTab === tab.id;
                  return (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => setWorkspaceTab(tab.id)}
                      className={`min-h-[44px] px-3 py-2 flex items-center justify-center gap-2 text-xs font-mono uppercase tracking-wider transition-all cursor-pointer touch-manipulation whitespace-nowrap border ${
                        active
                          ? 'bg-[#250808] text-white border-[#d30000] font-bold shadow-[inset_0_-2px_0_#d30000]'
                          : 'bg-[#121218] text-[#8e8e9e] border-transparent hover:text-white hover:bg-[#181822]'
                      }`}
                    >
                      <Icon
                        size={15}
                        className={active ? 'text-[#ff4d4d] shrink-0' : 'text-[#767686] shrink-0'}
                      />
                      <span className="hidden 2xl:inline">{tab.label}</span>
                      <span className="2xl:hidden">{tab.shortLabel}</span>
                      {typeof tab.count === 'number' && tab.count > 0 && (
                        <span
                          className={`text-[10px] px-1.5 py-0.2 tabular-nums ${
                            active ? 'bg-[#d30000] text-white' : 'bg-[#1e1e2a] text-[#9a9aa8]'
                          }`}
                        >
                          {tab.count}
                        </span>
                      )}
                    </button>
                  );
                })}
              </nav>

              {/* ===================================================================
                  TAB 1: DOSSIÊ & RELATÓRIO DE CAMPO
              =================================================================== */}
              {workspaceTab === 'dossie' && (
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
                  {/* Left 7 cols: Field Report Editor + Quick Templates */}
                  <div className="lg:col-span-7 bg-[#0d0d12] border border-[#24242e] p-4 sm:p-5 space-y-4">
                    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#1e1e28] pb-3">
                      <div className="flex items-center gap-2">
                        <span className="w-[3px] h-4 bg-[#d30000]" />
                        <h3 className="text-xs sm:text-sm font-mono font-bold uppercase tracking-widest text-white">
                          Relatório Operacional de Campo
                        </h3>
                      </div>
                      <span className="text-[10px] font-mono text-[#7c7c8c] uppercase">
                        Salvo Automaticamente
                      </span>
                    </div>

                    {/* Briefing Summary Box */}
                    {activeCase.desc && (
                      <div className="bg-[#dcd6cc] text-[#111115] p-3.5 border-l-4 border-l-[#d30000] shadow-sm">
                        <div className="text-[10px] font-mono font-bold uppercase tracking-widest text-[#7a1c1c] mb-1">
                          Resumo da Ocorrência (Briefing)
                        </div>
                        <p className="text-xs sm:text-sm leading-relaxed font-medium">
                          {activeCase.desc}
                        </p>
                      </div>
                    )}

                    {/* Template Insertion Buttons */}
                    <div className="space-y-1.5">
                      <div className="text-[10px] font-mono uppercase tracking-wider text-[#888898]">
                        Inserir Modelo Tático no Relatório:
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {FIELD_NOTE_TEMPLATES.map((tpl) => (
                          <button
                            key={tpl.id}
                            type="button"
                            onClick={() => {
                              updateActiveCase((c) => ({
                                ...c,
                                notes: (c.notes ? c.notes.trimEnd() + '\n' : '') + tpl.snippet,
                              }));
                              showToast(`Modelo "${tpl.label}" inserido`);
                            }}
                            className="min-h-[36px] px-2.5 py-1 bg-[#15151f] hover:bg-[#20202e] text-[#c8c8d8] hover:text-white border border-[#2a2a38] text-[11px] font-mono uppercase tracking-wider transition-colors cursor-pointer whitespace-nowrap"
                          >
                            {tpl.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Field Notes Textarea */}
                    <textarea
                      value={activeCase.notes}
                      onChange={(e) =>
                        updateActiveCase((c) => ({ ...c, notes: e.target.value }))
                      }
                      placeholder="Registre observações da cena do crime, depoimentos colhidos, leituras de membrana, códigos encontrados e diretrizes da equipe..."
                      rows={13}
                      className="w-full bg-[#111118] border border-[#262634] focus:border-[#d30000] p-3.5 text-xs sm:text-sm text-[#e4e4ef] placeholder-[#5e5e70] font-mono leading-relaxed outline-none resize-y"
                    />
                  </div>

                  {/* Right 5 cols: Hypotheses & Theories + Case Overview */}
                  <div className="lg:col-span-5 space-y-4">
                    <div className="bg-[#0d0d12] border border-[#24242e] p-4 sm:p-5 space-y-4">
                      <div className="flex items-center justify-between border-b border-[#1e1e28] pb-3">
                        <div className="flex items-center gap-2">
                          <span className="w-[3px] h-4 bg-amber-400" />
                          <h3 className="text-xs sm:text-sm font-mono font-bold uppercase tracking-widest text-white">
                            Hipóteses & Linhas de Investigação
                          </h3>
                        </div>
                        <span className="text-[11px] font-mono tabular-nums text-[#8e8e9e]">
                          {activeCase.theories.length}
                        </span>
                      </div>

                      <form onSubmit={handleAddTheory} className="flex gap-2">
                        <input
                          type="text"
                          value={newTheoryText}
                          onChange={(e) => setNewTheoryText(e.target.value)}
                          placeholder="Formular nova teoria ou suspeita..."
                          className="flex-1 min-h-[42px] bg-[#13131b] border border-[#282836] focus:border-[#d30000] px-3 text-xs text-white placeholder-[#666676] outline-none font-mono"
                        />
                        <button
                          type="submit"
                          className="min-h-[42px] px-3.5 bg-[#b80000] hover:bg-[#d30000] text-white text-xs font-mono font-bold uppercase tracking-wider cursor-pointer whitespace-nowrap"
                        >
                          + Teoria
                        </button>
                      </form>

                      <div className="space-y-2.5 max-h-[380px] overflow-y-auto pr-1">
                        {activeCase.theories.length === 0 ? (
                          <div className="p-4 bg-[#121219] border border-dashed border-[#262634] text-center text-xs font-mono text-[#787888]">
                            Nenhuma hipótese formulada ainda. Registre as teorias do grupo e marque se foram comprovadas ou refutadas!
                          </div>
                        ) : (
                          activeCase.theories.map((th) => {
                            const statusStyle =
                              th.status === 'comprovada'
                                ? 'bg-emerald-950/40 text-emerald-300 border-emerald-500/50'
                                : th.status === 'refutada'
                                  ? 'bg-red-950/40 text-red-300 border-red-500/50'
                                  : 'bg-amber-950/40 text-amber-300 border-amber-500/50';
                            return (
                              <div
                                key={th.id}
                                className="p-3 bg-[#13131b] border border-[#252532] flex items-start justify-between gap-2.5"
                              >
                                <div className="space-y-1.5 min-w-0 flex-1">
                                  <button
                                    type="button"
                                    onClick={() => handleCycleTheoryStatus(th.id)}
                                    className={`px-2 py-0.5 text-[10px] font-mono font-bold uppercase border cursor-pointer ${statusStyle}`}
                                    title="Clique para alternar: Aberta / Comprovada / Refutada"
                                  >
                                    {th.status === 'comprovada'
                                      ? '✓ TEORIA COMPROVADA'
                                      : th.status === 'refutada'
                                        ? '✕ TEORIA REFUTADA'
                                        : '? HIPÓTESE EM ABERTO'}
                                  </button>
                                  <p
                                    className={`text-xs leading-relaxed ${
                                      th.status === 'refutada'
                                        ? 'line-through text-[#707080]'
                                        : 'text-[#e4e4ec]'
                                    }`}
                                  >
                                    {th.statement}
                                  </p>
                                </div>
                                <button
                                  type="button"
                                  onClick={() => handleDeleteTheory(th.id)}
                                  className="text-[#6e6e7e] hover:text-red-400 p-1 cursor-pointer shrink-0"
                                  title="Remover hipótese"
                                >
                                  <X size={14} />
                                </button>
                              </div>
                            );
                          })
                        )}
                      </div>
                    </div>

                    {/* Paranormal Signature Reference Card */}
                    <div className="bg-[#0d0d12] border border-[#24242e] p-4 space-y-2">
                      <div className="text-[10px] font-mono uppercase tracking-widest text-[#888898]">
                        Assinatura da Afiliação Catalogada ({AFFILIATION_META[activeCase.aff].label})
                      </div>
                      <p className="text-xs font-mono text-[#c8c8d6] leading-relaxed">
                        {AFFILIATION_META[activeCase.aff].signature}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* ===================================================================
                  TAB 2: PISTAS & EVIDÊNCIAS (LABORATÓRIO DE PROVAS)
              =================================================================== */}
              {workspaceTab === 'pistas' && (
                <div className="bg-[#0d0d12] border border-[#24242e] p-4 sm:p-5 space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#1e1e28] pb-3">
                    <div className="flex items-center gap-2">
                      <span className="w-[3px] h-4 bg-[#d30000]" />
                      <h3 className="text-xs sm:text-sm font-mono font-bold uppercase tracking-widest text-white">
                        Banco de Evidências & Provas Forenses
                      </h3>
                    </div>
                    <span className="text-xs font-mono tabular-nums text-[#9a9aa8]">
                      {caseMetrics.confirmedClues} confirmadas de {caseMetrics.activeClues} válidas
                    </span>
                  </div>

                  {/* New Clue Creation Bar */}
                  <div className="bg-[#12121a] border border-[#252532] p-3.5 space-y-3">
                    <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5">
                      <div className="sm:col-span-3">
                        <label className="block text-[10px] font-mono uppercase text-[#888898] mb-1">
                          Categoria da Pista
                        </label>
                        <select
                          value={newClueType}
                          onChange={(e) => setNewClueType(e.target.value as ClueType)}
                          className="w-full min-h-[42px] bg-[#0e0e14] border border-[#2a2a38] px-2.5 text-xs font-mono text-white outline-none"
                        >
                          {(Object.keys(CLUE_TYPE_META) as ClueType[]).map((tKey) => (
                            <option key={tKey} value={tKey}>
                              [{CLUE_TYPE_META[tKey].code}] {CLUE_TYPE_META[tKey].label}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="sm:col-span-3">
                        <label className="block text-[10px] font-mono uppercase text-[#888898] mb-1">
                          Localização / Origem
                        </label>
                        <input
                          type="text"
                          value={newClueLoc}
                          onChange={(e) => setNewClueLoc(e.target.value)}
                          placeholder="Ex: Sala de Máquinas"
                          className="w-full min-h-[42px] bg-[#0e0e14] border border-[#2a2a38] focus:border-[#d30000] px-3 text-xs font-mono text-white placeholder-[#606070] outline-none"
                        />
                      </div>

                      <div className="sm:col-span-6">
                        <label className="block text-[10px] font-mono uppercase text-[#888898] mb-1">
                          Descrição da Evidência
                        </label>
                        <div className="flex gap-2">
                          <input
                            type="text"
                            value={newClueText}
                            onChange={(e) => setNewClueText(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleAddClue()}
                            placeholder="Descreva a pista encontrada..."
                            className="flex-1 min-h-[42px] bg-[#0e0e14] border border-[#2a2a38] focus:border-[#d30000] px-3 text-xs font-mono text-white placeholder-[#606070] outline-none"
                          />
                          <button
                            type="button"
                            onClick={handleAddClue}
                            className="min-h-[42px] px-4 bg-[#b80000] hover:bg-[#d30000] text-white text-xs font-mono font-bold uppercase tracking-wider cursor-pointer whitespace-nowrap"
                          >
                            + Catalogar
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Clue Filter Strip */}
                  <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
                    <Filter size={13} className="text-[#787888] shrink-0 mr-1" />
                    {[
                      { id: 'all', label: `Todas (${activeCase.clues.length})` },
                      { id: 'confirmada', label: 'Confirmadas' },
                      { id: 'suspeita', label: 'Em Análise' },
                      { id: 'falsa', label: 'Pistas Falsas' },
                      { id: 'fisica', label: 'Físicas' },
                      { id: 'forense', label: 'Forenses' },
                      { id: 'testemunho', label: 'Depoimentos' },
                      { id: 'oculta', label: 'Ocultas' },
                    ].map((f) => (
                      <button
                        key={f.id}
                        type="button"
                        onClick={() => setClueFilter(f.id as any)}
                        className={`min-h-[34px] px-2.5 py-1 text-[10px] font-mono uppercase tracking-wider border cursor-pointer whitespace-nowrap ${
                          clueFilter === f.id
                            ? 'bg-[#2a0808] text-white border-[#d30000] font-bold'
                            : 'bg-[#13131b] text-[#8e8e9e] border-[#242430] hover:text-white'
                        }`}
                      >
                        {f.label}
                      </button>
                    ))}
                  </div>

                  {/* Clues Grid */}
                  {displayedClues.length === 0 ? (
                    <div className="p-8 bg-[#121219] border border-dashed border-[#262634] text-center text-xs font-mono text-[#7c7c8e]">
                      Nenhuma evidência catalogada nesta categoria.
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {displayedClues.map((clue, idx) => {
                        const typeMeta = CLUE_TYPE_META[clue.type] || CLUE_TYPE_META.fisica;
                        const relMeta =
                          CLUE_RELIABILITY_META[clue.rel] || CLUE_RELIABILITY_META.suspeita;
                        const isExpanded = expandedClueId === clue.id;

                        return (
                          <div
                            key={clue.id}
                            className={`border p-3.5 transition-colors flex flex-col justify-between gap-2.5 ${
                              clue.rel === 'falsa'
                                ? 'bg-[#101015]/60 border-[#22222a] opacity-70'
                                : clue.ok
                                  ? 'bg-[#101915] border-emerald-500/40'
                                  : 'bg-[#13131b] border-[#262634]'
                            }`}
                          >
                            <div className="space-y-2">
                              {/* Top bar: Code + Category + Reliability selector + Delete */}
                              <div className="flex items-center justify-between gap-2">
                                <div className="flex items-center gap-1.5 min-w-0">
                                  <span className="text-[10px] font-mono font-bold text-[#888898]">
                                    #{String(idx + 1).padStart(2, '0')}
                                  </span>
                                  <span
                                    className={`text-[10px] font-mono uppercase px-1.5 py-0.5 border ${typeMeta.bg} ${typeMeta.color} ${typeMeta.border}`}
                                  >
                                    {typeMeta.label}
                                  </span>
                                </div>

                                <div className="flex items-center gap-1.5 shrink-0">
                                  <select
                                    value={clue.rel}
                                    onChange={(e) =>
                                      handleChangeClueReliability(
                                        clue.id,
                                        e.target.value as ClueReliability
                                      )
                                    }
                                    aria-label="Confiabilidade da pista"
                                    className={`bg-[#0d0d12] border px-2 py-0.5 text-[10px] font-mono uppercase outline-none cursor-pointer ${relMeta.color} ${relMeta.border}`}
                                  >
                                    <option value="confirmada">✓ Confirmada</option>
                                    <option value="suspeita">? Em Análise</option>
                                    <option value="falsa">✕ Pista Falsa</option>
                                  </select>

                                  <button
                                    type="button"
                                    onClick={() => handleDeleteClue(clue.id)}
                                    className="text-[#6e6e7e] hover:text-red-400 p-1 cursor-pointer"
                                    title="Excluir pista"
                                  >
                                    <Trash2 size={13} />
                                  </button>
                                </div>
                              </div>

                              {/* Clue Title + Check button */}
                              <div className="flex items-start gap-2.5 pt-1">
                                <button
                                  type="button"
                                  onClick={() => handleToggleClueOk(clue.id)}
                                  className={`mt-0.5 w-5 h-5 flex items-center justify-center border shrink-0 cursor-pointer transition-colors ${
                                    clue.ok
                                      ? 'bg-emerald-500 border-emerald-400 text-black'
                                      : 'bg-[#0d0d12] border-[#383848] hover:border-white'
                                  }`}
                                  title="Marcar evidência como verificada"
                                >
                                  {clue.ok && <Check size={13} strokeWidth={3} />}
                                </button>

                                <p
                                  className={`text-xs sm:text-sm font-medium leading-snug flex-1 ${
                                    clue.rel === 'falsa'
                                      ? 'line-through text-[#787888]'
                                      : clue.ok
                                        ? 'text-emerald-100'
                                        : 'text-white'
                                  }`}
                                >
                                  {clue.t}
                                </p>
                              </div>
                            </div>

                            {/* Footer metadata + Expandable Technical Notes */}
                            <div className="pt-2 border-t border-[#1e1e28] space-y-2">
                              <div className="flex items-center justify-between text-[11px] font-mono text-[#888898]">
                                <span className="truncate">
                                  {clue.loc ? `LOCAL: ${clue.loc}` : 'LOCAL N/D'}
                                  {clue.foundBy ? ` · POR: ${clue.foundBy}` : ''}
                                </span>
                                <button
                                  type="button"
                                  onClick={() =>
                                    setExpandedClueId(isExpanded ? null : clue.id)
                                  }
                                  className="text-[#b0b0c2] hover:text-white flex items-center gap-1 cursor-pointer shrink-0 whitespace-nowrap"
                                >
                                  <span>{clue.notes ? 'Ver Laudo' : '+ Nota Pericial'}</span>
                                  {isExpanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                                </button>
                              </div>

                              {(isExpanded || clue.notes) && (
                                <div className={isExpanded ? 'block' : 'hidden sm:block'}>
                                  {isExpanded ? (
                                    <textarea
                                      value={clue.notes || ''}
                                      onChange={(e) =>
                                        handleUpdateClueNotes(clue.id, e.target.value)
                                      }
                                      placeholder="Anotações periciais, números de série, digitais ou observações ocultas..."
                                      rows={2}
                                      className="w-full bg-[#0b0b10] border border-[#2a2a38] focus:border-[#d30000] p-2 text-xs font-mono text-[#d8d8e6] outline-none"
                                    />
                                  ) : (
                                    <p className="text-[11px] font-mono text-[#a4a4b6] bg-[#0e0e14] p-2 border-l-2 border-l-[#444456]">
                                      {clue.notes}
                                    </p>
                                  )}
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* ===================================================================
                  TAB 3: QUADRO DE CONEXÕES (DETECTIVE MINDBOARD / RED-STRING LINKER)
              =================================================================== */}
              {workspaceTab === 'quadro' && (
                <div className="space-y-4">
                  {/* Connection Builder Form */}
                  <div className="bg-[#0d0d12] border border-[#24242e] p-4 sm:p-5 space-y-4">
                    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#1e1e28] pb-3">
                      <div className="flex items-center gap-2">
                        <span className="w-[3px] h-4 bg-[#d30000]" />
                        <h3 className="text-xs sm:text-sm font-mono font-bold uppercase tracking-widest text-white">
                          Teia de Investigação & Vínculos (Mindboard)
                        </h3>
                      </div>
                      <span className="text-[11px] font-mono text-[#8e8e9e]">
                        Conecte pistas e suspeitos para visualizar contradições e padrões
                      </span>
                    </div>

                    <form
                      onSubmit={handleAddConnection}
                      className="bg-[#12121a] border border-[#252532] p-3.5 grid grid-cols-1 sm:grid-cols-12 gap-2.5 items-end"
                    >
                      <div className="sm:col-span-3">
                        <label className="block text-[10px] font-mono uppercase text-[#888898] mb-1">
                          Ponto de Origem (A)
                        </label>
                        <select
                          value={connFromId}
                          onChange={(e) => setConnFromId(e.target.value)}
                          className="w-full min-h-[42px] bg-[#0e0e14] border border-[#2a2a38] px-2.5 text-xs font-mono text-white outline-none"
                        >
                          <option value="">Selecionar elemento...</option>
                          {activeCase.suspects.length > 0 && (
                            <optgroup label="Pessoas de Interesse">
                              {activeCase.suspects.map((s) => (
                                <option key={s.id} value={s.id}>
                                  [PESSOA] {s.name}
                                </option>
                              ))}
                            </optgroup>
                          )}
                          {activeCase.clues.length > 0 && (
                            <optgroup label="Pistas & Evidências">
                              {activeCase.clues.map((cl, i) => (
                                <option key={cl.id} value={cl.id}>
                                  [PISTA #{i + 1}] {cl.t.slice(0, 45)}
                                </option>
                              ))}
                            </optgroup>
                          )}
                        </select>
                      </div>

                      <div className="sm:col-span-3">
                        <label className="block text-[10px] font-mono uppercase text-[#888898] mb-1">
                          Ponto de Destino (B)
                        </label>
                        <select
                          value={connToId}
                          onChange={(e) => setConnToId(e.target.value)}
                          className="w-full min-h-[42px] bg-[#0e0e14] border border-[#2a2a38] px-2.5 text-xs font-mono text-white outline-none"
                        >
                          <option value="">Selecionar elemento...</option>
                          {activeCase.suspects.length > 0 && (
                            <optgroup label="Pessoas de Interesse">
                              {activeCase.suspects.map((s) => (
                                <option key={s.id} value={s.id}>
                                  [PESSOA] {s.name}
                                </option>
                              ))}
                            </optgroup>
                          )}
                          {activeCase.clues.length > 0 && (
                            <optgroup label="Pistas & Evidências">
                              {activeCase.clues.map((cl, i) => (
                                <option key={cl.id} value={cl.id}>
                                  [PISTA #{i + 1}] {cl.t.slice(0, 45)}
                                </option>
                              ))}
                            </optgroup>
                          )}
                        </select>
                      </div>

                      <div className="sm:col-span-3">
                        <label className="block text-[10px] font-mono uppercase text-[#888898] mb-1">
                          Motivo da Conexão / Hipótese
                        </label>
                        <input
                          type="text"
                          value={connLabel}
                          onChange={(e) => setConnLabel(e.target.value)}
                          placeholder="Ex: Impressões digitais no local"
                          className="w-full min-h-[42px] bg-[#0e0e14] border border-[#2a2a38] focus:border-[#d30000] px-3 text-xs font-mono text-white placeholder-[#606070] outline-none"
                        />
                      </div>

                      <div className="sm:col-span-3 flex gap-1.5">
                        <select
                          value={connColor}
                          onChange={(e) => setConnColor(e.target.value as any)}
                          aria-label="Cor do fio"
                          className="min-h-[42px] bg-[#0e0e14] border border-[#2a2a38] px-2 text-xs font-mono text-white outline-none"
                        >
                          <option value="red">Fio Vermelho</option>
                          <option value="amber">Fio Âmbar</option>
                          <option value="emerald">Fio Verde</option>
                          <option value="cyan">Fio Azul</option>
                        </select>
                        <button
                          type="submit"
                          className="flex-1 min-h-[42px] px-3 bg-[#b80000] hover:bg-[#d30000] text-white text-xs font-mono font-bold uppercase tracking-wider cursor-pointer whitespace-nowrap"
                        >
                          Vincular
                        </button>
                      </div>
                    </form>

                    {/* Interactive SVG Detective Board */}
                    <div className="bg-[#09090d] border border-[#22222e] relative overflow-x-auto">
                      <div className="min-w-[780px] h-[350px] relative">
                        <svg
                          viewBox="0 0 880 350"
                          className="w-full h-full block"
                          style={{
                            backgroundImage:
                              'radial-gradient(rgba(255,255,255,0.06) 1px, transparent 1px)',
                            backgroundSize: '22px 22px',
                          }}
                        >
                          {/* 1. Draw Red-String Lines between Linked Nodes */}
                          {activeCase.connections.map((conn) => {
                            const n1 = boardNodes.find((n) => n.id === conn.fromId);
                            const n2 = boardNodes.find((n) => n.id === conn.toId);
                            if (!n1 || !n2) return null;
                            const cStyle = THREAD_COLORS[conn.color || 'red'];
                            const isHighlighted =
                              !selectedBoardNodeId ||
                              selectedBoardNodeId === n1.id ||
                              selectedBoardNodeId === n2.id;

                            return (
                              <line
                                key={`line_${conn.id}`}
                                x1={n1.x}
                                y1={n1.y}
                                x2={n2.x}
                                y2={n2.y}
                                stroke={cStyle.stroke}
                                strokeWidth={2.5}
                                strokeDasharray="6 3"
                                opacity={isHighlighted ? 0.9 : 0.25}
                              />
                            );
                          })}

                          {/* 2. Draw Nodes (Suspects & Clues) */}
                          {boardNodes.map((node) => {
                            const isSelected = selectedBoardNodeId === node.id;
                            return (
                              <g
                                key={node.id}
                                transform={`translate(${node.x}, ${node.y})`}
                                onClick={() =>
                                  setSelectedBoardNodeId(isSelected ? null : node.id)
                                }
                                className="cursor-pointer"
                              >
                                {/* Pin Card */}
                                <rect
                                  x={-78}
                                  y={-28}
                                  width={156}
                                  height={56}
                                  fill={node.kind === 'suspect' ? '#1c1215' : '#12151e'}
                                  stroke={isSelected ? '#ffffff' : node.accentHex}
                                  strokeWidth={isSelected ? 2 : 1.2}
                                />
                                {/* Pin Thumbtack */}
                                <circle cx={0} cy={-28} r={4.5} fill={node.accentHex} />
                                <text
                                  x={0}
                                  y={-11}
                                  textAnchor="middle"
                                  fill={node.accentHex}
                                  fontSize="9"
                                  fontWeight="bold"
                                  fontFamily="monospace"
                                >
                                  {node.code}
                                </text>
                                <text
                                  x={0}
                                  y={5}
                                  textAnchor="middle"
                                  fill="#ffffff"
                                  fontSize="10.5"
                                  fontWeight="bold"
                                  fontFamily="sans-serif"
                                >
                                  {node.title.length > 21
                                    ? node.title.slice(0, 19) + '…'
                                    : node.title}
                                </text>
                                <text
                                  x={0}
                                  y={19}
                                  textAnchor="middle"
                                  fill="#9898a8"
                                  fontSize="8.5"
                                  fontFamily="monospace"
                                >
                                  {node.subtitle.length > 24
                                    ? node.subtitle.slice(0, 22) + '…'
                                    : node.subtitle}
                                </text>
                              </g>
                            );
                          })}

                          {/* 3. Draw Connection Hypothesis Labels on Top */}
                          {activeCase.connections.map((conn) => {
                            const n1 = boardNodes.find((n) => n.id === conn.fromId);
                            const n2 = boardNodes.find((n) => n.id === conn.toId);
                            if (!n1 || !n2) return null;
                            const cStyle = THREAD_COLORS[conn.color || 'red'];
                            const isSameRow = Math.abs(n1.y - n2.y) < 50;
                            const midX = (n1.x + n2.x) / 2;
                            const midY = isSameRow ? Math.max(n1.y, n2.y) + 42 : (n1.y + n2.y) / 2;
                            const isHighlighted =
                              !selectedBoardNodeId ||
                              selectedBoardNodeId === n1.id ||
                              selectedBoardNodeId === n2.id;

                            return (
                              <g
                                key={`lbl_${conn.id}`}
                                opacity={isHighlighted ? 1 : 0.25}
                              >
                                <rect
                                  x={midX - 78}
                                  y={midY - 10}
                                  width={156}
                                  height={20}
                                  fill="#0b0b10"
                                  stroke={cStyle.stroke}
                                  strokeWidth={1}
                                />
                                <text
                                  x={midX}
                                  y={midY + 3}
                                  textAnchor="middle"
                                  fill="#f1f1f8"
                                  fontSize="9"
                                  fontFamily="monospace"
                                >
                                  {conn.label.length > 23
                                    ? conn.label.slice(0, 21) + '…'
                                    : conn.label}
                                </text>
                              </g>
                            );
                          })}
                        </svg>
                      </div>
                    </div>

                    {/* Active Connections List */}
                    <div className="space-y-2">
                      <div className="text-[11px] font-mono uppercase tracking-wider text-[#9a9aa8]">
                        Fios Conectados ({activeCase.connections.length})
                      </div>
                      {activeCase.connections.length === 0 ? (
                        <div className="p-4 bg-[#121219] border border-dashed border-[#262634] text-center text-xs font-mono text-[#787888]">
                          Nenhum fio conectado. Use o seletor acima para ligar uma Pista a um Suspeito ou conectar duas Evidências!
                        </div>
                      ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                          {activeCase.connections.map((conn) => {
                            const fromNode = resolveNodeLabel(activeCase, conn.fromId);
                            const toNode = resolveNodeLabel(activeCase, conn.toId);
                            const cStyle = THREAD_COLORS[conn.color || 'red'];

                            return (
                              <div
                                key={conn.id}
                                className={`p-3 border ${cStyle.bg} ${cStyle.border} flex items-center justify-between gap-2`}
                              >
                                <div className="space-y-1 min-w-0 flex-1">
                                  <div className="flex items-center gap-1.5 text-[10px] font-mono uppercase">
                                    <Link2 size={12} className={cStyle.text} />
                                    <span className={`font-bold ${cStyle.text}`}>
                                      {conn.label}
                                    </span>
                                  </div>
                                  <div className="text-xs font-mono text-white truncate">
                                    <span className="text-[#a0a0b0]">
                                      [{fromNode?.badge || 'N/A'}]
                                    </span>{' '}
                                    {fromNode?.label || 'Removido'}{' '}
                                    <span className={cStyle.text}>⟷</span>{' '}
                                    <span className="text-[#a0a0b0]">
                                      [{toNode?.badge || 'N/A'}]
                                    </span>{' '}
                                    {toNode?.label || 'Removido'}
                                  </div>
                                </div>
                                <button
                                  type="button"
                                  onClick={() => handleDeleteConnection(conn.id)}
                                  className="text-[#787888] hover:text-red-400 p-1.5 cursor-pointer shrink-0"
                                  title="Cortar vínculo"
                                >
                                  <Trash2 size={14} />
                                </button>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* ===================================================================
                  TAB 4: PESSOAS DE INTERESSE (SUSPEITOS, TESTEMUNHAS, VÍTIMAS)
              =================================================================== */}
              {workspaceTab === 'suspeitos' && (
                <div className="bg-[#0d0d12] border border-[#24242e] p-4 sm:p-5 space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#1e1e28] pb-3">
                    <div className="flex items-center gap-2">
                      <span className="w-[3px] h-4 bg-[#d30000]" />
                      <h3 className="text-xs sm:text-sm font-mono font-bold uppercase tracking-widest text-white">
                        Dossiê de Pessoas de Interesse (NPCs & Alvos)
                      </h3>
                    </div>
                    <span className="text-xs font-mono text-[#9a9aa8]">
                      {caseMetrics.highSuspicionCount} alvo(s) sob alta suspeita
                    </span>
                  </div>

                  {/* Add Suspect Form */}
                  <form
                    onSubmit={handleAddSuspect}
                    className="bg-[#12121a] border border-[#252532] p-3.5 space-y-3"
                  >
                    <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5">
                      <div className="sm:col-span-5">
                        <label className="block text-[10px] font-mono uppercase text-[#888898] mb-1">
                          Nome / Identificação
                        </label>
                        <input
                          type="text"
                          value={newSuspectName}
                          onChange={(e) => setNewSuspectName(e.target.value)}
                          placeholder="Ex: Dr. Henrique Viana (Diretor Clínico)"
                          className="w-full min-h-[42px] bg-[#0e0e14] border border-[#2a2a38] focus:border-[#d30000] px-3 text-xs font-mono text-white placeholder-[#606070] outline-none"
                        />
                      </div>

                      <div className="sm:col-span-3">
                        <label className="block text-[10px] font-mono uppercase text-[#888898] mb-1">
                          Condição no Caso
                        </label>
                        <select
                          value={newSuspectRole}
                          onChange={(e) => setNewSuspectRole(e.target.value as SuspectRole)}
                          className="w-full min-h-[42px] bg-[#0e0e14] border border-[#2a2a38] px-2.5 text-xs font-mono text-white outline-none"
                        >
                          {(Object.keys(SUSPECT_ROLE_META) as SuspectRole[]).map((rKey) => (
                            <option key={rKey} value={rKey}>
                              {SUSPECT_ROLE_META[rKey].label}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="sm:col-span-4">
                        <label className="block text-[10px] font-mono uppercase text-[#888898] mb-1">
                          Nível Inicial de Suspeita: {newSuspectSuspicion}%
                        </label>
                        <input
                          type="range"
                          min={0}
                          max={100}
                          step={5}
                          value={newSuspectSuspicion}
                          onChange={(e) => setNewSuspectSuspicion(Number(e.target.value))}
                          className="w-full accent-[#d30000] h-9 cursor-pointer"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5">
                      <div className="sm:col-span-5">
                        <input
                          type="text"
                          value={newSuspectAlibi}
                          onChange={(e) => setNewSuspectAlibi(e.target.value)}
                          placeholder="Álibi declarado ou última localização vista..."
                          className="w-full min-h-[40px] bg-[#0e0e14] border border-[#2a2a38] focus:border-[#d30000] px-3 text-xs font-mono text-white placeholder-[#606070] outline-none"
                        />
                      </div>
                      <div className="sm:col-span-5">
                        <input
                          type="text"
                          value={newSuspectMotive}
                          onChange={(e) => setNewSuspectMotive(e.target.value)}
                          placeholder="Motivação possível ou contradição detectada..."
                          className="w-full min-h-[40px] bg-[#0e0e14] border border-[#2a2a38] focus:border-[#d30000] px-3 text-xs font-mono text-white placeholder-[#606070] outline-none"
                        />
                      </div>
                      <div className="sm:col-span-2">
                        <button
                          type="submit"
                          className="w-full min-h-[40px] bg-[#b80000] hover:bg-[#d30000] text-white text-xs font-mono font-bold uppercase tracking-wider cursor-pointer whitespace-nowrap"
                        >
                          + Fichar
                        </button>
                      </div>
                    </div>
                  </form>

                  {/* Suspects Grid */}
                  {activeCase.suspects.length === 0 ? (
                    <div className="p-8 bg-[#121219] border border-dashed border-[#262634] text-center text-xs font-mono text-[#7c7c8e]">
                      Nenhuma pessoa de interesse fichada neste caso.
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                      {activeCase.suspects.map((susp) => {
                        const rMeta = SUSPECT_ROLE_META[susp.role] || SUSPECT_ROLE_META.suspeito;
                        return (
                          <div
                            key={susp.id}
                            className="bg-[#12121a] border border-[#262634] p-4 space-y-3 flex flex-col justify-between"
                          >
                            <div className="space-y-2.5">
                              <div className="flex items-start justify-between gap-2">
                                <div>
                                  <h4 className="text-sm font-bold text-white leading-snug">
                                    {susp.name}
                                  </h4>
                                  <div className="flex items-center gap-2 mt-1">
                                    <select
                                      value={susp.role}
                                      onChange={(e) =>
                                        handleUpdateSuspect(susp.id, {
                                          role: e.target.value as SuspectRole,
                                        })
                                      }
                                      aria-label="Papel da pessoa"
                                      className={`px-2 py-0.5 text-[10px] font-mono uppercase border outline-none cursor-pointer ${rMeta.bg} ${rMeta.color} ${rMeta.border}`}
                                    >
                                      {(Object.keys(SUSPECT_ROLE_META) as SuspectRole[]).map(
                                        (rk) => (
                                          <option key={rk} value={rk} className="bg-[#0d0d12]">
                                            {SUSPECT_ROLE_META[rk].label}
                                          </option>
                                        )
                                      )}
                                    </select>
                                  </div>
                                </div>

                                <button
                                  type="button"
                                  onClick={() => handleDeleteSuspect(susp.id)}
                                  className="text-[#6e6e7e] hover:text-red-400 p-1 cursor-pointer"
                                  title="Remover ficha"
                                >
                                  <Trash2 size={14} />
                                </button>
                              </div>

                              {/* Suspicion Meter with -10 / +10 buttons */}
                              <div className="bg-[#0d0d12] border border-[#22222e] p-2.5 space-y-1.5">
                                <div className="flex items-center justify-between text-[10px] font-mono uppercase">
                                  <span className="text-[#888898]">Índice de Suspeita</span>
                                  <div className="flex items-center gap-1.5">
                                    <button
                                      type="button"
                                      onClick={() =>
                                        handleUpdateSuspect(susp.id, {
                                          suspicion: Math.max(0, susp.suspicion - 10),
                                        })
                                      }
                                      className="px-1.5 py-0.5 bg-[#181822] hover:bg-[#242432] text-white border border-[#2e2e3c] cursor-pointer"
                                    >
                                      -10%
                                    </button>
                                    <span
                                      className={`font-bold tabular-nums ${
                                        susp.suspicion >= 70
                                          ? 'text-[#ff4d4d]'
                                          : susp.suspicion >= 40
                                            ? 'text-amber-300'
                                            : 'text-emerald-400'
                                      }`}
                                    >
                                      {susp.suspicion}%
                                    </span>
                                    <button
                                      type="button"
                                      onClick={() =>
                                        handleUpdateSuspect(susp.id, {
                                          suspicion: Math.min(100, susp.suspicion + 10),
                                        })
                                      }
                                      className="px-1.5 py-0.5 bg-[#181822] hover:bg-[#242432] text-white border border-[#2e2e3c] cursor-pointer"
                                    >
                                      +10%
                                    </button>
                                  </div>
                                </div>
                                <div className="w-full h-1.5 bg-[#1a1a24] overflow-hidden">
                                  <div
                                    className={`h-full transition-all duration-300 ${
                                      susp.suspicion >= 70
                                        ? 'bg-[#d30000]'
                                        : susp.suspicion >= 40
                                          ? 'bg-amber-400'
                                          : 'bg-emerald-400'
                                    }`}
                                    style={{ width: `${susp.suspicion}%` }}
                                  />
                                </div>
                              </div>

                              {/* Alibi & Motive Details */}
                              <div className="space-y-1.5 text-xs font-mono">
                                <div className="bg-[#0e0e14] p-2 border-l-2 border-l-sky-500/60">
                                  <span className="text-[10px] uppercase text-sky-400 block">
                                    Álibi / Relato:
                                  </span>
                                  <span className="text-[#d4d4e0]">
                                    {susp.alibi || 'Não informado'}
                                  </span>
                                </div>
                                <div className="bg-[#0e0e14] p-2 border-l-2 border-l-amber-500/60">
                                  <span className="text-[10px] uppercase text-amber-300 block">
                                    Motivação / Contradição:
                                  </span>
                                  <span className="text-[#d4d4e0]">
                                    {susp.motive || 'Nenhuma contradição registrada'}
                                  </span>
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* ===================================================================
                  TAB 5: CRONOLOGIA & DEDUÇÃO OCULTA (TIMELINE + FORENSIC MATRIX)
              =================================================================== */}
              {workspaceTab === 'deducao' && (
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
                  {/* Left 7 cols: Paranormal / Forensic Phenomena Deduction Matrix */}
                  <div className="lg:col-span-7 bg-[#0d0d12] border border-[#24242e] p-4 sm:p-5 space-y-4">
                    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#1e1e28] pb-3">
                      <div className="flex items-center gap-2">
                        <span className="w-[3px] h-4 bg-[#d30000]" />
                        <h3 className="text-xs sm:text-sm font-mono font-bold uppercase tracking-widest text-white">
                          Matriz de Dedução Forense & Paranormal
                        </h3>
                      </div>
                      <span className="text-[11px] font-mono text-[#9a9aa8]">
                        {activeCase.phenomena.length} fenômeno(s) marcado(s)
                      </span>
                    </div>

                    <p className="text-xs text-[#9a9aa8] leading-relaxed">
                      Marque os sinais e anomalias observados durante a investigação. O sistema cruzará os vestígios para deduzir a Afiliação mais provável da entidade ou evento.
                    </p>

                    {/* Deduction Result Box */}
                    <div className="bg-[#12121a] border border-[#282836] p-3.5 space-y-2.5">
                      <div className="text-[10px] font-mono uppercase tracking-widest text-[#9a9aa8]">
                        Diagnóstico Automático da Matriz:
                      </div>
                      {phenomenaDeductions.length === 0 ? (
                        <div className="text-xs font-mono text-[#787888]">
                          Selecione pelo menos um fenômeno abaixo para calcular a ressonância elemental.
                        </div>
                      ) : (
                        <div className="space-y-2">
                          {phenomenaDeductions.slice(0, 3).map((ded, idx) => {
                            const meta = AFFILIATION_META[ded.element];
                            return (
                              <div
                                key={ded.element}
                                className="flex flex-wrap items-center justify-between gap-2 p-2.5 bg-[#0d0d12] border border-[#242430]"
                              >
                                <div className="flex items-center gap-2">
                                  <span className="text-xs font-mono font-bold text-[#7c7c8e]">
                                    #{idx + 1}
                                  </span>
                                  <span className={`text-xs font-mono font-black uppercase ${meta.color}`}>
                                    {meta.label}
                                  </span>
                                  <span className="text-[11px] font-mono tabular-nums text-white font-bold">
                                    ({ded.confidence}% compatibilidade)
                                  </span>
                                </div>

                                {activeCase.aff !== ded.element ? (
                                  <button
                                    type="button"
                                    onClick={() => handleApplyDeducedAffiliation(ded.element)}
                                    className="min-h-[30px] px-2.5 py-1 bg-[#1b1b26] hover:bg-[#2a0808] hover:border-[#d30000] text-[10px] font-mono uppercase text-white border border-[#323242] cursor-pointer whitespace-nowrap"
                                  >
                                    Definir no Caso
                                  </button>
                                ) : (
                                  <span className="text-[10px] font-mono uppercase text-emerald-400">
                                    ✓ Afiliação Atual
                                  </span>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>

                    {/* Checklist of 14 Phenomena */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      {CADERNO_PHENOMENA.map((phen) => {
                        const checked = activeCase.phenomena.includes(phen.id);
                        return (
                          <button
                            key={phen.id}
                            type="button"
                            onClick={() => handleTogglePhenomenon(phen.id)}
                            className={`text-left p-3 border transition-colors cursor-pointer flex items-start gap-2.5 ${
                              checked
                                ? 'bg-[#1f0c10] border-[#d30000] text-white'
                                : 'bg-[#12121a] border-[#242432] text-[#b4b4c4] hover:border-[#3a3a4e]'
                            }`}
                          >
                            <div
                              className={`mt-0.5 w-4 h-4 flex items-center justify-center border shrink-0 ${
                                checked
                                  ? 'bg-[#d30000] border-[#ff4d4d] text-white'
                                  : 'bg-[#0b0b10] border-[#383848]'
                              }`}
                            >
                              {checked && <Check size={11} strokeWidth={3} />}
                            </div>
                            <div className="space-y-1 min-w-0">
                              <div className="text-xs font-bold leading-snug">{phen.label}</div>
                              <p className="text-[11px] text-[#888898] leading-relaxed">
                                {phen.desc}
                              </p>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Right 5 cols: Chronological Timeline Reconstruction */}
                  <div className="lg:col-span-5 bg-[#0d0d12] border border-[#24242e] p-4 sm:p-5 space-y-4">
                    <div className="flex items-center justify-between border-b border-[#1e1e28] pb-3">
                      <div className="flex items-center gap-2">
                        <span className="w-[3px] h-4 bg-sky-400" />
                        <h3 className="text-xs sm:text-sm font-mono font-bold uppercase tracking-widest text-white">
                          Cronologia do Incidente
                        </h3>
                      </div>
                      <span className="text-[11px] font-mono tabular-nums text-[#8e8e9e]">
                        {activeCase.timeline.length} evento(s)
                      </span>
                    </div>

                    {/* Add Timeline Event Form */}
                    <form onSubmit={handleAddTimelineEvent} className="space-y-2 bg-[#12121a] border border-[#252532] p-3">
                      <div className="grid grid-cols-12 gap-2">
                        <div className="col-span-4">
                          <input
                            type="text"
                            value={newEventTime}
                            onChange={(e) => setNewEventTime(e.target.value)}
                            placeholder="Hora (23:15)"
                            className="w-full min-h-[38px] bg-[#0e0e14] border border-[#2a2a38] focus:border-[#d30000] px-2.5 text-xs font-mono text-white placeholder-[#606070] outline-none"
                          />
                        </div>
                        <div className="col-span-8">
                          <input
                            type="text"
                            value={newEventTitle}
                            onChange={(e) => setNewEventTitle(e.target.value)}
                            placeholder="O que aconteceu neste horário?"
                            className="w-full min-h-[38px] bg-[#0e0e14] border border-[#2a2a38] focus:border-[#d30000] px-2.5 text-xs font-mono text-white placeholder-[#606070] outline-none"
                          />
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={newEventDesc}
                          onChange={(e) => setNewEventDesc(e.target.value)}
                          placeholder="Detalhes ou fonte do registro..."
                          className="flex-1 min-h-[38px] bg-[#0e0e14] border border-[#2a2a38] focus:border-[#d30000] px-2.5 text-xs font-mono text-white placeholder-[#606070] outline-none"
                        />
                        <button
                          type="submit"
                          className="min-h-[38px] px-3.5 bg-[#b80000] hover:bg-[#d30000] text-white text-xs font-mono font-bold uppercase tracking-wider cursor-pointer whitespace-nowrap"
                        >
                          + Evento
                        </button>
                      </div>
                    </form>

                    {/* Vertical Timeline */}
                    {activeCase.timeline.length === 0 ? (
                      <div className="p-6 bg-[#121219] border border-dashed border-[#262634] text-center text-xs font-mono text-[#787888]">
                        Nenhum evento registrado na cronologia. Reconstrua os horários para encontrar falhas nos álibis!
                      </div>
                    ) : (
                      <div className="relative pl-4 border-l-2 border-[#2a2a38] space-y-3">
                        {activeCase.timeline.map((ev) => (
                          <div
                            key={ev.id}
                            className="bg-[#12121a] border border-[#252532] p-3 relative"
                          >
                            <span
                              className={`w-2.5 h-2.5 absolute -left-[22px] top-4 border ${
                                ev.verified
                                  ? 'bg-emerald-400 border-emerald-200'
                                  : 'bg-amber-400 border-amber-200'
                              }`}
                            />
                            <div className="flex items-center justify-between gap-2 mb-1">
                              <div className="flex items-center gap-2">
                                <span className="px-2 py-0.5 bg-[#0b0b10] border border-[#2e2e3e] text-xs font-mono font-bold tabular-nums text-amber-300">
                                  {ev.time}
                                </span>
                                <button
                                  type="button"
                                  onClick={() => handleToggleEventVerified(ev.id)}
                                  className={`text-[10px] font-mono uppercase px-1.5 py-0.5 border cursor-pointer ${
                                    ev.verified
                                      ? 'bg-emerald-950/40 text-emerald-300 border-emerald-500/40'
                                      : 'bg-amber-950/40 text-amber-300 border-amber-500/40'
                                  }`}
                                >
                                  {ev.verified ? '✓ Confirmado' : '? Relato'}
                                </button>
                              </div>
                              <button
                                type="button"
                                onClick={() => handleDeleteTimelineEvent(ev.id)}
                                className="text-[#6e6e7e] hover:text-red-400 p-1 cursor-pointer"
                              >
                                <X size={13} />
                              </button>
                            </div>
                            <div className="text-xs font-bold text-white">{ev.title}</div>
                            {ev.desc && (
                              <p className="text-[11px] font-mono text-[#9a9aa8] mt-1 leading-relaxed">
                                {ev.desc}
                              </p>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </section>
      </div>

      {/* ===================================================================
          MODAL: CREATE / EDIT CASE DOSSIER
      =================================================================== */}
      {isModalOpen && (
        <div
          className="fixed inset-0 z-[300] modal-backdrop-blur flex items-end sm:items-center justify-center p-0 sm:p-4"
          onClick={() => setIsModalOpen(false)}
        >
          <div
            className="bg-[#0e0e14] border-t sm:border border-[#2a2a38] w-full max-w-lg p-5 sm:p-6 relative shadow-[0_24px_60px_rgba(0,0,0,0.9)] animate-sheet-up"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="h-[3px] w-full bg-[#d30000] absolute top-0 left-0" />
            <div className="flex items-center justify-between border-b border-[#1e1e28] pb-3 mb-4">
              <h2 className="text-sm sm:text-base font-mono font-bold uppercase tracking-widest text-white">
                {editingCaseId ? 'Editar Dossiê de Investigação' : 'Abrir Novo Dossiê de Campo'}
              </h2>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="min-w-[40px] min-h-[40px] flex items-center justify-center text-[#888898] hover:text-white cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveCaseModal} className="space-y-3.5">
              <div>
                <label className="block text-[10px] font-mono uppercase text-[#9a9aa8] mb-1">
                  Título da Operação / Caso *
                </label>
                <input
                  type="text"
                  required
                  value={formTitle}
                  onChange={(e) => setFormTitle(e.target.value)}
                  placeholder="Ex: Caso #09 — O Sanatório de Santa Helena"
                  className="w-full min-h-[42px] bg-[#14141d] border border-[#2c2c3a] focus:border-[#d30000] px-3 text-xs font-mono text-white outline-none"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                <div>
                  <label className="block text-[10px] font-mono uppercase text-[#9a9aa8] mb-1">
                    Status
                  </label>
                  <select
                    value={formStatus}
                    onChange={(e) => setFormStatus(e.target.value as CaseStatus)}
                    className="w-full min-h-[42px] bg-[#14141d] border border-[#2c2c3a] px-2.5 text-xs font-mono text-white outline-none"
                  >
                    <option value="ativo">Em Investigação</option>
                    <option value="critico">Alerta Crítico</option>
                    <option value="arquivado">Caso Encerrado</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-mono uppercase text-[#9a9aa8] mb-1">
                    Nível de Risco
                  </label>
                  <select
                    value={formDanger}
                    onChange={(e) => setFormDanger(e.target.value as CaseDangerLevel)}
                    className="w-full min-h-[42px] bg-[#14141d] border border-[#2c2c3a] px-2.5 text-xs font-mono text-white outline-none"
                  >
                    <option value="baixo">Baixo</option>
                    <option value="medio">Moderado</option>
                    <option value="alto">Alto</option>
                    <option value="extremo">Extremo</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-mono uppercase text-[#9a9aa8] mb-1">
                    Afiliação / Elemento
                  </label>
                  <select
                    value={formAff}
                    onChange={(e) => setFormAff(e.target.value as AffiliationType)}
                    className="w-full min-h-[42px] bg-[#14141d] border border-[#2c2c3a] px-2.5 text-xs font-mono text-white outline-none"
                  >
                    {(Object.keys(AFFILIATION_META) as AffiliationType[]).map((k) => (
                      <option key={k} value={k}>
                        {AFFILIATION_META[k].label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                <div>
                  <label className="block text-[10px] font-mono uppercase text-[#9a9aa8] mb-1">
                    Local Principal
                  </label>
                  <input
                    type="text"
                    value={formLoc}
                    onChange={(e) => setFormLoc(e.target.value)}
                    placeholder="Ex: Distrito Industrial"
                    className="w-full min-h-[40px] bg-[#14141d] border border-[#2c2c3a] focus:border-[#d30000] px-2.5 text-xs font-mono text-white outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-mono uppercase text-[#9a9aa8] mb-1">
                    Investigador Líder
                  </label>
                  <input
                    type="text"
                    value={formLead}
                    onChange={(e) => setFormLead(e.target.value)}
                    placeholder="Ex: Equipe Delta"
                    className="w-full min-h-[40px] bg-[#14141d] border border-[#2c2c3a] focus:border-[#d30000] px-2.5 text-xs font-mono text-white outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-mono uppercase text-[#9a9aa8] mb-1">
                    Data / Hora
                  </label>
                  <input
                    type="text"
                    value={formDate}
                    onChange={(e) => setFormDate(e.target.value)}
                    placeholder="Ex: 14/10 · 23:00"
                    className="w-full min-h-[40px] bg-[#14141d] border border-[#2c2c3a] focus:border-[#d30000] px-2.5 text-xs font-mono text-white outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-mono uppercase text-[#9a9aa8] mb-1">
                  Resumo da Ocorrência (Briefing)
                </label>
                <textarea
                  rows={3}
                  value={formDesc}
                  onChange={(e) => setFormDesc(e.target.value)}
                  placeholder="Contexto inicial do caso, relatos da chamada ou objetivo da missão..."
                  className="w-full bg-[#14141d] border border-[#2c2c3a] focus:border-[#d30000] p-2.5 text-xs font-mono text-white outline-none"
                />
              </div>

              <div className="flex justify-end gap-2.5 pt-2 border-t border-[#1e1e28]">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="min-h-[42px] px-4 bg-[#161620] hover:bg-[#222230] text-[#c8c8d8] border border-[#2c2c3a] text-xs font-mono uppercase tracking-wider cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="min-h-[42px] px-5 bg-[#b80000] hover:bg-[#d30000] text-white text-xs font-mono font-bold uppercase tracking-wider cursor-pointer"
                >
                  Salvar Dossiê
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ===================================================================
          MODAL: CONFIRM DELETE CASE
      =================================================================== */}
      {confirmDeleteModalOpen && activeCase && (
        <div
          className="fixed inset-0 z-[310] modal-backdrop-blur flex items-center justify-center p-4"
          onClick={() => setConfirmDeleteModalOpen(false)}
        >
          <div
            className="bg-[#0e0e14] border border-[#2a2a38] max-w-sm w-full p-5 relative shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="h-[3px] w-full bg-[#d30000] absolute top-0 left-0" />
            <h3 className="text-sm font-mono font-bold uppercase tracking-wider text-white mb-2">
              Excluir Dossiê Permanentemente?
            </h3>
            <p className="text-xs font-mono text-[#9a9aa8] leading-relaxed mb-5">
              Todas as pistas, conexões e suspeitos de{' '}
              <strong className="text-white">{activeCase.title}</strong> serão apagados.
            </p>
            <div className="flex gap-2.5">
              <button
                type="button"
                onClick={() => setConfirmDeleteModalOpen(false)}
                className="flex-1 min-h-[42px] bg-[#161620] hover:bg-[#222230] text-xs font-mono uppercase text-white border border-[#2c2c3a] cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                className="flex-1 min-h-[42px] bg-[#b80000] hover:bg-[#d30000] text-xs font-mono font-bold uppercase text-white cursor-pointer"
              >
                Confirmar Exclusão
              </button>
            </div>
          </div>
        </div>
      )}

      {/* TOAST FEEDBACK */}
      {toastMessage && (
        <div
          style={{ top: "max(0.85rem, env(safe-area-inset-top, 0.85rem))" }}
          className="fixed right-3 sm:right-5 z-[350] bg-[#12121a] border border-[#d30000] px-4 py-2.5 shadow-[0_10px_30px_rgba(0,0,0,0.85)] flex items-center gap-2 text-xs font-mono text-white"
        >
          <CheckCircle2 size={15} className="text-[#ff4d4d] shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}
    </div>
  );
};
