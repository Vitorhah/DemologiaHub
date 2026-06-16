import React, { useState, useEffect, useRef } from 'react';
import { Menu, X, Edit2, ShieldAlert, Trash2, Minus, Plus, Dices } from 'lucide-react';
import { supabase } from './lib/supabase';

const defaultState = {
    name: "Ocultista",
    hp: { current: 100, max: 100 },
    pe: { current: 60, max: 60 },
    variables: { "OCU": 4, "FOR": 1 } as Record<string, number>,
    skills: [
        { id: 1, name: "JANE!", cost: 4, desc: "Aumenta em +1 a FOR dos aliados", test: "1d20+OCU", damage: "", testVar: "", damageVar: "" },
        { id: 2, name: "SMEELS", cost: 1, desc: "Ataque básico", test: "1d20+OCU", damage: "1d8+FOR", testVar: "", damageVar: "" }
    ],
    tributo: { 
        name: "Sinfonia de Robert", 
        desc: "Tributo capaz de tornar sinfonias e músicas em ataques e sensações.", 
        passivo: "", 
        ativo: "" 
    },
    inventory: ["", "", "", "", "", ""],
    history: [] as string[]
};

const MestreStatInput = ({ value, className, onSave }: { value: number, className: string, onSave: (val: number) => void }) => {
    const [localVal, setLocalVal] = useState<string | number>(value);
    const [isFocused, setIsFocused] = useState(false);

    useEffect(() => {
        if (!isFocused) setLocalVal(value);
    }, [value, isFocused]);

    return (
        <input 
            type="number"
            value={isFocused ? localVal : value}
            onFocus={() => setIsFocused(true)}
            onChange={e => setLocalVal(e.target.value)}
            onBlur={() => {
                setIsFocused(false);
                onSave(parseInt(localVal as string) || 0);
            }}
            onKeyDown={e => e.key === 'Enter' && e.currentTarget.blur()}
            className={className}
        />
    );
};

export default function App() {
  const [state, setState] = useState(() => {
    try {
      const item = localStorage.getItem('rpgSheetState');
      return item ? JSON.parse(item) : defaultState;
    } catch {
      return defaultState;
    }
  });

  const [activeSkill, setActiveSkill] = useState<number | null>(null);
  const [editingSkill, setEditingSkill] = useState<number | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [currentPage, setCurrentPage] = useState('ficha');
  const [activeTributo, setActiveTributo] = useState(false);
  const [diceInput, setDiceInput] = useState('');
  const historyRef = useRef<HTMLDivElement>(null);
  const [isShaking, setIsShaking] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);
  const [useSkillModalId, setUseSkillModalId] = useState<number | null>(null);
  const [skillModalTested, setSkillModalTested] = useState(false);
  const [userUid, setUserUid] = useState<string | null>(null);
  const [players, setPlayers] = useState<any[]>([]);
  const [isMestreAuth, setIsMestreAuth] = useState(false);
  const [initiatives, setInitiatives] = useState<Record<string, number>>({});
  const [mestreTab, setMestreTab] = useState<'fichas' | 'ost'>('fichas');
  
  const [ostList, setOstList] = useState<any[]>([]);
  const [globalOstState, setGlobalOstState] = useState<any>(null);
  const [loadedOstData, setLoadedOstData] = useState<any>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [passwordInput, setPasswordInput] = useState('');
  const [passwordError, setPasswordError] = useState(false);
  const [requiresInteraction, setRequiresInteraction] = useState(false);
  const [isUploadingOst, setIsUploadingOst] = useState(false);
  const [isOstLoading, setIsOstLoading] = useState(false);

  const [isOnline, setIsOnline] = useState(() => {

    return localStorage.getItem('rpgIsOnline') !== 'false';
  });

  useEffect(() => {
    localStorage.setItem('rpgIsOnline', isOnline.toString());
  }, [isOnline]);

  const pendingUpdatesRef = useRef<boolean>(false);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    localStorage.setItem('rpgSheetState', JSON.stringify(state));
    
    if (userUid && isOnline && currentPage !== 'mestre') {
      pendingUpdatesRef.current = true;
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
      
      debounceTimerRef.current = setTimeout(() => {
        supabase.from('players').upsert({
          id: userUid,
          data: state,
          updated_at: new Date().toISOString()
        }).then(({ error }) => {
          if (error) console.error("Error syncing to Supabase:", error.message);
          pendingUpdatesRef.current = false;
        });
      }, 1000);
    }
  }, [state, userUid, isOnline, currentPage]);

  useEffect(() => {
    const initAuth = async () => {
      try {
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        if (sessionError) throw sessionError;
        
        if (session?.user) {
          setUserUid(session.user.id);
        } else {
          const { data, error } = await supabase.auth.signInAnonymously();
          if (error) {
            console.warn("Supabase Anon Auth falhou. Usando UUID local.", error.message);
            let localUid = localStorage.getItem('localUid');
            if (!localUid) {
              localUid = crypto.randomUUID();
              localStorage.setItem('localUid', localUid);
            }
            setUserUid(localUid);
          } else if (data?.user) {
            setUserUid(data.user.id);
          }
        }
      } catch (err: any) {
         console.warn("Supabase auth error (pode ser offline ou erro de rede):", err.message);
         let localUid = localStorage.getItem('localUid');
         if (!localUid) {
           localUid = crypto.randomUUID();
           localStorage.setItem('localUid', localUid);
         }
         setUserUid(localUid);
      }
    };

    initAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        setUserUid(session.user.id);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!userUid) return;

    const fetchOwnState = () => {
       supabase.from('players').select('data').eq('id', userUid).single().then(({ data, error }) => {
          if (error) {
              console.warn('Error fetching own state:', error.message);
              return;
          }
          if (data?.data && !pendingUpdatesRef.current) {
             setState((prev: any) => {
                 const newHp = data.data.hp;
                 const newPe = data.data.pe;
                 if (prev.hp.current !== newHp.current || prev.pe.current !== newPe.current || prev.hp.max !== newHp.max || prev.pe.max !== newPe.max) {
                     return { ...prev, hp: newHp, pe: newPe };
                 }
                 return prev;
             });
          }
       }).catch(err => console.warn('Fetch own state failed:', err.message));
    };

    fetchOwnState();
    const fallbackInterval = setInterval(fetchOwnState, 15000);

    const channel = supabase.channel(`player_changes_${userUid}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'players', filter: `id=eq.${userUid}` }, (payload) => {
         if (payload.new && payload.new.data && !pendingUpdatesRef.current) {
             setState((prev: any) => {
                 const newHp = payload.new.data.hp;
                 const newPe = payload.new.data.pe;
                 if (prev.hp.current !== newHp.current || prev.pe.current !== newPe.current || prev.hp.max !== newHp.max || prev.pe.max !== newPe.max) {
                     return { ...prev, hp: newHp, pe: newPe };
                 }
                 return prev;
             });
         }
      })
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'players', filter: `id=eq.${userUid}` }, () => {
         if (currentPage !== 'mestre') {
             setIsOnline(false);
             setState((prev: any) => ({
                 ...prev,
                 history: ['<span style="color: #ffaa00;">Você foi desconectado pelo Mestre. Vá em "Conexão" para reconectar.</span>', ...prev.history]
             }));
         }
      })
      .subscribe();

    return () => { 
       clearInterval(fallbackInterval);
       supabase.removeChannel(channel); 
    };
  }, [userUid, currentPage]);

  useEffect(() => {
    const fetchMasterState = () => {
       supabase.from('players').select('data').eq('id', 'MASTER_STATE').single().then(({ data, error }) => {
          if (error) {
              console.warn('Error fetching master state:', error.message);
              return;
          }
          if (data?.data?.ost) {
             setGlobalOstState((prev: any) => {
                if (JSON.stringify(prev) !== JSON.stringify(data.data.ost)) return data.data.ost;
                return prev;
             });
          }
       }).catch(err => console.warn('Fetch master state request failed:', err.message));
    };

    fetchMasterState();
    const fallbackInterval = setInterval(fetchMasterState, 15000);

    const channel = supabase.channel('global_state_updates')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'players' }, (payload) => {
         const newRecord = payload.new as any;
         if (newRecord?.id === 'MASTER_STATE' && newRecord?.data?.ost) {
             setGlobalOstState((prev: any) => {
                if (JSON.stringify(prev) !== JSON.stringify(newRecord.data.ost)) return newRecord.data.ost;
                return prev;
             });
         }
      }).subscribe();

    return () => { 
       clearInterval(fallbackInterval);
       supabase.removeChannel(channel); 
    };
  }, []);

  useEffect(() => {
    if (globalOstState?.ostId && globalOstState.ostId !== loadedOstData?.id) {
       setIsOstLoading(true);
       supabase.from('players').select('data').eq('id', globalOstState.ostId).single().then(async ({ data }) => {
           if (data?.data?.base64) {
               try {
                   const res = await fetch(data.data.base64);
                   const blob = await res.blob();
                   const objectUrl = URL.createObjectURL(blob);
                   setLoadedOstData({ id: globalOstState.ostId, base64: objectUrl, name: data.data.name });
               } catch(err) {
                   console.error("Failed to convert data URI:", err);
                   // fallback to base64
                   setLoadedOstData({ id: globalOstState.ostId, base64: data.data.base64, name: data.data.name });
               }
           }
           setIsOstLoading(false);
       }).catch((e) => {
           console.error("Failed to load OST:", e);
           setIsOstLoading(false);
       });
    }
  }, [globalOstState?.ostId, loadedOstData?.id]);

  useEffect(() => {
    if (!audioRef.current || !loadedOstData) return;
    
    const audioEl = audioRef.current;

    const attemptPlay = () => {
       if (globalOstState?.isPlaying && audioEl.paused) {
           const playPromise = audioEl.play() as Promise<void> | undefined;
           if (playPromise !== undefined && playPromise.catch) {
               playPromise.then(() => {
                   setRequiresInteraction(false);
               }).catch(e => {
                   console.warn('Auto-play error:', e.name, e.message);
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
    
    // Always attempt to play if global state is playing
    attemptPlay();

    const targetVolume = globalOstState?.isPlaying ? (globalOstState.volume ?? 1) : 0;
    
    // Periodically ensure playback if it's supposed to be playing
    const playCheckInterval = setInterval(() => {
       if (audioEl && globalOstState?.isPlaying && audioEl.paused && !requiresInteraction) {
           attemptPlay();
       }
    }, 2000);
    
    const fadeInterval = setInterval(() => {
       if (!audioEl) return;
       const current = audioEl.volume;
       const diff = targetVolume - current;
       if (Math.abs(diff) < 0.05) {
           audioEl.volume = Math.max(0, Math.min(1, targetVolume));
           if (targetVolume === 0 && !globalOstState?.isPlaying && !audioEl.paused) {
               audioEl.pause();
           }
           clearInterval(fadeInterval);
       } else {
           audioEl.volume = Math.max(0, Math.min(1, current + (diff > 0 ? 0.05 : -0.05)));
       }
    }, 100);

    return () => {
        clearInterval(fadeInterval);
        clearInterval(playCheckInterval);
    };
  }, [globalOstState, loadedOstData]);

  const fetchOsts = () => {
     supabase.from('players').select('id').like('id', 'OST_FILE_%').then(({ data }) => {
         if (data) setOstList(data);
     });
  };

  useEffect(() => {
     if (currentPage === 'mestre' && mestreTab === 'ost') {
         fetchOsts();
     }
  }, [currentPage, mestreTab]);

  useEffect(() => {
    if (currentPage === 'mestre' && userUid) {
      const fetchPlayersList = () => {
         supabase.from('players').select('id, data').not('id', 'like', 'OST_FILE_%').not('id', 'eq', 'MASTER_STATE').then(({ data, error }) => {
            if (error) console.error('Error fetching players:', error.message);
            else if (data) {
                setPlayers(current => {
                    const mapped = data.map(d => ({ id: d.id, ...(d.data || {}) }));
                    if (JSON.stringify(current) !== JSON.stringify(mapped)) return mapped;
                    return current;
                });
            }
         }).catch(err => console.warn('Fetch players list failed:', err.message));
      };

      fetchPlayersList();
      const fallbackInterval = setInterval(fetchPlayersList, 15000);

      const channel = supabase.channel('players_list_channel')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'players' }, (payload) => {
          setPlayers(current => {
            let existing = [...current];
            if (payload.eventType === 'DELETE') {
              return existing.filter(p => p.id !== payload.old.id);
            }
            const newRecord = payload.new as any;
            if (newRecord?.id?.startsWith('OST_FILE_') || newRecord?.id === 'MASTER_STATE') return existing;
            
            if (!newRecord?.id) return existing;
            const formatted = { id: newRecord.id, ...(newRecord.data || {}) };
            const index = existing.findIndex(p => p.id === newRecord.id);
            if (index >= 0) existing[index] = formatted;
            else existing.push(formatted);
            return existing;
          });
        })
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

  const parseAndRoll = (formula: string, customVars?: Record<string, number>) => {
    if (!formula) return null;
    let logDetails: string[] = [];
    let stringToEval = formula.toUpperCase();

    // Sort to match longer variables first (e.g. VARIABLE before VAR)
    const varsToUse = customVars || state.variables;
    const sortedVars = Object.entries(varsToUse).sort((a, b) => b[0].length - a[0].length);
    sortedVars.forEach(([key, value]) => {
      const regex = new RegExp(`\\b${key}\\b`, 'g');
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
      logDetails.push(`${match}[${rolls.join(',')}]`);
      return String(sum);
    });

    try {
      let safeMath = stringToEval.replace(/[^0-9+\-*/(). ]/g, '');
      if (safeMath.trim() === "") return null;
      // Add implicit multiplication for parenthesis like 2(3+4) -> 2*(3+4)
      safeMath = safeMath.replace(/\)(?=\d|\()/g, ')*').replace(/(\d)(?=\()/g, '$1*');
      // eslint-disable-next-line
      const result = new Function('return ' + safeMath)();
      return {
        result: Math.floor(result),
        details: logDetails.length > 0 ? logDetails.join(' | ') : 'Valor fixo',
        formula
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
      history: [text, ...prev.history].slice(0, 20)
    }));
  };

  const processManualRoll = () => {
    vibrate(50);
    const roll = parseAndRoll(diceInput);
    if (roll) {
      addToHistory(`Rolou: <b>${roll.formula}</b> <br><span style="font-size:11px">${roll.details}</span> <br><span class="log-result">Resultado: ${roll.result}</span>`);
      triggerShake();
    } else {
      addToHistory('<span style="color: #ffaa00;">Fórmula manual inválida.</span>');
    }
  };

  const updateStat = (stat: 'hp' | 'pe', field: 'current' | 'max', val: number) => {
    if (stat === 'hp' && field === 'current') vibrate(100);
    setState((prev: any) => ({
      ...prev,
      [stat]: { ...prev[stat], [field]: val || 0 }
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
      variables: { ...prev.variables, [key]: val || 0 }
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
        variables: { ...prev.variables, [newName]: 0 }
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
        skills: [...prev.skills, { id: newId, name: "", cost: 0, desc: "", test: "", damage: "" }]
      }));
      setActiveSkill(newId);
    }
  };

  const updateSkill = (id: number, field: string, val: any) => {
    setState((prev: any) => ({
      ...prev,
      skills: prev.skills.map((s: any) => s.id === id ? { ...s, [field]: field === 'cost' ? (parseInt(val) || 0) : val } : s)
    }));
  };

  const removeSkill = (id: number) => {
    setState((prev: any) => ({
      ...prev,
      skills: prev.skills.filter((s: any) => s.id !== id)
    }));
  };

  const useSkill = (skill: any, type: 'test' | 'damage') => {
    vibrate([50, 50]);
    
    if (type === 'test' && skill.cost > 0) {
      if (state.pe.current >= skill.cost) {
        setState((prev: any) => ({
          ...prev,
          pe: { ...prev.pe, current: prev.pe.current - skill.cost }
        }));
        addToHistory(`<i>Gastou ${skill.cost} PE com ${skill.name}</i>`);
      } else {
        addToHistory('<span style="color: #ffaa00;">PE Insuficiente!</span>');
        return;
      }
    }

    const formula = type === 'test' ? skill.test : skill.damage;
    if (!formula) {
      addToHistory(`<b>${skill.name || 'Habilidade'}</b>: Usou a habilidade (Sem fórmula definida).`);
      return;
    }

    const roll = parseAndRoll(formula);
    if (roll) {
      const tipoStr = type === 'test' ? 'Teste' : 'Dano';
      addToHistory(`<b>${skill.name || 'Habilidade'}</b> (${tipoStr}) <br>Fórmula: ${roll.formula} <br><span style="font-size:11px">${roll.details}</span> <br><span class="log-result">Resultado: ${roll.result}</span>`);
      triggerShake();
      
      let newVars = { ...state.variables };

      const varName = type === 'test' ? skill.testVar : skill.damageVar;
      if (varName && varName.trim() !== '') {
         const vName = varName.trim().toUpperCase();
         newVars[vName] = roll.result;
         updateVariable(vName, roll.result);
         addToHistory(`<i>Variável <b>${vName}</b> foi atualizada para ${roll.result}</i>`);
      }

      const postVar = type === 'test' ? skill.testPostVar : skill.damagePostVar;
      const postFormula = type === 'test' ? skill.testPostFormula : skill.damagePostFormula;

      if (postVar && postVar.trim() !== '' && postFormula && postFormula.trim() !== '') {
         const postRoll = parseAndRoll(postFormula, newVars);
         if (postRoll) {
            const pVarName = postVar.trim().toUpperCase();
            // Since updateVariable relies on state and could be batched, we need to ensure the variables
            // don't overwrite each other if updated multiple times. The updateVariable uses
            // setState(prev => ...), so it's safe!
            updateVariable(pVarName, postRoll.result);
            addToHistory(`<i>Variável <b>${pVarName}</b> (Após ${tipoStr}) definida para ${postRoll.result}</i>`);
         } else {
            addToHistory('<span style="color: #ffaa00;">Fórmula após resultado inválida.</span>');
         }
      }
    } else {
      addToHistory('<span style="color: #ffaa00;">Fórmula da skill inválida.</span>');
    }
  };

  const toggleTributo = () => {
    vibrate(60);
    setActiveTributo(!activeTributo);
  };

  const updateTributo = (field: string, val: string) => {
    setState((prev: any) => ({
      ...prev,
      tributo: { ...prev.tributo, [field]: val }
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
    localStorage.removeItem('rpgSheetState');
    window.location.reload();
  };

  const exportData = () => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(state));
    const a = document.createElement('a');
    a.href = dataStr;
    a.download = "ficha_demologia.json";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const importData = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'application/json';
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
            addToHistory('<span style="color: #ffaa00;">Arquivo JSON inválido para esta ficha.</span>');
          }
        } catch {
          addToHistory('<span style="color: #ffaa00;">Erro ao ler o arquivo.</span>');
        }
      };
      reader.readAsText(file, 'UTF-8');
    };
    input.click();
  };

  const kickPlayer = async (id: string) => {
    if (confirm("Desconectar esse jogador? Ele precisará reativar na aba Conexão.")) {
      await supabase.from('players').delete().eq('id', id);
    }
  };

  const editPlayerStatExact = async (p: any, stat: 'hp' | 'pe', value: number) => {
    const newData = { ...p };
    newData[stat].current = Math.max(0, Math.min(newData[stat].max, value));
    const dataToSave = { ...newData };
    delete dataToSave.id;
    await supabase.from('players').update({ data: dataToSave }).eq('id', p.id);
  };

  const hpPercent = Math.max(0, Math.min(100, (state.hp.current / state.hp.max) * 100)) || 0;
  const pePercent = Math.max(0, Math.min(100, (state.pe.current / state.pe.max) * 100)) || 0;
  const icons = ['X', 'O', '∆', '□'];

  return (
    <div id="app">
      <audio 
         ref={audioRef} 
         loop 
         preload="auto" 
      />
      
      {globalOstState?.ostId && currentPage !== 'mestre' && (
         <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[45] pointer-events-auto flex flex-col items-center gap-1">
             <div className="bg-black/80 border border-blood-red/40 px-3 py-1 rounded-full flex items-center gap-2 shadow-[0_0_10px_rgba(255,0,0,0.2)] backdrop-blur-sm">
                <span className={`w-2 h-2 rounded-full ${globalOstState.isPlaying ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`} />
                <span className="text-[9px] text-gray-300 uppercase tracking-widest truncate max-w-[150px]">
                   {isOstLoading ? 'BAIXANDO TRILHA...' : (globalOstState.name || 'TRILHA SONORA')}
                </span>
                {globalOstState.isPlaying && audioRef.current?.paused && !requiresInteraction && (
                   <button 
                       className="ml-2 bg-blood-red text-white text-[8px] px-2 py-0.5 rounded cursor-pointer animate-pulse hover:bg-red-700 pointer-events-auto"
                       onClick={(e) => { e.stopPropagation(); if (audioRef.current) audioRef.current.play().catch(console.error); }}
                   >
                       ATIVAR SOM
                   </button>
                )}
             </div>
         </div>
      )}

      {requiresInteraction && (
        <div className="fixed inset-0 bg-black/90 z-[300] flex flex-col items-center justify-center p-6 text-center backdrop-blur-sm">
           <ShieldAlert size={64} className="text-blood-red mb-4 animate-pulse" />
           <h2 className="text-2xl font-bold text-white uppercase tracking-widest mb-2">Conexão de Áudio Pendente</h2>
           <p className="text-gray-400 text-sm mb-8 max-w-sm">O Mestre iniciou a trilha sonora, mas o navegador requer que você interaja com a página para liberar o som.</p>
           <button 
             onClick={() => {
                setRequiresInteraction(false);
                audioRef.current?.play().catch(() => setRequiresInteraction(true));
             }}
             className="bg-blood-red hover:bg-red-800 text-white font-bold py-4 px-8 rounded uppercase tracking-wider transition-all shadow-[0_0_20px_rgba(211,0,0,0.5)] cursor-pointer"
           >
              Permitir Áudio
           </button>
        </div>
      )}
      
      {showPasswordModal && (
        <div className="fixed inset-0 bg-black/90 z-[250] flex flex-col items-center justify-center p-4 backdrop-blur-sm">
           <div className="bg-[#0a0a0a] border border-[#222] p-8 rounded shadow-[0_0_30px_rgba(255,0,0,0.15)] max-w-sm w-full relative">
              <button onClick={() => { setShowPasswordModal(false); setPasswordInput(''); setPasswordError(false); }} className="absolute top-4 right-4 text-gray-500 hover:text-white"><X size={20} /></button>
              <h2 className="text-xl font-bold text-blood-red uppercase tracking-widest mb-2">Acesso Restrito</h2>
              <p className="text-gray-500 text-xs mb-6 uppercase tracking-wider">Digite a senha do Mestre (Senha: mestre)</p>
              
              <input 
                type="password" 
                autoFocus
                className={`w-full bg-[#111] text-white border ${passwordError ? 'border-red-500 text-red-500' : 'border-[#333]'} p-3 rounded outline-none mb-4 focus:border-blood-red transition-colors font-mono text-center tracking-widest`}
                value={passwordInput}
                onChange={(e) => { setPasswordInput(e.target.value); setPasswordError(false); }}
                onKeyDown={(e) => {
                   if (e.key === 'Enter') {
                       if (passwordInput === '%mestre%' || passwordInput.toLowerCase() === 'mestre') {
                           setIsMestreAuth(true);
                           setShowPasswordModal(false);
                           setCurrentPage('mestre');
                           setPasswordInput('');
                       } else {
                           setPasswordError(true);
                       }
                   }
                }}
              />
              {passwordError && <p className="text-red-500 text-[10px] text-center mb-4 uppercase font-bold tracking-wider">Senha Incorreta</p>}
              <button 
                onClick={() => {
                   if (passwordInput === '%mestre%' || passwordInput.toLowerCase() === 'mestre') {
                       setIsMestreAuth(true);
                       setShowPasswordModal(false);
                       setCurrentPage('mestre');
                       setPasswordInput('');
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
      {menuOpen && (
        <div className="fixed inset-0 bg-black/80 z-50 flex">
          <div className="w-64 bg-[#0a0a0a] border-r border-[#222] h-full p-4 flex flex-col gap-4">
            <button onClick={() => setMenuOpen(false)} className="self-end text-gray-500 hover:text-white">
              <X size={24} />
            </button>
            <h2 className="text-xl font-bold text-blood-red mb-4 uppercase tracking-widest border-b border-[#222] pb-2">Menu</h2>
            <button 
              onClick={() => { setCurrentPage('ficha'); setMenuOpen(false); }}
              className={`text-left text-lg font-bold uppercase p-2 rounded ${currentPage === 'ficha' ? 'bg-[#222] text-white' : 'text-gray-500 hover:bg-[#111]'}`}
            >
              Ficha
            </button>
            <button 
              onClick={() => { setCurrentPage('conexao'); setMenuOpen(false); }}
              className={`text-left text-lg font-bold uppercase p-2 rounded ${currentPage === 'conexao' ? 'bg-[#222] text-white' : 'text-gray-500 hover:bg-[#111]'}`}
            >
              Conexão
            </button>
            <button 
              onClick={() => { 
                if (!isMestreAuth) {
                   setShowPasswordModal(true);
                   setMenuOpen(false);
                } else {
                  setCurrentPage('mestre'); 
                  setMenuOpen(false); 
                }
              }}
              className={`text-left text-lg font-bold uppercase p-2 rounded ${currentPage === 'mestre' ? 'bg-[#222] text-white' : 'text-gray-500 hover:bg-[#111]'}`}
            >
              Mestre
            </button>
          </div>
          <div className="flex-1" onClick={() => setMenuOpen(false)} />
        </div>
      )}

      <div className="fixed bottom-0 left-0 w-full h-14 bg-[#0a0a0a] border-t border-[#222] flex flex-row items-center z-[100] shadow-[0_-5px_20px_rgba(0,0,0,0.8)] overflow-x-auto overflow-y-hidden no-scrollbar">
        <button onClick={() => setCurrentPage('ficha')} className={`flex flex-col items-center justify-center shrink-0 min-w-[120px] h-full ${currentPage === 'ficha' ? 'text-blood-red' : 'text-gray-500 hover:text-white hover:bg-[#111]'}`}>
           <span className="text-xs uppercase font-bold tracking-widest leading-none mt-1">Ficha</span>
        </button>
        <div className="w-[1px] h-8 shrink-0 bg-[#222]"></div>
        <button onClick={() => setCurrentPage('conexao')} className={`flex flex-col items-center justify-center shrink-0 min-w-[120px] h-full ${currentPage === 'conexao' ? 'text-blood-red' : 'text-gray-500 hover:text-white hover:bg-[#111]'}`}>
           <span className="text-xs uppercase font-bold tracking-widest leading-none mt-1">Conexão</span>
        </button>
        <div className="w-[1px] h-8 shrink-0 bg-[#222]"></div>
        <button onClick={() => {
                window.scrollTo(0, 0);
                if (!isMestreAuth) {
                   setShowPasswordModal(true);
                } else {
                  setCurrentPage('mestre'); 
                }
        }} className={`flex flex-col items-center justify-center shrink-0 min-w-[120px] h-full ${currentPage === 'mestre' ? 'text-blood-red' : 'text-gray-500 hover:text-white hover:bg-[#111]'}`}>
           <span className="text-xs uppercase font-bold tracking-widest leading-none mt-1">Mestre</span>
        </button>
      </div>

      {currentPage === 'ficha' && (
        <>
          <div className="hud-container relative">
            <img className="eye-logo" src="https://i.ibb.co/xq2KhP1v/3-Sem-T-tulo.png" alt="Símbolo Demologia" />
            <div className="status-numbers relative">
              <input 
                className="bg-transparent text-white font-bold text-center text-4xl uppercase outline-none w-full drop-shadow-[0_0_10px_rgba(211,0,0,0.6)]"
                style={{ textShadow: '2px 2px 0px #500', marginBottom: '-10px', zIndex: 10 }}
                value={state.name || ''}
                onChange={e => setState((prev: any) => ({ ...prev, name: e.target.value }))}
                placeholder="NOME"
              />
              <div className="pe-text z-0"><span>{state.pe.current}/{state.pe.max}</span>PE</div>
              <div className="hp-text z-0"><span>{state.hp.current}/{state.hp.max}</span>HP</div>
            </div>

        <div className="status-bars">
          <div className="bar-wrapper"><div className="bar-fill hp-fill" style={{ width: `${hpPercent}%` }}></div></div>
          <div className="status-inputs">
            <span>HP: <MestreStatInput value={state.hp.current} className="w-12 bg-transparent border-none text-white text-center font-bold font-mono outline-none" onSave={val => updateStat('hp', 'current', val)} /> / <MestreStatInput value={state.hp.max} className="w-12 bg-transparent border-none text-white text-center font-bold font-mono outline-none" onSave={val => updateStat('hp', 'max', val)} /></span>
          </div>
          
          <div className="bar-wrapper" style={{ marginTop: '15px' }}><div className="bar-fill pe-fill" style={{ width: `${pePercent}%` }}></div></div>
          <div className="status-inputs">
            <span>PE: <MestreStatInput value={state.pe.current} className="w-12 bg-transparent border-none text-white text-center font-bold font-mono outline-none" onSave={val => updateStat('pe', 'current', val)} /> / <MestreStatInput value={state.pe.max} className="w-12 bg-transparent border-none text-white text-center font-bold font-mono outline-none" onSave={val => updateStat('pe', 'max', val)} /></span>
          </div>
        </div>
      </div>

      <div className="section">
        <div className="section-title">Variáveis de Status</div>
        <div className="var-grid">
          {Object.entries(state.variables).map(([key, value]) => (
            <div className="var-box" key={key}>
              <button className="btn-remove-var" onClick={() => removeVariable(key)}>X</button>
              <input type="text" defaultValue={key} onBlur={e => renameVariable(key, e.target.value)} onKeyDown={e => e.key === 'Enter' && e.currentTarget.blur()} />
              <MestreStatInput value={value as number || 0} onSave={val => updateVariable(key, val)} className="w-12 bg-transparent text-center text-white font-mono outline-none border-b border-dashed border-[#555] focus:border-blood-red" />
            </div>
          ))}
        </div>
        <button className="btn-add" onClick={addVariable}>+ ADICIONAR VARIÁVEL</button>
      </div>

      <div className="section">
        <div className="section-title">Oráculo (Rolagem)</div>
        <div className="dice-panel">
          <div className="dice-input-group">
            <input type="text" className="dice-input" placeholder="Ex: 1d20+OCU" value={diceInput} onChange={e => setDiceInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && processManualRoll()} />
            <button className="btn-roll" onClick={processManualRoll}>ROLAR</button>
          </div>
          <div className="dice-history" ref={historyRef} style={isShaking ? { animation: 'shake 0.3s ease' } : {}}>
            {state.history.map((h, i) => (
              <div key={i} className="log-entry" dangerouslySetInnerHTML={{ __html: h }} />
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
                <div className="paper-bar" onClick={() => toggleSkill(skill.id)}>
                  <div className="skill-header">
                    <div className="skill-name-area">
                      <span className="skill-icon" style={icon === 'X' ? {color: '#00a8ff', borderColor: '#00a8ff'} : icon === 'O' ? {color: '#d30000', borderColor: '#d30000'} : {}}>{icon}</span>
                      {skill.name || 'Nova Skill'}
                    </div>
                    <div className="skill-cost">{skill.cost}PE</div>
                  </div>
                  <div style={{ fontSize: '12px', color: '#444', marginTop: '5px', marginLeft: '35px' }}>{skill.desc || 'Sem descrição'}</div>
                </div>
                <div className={`skill-details ${isActive && editingSkill !== skill.id ? 'active' : 'hidden'}`} style={{ display: isActive && editingSkill !== skill.id ? 'flex' : 'none', background: '#0a0a0a', padding: '12px', gap: '8px', alignItems: 'center', borderTop: 'none', borderRadius: '0 0 8px 8px' }}>
                  <button className="bg-[#1a1a1a] border border-[#333] hover:bg-[#333] hover:border-gray-500 text-gray-400 hover:text-white uppercase font-bold text-xs tracking-wider rounded py-2 px-1 transition-all" style={{ flex: 1 }} onClick={() => { setUseSkillModalId(skill.id); setSkillModalTested(false); }}>USAR</button>
                  <button className="bg-transparent hover:bg-[#222] text-gray-600 hover:text-white p-2 rounded transition-colors border-none cursor-pointer" onClick={() => setEditingSkill(skill.id)}><Edit2 size={18} /></button>
                </div>
                
                <div className={`skill-details ${editingSkill === skill.id ? 'active' : 'hidden'}`} style={{ display: editingSkill === skill.id ? 'block' : 'none' }}>
                  <input type="text" className="input-dark" placeholder="Nome da Skill" value={skill.name} onChange={e => updateSkill(skill.id, 'name', e.target.value)} />
                  <input type="number" className="input-dark" placeholder="Custo PE" value={skill.cost} onChange={e => updateSkill(skill.id, 'cost', e.target.value)} />
                  <textarea className="input-dark" placeholder="Descrição" rows={2} value={skill.desc} onChange={e => updateSkill(skill.id, 'desc', e.target.value)} />
                  
                  <label className="flex items-center gap-2 text-[10px] text-gray-500 mb-2 cursor-pointer mt-2">
                     <input type="checkbox" checked={skill.needsTest || false} onChange={e => updateSkill(skill.id, 'needsTest', e.target.checked)} className="bg-black border-gray-700" />
                     Necessita Teste (Exige Rolar Teste antes de Dano)
                  </label>

                  <div style={{ display: 'flex', gap: '10px', marginBottom: '10px' }}>
                    <div style={{ flex: 1 }}>
                       <label style={{ fontSize: '10px', color: '#888' }}>Fórmula de Teste</label>
                       <input type="text" className="input-dark mb-0" placeholder="Ex: 1D20+OCU" value={skill.test} onChange={e => updateSkill(skill.id, 'test', e.target.value)} />
                    </div>
                    <div style={{ flex: 1 }}>
                       <label style={{ fontSize: '10px', color: '#888' }}>Fórmula de Dano</label>
                       <input type="text" className="input-dark mb-0" placeholder="Ex: 1D8+FOR" value={skill.damage} onChange={e => updateSkill(skill.id, 'damage', e.target.value)} />
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: '10px' }}>
                    <div style={{ flex: 1 }}>
                       <label style={{ fontSize: '10px', color: '#888' }}>Salvar Teste Em Var: (Opcional)</label>
                       <select className="input-dark" value={skill.testVar || ''} onChange={e => updateSkill(skill.id, 'testVar', e.target.value)}>
                          <option value="">-- Nenhuma --</option>
                          {Object.keys(state.variables).map(v => <option key={v} value={v}>{v}</option>)}
                       </select>
                    </div>
                    <div style={{ flex: 1 }}>
                       <label style={{ fontSize: '10px', color: '#888' }}>Salvar Dano Em Var: (Opcional)</label>
                       <select className="input-dark" value={skill.damageVar || ''} onChange={e => updateSkill(skill.id, 'damageVar', e.target.value)}>
                          <option value="">-- Nenhuma --</option>
                          {Object.keys(state.variables).map(v => <option key={v} value={v}>{v}</option>)}
                       </select>
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: '10px', marginBottom: '10px' }}>
                    <div style={{ flex: 1 }}>
                       <label style={{ fontSize: '10px', color: '#888' }}>Após Teste Setar Var:</label>
                       <select className="input-dark mb-1" value={skill.testPostVar || ''} onChange={e => updateSkill(skill.id, 'testPostVar', e.target.value)}>
                          <option value="">-- Nenhuma --</option>
                          {Object.keys(state.variables).map(v => <option key={v} value={v}>{v}</option>)}
                       </select>
                       <input type="text" className="input-dark mb-0" placeholder="Fórmula (Ex: AD-AD)" value={skill.testPostFormula || ''} onChange={e => updateSkill(skill.id, 'testPostFormula', e.target.value)} />
                    </div>
                    <div style={{ flex: 1 }}>
                       <label style={{ fontSize: '10px', color: '#888' }}>Após Dano Setar Var:</label>
                       <select className="input-dark mb-1" value={skill.damagePostVar || ''} onChange={e => updateSkill(skill.id, 'damagePostVar', e.target.value)}>
                          <option value="">-- Nenhuma --</option>
                          {Object.keys(state.variables).map(v => <option key={v} value={v}>{v}</option>)}
                       </select>
                       <input type="text" className="input-dark mb-0" placeholder="Fórmula (Ex: AD-AD)" value={skill.damagePostFormula || ''} onChange={e => updateSkill(skill.id, 'damagePostFormula', e.target.value)} />
                    </div>
                  </div>

                  <div className="action-btns">
                    <button className="btn-action test" onClick={() => useSkill(skill, 'test')}>TESTE</button>
                    <button className="btn-action damage" onClick={() => useSkill(skill, 'damage')}>DANO</button>
                  </div>
                  <div className="action-btns" style={{ marginTop: '10px' }}>
                    <button className="btn-action" style={{ background: '#500' }} onClick={() => removeSkill(skill.id)}>EXCLUIR</button>
                    <button className="btn-action" style={{ background: '#222' }} onClick={() => setEditingSkill(null)}>FECHAR</button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
        {state.skills.length < 8 && <button className="btn-add" onClick={addSkill}>+ ADICIONAR SKILL</button>}

        <div className="paper-bar tributo-bar" onClick={toggleTributo}>
          <div className="tributo-header">{state.tributo.name || 'Nome do Tributo'}</div>
          <div style={{ fontSize: '14px', fontWeight: 'bold' }}>{state.tributo.desc}</div>
        </div>

        <div className={`skill-details ${activeTributo ? 'active' : ''}`} style={{ background: '#1a1a1a', padding: '15px' }}>
          <label style={{ display: 'block', marginBottom: '5px', fontSize: '12px', color: '#aaa' }}>Nome do Tributo</label>
          <input type="text" className="input-dark" value={state.tributo.name} onChange={e => updateTributo('name', e.target.value)} />
          <label style={{ display: 'block', marginBottom: '5px', fontSize: '12px', color: '#aaa' }}>Descrição</label>
          <textarea className="input-dark" rows={2} value={state.tributo.desc} onChange={e => updateTributo('desc', e.target.value)} />
          <label style={{ display: 'block', marginBottom: '5px', fontSize: '12px', color: '#aaa' }}>Efeito Passivo</label>
          <textarea className="input-dark" rows={2} value={state.tributo.passivo} onChange={e => updateTributo('passivo', e.target.value)} />
          <label style={{ display: 'block', marginBottom: '5px', fontSize: '12px', color: '#aaa' }}>Efeito Ativo</label>
          <textarea className="input-dark" rows={2} value={state.tributo.ativo} onChange={e => updateTributo('ativo', e.target.value)} />
        </div>
      </div>

      <div className="section">
        <div className="section-title">Inventário</div>
        <div className="inv-grid">
          {[0, 1, 2, 3, 4, 5].map(i => (
            <input key={i} type="text" className="inv-slot" placeholder={`Slot ${i + 1}`} value={state.inventory[i]} onChange={e => updateInventory(i, e.target.value)} />
          ))}
        </div>
      </div>

      <div className="section">
        <div className="section-title">Sistema Demologia</div>
        <div className="menu-grid">
          <button className="btn-menu" onClick={exportData}>Exportar JSON</button>
          <button className="btn-menu" onClick={importData}>Importar JSON</button>
          <button className="btn-menu" onClick={clearHistory} style={{ color: '#ffaa00' }}>{confirmClear ? "CONFIRME" : "Limpar Histórico"}</button>
          <button className="btn-menu" onClick={resetData} style={{ color: 'var(--blood-red)' }}>{confirmReset ? "CONFIRME O RESET" : "Resetar Ficha"}</button>
        </div>
      </div>
      </>
      )}

      {currentPage === 'conexao' && (
        <>
          <div className="p-4 pt-8 min-h-screen text-center flex flex-col items-center justify-center max-w-lg mx-auto pb-20">
             <h2 className="text-3xl font-bold text-blood-red uppercase tracking-widest mb-4">Conexão da Ficha</h2>
             <p className="text-gray-400 text-sm mb-8">
               Ativar a conexão compartilha sua ficha em tempo real com o Mestre. Se você for desconectado, reative-a aqui.
             </p>
             <button 
                onClick={() => {
                   if (!isOnline) {
                       setIsOnline(true);
                       if (userUid) {
                          supabase.from('players').upsert({
                            id: userUid,
                            data: state,
                            updated_at: new Date().toISOString()
                          }).then(({ error }) => {
                            if (error) console.error("Error syncing to Supabase:", error.message);
                          });
                       }
                   } else {
                       setIsOnline(false);
                       if (userUid) supabase.from('players').delete().eq('id', userUid);
                   }
                }}
                className={`w-full py-4 px-8 text-lg font-bold uppercase tracking-wider rounded transition-all cursor-pointer border ${isOnline ? 'bg-green-900 border-green-500 hover:bg-green-800 text-white shadow-[0_0_15px_rgba(34,197,94,0.3)]' : 'bg-[#1a0505] border-blood-red hover:bg-[#300505] text-blood-red shadow-[0_0_15px_rgba(211,0,0,0.3)]'}`}
             >
                {isOnline ? "CONECTADO A SESSÃO" : "DESCONECTADO DA SESSÃO"}
             </button>
             <p className="text-[10px] text-gray-500 mt-4 uppercase">Para alterar o status apenas aperte o botão</p>
          </div>
        </>
      )}

      {currentPage === 'mestre' && (
        <>
          <div className="p-4 pt-8 min-h-screen pb-20">
            <div className="flex flex-col items-center justify-center text-center mb-6">
               <ShieldAlert size={48} className="text-blood-red opacity-50 mb-2" />
               <h2 className="text-2xl font-bold text-blood-red uppercase tracking-widest mb-1">Painel do Mestre</h2>
            </div>

            <div className="flex gap-4 justify-center mb-8">
              <button 
                onClick={() => setMestreTab('fichas')} 
                className={`px-4 py-2 border-b-2 font-bold uppercase tracking-wider text-sm transition-colors ${mestreTab === 'fichas' ? 'border-blood-red text-blood-red' : 'border-transparent text-gray-500 hover:text-white'}`}
              >
                Fichas
              </button>
              <button 
                onClick={() => setMestreTab('ost')} 
                className={`px-4 py-2 border-b-2 font-bold uppercase tracking-wider text-sm transition-colors ${mestreTab === 'ost' ? 'border-blood-red text-blood-red' : 'border-transparent text-gray-500 hover:text-white'}`}
              >
                Trilha Sonora (OST)
              </button>
            </div>

            {mestreTab === 'fichas' ? (
              <>
                <div className="flex flex-col items-center justify-center text-center mb-6">
                   <p className="text-gray-500 text-xs max-w-sm mb-4">
                      Exibindo todas as fichas ativas (atualização em tempo real). 
                   </p>
                   <button 
                     onClick={() => {
                       const newInits: Record<string, number> = {};
                       players.forEach(p => {
                          const agl = p.variables?.['AGL'] || 0;
                          const roll = Math.floor(Math.random() * 20) + 1;
                          newInits[p.id] = roll + agl;
                       });
                       setInitiatives({ ...initiatives, ...newInits });
                     }}
                     className="flex items-center justify-center gap-2 bg-[#1a1a1a] hover:bg-[#222] border border-[#333] hover:border-blood-red/50 text-gray-300 hover:text-white font-bold py-3 px-6 rounded uppercase tracking-wider text-xs transition-all shadow-[0_0_15px_rgba(0,0,0,0.5)]"
                   >
                     <Dices size={16} className="text-blood-red" />
                     Gerar Iniciativas (1d20 + AGL)
                   </button>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 max-w-6xl mx-auto">
              {[...players].sort((a, b) => (initiatives[b.id] ?? -1) - (initiatives[a.id] ?? -1)).map(p => (
                <div key={p.id} className="bg-[#0a0a0a] border border-[#222] rounded p-4 relative overflow-hidden">
                  <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blood-red to-transparent opacity-50"></div>
                  <div className="flex justify-between items-start mb-2">
                     <div>
                        <div className="text-blood-red font-bold text-lg uppercase tracking-wider">{p.name || 'Desconhecido'}</div>
                        <div className="text-green-500 font-mono text-[10px] uppercase">● Ficha Conectada</div>
                     </div>
                     <div className="flex items-stretch gap-2 shrink-0">
                       {initiatives[p.id] !== undefined && (
                         <div className="bg-[#111] border border-[#333] text-blood-red px-2 py-1 flex flex-col items-center justify-center rounded min-w-[40px]" title="Iniciativa">
                           <span className="text-[8px] uppercase text-gray-500 leading-none">Inic.</span>
                           <span className="font-bold text-sm leading-none mt-1">{initiatives[p.id]}</span>
                         </div>
                       )}
                       <button onClick={() => kickPlayer(p.id)} className="text-gray-500 hover:text-red-500 bg-black/50 border border-gray-800 hover:border-red-900/50 p-2 rounded transition-all flex items-center justify-center" title="Desconectar Jogador">
                          <Trash2 size={16} />
                       </button>
                     </div>
                  </div>
                  
                  <div className="flex gap-4 mt-4 bg-[#111] border border-[#222] rounded-lg p-3">
                    <div className="flex-1 text-center">
                      <div className="text-[10px] text-gray-500 mb-1 uppercase tracking-widest">Saúde (HP)</div>
                      <div className="flex items-center justify-center gap-1">
                        <MestreStatInput 
                               value={p.hp?.current ?? 0}
                               onSave={(val) => {
                                 setPlayers(current => current.map(pl => pl.id === p.id ? { ...pl, hp: { ...pl.hp, current: val } } : pl));
                                 editPlayerStatExact(p, 'hp', val);
                               }}
                               className="w-12 bg-transparent text-center outline-none border-b border-dashed border-[#333] focus:border-green-500 text-green-500 font-bold text-xl" />
                        <span className="text-gray-600 text-[10px] uppercase">/ {p.hp?.max}</span>
                      </div>
                    </div>
                    <div className="w-[1px] bg-[#222]"></div>
                    <div className="flex-1 text-center">
                      <div className="text-[10px] text-gray-500 mb-1 uppercase tracking-widest">Esforço (PE)</div>
                      <div className="flex items-center justify-center gap-1">
                        <MestreStatInput 
                               value={p.pe?.current ?? 0}
                               onSave={(val) => {
                                 setPlayers(current => current.map(pl => pl.id === p.id ? { ...pl, pe: { ...pl.pe, current: val } } : pl));
                                 editPlayerStatExact(p, 'pe', val);
                               }}
                               className="w-12 bg-transparent text-center outline-none border-b border-dashed border-[#333] focus:border-blue-500 text-blue-500 font-bold text-xl" />
                        <span className="text-gray-600 text-[10px] uppercase">/ {p.pe?.max}</span>
                      </div>
                    </div>
                  </div>

                  {p.history && p.history.length > 0 && (
                     <div className="mt-4 pt-4 border-t border-[#222]">
                        <div className="text-[10px] text-gray-500 mb-2">Última Ação:</div>
                        <div className="text-xs text-gray-400 line-clamp-2" dangerouslySetInnerHTML={{ __html: p.history[0] }}></div>
                     </div>
                  )}
                </div>
              ))}
              {players.length === 0 && (
                <div className="col-span-full text-center text-gray-500 italic py-10 border border-dashed border-[#333] rounded">
                  Nenhum jogador conectado no momento.<br/>
                  <span className="text-[10px]">A ficha do jogador será sincronizada automaticamente.</span>
                </div>
              )}
            </div>
              </>
            ) : (
              <div className="max-w-2xl mx-auto flex flex-col gap-6">
                 <div className="bg-[#0a0a0a] border border-[#222] rounded p-6 shadow-[0_0_15px_rgba(0,0,0,0.5)]">
                    <h3 className="text-xl font-bold text-blood-red uppercase tracking-widest mb-4">Gerenciador de Músicas</h3>
                    <p className="text-gray-400 text-xs mb-6">Importe arquivos .mp3 para sincronizar e reproduzir na ficha de todos os jogadores ativos. Limite o uso de arquivos muito grandes para evitar lentidão.</p>
                    
                    <div className="flex gap-4 items-center mb-6 border-b border-[#222] pb-6">
                        <label className={`flex-1 border border-dashed hover:border-blood-red transition-all cursor-pointer rounded py-6 flex flex-col items-center justify-center gap-2 ${isUploadingOst ? 'bg-[#111] border-blood-red opacity-50' : 'bg-black/50 border-[#555] hover:bg-[#111]'}`}>
                           <span className="text-gray-400 text-sm font-bold uppercase tracking-wider text-center">{isUploadingOst ? 'Importando...' : 'Selecionar MP3'}</span>
                           <span className="text-[#666] text-[10px]">Apenas .mp3 (Max 2MB)</span>
                           <input 
                             type="file" 
                             accept=".mp3" 
                             className="hidden" 
                             disabled={isUploadingOst}
                             onChange={(e) => {
                                const file = e.target.files?.[0];
                                if (!file) return;
                                if (file.size > 2 * 1024 * 1024) {
                                   alert('Arquivo muito grande, limite de 2MB. Comprima o MP3.');
                                   return;
                                }
                                setIsUploadingOst(true);
                                const reader = new FileReader();
                                reader.onload = async () => {
                                    const base64 = reader.result;
                                    const ostId = `OST_FILE_${Date.now()}_${encodeURIComponent(file.name)}`;
                                    await supabase.from('players').upsert({ id: ostId, data: { base64, name: file.name }, updated_at: new Date().toISOString() });
                                    fetchOsts();
                                    setIsUploadingOst(false);
                                };
                                reader.readAsDataURL(file);
                             }} 
                           />
                        </label>
                    </div>

                    <div className="flex flex-col gap-3">
                       <h4 className="text-gray-500 uppercase tracking-widest text-[10px] mb-2">Selecione uma faixa e regule:</h4>
                       <div className="flex flex-col gap-2 max-h-64 overflow-y-auto pr-2 no-scrollbar">
                           {ostList.length === 0 && (
                              <div className="text-center text-[#555] italic text-xs py-4">Nenhuma música importada.</div>
                           )}
                           {ostList.map(ost => {
                              const rawName = ost.id.split('_').slice(3).join('_');
                              const ostName = decodeURIComponent(rawName);
                              const isCurrent = globalOstState?.ostId === ost.id;

                              return (
                                 <div key={ost.id} className={`flex flex-col sm:flex-row items-start sm:items-center justify-between p-4 border rounded transition-all gap-4 ${isCurrent ? 'bg-[#1a0505] border-blood-red' : 'bg-[#111] border-[#333] hover:border-[#555]'}`}>
                                    <div className="flex flex-col w-full sm:w-auto overflow-hidden">
                                       <span className={`truncate text-sm font-bold ${isCurrent ? 'text-blood-red' : 'text-gray-300'}`}>{ostName || 'Desconhecida'}</span>
                                    </div>
                                    <div className="flex items-center gap-2 w-full sm:w-auto justify-between sm:justify-end">
                                       {isCurrent ? (
                                         <>
                                            <button 
                                              onClick={() => {
                                                 const newIsPlaying = !globalOstState?.isPlaying;
                                                 const stateData = { ...globalOstState, isPlaying: newIsPlaying };
                                                 setGlobalOstState(stateData);
                                                 supabase.from('players').upsert({ id: 'MASTER_STATE', data: { ost: stateData } });
                                              }}
                                              className={`flex-1 sm:flex-none px-4 py-3 sm:py-2 uppercase font-bold text-[10px] rounded border transition-all ${globalOstState?.isPlaying ? 'bg-blood-red border-blood-red text-white' : 'bg-[#222] border-[#444] text-gray-300 hover:text-white'}`}
                                            >
                                               {globalOstState?.isPlaying ? 'Pausar (Fade Out)' : 'Tocar (Fade In)'}
                                            </button>
                                            {globalOstState?.isPlaying && audioRef.current?.paused && !requiresInteraction && (
                                                <button 
                                                   onClick={() => { if (audioRef.current) audioRef.current.play().catch(console.error); }}
                                                   className="ml-2 px-3 py-2 bg-yellow-600 text-white text-[10px] font-bold rounded animate-pulse"
                                                >
                                                    Som Travado? Clicar!
                                                </button>
                                            )}
                                         </>
                                       ) : (
                                         <button 
                                           onClick={() => {
                                              const stateData = { ostId: ost.id, name: ostName, isPlaying: false, volume: 1 };
                                              setGlobalOstState(stateData);
                                              supabase.from('players').upsert({ id: 'MASTER_STATE', data: { ost: stateData } });
                                           }}
                                           className="flex-1 sm:flex-none px-4 py-3 sm:py-2 bg-[#222] border border-[#444] text-gray-300 hover:text-white hover:border-blood-red uppercase font-bold text-[10px] rounded transition-all"
                                         >
                                            Selecionar
                                         </button>
                                       )}
                                       <button 
                                          onClick={async () => {
                                             if (confirm('Deletar essa música permanentemente?')) {
                                                 await supabase.from('players').delete().eq('id', ost.id);
                                                 if (isCurrent) await supabase.from('players').delete().eq('id', 'MASTER_STATE');
                                                 fetchOsts();
                                             }
                                          }}
                                          className="p-3 sm:p-2 text-gray-500 hover:text-red-500 bg-[#222] rounded border border-[#444]"
                                       >
                                          <Trash2 size={16} />
                                       </button>
                                    </div>
                                 </div>
                              );
                           })}
                       </div>
                    </div>

                    {globalOstState?.ostId && (
                       <div className="mt-8 p-4 bg-[#111] border border-blood-red/30 rounded">
                          <div className="flex justify-between items-center mb-4">
                             <div className="text-gray-400 text-xs uppercase tracking-widest">Faixa em Destaque</div>
                             <div className="text-blood-red font-bold text-sm truncate max-w-[200px]">{globalOstState?.name}</div>
                          </div>
                          
                          <div className="flex flex-col gap-2">
                             <div className="flex justify-between text-gray-500 text-[10px] uppercase">
                                <span>Volume Base (Fade To)</span>
                                <span>{Math.round((globalOstState?.volume ?? 1) * 100)}%</span>
                             </div>
                             <input 
                                type="range" 
                                min="0" max="1" step="0.05" 
                                value={globalOstState?.volume ?? 1} 
                                onChange={(e) => {
                                   const newVol = Number(e.target.value);
                                   const stateData = { ...globalOstState, volume: newVol };
                                   // optimistically update local state immediately to avoid lag
                                   setGlobalOstState(stateData);
                                   supabase.from('players').upsert({ id: 'MASTER_STATE', data: { ost: stateData } });
                                }}
                                className="w-full accent-blood-red"
                             />
                             <div className="text-[#555] text-[10px] mt-1 italic text-center">Os jogadores terão o áudio no munto sincronizado gradualmente (Fade).</div>
                          </div>
                       </div>
                    )}
                 </div>
              </div>
            )}
          </div>
        </>
      )}

      {useSkillModalId !== null && (() => {
        const modalSkill = state.skills.find((s: any) => s.id === useSkillModalId);
        if (!modalSkill) return null;
        return (
          <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4">
            <div className="bg-[#0a0a0a] border border-[#333] rounded-lg w-full max-w-sm flex flex-col p-4 gap-4 shadow-[0_0_20px_rgba(0,0,0,0.8)]">
               <div className="flex justify-between items-center border-b border-[#222] pb-2">
                  <h3 className="font-bold text-blood-red uppercase tracking-widest">{modalSkill.name || 'Nova Skill'}</h3>
                  <button onClick={() => setUseSkillModalId(null)} className="text-gray-500 hover:text-white"><X size={20} /></button>
               </div>
               
               <div className="h-48 overflow-y-auto bg-[#111] p-3 border border-[#222] rounded text-[13px] text-[#aaa] flex flex-col shadow-[inset_0_0_10px_#000]">
                  {state.history.length > 0 ? state.history.slice(0, 10).map((h, i) => (
                     <div key={i} className="log-entry" dangerouslySetInnerHTML={{ __html: h }} />
                  )) : <span className="opacity-50 italic">Nenhum log de rolagem.</span>}
               </div>

               <div className="flex gap-2">
                  {modalSkill.test?.trim() !== "" && (
                    <button 
                      className="flex-1 bg-[#1a1a1a] border border-[#333] hover:bg-[#333] hover:border-gray-500 text-gray-400 hover:text-white uppercase font-bold text-[10px] tracking-wider rounded py-3 transition-all cursor-pointer"
                      onClick={() => {
                         useSkill(modalSkill, 'test');
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
                            addToHistory('<span style="color: #ffaa00;">Realize o teste antes do dano!</span>');
                            return;
                         }
                         useSkill(modalSkill, 'damage');
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
  );
}
