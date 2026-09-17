import React, { useState } from 'react';
import {
  Play,
  Settings,
  Clock,
  Image as ImageIcon,
  Layers,
  Plus,
  X,
  Save,
  ArrowLeft,
  Trash2,
  ArrowRight,
  ArrowUp,
  ArrowDown,
  StopCircle,
  Upload,
  Undo2,
  Music,
  PauseCircle,
  Contrast,
  Copy,
  GripVertical,
  Clapperboard,
  Sparkles
} from 'lucide-react';
import { supabase } from './lib/supabase';

export const SkillBuilder = ({
  savedEvents,
  setSavedEvents,
  userUid,
  globalChannelRef,
  players,
  activeToggles,
  ostList = []
}: any) => {
  const [editingEvent, setEditingEvent] = useState<any>(null);
  const [showPlayerSelect, setShowPlayerSelect] = useState<{ eventId: string; action?: string } | null>(null);
  const [showAddMenuMain, setShowAddMenuMain] = useState(false);
  const [showAddMenuBlock, setShowAddMenuBlock] = useState(false);

  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  const saveToMaster = async (eventsList: any[]) => {
    setSavedEvents(eventsList);
    localStorage.setItem('local_master_events', JSON.stringify(eventsList));
    await supabase.from('players').upsert({
      id: 'MASTER_EVENTS',
      data: { events: eventsList },
      updated_at: new Date().toISOString()
    });
  };

  const createEvent = (isToggle: boolean) => {
    setEditingEvent({
      id: Date.now().toString(),
      name: `Novo Evento ${savedEvents.length + 1}`,
      isToggle,
      blocks: []
    });
    setShowAddMenuMain(false);
  };

  const saveEditing = async () => {
    let newList = [...savedEvents];
    const idx = newList.findIndex(e => e.id === editingEvent.id);
    if (idx >= 0) newList[idx] = editingEvent;
    else newList.push(editingEvent);

    await saveToMaster(newList);
    setEditingEvent(null);
  };

  const deleteEvent = async (id: string) => {
    if (!confirm('Deletar este evento permanentemente?')) return;
    const newList = savedEvents.filter((e: any) => e.id !== id);
    await saveToMaster(newList);
  };

  const addBlock = (type: string) => {
    let defaultBlock: any = { id: Date.now().toString(), type, value: null };
    if (type === 'aguarde') defaultBlock.value = 1;
    else if (type === 'mudar_fundo') defaultBlock.value = '';
    else if (type === 'imagem_fade') defaultBlock.value = 50;
    else if (type === 'play_ost') {
      defaultBlock.ostId = '';
      defaultBlock.volume = 1;
      defaultBlock.fadeTime = 1;
    } else if (type === 'stop_ost') {
      defaultBlock.fadeTime = 1;
    } else if (type === 'cutscene') {
      defaultBlock.title = '';
      defaultBlock.subtitle = '';
      defaultBlock.zoom = 2.5;
      defaultBlock.bars = true;
      defaultBlock.duration = 6;
      defaultBlock.ostId = '';
      defaultBlock.textColor = '#FFFFFF';
      defaultBlock.subtitleColor = '#ef4444';
      defaultBlock.fontFamily = '';
      defaultBlock.textShadow = true;
    } else if (type === 'fade_block') {
      defaultBlock.opacityStart = 0;
      defaultBlock.opacityEnd = 1;
      defaultBlock.duration = 1;
      defaultBlock.fadeStyle = 'Linear';
      defaultBlock.layer = 'Tela';
    } else if (type === 'open_board') {
      defaultBlock.aba = 'null';
      defaultBlock.delay = 0;
    }

    setEditingEvent((prev: any) => ({
      ...prev,
      blocks: [...prev.blocks, defaultBlock]
    }));
    setShowAddMenuBlock(false);
  };

  const removeBlock = (id: string) => {
    setEditingEvent((prev: any) => ({
      ...prev,
      blocks: prev.blocks.filter((b: any) => b.id !== id)
    }));
  };

  const moveBlock = (index: number, direction: -1 | 1) => {
    setEditingEvent((prev: any) => {
      const blocks = [...prev.blocks];
      if (index + direction < 0 || index + direction >= blocks.length) return prev;
      const temp = blocks[index];
      blocks[index] = blocks[index + direction];
      blocks[index + direction] = temp;
      return { ...prev, blocks };
    });
  };

  const duplicateBlock = (id: string) => {
    setEditingEvent((prev: any) => {
      if (!prev || !prev.blocks) return prev;
      const index = prev.blocks.findIndex((b: any) => b.id === id);
      if (index === -1) return prev;
      const blockToCopy = prev.blocks[index];
      const duplicatedBlock = {
        ...blockToCopy,
        id: `${Date.now()}_${Math.random().toString(36).substr(2, 5)}`
      };
      const newBlocks = [...prev.blocks];
      newBlocks.splice(index + 1, 0, duplicatedBlock);
      return { ...prev, blocks: newBlocks };
    });
  };

  const handleDragStart = (e: React.DragEvent, index: number) => {
    const target = e.target as HTMLElement;
    const closestInteractive = target.closest(
      'input, select, button, label, select option, input[type="range"]'
    );
    if (closestInteractive) {
      e.preventDefault();
      return;
    }
    setDraggedIndex(index);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === index) return;
    setDragOverIndex(index);
  };

  const handleDragEnd = () => {
    setDraggedIndex(null);
    setDragOverIndex(null);
  };

  const handleDrop = (e: React.DragEvent, targetIndex: number) => {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === targetIndex) return;

    setEditingEvent((prev: any) => {
      if (!prev || !prev.blocks) return prev;
      const blocks = [...prev.blocks];
      const draggedBlock = blocks[draggedIndex];

      blocks.splice(draggedIndex, 1);
      blocks.splice(targetIndex, 0, draggedBlock);

      return { ...prev, blocks };
    });

    setDraggedIndex(null);
    setDragOverIndex(null);
  };

  const updateBlock = (id: string, value: any) => {
    setEditingEvent((prev: any) => ({
      ...prev,
      blocks: prev.blocks.map((b: any) => (b.id === id ? { ...b, value } : b))
    }));
  };

  const updateBlockFields = (id: string, fields: any) => {
    setEditingEvent((prev: any) => ({
      ...prev,
      blocks: prev.blocks.map((b: any) => (b.id === id ? { ...b, ...fields } : b))
    }));
  };

  const executeEvent = (eventData: any, target: string, action: 'start' | 'stop' = 'start') => {
    setShowPlayerSelect(null);

    globalChannelRef.current
      ?.send({
        type: 'broadcast',
        event: 'builder_event',
        payload: {
          target,
          eventId: eventData.id,
          isToggle: eventData.isToggle,
          action
        }
      })
      .catch(console.error);
  };

  if (editingEvent) {
    return (
      <div className="max-w-4xl mx-auto px-4 pb-28 font-mono">
        {/* Editor Top Bar */}
        <div className="flex flex-wrap items-center justify-between gap-4 py-4 mb-6 border-b border-[#222]">
          <button
            onClick={() => setEditingEvent(null)}
            className="flex items-center gap-2 px-3 py-2 bg-[#121216] border border-[#2a2a30] text-gray-300 hover:text-white hover:border-gray-500 uppercase text-xs font-bold transition-colors cursor-pointer"
          >
            <ArrowLeft size={16} /> Voltar aos Eventos
          </button>

          <div className="flex items-center gap-3">
            <button
              onClick={saveEditing}
              className="flex items-center gap-2 px-5 py-2.5 bg-blood-red hover:bg-[#a61a20] border border-blood-red/60 text-white uppercase text-xs font-bold tracking-widest transition-colors cursor-pointer"
            >
              <Save size={16} /> Salvar Evento
            </button>
          </div>
        </div>

        {/* Title and Type Header */}
        <div className="p-4 bg-[#0e0e12] border border-[#222] mb-6">
          <div className="text-[10px] uppercase font-bold text-gray-500 tracking-widest mb-1.5">
            Configuração do Gatilho
          </div>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <input
              value={editingEvent.name}
              onChange={(e) => setEditingEvent({ ...editingEvent, name: e.target.value })}
              className="bg-[#141418] border border-[#2a2a30] text-lg font-bold text-white px-3 py-2 outline-none w-full uppercase tracking-wider focus:border-blood-red transition-colors"
              placeholder="NOME DO EVENTO"
            />
            {editingEvent.isToggle ? (
              <span className="px-3 py-1.5 bg-yellow-950/40 border border-yellow-700/50 text-yellow-400 text-xs uppercase font-bold tracking-wider whitespace-nowrap self-start sm:self-center">
                Modo: Toggle (Liga/Desliga)
              </span>
            ) : (
              <span className="px-3 py-1.5 bg-[#1a1a22] border border-[#333] text-gray-400 text-xs uppercase font-bold tracking-wider whitespace-nowrap self-start sm:self-center">
                Modo: Execução Única
              </span>
            )}
          </div>
        </div>

        {/* Blocks Timeline */}
        <div className="flex flex-col gap-3 relative">
          <div className="absolute top-4 bottom-4 left-[19px] w-[2px] bg-[#1e1e24] z-0" />

          {editingEvent.blocks.length === 0 && (
            <div className="relative z-10 text-center py-12 text-gray-500 uppercase text-xs font-bold tracking-widest border border-dashed border-[#222] bg-[#0c0c10]">
              Nenhum bloco de ação configurado.
              <div className="mt-2 text-gray-600 text-[11px]">
                Utilize o painel abaixo para adicionar comandos.
              </div>
            </div>
          )}

          {editingEvent.blocks.map((block: any, index: number) => (
            <div key={block.id} className="relative z-10 flex gap-3 group">
              {/* Timeline Indicator */}
              <div className="w-10 flex items-start justify-center pt-4 select-none shrink-0">
                <div
                  className={`w-3.5 h-3.5 border border-black ${
                    block.type === 'quando_iniciado'
                      ? 'bg-yellow-500'
                      : block.type.includes('fundo')
                      ? 'bg-purple-500'
                      : block.type.includes('ost')
                      ? 'bg-emerald-500'
                      : block.type === 'cutscene'
                      ? 'bg-red-500'
                      : 'bg-blue-500'
                  }`}
                />
              </div>

              {/* Block Card */}
              <div
                draggable
                onDragStart={(e) => handleDragStart(e, index)}
                onDragOver={(e) => handleDragOver(e, index)}
                onDragEnd={handleDragEnd}
                onDrop={(e) => handleDrop(e, index)}
                className={`flex-1 flex flex-col p-4 bg-[#0e0e12] border transition-all ${
                  block.type === 'quando_iniciado'
                    ? 'border-yellow-900/40 bg-yellow-950/10'
                    : block.type.includes('fundo')
                    ? 'border-purple-900/40 bg-purple-950/10'
                    : block.type.includes('ost')
                    ? 'border-emerald-900/40 bg-emerald-950/10'
                    : block.type === 'cutscene'
                    ? 'border-red-900/40 bg-red-950/10'
                    : 'border-[#222]'
                } ${
                  draggedIndex === index ? 'opacity-30 border-dashed border-gray-600' : ''
                } ${
                  dragOverIndex === index && draggedIndex !== index
                    ? 'border-dashed border-blood-red bg-red-950/20'
                    : ''
                }`}
              >
                {/* Block Header Toolbar */}
                <div className="flex items-center justify-between pb-3 mb-3 border-b border-[#1c1c24]">
                  <div className="flex items-center gap-2">
                    <div
                      className="text-gray-600 hover:text-gray-300 cursor-grab active:cursor-grabbing p-1"
                      title="Arrastar para reordenar"
                    >
                      <GripVertical size={16} />
                    </div>
                    <span className="text-xs uppercase font-bold text-gray-400">
                      Passo #{index + 1}
                    </span>
                  </div>

                  <div className="flex items-center gap-1 select-none">
                    <button
                      title="Duplicar Bloco"
                      onClick={(e) => {
                        e.stopPropagation();
                        duplicateBlock(block.id);
                      }}
                      className="p-1 text-gray-500 hover:text-yellow-400 hover:bg-[#1c1c24] transition-colors cursor-pointer"
                    >
                      <Copy size={14} />
                    </button>
                    <div className="w-[1px] h-3.5 bg-[#222] mx-1" />
                    <button
                      disabled={index === 0}
                      onClick={(e) => {
                        e.stopPropagation();
                        moveBlock(index, -1);
                      }}
                      className="p-1 text-gray-500 hover:text-white hover:bg-[#1c1c24] disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
                    >
                      <ArrowUp size={14} />
                    </button>
                    <button
                      disabled={index === editingEvent.blocks.length - 1}
                      onClick={(e) => {
                        e.stopPropagation();
                        moveBlock(index, 1);
                      }}
                      className="p-1 text-gray-500 hover:text-white hover:bg-[#1c1c24] disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
                      title="Mover para baixo"
                    >
                      <ArrowDown size={14} />
                    </button>
                    <div className="w-[1px] h-3.5 bg-[#222] mx-1" />
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        removeBlock(block.id);
                      }}
                      className="p-1 text-gray-500 hover:text-red-500 hover:bg-red-950/20 transition-colors cursor-pointer"
                      title="Excluir Bloco"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>

                {/* Block Content by Type */}
                <div>
                  {block.type === 'quando_iniciado' && (
                    <div className="flex items-center gap-2">
                      <Play size={18} className="text-yellow-500" />
                      <span className="font-bold uppercase tracking-wider text-xs text-yellow-500">
                        Quando o Evento for Acionado
                      </span>
                    </div>
                  )}

                  {block.type === 'aguarde' && (
                    <div className="flex flex-wrap items-center gap-3">
                      <div className="flex items-center gap-2 min-w-[120px]">
                        <Clock size={18} className="text-blue-400" />
                        <span className="font-bold uppercase tracking-wider text-xs text-blue-400">
                          Aguarde
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          step="0.1"
                          value={block.value}
                          onChange={(e) =>
                            updateBlock(block.id, parseFloat(e.target.value) || 0)
                          }
                          className="bg-[#141418] border border-[#2a2a30] w-24 text-center text-white px-2 py-1.5 text-xs font-mono focus:border-blue-500 outline-none"
                        />
                        <span className="text-gray-400 text-xs uppercase font-bold">Segundos</span>
                      </div>
                    </div>
                  )}

                  {block.type === 'mudar_fundo' && (
                    <div className="flex flex-col gap-2.5">
                      <div className="flex items-center gap-2">
                        <ImageIcon size={18} className="text-purple-400" />
                        <span className="font-bold uppercase tracking-wider text-xs text-purple-400">
                          Trocar Imagem ou Vídeo de Fundo
                        </span>
                      </div>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          placeholder="URL da Imagem ou Vídeo (.mp4)"
                          value={
                            typeof block.value === 'string'
                              ? block.value
                              : block.value?.data || ''
                          }
                          onChange={(e) => updateBlock(block.id, e.target.value)}
                          className="bg-[#141418] border border-[#2a2a30] flex-1 text-white px-3 py-1.5 text-xs focus:border-purple-500 outline-none"
                        />
                        <label className="bg-[#181820] hover:bg-[#22222a] border border-[#2a2a30] text-gray-300 hover:text-white px-3 py-1.5 cursor-pointer flex items-center justify-center transition-colors">
                          <Upload size={16} />
                          <input
                            type="file"
                            accept="image/*,video/mp4,video/*"
                            className="hidden"
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (file) {
                                const reader = new FileReader();
                                reader.onload = (ev) => {
                                  updateBlock(block.id, ev.target?.result);
                                };
                                reader.readAsDataURL(file);
                              }
                            }}
                          />
                        </label>
                      </div>
                    </div>
                  )}

                  {block.type === 'fundo_original' && (
                    <div className="flex items-center gap-2">
                      <Undo2 size={18} className="text-purple-400" />
                      <span className="font-bold uppercase tracking-wider text-xs text-purple-400">
                        Restaurar Fundo Padrão da Sessão
                      </span>
                    </div>
                  )}

                  {block.type === 'imagem_fade' && (
                    <div className="flex flex-wrap items-center gap-3">
                      <div className="flex items-center gap-2 min-w-[120px]">
                        <Contrast size={18} className="text-purple-400" />
                        <span className="font-bold uppercase tracking-wider text-xs text-purple-400">
                          Escurecer Fundo
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          step="1"
                          min="0"
                          max="100"
                          value={block.value !== undefined ? block.value : 50}
                          onChange={(e) =>
                            updateBlock(block.id, parseFloat(e.target.value) || 0)
                          }
                          className="bg-[#141418] border border-[#2a2a30] w-20 text-center text-white px-2 py-1.5 text-xs font-mono focus:border-purple-500 outline-none"
                        />
                        <span className="text-gray-400 text-xs font-bold">% Opacidade</span>
                      </div>
                    </div>
                  )}

                  {block.type === 'play_ost' && (
                    <div className="flex flex-col gap-3">
                      <div className="flex items-center gap-2">
                        <Music size={18} className="text-emerald-400" />
                        <span className="font-bold uppercase tracking-wider text-xs text-emerald-400">
                          Tocar Trilha Sonora (OST)
                        </span>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                        <div className="flex flex-col gap-1">
                          <span className="text-[10px] uppercase text-gray-500">Faixa</span>
                          <select
                            value={block.ostId || ''}
                            onChange={(e) =>
                              updateBlockFields(block.id, { ostId: e.target.value })
                            }
                            className="bg-[#141418] border border-[#2a2a30] text-white px-2.5 py-1.5 text-xs focus:border-emerald-500 outline-none"
                          >
                            <option value="">(Nenhuma selecionada)</option>
                            {ostList.map((ost: any) => {
                              const rawName = ost.id.split('_').slice(3).join('_');
                              const ostName = decodeURIComponent(rawName);
                              return (
                                <option key={ost.id} value={ost.id}>
                                  {ostName || 'OST Sem Nome'}
                                </option>
                              );
                            })}
                          </select>
                        </div>

                        <div className="flex flex-col gap-1">
                          <div className="flex justify-between text-[10px] uppercase text-gray-500">
                            <span>Volume</span>
                            <span>
                              {Math.round((block.volume !== undefined ? block.volume : 1) * 100)}%
                            </span>
                          </div>
                          <input
                            type="range"
                            min="0"
                            max="1"
                            step="0.05"
                            value={block.volume !== undefined ? block.volume : 1}
                            onChange={(e) =>
                              updateBlockFields(block.id, {
                                volume: parseFloat(e.target.value) || 0
                              })
                            }
                            className="w-full accent-emerald-500 mt-1"
                          />
                        </div>

                        <div className="flex flex-col gap-1">
                          <span className="text-[10px] uppercase text-gray-500">Fade In</span>
                          <div className="flex items-center gap-2">
                            <input
                              type="number"
                              step="0.1"
                              value={block.fadeTime !== undefined ? block.fadeTime : 1}
                              onChange={(e) =>
                                updateBlockFields(block.id, {
                                  fadeTime: parseFloat(e.target.value) || 0
                                })
                              }
                              className="bg-[#141418] border border-[#2a2a30] w-16 text-center text-white px-2 py-1.5 text-xs font-mono focus:border-emerald-500 outline-none"
                            />
                            <span className="text-gray-400 text-xs">seg</span>
                            <label className="flex items-center gap-1 text-[10px] text-gray-400 uppercase font-bold cursor-pointer ml-auto">
                              <input
                                type="checkbox"
                                checked={block.resetBeforePlay || false}
                                onChange={(e) =>
                                  updateBlockFields(block.id, { resetBeforePlay: e.target.checked })
                                }
                                className="accent-emerald-500"
                              />
                              <span>Reset</span>
                            </label>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {block.type === 'stop_ost' && (
                    <div className="flex flex-wrap items-center gap-3">
                      <div className="flex items-center gap-2 min-w-[120px]">
                        <PauseCircle size={18} className="text-emerald-400" />
                        <span className="font-bold uppercase tracking-wider text-xs text-emerald-400">
                          Parar Trilha Sonora
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-gray-500 text-[10px] uppercase">Fade Out:</span>
                        <input
                          type="number"
                          step="0.1"
                          value={block.fadeTime !== undefined ? block.fadeTime : 1}
                          onChange={(e) =>
                            updateBlockFields(block.id, {
                              fadeTime: parseFloat(e.target.value) || 0
                            })
                          }
                          className="bg-[#141418] border border-[#2a2a30] w-16 text-center text-white px-2 py-1.5 text-xs font-mono focus:border-emerald-500 outline-none"
                        />
                        <span className="text-gray-400 text-xs">seg</span>
                      </div>
                    </div>
                  )}

                  {block.type === 'loop' && (
                    <div className="flex items-center gap-2">
                      <Layers size={18} className="text-blue-400" />
                      <span className="font-bold uppercase tracking-wider text-xs text-blue-400">
                        Início de Ciclo (Loop)
                      </span>
                    </div>
                  )}

                  {block.type === 'loop_end' && (
                    <div className="flex items-center gap-2">
                      <StopCircle size={18} className="text-blue-400" />
                      <span className="font-bold uppercase tracking-wider text-xs text-blue-400">
                        Fim de Ciclo (Repetir enquanto ativo)
                      </span>
                    </div>
                  )}

                  {block.type === 'cutscene' && (
                    <div className="flex flex-col gap-3">
                      <div className="flex items-center gap-2">
                        <Clapperboard size={18} className="text-red-500" />
                        <span className="font-bold uppercase tracking-wider text-xs text-red-500">
                          Bloco Cinemático (Cutscene)
                        </span>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                        <input
                          type="text"
                          placeholder="Título Principal (Ex: O ANULADOR)"
                          value={block.title || ''}
                          onChange={(e) =>
                            updateBlockFields(block.id, { title: e.target.value })
                          }
                          className="bg-[#141418] border border-[#2a2a30] text-white px-3 py-1.5 text-xs focus:border-red-500 outline-none uppercase"
                        />
                        <input
                          type="text"
                          placeholder="Subtítulo..."
                          value={block.subtitle || ''}
                          onChange={(e) =>
                            updateBlockFields(block.id, { subtitle: e.target.value })
                          }
                          className="bg-[#141418] border border-[#2a2a30] text-white px-3 py-1.5 text-xs focus:border-red-500 outline-none"
                        />
                      </div>

                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-xs">
                        <div className="flex flex-col gap-1">
                          <span className="text-[10px] uppercase text-gray-500">Zoom</span>
                          <input
                            type="number"
                            step="0.1"
                            value={block.zoom !== undefined ? block.zoom : 2.5}
                            onChange={(e) =>
                              updateBlockFields(block.id, {
                                zoom: parseFloat(e.target.value) || 1
                              })
                            }
                            className="bg-[#141418] border border-[#2a2a30] text-white px-2 py-1.5 text-xs text-center"
                          />
                        </div>

                        <div className="flex flex-col gap-1">
                          <span className="text-[10px] uppercase text-gray-500">Duração</span>
                          <div className="flex items-center gap-1">
                            <input
                              type="number"
                              step="0.1"
                              value={block.duration !== undefined ? block.duration : 6}
                              onChange={(e) =>
                                updateBlockFields(block.id, {
                                  duration: parseFloat(e.target.value) || 1
                                })
                              }
                              className="bg-[#141418] border border-[#2a2a30] text-white px-2 py-1.5 text-xs text-center flex-1"
                            />
                            <span className="text-gray-500 text-[10px]">s</span>
                          </div>
                        </div>

                        <div className="flex flex-col gap-1">
                          <span className="text-[10px] uppercase text-gray-500">Cor Título</span>
                          <div className="flex gap-1.5 items-center">
                            <input
                              type="color"
                              value={block.textColor || '#FFFFFF'}
                              onChange={(e) =>
                                updateBlockFields(block.id, { textColor: e.target.value })
                              }
                              className="bg-[#141418] border border-[#2a2a30] w-7 h-7 p-0.5 cursor-pointer"
                            />
                            <input
                              type="text"
                              value={block.textColor || '#FFFFFF'}
                              onChange={(e) =>
                                updateBlockFields(block.id, { textColor: e.target.value })
                              }
                              className="bg-[#141418] border border-[#2a2a30] text-white px-2 py-1 text-[11px] w-full text-center uppercase"
                            />
                          </div>
                        </div>

                        <div className="flex flex-col gap-1">
                          <span className="text-[10px] uppercase text-gray-500">Cor Subtítulo</span>
                          <div className="flex gap-1.5 items-center">
                            <input
                              type="color"
                              value={block.subtitleColor || '#ef4444'}
                              onChange={(e) =>
                                updateBlockFields(block.id, { subtitleColor: e.target.value })
                              }
                              className="bg-[#141418] border border-[#2a2a30] w-7 h-7 p-0.5 cursor-pointer"
                            />
                            <input
                              type="text"
                              value={block.subtitleColor || '#ef4444'}
                              onChange={(e) =>
                                updateBlockFields(block.id, { subtitleColor: e.target.value })
                              }
                              className="bg-[#141418] border border-[#2a2a30] text-white px-2 py-1 text-[11px] w-full text-center uppercase"
                            />
                          </div>
                        </div>
                      </div>

                      <div className="flex flex-wrap gap-4 text-xs pt-1">
                        <label className="flex items-center gap-2 text-gray-400 text-[10px] uppercase font-bold cursor-pointer">
                          <input
                            type="checkbox"
                            checked={block.bars !== undefined ? block.bars : true}
                            onChange={(e) =>
                              updateBlockFields(block.id, { bars: e.target.checked })
                            }
                            className="accent-red-500"
                          />
                          Barras Pretas Cinemáticas
                        </label>
                        <label className="flex items-center gap-2 text-gray-400 text-[10px] uppercase font-bold cursor-pointer">
                          <input
                            type="checkbox"
                            checked={block.textShadow !== undefined ? block.textShadow : true}
                            onChange={(e) =>
                              updateBlockFields(block.id, { textShadow: e.target.checked })
                            }
                            className="accent-red-500"
                          />
                          Sombra no Texto
                        </label>
                      </div>
                    </div>
                  )}

                  {block.type === 'fade_block' && (
                    <div className="flex flex-col gap-3">
                      <div className="flex items-center gap-2">
                        <Contrast size={18} className="text-gray-300" />
                        <span className="font-bold uppercase tracking-wider text-xs text-gray-300">
                          Fade de Escurecimento Geral (Fade Block)
                        </span>
                      </div>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                        <div className="flex flex-col gap-1">
                          <span className="text-[10px] uppercase text-gray-500">Opacidade Ini</span>
                          <input
                            type="number"
                            step="0.1"
                            max="1"
                            min="0"
                            value={block.opacityStart !== undefined ? block.opacityStart : 0}
                            onChange={(e) =>
                              updateBlockFields(block.id, {
                                opacityStart: parseFloat(e.target.value) || 0
                              })
                            }
                            className="bg-[#141418] border border-[#2a2a30] text-white px-2 py-1.5 text-xs text-center"
                          />
                        </div>

                        <div className="flex flex-col gap-1">
                          <span className="text-[10px] uppercase text-gray-500">Opacidade Fim</span>
                          <input
                            type="number"
                            step="0.1"
                            max="1"
                            min="0"
                            value={block.opacityEnd !== undefined ? block.opacityEnd : 1}
                            onChange={(e) =>
                              updateBlockFields(block.id, {
                                opacityEnd: parseFloat(e.target.value) || 0
                              })
                            }
                            className="bg-[#141418] border border-[#2a2a30] text-white px-2 py-1.5 text-xs text-center"
                          />
                        </div>

                        <div className="flex flex-col gap-1">
                          <span className="text-[10px] uppercase text-gray-500">Duração</span>
                          <div className="flex items-center gap-1">
                            <input
                              type="number"
                              step="0.1"
                              value={block.duration !== undefined ? block.duration : 1}
                              onChange={(e) =>
                                updateBlockFields(block.id, {
                                  duration: parseFloat(e.target.value) || 0
                                })
                              }
                              className="bg-[#141418] border border-[#2a2a30] text-white px-2 py-1.5 text-xs text-center flex-1"
                            />
                            <span className="text-gray-500 text-[10px]">s</span>
                          </div>
                        </div>

                        <div className="flex flex-col gap-1">
                          <span className="text-[10px] uppercase text-gray-500">Camada</span>
                          <select
                            value={block.layer || 'Tela'}
                            onChange={(e) =>
                              updateBlockFields(block.id, { layer: e.target.value })
                            }
                            className="bg-[#141418] border border-[#2a2a30] text-white px-2 py-1.5 text-xs"
                          >
                            <option value="Tela">Tela (Cobre tudo)</option>
                            <option value="Fundo">Fundo (Apenas bg)</option>
                          </select>
                        </div>
                      </div>
                    </div>
                  )}

                  {block.type === 'open_board' && (
                    <div className="flex flex-col gap-3">
                      <div className="flex items-center gap-2">
                        <Layers size={18} className="text-blue-400" />
                        <span className="font-bold uppercase tracking-wider text-xs text-blue-400">
                          Comando de Interface (Open Board)
                        </span>
                      </div>
                      <div className="grid grid-cols-2 gap-2.5">
                        <div className="flex flex-col gap-1">
                          <span className="text-[10px] uppercase text-gray-500">Mudar Aba Para</span>
                          <select
                            value={block.aba || 'null'}
                            onChange={(e) =>
                              updateBlockFields(block.id, { aba: e.target.value })
                            }
                            className="bg-[#141418] border border-[#2a2a30] text-white px-2.5 py-1.5 text-xs"
                          >
                            <option value="ficha">Ficha</option>
                            <option value="log">Histórico</option>
                            <option value="conexao">Conexão</option>
                            <option value="null">Nenhuma</option>
                          </select>
                        </div>

                        <div className="flex flex-col gap-1">
                          <span className="text-[10px] uppercase text-gray-500">Atraso</span>
                          <div className="flex items-center gap-1">
                            <input
                              type="number"
                              step="0.1"
                              value={block.delay !== undefined ? block.delay : 0}
                              onChange={(e) =>
                                updateBlockFields(block.id, {
                                  delay: parseFloat(e.target.value) || 0
                                })
                              }
                              className="bg-[#141418] border border-[#2a2a30] text-white px-2 py-1.5 text-xs text-center flex-1"
                            />
                            <span className="text-gray-500 text-[10px]">s</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Action Panel to Add Blocks */}
        <div className="mt-8 p-4 bg-[#0e0e12] border border-[#222]">
          <div className="text-[10px] uppercase font-bold text-gray-500 tracking-widest mb-3 flex items-center gap-2">
            <Plus size={14} className="text-blood-red" /> Adicionar Bloco de Execução
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <button
              onClick={() => addBlock('quando_iniciado')}
              className="p-2.5 bg-[#141418] hover:bg-[#1a1a20] border border-[#26262e] hover:border-yellow-600 text-yellow-500 uppercase text-[10px] font-bold tracking-wider flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
            >
              <Play size={12} /> Início
            </button>

            <button
              onClick={() => addBlock('aguarde')}
              className="p-2.5 bg-[#141418] hover:bg-[#1a1a20] border border-[#26262e] hover:border-blue-500 text-blue-400 uppercase text-[10px] font-bold tracking-wider flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
            >
              <Clock size={12} /> Aguarde
            </button>

            <button
              onClick={() => addBlock('mudar_fundo')}
              className="p-2.5 bg-[#141418] hover:bg-[#1a1a20] border border-[#26262e] hover:border-purple-500 text-purple-400 uppercase text-[10px] font-bold tracking-wider flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
            >
              <ImageIcon size={12} /> Fundo
            </button>

            <button
              onClick={() => addBlock('fundo_original')}
              className="p-2.5 bg-[#141418] hover:bg-[#1a1a20] border border-[#26262e] hover:border-purple-500 text-purple-400 uppercase text-[10px] font-bold tracking-wider flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
            >
              <Undo2 size={12} /> Reset Fundo
            </button>

            <button
              onClick={() => addBlock('play_ost')}
              className="p-2.5 bg-[#141418] hover:bg-[#1a1a20] border border-[#26262e] hover:border-emerald-500 text-emerald-400 uppercase text-[10px] font-bold tracking-wider flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
            >
              <Music size={12} /> Tocar OST
            </button>

            <button
              onClick={() => addBlock('stop_ost')}
              className="p-2.5 bg-[#141418] hover:bg-[#1a1a20] border border-[#26262e] hover:border-emerald-500 text-emerald-400 uppercase text-[10px] font-bold tracking-wider flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
            >
              <PauseCircle size={12} /> Parar OST
            </button>

            <button
              onClick={() => addBlock('cutscene')}
              className="p-2.5 bg-[#141418] hover:bg-[#1a1a20] border border-[#26262e] hover:border-red-500 text-red-400 uppercase text-[10px] font-bold tracking-wider flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
            >
              <Clapperboard size={12} /> Cutscene
            </button>

            <button
              onClick={() => addBlock('fade_block')}
              className="p-2.5 bg-[#141418] hover:bg-[#1a1a20] border border-[#26262e] hover:border-gray-400 text-gray-300 uppercase text-[10px] font-bold tracking-wider flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
            >
              <Contrast size={12} /> Fade Block
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-4 pb-24 font-sans">
      {/* Eventos e Automação Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-5 bg-[#14151c] border border-[#262835] rounded-none mb-6 shadow-sm">
        <div>
          <h3 className="text-base font-semibold text-white flex items-center gap-2">
            <Settings size={18} className="text-red-400" />
            Automações e Eventos
          </h3>
          <p className="text-[#8e8f9e] text-xs mt-0.5">
            Crie ações automáticas, alterações de fundo e reprodução de áudio para a sessão.
          </p>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <button
            onClick={() => createEvent(false)}
            className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-3.5 py-2 bg-[#1e202c] hover:bg-[#272938] border border-[#2d3040] text-white text-xs font-medium rounded-none transition-colors cursor-pointer"
          >
            <Plus size={14} className="text-red-400" /> Novo Evento
          </button>
          <button
            onClick={() => createEvent(true)}
            className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-3.5 py-2 bg-amber-950/30 hover:bg-amber-950/50 border border-amber-700/40 text-amber-300 text-xs font-medium rounded-none transition-colors cursor-pointer"
          >
            <Plus size={14} className="text-amber-400" /> Novo Toggle
          </button>
        </div>
      </div>

      {/* Events Grid */}
      {savedEvents.length === 0 ? (
        <div className="text-center flex flex-col items-center py-20 text-[#71717a] border border-[#272935] bg-[#14151c] rounded-none">
          <Layers size={36} className="mb-3 opacity-40 text-red-400" />
          <span className="text-sm font-semibold mb-1 text-white">
            Nenhum evento criado ainda
          </span>
          <span className="text-xs max-w-sm text-[#8e8f9e]">
            Crie sequências de ações, altere fundos de tela ou sincronize músicas automaticamente.
          </span>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {savedEvents.map((ev: any) => {
            const isToggleActive = ev.isToggle && activeToggles[ev.id];
            return (
              <div
                key={ev.id}
                className={`bg-[#14151c] border rounded-none transition-all flex flex-col justify-between p-4 shadow-sm ${
                  isToggleActive
                    ? 'border-amber-500/60 shadow-[0_0_15px_rgba(234,179,8,0.1)]'
                    : 'border-[#262835] hover:border-[#353849]'
                }`}
              >
                <div>
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <h4 className="text-white font-semibold text-sm truncate">
                      {ev.name}
                    </h4>
                    {ev.isToggle ? (
                      <span className="text-[10px] px-2 py-0.5 bg-amber-950/50 border border-amber-700/50 text-amber-300 font-medium rounded-none whitespace-nowrap">
                        Toggle
                      </span>
                    ) : (
                      <span className="text-[10px] px-2 py-0.5 bg-[#1e202c] border border-[#2d3040] text-[#a1a1aa] font-medium rounded-none whitespace-nowrap">
                        Padrão
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-3 text-xs text-[#8e8f9e] mb-4">
                    <span className="flex items-center gap-1 text-xs">
                      <Layers size={13} className="text-red-400" /> {ev.blocks?.length || 0}{' '}
                      blocos
                    </span>
                    {ev.isToggle && (
                      <span
                        className={`text-xs font-medium ${
                          isToggleActive ? 'text-amber-400' : 'text-[#71717a]'
                        }`}
                      >
                        {isToggleActive ? '● Ativo' : '○ Inativo'}
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2 pt-3 border-t border-[#222430]">
                  <button
                    onClick={() => setEditingEvent(ev)}
                    className="flex-1 bg-[#1e202c] hover:bg-[#272938] border border-[#2d3040] text-[#d4d4d8] hover:text-white font-medium text-xs rounded-none py-1.5 transition-colors cursor-pointer text-center"
                  >
                    Editar
                  </button>

                  {ev.isToggle ? (
                    isToggleActive ? (
                      <button
                        onClick={() => executeEvent(ev, 'all', 'stop')}
                        className="flex-1 bg-red-950/50 hover:bg-red-950/80 border border-red-700/50 text-red-300 font-medium text-xs rounded-none py-1.5 transition-colors cursor-pointer flex justify-center items-center gap-1.5"
                      >
                        <StopCircle size={13} /> Parar
                      </button>
                    ) : (
                      <button
                        onClick={() =>
                          setShowPlayerSelect({ eventId: ev.id, action: 'start' })
                        }
                        className="flex-1 bg-amber-700 hover:bg-amber-600 text-white font-medium text-xs rounded-none py-1.5 transition-colors cursor-pointer flex justify-center items-center gap-1.5"
                      >
                        <Play size={13} /> Iniciar
                      </button>
                    )
                  ) : (
                    <button
                      onClick={() => setShowPlayerSelect({ eventId: ev.id })}
                      className="flex-1 bg-red-700 hover:bg-red-600 text-white font-medium text-xs rounded-none py-1.5 transition-colors cursor-pointer flex justify-center items-center gap-1.5"
                    >
                      <Play size={13} /> Executar
                    </button>
                  )}

                  <button
                    onClick={() => deleteEvent(ev.id)}
                    className="p-1.5 bg-[#1e202c] hover:bg-red-950/30 border border-[#2d3040] hover:border-red-900/50 text-[#71717a] hover:text-red-400 rounded-none transition-colors cursor-pointer"
                    title="Excluir evento"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Target Player Selection Modal */}
      {showPlayerSelect && (
        <div className="fixed inset-0 bg-black/85 z-[300] flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-[#0e0e12] border border-[#333] p-6 max-w-md w-full relative">
            <button
              onClick={() => setShowPlayerSelect(null)}
              className="absolute top-4 right-4 text-gray-500 hover:text-white cursor-pointer"
            >
              <X size={18} />
            </button>

            <h2 className="text-sm font-bold text-white uppercase tracking-widest mb-4 flex items-center gap-2 border-b border-[#222] pb-3">
              <Play size={16} className="text-blood-red" /> Executar Automação Em:
            </h2>

            <div className="flex flex-col gap-2">
              <button
                onClick={() =>
                  executeEvent(
                    savedEvents.find((e: any) => e.id === showPlayerSelect.eventId),
                    'all',
                    showPlayerSelect.action as any
                  )
                }
                className="w-full bg-[#16161c] hover:bg-blood-red/20 border border-[#2a2a34] hover:border-blood-red text-white p-3 flex items-center justify-between uppercase tracking-wider text-xs font-bold transition-all cursor-pointer group"
              >
                <span>Todos os Jogadores Conectados</span>
                <ArrowRight
                  size={14}
                  className="text-gray-500 group-hover:text-blood-red transition-colors"
                />
              </button>

              <div className="w-full h-[1px] bg-[#222] my-1" />

              <div className="text-[10px] text-gray-500 uppercase font-bold tracking-widest px-1">
                Ou Selecione um Jogador Específico:
              </div>

              {players.length === 0 ? (
                <span className="text-gray-600 text-xs text-center py-4 italic">
                  Nenhum outro jogador online no momento.
                </span>
              ) : (
                players.map((p: any) => (
                  <button
                    key={p.id}
                    onClick={() =>
                      executeEvent(
                        savedEvents.find((e: any) => e.id === showPlayerSelect.eventId),
                        p.id,
                        showPlayerSelect.action as any
                      )
                    }
                    className="w-full bg-[#141418] hover:bg-[#1e1e26] border border-[#24242c] hover:border-gray-500 text-gray-300 hover:text-white p-2.5 flex items-center justify-between uppercase tracking-wider text-xs font-bold transition-colors cursor-pointer group"
                  >
                    <span>{p.name || 'Jogador Desconhecido'}</span>
                    <ArrowRight
                      size={14}
                      className="text-gray-600 group-hover:text-white transition-colors"
                    />
                  </button>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
