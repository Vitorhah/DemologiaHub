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
} from "lucide-react";
import { supabase, supabaseUrl, supabaseAnonKey } from "./lib/supabase";

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

const defaultState = {
  name: "Ocultista",
  hp: { current: 100, max: 100 },
  pe: { current: 60, max: 60 },
  variables: { OCU: 4, FOR: 1 } as Record<string, number>,
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

import { SkillBuilder } from "./SkillBuilder";
import { TabletopGrid } from "./components/TabletopGrid";

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
    "fichas" | "ost" | "eventos" | "extras"
  >("fichas");
  const [globalGridState, setGlobalGridState] = useState<any>({ objects: [] });
  const [deletingFichaId, setDeletingFichaId] = useState<string | null>(null);

  const [savedEvents, setSavedEvents] = useState<any[]>(() => {
    try {
      const cached = localStorage.getItem("local_master_events");
      if (cached) {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch (e) {
      console.error("Falha ao parsear eventos salvos localmente:", e);
    }
    return [];
  });
  const savedEventsRef = useRef<any[]>([]);
  useEffect(() => {
    savedEventsRef.current = savedEvents;
  }, [savedEvents]);
  const [activeEventToggles, setActiveEventToggles] = useState<
    Record<string, boolean>
  >({});
  const [editingEvent, setEditingEvent] = useState<any>(null);
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
  const activeEventsRef = useRef<Record<string, boolean>>({});

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
                if (
                  prev.hp.current !== newHp.current ||
                  prev.pe.current !== newPe.current ||
                  prev.hp.max !== newHp.max ||
                  prev.pe.max !== newPe.max
                ) {
                  return { ...prev, hp: newHp, pe: newPe };
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
              if (
                prev.hp.current !== newHp.current ||
                prev.pe.current !== newPe.current ||
                prev.hp.max !== newHp.max ||
                prev.pe.max !== newPe.max
              ) {
                return { ...prev, hp: newHp, pe: newPe };
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

      supabase
        .from("players")
        .select("data")
        .eq("id", "MASTER_EVENTS")
        .single()
        .then(
          ({ data, error }) => {
            if (!error && data?.data?.events && data.data.events.length > 0) {
              setSavedEvents(data.data.events);
              localStorage.setItem(
                "local_master_events",
                JSON.stringify(data.data.events),
              );
            } else {
              const backup = localStorage.getItem("local_master_events");
              if (backup) {
                try {
                  const parsed = JSON.parse(backup);
                  if (parsed && parsed.length > 0) {
                    setSavedEvents(parsed);
                    supabase
                      .from("players")
                      .upsert({
                        id: "MASTER_EVENTS",
                        data: { events: parsed },
                        updated_at: new Date().toISOString(),
                      })
                      .then(({ error }) => {
                        if (error)
                          console.warn(
                            "Falha ao restaurar MASTER_EVENTS:",
                            error.message,
                          );
                      });
                  }
                } catch (e) {
                  console.error("Erro ao processar backup do LocalStorage:", e);
                }
              }
            }
          },
          (err) => {
            console.warn("Fetch master events request failed:", err.message);
            const backup = localStorage.getItem("local_master_events");
            if (backup) {
              try {
                const parsed = JSON.parse(backup);
                if (parsed && parsed.length > 0) setSavedEvents(parsed);
              } catch (e) {}
            }
          },
        )
        .then(
          () => {},
          (err) => {
            console.warn("Fetch master events network error:", err.message);
            const backup = localStorage.getItem("local_master_events");
            if (backup) {
              try {
                const parsed = JSON.parse(backup);
                if (parsed && parsed.length > 0) setSavedEvents(parsed);
              } catch (e) {}
            }
          },
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
          if (newRecord?.id === "TABLETOP_GRID" && newRecord?.data) {
            setGlobalGridState((prev: any) => {
              if (JSON.stringify(prev) !== JSON.stringify(newRecord.data))
                return newRecord.data;
              return prev;
            });
          }
          if (newRecord?.id === "MASTER_EVENTS" && newRecord?.data?.events) {
            setSavedEvents(newRecord.data.events);
            if (newRecord.data.events.length > 0) {
              localStorage.setItem(
                "local_master_events",
                JSON.stringify(newRecord.data.events),
              );
            }
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
      .on("broadcast", { event: "grid_broadcast" }, ({ payload }) => {
        if (payload) {
          setGlobalGridState((prev: any) => {
            if (JSON.stringify(prev) !== JSON.stringify(payload))
              return payload;
            return prev;
          });
        }
      })
      .on("broadcast", { event: "builder_event" }, async ({ payload }) => {
        if (
          payload &&
          (payload.target === "all" || payload.target === userUidRef.current)
        ) {
          const { eventId, isToggle, action } = payload;
          const blocks =
            payload.blocks ||
            savedEventsRef.current.find((e) => e.id === eventId)?.blocks;

          if (!blocks) return;

          if (isToggle) {
            if (action === "stop") {
              activeEventsRef.current[eventId] = false;
              setActiveEventToggles((prev) => ({ ...prev, [eventId]: false }));
              return; // Just stop it
            } else if (action === "start") {
              activeEventsRef.current[eventId] = true;
              setActiveEventToggles((prev) => ({ ...prev, [eventId]: true }));
            }
          }

          const execBlocks = async () => {
            let loopStack: number[] = [];
            let windingDown = false;

            for (let i = 0; i < blocks.length; i++) {
              // Check if active changed
              if (
                isToggle &&
                !windingDown &&
                activeEventsRef.current[eventId] === false
              ) {
                let foundEnd = false;
                let depth = 0;
                // Find the outermost loop_end or the next loop_end? Let's just find the next one for simplicity.
                for (let j = i; j < blocks.length; j++) {
                  if (blocks[j].type === "loop_end") {
                    i = j;
                    foundEnd = true;
                    break;
                  }
                }
                if (foundEnd) {
                  windingDown = true;
                  continue;
                } else {
                  break;
                }
              }

              const block = blocks[i];
              if (block.type === "aguarde") {
                const waitTime = (block.value || 0) * 1000;
                const steps = waitTime / 100;
                for (let s = 0; s < steps; s++) {
                  if (
                    isToggle &&
                    !windingDown &&
                    activeEventsRef.current[eventId] === false
                  ) {
                    break;
                  }
                  await new Promise((r) => setTimeout(r, 100));
                }
              } else if (block.type === "mudar_fundo") {
                setCustomStyle((prev: any) => ({
                  ...prev,
                  backgroundUrl: block.value,
                }));
              } else if (block.type === "fundo_original") {
                setCustomStyle((prev: any) => ({
                  ...prev,
                  backgroundUrl: null,
                }));
              } else if (block.type === "imagem_fade") {
                setCustomStyle((prev: any) => ({
                  ...prev,
                  backgroundFade: block.value,
                }));
              } else if (block.type === "play_ost") {
                const rawName = block.ostId
                  ? block.ostId.split("_").slice(3).join("_")
                  : "";
                const ostName = rawName ? decodeURIComponent(rawName) : "OST";
                const newState = {
                  ostId: block.ostId,
                  name: ostName,
                  isPlaying: true,
                  volume: block.volume ?? 1,
                  fadeTime: block.fadeTime ?? 1,
                  resetTimestamp: block.resetBeforePlay
                    ? Date.now()
                    : undefined,
                };
                setGlobalOstState(newState);
                supabase
                  .from("players")
                  .upsert({
                    id: "MASTER_STATE",
                    data: { ost: newState },
                    updated_at: new Date().toISOString(),
                  })
                  .then(({ error }) => {
                    if (error) console.error(error);
                  });
                globalChannelRef.current
                  ?.send({
                    type: "broadcast",
                    event: "ost_update",
                    payload: newState,
                  })
                  .catch(console.error);
              } else if (block.type === "stop_ost") {
                const currentOstState = globalOstStateRef.current;
                if (currentOstState) {
                  const newState = {
                    ...currentOstState,
                    isPlaying: false,
                    fadeTime: block.fadeTime ?? 1,
                  };
                  setGlobalOstState(newState);
                  supabase
                    .from("players")
                    .upsert({
                      id: "MASTER_STATE",
                      data: { ost: newState },
                      updated_at: new Date().toISOString(),
                    })
                    .then(({ error }) => {
                      if (error) console.error(error);
                    });
                  globalChannelRef.current
                    ?.send({
                      type: "broadcast",
                      event: "ost_update",
                      payload: newState,
                    })
                    .catch(console.error);
                }
              } else if (block.type === "cutscene") {
                setCutsceneState({ ...block, active: true });
                if (activeFichaId !== "main") {
                   setActiveFichaId("main");
                   setCurrentPage("ficha");
                } else if (currentPage !== "ficha") {
                   setCurrentPage("ficha");
                }
                if (block.ostId) {
                  const rawName = block.ostId ? block.ostId.split("_").slice(3).join("_") : "";
                  const ostName = rawName ? decodeURIComponent(rawName) : "OST";
                  setGlobalOstState({
                    ostId: block.ostId,
                    name: ostName,
                    isPlaying: true,
                    volume: 1,
                    fadeTime: 1,
                  });
                }
                const waitTime = (block.duration || 6) * 1000;
                const steps = waitTime / 100;
                for (let s = 0; s < steps; s++) {
                  if (
                    isToggle &&
                    !windingDown &&
                    activeEventsRef.current[eventId] === false
                  ) {
                    break;
                  }
                  await new Promise((r) => setTimeout(r, 100));
                }
                setCutsceneState({ ...block, active: false });
                // We don't nullify immediately to allow fade out animation. Let the component handle it or do it after 2s.
                setTimeout(() => {
                   setCutsceneState(null);
                }, 2000);
              } else if (block.type === "fade_block") {
                setFadeBlockState({ ...block, active: false });
                await new Promise((r) => setTimeout(r, 50));
                setFadeBlockState({ ...block, active: true });
                
                const waitTime = (block.duration || 1) * 1000;
                const steps = waitTime / 100;
                for (let s = 0; s < steps; s++) {
                  if (
                    isToggle &&
                    !windingDown &&
                    activeEventsRef.current[eventId] === false
                  ) {
                    break;
                  }
                  await new Promise((r) => setTimeout(r, 100));
                }
              } else if (block.type === "open_board") {
                if (block.delay && block.delay > 0) {
                  const waitTime = block.delay * 1000;
                  const steps = waitTime / 100;
                  for (let s = 0; s < steps; s++) {
                    if (isToggle && !windingDown && activeEventsRef.current[eventId] === false) break;
                    await new Promise((r) => setTimeout(r, 100));
                  }
                }
                
                if (block.aba) {
                   if (block.aba === 'null') {
                     setCurrentPage('null' as any);
                   } else if (block.aba === 'ficha') {
                     setActiveFichaId('main');
                     setCurrentPage('ficha');
                     setShowUpdateLog(false);
                   } else if (block.aba === 'log') {
                     setShowUpdateLog(true);
                   } else {
                     setCurrentPage(block.aba as any);
                     setShowUpdateLog(false);
                   }
                }
              } else if (block.type === "loop") {
                loopStack.push(i);
              } else if (block.type === "loop_end") {
                if (loopStack.length > 0) {
                  if (windingDown) {
                    loopStack.pop();
                  } else {
                    const startIdx = loopStack[loopStack.length - 1]; // peek
                    await new Promise((r) => setTimeout(r, 50));
                    i = startIdx; // jump back
                  }
                }
              }
            }

            // When done
            if (isToggle) {
              activeEventsRef.current[eventId] = false;
            }
          };
          execBlocks();
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

  const processManualRoll = () => {
    vibrate(50);
    const roll = parseAndRoll(diceInput);
    if (roll) {
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

  const updateStat = (
    stat: "hp" | "pe",
    field: "current" | "max",
    val: number,
  ) => {
    if (stat === "hp" && field === "current") vibrate(100);
    setState((prev: any) => ({
      ...prev,
      [stat]: { ...prev[stat], [field]: val || 0 },
    }));
  };

  const removeVariable = (key: string) => {
    const newVars = { ...state.variables };
    delete newVars[key];
    setState({ ...state, variables: newVars });
  };

  const updateVariable = (key: string, val: number) => {
    setState((prev: any) => ({
      ...prev,
      variables: { ...prev.variables, [key]: val || 0 },
    }));
  };

  const renameVariable = (oldKey: string, newKeyRaw: string) => {
    const newKey = newKeyRaw.trim().toUpperCase();
    if (newKey !== oldKey && newKey !== "") {
      const newVars = { ...state.variables };
      newVars[newKey] = newVars[oldKey];
      delete newVars[oldKey];
      setState({ ...state, variables: newVars });
    }
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
    stat: "hp" | "pe",
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
  useEffect(() => {
    const handleFirstInteraction = () => {
      if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen().catch(() => {});
      }
    };
    document.addEventListener("click", handleFirstInteraction, { once: true });
    return () => document.removeEventListener("click", handleFirstInteraction);
  }, []);

  const pePercent =
    Math.max(0, Math.min(100, (state.pe.current / state.pe.max) * 100)) || 0;
  const icons = ["X", "O", "∆", "□"];

  const renderHud = () => (
    <div className="hud-container relative pointer-events-auto">
      <img
        className="eye-logo"
        src="https://i.ibb.co/xq2KhP1v/3-Sem-T-tulo.png"
        alt="Símbolo Demologia"
      />
      <div className="status-numbers relative">
        <input
          className="bg-transparent text-white font-bold text-center text-4xl uppercase outline-none w-full drop-shadow-[0_0_10px_rgba(211,0,0,0.6)]"
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
      </div>

      <div className="status-bars">
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
            />
          </span>
        </div>

        <div className="bar-wrapper" style={{ marginTop: "15px" }}>
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
            />
          </span>
        </div>
      </div>
    </div>
  );

  return (
    <div id="app" className="relative min-h-screen">
      <div 
        id="app-bg"
        className="fixed inset-0 z-[-15]"
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
                backgroundAttachment: "fixed",
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
          <div className="bg-[#111] border-2 border-blood-red/60 rounded-2xl max-w-2xl w-full p-6 md:p-8 shadow-[0_0_50px_rgba(255,0,0,0.3)] relative my-8">
            <button
              onClick={() => setSupabaseConfigError(null)}
              className="absolute top-4 right-4 text-gray-500 hover:text-white bg-white/5 hover:bg-white/10 p-2 rounded-full transition-all cursor-pointer"
              title="Fechar Aviso (Usar Modo Local)"
            >
              <X size={20} />
            </button>
            
            <div className="flex items-center gap-4 border-b border-blood-red/20 pb-4 mb-6">
              <div className="p-3 bg-blood-red/10 border border-blood-red/30 rounded-xl text-blood-red animate-pulse">
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
                O aplicativo detectou que a conexão com o banco de dados do Supabase falhou (por exemplo: erro <strong>Invalid API key</strong>, chaves expiradas ou permissões do PostgreSQL pendentes). Para que a sincronização funcione em tempo real com o mestre, os jogadores, as músicas e eventos em múltiplos dispositivos, realize o passo a passo a seguir:
              </p>

              <div className="bg-yellow-500/10 border border-yellow-500/20 p-4 rounded-xl">
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
                  <pre className="text-[10px] text-gray-300 font-mono bg-black/60 p-3 rounded-lg border border-[#222] overflow-x-auto max-h-[180px] whitespace-pre select-all">
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

              <div className="bg-black/40 border border-[#333] p-4 rounded-xl">
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
                    Copie o valor de <strong>Project URL</strong> (ex: <code className="text-gray-300 font-mono bg-[#222] px-1 py-0.5 rounded">https://xxxx.supabase.co</code>) e adicione no painel lateral do AI Studio nos segredos (Secrets) com o nome:
                    <div className="mt-1 font-mono text-white bg-black/60 p-2 rounded border border-[#222] break-all select-all">
                      VITE_SUPABASE_URL
                    </div>
                  </li>
                  <li>
                    Copie a chave <strong>anon / public key</strong> (ex: <code className="text-gray-300 font-mono bg-[#222] px-1.5 py-0.5 rounded">eyJhbGciOi...</code>) e adicione no painel de segredos do AI Studio com o nome:
                    <div className="mt-1 font-mono text-white bg-black/60 p-2 rounded border border-[#222] break-all select-all">
                      VITE_SUPABASE_PUBLIC_ANON_KEY
                    </div>
                  </li>
                </ol>
              </div>

              <div className="bg-blood-red/5 border border-blood-red/20 p-4 rounded-xl">
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

              <div className="bg-[#1A1A1A] p-4 rounded-xl border border-[#333]">
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
                className="w-full sm:w-auto bg-blood-red hover:bg-red-700 text-white font-bold uppercase tracking-widest text-[10px] px-6 py-2.5 rounded-lg transition-colors cursor-pointer"
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
                    className={`text-sm md:text-base lg:text-xl uppercase font-bold tracking-[0.3em] font-mono ${cutsceneState?.textShadow !== false ? '[text-shadow:2px_2px_0px_#000]' : ''}`} 
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
        <div className="fixed inset-0 bg-black/90 z-[300] flex flex-col items-center justify-center p-6 text-center backdrop-blur-sm">
          <ShieldAlert
            size={64}
            className="text-blood-red mb-4 animate-pulse"
          />
          <h2 className="text-2xl font-bold text-white uppercase tracking-widest mb-2">
            Conexão de Áudio Pendente
          </h2>
          <p className="text-gray-400 text-sm mb-8 max-w-sm">
            O Mestre iniciou a trilha sonora, mas o navegador requer que você
            interaja com a página para liberar o som.
          </p>
          <button
            onClick={() => {
              setRequiresInteraction(false);
              audioRef.current
                ?.play()
                .catch(() => setRequiresInteraction(true));
            }}
            className="bg-blood-red hover:bg-red-800 text-white font-bold py-4 px-8 rounded uppercase tracking-wider transition-all shadow-[0_0_20px_rgba(211,0,0,0.5)] cursor-pointer"
          >
            Permitir Áudio
          </button>
        </div>
      )}

      {showUpdateLog && (
        <div className="fixed inset-0 bg-black/90 z-[250] flex flex-col items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-[#0a0a0a] border border-[#1A1A1A] p-8 rounded shadow-[0_0_30px_rgba(255,0,0,0.15)] max-w-xl w-full relative">
            <button
              onClick={() => setShowUpdateLog(false)}
              className="absolute top-4 right-4 text-gray-500 hover:text-white"
            >
              <X size={20} />
            </button>
            <h2 className="text-xl font-bold text-blood-red uppercase tracking-widest mb-4">
              Creative Update
            </h2>
            <ul className="text-gray-400 text-sm list-none space-y-2">
              <li>
                <span className="text-emerald-500 font-bold mr-2">+</span>{" "}
                <b>Blocos de Áudio (OST):</b> O SkillBuilder agora permite usar
                blocos para Tocar OST e Parar OST com suporte a Fade In / Out,
                Volume.
              </li>
              <li>
                <span className="text-purple-500 font-bold mr-2">+</span>{" "}
                <b>Bloco de Fundo:</b> Novo bloco adicionado para aplicar Imagem
                com efeito de Fade no SkillBuilder.
              </li>
              <li>
                <span className="text-blue-500 font-bold mr-2">✓</span>{" "}
                <b>Sincronização:</b> Sistema de OST do Mestre e SkillBuilder
                agora sincronizam a música entre si perfeitamente.
              </li>
              <li>
                <span className="text-yellow-500 font-bold mr-2">🛠</span>{" "}
                <b>Correções:</b> Ajustes na transição suave de Fade das
                Músicas, no controle do Slider de Volume da Dashboard do Mestre
                para refletir corretamente o volume e fixes para as OSTs
                reiniciarem de forma inconsistente.
              </li>
            </ul>
          </div>
        </div>
      )}

      {showPasswordModal && (
        <div className="fixed inset-0 bg-black/90 z-[250] flex flex-col items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-[#0a0a0a] border border-[#1A1A1A] p-8 rounded shadow-[0_0_30px_rgba(255,0,0,0.15)] max-w-sm w-full relative">
            <button
              onClick={() => {
                setShowPasswordModal(false);
                setPasswordInput("");
                setPasswordError(false);
              }}
              className="absolute top-4 right-4 text-gray-500 hover:text-white"
            >
              <X size={20} />
            </button>
            <h2 className="text-xl font-bold text-blood-red uppercase tracking-widest mb-2">
              Acesso Restrito
            </h2>
            <p className="text-gray-500 text-xs mb-6 uppercase tracking-wider">
              Digite a senha do Mestre
            </p>

            <input
              type="password"
              name="mestre_senha_aleatoria_123"
              autoComplete="off"
              spellCheck={false}
              autoFocus
              className={`w-full bg-[#1A1A1A] text-white border ${passwordError ? "border-red-500 text-red-500" : "border-[#333]"} p-3 rounded outline-none mb-4 focus:border-blood-red transition-colors font-mono text-center tracking-widest`}
              value={passwordInput}
              onChange={(e) => {
                setPasswordInput(e.target.value);
                setPasswordError(false);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  if (passwordInput === import.meta.env.VITE_MESTRE_PASSWORD) {
                    setIsMestreAuth(true);
                    setShowPasswordModal(false);
                    setCurrentPage("mestre");
                    setPasswordInput("");
                  } else {
                    setPasswordError(true);
                  }
                }
              }}
            />
            {passwordError && (
              <p className="text-red-500 text-[10px] text-center mb-4 uppercase font-bold tracking-wider">
                Senha Incorreta
              </p>
            )}
            <button
              onClick={() => {
                if (passwordInput === import.meta.env.VITE_MESTRE_PASSWORD) {
                  setIsMestreAuth(true);
                  setShowPasswordModal(false);
                  setCurrentPage("mestre");
                  setPasswordInput("");
                } else {
                  setPasswordError(true);
                }
              }}
              className="w-full bg-blood-red hover:bg-red-800 text-white font-bold py-3 rounded uppercase tracking-wider transition-colors cursor-pointer"
            >
              Desbloquear
            </button>
          </div>
        </div>
      )}

      {playerToKick && (
        <div className="fixed inset-0 bg-black/90 z-[300] flex flex-col items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-[#0a0a0a] border border-[#333] p-8 rounded-xl shadow-[0_0_30px_rgba(255,0,0,0.15)] max-w-sm w-full relative">
            <h2 className="text-xl font-bold text-blood-red uppercase tracking-widest mb-2">
              Atenção!
            </h2>
            <p className="text-gray-400 text-sm mb-6">
              Tem certeza que deseja desconectar a ficha{" "}
              <strong className="text-white uppercase tracking-wider">
                {playerToKick.name}
              </strong>
              ?
            </p>

            <div className="flex gap-4">
              <button
                onClick={() => setPlayerToKick(null)}
                className="flex-1 bg-[#1A1A1A] hover:bg-[#2a2a2a] border border-[#333] text-gray-300 hover:text-white font-bold py-3 px-4 rounded-lg uppercase tracking-wider text-xs transition-colors cursor-pointer"
              >
                Cancelar
              </button>
              <button
                onClick={async () => {
                  const id = playerToKick.id;
                  setPlayerToKick(null);
                  await supabase.from("players").delete().eq("id", id);
                }}
                className="flex-1 bg-red-900/50 hover:bg-red-800 border border-red-500/50 text-white font-bold py-3 px-4 rounded-lg uppercase tracking-wider text-xs transition-colors cursor-pointer"
              >
                Confirmar
              </button>
            </div>
          </div>
        </div>
      )}

      {menuOpen && (
        <div className="fixed inset-0 bg-black/80 z-50 flex">
          <div className="w-64 bg-[#0a0a0a] border-r border-[#1A1A1A] h-full p-4 flex flex-col gap-4">
            <button
              onClick={() => setMenuOpen(false)}
              className="self-end text-gray-500 hover:text-white"
            >
              <X size={24} />
            </button>
            <h2 className="text-xl font-bold text-blood-red mb-4 uppercase tracking-widest border-b border-[#1A1A1A] pb-2">
              Menu
            </h2>
            <button
              onClick={() => {
                setActiveFichaId("main");
                setCurrentPage("ficha");
                setMenuOpen(false);
              }}
              className={`text-left text-lg font-bold uppercase p-2 rounded ${currentPage === "ficha" ? "bg-[#1A1A1A] text-white" : "text-gray-500 hover:bg-[#1A1A1A]"}`}
            >
              Ficha
            </button>

            <button
              onClick={() => {
                setCurrentPage("conexao");
                setMenuOpen(false);
              }}
              className={`text-left text-lg font-bold uppercase p-2 rounded ${currentPage === "conexao" ? "bg-[#1A1A1A] text-white" : "text-gray-500 hover:bg-[#1A1A1A]"}`}
            >
              Conexão
            </button>
            <button
              onClick={() => {
                if (!isMestreAuth) {
                  setShowPasswordModal(true);
                  setMenuOpen(false);
                } else {
                  setCurrentPage("mestre");
                  setMenuOpen(false);
                }
              }}
              className={`text-left text-lg font-bold uppercase p-2 rounded ${currentPage === "mestre" ? "bg-[#1A1A1A] text-white" : "text-gray-500 hover:bg-[#1A1A1A]"}`}
            >
              Mestre
            </button>
          </div>
          <div className="flex-1" onClick={() => setMenuOpen(false)} />
        </div>
      )}

      {currentPage !== "mestre" && currentPage !== "null" ? (
        <div className="fixed bottom-0 left-0 w-full h-14 bg-black/95 backdrop-blur-md border-t border-[#1A1A1A] flex flex-row items-center z-[100] shadow-[0_-5px_20px_rgba(0,0,0,0.8)] overflow-x-auto overflow-y-hidden no-scrollbar">
          <button
            onClick={() => {
              setActiveFichaId("main");
              setCurrentPage("ficha");
            }}
            className={`flex flex-col items-center justify-center shrink-0 min-w-[120px] h-full transition-colors ${currentPage === "ficha" ? "text-blood-red" : "text-gray-500 hover:text-white hover:bg-white/5"}`}
          >
            <span className="text-xs uppercase font-bold tracking-widest leading-none mt-1">
              Ficha
            </span>
          </button>

          <div className="w-[1px] h-8 shrink-0 bg-[#1A1A1A]"></div>
          <button
            onClick={() => setCurrentPage("conexao")}
            className={`flex flex-col items-center justify-center shrink-0 min-w-[120px] h-full transition-colors ${currentPage === "conexao" ? "text-blood-red" : "text-gray-500 hover:text-white hover:bg-white/5"}`}
          >
            <span className="text-xs uppercase font-bold tracking-widest leading-none mt-1">
              Conexão
            </span>
          </button>
          <div className="w-[1px] h-8 shrink-0 bg-[#1A1A1A]"></div>
          <button
            onClick={() => {
              window.scrollTo(0, 0);
              if (!isMestreAuth) {
                setShowPasswordModal(true);
              } else {
                setCurrentPage("mestre");
              }
            }}
            className={`flex flex-col items-center justify-center shrink-0 min-w-[120px] h-full transition-colors ${currentPage === "mestre" ? "text-blood-red" : "text-gray-500 hover:text-white hover:bg-white/5"}`}
          >
            <span className="text-xs uppercase font-bold tracking-widest leading-none mt-1">
              Mestre
            </span>
          </button>
          <div className="w-[1px] h-8 shrink-0 bg-[#1A1A1A]"></div>
          <button
            onClick={() => {
              if (!document.fullscreenElement) {
                document.documentElement.requestFullscreen().catch(() => {});
              } else {
                if (document.exitFullscreen) {
                  document.exitFullscreen().catch(() => {});
                }
              }
            }}
            className="flex flex-col items-center justify-center shrink-0 min-w-[120px] h-full text-gray-500 hover:text-white hover:bg-white/5 transition-colors"
          >
            <Maximize size={18} className="mb-1" />
            <span className="text-xs uppercase font-bold tracking-widest leading-none mt-1">
              Tela
            </span>
          </button>
          <div className="w-[1px] h-8 shrink-0 bg-[#1A1A1A]"></div>
          <button
            onClick={() => setShowUpdateLog(true)}
            className="flex flex-col items-center justify-center shrink-0 min-w-[120px] h-full text-gray-500 hover:text-white hover:bg-white/5 transition-colors"
          >
            <FileText size={18} className="mb-1" />
            <span className="text-xs uppercase font-bold tracking-widest leading-none mt-1">
              Logs
            </span>
          </button>
          <div className="w-[1px] h-8 shrink-0 bg-[#1A1A1A]"></div>
        </div>
      ) : currentPage === "mestre" ? (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 w-[95%] max-w-lg h-15 bg-black/95 backdrop-blur-md border border-blood-red/30 rounded-2xl flex flex-row items-center justify-around z-[130] shadow-[0_8px_32px_rgba(0,0,0,0.8)] px-2">
          <button
            onClick={() => {
              setActiveFichaId("main");
              setCurrentPage("ficha");
            }}
            className="flex flex-col items-center justify-center flex-1 h-full py-1 text-gray-500 hover:text-white hover:bg-white/5 rounded-xl transition-all duration-200 cursor-pointer"
          >
            <FileText size={16} className="text-gray-500 group-hover:text-white" />
            <span className="text-[9px] uppercase font-bold tracking-wider mt-0.5">
              Player
            </span>
          </button>

          <div className="w-[1px] h-6 bg-blood-red/10 shrink-0"></div>

          <button
            onClick={() => setMestreTab("fichas")}
            className={`flex flex-col items-center justify-center flex-1 h-full py-1 transition-all duration-200 rounded-xl cursor-pointer ${
              mestreTab === "fichas"
                ? "text-blood-red bg-blood-red/10 font-black scale-105"
                : "text-gray-500 hover:text-white hover:bg-white/5"
            }`}
          >
            <Users size={16} className={mestreTab === "fichas" ? "text-blood-red" : "text-gray-500"} />
            <span className="text-[9px] uppercase font-bold tracking-wider mt-0.5">
              Players
            </span>
          </button>

          <div className="w-[1px] h-6 bg-blood-red/10 shrink-0"></div>

          <button
            onClick={() => setMestreTab("ost")}
            className={`flex flex-col items-center justify-center flex-1 h-full py-1 transition-all duration-200 rounded-xl cursor-pointer ${
              mestreTab === "ost"
                ? "text-blood-red bg-blood-red/10 font-black scale-105"
                : "text-gray-500 hover:text-white hover:bg-white/5"
            }`}
          >
            <Music size={16} className={mestreTab === "ost" ? "text-blood-red" : "text-gray-500"} />
            <span className="text-[9px] uppercase font-bold tracking-wider mt-0.5">
              OST
            </span>
          </button>

          <div className="w-[1px] h-6 bg-blood-red/10 shrink-0"></div>

          <button
            onClick={() => setMestreTab("eventos")}
            className={`flex flex-col items-center justify-center flex-1 h-full py-1 transition-all duration-200 rounded-xl cursor-pointer ${
              mestreTab === "eventos"
                ? "text-blood-red bg-blood-red/10 font-black scale-105"
                : "text-gray-500 hover:text-white hover:bg-white/5"
            }`}
          >
            <Zap size={16} className={mestreTab === "eventos" ? "text-blood-red" : "text-gray-500"} />
            <span className="text-[9px] uppercase font-bold tracking-wider mt-0.5">
              Eventos
            </span>
          </button>

          <div className="w-[1px] h-6 bg-blood-red/10 shrink-0"></div>

          <button
            onClick={() => setMestreTab("extras")}
            className={`flex flex-col items-center justify-center flex-1 h-full py-1 transition-all duration-200 rounded-xl cursor-pointer ${
              mestreTab === "extras"
                ? "text-blood-red bg-blood-red/10 font-black scale-105"
                : "text-gray-500 hover:text-white hover:bg-white/5"
            }`}
          >
            <Ghost size={16} className={mestreTab === "extras" ? "text-blood-red" : "text-gray-500"} />
            <span className="text-[9px] uppercase font-bold tracking-wider mt-0.5">
              Extras
            </span>
          </button>
        </div>
      ) : null}

      {(currentPage === "ficha" || currentPage === "ficha_extra") && (
        <>
          {renderHud()}

          <div className="section">
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

          <div className="section">
            <div className="section-title">Oráculo (Rolagem)</div>
            <div className="dice-panel">
              <div className="dice-input-group">
                <input
                  type="text"
                  className="dice-input"
                  placeholder="Ex: 1d20+OCU"
                  value={diceInput}
                  onChange={(e) => setDiceInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && processManualRoll()}
                />
                <button className="btn-roll" onClick={processManualRoll}>
                  ROLAR
                </button>
              </div>
              <div
                className="dice-history"
                ref={historyRef}
                style={isShaking ? { animation: "shake 0.3s ease" } : {}}
              >
                {state.history.map((h, i) => (
                  <div
                    key={i}
                    className="log-entry"
                    dangerouslySetInnerHTML={{ __html: h }}
                  />
                ))}
              </div>
            </div>
          </div>

          <div className="section">
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
                        className="bg-[#1a1a1a] border border-[#333] hover:bg-[#333] hover:border-gray-500 text-gray-400 hover:text-white uppercase font-bold text-xs tracking-wider rounded py-2 px-1 transition-all"
                        style={{ flex: 1 }}
                        onClick={() => {
                          setUseSkillModalId(skill.id);
                          setSkillModalTested(false);
                        }}
                      >
                        USAR
                      </button>
                      <button
                        className="bg-transparent hover:bg-[#1A1A1A] text-gray-600 hover:text-white p-2 rounded transition-colors border-none cursor-pointer"
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

          <div className="section">
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

          <div className="section">
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
        </>
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
              className={`w-full py-4 px-8 text-lg font-bold uppercase tracking-wider rounded transition-all cursor-pointer border ${isOnline ? "bg-green-900 border-green-500 hover:bg-green-800 text-white shadow-[0_0_15px_rgba(34,197,94,0.3)]" : "bg-[#1a0505] border-blood-red hover:bg-[#300505] text-blood-red shadow-[0_0_15px_rgba(211,0,0,0.3)]"}`}
            >
              {isOnline ? "CONECTADO A SESSÃO" : "DESCONECTADO DA SESSÃO"}
            </button>
            <p className="text-[10px] text-gray-500 mt-4 uppercase">
              Para alterar o status apenas aperte o botão
            </p>
          </div>
        </>
      )}

      {currentPage === "mestre" && (
        <>
          <div className="min-h-screen pb-20 font-sans">
            <div className="flex flex-col items-center justify-center text-center mb-10 pt-12 relative z-10">
              <div className="relative">
                <div className="absolute inset-0 blur-3xl bg-blood-red/20 rounded-full scale-150"></div>
                <img
                  className="w-24 h-24 object-contain opacity-80"
                  src="https://i.ibb.co/xq2KhP1v/3-Sem-T-tulo.png"
                  alt="Símbolo Demologia"
                />
              </div>
              <h2 className="text-3xl font-black text-white mt-4 uppercase tracking-[0.3em] drop-shadow-[0_0_10px_rgba(255,0,0,0.5)]">
                Modo Mestre
              </h2>
              <p className="text-blood-red/70 text-[10px] font-mono tracking-[0.3em] mt-2 uppercase border border-blood-red/30 bg-blood-red/10 px-3 py-1 rounded-full">
                Acesso Restrito
              </p>
            </div>

            {mestreTab === "fichas" ? (
              <>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-6xl mx-auto px-4">
                  {(() => {
                    const syncedExtrasAsPlayers = extraFichas
                      .filter((f) => f.synchronized)
                      .map((f) => ({
                        id: `EXTRA_FICHA_${f.id}`,
                        name: f.name || "Ficha Extra",
                        hp: f.hp || { current: 0, max: 100 },
                        pe: f.pe || { current: 0, max: 100 },
                        variables: f.variables || {},
                        history: f.history || (f.notes ? [`<span style="color: #666;">Nota: ${f.notes}</span>`] : []),
                        isExtraSheet: true,
                        rawExtraSheetId: f.id,
                      }));
                    const combined = [...players, ...syncedExtrasAsPlayers];
                    return combined
                      .sort(
                        (a, b) =>
                          (initiatives[b.id] ?? -1) - (initiatives[a.id] ?? -1),
                      )
                      .map((p) => (
                        <div
                          key={p.id}
                          className={`bg-black/80 backdrop-blur-md border ${
                            p.isExtraSheet ? "border-blue-500/30 shadow-[0_0_15px_rgba(59,130,246,0.1)]" : "border-[#333]"
                          } hover:border-[#444] rounded-xl p-5 relative overflow-hidden transition-all shadow-lg`}
                        >
                          <div className={`absolute top-0 left-0 w-full h-1 ${p.isExtraSheet ? "bg-gradient-to-r from-blue-500 to-transparent" : "bg-gradient-to-r from-blood-red to-transparent"} opacity-50`}></div>
                          <div className="flex justify-between items-start mb-4 relative z-10">
                            <div>
                              <div className="text-white font-bold text-xl uppercase tracking-widest leading-tight">
                                {p.name}
                              </div>
                              <div className="flex items-center gap-1.5 mt-1.5">
                                {p.isExtraSheet ? (
                                  <>
                                    <span className="w-1.5 h-1.5 bg-blue-400 rounded-full animate-pulse"></span>
                                    <span className="text-blue-400 font-mono text-[9px] uppercase tracking-wider">
                                      Ficha Extra Sincronizada
                                    </span>
                                  </>
                                ) : (
                                  <>
                                    <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse"></span>
                                    <span className="text-gray-400 font-mono text-[9px] uppercase tracking-wider">
                                      Jogador Conectado
                                    </span>
                                  </>
                                )}
                              </div>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              {initiatives[p.id] !== undefined && (
                                <div
                                  className={`border px-3 py-1 flex flex-col items-center justify-center rounded-lg min-w-[48px] ${
                                    p.isExtraSheet
                                      ? "bg-blue-500/10 border-blue-500/30 text-blue-400 shadow-[0_0_10px_rgba(59,130,246,0.1)]"
                                      : "bg-blood-red/10 border-blood-red/30 text-blood-red shadow-[0_0_10px_rgba(255,0,0,0.1)]"
                                  }`}
                                  title="Iniciativa"
                                >
                                  <span className="text-[9px] uppercase opacity-75 font-semibold tracking-wider mb-0.5">
                                    Inic
                                  </span>
                                  <span className="font-black text-lg leading-none">
                                    {initiatives[p.id]}
                                  </span>
                                </div>
                              )}
                              {p.isExtraSheet ? (
                                <button
                                  onClick={() => {
                                    setActiveFichaId(p.rawExtraSheetId);
                                    setCurrentPage("ficha_extra");
                                  }}
                                  className="text-blue-400 hover:text-white bg-blue-500/10 hover:bg-blue-500/30 p-2 rounded-lg transition-all flex items-center justify-center cursor-pointer"
                                  title="Abrir Ficha Interativa"
                                >
                                  <Maximize size={16} />
                                </button>
                              ) : (
                                <button
                                  onClick={() => setPlayerToKick(p)}
                                  className="text-[#555] hover:text-red-500 bg-transparent hover:bg-red-500/10 p-2 rounded-full transition-all flex items-center justify-center relative z-20 cursor-pointer"
                                  title="Desconectar Jogador"
                                >
                                  <Trash2 size={18} />
                                </button>
                              )}
                            </div>
                          </div>

                          <div className="flex gap-4 bg-[#1A1A1A]/80 border border-[#1A1A1A] rounded-lg p-4 relative z-10">
                            <div className="flex-1">
                              <div className="text-[10px] text-gray-500 mb-1 max-w-fit uppercase tracking-widest border-b border-[#333] pb-1">
                                HP
                              </div>
                              <div className="flex items-baseline gap-1 mt-2">
                                <MestreStatInput
                                  value={p.hp?.current ?? 0}
                                  onSave={(val) => {
                                    if (p.isExtraSheet) {
                                      setExtraFichas((prev) =>
                                        prev.map((f) =>
                                          f.id === p.rawExtraSheetId
                                            ? {
                                                ...f,
                                                hp: { ...f.hp, current: val },
                                                last_local_edit: Date.now(),
                                              }
                                            : f
                                        )
                                      );
                                    } else {
                                      setPlayers((current) =>
                                        current.map((pl) =>
                                          pl.id === p.id
                                            ? {
                                                ...pl,
                                                hp: { ...pl.hp, current: val },
                                              }
                                            : pl,
                                        ),
                                      );
                                    }
                                    editPlayerStatExact(p, "hp", val);
                                  }}
                                  className="w-10 bg-transparent outline-none border-b border-[#333] focus:border-green-500 text-green-500 font-bold text-2xl font-mono text-left"
                                />
                                <span className="text-gray-600 text-xs font-mono">
                                  / {p.hp?.max}
                                </span>
                              </div>
                            </div>
                            <div className="w-[1px] bg-[#1A1A1A]"></div>
                            <div className="flex-1">
                              <div className="text-[10px] text-gray-500 mb-1 max-w-fit uppercase tracking-widest border-b border-[#333] pb-1">
                                PE
                              </div>
                              <div className="flex items-baseline gap-1 mt-2">
                                <MestreStatInput
                                  value={p.pe?.current ?? 0}
                                  onSave={(val) => {
                                    if (p.isExtraSheet) {
                                      setExtraFichas((prev) =>
                                        prev.map((f) =>
                                          f.id === p.rawExtraSheetId
                                            ? {
                                                ...f,
                                                pe: { ...f.pe, current: val },
                                                last_local_edit: Date.now(),
                                              }
                                            : f
                                        )
                                      );
                                    } else {
                                      setPlayers((current) =>
                                        current.map((pl) =>
                                          pl.id === p.id
                                            ? {
                                                ...pl,
                                                pe: { ...pl.pe, current: val },
                                              }
                                            : pl,
                                        ),
                                      );
                                    }
                                    editPlayerStatExact(p, "pe", val);
                                  }}
                                  className="w-10 bg-transparent outline-none border-b border-[#333] focus:border-blue-500 text-blue-500 font-bold text-2xl font-mono text-left"
                                />
                                <span className="text-gray-600 text-xs font-mono">
                                  / {p.pe?.max}
                                </span>
                              </div>
                            </div>
                          </div>

                          {p.history && p.history.length > 0 && (
                            <div className="mt-4 pt-3 border-t border-[#1A1A1A] relative z-10">
                              <div className="text-[9px] text-gray-600 uppercase tracking-wider mb-1 font-mono">
                                Último Status/Ação
                              </div>
                              <div
                                className="text-xs text-gray-400 line-clamp-2 leading-relaxed"
                                dangerouslySetInnerHTML={{ __html: p.history[0] }}
                              ></div>
                            </div>
                          )}
                        </div>
                      ));
                  })()}
                  {players.length === 0 && !extraFichas.some(f => f.synchronized) && (
                    <div className="col-span-full flex flex-col items-center justify-center py-20 text-[#555]">
                      <Dices size={48} className="mb-4 opacity-50" />
                      <p className="font-bold uppercase tracking-widest text-lg">
                        Nenhum Jogador ou Ficha Sincronizada
                      </p>
                      <p className="text-xs mt-2 max-w-xs text-center leading-relaxed">
                        Aguardando conexão das fichas dos jogadores ou de fichas extras da Nuvem de Personagens.
                      </p>
                    </div>
                  )}
                </div>

                {(() => {
                  const syncedExtras = extraFichas.filter((f) => f.synchronized).map((f) => ({
                    id: `EXTRA_FICHA_${f.id}`,
                    variables: f.variables || {},
                  }));
                  const combined = [...players, ...syncedExtras];
                  
                  return combined.length > 0 ? (
                    <button
                      onClick={() => {
                        const newInits: Record<string, number> = {};
                        combined.forEach((p) => {
                          const agl = p.variables?.["AGL"] || 0;
                          const roll = Math.floor(Math.random() * 20) + 1;
                          newInits[p.id] = roll + agl;
                        });
                        setInitiatives({ ...initiatives, ...newInits });
                      }}
                      className="fixed bottom-24 right-6 w-16 h-16 bg-blood-red hover:bg-red-700 rounded-full flex items-center justify-center shadow-[0_0_30px_rgba(255,0,0,0.5)] border border-red-400/30 hover:scale-110 active:scale-95 transition-all z-[150] cursor-pointer group"
                      title="Rolar Iniciativas"
                    >
                      <Dices
                        size={28}
                        className="text-white group-hover:rotate-12 transition-transform"
                        strokeWidth={1.5}
                      />
                    </button>
                  ) : null;
                })()}
              </>
            ) : mestreTab === "ost" ? (
              <div className="max-w-2xl mx-auto flex flex-col gap-6 px-4">
                <div className="bg-black/80 backdrop-blur-md border border-[#333] rounded-xl p-6 shadow-lg relative overflow-hidden">
                  <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blood-red to-transparent opacity-50"></div>
                  <div className="flex items-center gap-3 mb-4 mt-2">
                    <Music size={24} className="text-blood-red" />
                    <h3 className="text-xl font-bold text-white uppercase tracking-widest">
                      Painel Trilha Sonora
                    </h3>
                  </div>
                  <p className="text-gray-400 text-xs mb-6 max-w-sm leading-relaxed">
                    Importe arquivos .mp3 para sincronizar e reproduzir nas
                    fichas de todos os jogadores simultaneamente.
                  </p>

                  <div className="flex gap-4 items-center mb-8 border-b border-[#1A1A1A] pb-8">
                    <label
                      className={`w-full border border-dashed hover:border-blood-red transition-all cursor-pointer rounded-xl py-8 flex flex-col items-center justify-center gap-2 ${isUploadingOst ? "bg-[#1A1A1A] border-blood-red opacity-50" : "bg-black/40 border-[#333] hover:bg-[#1A1A1A]"}`}
                    >
                      <span className="text-gray-300 text-sm font-bold uppercase tracking-wider text-center flex gap-2 items-center">
                        {isUploadingOst ? (
                          <span className="animate-pulse">Importando...</span>
                        ) : (
                          <>
                            Selecionar{" "}
                            <Music size={16} className="text-blood-red" />
                          </>
                        )}
                      </span>
                      <span className="text-[#555] text-[10px] font-mono">
                        .MP3 (Max 2MB) Recomendado p/ não travar
                      </span>
                      <input
                        type="file"
                        accept=".mp3"
                        className="hidden"
                        disabled={isUploadingOst}
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (!file) return;
                          if (file.size > 2 * 1024 * 1024) {
                            alert(
                              "Arquivo muito grande, limite de 2MB. Comprima o MP3.",
                            );
                            return;
                          }
                          setIsUploadingOst(true);
                          const reader = new FileReader();
                          reader.onload = async () => {
                            let base64 = reader.result as string;
                            if (base64.startsWith("data:;base64,")) {
                              base64 = base64.replace(
                                "data:;base64,",
                                "data:audio/mpeg;base64,",
                              );
                            } else if (
                              base64.startsWith(
                                "data:application/octet-stream;base64,",
                              )
                            ) {
                              base64 = base64.replace(
                                "data:application/octet-stream;base64,",
                                "data:audio/mpeg;base64,",
                              );
                            }
                            const ostId = `OST_FILE_${Date.now()}_${encodeURIComponent(file.name)}`;
                            await supabase
                              .from("players")
                              .upsert({
                                id: ostId,
                                data: { base64, name: file.name },
                                updated_at: new Date().toISOString(),
                              });
                            fetchOsts();
                            setIsUploadingOst(false);
                          };
                          reader.readAsDataURL(file);
                        }}
                      />
                    </label>
                  </div>

                  <div className="flex flex-col gap-4">
                    <h4 className="text-gray-500 uppercase tracking-widest text-[10px] font-bold">
                      Faixas Disponíveis ({ostList.length})
                    </h4>
                    <div className="flex flex-col gap-3 max-h-[300px] overflow-y-auto pr-2 no-scrollbar">
                      {ostList.length === 0 && (
                        <div className="text-center flex flex-col items-center py-8 text-[#444]">
                          <Music size={32} className="mb-2 opacity-50" />
                          <span className="text-xs uppercase font-bold tracking-widest">
                            Vault Vazio
                          </span>
                        </div>
                      )}
                      {ostList.map((ost) => {
                        const rawName = ost.id.split("_").slice(3).join("_");
                        const ostName = decodeURIComponent(rawName);
                        const isCurrent = globalOstState?.ostId === ost.id;

                        return (
                          <div
                            key={ost.id}
                            className={`flex flex-col sm:flex-row items-center justify-between p-4 border rounded-xl transition-all gap-4 ${isCurrent ? "bg-blood-red/10 border-blood-red/50 shadow-[0_0_10px_rgba(255,0,0,0.1)]" : "bg-black/50 border-[#1A1A1A] hover:bg-[#1A1A1A] hover:border-[#333]"}`}
                          >
                            <div className="flex flex-col w-full sm:w-auto overflow-hidden">
                              <span
                                className={`truncate text-sm font-bold tracking-wider uppercase ${isCurrent ? "text-white" : "text-gray-400"}`}
                              >
                                {ostName || "Desconhecida"}
                              </span>
                              {isCurrent && (
                                <span className="text-[9px] text-blood-red uppercase tracking-widest mt-1 font-bold">
                                  ● Faixa Ativa
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-2 w-full sm:w-auto justify-between sm:justify-end">
                              {isCurrent ? (
                                <>
                                  <button
                                    onClick={() => {
                                      const newIsPlaying =
                                        !globalOstState?.isPlaying;
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
                                          if (error)
                                            console.error(
                                              "MASTER_STATE upsert error:",
                                              error.message,
                                            );
                                        });
                                      globalChannelRef.current
                                        ?.send({
                                          type: "broadcast",
                                          event: "ost_update",
                                          payload: stateData,
                                        })
                                        .catch(console.error);
                                    }}
                                    className={`flex-1 sm:flex-none px-6 py-3 sm:py-2.5 uppercase font-black tracking-widest text-[10px] rounded-lg transition-all shadow-md ${globalOstState?.isPlaying ? "bg-white text-black hover:bg-gray-200" : "bg-blood-red text-white hover:bg-red-700 shadow-[0_0_10px_rgba(255,0,0,0.3)]"}`}
                                  >
                                    {globalOstState?.isPlaying
                                      ? "PAUSAR"
                                      : "TOCAR"}
                                  </button>
                                  <button
                                    onClick={() => {
                                      const stateData = {
                                        ...globalOstState,
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
                                          if (error)
                                            console.error(
                                              "MASTER_STATE reset error:",
                                              error.message,
                                            );
                                        });
                                      globalChannelRef.current
                                        ?.send({
                                          type: "broadcast",
                                          event: "ost_update",
                                          payload: stateData,
                                        })
                                        .catch(console.error);
                                    }}
                                    className="ml-2 px-3 py-2.5 bg-[#1A1A1A] hover:bg-[#2a2a2a] border border-[#444] hover:border-gray-500 text-gray-400 hover:text-white rounded-lg transition-all flex items-center justify-center shadow-md active:scale-95"
                                    title="Resetar"
                                  >
                                    <RotateCcw size={16} />
                                  </button>
                                  {globalOstState?.isPlaying &&
                                    audioRef.current?.paused &&
                                    !requiresInteraction && (
                                      <button
                                        onClick={() => {
                                          if (audioRef.current)
                                            audioRef.current
                                              .play()
                                              .catch(console.error);
                                        }}
                                        className="ml-2 px-3 py-2.5 bg-yellow-600 text-white text-[10px] uppercase font-bold rounded-lg animate-pulse"
                                      >
                                        Tentar Forçar (Play)
                                      </button>
                                    )}
                                </>
                              ) : (
                                <button
                                  onClick={() => {
                                    const stateData = {
                                      ostId: ost.id,
                                      name: ostName,
                                      isPlaying: false,
                                      volume: 1,
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
                                        if (error)
                                          console.error(
                                            "MASTER_STATE select error:",
                                            error.message,
                                          );
                                      });
                                    globalChannelRef.current
                                      ?.send({
                                        type: "broadcast",
                                        event: "ost_update",
                                        payload: stateData,
                                      })
                                      .catch(console.error);
                                  }}
                                  className="flex-1 sm:flex-none px-5 py-3 sm:py-2.5 bg-transparent border border-[#444] text-[#888] hover:text-white hover:bg-[#1A1A1A] hover:border-gray-500 uppercase font-bold tracking-widest text-[10px] rounded-lg transition-all"
                                >
                                  Selecionar
                                </button>
                              )}
                              <button
                                onClick={async () => {
                                  if (
                                    confirm(
                                      "Deletar essa música permanentemente?",
                                    )
                                  ) {
                                    await supabase
                                      .from("players")
                                      .delete()
                                      .eq("id", ost.id);
                                    if (isCurrent) {
                                      await supabase
                                        .from("players")
                                        .delete()
                                        .eq("id", "MASTER_STATE");
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
                                  }
                                }}
                                className="p-3 sm:p-2.5 text-[#555] hover:text-red-500 hover:bg-red-500/10 rounded-lg transition-colors border border-transparent hover:border-red-500/20"
                              >
                                <Trash2 size={18} />
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {globalOstState?.ostId && (
                    <div className="mt-8 p-4 bg-[#1A1A1A] border border-blood-red/30 rounded">
                      <div className="flex justify-between items-center mb-4">
                        <div className="text-gray-400 text-xs uppercase tracking-widest">
                          Faixa em Destaque
                        </div>
                        <div className="text-blood-red font-bold text-sm truncate max-w-[200px]">
                          {globalOstState?.name}
                        </div>
                      </div>

                      <div className="flex flex-col gap-2">
                        <div className="flex justify-between text-gray-500 text-[10px] uppercase">
                          <span>Volume Base (Fade To)</span>
                          <span>
                            {Math.round((globalOstState?.volume ?? 1) * 100)}%
                          </span>
                        </div>
                        <input
                          type="range"
                          min="0"
                          max="1"
                          step="0.05"
                          value={globalOstState?.volume ?? 1}
                          onChange={(e) => {
                            const newVol = Number(e.target.value);
                            setGlobalOstState((prev: any) => ({
                              ...prev,
                              volume: newVol,
                            }));
                          }}
                          onPointerUp={(e) => {
                            const newVol = Number(
                              (e.target as HTMLInputElement).value,
                            );
                            const stateData = {
                              ...globalOstState,
                              volume: newVol,
                            };
                            supabase
                              .from("players")
                              .upsert({
                                id: "MASTER_STATE",
                                data: { ost: stateData },
                                updated_at: new Date().toISOString(),
                              })
                              .then(({ error }) => {
                                if (error)
                                  console.error(
                                    "MASTER_STATE volume error:",
                                    error.message,
                                  );
                              });
                            globalChannelRef.current
                              ?.send({
                                type: "broadcast",
                                event: "ost_update",
                                payload: stateData,
                              })
                              .catch(console.error);
                          }}
                          className="w-full accent-blood-red"
                        />
                        <div className="text-[#555] text-[10px] mt-1 italic text-center">
                          Ajuste de volume (sincroniza ao soltar).
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ) : mestreTab === "eventos" ? (
              <SkillBuilder
                savedEvents={savedEvents}
                setSavedEvents={setSavedEvents}
                userUid={userUid}
                globalChannelRef={globalChannelRef}
                players={players}
                activeToggles={activeEventToggles}
                ostList={ostList}
              />
            ) : mestreTab === "extras" ? (
              <div className="max-w-6xl mx-auto flex flex-col gap-6 px-4">
                <div className="bg-[#050505]/95 backdrop-blur-md border border-blood-red/15 rounded-2xl p-6 shadow-[0_4px_30px_rgba(255,0,0,0.05)] relative overflow-hidden mb-2">
                  <div className="absolute inset-0 bg-gradient-to-r from-blood-red/5 to-transparent"></div>
                  <div className="flex items-center gap-4 relative z-10 w-full">
                    <div className="p-3 bg-blood-red/10 border border-blood-red/20 rounded-xl text-blood-red">
                      <Ghost size={26} />
                    </div>
                    <div>
                      <h3 className="text-lg font-black text-white uppercase tracking-wider">
                        Nuvem & Fichas Extras
                      </h3>
                      <p className="text-[#a0a0a0] text-xs mt-1 leading-relaxed">
                        Crie e gerencie NPCs, monstros e chefes instantaneamente. Sincronize com a nuvem para os jogadores acompanharem em tempo real.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {extraFichas.map((ficha) => {
                    const hpCurrent = ficha.hp?.current ?? ficha.hpCurrent ?? 100;
                    const hpMax = ficha.hp?.max ?? ficha.hpMax ?? 100;
                    const hpPct = Math.max(0, Math.min(100, (hpCurrent / hpMax) * 100)) || 0;

                    const peCurrent = ficha.pe?.current ?? 60;
                    const peMax = ficha.pe?.max ?? 60;
                    const pePct = Math.max(0, Math.min(100, (peCurrent / peMax) * 100)) || 0;

                    const skillsCount = ficha.skills?.length ?? 0;
                    const variablesCount = Object.keys(ficha.variables || {}).length;

                    return (
                      <div
                        key={ficha.id}
                        className={`bg-black/80 backdrop-blur-md border ${
                          ficha.synchronized ? "border-blue-500/30 shadow-[0_0_15px_rgba(59,130,246,0.1)]" : "border-[#333]"
                        } hover:border-blood-red/50 rounded-xl p-5 relative overflow-hidden transition-all shadow-lg flex flex-col justify-between group`}
                      >
                        <div>
                          <div className="flex justify-between items-start mb-4 relative z-10 w-full gap-2">
                            <div className="flex-1 min-w-0 flex flex-col justify-center">
                              {ficha.synchronized && (
                                <div className="inline-flex items-center gap-1.5 bg-blue-500/10 text-blue-400 text-[8px] font-extrabold uppercase tracking-widest px-2 py-0.5 rounded border border-blue-500/20 mb-1 w-max">
                                  <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse"></span>
                                  Sincronizado
                                </div>
                              )}
                              <input
                                type="text"
                                value={ficha.name}
                                onChange={(e) => {
                                  setExtraFichas(
                                    extraFichas.map((f) =>
                                      f.id === ficha.id
                                        ? { ...f, name: e.target.value, last_local_edit: f.synchronized ? Date.now() : undefined }
                                        : f,
                                    ),
                                  );
                                }}
                                className="bg-transparent text-white font-bold text-lg uppercase tracking-widest border-b border-transparent focus:border-blood-red outline-none w-full min-w-0 pb-1"
                              />
                            </div>
                            <div className="flex gap-1 items-center shrink-0">
                              <button
                                onClick={() => toggleFichaSync(ficha)}
                                title={ficha.synchronized ? "Parar Sincronização (Nuvem)" : "Sincronizar com Nuvem"}
                                className={`p-1.5 rounded-lg transition-all ${
                                  ficha.synchronized
                                    ? "text-blue-400 hover:text-blue-300 bg-blue-500/10 hover:bg-blue-500/20"
                                    : "text-gray-500 hover:text-white bg-transparent hover:bg-white/5"
                                }`}
                              >
                                {ficha.synchronized ? <Cloud size={14} /> : <CloudOff size={14} />}
                              </button>
                              <button
                                onClick={() => {
                                  const cloned = {
                                    ...defaultState,
                                    ...ficha,
                                    id: Date.now().toString() + Math.random().toString(),
                                    name: `${ficha.name || "Extra"} (Cópia)`,
                                    synchronized: false,
                                    last_local_edit: undefined,
                                  };
                                  setExtraFichas([cloned, ...extraFichas]);
                                }}
                                title="Duplicar esta Ficha"
                                className="text-gray-500 hover:text-white bg-transparent hover:bg-white/5 p-1.5 rounded-lg transition-all"
                              >
                                <Copy size={14} />
                              </button>
                              {deletingFichaId === ficha.id ? (
                                <div className="flex items-center gap-1 bg-blood-red/10 border border-blood-red/25 px-1.5 py-0.5 rounded-lg z-20">
                                  <span className="text-[10px] text-red-500 font-bold uppercase tracking-wider">Deletar?</span>
                                  <button
                                    onClick={() => {
                                      if (ficha.synchronized) {
                                        supabase
                                          .from("players")
                                          .delete()
                                          .eq("id", `EXTRA_FICHA_${ficha.id}`)
                                          .then(({ error }) => {
                                            if (error) console.error("Error deleting synced sheet:", error.message);
                                          });
                                      }
                                      setExtraFichas(
                                        extraFichas.filter((f) => f.id !== ficha.id),
                                      );
                                      if (activeFichaId === ficha.id) {
                                        setActiveFichaId("main");
                                        setCurrentPage("mestre");
                                      }
                                      setDeletingFichaId(null);
                                    }}
                                    className="text-white hover:text-green-400 bg-green-500/20 hover:bg-green-500/30 px-1 py-0.5 rounded text-[10px] font-black cursor-pointer"
                                  >
                                    Sim
                                  </button>
                                  <button
                                    onClick={() => setDeletingFichaId(null)}
                                    className="text-gray-400 hover:text-white bg-white/5 hover:bg-white/10 px-1 py-0.5 rounded text-[10px] font-black cursor-pointer"
                                  >
                                    Não
                                  </button>
                                </div>
                              ) : (
                                <button
                                  onClick={() => setDeletingFichaId(ficha.id)}
                                  className="text-[#555] hover:text-red-500 bg-transparent hover:bg-red-500/10 p-1.5 rounded-full transition-all shrink-0 cursor-pointer"
                                  title="Excluir ficha"
                                >
                                  <Trash2 size={14} />
                                </button>
                              )}
                            </div>
                          </div>

                          <div className="space-y-4 mb-4 bg-[#1A1A1A]/80 border border-[#1A1A1A] p-3 rounded-lg relative z-10">
                            {/* HP Tracker */}
                            <div>
                              <div className="flex justify-between items-center mb-1 text-[9px] uppercase tracking-widest text-gray-500 font-bold">
                                <span className="text-red-500">Vida (HP)</span>
                                <span className="font-mono">{hpCurrent} / {hpMax}</span>
                              </div>
                              <div className="h-1.5 bg-[#111] rounded overflow-hidden flex relative border border-[#222]">
                                <div
                                  className="bg-blood-red h-full transition-all duration-300"
                                  style={{ width: `${hpPct}%` }}
                                ></div>
                              </div>
                              <div className="flex gap-2 mt-1.5">
                                <MestreStatInput
                                  value={hpCurrent}
                                  onSave={(val) => {
                                    setExtraFichas(
                                      extraFichas.map((f) =>
                                        f.id === ficha.id
                                          ? { ...f, hp: { ...f.hp, current: val }, last_local_edit: f.synchronized ? Date.now() : undefined }
                                          : f,
                                      ),
                                    );
                                  }}
                                  className="w-1/2 bg-transparent text-center text-xs text-white font-bold font-mono border-b border-[#333] py-0.5"
                                  placeholder="Atual"
                                />
                                <MestreStatInput
                                  value={hpMax}
                                  onSave={(val) => {
                                    setExtraFichas(
                                      extraFichas.map((f) =>
                                        f.id === ficha.id
                                          ? { ...f, hp: { ...f.hp, max: val }, last_local_edit: f.synchronized ? Date.now() : undefined }
                                          : f,
                                      ),
                                    );
                                  }}
                                  className="w-1/2 bg-transparent text-center text-xs text-white font-bold font-mono border-b border-[#333] py-0.5"
                                  placeholder="Max"
                                />
                              </div>
                            </div>

                            {/* PE Tracker */}
                            <div>
                              <div className="flex justify-between items-center mb-1 text-[9px] uppercase tracking-widest text-gray-500 font-bold">
                                <span className="text-blue-400">Esforço (PE)</span>
                                <span className="font-mono">{peCurrent} / {peMax}</span>
                              </div>
                              <div className="h-1.5 bg-[#111] rounded overflow-hidden flex relative border border-[#222]">
                                <div
                                  className="bg-blue-600 h-full transition-all duration-300"
                                  style={{ width: `${pePct}%` }}
                                ></div>
                              </div>
                              <div className="flex gap-2 mt-1.5">
                                <MestreStatInput
                                  value={peCurrent}
                                  onSave={(val) => {
                                    setExtraFichas(
                                      extraFichas.map((f) =>
                                        f.id === ficha.id
                                          ? { ...f, pe: { ...f.pe, current: val }, last_local_edit: f.synchronized ? Date.now() : undefined }
                                          : f,
                                      ),
                                    );
                                  }}
                                  className="w-1/2 bg-transparent text-center text-xs text-gray-400 font-bold font-mono border-b border-[#333] py-0.5"
                                  placeholder="PE"
                                />
                                <MestreStatInput
                                  value={peMax}
                                  onSave={(val) => {
                                    setExtraFichas(
                                      extraFichas.map((f) =>
                                        f.id === ficha.id
                                          ? { ...f, pe: { ...f.pe, max: val }, last_local_edit: f.synchronized ? Date.now() : undefined }
                                          : f,
                                      ),
                                    );
                                  }}
                                  className="w-1/2 bg-transparent text-center text-xs text-gray-400 font-bold font-mono border-b border-[#333] py-0.5"
                                  placeholder="MAX PE"
                                />
                              </div>
                            </div>
                          </div>

                          <div className="grid grid-cols-2 gap-2 mb-4 text-[9px] uppercase tracking-wider relative z-10">
                            <div className="bg-[#1A1A1A]/40 border border-[#1A1A1A] p-2 rounded text-center">
                              <span className="text-xs font-mono font-bold text-white block">{skillsCount}</span>
                              <span className="text-gray-500 text-[8px]">Habilidades</span>
                            </div>
                            <div className="bg-[#1A1A1A]/40 border border-[#1A1A1A] p-2 rounded text-center">
                              <span className="text-xs font-mono font-bold text-white block">{variablesCount}</span>
                              <span className="text-gray-500 text-[8px]">Variáveis</span>
                            </div>
                          </div>

                          <div className="mt-4 pt-3 border-t border-[#1A1A1A] relative z-10 w-full">
                            <div className="text-[9px] text-gray-600 uppercase tracking-wider mb-2">
                              Anotações / Notas Rápidas
                            </div>
                            <textarea
                              value={ficha.notes}
                              onChange={(e) => {
                                setExtraFichas(
                                  extraFichas.map((f) =>
                                    f.id === ficha.id
                                      ? { ...f, notes: e.target.value, last_local_edit: f.synchronized ? Date.now() : undefined }
                                      : f,
                                  ),
                                );
                              }}
                              placeholder="..."
                              className="w-full bg-[#1A1A1A] border border-[#333] focus:border-blood-red/50 rounded-lg p-3 text-xs text-gray-300 outline-none resize-none h-24 font-mono shadow-[inset_0_0_10px_#000]"
                            />
                          </div>
                        </div>

                        <button
                          onClick={() => {
                            setActiveFichaId(ficha.id);
                            setCurrentPage("ficha_extra");
                            setMestreTab("fichas");
                          }}
                          className={`w-full mt-4 py-2.5 bg-blood-red/10 border border-blood-red/30 text-blood-red hover:text-white hover:bg-blood-red hover:border-transparent rounded-lg text-[10px] font-bold uppercase tracking-widest transition-all text-center flex items-center justify-center gap-1`}
                        >
                          <Maximize size={12} /> Abrir Ficha Interativa
                        </button>
                      </div>
                    );
                  })}
                </div>
                {extraFichas.length === 0 && (
                  <div className="flex flex-col items-center justify-center py-20 text-[#555] opacity-50 bg-black/50 border border-dashed border-[#333] rounded-xl mt-4">
                    <Ghost size={48} className="mb-4" />
                    <p className="font-bold uppercase tracking-widest text-lg">
                      Sem Fichas Extras
                    </p>
                  </div>
                )}
              </div>
            ) : null}

            {mestreTab === "extras" && (
              <div className="fixed bottom-24 right-6 z-[160] flex flex-col items-end gap-2">
                <button
                  onClick={() => {
                    setExtraFichas([
                      {
                        ...defaultState,
                        id: Date.now().toString(),
                        name: "Novo Extra",
                        notes: "",
                      },
                      ...extraFichas,
                    ]);
                  }}
                  className="w-16 h-16 rounded-full flex items-center justify-center shadow-[0_0_25px_rgba(0,0,0,0.9)] border transition-all z-[150] cursor-pointer bg-blood-red hover:bg-red-700 border-red-500/40 hover:scale-110 active:scale-95 group"
                  title="Adicionar Ficha Extra"
                >
                  <Plus size={32} className="text-white" strokeWidth={2.5} />
                </button>
              </div>
            )}
          </div>
        </>
      )}

      {useSkillModalId !== null &&
        (() => {
          const modalSkill = state.skills.find(
            (s: any) => s.id === useSkillModalId,
          );
          if (!modalSkill) return null;
          return (
            <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4">
              <div className="bg-[#0a0a0a] border border-[#333] rounded-lg w-full max-w-sm flex flex-col p-4 gap-4 shadow-[0_0_20px_rgba(0,0,0,0.8)]">
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

                <div className="h-48 overflow-y-auto bg-[#1A1A1A] p-3 border border-[#1A1A1A] rounded text-[13px] text-[#aaa] flex flex-col shadow-[inset_0_0_10px_#000]">
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
                      className="flex-1 bg-[#1a1a1a] border border-[#333] hover:bg-[#333] hover:border-gray-500 text-gray-400 hover:text-white uppercase font-bold text-[10px] tracking-wider rounded py-3 transition-all cursor-pointer"
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
                      className="flex-1 bg-gradient-to-r from-[#900] to-[var(--blood-red)] text-white hover:brightness-125 uppercase font-bold text-[10px] tracking-wider rounded py-3 transition-all border-none cursor-pointer"
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
