import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  CadernoCase,
  CadernoClue,
  AffiliationType,
  CaseStatus,
  DepartmentType,
  MembraneStatus,
  CADERNO_ELEMENTS,
  CADERNO_DEPARTMENTS,
  CADERNO_MEMBRANE,
  CADERNO_STATUS,
  CADERNO_LOCAL_STORAGE_KEY,
  CADERNO_OLD_STORAGE_KEY,
  CADERNO_SUPABASE_RECORD_ID,
} from '../types/caderno';
import { supabase } from '../lib/supabase';
import {
  FileText,
  Search,
  Plus,
  Download,
  Upload,
  Trash2,
  ArrowLeft,
  X,
  Check,
  Cloud,
  CloudOff,
  FolderOpen,
  Calendar,
  MapPin,
  Tag,
  Shield,
  Activity,
  Layers,
  Menu,
} from 'lucide-react';

interface CadernoDeCampoViewProps {
  onBackToSheet?: () => void;
  onOpenSidebar?: () => void;
  userUid?: string;
  isOnline?: boolean;
}

export const CadernoDeCampoView: React.FC<CadernoDeCampoViewProps> = ({
  onBackToSheet,
  onOpenSidebar,
  userUid,
  isOnline = true,
}) => {
  const [cases, setCases] = useState<CadernoCase[]>(() => {
    try {
      const raw =
        localStorage.getItem(CADERNO_LOCAL_STORAGE_KEY) ||
        localStorage.getItem(CADERNO_OLD_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch (e) {
      console.warn('Erro ao carregar caderno do localStorage:', e);
    }
    return [];
  });

  const [activeCaseId, setActiveCaseId] = useState<string | null>(() => {
    try {
      const raw =
        localStorage.getItem(CADERNO_LOCAL_STORAGE_KEY) ||
        localStorage.getItem(CADERNO_OLD_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed[0].id;
        }
      }
    } catch {}
    return null;
  });

  const [filter, setFilter] = useState<string>('todos');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [newClueText, setNewClueText] = useState<string>('');
  const [syncStateText, setSyncStateText] = useState<string>('Salvo localmente');
  const [isSyncingWithCloud, setIsSyncingWithCloud] = useState<boolean>(false);
  const [isMobileEditing, setIsMobileEditing] = useState<boolean>(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const broadcastChannelRef = useRef<any>(null);

  // Formatter for dates: '16 de out. de 2026'
  const formatDate = (timestamp: number) => {
    if (!timestamp) return 'Data indefinida';
    return new Date(timestamp).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  };

  // Helper to get active case
  const activeCase = useMemo(() => {
    return cases.find((c) => c.id === activeCaseId) || null;
  }, [cases, activeCaseId]);

  // Synchronize state with localStorage
  const saveToLocalStorage = (updatedCases: CadernoCase[]) => {
    try {
      localStorage.setItem(CADERNO_LOCAL_STORAGE_KEY, JSON.stringify(updatedCases));
    } catch (e) {
      console.warn('Erro ao salvar no localStorage:', e);
    }
  };

  // Broadcast and persist to Supabase
  const persistToCloud = (updatedCases: CadernoCase[]) => {
    if (!isOnline) {
      setSyncStateText('Salvo localmente (offline)');
      return;
    }

    setSyncStateText('Sincronizando com a mesa…');
    setIsSyncingWithCloud(true);

    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    debounceTimerRef.current = setTimeout(async () => {
      try {
        // 1. Broadcast to peer players
        if (broadcastChannelRef.current) {
          broadcastChannelRef.current.send({
            type: 'broadcast',
            event: 'cases_updated',
            payload: {
              cases: updatedCases,
              updatedBy: userUid,
              timestamp: Date.now(),
            },
          });
        }

        // 2. Persist to Supabase players table under CADERNO_CAMPO_SHARED
        const { error } = await supabase
          .from('players')
          .upsert({
            id: CADERNO_SUPABASE_RECORD_ID,
            data: updatedCases,
            updated_at: new Date().toISOString(),
          });

        if (error) {
          console.warn('Erro ao persistir caderno no Supabase:', error.message);
          setSyncStateText('Salvo localmente');
        } else {
          setSyncStateText('Sincronizado na Nuvem');
        }
      } catch (err: any) {
        console.warn('Exceção ao sincronizar caderno:', err?.message);
        setSyncStateText('Salvo localmente');
      } finally {
        setIsSyncingWithCloud(false);
      }
    }, 400);
  };

  // Initial cloud fetch & merge
  useEffect(() => {
    let isMounted = true;

    const fetchCloudCases = async () => {
      if (!isOnline) return;
      try {
        setIsSyncingWithCloud(true);
        const { data, error } = await supabase
          .from('players')
          .select('data, updated_at')
          .eq('id', CADERNO_SUPABASE_RECORD_ID)
          .maybeSingle();

        if (error) {
          console.warn('Consulta do caderno remoto:', error.message);
          return;
        }

        if (data && Array.isArray(data.data) && isMounted) {
          const remoteCases: CadernoCase[] = data.data;

          setCases((prevLocal) => {
            if (prevLocal.length === 0) {
              saveToLocalStorage(remoteCases);
              if (!activeCaseId && remoteCases.length > 0) {
                setActiveCaseId(remoteCases[0].id);
              }
              return remoteCases;
            }

            // Merge local and remote non-destructively: pick newer updated timestamp
            const caseMap = new Map<string, CadernoCase>();
            prevLocal.forEach((c) => caseMap.set(c.id, c));

            remoteCases.forEach((remoteCase) => {
              const localCase = caseMap.get(remoteCase.id);
              if (!localCase || (remoteCase.updated || 0) > (localCase.updated || 0)) {
                caseMap.set(remoteCase.id, remoteCase);
              }
            });

            const merged = Array.from(caseMap.values()).sort(
              (a, b) => (b.updated || 0) - (a.updated || 0)
            );
            saveToLocalStorage(merged);
            return merged;
          });
          setSyncStateText('Sincronizado na Nuvem');
        }
      } catch (err) {
        console.warn('Erro ao buscar casos remotos:', err);
      } finally {
        if (isMounted) setIsSyncingWithCloud(false);
      }
    };

    fetchCloudCases();

    return () => {
      isMounted = false;
    };
  }, [isOnline]);

  // Set up Supabase Realtime channel and Postgres change listener
  useEffect(() => {
    if (!isOnline) return;

    const channel = supabase
      .channel('caderno_campo_sync')
      .on('broadcast', { event: 'cases_updated' }, (payload: any) => {
        if (payload?.payload?.cases && payload.payload.updatedBy !== userUid) {
          const incomingCases: CadernoCase[] = payload.payload.cases;
          setCases(incomingCases);
          saveToLocalStorage(incomingCases);
          setSyncStateText('Atualizado em tempo real');
        }
      })
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'players',
          filter: `id=eq.${CADERNO_SUPABASE_RECORD_ID}`,
        },
        (payload: any) => {
          if (payload?.new?.data && Array.isArray(payload.new.data)) {
            const incomingCases: CadernoCase[] = payload.new.data;
            setCases((current) => {
              if (JSON.stringify(current) === JSON.stringify(incomingCases)) {
                return current;
              }
              saveToLocalStorage(incomingCases);
              return incomingCases;
            });
            setSyncStateText('Sincronizado na Nuvem');
          }
        }
      )
      .subscribe();

    broadcastChannelRef.current = channel;

    return () => {
      supabase.removeChannel(channel);
    };
  }, [isOnline, userUid]);

  // Cross-tab storage listener
  useEffect(() => {
    const handleStorage = (e: StorageEvent) => {
      if (e.key === CADERNO_LOCAL_STORAGE_KEY && e.newValue) {
        try {
          const updated = JSON.parse(e.newValue);
          if (Array.isArray(updated)) {
            setCases(updated);
          }
        } catch {}
      }
    };
    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, []);

  // Update a single case property
  const updateCurrentCase = (updater: (prevCase: CadernoCase) => CadernoCase) => {
    if (!activeCaseId) return;

    setCases((prev) => {
      const nextCases = prev.map((c) => {
        if (c.id === activeCaseId) {
          const updated = updater(c);
          return {
            ...updated,
            updated: Date.now(),
          };
        }
        return c;
      });

      saveToLocalStorage(nextCases);
      persistToCloud(nextCases);
      return nextCases;
    });
  };

  // Add a new incident case
  const handleCreateNewCase = () => {
    const newCase: CadernoCase = {
      id: `c${Date.now()}`,
      title: '',
      el: 'indefinida',
      status: 'invest',
      dept: 'indef',
      mem: 'nenhum',
      ent: '',
      loc: '',
      text: '',
      clues: [],
      created: Date.now(),
      updated: Date.now(),
      authorUid: userUid,
    };

    setCases((prev) => {
      const nextCases = [newCase, ...prev];
      saveToLocalStorage(nextCases);
      persistToCloud(nextCases);
      return nextCases;
    });

    setActiveCaseId(newCase.id);
    setIsMobileEditing(true);
    setFilter('todos');
    setSearchQuery('');
  };

  // Delete current case
  const handleDeleteCase = (idToDelete: string) => {
    if (
      !window.confirm(
        'Excluir este caso permanentemente? Essa ação não pode ser desfeita.'
      )
    ) {
      return;
    }

    setCases((prev) => {
      const nextCases = prev.filter((c) => c.id !== idToDelete);
      saveToLocalStorage(nextCases);
      persistToCloud(nextCases);

      if (activeCaseId === idToDelete) {
        const remaining = nextCases.length > 0 ? nextCases[0].id : null;
        setActiveCaseId(remaining);
        if (!remaining) {
          setIsMobileEditing(false);
        }
      }
      return nextCases;
    });
  };

  // Add clue to active case
  const handleAddClue = () => {
    const text = newClueText.trim();
    if (!text || !activeCase) return;

    updateCurrentCase((c) => ({
      ...c,
      clues: [...c.clues, { t: text, ok: false }],
    }));
    setNewClueText('');
  };

  // Toggle clue status
  const handleToggleClue = (index: number) => {
    if (!activeCase) return;
    updateCurrentCase((c) => ({
      ...c,
      clues: c.clues.map((clue, i) =>
        i === index ? { ...clue, ok: !clue.ok } : clue
      ),
    }));
  };

  // Remove clue
  const handleRemoveClue = (index: number) => {
    if (!activeCase) return;
    updateCurrentCase((c) => ({
      ...c,
      clues: c.clues.filter((_, i) => i !== index),
    }));
  };

  // Export JSON
  const handleExportJSON = () => {
    const blob = new Blob([JSON.stringify(cases, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `demologia-caderno-rl-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Import JSON
  const handleImportJSON = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const content = event.target?.result as string;
        const importedData = JSON.parse(content);

        if (!Array.isArray(importedData)) {
          alert('Arquivo inválido. Formato esperado: lista JSON de casos.');
          return;
        }

        setCases((prev) => {
          const map = new Map<string, CadernoCase>();
          prev.forEach((c) => map.set(c.id, c));

          let importedCount = 0;
          importedData.forEach((item: any) => {
            if (!item || !item.id) return;
            const sanitizedCase: CadernoCase = {
              id: String(item.id),
              title: String(item.title || ''),
              el: CADERNO_ELEMENTS[item.el as AffiliationType]
                ? (item.el as AffiliationType)
                : 'indefinida',
              status: CADERNO_STATUS[item.status as CaseStatus]
                ? (item.status as CaseStatus)
                : 'invest',
              dept: CADERNO_DEPARTMENTS[item.dept as DepartmentType]
                ? (item.dept as DepartmentType)
                : 'indef',
              mem: CADERNO_MEMBRANE[item.mem as MembraneStatus]
                ? (item.mem as MembraneStatus)
                : 'nenhum',
              ent: String(item.ent || ''),
              loc: String(item.loc || ''),
              text: String(item.text || ''),
              clues: Array.isArray(item.clues)
                ? item.clues.map((c: any) => ({
                    t: String(c.t || ''),
                    ok: Boolean(c.ok),
                  }))
                : [],
              created: item.created || Date.now(),
              updated: item.updated || Date.now(),
              authorUid: item.authorUid || userUid,
            };

            if (!map.has(sanitizedCase.id)) {
              map.set(sanitizedCase.id, sanitizedCase);
              importedCount++;
            }
          });

          const merged = Array.from(map.values()).sort(
            (a, b) => (b.updated || 0) - (a.updated || 0)
          );
          saveToLocalStorage(merged);
          persistToCloud(merged);
          alert(`${importedCount} novo(s) caso(s) importado(s) com sucesso.`);
          return merged;
        });
      } catch (err) {
        alert('Falha ao processar arquivo JSON. Verifique a integridade do arquivo.');
      } finally {
        if (fileInputRef.current) fileInputRef.current.value = '';
      }
    };
    reader.readAsText(file);
  };

  // Filtered cases
  const filteredCases = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return cases
      .filter((c) => filter === 'todos' || c.el === filter)
      .filter((c) => {
        if (!q) return true;
        const haystack = [
          c.title,
          c.text,
          c.ent,
          c.loc,
          ...c.clues.map((clue) => clue.t),
        ]
          .join(' ')
          .toLowerCase();
        return haystack.includes(q);
      })
      .sort((a, b) => (b.updated || 0) - (a.updated || 0));
  }, [cases, filter, searchQuery]);

  return (
    <div className="caderno-container w-full min-h-[calc(100vh-80px)] flex flex-col bg-[#0c0a14] text-[#e2e8f0] font-sans selection:bg-[#a855f7] selection:text-white px-3 sm:px-6 max-w-7xl mx-auto">
      {/* Ambient background glow for Real L theme */}
      <div
        className="fixed inset-0 pointer-events-none opacity-30 z-0"
        style={{
          background:
            'radial-gradient(1200px 600px at 80% -10%, rgba(168, 85, 247, 0.22) 0%, transparent 65%)',
        }}
      />

      {/* Balanced Rounded Header Card (0.3 - 0.5 curvature = rounded-lg) */}
      <header className="relative z-10 flex flex-wrap items-center justify-between gap-4 p-4 sm:p-5 mb-5 bg-gradient-to-r from-[#18132d]/95 via-[#141026]/95 to-[#18132d]/95 backdrop-blur-md border border-[#a855f7]/25 rounded-lg shadow-xl shadow-black/50">
        <div className="flex items-center gap-3 sm:gap-4">
          {/* Botão de abrir sidebar integrado ao caderno (quadrado) */}
          {onOpenSidebar && (
            <button
              type="button"
              onClick={onOpenSidebar}
              className="min-h-[44px] min-w-[44px] px-3.5 py-2 rounded-none bg-[#22183c] hover:bg-[#2f2052] border border-[#a855f7]/40 text-[#d8b4fe] hover:text-white flex items-center justify-center gap-2 shadow-sm transition-all active:scale-95 cursor-pointer flex-none"
              aria-label="Abrir menu de navegação"
              title="Abrir menu lateral"
            >
              <Menu size={18} className="text-[#c084fc]" />
              <span className="text-xs font-mono font-bold uppercase hidden sm:inline">Menu</span>
            </button>
          )}

          {/* Luminous Amethyst Sigil Badge (subtle rounded-md) */}
          <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-md bg-[#22183c] border border-[#a855f7]/40 flex items-center justify-center p-2 shadow-[0_0_15px_rgba(168,85,247,0.3)] flex-none">
            <svg
              className="w-full h-full"
              viewBox="0 0 40 40"
              fill="none"
              stroke="#c084fc"
              strokeWidth="2.2"
              aria-hidden="true"
            >
              <path d="M3 20c6-9 12-13 17-13s11 4 17 13c-6 9-12 13-17 13S9 29 3 20z" />
              <circle cx="20" cy="20" r="5" />
              <path d="M20 4v32" strokeDasharray="2 3" />
            </svg>
          </div>
          <div>
            <h1 className="text-base sm:text-lg lg:text-xl font-bold tracking-wide uppercase text-white flex items-center flex-wrap gap-2 sm:gap-2.5">
              <span>Caderno de Campo</span>
              <span className="text-[10px] bg-[#2d1d49] text-[#d8b4fe] border border-[#a855f7]/40 px-2 py-0.5 rounded font-mono font-medium shadow-sm">
                MODO REAL L
              </span>
            </h1>
            <p className="text-xs sm:text-sm text-[#a09bb8] tracking-wide font-normal mt-0.5">
              Demologia Corp · Arquivo Confidencial de Casos
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Cloud Sync Status Indicator */}
          <div
            className="flex items-center gap-2 text-xs px-3 py-1.5 rounded-md bg-[#1b152d] border border-[#a855f7]/25 shadow-inner"
            title={syncStateText}
          >
            {isOnline ? (
              <Cloud
                size={15}
                className={isSyncingWithCloud ? 'text-[#e0a526] animate-pulse' : 'text-[#3fb27f]'}
              />
            ) : (
              <CloudOff size={15} className="text-[#8a8a94]" />
            )}
            <span className="hidden sm:inline text-[#d8b4fe] text-xs font-mono">
              {syncStateText}
            </span>
          </div>

          {/* Cases Count Badge */}
          <div className="text-xs sm:text-sm font-bold tracking-widest text-[#d8b4fe] bg-[#271a42] border border-[#a855f7]/35 px-3 py-1.5 rounded-md font-mono shadow-sm">
            {cases.length} {cases.length === 1 ? 'CASO' : 'CASOS'}
          </div>

          {/* Return Button */}
          {onBackToSheet && (
            <button
              onClick={onBackToSheet}
              className="min-h-[44px] px-4 py-2 text-xs font-semibold text-[#e2e8f0] hover:text-white bg-[#251b3d] hover:bg-[#322354] border border-[#a855f7]/35 rounded-md transition-all flex items-center gap-2 shadow-sm active:scale-95"
            >
              <ArrowLeft size={15} className="text-[#c084fc]" />
              <span className="hidden xs:inline">Voltar à Ficha</span>
            </button>
          )}
        </div>
      </header>

      {/* Main Container with Balanced Rounded Split Cards (rounded-lg) */}
      <div className="relative z-10 flex-1 grid grid-cols-1 lg:grid-cols-[380px_1fr] gap-5 sm:gap-6 min-h-0 items-start">
        {/* Left Column: Aside / Case List (Balanced Card com rounded-lg, p-5 e gap-4) */}
        <aside
          className={`flex flex-col bg-gradient-to-b from-[#18132e]/95 to-[#120e20]/95 backdrop-blur-md border border-[#a855f7]/25 rounded-lg shadow-xl shadow-black/40 overflow-hidden p-5 gap-4 ${
            isMobileEditing ? 'hidden lg:flex' : 'flex'
          }`}
        >
          {/* Action: + Novo Caso Button */}
          <button
            onClick={handleCreateNewCase}
            className="w-full min-h-[48px] bg-gradient-to-r from-[#9333ea] via-[#a855f7] to-[#7e22ce] hover:from-[#a855f7] hover:to-[#9333ea] text-white font-bold py-2.5 px-4 rounded-md uppercase text-xs tracking-wider transition-all flex items-center justify-center gap-2 shadow-md shadow-purple-950/60 active:scale-[0.98]"
          >
            <Plus size={18} />
            <span>+ Novo Caso</span>
          </button>

          {/* Search Input with balanced curvature */}
          <div className="relative">
            <Search
              size={16}
              className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#a09bb8]"
            />
            <input
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar casos, notas, pistas..."
              className="w-full min-h-[46px] bg-[#100d1c] border border-[#a855f7]/25 text-sm text-[#f8fafc] pl-10 pr-3.5 py-2.5 rounded-md focus:outline-none focus:border-[#c084fc] focus:ring-1 focus:ring-[#c084fc]/30 transition-all placeholder:text-[#7e7698]"
            />
          </div>

          {/* Affiliation Filter Chips - Balanced rounded-md tags */}
          <div className="flex flex-wrap gap-1.5 pt-0.5">
            <button
              onClick={() => setFilter('todos')}
              className={`min-h-[34px] text-xs font-medium px-3 py-1 rounded-md border transition-all flex items-center gap-1.5 ${
                filter === 'todos'
                  ? 'border-[#c084fc] text-white bg-[#372159] shadow-[0_0_8px_rgba(192,132,252,0.35)]'
                  : 'border-[#a855f7]/20 text-[#a09bb8] bg-[#141022] hover:border-[#a855f7]/50 hover:text-white'
              }`}
            >
              <i className="w-2 h-2 rounded-full bg-[#c084fc]" />
              <span>Todos</span>
            </button>
            {(Object.entries(CADERNO_ELEMENTS) as [AffiliationType, [string, string]][]).map(
              ([key, [name, color]]) => (
                <button
                  key={key}
                  onClick={() => setFilter(key)}
                  className={`min-h-[34px] text-xs font-medium px-3 py-1 rounded-md border transition-all flex items-center gap-1.5 ${
                    filter === key
                      ? 'border-[#c084fc] text-white bg-[#372159] shadow-[0_0_8px_rgba(192,132,252,0.35)]'
                      : 'border-[#a855f7]/20 text-[#a09bb8] bg-[#141022] hover:border-[#a855f7]/50 hover:text-white'
                  }`}
                >
                  <i
                    className="w-2 h-2 rounded-full"
                    style={{ backgroundColor: color }}
                  />
                  <span>{name}</span>
                </button>
              )
            )}
          </div>

          {/* Cases List as balanced tactile cards (rounded-md) */}
          <div className="flex flex-col gap-2 overflow-y-auto max-h-[calc(100vh-360px)] pr-1">
            {filteredCases.length > 0 ? (
              filteredCases.map((c) => {
                const elementInfo = CADERNO_ELEMENTS[c.el] || CADERNO_ELEMENTS.indefinida;
                const statusInfo = CADERNO_STATUS[c.status] || CADERNO_STATUS.invest;
                const isSelected = c.id === activeCaseId;

                return (
                  <button
                    key={c.id}
                    onClick={() => {
                      setActiveCaseId(c.id);
                      setIsMobileEditing(true);
                    }}
                    className={`w-full min-h-[64px] text-left p-3.5 rounded-md transition-all border flex flex-col gap-1 relative overflow-hidden group active:scale-[0.99] ${
                      isSelected
                        ? 'bg-gradient-to-r from-[#2e1d4b] to-[#1e1436] border-[#c084fc] shadow-md shadow-purple-950/60 ring-1 ring-[#c084fc]/40'
                        : 'bg-[#140f26]/85 hover:bg-[#1e1638] border-[#a855f7]/20 hover:border-[#a855f7]/40'
                    }`}
                  >
                    {/* Left element accent indicator */}
                    <span
                      className="absolute left-0 top-0 bottom-0 w-1 rounded-l-md transition-all"
                      style={{ backgroundColor: elementInfo[1] }}
                    />

                    <div className="pl-2">
                      <b className="block text-sm font-bold text-white truncate tracking-tight">
                        {c.title || 'Caso sem título'}
                      </b>
                      <div className="flex items-center gap-2 text-xs text-[#a09bb8] mt-0.5 font-mono">
                        <span
                          className="font-semibold"
                          style={{ color: elementInfo[1] }}
                        >
                          {elementInfo[0]}
                        </span>
                        <span>·</span>
                        <span className="text-[#d8b4fe]">{statusInfo[0]}</span>
                        <span>·</span>
                        <span className="text-[#8a8a9a]">
                          {formatDate(c.updated || c.created)}
                        </span>
                      </div>
                    </div>
                  </button>
                );
              })
            ) : (
              <div className="p-8 text-center text-xs text-[#a09bb8] bg-[#120f20]/60 rounded-md border border-dashed border-[#a855f7]/20 flex flex-col items-center justify-center gap-2">
                <FolderOpen size={26} className="text-[#a855f7]/60" />
                <span>
                  {cases.length === 0
                    ? 'Nenhum caso registrado. Crie o primeiro caso acima.'
                    : 'Nenhum caso encontrado para estes filtros.'}
                </span>
              </div>
            )}
          </div>

          {/* Foot Actions: Import / Export with balanced rounded buttons */}
          <div className="pt-1 flex items-center gap-2.5">
            <button
              onClick={handleExportJSON}
              className="flex-1 min-h-[44px] py-2 px-3 text-xs font-semibold text-[#e2e8f0] hover:text-white bg-[#19132c] hover:bg-[#261d42] border border-[#a855f7]/25 rounded-md transition-all flex items-center justify-center gap-1.5 shadow-sm active:scale-95"
            >
              <Download size={14} className="text-[#c084fc]" />
              <span>Exportar</span>
            </button>
            <button
              onClick={() => fileInputRef.current?.click()}
              className="flex-1 min-h-[44px] py-2 px-3 text-xs font-semibold text-[#e2e8f0] hover:text-white bg-[#19132c] hover:bg-[#261d42] border border-[#a855f7]/25 rounded-md transition-all flex items-center justify-center gap-1.5 shadow-sm active:scale-95"
            >
              <Upload size={14} className="text-[#c084fc]" />
              <span>Importar</span>
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="application/json"
              onChange={handleImportJSON}
              className="hidden"
            />
          </div>
        </aside>

        {/* Right Column: Case File Editor (Balanced Card com rounded-lg, p-5 e gap-5) */}
        <main
          className={`flex-1 bg-gradient-to-b from-[#18132e]/95 to-[#120e20]/95 backdrop-blur-md border border-[#a855f7]/25 rounded-lg shadow-xl shadow-black/40 p-5 sm:p-6 min-h-[560px] ${
            !isMobileEditing ? 'hidden lg:block' : 'block'
          }`}
        >
          {activeCase ? (
            <div className="max-w-3xl mx-auto flex flex-col gap-5">
              {/* Situation Rubber Stamp & Top Metadata */}
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => setIsMobileEditing(false)}
                    className="lg:hidden min-h-[40px] text-xs font-semibold px-3 py-1.5 bg-[#251a3f] border border-[#a855f7]/35 rounded-md text-white hover:bg-[#322354] flex items-center gap-1.5 shadow-sm active:scale-95"
                  >
                    <ArrowLeft size={14} className="text-[#c084fc]" />
                    <span>Casos</span>
                  </button>
                  <span className="text-[11px] sm:text-xs text-[#d8b4fe] tracking-widest uppercase font-mono bg-[#141024] border border-[#a855f7]/20 px-3 py-1 rounded-md">
                    ARQUIVO Nº{' '}
                    {String(
                      cases.findIndex((c) => c.id === activeCase.id) + 1
                    ).padStart(3, '0')}{' '}
                    · {formatDate(activeCase.created)}
                  </span>
                </div>

                {/* Situation Rubber Stamp with balanced rounded-md */}
                {activeCase.status && (
                  <div
                    className="border-2 font-bold tracking-widest uppercase px-3.5 py-1 text-xs sm:text-sm font-mono rounded-md shadow-md select-none"
                    style={{
                      borderColor: CADERNO_STATUS[activeCase.status]?.[1] || '#e0a526',
                      color: CADERNO_STATUS[activeCase.status]?.[1] || '#e0a526',
                      backgroundColor: 'rgba(20, 15, 34, 0.85)',
                    }}
                  >
                    {CADERNO_STATUS[activeCase.status]?.[0] || 'Em Investigação'}
                  </div>
                )}
              </div>

              {/* Dossier Title - Balanced Touch Input */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-[#d8b4fe] uppercase tracking-wider font-mono">
                  Título do Caso
                </label>
                <input
                  type="text"
                  value={activeCase.title}
                  onChange={(e) =>
                    updateCurrentCase((c) => ({ ...c, title: e.target.value }))
                  }
                  placeholder="EX: INCIDENTE NO SUBSOLO DA ESTAÇÃO CENTRAL"
                  className="w-full min-h-[48px] bg-[#100d1c] border border-[#a855f7]/30 text-base sm:text-lg font-bold tracking-wide text-white uppercase px-4 py-2.5 rounded-md focus:outline-none focus:border-[#c084fc] focus:ring-1 focus:ring-[#c084fc]/30 placeholder:text-[#6a5e88] font-sans transition-all shadow-inner"
                />
              </div>

              {/* Form Metadata: Row 1 */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-bold text-[#d8b4fe] uppercase tracking-wider font-mono">
                    Afiliação
                  </label>
                  <select
                    value={activeCase.el}
                    onChange={(e) =>
                      updateCurrentCase((c) => ({
                        ...c,
                        el: e.target.value as AffiliationType,
                      }))
                    }
                    className="w-full min-h-[44px] bg-[#100d1c] border border-[#a855f7]/25 text-sm text-[#f8fafc] px-3.5 py-2 rounded-md focus:outline-none focus:border-[#c084fc] focus:ring-1 focus:ring-[#c084fc]/25 transition-all cursor-pointer font-sans"
                  >
                    {(Object.entries(CADERNO_ELEMENTS) as [AffiliationType, [string, string]][]).map(
                      ([key, [name]]) => (
                        <option key={key} value={key} className="bg-[#141022]">
                          {name}
                        </option>
                      )
                    )}
                  </select>
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-bold text-[#d8b4fe] uppercase tracking-wider font-mono">
                    Situação
                  </label>
                  <select
                    value={activeCase.status}
                    onChange={(e) =>
                      updateCurrentCase((c) => ({
                        ...c,
                        status: e.target.value as CaseStatus,
                      }))
                    }
                    className="w-full min-h-[44px] bg-[#100d1c] border border-[#a855f7]/25 text-sm text-[#f8fafc] px-3.5 py-2 rounded-md focus:outline-none focus:border-[#c084fc] focus:ring-1 focus:ring-[#c084fc]/25 transition-all cursor-pointer font-sans"
                  >
                    {(Object.entries(CADERNO_STATUS) as [CaseStatus, [string, string]][]).map(
                      ([key, [name]]) => (
                        <option key={key} value={key} className="bg-[#141022]">
                          {name}
                        </option>
                      )
                    )}
                  </select>
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-bold text-[#d8b4fe] uppercase tracking-wider font-mono">
                    Local
                  </label>
                  <input
                    type="text"
                    value={activeCase.loc || ''}
                    onChange={(e) =>
                      updateCurrentCase((c) => ({ ...c, loc: e.target.value }))
                    }
                    placeholder="Onde aconteceu?"
                    className="w-full min-h-[44px] bg-[#100d1c] border border-[#a855f7]/25 text-sm text-[#f8fafc] px-3.5 py-2 rounded-md focus:outline-none focus:border-[#c084fc] focus:ring-1 focus:ring-[#c084fc]/25 transition-all font-sans placeholder:text-[#6a5e88]"
                  />
                </div>
              </div>

              {/* Form Metadata: Row 2 */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-bold text-[#d8b4fe] uppercase tracking-wider font-mono">
                    Departamento
                  </label>
                  <select
                    value={activeCase.dept}
                    onChange={(e) =>
                      updateCurrentCase((c) => ({
                        ...c,
                        dept: e.target.value as DepartmentType,
                      }))
                    }
                    className="w-full min-h-[44px] bg-[#100d1c] border border-[#a855f7]/25 text-sm text-[#f8fafc] px-3.5 py-2 rounded-md focus:outline-none focus:border-[#c084fc] focus:ring-1 focus:ring-[#c084fc]/25 transition-all cursor-pointer font-sans"
                  >
                    {(Object.entries(CADERNO_DEPARTMENTS) as [DepartmentType, string][]).map(
                      ([key, name]) => (
                        <option key={key} value={key} className="bg-[#141022]">
                          {name}
                        </option>
                      )
                    )}
                  </select>
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-bold text-[#d8b4fe] uppercase tracking-wider font-mono">
                    Entidade ou Tributo
                  </label>
                  <input
                    type="text"
                    value={activeCase.ent || ''}
                    onChange={(e) =>
                      updateCurrentCase((c) => ({ ...c, ent: e.target.value }))
                    }
                    placeholder="Quem ou o que está envolvido?"
                    className="w-full min-h-[44px] bg-[#100d1c] border border-[#a855f7]/25 text-sm text-[#f8fafc] px-3.5 py-2 rounded-md focus:outline-none focus:border-[#c084fc] focus:ring-1 focus:ring-[#c084fc]/25 transition-all font-sans placeholder:text-[#6a5e88]"
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-bold text-[#d8b4fe] uppercase tracking-wider font-mono">
                    Membrana
                  </label>
                  <select
                    value={activeCase.mem}
                    onChange={(e) =>
                      updateCurrentCase((c) => ({
                        ...c,
                        mem: e.target.value as MembraneStatus,
                      }))
                    }
                    className="w-full min-h-[44px] bg-[#100d1c] border border-[#a855f7]/25 text-sm text-[#f8fafc] px-3.5 py-2 rounded-md focus:outline-none focus:border-[#c084fc] focus:ring-1 focus:ring-[#c084fc]/25 transition-all cursor-pointer font-sans"
                  >
                    {(Object.entries(CADERNO_MEMBRANE) as [MembraneStatus, string][]).map(
                      ([key, name]) => (
                        <option key={key} value={key} className="bg-[#141022]">
                          {name}
                        </option>
                      )
                    )}
                  </select>
                </div>
              </div>

              {/* Anotações de Campo (Balanced Notepad Card) */}
              <div className="flex flex-col gap-2">
                <h2 className="text-xs font-bold uppercase tracking-widest text-[#d8b4fe] font-mono flex items-center gap-2">
                  <span className="text-[#a855f7]">//</span> Anotações de Campo
                </h2>
                <div className="rounded-lg overflow-hidden border border-[#a855f7]/30 shadow-inner bg-[#0f0c1c] p-4">
                  <textarea
                    value={activeCase.text}
                    onChange={(e) =>
                      updateCurrentCase((c) => ({ ...c, text: e.target.value }))
                    }
                    placeholder="Descreva o que você viu, ouviu e suspeita…"
                    rows={8}
                    style={{
                      backgroundImage:
                        'repeating-linear-gradient(transparent 0 28px, rgba(168, 85, 247, 0.09) 28px 29px)',
                      lineHeight: '29px',
                    }}
                    className="w-full bg-transparent text-[#f8fafc] text-sm sm:text-base focus:outline-none resize-y font-mono"
                  />
                </div>
              </div>

              {/* Pistas e Evidências Checklist (Balanced Interactive Cards) */}
              <div className="flex flex-col gap-2.5">
                <h2 className="text-xs font-bold uppercase tracking-widest text-[#d8b4fe] font-mono flex items-center gap-2">
                  <span className="text-[#a855f7]">//</span> Pistas e Evidências
                </h2>

                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newClueText}
                    onChange={(e) => setNewClueText(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleAddClue();
                      }
                    }}
                    placeholder="Adicionar nova evidência ou testemunho..."
                    className="flex-1 min-h-[46px] bg-[#100d1c] border border-[#a855f7]/25 text-sm text-[#f8fafc] px-3.5 py-2.5 rounded-md focus:outline-none focus:border-[#c084fc] focus:ring-1 focus:ring-[#c084fc]/25 font-sans transition-all placeholder:text-[#6a5e88]"
                  />
                  <button
                    onClick={handleAddClue}
                    className="min-h-[46px] bg-gradient-to-r from-[#9333ea] to-[#7e22ce] hover:from-[#a855f7] hover:to-[#9333ea] text-white font-bold px-5 py-2.5 text-xs uppercase tracking-wider rounded-md transition-all whitespace-nowrap shadow-md shadow-purple-950/40 active:scale-95"
                  >
                    Adicionar
                  </button>
                </div>

                <div className="space-y-2 pt-1">
                  {activeCase.clues.length > 0 ? (
                    activeCase.clues.map((clue, index) => (
                      <div
                        key={index}
                        className={`min-h-[48px] flex items-center gap-3 p-3 bg-[#140f26] border border-[#a855f7]/25 rounded-md text-sm transition-all shadow-sm ${
                          clue.ok ? 'opacity-65 bg-[#0e0b1c]' : 'hover:border-[#c084fc]/40'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={clue.ok}
                          onChange={() => handleToggleClue(index)}
                          className="w-4 h-4 rounded border-[#a855f7]/40 accent-[#9333ea] cursor-pointer flex-none"
                        />
                        <span
                          className={`flex-1 break-words leading-relaxed ${
                            clue.ok ? 'line-through text-[#8d85a6]' : 'text-[#f8fafc]'
                          }`}
                        >
                          {clue.t}
                        </span>
                        <button
                          onClick={() => handleRemoveClue(index)}
                          className="w-8 h-8 rounded flex items-center justify-center text-[#a09bb8] hover:text-[#ff4d6d] hover:bg-[#2b1222] transition-colors flex-none"
                          title="Remover pista"
                        >
                          <X size={15} />
                        </button>
                      </div>
                    ))
                  ) : (
                    <div className="text-xs text-[#a09bb8] italic p-3.5 border border-dashed border-[#a855f7]/25 rounded-md text-center bg-[#100d1c]/60">
                      Nenhuma pista cadastrada para este caso ainda.
                    </div>
                  )}
                </div>
              </div>

              {/* Bottom Action & Sync Bar */}
              <div className="flex flex-wrap items-center justify-between gap-3 pt-5 border-t border-[#a855f7]/25 text-xs text-[#a09bb8]">
                <div className="flex items-center gap-2 bg-[#120e20] border border-[#a855f7]/20 px-3 py-1.5 rounded-md">
                  <span
                    className={`inline-block w-2.5 h-2.5 rounded-full ${
                      isOnline ? 'bg-[#3fb27f]' : 'bg-[#e0a526]'
                    }`}
                  />
                  <span className="font-mono text-[#d8b4fe]">{syncStateText}</span>
                </div>

                <button
                  onClick={() => handleDeleteCase(activeCase.id)}
                  className="min-h-[42px] px-4 py-2 border border-red-900/60 bg-red-950/40 text-red-300 hover:bg-red-900/70 hover:text-white rounded-md uppercase text-xs font-bold tracking-wider transition-all flex items-center gap-2 shadow-sm active:scale-95"
                >
                  <Trash2 size={14} />
                  <span>Excluir Caso</span>
                </button>
              </div>
            </div>
          ) : (
            <div className="h-full flex flex-col items-center justify-center text-center p-8 text-[#a09bb8]">
              <div className="w-16 h-16 rounded-lg bg-[#1d1633] border border-[#a855f7]/30 flex items-center justify-center mb-4 shadow-lg shadow-purple-950/60 p-4">
                <FolderOpen size={32} className="text-[#c084fc]" />
              </div>
              <h3 className="text-lg font-bold text-white mb-1.5">Nenhum caso selecionado</h3>
              <p className="max-w-xs text-xs sm:text-sm text-[#8a8a9a] leading-relaxed">
                Selecione um caso na lista lateral ou crie um novo para registrar suas descobertas de campo.
              </p>
            </div>
          )}
        </main>
      </div>
    </div>
  );
};

export default CadernoDeCampoView;
