import React, { useState, useEffect, useRef } from "react";
import {
  Menu,
  X,
  Edit2,
  ShieldAlert,
  Trash2,
  Minus,
  Plus,
  Dices,
  Maximize,
  FileText,
  Music,
  RotateCcw,
  Ghost,
  Copy,
  Cloud,
  CloudOff,
  Zap,
  Users,
  User,
  Radio,
} from "lucide-react";
import { supabase, supabaseUrl, supabaseAnonKey } from "./lib/supabase";
import { PasswordAuthModal } from "./components/PasswordAuthModal";
import { MasterHeaderBar } from "./components/MasterHeaderBar";
import { MasterOstPanel } from "./components/MasterOstPanel";
import { MasterPlayersView } from "./components/MasterPlayersView";
import { MasterExtrasView } from "./components/MasterExtrasView";
import { MasterGameModeModal } from "./components/MasterGameModeModal";
import { ModeTransitionEffect } from "./components/ModeTransitionEffect";
import { GameMode, GameModeConfig } from "./types";
import rlBgUrl from "./assets/rl_bg.jpg";

const TypewriterText = ({ text, className, style, speed = 50 }: { text: string, className?: string, style?: any, speed?: number }) => {
  const [displayedText, setDisplayedText] = useState("");

  useEffect(() => {
    setDisplayedText("");
    if (!text) return;
    
    let i = 0;
    const interval = setInterval(() => {
      setDisplayedText(text.substring(0, i + 1));
      i++;
      if (i >= text.length) clearInterval(interval);
    }, speed);
    
    return () => clearInterval(interval);
  }, [text, speed]);

  return <span className={className} style={{...style, display: 'inline-block'}}>{displayedText}</span>;
}

const isVideoBackground = (url: string | null | undefined): boolean => {
  if (!url) return false;
  return (
    url.startsWith("data:video/") ||
    url.endsWith(".mp4") ||
    url.toLowerCase().includes(".mp4") ||
    url.toLowerCase().includes(".webm")
  );
};

export const calculateMaxStats = (variables: Record<string, number> = {}) => {
  const findVal = (name: string): number => {
    const entry = Object.entries(variables).find(
      ([k]) => k.trim().toUpperCase() === name.toUpperCase()
    );
    if (entry !== undefined) {
      const parsed = Number(entry[1]);
      return isNaN(parsed) ? 0 : parsed;
    }
    return 0;
  };

  const vit = findVal("VIT");
  const agl = findVal("AGL");
  const san = findVal("SAN");

  const hpMax = Math.max(1, 20 + vit * 6);
  const peMax = Math.max(0, 5 + agl * 3 + san * 2);
  const smMax = Math.max(1, 30 + san * 4);

  return { hpMax, peMax, smMax, vit, agl, san };
};

const defaultInitialVariables = { SAN: 1, AGL: 1, INT: 1, FOR: 1, VIT: 1, OCU: 1 } as Record<string, number>;
const defaultInitialMax = calculateMaxStats(defaultInitialVariables);

const defaultState = {
  name: "Ocultista",
  hp: { current: defaultInitialMax.hpMax, max: defaultInitialMax.hpMax },
  pe: { current: defaultInitialMax.peMax, max: defaultInitialMax.peMax },
  sm: { current: defaultInitialMax.smMax, max: defaultInitialMax.smMax },
  autoMaxStats: true,
  variables: defaultInitialVariables,
  skills: [
    {
      id: 1,
      name: "JANE!",
      cost: 4,
      desc: "Aumenta em +1 a FOR dos aliados",
      test: "1d20+OCU",
      damage: "",
      testVar: "",
      damageVar: "",
    },
    {
      id: 2,
      name: "SMEELS",
      cost: 1,
      desc: "Ataque básico",
      test: "1d20+OCU",
      damage: "1d8+FOR",
      testVar: "",
      damageVar: "",
    },
  ],
  tributo: {
    name: "Sinfonia de Robert",
    desc: "Tributo capaz de tornar sinfonias e músicas em ataques e sensações.",
    passivo: "",
    ativo: "",
  },
  inventory: ["", "", "", "", "", ""],
  history: [] as string[],
};

const MestreStatInput = ({
  value,
  className,
  onSave,
  placeholder,
}: {
  value: number;
  className: string;
  onSave: (val: number) => void;
  placeholder?: string;
}) => {
  const [localVal, setLocalVal] = useState<string | number>(value);
  const [isFocused, setIsFocused] = useState(false);

  useEffect(() => {
    if (!isFocused) setLocalVal(value);
  }, [value, isFocused]);

  return (
    <input
      type="number"
      value={isFocused ? localVal : value}
      placeholder={placeholder}
      onFocus={() => setIsFocused(true)}
      onChange={(e) => setLocalVal(e.target.value)}
      onBlur={() => {
        setIsFocused(false);
        onSave(parseInt(localVal as string) || 0);
      }}
      onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
      className={className}
    />
  );
};

import { TabletopGrid } from "./components/TabletopGrid";
import { QuickDiceSection } from "./components/QuickDiceSection";
import { RollingTerminal } from "./components/RollingTerminal";
import { FormulaShortcutsSection } from "./components/FormulaShortcutsSection";
import { DossierVariablesSection } from "./components/DossierVariablesSection";
import { DossierInventorySection } from "./components/DossierInventorySection";
import { NavigationSidebar } from "./components/NavigationSidebar";
import { ChatContainer, clearMessages } from "./components/chat";

export default function App() {
  const [mainState, setMainState] = useState(() => {
    try {
      const item = localStorage.getItem("rpgSheetState");
      return item ? JSON.parse(item) : defaultState;
    } catch {
      return defaultState;
    }
  });

  const [extraFichas, setExtraFichas] = useState<any[]>(() => {
    try {
      const cached = localStorage.getItem("local_extra_fichas");
      if (cached) return JSON.parse(cached);
    } catch (e) {}
    return [];
  });
  useEffect(() => {
    localStorage.setItem("local_extra_fichas", JSON.stringify(extraFichas));
  }, [extraFichas]);

  const [activeFichaId, setActiveFichaId] = useState("main"); // 'main' or the ID of an extra ficha

  const rawState =
    activeFichaId === "main"
      ? mainState
      : extraFichas.find((f) => f.id === activeFichaId) || mainState;

  const state = {
    ...defaultState,
    ...rawState,
    hp: {
      current:
        rawState.hp?.current ??
        rawState.hpCurrent ??
        defaultState.hp.current,
      max: rawState.hp?.max ?? rawState.hpMax ?? defaultState.hp.max,
    },
    pe: {
      current:
        rawState.pe?.current ??
        rawState.peCurrent ??
        defaultState.pe.current,
      max: rawState.pe?.max ?? rawState.peMax ?? defaultState.pe.max,
    },
    sm: {
      current:
        rawState.sm?.current ??
        rawState.smCurrent ??
        rawState.san?.current ??
        defaultState.sm.current,
      max:
        rawState.sm?.max ??
        rawState.smMax ??
        rawState.san?.max ??
        defaultState.sm.max,
    },
    variables: rawState.variables || defaultState.variables,
    skills: rawState.skills || defaultState.skills,
    inventory: rawState.inventory || defaultState.inventory,
    history: rawState.history || defaultState.history,
    tributo: rawState.tributo || defaultState.tributo,
  };

  const setState = (updater: any) => {
    if (activeFichaId === "main") {
      setMainState(updater);
    } else {
      setExtraFichas((prev) =>
        prev.map((f) => {
          if (f.id === activeFichaId) {
            const fullF = {
              ...defaultState,
              ...f,
              hp: {
                current:
                  f.hp?.current ?? f.hpCurrent ?? defaultState.hp.current,
                max: f.hp?.max ?? f.hpMax ?? defaultState.hp.max,
              },
              pe: {
                current:
                  f.pe?.current ?? f.peCurrent ?? defaultState.pe.current,
                max: f.pe?.max ?? f.peMax ?? defaultState.pe.max,
              },
              sm: {
                current:
                  f.sm?.current ??
                  f.smCurrent ??
                  f.san?.current ??
                  defaultState.sm.current,
                max:
                  f.sm?.max ??
                  f.smMax ??
                  f.san?.max ??
                  defaultState.sm.max,
              },
            };
            const next =
              typeof updater === "function" ? updater(fullF) : updater;
            if (next.synchronized) {
              next.last_local_edit = Date.now();
            }
            return next;
          }
          return f;
        }),
      );
    }
  };

  const [activeSkill, setActiveSkill] = useState<number | null>(null);
  const [editingSkill, setEditingSkill] = useState<number | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [currentPage, setCurrentPage] = useState("ficha");
  const [activeTributo, setActiveTributo] = useState(false);
  const [diceInput, setDiceInput] = useState("");
  const [lastRollResult, setLastRollResult] = useState<{
    formula: string;
    result: number;
    details: string;
    critical?: "crit" | "fumble" | "normal";
  } | null>(null);
  const [quickDiceQty, setQuickDiceQty] = useState<number>(1);
  const historyRef = useRef<HTMLDivElement>(null);
  const [isShaking, setIsShaking] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);
  const [useSkillModalId, setUseSkillModalId] = useState<number | null>(null);
  const [skillModalTested, setSkillModalTested] = useState(false);
  const [userUid, setUserUid] = useState<string | null>(null);
  const userUidRef = useRef<string | null>(null);
  useEffect(() => {
    userUidRef.current = userUid;
  }, [userUid]);
  const [players, setPlayers] = useState<any[]>([]);
  const [isMestreAuth, setIsMestreAuth] = useState(false);
  const [initiatives, setInitiatives] = useState<Record<string, number>>({});
  const [mestreTab, setMestreTab] = useState<
    "fichas" | "ost" | "extras"
  >("fichas");
  const [mestreViewMode, setMestreViewMode] = useState<"grid" | "list">("grid");
  const [globalGridState, setGlobalGridState] = useState<any>({ objects: [] });
  const [deletingFichaId, setDeletingFichaId] = useState<string | null>(null);
  const [customStyle, setCustomStyle] = useState<any>({ backgroundUrl: null });

  const [ostList, setOstList] = useState<any[]>([]);
  const [globalOstState, setGlobalOstState] = useState<any>(null);
  const globalOstStateRef = useRef<any>(null);
  
  const [cutsceneState, setCutsceneState] = useState<any>(null);
  const [fadeBlockState, setFadeBlockState] = useState<any>(null);
  const cutsceneStateRef = useRef<any>(null);
  useEffect(() => {
    cutsceneStateRef.current = cutsceneState;
  }, [cutsceneState]);

  useEffect(() => {
    globalOstStateRef.current = globalOstState;
  }, [globalOstState]);

  const [loadedOstData, setLoadedOstData] = useState<any>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const fadeAnimationRef = useRef<number | null>(null);
  const lastResetTimestampRef = useRef<number | null>(null);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [showUpdateLog, setShowUpdateLog] = useState(false);
  const [playerToKick, setPlayerToKick] = useState<any>(null);
  const [passwordInput, setPasswordInput] = useState("");
  const [passwordError, setPasswordError] = useState(false);
  const [requiresInteraction, setRequiresInteraction] = useState(false);
  const [isUploadingOst, setIsUploadingOst] = useState(false);
  const [isOstLoading, setIsOstLoading] = useState(false);
  const [supabaseConfigError, setSupabaseConfigError] = useState<string | null>(null);

  // Sistema de Modos de Jogo: Demologia (Padrão) vs Real L (Fora do Paranormal)
  const [gameModeConfig, setGameModeConfig] = useState<GameModeConfig>(() => {
    try {
      const saved = localStorage.getItem("demologia_game_mode_config");
      if (saved) return JSON.parse(saved);
    } catch {}
    return { globalMode: "demologia", playerModes: {} };
  });
  const [showModeModal, setShowModeModal] = useState(false);

  // Modo ativo para o usuário local (se tiver override individual, usa ele; senão usa o global)
  const activeMode: GameMode = (() => {
    if (userUid && gameModeConfig.playerModes && gameModeConfig.playerModes[userUid]) {
      return gameModeConfig.playerModes[userUid];
    }
    return gameModeConfig.globalMode || "demologia";
  })();
  const isRlMode = activeMode === "rl";

  // Aplica classe .theme-rl no documento para alternar paleta para branco/prata e silenciar elementos paranormais
  useEffect(() => {
    if (isRlMode) {
      document.documentElement.classList.add("theme-rl");
      document.body.classList.add("theme-rl");
    } else {
      document.documentElement.classList.remove("theme-rl");
      document.body.classList.remove("theme-rl");
    }
  }, [isRlMode]);

  const handleSupabaseError = (err: any, context?: string) => {
    if (!err) return;
    const msg = typeof err === 'string' ? err : err.message || '';
    if (
      msg.toLowerCase().includes("failed to fetch") ||
      msg.toLowerCase().includes("fetch") ||
      msg.toLowerCase().includes("typeerror") ||
      msg.toLowerCase().includes("network")
    ) {
      console.warn(`Supabase Connection warning [${context || 'General'}]:`, msg);
      return;
    }
    console.error(`Supabase Error [${context || 'General'}]:`, msg);
    if (
      msg.includes("API key") ||
      msg.includes("JWT") ||
      msg.includes("anon key") ||
      msg.includes("Invalid key") ||
      msg.includes("ApiKey") ||
      msg.includes("invalid-api-key")
    ) {
      setSupabaseConfigError(`Chave API inválida ou ausente (${msg}). Configure VITE_SUPABASE_URL e VITE_SUPABASE_PUBLIC_ANON_KEY nos segredos.`);
    } else if (
      msg.toLowerCase().includes("permission denied") ||
      msg.toLowerCase().includes("does not exist") ||
      msg.toLowerCase().includes("table players") ||
      msg.toLowerCase().includes("row level security") ||
      msg.toLowerCase().includes("policy")
    ) {
      setSupabaseConfigError(`Erro de Banco de Dados (${msg}). A tabela 'players' não foi criada no novo projeto ou as permissões de leitura/escrita (Políticas e RLS) não estão configuradas como descritas abaixo.`);
    }
  };

  const [isOnline, setIsOnline] = useState(() => {
    return localStorage.getItem("rpgIsOnline") !== "false";
  });

  useEffect(() => {
    localStorage.setItem("rpgIsOnline", isOnline.toString());
  }, [isOnline]);

  const toggleFichaSync = async (ficha: any) => {
    if (!userUid) {
      alert("Você precisa estar conectado à internet/Supabase para sincronizar fichas.");
      return;
    }
    const isNowSynced = !ficha.synchronized;
    if (isNowSynced) {
      const { last_local_edit, ...pureData } = ficha;
      const updatedFicha = { ...pureData, synchronized: true };
      setExtraFichas((prev) =>
        prev.map((f) => (f.id === ficha.id ? updatedFicha : f))
      );
      const { error } = await supabase
        .from("players")
        .upsert({
          id: `EXTRA_FICHA_${ficha.id}`,
          data: updatedFicha,
          updated_at: new Date().toISOString(),
        });
      if (error) {
        console.warn("Erro ao sincronizar ficha extra:", error.message);
        handleSupabaseError(error, "Sincronizar Ficha Extra");
      }
    } else {
      const updatedFicha = { ...ficha, synchronized: false, last_local_edit: undefined };
      setExtraFichas((prev) =>
        prev.map((f) => (f.id === ficha.id ? updatedFicha : f))
      );
      const { error } = await supabase
        .from("players")
        .delete()
        .eq("id", `EXTRA_FICHA_${ficha.id}`);
      if (error) {
        console.warn("Erro ao parar sincronização de ficha extra:", error.message);
        handleSupabaseError(error, "Desativar Sincronização Ficha Extra");
      }
    }
  };

  // Synchronize extra sheets to Supabase
  useEffect(() => {
    if (!userUid || !isOnline) return;

    extraFichas.forEach((ficha) => {
      if (ficha.synchronized && ficha.last_local_edit) {
        const { last_local_edit, ...pureData } = ficha;
        // Clear flag immediately to dodge loop
        setExtraFichas((prev) =>
          prev.map((f) => (f.id === ficha.id ? { ...f, last_local_edit: undefined } : f))
        );
        supabase
          .from("players")
          .upsert({
            id: `EXTRA_FICHA_${ficha.id}`,
            data: pureData,
            updated_at: new Date().toISOString(),
          })
          .then(({ error }) => {
            if (error) {
              console.warn("Erro ao atualizar ficha extra sincronizada:", error.message);
            }
          });
      }
    });
  }, [extraFichas, userUid, isOnline]);

  // Real-time active extra sheet listener (for both master and players)
  useEffect(() => {
    if (!userUid || !isOnline || activeFichaId === "main") return;

    const channel = supabase
      .channel(`active_extra_ficha_${activeFichaId}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "players",
          filter: `id=eq.EXTRA_FICHA_${activeFichaId}`,
        },
        (payload) => {
          const newRec = payload.new as any;
          if (newRec && newRec.data) {
            setExtraFichas((prev) =>
              prev.map((f) => {
                if (f.id === activeFichaId) {
                  if (f.last_local_edit) return f;
                  const incoming = {
                    ...newRec.data,
                    id: activeFichaId,
                    synchronized: true
                  };
                  if (JSON.stringify(f) === JSON.stringify(incoming)) return f;
                  return incoming;
                }
                return f;
              })
            );
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [activeFichaId, userUid, isOnline]);

  const pendingUpdatesRef = useRef<boolean>(false);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const globalChannelRef = useRef<any>(null);

  useEffect(() => {
    localStorage.setItem("rpgSheetState", JSON.stringify(mainState));

    if (
      userUid &&
      isOnline &&
      currentPage !== "mestre" &&
      currentPage !== "ficha_extra"
    ) {
      pendingUpdatesRef.current = true;
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);

      debounceTimerRef.current = setTimeout(() => {
        supabase
          .from("players")
          .upsert({
            id: userUid,
            data: mainState,
            updated_at: new Date().toISOString(),
          })
          .then(
            ({ error }) => {
              if (error)
                console.warn(
                  "Erro ao sincronizar com Supabase:",
                  error.message,
                );
              pendingUpdatesRef.current = false;
            },
            (err: any) => {
              console.warn(
                "Falha de conexão ao sincronizar com Supabase (offline/fetch error):",
                err ? err.message : "",
              );
              pendingUpdatesRef.current = false;
            },
          );
      }, 1000);
    }
  }, [mainState, userUid, isOnline, currentPage]);

  useEffect(() => {
    const initAuth = async () => {
      if (!supabaseUrl || !supabaseAnonKey) {
        setSupabaseConfigError("Configuração do Supabase ausente. Suas variáveis de ambiente VITE_SUPABASE_URL e/ou VITE_SUPABASE_PUBLIC_ANON_KEY não estão definidas nos segredos.");
      }

      let localUid = localStorage.getItem("localUid");
      if (!localUid) {
        localUid = crypto.randomUUID();
        localStorage.setItem("localUid", localUid);
      }

      try {
        const {
          data: { session },
          error: sessionError,
        } = await supabase.auth.getSession();
        if (sessionError) throw sessionError;

        if (session?.user && session.user.email) {
          setUserUid(session.user.id);
        } else {
          setUserUid(localUid);
        }
      } catch (err: any) {
        console.warn(
          "Supabase auth error (pode ser offline ou erro de rede):",
          err.message,
        );
        handleSupabaseError(err, "Inicialização de Sessão");
        setUserUid(localUid);
      }
    };

    initAuth();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user && session.user.email) {
        setUserUid(session.user.id);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!userUid) return;

    const fetchOwnState = () => {
      supabase
        .from("players")
        .select("data")
        .eq("id", userUid)
        .single()
        .then(
          ({ data, error }) => {
            if (error) {
              console.warn("Error fetching own state:", error.message);
              return;
            }
            if (data?.data && !pendingUpdatesRef.current) {
              setMainState((prev: any) => {
                const newHp = data.data.hp;
                const newPe = data.data.pe;
                const newSm = data.data.sm;
                if (
                  prev.hp.current !== newHp.current ||
                  prev.pe.current !== newPe.current ||
                  (newSm && prev.sm?.current !== newSm.current) ||
                  prev.hp.max !== newHp.max ||
                  prev.pe.max !== newPe.max ||
                  (newSm && prev.sm?.max !== newSm.max)
                ) {
                  return {
                    ...prev,
                    hp: newHp,
                    pe: newPe,
                    sm: newSm || prev.sm,
                  };
                }
                return prev;
              });
            }
          },
          (err) => console.warn("Fetch own state failed:", err.message),
        );
    };

    fetchOwnState();
    const fallbackInterval = setInterval(fetchOwnState, 15000);

    const channel = supabase
      .channel(`player_changes_${userUid}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "players",
          filter: `id=eq.${userUid}`,
        },
        (payload) => {
          if (payload.new && payload.new.data && !pendingUpdatesRef.current) {
            setMainState((prev: any) => {
              const newHp = payload.new.data.hp;
              const newPe = payload.new.data.pe;
              const newSm = payload.new.data.sm;
              if (
                prev.hp.current !== newHp.current ||
                prev.pe.current !== newPe.current ||
                (newSm && prev.sm?.current !== newSm.current) ||
                prev.hp.max !== newHp.max ||
                prev.pe.max !== newPe.max ||
                (newSm && prev.sm?.max !== newSm.max)
              ) {
                return {
                  ...prev,
                  hp: newHp,
                  pe: newPe,
                  sm: newSm || prev.sm,
                };
              }
              return prev;
            });
          }
        },
      )
      .on(
        "postgres_changes",
        {
          event: "DELETE",
          schema: "public",
          table: "players",
          filter: `id=eq.${userUid}`,
        },
        () => {
          if (currentPage !== "mestre") {
            setIsOnline(false);
            setMainState((prev: any) => ({
              ...prev,
              history: [
                '<span style="color: #ffaa00;">Você foi desconectado pelo Mestre. Vá em "Conexão" para reconectar.</span>',
                ...prev.history,
              ],
            }));
          }
        },
      )
      .subscribe();

    return () => {
      clearInterval(fallbackInterval);
      supabase.removeChannel(channel);
    };
  }, [userUid, currentPage]);

  useEffect(() => {
    const fetchMasterState = () => {
      supabase
        .from("players")
        .select("data")
        .eq("id", "MASTER_STATE")
        .single()
        .then(
          ({ data, error }) => {
            if (error) {
              console.warn("Error fetching master state:", error.message);
              return;
            }
            if (data?.data?.ost) {
              setGlobalOstState((prev: any) => {
                if (JSON.stringify(prev) !== JSON.stringify(data.data.ost))
                  return data.data.ost;
                return prev;
              });
            }
            if (data?.data?.modeConfig) {
              setGameModeConfig((prev: any) => {
                if (JSON.stringify(prev) !== JSON.stringify(data.data.modeConfig)) {
                  try {
                    localStorage.setItem("demologia_game_mode_config", JSON.stringify(data.data.modeConfig));
                  } catch {}
                  return data.data.modeConfig;
                }
                return prev;
              });
            }
          },
          (err) =>
            console.warn("Fetch master state request failed:", err.message),
        );

      supabase
        .from("players")
        .select("data")
        .eq("id", "TABLETOP_GRID")
        .single()
        .then(
          ({ data, error }) => {
            if (!error && data?.data) {
              setGlobalGridState((prev: any) => {
                if (JSON.stringify(prev) !== JSON.stringify(data.data))
                  return data.data;
                return prev;
              });
            }
          },
          (err) =>
            console.warn("Fetch tabletop grid request failed:", err.message),
        );
    };

    fetchMasterState();
    const fallbackInterval = setInterval(fetchMasterState, 15000);

    const channel = supabase
      .channel("global_state_updates", {
        config: { broadcast: { ack: false, self: true } },
      })
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "players" },
        (payload) => {
          const newRecord = payload.new as any;
          if (newRecord?.id === "MASTER_STATE" && newRecord?.data?.ost) {
            setGlobalOstState((prev: any) => {
              if (JSON.stringify(prev) !== JSON.stringify(newRecord.data.ost))
                return newRecord.data.ost;
              return prev;
            });
          }
          if (newRecord?.id === "MASTER_STATE" && newRecord?.data?.modeConfig) {
            setGameModeConfig((prev: any) => {
              if (JSON.stringify(prev) !== JSON.stringify(newRecord.data.modeConfig)) {
                try {
                  localStorage.setItem("demologia_game_mode_config", JSON.stringify(newRecord.data.modeConfig));
                } catch {}
                return newRecord.data.modeConfig;
              }
              return prev;
            });
          }
          if (newRecord?.id === "TABLETOP_GRID" && newRecord?.data) {
            setGlobalGridState((prev: any) => {
              if (JSON.stringify(prev) !== JSON.stringify(newRecord.data))
                return newRecord.data;
              return prev;
            });
          }
        },
      )
      .on("broadcast", { event: "ost_update" }, ({ payload }) => {
        if (payload) {
          setGlobalOstState((prev: any) => {
            if (JSON.stringify(prev) !== JSON.stringify(payload))
              return payload;
            return prev;
          });
        }
      })
      .on("broadcast", { event: "mode_update" }, ({ payload }) => {
        if (payload) {
          setGameModeConfig((prev: any) => {
            if (JSON.stringify(prev) !== JSON.stringify(payload)) {
              try {
                localStorage.setItem("demologia_game_mode_config", JSON.stringify(payload));
              } catch {}
              return payload;
            }
            return prev;
          });
        }
      })
      .on("broadcast", { event: "grid_broadcast" }, ({ payload }) => {
        if (payload) {
          setGlobalGridState((prev: any) => {
            if (JSON.stringify(prev) !== JSON.stringify(payload))
              return payload;
            return prev;
          });
        }
      })
      .subscribe();

    globalChannelRef.current = channel;

    return () => {
      clearInterval(fallbackInterval);
      supabase.removeChannel(channel);
    };
  }, []);

  useEffect(() => {
    if (globalOstState?.ostId && globalOstState.ostId !== loadedOstData?.id) {
      setIsOstLoading(true);
      supabase
        .from("players")
        .select("data")
        .eq("id", globalOstState.ostId)
        .single()
        .then(
          async ({ data }) => {
            if (data?.data?.base64) {
              setLoadedOstData({
                id: globalOstState.ostId,
                base64: data.data.base64,
                name: data.data.name,
              });
            }
            setIsOstLoading(false);
          },
          (e) => {
            console.error("Failed to load OST:", e);
            setIsOstLoading(false);
          },
        );
    }
  }, [globalOstState?.ostId, loadedOstData?.id]);

  useEffect(() => {
    if (!audioRef.current || !loadedOstData) return;

    const audioEl = audioRef.current;

    const attemptPlay = () => {
      if (globalOstState?.isPlaying && audioEl.paused) {
        const playPromise = audioEl.play() as Promise<void> | undefined;
        if (playPromise !== undefined && playPromise.catch) {
          playPromise
            .then(() => {
              setRequiresInteraction(false);
            })
            .catch((e) => {
              console.warn("Auto-play error:", e.name, e.message);
              setRequiresInteraction(true);
            });
        }
      }
    };

    // Prevent re-assigning the same base64 to src which can interrupt playback
    if (audioEl.dataset.ostId !== loadedOstData.id) {
      audioEl.src = loadedOstData.base64;
      audioEl.dataset.ostId = loadedOstData.id;
      audioEl.volume = 0;
      audioEl.load();
    }

    if (
      globalOstState?.resetTimestamp &&
      globalOstState.resetTimestamp !== lastResetTimestampRef.current
    ) {
      lastResetTimestampRef.current = globalOstState.resetTimestamp;
      audioEl.currentTime = 0;
    }

    // Always attempt to play if global state is playing
    attemptPlay();

    const targetVolume = globalOstState?.isPlaying
      ? (globalOstState.volume ?? 1)
      : 0;
    const fadeMs = (globalOstState?.fadeTime ?? 0) * 1000;

    if (fadeAnimationRef.current !== null) {
      cancelAnimationFrame(fadeAnimationRef.current);
      fadeAnimationRef.current = null;
    }

    if (fadeMs <= 0) {
      if (Math.abs(audioEl.volume - targetVolume) > 0.01) {
        audioEl.volume = Math.max(0, Math.min(1, targetVolume));
      }
      if (targetVolume === 0 && !globalOstState?.isPlaying && !audioEl.paused) {
        audioEl.pause();
      }
    } else {
      const startVol = audioEl.volume;
      const volDiff = targetVolume - startVol;
      const startTime = performance.now();

      const animateFade = (time: number) => {
        let elapsed = time - startTime;
        if (elapsed >= fadeMs) {
          audioEl.volume = Math.max(0, Math.min(1, targetVolume));
          if (
            targetVolume === 0 &&
            !globalOstState?.isPlaying &&
            !audioEl.paused
          ) {
            audioEl.pause();
          }
        } else {
          audioEl.volume = Math.max(
            0,
            Math.min(1, startVol + volDiff * (elapsed / fadeMs)),
          );
          fadeAnimationRef.current = requestAnimationFrame(animateFade);
        }
      };
      fadeAnimationRef.current = requestAnimationFrame(animateFade);
    }

    // Periodically ensure playback if it's supposed to be playing
    const playCheckInterval = setInterval(() => {
      if (
        audioEl &&
        globalOstState?.isPlaying &&
        audioEl.paused &&
        !requiresInteraction
      ) {
        attemptPlay();
      }
    }, 2000);

    return () => {
      clearInterval(playCheckInterval);
    };
  }, [globalOstState, loadedOstData]);

  const fetchOsts = () => {
    supabase
      .from("players")
      .select("id")
      .like("id", "OST_FILE_%")
      .then(({ data, error }) => {
        if (error) handleSupabaseError(error, "Buscar Trilhas Sonoras (OSTs)");
        if (data) setOstList(data);
      });
  };

  useEffect(() => {
    if (currentPage === "mestre" && mestreTab === "ost") {
      fetchOsts();
    }
  }, [currentPage, mestreTab]);

  // Global synchronization and real-time subscription for EXTRA CHARACTER SHEETS (for all connected users)
  useEffect(() => {
    if (!userUid || !isOnline) return;

    const fetchExtraFichasGlobal = () => {
      supabase
        .from("players")
        .select("id, data")
        .like("id", "EXTRA_FICHA_%")
        .then(({ data, error }) => {
          if (error) {
            handleSupabaseError(error, "Buscar Fichas Extras (Global)");
          }
          if (!error && data) {
            setExtraFichas((prev) => {
              let updated = [...prev];
              data.forEach((row) => {
                const sheetId = row.id.replace("EXTRA_FICHA_", "");
                const sheetData = {
                  ...row.data,
                  id: sheetId,
                  synchronized: true,
                };
                const idx = updated.findIndex((f) => f.id === sheetId);
                if (idx >= 0) {
                  if (updated[idx].last_local_edit) return;
                  if (JSON.stringify(updated[idx]) !== JSON.stringify(sheetData)) {
                    updated[idx] = sheetData;
                  }
                } else {
                  updated.push(sheetData);
                }
              });
              return updated;
            });
          }
        });
    };

    fetchExtraFichasGlobal();
    const fallbackInterval = setInterval(fetchExtraFichasGlobal, 15000);

    const channel = supabase
      .channel("global_extra_fichas_channel")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "players" },
        (payload) => {
          const newRec = payload.new as any;
          const oldRec = payload.old as any;
          const eventId = newRec?.id || oldRec?.id;
          if (eventId?.startsWith("EXTRA_FICHA_")) {
            const sheetId = eventId.replace("EXTRA_FICHA_", "");
            if (payload.eventType === "DELETE") {
              setExtraFichas((prev) => prev.filter((f) => f.id !== sheetId));
            } else if (newRec && newRec.data) {
              setExtraFichas((prev) => {
                const existingIndex = prev.findIndex((f) => f.id === sheetId);
                const sheetData = {
                  ...newRec.data,
                  id: sheetId,
                  synchronized: true,
                };
                if (existingIndex >= 0) {
                  const prevF = prev[existingIndex];
                  if (prevF.last_local_edit) return prev;
                  if (JSON.stringify(prevF) === JSON.stringify(sheetData)) return prev;
                  const updated = [...prev];
                  updated[existingIndex] = sheetData;
                  return updated;
                } else {
                  return [sheetData, ...prev];
                }
              });
            }
          }
        }
      )
      .subscribe();

    return () => {
      clearInterval(fallbackInterval);
      supabase.removeChannel(channel);
    };
  }, [userUid, isOnline]);

  useEffect(() => {
    if (currentPage === "mestre" && userUid) {
      const fetchPlayersList = () => {
        supabase
          .from("players")
          .select("id, data")
          .not("id", "like", "OST_FILE_%")
          .not("id", "like", "EXTRA_FICHA_%")
          .not("id", "eq", "MASTER_STATE")
          .not("id", "eq", "MASTER_EVENTS")
          .then(
            ({ data, error }) => {
              if (error) {
                const msg = error.message || '';
                if (
                  msg.toLowerCase().includes("failed to fetch") ||
                  msg.toLowerCase().includes("fetch") ||
                  msg.toLowerCase().includes("typeerror") ||
                  msg.toLowerCase().includes("network")
                ) {
                  console.warn("Error fetching players (connection):", msg);
                } else {
                  console.error("Error fetching players:", msg);
                }
                handleSupabaseError(error, "Buscar Lista de Jogadores");
              } else if (data) {
                setPlayers((current) => {
                  const mapped = data.map((d) => ({
                    id: d.id,
                    ...(d.data || {}),
                  }));
                  if (JSON.stringify(current) !== JSON.stringify(mapped))
                    return mapped;
                  return current;
                });
              }
            },
            (err) => console.warn("Fetch players list failed:", err.message),
          );
      };

      fetchPlayersList();
      const fallbackInterval = setInterval(() => {
        fetchPlayersList();
      }, 15000);

      const channel = supabase
        .channel("players_list_channel")
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "players" },
          (payload) => {
            const newRec = payload.new as any;
            const oldRec = payload.old as any;
            const eventId = newRec?.id || oldRec?.id;

            if (
              eventId?.startsWith("OST_FILE_") ||
              eventId?.startsWith("EXTRA_FICHA_") ||
              eventId === "MASTER_STATE" ||
              eventId === "MASTER_EVENTS"
            ) {
              return;
            }

            setPlayers((current) => {
              let existing = [...current];
              if (payload.eventType === "DELETE") {
                return existing.filter((p) => p.id !== oldRec?.id);
              }
              if (!newRec?.id) return existing;
              const formatted = { id: newRec.id, ...(newRec.data || {}) };
              const index = existing.findIndex((p) => p.id === newRec.id);
              if (index >= 0) existing[index] = formatted;
              else existing.push(formatted);
              return existing;
            });
          },
        )
        .subscribe();

      return () => {
        clearInterval(fallbackInterval);
        supabase.removeChannel(channel);
      };
    }
  }, [currentPage, userUid]);

  const vibrate = (ms: number | number[] = 50) => {
    if (navigator.vibrate) navigator.vibrate(ms as any);
  };

  const parseAndRoll = (
    formula: string,
    customVars?: Record<string, number>,
  ) => {
    if (!formula) return null;
    let logDetails: string[] = [];
    let stringToEval = formula.toUpperCase();

    // Sort to match longer variables first (e.g. VARIABLE before VAR)
    const varsToUse = customVars || state.variables;
    const sortedVars = Object.entries(varsToUse).sort(
      (a, b) => b[0].length - a[0].length,
    );
    sortedVars.forEach(([key, value]) => {
      const regex = new RegExp(`\\b${key}\\b`, "g");
      if (regex.test(stringToEval)) {
        logDetails.push(`${key}(${value})`);
        stringToEval = stringToEval.replace(regex, String(value));
      }
    });

    const diceRegex = /(\d+)D(\d+)/g;
    stringToEval = stringToEval.replace(diceRegex, (match, count, sides) => {
      let sum = 0;
      let rolls = [];
      for (let i = 0; i < parseInt(count); i++) {
        let r = Math.floor(Math.random() * parseInt(sides)) + 1;
        sum += r;
        rolls.push(r);
      }
      logDetails.push(`${match}[${rolls.join(",")}]`);
      return String(sum);
    });

    try {
      let safeMath = stringToEval.replace(/[^0-9+\-*/(). ]/g, "");
      if (safeMath.trim() === "") return null;
      // Add implicit multiplication for parenthesis like 2(3+4) -> 2*(3+4)
      safeMath = safeMath
        .replace(/\)(?=\d|\()/g, ")*")
        .replace(/(\d)(?=\()/g, "$1*");
      // eslint-disable-next-line
      const result = new Function("return " + safeMath)();
      return {
        result: Math.floor(result),
        details: logDetails.length > 0 ? logDetails.join(" | ") : "Valor fixo",
        formula,
      };
    } catch {
      return null;
    }
  };

  const triggerShake = () => {
    setIsShaking(false);
    setTimeout(() => setIsShaking(true), 10);
  };

  const addToHistory = (text: string) => {
    setState((prev: any) => ({
      ...prev,
      history: [text, ...prev.history].slice(0, 20),
    }));
  };

  const executeRoll = (formulaToRoll: string) => {
    vibrate(50);
    const trimmed = formulaToRoll.trim();
    if (!trimmed) return;
    const normalized = trimmed.replace(/(^|[^0-9])d(\d+)/gi, "$11d$2");
    const roll = parseAndRoll(normalized);
    if (roll) {
      let critical: "crit" | "fumble" | "normal" = "normal";
      const upper = normalized.toUpperCase();
      if (upper.includes("1D20") && roll.details.includes("1D20")) {
        if (roll.details.includes("[20]")) critical = "crit";
        else if (roll.details.includes("[1]")) critical = "fumble";
      }
      setLastRollResult({ ...roll, critical });
      addToHistory(
        `Rolou: <b>${roll.formula}</b> <br><span style="font-size:11px">${roll.details}</span> <br><span class="log-result">Resultado: ${roll.result}</span>`,
      );
      triggerShake();
    } else {
      addToHistory(
        '<span style="color: #ffaa00;">Fórmula manual inválida.</span>',
      );
    }
  };

  const processManualRoll = () => {
    executeRoll(diceInput);
  };

  const updateStat = (
    stat: "hp" | "pe" | "sm",
    field: "current" | "max",
    val: number,
  ) => {
    if ((stat === "hp" || stat === "sm") && field === "current") vibrate(100);
    setState((prev: any) => ({
      ...prev,
      [stat]: { ...prev[stat], [field]: val || 0 },
    }));
  };

  const applyAutoMaxToState = (prevState: any, newVars: Record<string, number>) => {
    if (prevState.autoMaxStats === false) {
      return { ...prevState, variables: newVars };
    }
    const { hpMax, peMax, smMax } = calculateMaxStats(newVars);
    return {
      ...prevState,
      variables: newVars,
      hp: {
        ...prevState.hp,
        max: hpMax,
        current: Math.min(prevState.hp?.current ?? hpMax, hpMax),
      },
      pe: {
        ...prevState.pe,
        max: peMax,
        current: Math.min(prevState.pe?.current ?? peMax, peMax),
      },
      sm: {
        ...prevState.sm,
        max: smMax,
        current: Math.min(prevState.sm?.current ?? smMax, smMax),
      },
    };
  };

  const removeVariable = (key: string) => {
    setState((prev: any) => {
      const newVars = { ...prev.variables };
      delete newVars[key];
      return applyAutoMaxToState(prev, newVars);
    });
  };

  const updateVariable = (key: string, val: number) => {
    setState((prev: any) => {
      const newVars = { ...prev.variables, [key]: val || 0 };
      return applyAutoMaxToState(prev, newVars);
    });
  };

  const renameVariable = (oldKey: string, newKeyRaw: string) => {
    const newKey = newKeyRaw.trim().toUpperCase();
    if (newKey !== oldKey && newKey !== "") {
      setState((prev: any) => {
        const newVars = { ...prev.variables };
        newVars[newKey] = newVars[oldKey];
        delete newVars[oldKey];
        return applyAutoMaxToState(prev, newVars);
      });
    }
  };

  const forceRecalculateMaxStats = () => {
    setState((prev: any) => {
      const { hpMax, peMax, smMax } = calculateMaxStats(prev.variables);
      return {
        ...prev,
        autoMaxStats: true,
        hp: {
          ...prev.hp,
          max: hpMax,
          current: Math.min(prev.hp?.current ?? hpMax, hpMax),
        },
        pe: {
          ...prev.pe,
          max: peMax,
          current: Math.min(prev.pe?.current ?? peMax, peMax),
        },
        sm: {
          ...prev.sm,
          max: smMax,
          current: Math.min(prev.sm?.current ?? smMax, smMax),
        },
      };
    });
  };

  const toggleAutoMaxStats = () => {
    setState((prev: any) => {
      const nextMode = prev.autoMaxStats === false;
      if (nextMode) {
        const { hpMax, peMax, smMax } = calculateMaxStats(prev.variables);
        return {
          ...prev,
          autoMaxStats: true,
          hp: {
            ...prev.hp,
            max: hpMax,
            current: Math.min(prev.hp?.current ?? hpMax, hpMax),
          },
          pe: {
            ...prev.pe,
            max: peMax,
            current: Math.min(prev.pe?.current ?? peMax, peMax),
          },
          sm: {
            ...prev.sm,
            max: smMax,
            current: Math.min(prev.sm?.current ?? smMax, smMax),
          },
        };
      }
      return {
        ...prev,
        autoMaxStats: false,
      };
    });
  };

  const addVariable = () => {
    setState((prev: any) => {
      let counter = 1;
      let newName = `VAR${counter}`;
      while (prev.variables[newName] !== undefined) {
        counter++;
        newName = `VAR${counter}`;
      }
      return {
        ...prev,
        variables: { ...prev.variables, [newName]: 0 },
      };
    });
  };

  const toggleSkill = (id: number) => {
    vibrate(30);
    setActiveSkill(activeSkill === id ? null : id);
  };

  const addSkill = () => {
    if (state.skills.length < 8) {
      const newId = Date.now();
      setState((prev: any) => ({
        ...prev,
        skills: [
          ...prev.skills,
          { id: newId, name: "", cost: 0, desc: "", test: "", damage: "" },
        ],
      }));
      setActiveSkill(newId);
    }
  };

  const updateSkill = (id: number, field: string, val: any) => {
    setState((prev: any) => ({
      ...prev,
      skills: prev.skills.map((s: any) =>
        s.id === id
          ? { ...s, [field]: field === "cost" ? parseInt(val) || 0 : val }
          : s,
      ),
    }));
  };

  const removeSkill = (id: number) => {
    setState((prev: any) => ({
      ...prev,
      skills: prev.skills.filter((s: any) => s.id !== id),
    }));
  };

  const useSkill = (skill: any, type: "test" | "damage") => {
    vibrate([50, 50]);

    if (type === "test" && skill.cost > 0) {
      if (state.pe.current >= skill.cost) {
        setState((prev: any) => ({
          ...prev,
          pe: { ...prev.pe, current: prev.pe.current - skill.cost },
        }));
        addToHistory(`<i>Gastou ${skill.cost} PE com ${skill.name}</i>`);
      } else {
        addToHistory('<span style="color: #ffaa00;">PE Insuficiente!</span>');
        return;
      }
    }

    const formula = type === "test" ? skill.test : skill.damage;
    if (!formula) {
      addToHistory(
        `<b>${skill.name || "Habilidade"}</b>: Usou a habilidade (Sem fórmula definida).`,
      );
      return;
    }

    const roll = parseAndRoll(formula);
    if (roll) {
      const tipoStr = type === "test" ? "Teste" : "Dano";
      setLastRollResult({
        formula: `${skill.name || "Habilidade"} (${tipoStr})`,
        result: roll.result,
        details: roll.details,
        critical: "normal",
      });
      addToHistory(
        `<b>${skill.name || "Habilidade"}</b> (${tipoStr}) <br>Fórmula: ${roll.formula} <br><span style="font-size:11px">${roll.details}</span> <br><span class="log-result">Resultado: ${roll.result}</span>`,
      );
      triggerShake();

      let newVars = { ...state.variables };

      const varName = type === "test" ? skill.testVar : skill.damageVar;
      if (varName && varName.trim() !== "") {
        const vName = varName.trim().toUpperCase();
        newVars[vName] = roll.result;
        updateVariable(vName, roll.result);
        addToHistory(
          `<i>Variável <b>${vName}</b> foi atualizada para ${roll.result}</i>`,
        );
      }

      const postVar = type === "test" ? skill.testPostVar : skill.damagePostVar;
      const postFormula =
        type === "test" ? skill.testPostFormula : skill.damagePostFormula;

      if (
        postVar &&
        postVar.trim() !== "" &&
        postFormula &&
        postFormula.trim() !== ""
      ) {
        const postRoll = parseAndRoll(postFormula, newVars);
        if (postRoll) {
          const pVarName = postVar.trim().toUpperCase();
          // Since updateVariable relies on state and could be batched, we need to ensure the variables
          // don't overwrite each other if updated multiple times. The updateVariable uses
          // setState(prev => ...), so it's safe!
          updateVariable(pVarName, postRoll.result);
          addToHistory(
            `<i>Variável <b>${pVarName}</b> (Após ${tipoStr}) definida para ${postRoll.result}</i>`,
          );
        } else {
          addToHistory(
            '<span style="color: #ffaa00;">Fórmula após resultado inválida.</span>',
          );
        }
      }
    } else {
      addToHistory(
        '<span style="color: #ffaa00;">Fórmula da skill inválida.</span>',
      );
    }
  };

  const toggleTributo = () => {
    vibrate(60);
    setActiveTributo(!activeTributo);
  };

  const updateTributo = (field: string, val: string) => {
    setState((prev: any) => ({
      ...prev,
      tributo: { ...prev.tributo, [field]: val },
    }));
  };

  const updateInventory = (index: number, val: string) => {
    setState((prev: any) => {
      const newInv = [...prev.inventory];
      newInv[index] = val;
      return { ...prev, inventory: newInv };
    });
  };

  const addInventorySlot = () => {
    setState((prev: any) => ({
      ...prev,
      inventory: [...prev.inventory, ""],
    }));
  };

  const removeInventorySlot = (index: number) => {
    setState((prev: any) => ({
      ...prev,
      inventory: prev.inventory.filter((_: any, i: number) => i !== index),
    }));
  };

  const clearAllInventory = () => {
    setState((prev: any) => ({
      ...prev,
      inventory: prev.inventory.map(() => ""),
    }));
  };

  const clearHistory = () => {
    if (!confirmClear) {
      setConfirmClear(true);
      setTimeout(() => setConfirmClear(false), 3000);
      return;
    }
    setState((prev: any) => ({ ...prev, history: [] }));
  };

  const resetData = () => {
    if (!confirmReset) {
      setConfirmReset(true);
      setTimeout(() => setConfirmReset(false), 3000);
      return;
    }
    localStorage.removeItem("rpgSheetState");
    window.location.reload();
  };

  const exportData = () => {
    const dataStr =
      "data:text/json;charset=utf-8," +
      encodeURIComponent(JSON.stringify(state));
    const a = document.createElement("a");
    a.href = dataStr;
    a.download = "ficha_demologia.json";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const importData = () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "application/json";
    input.onchange = (e: any) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (re: any) => {
        try {
          const content = JSON.parse(re.target.result);
          if (content && content.hp && content.pe) {
            setState(content);
          } else {
            addToHistory(
              '<span style="color: #ffaa00;">Arquivo JSON inválido para esta ficha.</span>',
            );
          }
        } catch {
          addToHistory(
            '<span style="color: #ffaa00;">Erro ao ler o arquivo.</span>',
          );
        }
      };
      reader.readAsText(file, "UTF-8");
    };
    input.click();
  };

  const editPlayerStatExact = async (
    p: any,
    stat: "hp" | "pe" | "sm",
    value: number,
  ) => {
    const newData = { ...p };
    newData[stat].current = Math.max(0, Math.min(newData[stat].max, value));
    const dataToSave = { ...newData };
    delete dataToSave.id;
    await supabase.from("players").update({ data: dataToSave }).eq("id", p.id);
  };

  const hpPercent =
    Math.max(0, Math.min(100, (state.hp.current / state.hp.max) * 100)) || 0;

  const pePercent =
    Math.max(0, Math.min(100, (state.pe.current / state.pe.max) * 100)) || 0;

  const smPercent =
    Math.max(0, Math.min(100, (state.sm.current / state.sm.max) * 100)) || 0;
  const icons = ["X", "O", "∆", "□"];

  const renderHud = () => (
    <div className="hud-container relative pointer-events-auto">
      <img
        className="eye-logo"
        src="https://i.ibb.co/xq2KhP1v/3-Sem-T-tulo.png"
        alt={isRlMode ? "Símbolo Real L" : "Símbolo Demologia"}
      />
      <div className="status-numbers relative">
        <input
          className="bg-transparent text-white font-bold text-center text-[29px] sm:text-[35px] md:text-[41px] uppercase outline-none w-full drop-shadow-[0_0_10px_rgba(211,0,0,0.6)] px-2"
          style={{
            textShadow: "2px 2px 0px #500",
            marginBottom: "-10px",
            zIndex: 10,
          }}
          value={state.name || ""}
          onChange={(e) =>
            setState((prev: any) => ({ ...prev, name: e.target.value }))
          }
          placeholder="NOME"
        />
        {!isRlMode ? (
          <>
            <div className="pe-text z-0">
              <span>
                {state.pe.current}/{state.pe.max}
              </span>
              PE
            </div>
            <div className="hp-text z-0">
              <span>
                {state.hp.current}/{state.hp.max}
              </span>
              HP
            </div>
          </>
        ) : (
          <>
            <div className="hp-text z-0">
              <span>
                {state.hp.current}/{state.hp.max}
              </span>
              HP
            </div>
            <div className="sm-text sn-text z-0" title="Sanidade Mental (SM)">
              <span>
                {state.sm.current}/{state.sm.max}
              </span>
              SM
            </div>
          </>
        )}
      </div>

      <div className="status-bars">
        {/* Barra de HP (sempre visível) */}
        <div className="bar-wrapper">
          <div
            className="bar-fill hp-fill"
            style={{ width: `${hpPercent}%` }}
          ></div>
        </div>
        <div className="status-inputs">
          <span>
            HP:{" "}
            <MestreStatInput
              value={state.hp.current}
              className="w-12 bg-transparent border-none text-white text-center font-bold font-mono outline-none"
              onSave={(val) => updateStat("hp", "current", val)}
            />{" "}
            /{" "}
            <MestreStatInput
              value={state.hp.max}
              className="w-12 bg-transparent border-none text-white text-center font-bold font-mono outline-none"
              onSave={(val) => updateStat("hp", "max", val)}
              placeholder="Max HP"
            />
          </span>
        </div>

        {/* Modo Demologia: Apenas barra de PE */}
        {!isRlMode && (
          <>
            <div className="bar-wrapper mt-2 sm:mt-2.5">
              <div
                className="bar-fill pe-fill"
                style={{ width: `${pePercent}%` }}
              ></div>
            </div>
            <div className="status-inputs">
              <span>
                PE:{" "}
                <MestreStatInput
                  value={state.pe.current}
                  className="w-12 bg-transparent border-none text-white text-center font-bold font-mono outline-none"
                  onSave={(val) => updateStat("pe", "current", val)}
                />{" "}
                /{" "}
                <MestreStatInput
                  value={state.pe.max}
                  className="w-12 bg-transparent border-none text-white text-center font-bold font-mono outline-none"
                  onSave={(val) => updateStat("pe", "max", val)}
                  placeholder="Max PE"
                />
              </span>
            </div>
          </>
        )}

        {/* Modo Real L: Apenas barra de SM (Sanidade Mental) */}
        {isRlMode && (
          <>
            <div className="bar-wrapper mt-2 sm:mt-2.5">
              <div
                className="bar-fill sm-fill"
                style={{ width: `${smPercent}%` }}
                title={`Sanidade Mental: ${state.sm.current}/${state.sm.max}`}
              ></div>
            </div>
            <div className="status-inputs">
              <span title="Sanidade Mental">
                SM:{" "}
                <MestreStatInput
                  value={state.sm.current}
                  className="w-12 bg-transparent border-none text-white text-center font-bold font-mono outline-none"
                  onSave={(val) => updateStat("sm", "current", val)}
                />{" "}
                /{" "}
                <MestreStatInput
                  value={state.sm.max}
                  className="w-12 bg-transparent border-none text-white text-center font-bold font-mono outline-none"
                  onSave={(val) => updateStat("sm", "max", val)}
                  placeholder="Max SM"
                />
              </span>
            </div>
          </>
        )}
      </div>
    </div>
  );

  const handleRollAllInitiatives = () => {
    const syncedExtras = extraFichas
      .filter((f) => f.synchronized)
      .map((f) => ({
        id: `EXTRA_FICHA_${f.id}`,
        variables: f.variables || {},
      }));
    const combined = [...players, ...syncedExtras];
    const newInits: Record<string, number> = {};
    combined.forEach((p) => {
      const agl = p.variables?.["AGL"] || 0;
      const roll = Math.floor(Math.random() * 20) + 1;
      newInits[p.id] = roll + agl;
    });
    setInitiatives((prev) => ({ ...prev, ...newInits }));
  };

  const handleClearChatHistory = async () => {
    if (
      window.confirm(
        "Mestre, deseja realmente limpar todo o histórico do Chat da Mesa para todos os jogadores?",
      )
    ) {
      try {
        const currentRoom =
          localStorage.getItem("demologia_current_room_id") || "mesa_principal";
        await clearMessages(currentRoom, isOnline);
      } catch (err) {
        console.error("Erro ao limpar histórico do chat:", err);
      }
    }
  };

  const handleUploadOst = (file: File) => {
    if (file.size > 2 * 1024 * 1024) {
      alert("Arquivo muito grande, limite de 2MB. Comprima o MP3.");
      return;
    }
    setIsUploadingOst(true);
    const reader = new FileReader();
    reader.onload = async () => {
      let base64 = reader.result as string;
      if (base64.startsWith("data:;base64,")) {
        base64 = base64.replace("data:;base64,", "data:audio/mpeg;base64,");
      } else if (base64.startsWith("data:application/octet-stream;base64,")) {
        base64 = base64.replace(
          "data:application/octet-stream;base64,",
          "data:audio/mpeg;base64,",
        );
      }
      const ostId = `OST_FILE_${Date.now()}_${encodeURIComponent(file.name)}`;
      await supabase.from("players").upsert({
        id: ostId,
        data: { base64, name: file.name },
        updated_at: new Date().toISOString(),
      });
      fetchOsts();
      setIsUploadingOst(false);
    };
    reader.readAsDataURL(file);
  };

  const handlePlayOst = (ostId: string) => {
    const rawName = ostId.split("_").slice(3).join("_");
    const ostName = decodeURIComponent(rawName);

    if (globalOstState?.ostId === ostId) {
      const newIsPlaying = !globalOstState?.isPlaying;
      const stateData = {
        ...globalOstState,
        isPlaying: newIsPlaying,
      };
      setGlobalOstState(stateData);
      supabase
        .from("players")
        .upsert({
          id: "MASTER_STATE",
          data: { ost: stateData },
          updated_at: new Date().toISOString(),
        })
        .then(({ error }) => {
          if (error) console.error("MASTER_STATE upsert error:", error.message);
        });
      globalChannelRef.current
        ?.send({
          type: "broadcast",
          event: "ost_update",
          payload: stateData,
        })
        .catch(console.error);
    } else {
      const stateData = {
        ostId,
        name: ostName,
        isPlaying: true,
        volume: globalOstState?.volume ?? 1,
        fadeIn: globalOstState?.fadeIn ?? true,
        loop: globalOstState?.loop ?? true,
        resetTimestamp: Date.now(),
      };
      setGlobalOstState(stateData);
      supabase
        .from("players")
        .upsert({
          id: "MASTER_STATE",
          data: { ost: stateData },
          updated_at: new Date().toISOString(),
        })
        .then(({ error }) => {
          if (error) console.error("MASTER_STATE upsert error:", error.message);
        });
      globalChannelRef.current
        ?.send({
          type: "broadcast",
          event: "ost_update",
          payload: stateData,
        })
        .catch(console.error);
    }
  };

  const handleStopOst = () => {
    const stateData = {
      ...globalOstState,
      isPlaying: false,
    };
    setGlobalOstState(stateData);
    supabase
      .from("players")
      .upsert({
        id: "MASTER_STATE",
        data: { ost: stateData },
        updated_at: new Date().toISOString(),
      })
      .then(({ error }) => {
        if (error) console.error("MASTER_STATE stop error:", error.message);
      });
    globalChannelRef.current
      ?.send({
        type: "broadcast",
        event: "ost_update",
        payload: stateData,
      })
      .catch(console.error);
  };

  const handleDeleteOst = async (ostId: string) => {
    await supabase.from("players").delete().eq("id", ostId);
    if (globalOstState?.ostId === ostId) {
      await supabase.from("players").delete().eq("id", "MASTER_STATE");
      const emptyState = {
        ostId: null,
        isPlaying: false,
        volume: 1,
      };
      setGlobalOstState(emptyState);
      globalChannelRef.current
        ?.send({
          type: "broadcast",
          event: "ost_update",
          payload: emptyState,
        })
        .catch(console.error);
    }
    fetchOsts();
  };

  const handleVolumeChange = (newVol: number) => {
    const stateData = {
      ...globalOstState,
      volume: newVol,
    };
    setGlobalOstState(stateData);
    supabase
      .from("players")
      .upsert({
        id: "MASTER_STATE",
        data: { ost: stateData },
        updated_at: new Date().toISOString(),
      })
      .then(({ error }) => {
        if (error) console.error("MASTER_STATE volume error:", error.message);
      });
    globalChannelRef.current
      ?.send({
        type: "broadcast",
        event: "ost_update",
        payload: stateData,
      })
      .catch(console.error);
  };

  const handleFadeToggle = (fadeIn: boolean) => {
    const stateData = {
      ...globalOstState,
      fadeIn,
    };
    setGlobalOstState(stateData);
    supabase
      .from("players")
      .upsert({
        id: "MASTER_STATE",
        data: { ost: stateData },
        updated_at: new Date().toISOString(),
      })
      .then(({ error }) => {
        if (error) console.error("MASTER_STATE fade error:", error.message);
      });
    globalChannelRef.current
      ?.send({
        type: "broadcast",
        event: "ost_update",
        payload: stateData,
      })
      .catch(console.error);
  };

  const handleLoopToggle = (loop: boolean) => {
    const stateData = {
      ...globalOstState,
      loop,
    };
    setGlobalOstState(stateData);
    supabase
      .from("players")
      .upsert({
        id: "MASTER_STATE",
        data: { ost: stateData },
        updated_at: new Date().toISOString(),
      })
      .then(({ error }) => {
        if (error) console.error("MASTER_STATE loop error:", error.message);
      });
    globalChannelRef.current
      ?.send({
        type: "broadcast",
        event: "ost_update",
        payload: stateData,
      })
      .catch(console.error);
  };

  const handleApplyGameMode = async (target: "all" | string, newMode: GameMode) => {
    let updatedConfig: GameModeConfig;
    if (target === "all") {
      updatedConfig = {
        globalMode: newMode,
        playerModes: {},
      };
    } else {
      updatedConfig = {
        globalMode: gameModeConfig.globalMode || "demologia",
        playerModes: {
          ...(gameModeConfig.playerModes || {}),
          [target]: newMode,
        },
      };
    }

    setGameModeConfig(updatedConfig);
    try {
      localStorage.setItem("demologia_game_mode_config", JSON.stringify(updatedConfig));
    } catch {}

    try {
      await supabase.from("players").upsert({
        id: "MASTER_STATE",
        data: {
          ...(globalOstState ? { ost: globalOstState } : {}),
          modeConfig: updatedConfig,
        },
        updated_at: new Date().toISOString(),
      });
    } catch (err) {
      console.warn("Erro ao sincronizar MASTER_STATE com o novo modo:", err);
    }

    if (target !== "all") {
      try {
        const targetPlayer = players.find((p) => p.id === target);
        if (targetPlayer) {
          const currentData = targetPlayer.data || targetPlayer;
          await supabase.from("players").update({
            data: { ...currentData, mode: newMode },
          }).eq("id", target);
        }
      } catch (err) {
        console.warn("Erro ao atualizar modo individual no Supabase:", err);
      }
    }

    try {
      globalChannelRef.current?.send({
        type: "broadcast",
        event: "mode_update",
        payload: updatedConfig,
      });
    } catch (err) {
      console.warn("Erro no broadcast de mode_update:", err);
    }
  };

  const handleTogglePlayerMode = (playerId: string) => {
    const currentPMode = (gameModeConfig.playerModes && gameModeConfig.playerModes[playerId]) || gameModeConfig.globalMode || "demologia";
    const nextMode: GameMode = currentPMode === "rl" ? "demologia" : "rl";
    handleApplyGameMode(playerId, nextMode);
  };

  return (
    <div id="app" className="relative min-h-screen">
      <div 
        id="app-bg"
        className="fixed inset-0 z-[-15] pointer-events-none"
        style={{
          ...(customStyle.backgroundUrl
            ? {
                backgroundImage: isVideoBackground(customStyle.backgroundUrl)
                  ? "none"
                  : customStyle.backgroundFade !== undefined
                    ? `linear-gradient(rgba(0,0,0,${customStyle.backgroundFade / 100}), rgba(0,0,0,${customStyle.backgroundFade / 100})), url(${customStyle.backgroundUrl})`
                    : `url(${customStyle.backgroundUrl})`,
                backgroundSize: "cover",
                backgroundPosition: "center",
                transition: `background-image 0.5s ease-in-out, transform ${cutsceneState?.active ? (cutsceneState.duration || 6) + 's ease-out' : '1s ease-out'}`,
              }
            : activeMode === "rl"
            ? {
                backgroundImage: `linear-gradient(180deg, rgba(8, 8, 11, 0.35) 0%, rgba(13, 11, 18, 0.45) 45%, rgba(7, 7, 10, 0.60) 100%), url(${rlBgUrl})`,
                backgroundSize: "cover",
                backgroundPosition: "center bottom",
                backgroundColor: '#08080a',
                transition: `background-image 0.5s ease-in-out, transform ${cutsceneState?.active ? (cutsceneState.duration || 6) + 's ease-out' : '1s ease-out'}`,
              }
            : {
                backgroundColor: '#0a0a0a'
              }),
          transform: cutsceneState?.active ? `scale(${cutsceneState.zoom || 1})` : 'scale(1)'
        }}
      />
      {supabaseConfigError && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-md z-[9999] flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-[#111] border-2 border-blood-red/60 rounded-none max-w-2xl w-full p-6 md:p-8 shadow-[0_0_50px_rgba(255,0,0,0.3)] relative my-8">
            <button
              onClick={() => setSupabaseConfigError(null)}
              className="absolute top-4 right-4 text-gray-500 hover:text-white bg-white/5 hover:bg-white/10 p-2 rounded-full transition-all cursor-pointer"
              title="Fechar Aviso (Usar Modo Local)"
            >
              <X size={20} />
            </button>
            
            <div className="flex items-center gap-4 border-b border-blood-red/20 pb-4 mb-6">
              <div className="p-3 bg-blood-red/10 border border-blood-red/30 rounded-none text-blood-red animate-pulse">
                <Cloud size={32} />
              </div>
              <div>
                <h2 className="text-xl md:text-2xl font-black text-white uppercase tracking-wider">
                  Configuração ou Chave Supabase Inválida
                </h2>
                <p className="text-xs text-blood-red/85 font-mono mt-1">
                  {supabaseConfigError}
                </p>
              </div>
            </div>

            <div className="space-y-6 text-gray-300 text-sm leading-relaxed max-h-[60vh] overflow-y-auto pr-2 custom-scrollbar">
              <p>
                O aplicativo detectou que a conexão com o banco de dados do Supabase falhou (por exemplo: erro <strong>Invalid API key</strong>, chaves expiradas ou permissões do PostgreSQL pendentes). Para que a sincronização funcione em tempo real com o mestre, os jogadores e as músicas em múltiplos dispositivos, realize o passo a passo a seguir:
              </p>

              <div className="bg-yellow-500/10 border border-yellow-500/20 p-4 rounded-none">
                <h3 className="font-bold text-yellow-400 uppercase tracking-wider text-xs mb-2 flex items-center gap-2">
                  <span className="w-2 h-2 bg-yellow-400 rounded-full animate-pulse"></span>
                  🚨 CRÍTICO: Criar Tabela e Configurar SQL no Supabase
                </h3>
                <p className="text-xs text-gray-400 leading-relaxed mb-2">
                  Como você está usando um novo projeto do Supabase (ou mudou de servidor), é <strong>absolutamente necessário</strong> criar o banco de dados e as políticas de acesso. Caso contrário, você receberá erro de permissão ou tabela inexistente ("relation players does not exist"):
                </p>
                <ol className="mb-3 space-y-2 list-decimal list-inside text-xs text-gray-400">
                  <li>No painel do seu projeto Supabase, acesse a guia <strong>SQL Editor</strong> no menu lateral esquerdo.</li>
                  <li>Clique em <strong>New Query</strong> (Nova Consulta).</li>
                  <li>Copie e cole todo o código SQL abaixo no painel:</li>
                </ol>
                <div className="relative group mt-2 mb-3">
                  <pre className="text-[10px] text-gray-300 font-mono bg-black/60 p-3 rounded-none border border-[#222] overflow-x-auto max-h-[180px] whitespace-pre select-all">
{`-- 1. Criar a tabela de jogadores/dados do RPG
CREATE TABLE IF NOT EXISTS public.players (
    id TEXT PRIMARY KEY,
    data JSONB DEFAULT '{}'::jsonb
);

-- 2. Habilitar o RLS (Row Level Security)
ALTER TABLE public.players ENABLE ROW LEVEL SECURITY;

-- 3. Remover políticas antigas caso existam
DROP POLICY IF EXISTS "enable_read_all" ON public.players;
DROP POLICY IF EXISTS "enable_insert_all" ON public.players;
DROP POLICY IF EXISTS "enable_update_all" ON public.players;
DROP POLICY IF EXISTS "enable_delete_all" ON public.players;

-- 4. Criar políticas irrestritas para as fichas e mestre compartilhados
CREATE POLICY "enable_read_all" ON public.players FOR SELECT USING (true);
CREATE POLICY "enable_insert_all" ON public.players FOR INSERT WITH CHECK (true);
CREATE POLICY "enable_update_all" ON public.players FOR UPDATE USING (true);
CREATE POLICY "enable_delete_all" ON public.players FOR DELETE USING (true);

-- 5. Garantir permissões de acesso e leitura/escrita pública
GRANT ALL ON TABLE public.players TO anon;
GRANT ALL ON TABLE public.players TO authenticated;
GRANT ALL ON TABLE public.players TO service_role;`}
                  </pre>
                </div>
                <ol start={4} className="space-y-2 list-decimal list-inside text-xs text-gray-400">
                  <li>Clique no botão azul <strong>Run</strong> (no canto inferior direito ou use Ctrl+Enter/Cmd+Enter) para executar o código.</li>
                  <li>Pronto! O erro de permissão sumirá instantaneamente no Vercel e aqui no visualizador.</li>
                </ol>
              </div>

              <div className="bg-black/40 border border-[#333] p-4 rounded-none">
                <h3 className="font-bold text-white uppercase tracking-wider text-xs mb-3 flex items-center gap-2">
                  <span className="w-2 h-2 bg-blood-red rounded-full"></span>
                  Como Obter as Chaves no Supabase (Passo a Passo)
                </h3>
                <ol className="space-y-3 list-decimal list-inside text-xs text-gray-400">
                  <li>
                    Acesse o painel do seu projeto no Supabase em <a href="https://supabase.com" target="_blank" rel="noopener noreferrer" className="text-blood-red hover:underline font-semibold">supabase.com</a>.
                  </li>
                  <li>
                    Selecione seu projeto. No menu lateral esquerdo, clique no ícone de engrenagem <strong>(Settings / Configurações)</strong> e depois em <strong>API</strong>.
                  </li>
                  <li>
                    Na parte superior, você encontrará a seção <strong>Project API keys</strong> e <strong>Project URL</strong>.
                  </li>
                  <li>
                    Copie o valor de <strong>Project URL</strong> (ex: <code className="text-gray-300 font-mono bg-[#222] px-1 py-0.5 rounded-none">https://xxxx.supabase.co</code>) e adicione no painel lateral do AI Studio nos segredos (Secrets) com o nome:
                    <div className="mt-1 font-mono text-white bg-black/60 p-2 rounded-none border border-[#222] break-all select-all">
                      VITE_SUPABASE_URL
                    </div>
                  </li>
                  <li>
                    Copie a chave <strong>anon / public key</strong> (ex: <code className="text-gray-300 font-mono bg-[#222] px-1.5 py-0.5 rounded-none">eyJhbGciOi...</code>) e adicione no painel de segredos do AI Studio com o nome:
                    <div className="mt-1 font-mono text-white bg-black/60 p-2 rounded-none border border-[#222] break-all select-all">
                      VITE_SUPABASE_PUBLIC_ANON_KEY
                    </div>
                  </li>
                </ol>
              </div>

              <div className="bg-blood-red/5 border border-blood-red/20 p-4 rounded-none">
                <h3 className="font-bold text-white uppercase tracking-wider text-xs mb-2 flex items-center gap-2">
                  <span className="w-2 h-2 bg-blue-400 rounded-full animate-pulse"></span>
                  Como Criar/Mudar para um Servidor mais Perto (São Paulo)
                </h3>
                <p className="text-xs text-gray-400 leading-relaxed">
                  Criar o projeto em um servidor em São Paulo diminui drasticamente a latência e deixa as rolagens e atualizações de vida e energia instantâneas no Brasil:
                </p>
                <ol className="mt-2 space-y-2 list-decimal list-inside text-xs text-gray-400">
                  <li>Crie um novo projeto no site do Supabase clicando em <strong>New Project</strong>.</li>
                  <li>Na tela de criação, configure o nome, senha do banco, e na opção de <strong>Region</strong> escolha <strong>São Paulo (sa-east-1)</strong>.</li>
                  <li>Aguarde cerca de 2 minutos para o servidor iniciar.</li>
                  <li>Vá em <strong>Settings &gt; API</strong>, copie a nova URL e chave anônima, e substitua as anteriores nos segredos do AI Studio / Vercel.</li>
                </ol>
              </div>

              <div className="bg-[#1A1A1A] p-4 rounded-none border border-[#333]">
                <h3 className="font-bold text-white uppercase tracking-wider text-xs mb-2">
                  Onde Configuro as Chaves no Vercel ou AI Studio?
                </h3>
                <p className="text-xs text-gray-400 leading-relaxed">
                  Para o Vercel: adicione as Environment Variables chamadas <strong>VITE_SUPABASE_URL</strong> e <strong>VITE_SUPABASE_PUBLIC_ANON_KEY</strong> nas configurações do projeto na dashboard da Vercel e faça um novo Deploy. No AI Studio, configure no menu lateral/superior em Secrets.
                </p>
              </div>
            </div>

            <div className="mt-8 pt-4 border-t border-[#222] flex flex-col sm:flex-row gap-3 justify-end items-center">
              <span className="text-[10px] text-gray-500 font-mono text-center sm:text-left">
                Suas fichas e dados serão salvos somente no navegador enquanto usar sem Supabase.
              </span>
              <button
                onClick={() => setSupabaseConfigError(null)}
                className="w-full sm:w-auto bg-blood-red hover:bg-red-700 text-white font-bold uppercase tracking-widest text-[10px] px-6 py-2.5 rounded-none transition-colors cursor-pointer"
              >
                Entendi, Usar Offline
              </button>
            </div>
          </div>
        </div>
      )}
      {isVideoBackground(customStyle.backgroundUrl) && (
        <div 
          className="fixed inset-0 z-[-10] w-full h-full pointer-events-none overflow-hidden bg-black object-cover"
          style={{
             transform: cutsceneState?.active ? `scale(${cutsceneState.zoom || 1})` : 'scale(1)',
             transition: cutsceneState?.active ? `transform ${cutsceneState.duration || 6}s ease-out` : 'transform 1s ease-out'
          }}
        >
          <video
            src={customStyle.backgroundUrl}
            autoPlay
            muted
            playsInline
            className="w-full h-full object-cover"
            onEnded={() => {
              setCustomStyle((prev: any) => ({ ...prev, backgroundUrl: null }));
            }}
          />
          {customStyle.backgroundFade !== undefined && (
            <div
              className="absolute inset-0 transition-opacity duration-500"
              style={{
                backgroundColor: `rgba(0,0,0,${customStyle.backgroundFade / 100})`,
              }}
            />
          )}
        </div>
      )}
      <audio ref={audioRef} loop preload="auto" />
      
      {/* Fade Block Overlay */}
      {fadeBlockState !== null && (
        <div 
          className={`fixed inset-0 pointer-events-none transition-all ${fadeBlockState.layer === 'Tela' ? 'z-[999]' : 'z-[5]'}`}
          style={{
             backgroundColor: `rgba(0, 0, 0, ${fadeBlockState.active ? fadeBlockState.opacityEnd : fadeBlockState.opacityStart})`,
             transitionDuration: `${fadeBlockState.duration || 1}s`,
             transitionTimingFunction: fadeBlockState.fadeStyle === 'Exponencial' ? 'cubic-bezier(0.87, 0, 0.13, 1)' : fadeBlockState.fadeStyle === 'Quad' ? 'cubic-bezier(0.45, 0, 0.55, 1)' : 'linear',
          }}
        />
      )}

      {/* Cinematic Overlay */}
      <div className={`fixed inset-0 pointer-events-none flex flex-col justify-center items-center z-[500] transition-opacity duration-1000 ${cutsceneState?.active ? 'opacity-100' : 'opacity-0'}`}>
         {/* Cinematic Bars */}
         {cutsceneState?.bars && (
            <>
               <div className="absolute top-0 left-0 right-0 bg-black/95 transition-all duration-[2000ms]" style={{ height: cutsceneState?.active ? '15vh' : '0vh' }}></div>
               <div className="absolute bottom-0 left-0 right-0 bg-black/95 transition-all duration-[2000ms]" style={{ height: cutsceneState?.active ? '15vh' : '0vh' }}></div>
            </>
         )}
         {/* Title Display */}
         {(cutsceneState?.title || cutsceneState?.subtitle) && (
            <div className={`text-center drop-shadow-[0_0_20px_rgba(0,0,0,1)] max-w-4xl px-6 flex flex-col gap-4 ${cutsceneState?.fontFamily || 'font-archivo'}`}>
              {cutsceneState.title && (
                 <TypewriterText 
                    className={`text-5xl md:text-7xl lg:text-8xl font-black uppercase tracking-[0.1em] md:tracking-[0.2em] leading-none ${cutsceneState?.textShadow !== false ? '[text-shadow:4px_4px_0px_#000]' : ''}`} 
                    style={{ color: cutsceneState.textColor || '#FFFFFF' }}
                    text={cutsceneState.title}
                 />
              )}
              {cutsceneState.subtitle && (
                 <TypewriterText
                    className={`text-sm md:text-base lg:text-xl uppercase font-bold tracking-[0.3em] ${!cutsceneState?.fontFamily ? 'font-mono' : ''} ${cutsceneState?.textShadow !== false ? '[text-shadow:2px_2px_0px_#000]' : ''}`} 
                    style={{ color: cutsceneState.subtitleColor || (cutsceneState.textColor ? `${cutsceneState.textColor}aa` : '#ef4444') }}
                    text={cutsceneState.subtitle}
                    speed={30}
                 />
              )}
            </div>
         )}
      </div>

      <div className={`w-full min-h-screen transition-opacity duration-700 ${cutsceneState?.active ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}>
        {requiresInteraction && (
        <div className="fixed inset-0 bg-black/85 z-[300] flex flex-col items-center justify-center p-6 text-center backdrop-blur-sm">
          <div className="bg-[#0e0e12] border border-[#26262e] rounded-none p-6 sm:p-8 max-w-md w-full shadow-2xl relative overflow-hidden text-left">
            <div className="h-[3px] w-full bg-[var(--op-red)] absolute top-0 left-0" />
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-red-950/30 border border-red-800/40 flex items-center justify-center text-[var(--op-red-bright)] rounded-none shrink-0">
                <ShieldAlert size={20} className="animate-pulse" />
              </div>
              <div>
                <span className="text-[10px] font-mono uppercase font-bold tracking-widest text-[#72727e] block">
                  Permissão do Navegador
                </span>
                <h2 className="text-base font-bold text-white uppercase tracking-wider font-mono">
                  Conexão de Áudio Pendente
                </h2>
              </div>
            </div>

            <p className="text-xs text-[#8c8c96] font-mono leading-relaxed mb-6 border-b border-[#1c1c24] pb-4">
              O Mestre sincronizou uma trilha sonora. O navegador requer interação manual inicial para autorizar a reprodução contínua do áudio.
            </p>

            <button
              onClick={() => {
                setRequiresInteraction(false);
                audioRef.current?.play().catch(() => setRequiresInteraction(true));
              }}
              className="w-full bg-[var(--op-red)] hover:bg-[#a81d23] active:bg-[#781418] text-white font-mono font-bold text-xs uppercase tracking-widest py-3 px-6 rounded-none transition-colors cursor-pointer"
            >
              Autorizar e Sincronizar Áudio
            </button>
          </div>
        </div>
      )}

      {showUpdateLog && (
        <div className="fixed inset-0 bg-black/85 z-[250] flex flex-col items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-[#0e0e12] border border-[#26262e] rounded-none p-6 sm:p-8 shadow-2xl max-w-xl w-full relative overflow-hidden">
            <div className="h-[3px] w-full bg-[var(--op-red)] absolute top-0 left-0" />
            <button
              onClick={() => setShowUpdateLog(false)}
              className="absolute top-4 right-4 p-1.5 text-[#686872] hover:text-white hover:bg-white/[0.06] rounded-none transition-colors cursor-pointer"
              aria-label="Fechar changelog"
            >
              <X size={18} />
            </button>

            <div className="flex items-center gap-2 mb-1">
              <span className="text-[10px] font-mono uppercase font-bold tracking-widest text-[var(--op-red-bright)]">
                Histórico de Atualizações
              </span>
            </div>
            <h2 className="text-base sm:text-lg font-bold text-[#dedede] uppercase tracking-wider font-mono mb-4">
              Registro de Versão // Sistema
            </h2>

            <ul className="text-xs font-mono text-[#9a9aa4] list-none space-y-3 border-t border-[#1c1c24] pt-4">
              <li className="flex items-start gap-2">
                <span className="text-emerald-400 font-bold shrink-0">[+]</span>
                <span>
                  <strong className="text-white">Design System Quadrado & Moderno:</strong> Interface reestruturada com bordas sólidas, navegação YouTube drawer fluida e paleta oficial.
                </span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-blue-400 font-bold shrink-0">[+]</span>
                <span>
                  <strong className="text-white">Painel Linear de OSTs:</strong> Lista organizada de trilhas sonoras com fader preciso, status em tempo real e controle de upload seguro.
                </span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-purple-400 font-bold shrink-0">[+]</span>
                <span>
                  <strong className="text-white">Fichas Extras & Nuvem:</strong> Gerenciamento tático de NPCs e ameaças paranormais integrado ao combate e iniciativas.
                </span>
              </li>
            </ul>

            <div className="mt-6 pt-4 border-t border-[#181820] flex justify-end">
              <button
                type="button"
                onClick={() => setShowUpdateLog(false)}
                className="bg-[#16161c] hover:bg-[#202028] border border-[#2b2b34] hover:border-[#40404e] text-white font-mono text-xs uppercase tracking-wider py-2 px-5 rounded-none transition-colors cursor-pointer"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

      <PasswordAuthModal
        isOpen={showPasswordModal}
        onClose={() => {
          setShowPasswordModal(false);
          setPasswordInput("");
          setPasswordError(false);
        }}
        onSuccess={() => {
          setIsMestreAuth(true);
          setShowPasswordModal(false);
          setCurrentPage("mestre");
          setPasswordInput("");
        }}
      />

      <ModeTransitionEffect activeMode={activeMode} />

      <MasterGameModeModal
        isOpen={showModeModal}
        onClose={() => setShowModeModal(false)}
        currentGlobalMode={gameModeConfig.globalMode || "demologia"}
        playerModes={gameModeConfig.playerModes || {}}
        players={players}
        onApplyMode={handleApplyGameMode}
      />

      {playerToKick && (
        <div className="fixed inset-0 bg-black/85 z-[300] flex flex-col items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-[#0e0e12] border border-[#26262e] rounded-none p-6 sm:p-8 max-w-sm w-full relative overflow-hidden shadow-2xl">
            <div className="h-[3px] w-full bg-red-600 absolute top-0 left-0" />
            <h2 className="text-base font-bold text-white uppercase tracking-wider font-mono mb-2">
              Confirmar Desconexão
            </h2>
            <p className="text-xs text-[#8c8c96] font-mono leading-relaxed mb-6 border-b border-[#1c1c24] pb-4">
              Deseja desconectar a ficha de{" "}
              <strong className="text-white uppercase font-bold">
                {playerToKick.name}
              </strong>{" "}
              da sessão atual? A ficha poderá se reconectar caso o jogador clique em Conectar.
            </p>

            <div className="flex gap-2.5">
              <button
                type="button"
                onClick={() => setPlayerToKick(null)}
                className="flex-1 bg-transparent hover:bg-white/[0.05] border border-[#2c2c36] text-[#8e8e98] hover:text-white font-mono text-xs uppercase tracking-wider py-2.5 px-3 rounded-none transition-colors cursor-pointer text-center"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={async () => {
                  const id = playerToKick.id;
                  setPlayerToKick(null);
                  await supabase.from("players").delete().eq("id", id);
                }}
                className="flex-1 bg-red-950/60 hover:bg-red-900 border border-red-700/60 text-white font-mono text-xs uppercase tracking-wider font-bold py-2.5 px-3 rounded-none transition-colors cursor-pointer text-center"
              >
                Desconectar
              </button>
            </div>
          </div>
        </div>
      )}

      <NavigationSidebar
        currentPage={currentPage}
        setCurrentPage={setCurrentPage}
        menuOpen={menuOpen}
        setMenuOpen={setMenuOpen}
        isMestreAuth={isMestreAuth}
        setShowPasswordModal={setShowPasswordModal}
        setActiveFichaId={setActiveFichaId}
        setShowUpdateLog={setShowUpdateLog}
        gameMode={activeMode}
        onOpenModeModal={isMestreAuth ? () => setShowModeModal(true) : undefined}
      />

      {/* Botão de menu hambúrguer estilo YouTube no canto superior esquerdo */}
      <button
        type="button"
        onClick={() => setMenuOpen(!menuOpen)}
        className="fixed top-3 left-4 z-40 w-9 h-9 flex items-center justify-center bg-[#111114]/95 hover:bg-[#1c1c20] text-[#dedede] hover:text-white border border-[#2a2a30] rounded-none transition-colors cursor-pointer shadow-md focus-visible:outline-none focus-visible:border-[var(--op-red)]"
        aria-label="Abrir menu de navegação"
        title="Menu de navegação"
      >
        <Menu size={18} />
      </button>

      <main className="w-full transition-all min-h-screen">
        {(currentPage === "ficha" || currentPage === "ficha_extra") && (
        <div className="max-w-7xl mx-auto w-full pb-32 sm:pb-28 lg:pb-24 px-2.5 sm:px-4 lg:px-4 lg:py-6 flex flex-col lg:flex-row gap-3.5 sm:gap-4 lg:gap-8 items-start">
          
          {/* Left Column: HUD, Variables, Skills */}
          <div className="flex-1 w-full flex flex-col gap-3.5 sm:gap-4 lg:gap-6">
            <div className="hud-wrapper-box border border-[var(--op-border)] bg-[#111115]/50 backdrop-blur-md shadow-lg">
              {renderHud()}
            </div>

            <div className="section border border-[var(--op-border)] bg-[#111115]/50 backdrop-blur-md shadow-lg">
              <div className="section-title">Variáveis de Status</div>
              <div className="var-grid">
              {Object.entries(state.variables).map(([key, value]) => (
                <div className="var-box" key={key}>
                  <button
                    className="btn-remove-var"
                    onClick={() => removeVariable(key)}
                  >
                    X
                  </button>
                  <input
                    type="text"
                    defaultValue={key}
                    onBlur={(e) => renameVariable(key, e.target.value)}
                    onKeyDown={(e) =>
                      e.key === "Enter" && e.currentTarget.blur()
                    }
                  />
                  <MestreStatInput
                    value={(value as number) || 0}
                    onSave={(val) => updateVariable(key, val)}
                    className="w-12 bg-transparent text-center text-white font-mono outline-none border-b border-dashed border-[#555] focus:border-blood-red"
                  />
                </div>
              ))}
            </div>
            <button className="btn-add" onClick={addVariable}>
              + ADICIONAR VARIÁVEL
            </button>
          </div>

            {!isRlMode && (
              <div className="section skills-section border border-[var(--op-border)] bg-[#111115]/50 backdrop-blur-md shadow-lg">
                <div className="section-title">Habilidades (Skills)</div>
            <div className="skill-list">
              {state.skills.map((skill, index) => {
                const icon = icons[index % icons.length];
                const isActive = activeSkill === skill.id;
                return (
                  <div key={skill.id}>
                    <div
                      className="paper-bar"
                      onClick={() => toggleSkill(skill.id)}
                    >
                      <div className="skill-header">
                        <div className="skill-name-area">
                          <span
                            className="skill-icon"
                            style={
                              icon === "X"
                                ? { color: "#00a8ff", borderColor: "#00a8ff" }
                                : icon === "O"
                                  ? { color: "#d30000", borderColor: "#d30000" }
                                  : {}
                            }
                          >
                            {icon}
                          </span>
                          {skill.name || "Nova Skill"}
                        </div>
                        <div className="skill-cost">{skill.cost}PE</div>
                      </div>
                      <div
                        style={{
                          fontSize: "12px",
                          color: "#444",
                          marginTop: "5px",
                          marginLeft: "35px",
                        }}
                      >
                        {skill.desc || "Sem descrição"}
                      </div>
                    </div>
                    <div
                      className={`skill-details ${isActive && editingSkill !== skill.id ? "active" : "hidden"}`}
                      style={{
                        display:
                          isActive && editingSkill !== skill.id
                            ? "flex"
                            : "none",
                        background: "#0a0a0a",
                        padding: "12px",
                        gap: "8px",
                        alignItems: "center",
                        borderTop: "none",
                        borderRadius: "0 0 8px 8px",
                      }}
                    >
                      <button
                        className="bg-[#1a1a1a] border border-[#333] hover:bg-[#333] hover:border-gray-500 text-gray-400 hover:text-white uppercase font-bold text-xs tracking-wider rounded-none py-2 px-1 transition-all"
                        style={{ flex: 1 }}
                        onClick={() => {
                          setUseSkillModalId(skill.id);
                          setSkillModalTested(false);
                        }}
                      >
                        USAR
                      </button>
                      <button
                        className="bg-transparent hover:bg-[#1A1A1A] text-gray-600 hover:text-white p-2 rounded-none transition-colors border-none cursor-pointer"
                        onClick={() => setEditingSkill(skill.id)}
                      >
                        <Edit2 size={18} />
                      </button>
                    </div>

                    <div
                      className={`skill-details ${editingSkill === skill.id ? "active" : "hidden"}`}
                      style={{
                        display: editingSkill === skill.id ? "block" : "none",
                      }}
                    >
                      <input
                        type="text"
                        className="input-dark"
                        placeholder="Nome da Skill"
                        value={skill.name}
                        onChange={(e) =>
                          updateSkill(skill.id, "name", e.target.value)
                        }
                      />
                      <input
                        type="number"
                        className="input-dark"
                        placeholder="Custo PE"
                        value={skill.cost}
                        onChange={(e) =>
                          updateSkill(skill.id, "cost", e.target.value)
                        }
                      />
                      <textarea
                        className="input-dark"
                        placeholder="Descrição"
                        rows={2}
                        value={skill.desc}
                        onChange={(e) =>
                          updateSkill(skill.id, "desc", e.target.value)
                        }
                      />

                      <label className="flex items-center gap-2 text-[10px] text-gray-500 mb-2 cursor-pointer mt-2">
                        <input
                          type="checkbox"
                          checked={skill.needsTest || false}
                          onChange={(e) =>
                            updateSkill(skill.id, "needsTest", e.target.checked)
                          }
                          className="bg-black border-gray-700"
                        />
                        Necessita Teste (Exige Rolar Teste antes de Dano)
                      </label>

                      <div
                        style={{
                          display: "flex",
                          gap: "10px",
                          marginBottom: "10px",
                        }}
                      >
                        <div style={{ flex: 1 }}>
                          <label style={{ fontSize: "10px", color: "#888" }}>
                            Fórmula de Teste
                          </label>
                          <input
                            type="text"
                            className="input-dark mb-0"
                            placeholder="Ex: 1D20+OCU"
                            value={skill.test}
                            onChange={(e) =>
                              updateSkill(skill.id, "test", e.target.value)
                            }
                          />
                        </div>
                        <div style={{ flex: 1 }}>
                          <label style={{ fontSize: "10px", color: "#888" }}>
                            Fórmula de Dano
                          </label>
                          <input
                            type="text"
                            className="input-dark mb-0"
                            placeholder="Ex: 1D8+FOR"
                            value={skill.damage}
                            onChange={(e) =>
                              updateSkill(skill.id, "damage", e.target.value)
                            }
                          />
                        </div>
                      </div>

                      <div style={{ display: "flex", gap: "10px" }}>
                        <div style={{ flex: 1 }}>
                          <label style={{ fontSize: "10px", color: "#888" }}>
                            Salvar Teste Em Var: (Opcional)
                          </label>
                          <select
                            className="input-dark"
                            value={skill.testVar || ""}
                            onChange={(e) =>
                              updateSkill(skill.id, "testVar", e.target.value)
                            }
                          >
                            <option value="">-- Nenhuma --</option>
                            {Object.keys(state.variables).map((v) => (
                              <option key={v} value={v}>
                                {v}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div style={{ flex: 1 }}>
                          <label style={{ fontSize: "10px", color: "#888" }}>
                            Salvar Dano Em Var: (Opcional)
                          </label>
                          <select
                            className="input-dark"
                            value={skill.damageVar || ""}
                            onChange={(e) =>
                              updateSkill(skill.id, "damageVar", e.target.value)
                            }
                          >
                            <option value="">-- Nenhuma --</option>
                            {Object.keys(state.variables).map((v) => (
                              <option key={v} value={v}>
                                {v}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>

                      <div
                        style={{
                          display: "flex",
                          gap: "10px",
                          marginBottom: "10px",
                        }}
                      >
                        <div style={{ flex: 1 }}>
                          <label style={{ fontSize: "10px", color: "#888" }}>
                            Após Teste Setar Var:
                          </label>
                          <select
                            className="input-dark mb-1"
                            value={skill.testPostVar || ""}
                            onChange={(e) =>
                              updateSkill(
                                skill.id,
                                "testPostVar",
                                e.target.value,
                              )
                            }
                          >
                            <option value="">-- Nenhuma --</option>
                            {Object.keys(state.variables).map((v) => (
                              <option key={v} value={v}>
                                {v}
                              </option>
                            ))}
                          </select>
                          <input
                            type="text"
                            className="input-dark mb-0"
                            placeholder="Fórmula (Ex: AD-AD)"
                            value={skill.testPostFormula || ""}
                            onChange={(e) =>
                              updateSkill(
                                skill.id,
                                "testPostFormula",
                                e.target.value,
                              )
                            }
                          />
                        </div>
                        <div style={{ flex: 1 }}>
                          <label style={{ fontSize: "10px", color: "#888" }}>
                            Após Dano Setar Var:
                          </label>
                          <select
                            className="input-dark mb-1"
                            value={skill.damagePostVar || ""}
                            onChange={(e) =>
                              updateSkill(
                                skill.id,
                                "damagePostVar",
                                e.target.value,
                              )
                            }
                          >
                            <option value="">-- Nenhuma --</option>
                            {Object.keys(state.variables).map((v) => (
                              <option key={v} value={v}>
                                {v}
                              </option>
                            ))}
                          </select>
                          <input
                            type="text"
                            className="input-dark mb-0"
                            placeholder="Fórmula (Ex: AD-AD)"
                            value={skill.damagePostFormula || ""}
                            onChange={(e) =>
                              updateSkill(
                                skill.id,
                                "damagePostFormula",
                                e.target.value,
                              )
                            }
                          />
                        </div>
                      </div>

                      <div className="action-btns">
                        <button
                          className="btn-action test"
                          onClick={() => useSkill(skill, "test")}
                        >
                          TESTE
                        </button>
                        <button
                          className="btn-action damage"
                          onClick={() => useSkill(skill, "damage")}
                        >
                          DANO
                        </button>
                      </div>
                      <div
                        className="action-btns"
                        style={{ marginTop: "10px" }}
                      >
                        <button
                          className="btn-action"
                          style={{ background: "#500" }}
                          onClick={() => removeSkill(skill.id)}
                        >
                          EXCLUIR
                        </button>
                        <button
                          className="btn-action"
                          style={{ background: "#1A1A1A" }}
                          onClick={() => setEditingSkill(null)}
                        >
                          FECHAR
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
            {state.skills.length < 8 && (
              <button className="btn-add" onClick={addSkill}>
                + ADICIONAR SKILL
              </button>
            )}

            <div className="paper-bar tributo-bar" onClick={toggleTributo}>
              <div className="tributo-header">
                {state.tributo.name || "Nome do Tributo"}
              </div>
              <div style={{ fontSize: "14px", fontWeight: "bold" }}>
                {state.tributo.desc}
              </div>
            </div>

            <div
              className={`skill-details ${activeTributo ? "active" : ""}`}
              style={{ background: "#1a1a1a", padding: "15px" }}
            >
              <label
                style={{
                  display: "block",
                  marginBottom: "5px",
                  fontSize: "12px",
                  color: "#aaa",
                }}
              >
                Nome do Tributo
              </label>
              <input
                type="text"
                className="input-dark"
                value={state.tributo.name}
                onChange={(e) => updateTributo("name", e.target.value)}
              />
              <label
                style={{
                  display: "block",
                  marginBottom: "5px",
                  fontSize: "12px",
                  color: "#aaa",
                }}
              >
                Descrição
              </label>
              <textarea
                className="input-dark"
                rows={2}
                value={state.tributo.desc}
                onChange={(e) => updateTributo("desc", e.target.value)}
              />
              <label
                style={{
                  display: "block",
                  marginBottom: "5px",
                  fontSize: "12px",
                  color: "#aaa",
                }}
              >
                Efeito Passivo
              </label>
              <textarea
                className="input-dark"
                rows={2}
                value={state.tributo.passivo}
                onChange={(e) => updateTributo("passivo", e.target.value)}
              />
              <label
                style={{
                  display: "block",
                  marginBottom: "5px",
                  fontSize: "12px",
                  color: "#aaa",
                }}
              >
                Efeito Ativo
              </label>
              <textarea
                className="input-dark"
                rows={2}
                value={state.tributo.ativo}
                onChange={(e) => updateTributo("ativo", e.target.value)}
              />
            </div>
          </div>
          )}
          </div> {/* End Left Column */}

          {/* Right Column: Inventory, System/Menu */}
          <div className="w-full lg:w-[400px] xl:w-[450px] flex flex-col gap-3.5 sm:gap-4 lg:gap-6 shrink-0">

          <div className="section border border-[var(--op-border)] bg-[#111115]/50 backdrop-blur-md shadow-lg">
            <div className="section-title">Inventário</div>
            <div className="inv-grid">
              {[0, 1, 2, 3, 4, 5].map((i) => (
                <input
                  key={i}
                  type="text"
                  className="inv-slot"
                  placeholder={`Slot ${i + 1}`}
                  value={state.inventory[i]}
                  onChange={(e) => updateInventory(i, e.target.value)}
                />
              ))}
            </div>
          </div>

          <div className="section border border-[var(--op-border)] bg-[#111115]/50 backdrop-blur-md shadow-lg">
            <div className="section-title">Sistema Demologia</div>
            <div className="menu-grid">
              <button className="btn-menu" onClick={exportData}>
                Exportar JSON
              </button>
              <button className="btn-menu" onClick={importData}>
                Importar JSON
              </button>
              <button
                className="btn-menu"
                onClick={clearHistory}
                style={{ color: "#ffaa00" }}
              >
                {confirmClear ? "CONFIRME" : "Limpar Histórico"}
              </button>
              <button
                className="btn-menu"
                onClick={resetData}
                style={{ color: "var(--blood-red)" }}
              >
                {confirmReset ? "CONFIRME O RESET" : "Resetar Ficha"}
              </button>
            </div>
          </div>
          </div> {/* End Right Column */}

        </div>
      )}

      {currentPage === "oraculo" && (
        <div className="pb-36 max-w-xl mx-auto px-3 sm:px-4 pt-4 sm:pt-6 space-y-3.5 sm:space-y-4">
          <QuickDiceSection
            quickDiceQty={quickDiceQty}
            setQuickDiceQty={setQuickDiceQty}
            onRoll={executeRoll}
            lastRoll={lastRollResult}
          />
          <RollingTerminal
            diceInput={diceInput}
            setDiceInput={setDiceInput}
            onRoll={processManualRoll}
            history={state.history}
            historyRef={historyRef}
            isShaking={isShaking}
            title="Terminal de Rolagem"
          />
          <FormulaShortcutsSection
            onRollFormula={executeRoll}
            setDiceInput={setDiceInput}
            diceInput={diceInput}
          />
        </div>
      )}

      {currentPage === "grid" && (
        <TabletopGrid
          supabase={supabase}
          globalChannelRef={globalChannelRef}
          userUid={userUid}
          players={players}
          isMestreAuth={isMestreAuth}
          globalGridState={globalGridState}
          setGlobalGridState={setGlobalGridState}
        />
      )}

      {currentPage === "conexao" && (
        <>
          <div className="p-4 pt-8 min-h-screen text-center flex flex-col items-center justify-center max-w-lg mx-auto pb-20">
            <h2 className="text-3xl font-bold text-blood-red uppercase tracking-widest mb-4">
              Conexão da Ficha
            </h2>
            <p className="text-gray-400 text-sm mb-8">
              Ativar a conexão compartilha sua ficha em tempo real com o Mestre.
              Se você for desconectado, reative-a aqui.
            </p>
            <button
              onClick={() => {
                if (!isOnline) {
                  setIsOnline(true);
                  if (userUid) {
                    supabase
                      .from("players")
                      .upsert({
                        id: userUid,
                        data: state,
                        updated_at: new Date().toISOString(),
                      })
                      .then(({ error }) => {
                        if (error)
                          console.warn(
                            "Error syncing to Supabase (manual):",
                            error.message,
                          );
                      });
                  }
                } else {
                  setIsOnline(false);
                  if (userUid) {
                    supabase
                      .from("players")
                      .delete()
                      .eq("id", userUid)
                      .then(null, (err: any) =>
                        console.warn(
                          "Erro de rede ao desconectar do Supabase:",
                          err.message,
                        ),
                      );
                  }
                }
              }}
              className={`w-full py-4 px-8 text-lg font-bold uppercase tracking-wider rounded-none transition-all cursor-pointer border ${isOnline ? "bg-green-900 border-green-500 hover:bg-green-800 text-white shadow-[0_0_15px_rgba(34,197,94,0.3)]" : "bg-[#1a0505] border-blood-red hover:bg-[#300505] text-blood-red shadow-[0_0_15px_rgba(211,0,0,0.3)]"}`}
            >
              {isOnline ? "CONECTADO A SESSÃO" : "DESCONECTADO DA SESSÃO"}
            </button>
            <p className="text-[10px] text-gray-500 mt-4 uppercase">
              Para alterar o status apenas aperte o botão
            </p>
          </div>
        </>
      )}

      {currentPage === "chat" && (
        <div className="min-h-screen w-full flex flex-col justify-start items-center pt-12 sm:pt-14 px-1 sm:px-4 pb-4">
          <div className="w-full max-w-4xl flex-1 flex flex-col h-[calc(100vh-4rem)]">
            <ChatContainer
              currentUser={{
                id: userUid || "local_player",
                name: state?.name || (isMestreAuth ? "Mestre" : "Agente"),
                isMaster: isMestreAuth,
              }}
              onlineCount={players.length + 1}
              isOnline={isOnline}
              onBackToFicha={() => setCurrentPage("ficha")}
            />
          </div>
        </div>
      )}

      {currentPage === "mestre" && (
        <div className="min-h-screen pb-20 font-sans">
          <MasterHeaderBar
            activeTab={mestreTab}
            setActiveTab={setMestreTab}
            playersCount={players.length}
            extrasCount={extraFichas.length}
            isOstPlaying={Boolean(globalOstState?.isPlaying)}
            onRollInitiative={handleRollAllInitiatives}
            onReturnToMainSheet={() => {
              setActiveFichaId("main");
              setCurrentPage("ficha");
            }}
            viewMode={mestreViewMode}
            setViewMode={setMestreViewMode}
            onClearChatHistory={handleClearChatHistory}
            currentGlobalMode={gameModeConfig.globalMode}
            onOpenModeModal={() => setShowModeModal(true)}
          />

          {mestreTab === "fichas" && (
            <MasterPlayersView
              players={players}
              extraFichas={extraFichas}
              initiatives={initiatives}
              viewMode={mestreViewMode}
              onClearChatHistory={handleClearChatHistory}
              playerModes={gameModeConfig.playerModes || {}}
              currentGlobalMode={gameModeConfig.globalMode}
              onTogglePlayerMode={handleTogglePlayerMode}
              onKickPlayer={(player) => setPlayerToKick(player)}
              onOpenInteractiveSheet={(sheetId) => {
                setActiveFichaId(sheetId);
                setCurrentPage("ficha_extra");
              }}
              onUpdateStat={(player, stat, val, isExtraSheet, rawExtraSheetId) => {
                if (isExtraSheet && rawExtraSheetId) {
                  setExtraFichas((prev) =>
                    prev.map((f) =>
                      f.id === rawExtraSheetId
                        ? { ...f, [stat]: { ...f[stat], current: val }, last_local_edit: Date.now() }
                        : f
                    )
                  );
                } else {
                  setPlayers((current) =>
                    current.map((pl) =>
                      pl.id === player.id ? { ...pl, [stat]: { ...pl[stat], current: val } } : pl
                    )
                  );
                }
                editPlayerStatExact(player, stat, val);
              }}
            />
          )}

          {mestreTab === "ost" && (
            <MasterOstPanel
              ostList={ostList}
              globalOstState={globalOstState}
              setGlobalOstState={setGlobalOstState}
              audioRef={audioRef}
              requiresInteraction={requiresInteraction}
              setRequiresInteraction={setRequiresInteraction}
              fetchOsts={fetchOsts}
              supabase={supabase}
              globalChannelRef={globalChannelRef}
            />
          )}

          {mestreTab === "extras" && (
            <MasterExtrasView
              extraFichas={extraFichas}
              setExtraFichas={setExtraFichas}
              defaultState={defaultState}
              activeFichaId={activeFichaId}
              setActiveFichaId={setActiveFichaId}
              setCurrentPage={setCurrentPage}
              setMestreTab={setMestreTab}
              toggleFichaSync={toggleFichaSync}
              supabase={supabase}
              currentGlobalMode={gameModeConfig.globalMode || "demologia"}
            />
          )}
        </div>
      )}
      </main>

      {useSkillModalId !== null &&
        (() => {
          const modalSkill = state.skills.find(
            (s: any) => s.id === useSkillModalId,
          );
          if (!modalSkill) return null;
          return (
            <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4">
              <div className="bg-[#0a0a0a] border border-[#333] rounded-none w-full max-w-sm flex flex-col p-4 gap-4 shadow-[0_0_20px_rgba(0,0,0,0.8)]">
                <div className="flex justify-between items-center border-b border-[#1A1A1A] pb-2">
                  <h3 className="font-bold text-blood-red uppercase tracking-widest">
                    {modalSkill.name || "Nova Skill"}
                  </h3>
                  <button
                    onClick={() => setUseSkillModalId(null)}
                    className="text-gray-500 hover:text-white"
                  >
                    <X size={20} />
                  </button>
                </div>

                <div className="h-48 overflow-y-auto bg-[#1A1A1A] p-3 border border-[#1A1A1A] rounded-none text-[13px] text-[#aaa] flex flex-col shadow-[inset_0_0_10px_#000]">
                  {state.history.length > 0 ? (
                    state.history
                      .slice(0, 10)
                      .map((h, i) => (
                        <div
                          key={i}
                          className="log-entry"
                          dangerouslySetInnerHTML={{ __html: h }}
                        />
                      ))
                  ) : (
                    <span className="opacity-50 italic">
                      Nenhum log de rolagem.
                    </span>
                  )}
                </div>

                <div className="flex gap-2">
                  {modalSkill.test?.trim() !== "" && (
                    <button
                      className="flex-1 bg-[#1a1a1a] border border-[#333] hover:bg-[#333] hover:border-gray-500 text-gray-400 hover:text-white uppercase font-bold text-[10px] tracking-wider rounded-none py-3 transition-all cursor-pointer"
                      onClick={() => {
                        useSkill(modalSkill, "test");
                        setSkillModalTested(true);
                      }}
                    >
                      ROLA TESTE (-{modalSkill.cost || 0} PE)
                    </button>
                  )}
                  {modalSkill.damage?.trim() !== "" && (
                    <button
                      className="flex-1 bg-gradient-to-r from-[#900] to-[var(--blood-red)] text-white hover:brightness-125 uppercase font-bold text-[10px] tracking-wider rounded-none py-3 transition-all border-none cursor-pointer"
                      onClick={() => {
                        if (modalSkill.needsTest && !skillModalTested) {
                          addToHistory(
                            '<span style="color: #ffaa00;">Realize o teste antes do dano!</span>',
                          );
                          return;
                        }
                        useSkill(modalSkill, "damage");
                      }}
                    >
                      ROLA DANO (0 PE)
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })()}
      </div>
    </div>
  );
}
