import React, { useState } from 'react';
import { Play, Settings, Clock, Image as ImageIcon, Layers, Plus, X, Save, ArrowLeft, Trash2, ArrowRight, ArrowUp, ArrowDown, Type, StopCircle, Upload, Undo2, Music, PauseCircle, Contrast, Copy, GripVertical } from 'lucide-react';
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
  const [showPlayerSelect, setShowPlayerSelect] = useState<{ eventId: string, action?: string } | null>(null);
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
     if (!confirm("Deletar este evento?")) return;
     const newList = savedEvents.filter((e: any) => e.id !== id);
     await saveToMaster(newList);
  };

  const addBlock = (type: string) => {
     let defaultBlock: any = { id: Date.now().toString(), type, value: null };
     if (type === 'aguarde') defaultBlock.value = 1;
     else if (type === 'mudar_fundo') defaultBlock.value = '';
     else if (type === 'imagem_fade') defaultBlock.value = 50;
     else if (type === 'play_ost') { defaultBlock.ostId = ''; defaultBlock.volume = 1; defaultBlock.fadeTime = 1; }
     else if (type === 'stop_ost') { defaultBlock.fadeTime = 1; }

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
     const closestInteractive = target.closest('input, select, button, label, select option, input[type="range"]');
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
        
        // Remove item from original index
        blocks.splice(draggedIndex, 1);
        // Insert item at target index
        blocks.splice(targetIndex, 0, draggedBlock);

        return { ...prev, blocks };
      });

      setDraggedIndex(null);
      setDragOverIndex(null);
  };

  const updateBlock = (id: string, value: any) => {
     setEditingEvent((prev: any) => ({
        ...prev,
        blocks: prev.blocks.map((b: any) => b.id === id ? { ...b, value } : b)
     }));
  };

  const updateBlockFields = (id: string, fields: any) => {
     setEditingEvent((prev: any) => ({
        ...prev,
        blocks: prev.blocks.map((b: any) => b.id === id ? { ...b, ...fields } : b)
     }));
  };

  const executeEvent = (eventData: any, target: string, action: 'start' | 'stop' = 'start') => {
     setShowPlayerSelect(null);

     globalChannelRef.current?.send({ 
         type: 'broadcast', 
         event: 'builder_event', 
         payload: { 
             target, 
             eventId: eventData.id,
             isToggle: eventData.isToggle,
             action
         } 
     }).catch(console.error);
  };

  if (editingEvent) {
     return (
        <div className="max-w-2xl mx-auto flex flex-col gap-6 px-4 pb-32">
           <div className="flex items-center justify-between mb-4 mt-2">
               <button onClick={() => setEditingEvent(null)} className="text-gray-500 hover:text-white flex items-center pr-4 transition-colors">
                  <ArrowLeft size={20} className="mr-2" /> Voltar
               </button>
               <button onClick={saveEditing} className="bg-blood-red hover:bg-red-700 text-white font-bold py-2 px-6 rounded uppercase tracking-widest text-xs flex items-center shadow-[0_0_15px_rgba(255,0,0,0.3)] transition-all">
                  <Save size={16} className="mr-2" /> Salvar
               </button>
           </div>
           
           <div className="mb-4">
              <input 
                 value={editingEvent.name}
                 onChange={(e) => setEditingEvent({...editingEvent, name: e.target.value})}
                 className="bg-transparent border-b border-[#333] text-2xl font-bold text-white outline-none w-full pb-2 uppercase tracking-widest focus:border-blood-red transition-colors"
                 placeholder="Nome do Evento"
              />
              {editingEvent.isToggle && <div className="text-xs text-blood-red uppercase tracking-widest mt-2 px-2 border border-blood-red/30 bg-blood-red/10 w-fit rounded">Evento Toggle (Liga/Desliga)</div>}
           </div>

           <div className="flex flex-col gap-3 relative">
               <div className="absolute top-0 bottom-0 left-[19px] w-1 bg-[#1A1A1A] z-0"></div>
               {editingEvent.blocks.length === 0 && (
                   <div className="relative z-10 text-center py-10 text-[#555] uppercase text-xs font-bold tracking-widest border border-dashed border-[#333] rounded-xl bg-black/40">
                      Nenhum bloco. Clique no botão + abaixo.
                   </div>
               )}
               {editingEvent.blocks.map((block: any, index: number) => (
                   <div key={block.id} className="relative z-10 flex gap-3 group">
                       <div className="w-10 flex items-start justify-center pt-3 select-none">
                          <div className={`w-4 h-4 rounded-full border-[3px] border-[#0a0a0a] shadow-[0_0_10px_rgba(255,255,255,0.1)] ${block.type === 'quando_iniciado' ? 'bg-yellow-500 shadow-yellow-500/50' : block.type.includes('fundo') ? 'bg-purple-500 shadow-purple-500/50' : 'bg-blue-500 shadow-blue-500/50'}`}></div>
                       </div>
                       <div 
                          draggable
                          onDragStart={(e) => handleDragStart(e, index)}
                          onDragOver={(e) => handleDragOver(e, index)}
                          onDragEnd={handleDragEnd}
                          onDrop={(e) => handleDrop(e, index)}
                          className={`flex-1 flex flex-col sm:flex-row items-center gap-3 p-4 rounded-lg border transition-all hover:bg-black/80 cursor-grab active:cursor-grabbing ${
                              block.type === 'quando_iniciado' ? 'bg-yellow-900/20 border-yellow-500/30' : 
                              block.type.includes('fundo') ? 'bg-purple-900/20 border-purple-500/30' : 
                              'bg-blue-900/20 border-blue-500/30'
                          } ${
                              draggedIndex === index ? 'opacity-30 border-dashed border-gray-600' : ''
                          } ${
                              dragOverIndex === index && draggedIndex !== index ? 'border-dashed border-red-500 bg-red-950/20 scale-[1.01]' : ''
                          } shadow-lg`}
                       >
                           <div className="flex items-center justify-center text-gray-500/50 hover:text-gray-300 pr-1 select-none cursor-grab active:cursor-grabbing" title="Arrastar para reordenar">
                              <GripVertical size={16} />
                           </div>
                           {block.type === 'quando_iniciado' && (
                              <div className="flex items-center w-full">
                                 <Play size={20} className="text-yellow-500 mr-2" />
                                 <span className="font-bold uppercase tracking-wider text-sm text-yellow-500">Quando Iniciado</span>
                              </div>
                           )}
                           {block.type === 'aguarde' && (
                              <div className="flex items-center w-full">
                                 <Clock size={20} className="text-blue-400 mr-2" />
                                 <span className="font-bold uppercase tracking-wider text-sm text-blue-400 mr-4">Aguarde</span>
                                 <input 
                                     type="number" 
                                     step="0.1"
                                     value={block.value}
                                     onChange={(e) => updateBlock(block.id, parseFloat(e.target.value) || 0)}
                                     className="bg-[#1A1A1A] border border-[#333] w-20 text-center text-white p-1.5 rounded font-mono focus:border-blue-500 outline-none transition-colors"
                                 />
                                 <span className="text-gray-500 ml-2 text-xs uppercase font-bold tracking-widest">Seg.</span>
                              </div>
                           )}
                           {block.type === 'mudar_fundo' && (
                              <div className="flex flex-col sm:flex-row sm:items-center w-full gap-3">
                                 <div className="flex items-center">
                                    <ImageIcon size={20} className="text-purple-400 mr-2" />
                                    <span className="font-bold uppercase tracking-wider text-sm text-purple-400 whitespace-nowrap">Mudar Fundo</span>
                                 </div>
                                 <div className="flex w-full gap-2 relative">
                                    <input 
                                        type="text" 
                                        placeholder="URL da Imagem ou Vídeo (MP4)"
                                        value={typeof block.value === 'string' ? block.value : block.value?.data || ''}
                                        onChange={(e) => updateBlock(block.id, e.target.value)}
                                        className="bg-[#1A1A1A] border border-[#333] flex-1 text-white p-2 rounded text-xs focus:border-purple-500 outline-none transition-colors"
                                    />
                                    <label className="bg-[#1A1A1A] hover:bg-[#2a2a2a] border border-[#444] text-white p-2 rounded cursor-pointer transition-colors flex items-center justify-center">
                                       <Upload size={16} />
                                       <input type="file" accept="image/*,video/mp4,video/*" className="hidden" onChange={(e) => {
                                           const file = e.target.files?.[0];
                                           if (file) {
                                               const reader = new FileReader();
                                               reader.onload = (e) => {
                                                   updateBlock(block.id, e.target?.result);
                                               };
                                               reader.readAsDataURL(file);
                                           }
                                       }} />
                                    </label>
                                 </div>
                              </div>
                           )}
                           {block.type === 'fundo_original' && (
                              <div className="flex items-center w-full">
                                 <Undo2 size={20} className="text-purple-400 mr-2" />
                                 <span className="font-bold uppercase tracking-wider text-sm text-purple-400">Voltar Fundo Original</span>
                              </div>
                           )}
                           {block.type === 'imagem_fade' && (
                              <div className="flex items-center w-full">
                                 <Contrast size={20} className="text-purple-400 mr-2" />
                                 <span className="font-bold uppercase tracking-wider text-sm text-purple-400 mr-4">Imagem Fade</span>
                                 <input 
                                     type="number" 
                                     step="1"
                                     min="0"
                                     max="100"
                                     value={block.value !== undefined ? block.value : 50}
                                     onChange={(e) => updateBlock(block.id, parseFloat(e.target.value) || 0)}
                                     className="bg-[#1A1A1A] border border-[#333] w-20 text-center text-white p-1.5 rounded font-mono focus:border-purple-500 outline-none transition-colors"
                                 />
                                 <span className="text-gray-500 ml-2 text-xs uppercase font-bold tracking-widest">%</span>
                              </div>
                           )}
                           {block.type === 'play_ost' && (
                              <div className="flex flex-col sm:flex-row sm:items-center w-full gap-3">
                                 <div className="flex items-center">
                                    <Music size={20} className="text-emerald-400 mr-2" />
                                    <span className="font-bold uppercase tracking-wider text-sm text-emerald-400 whitespace-nowrap mr-2">Tocar OST</span>
                                 </div>
                                 <select
                                     value={block.ostId || ''}
                                     onChange={(e) => updateBlockFields(block.id, { ostId: e.target.value })}
                                     className="bg-[#1A1A1A] border border-[#333] text-white p-2 rounded text-xs focus:border-emerald-500 outline-none transition-colors max-w-[150px]"
                                 >
                                     <option value="">(Nenhuma)</option>
                                     {ostList.map((ost: any) => {
                                         const rawName = ost.id.split('_').slice(3).join('_');
                                         const ostName = decodeURIComponent(rawName);
                                         return <option key={ost.id} value={ost.id}>{ostName || 'OST Sem Nome'}</option>;
                                     })}
                                 </select>
                                 <div className="flex flex-col w-32 justify-center mx-2">
                                     <div className="flex justify-between text-gray-500 text-[10px] uppercase mb-1">
                                         <span>Vol.</span>
                                         <span>{Math.round((block.volume !== undefined ? block.volume : 1) * 100)}%</span>
                                     </div>
                                     <input 
                                         type="range" 
                                         min="0" max="1" step="0.05"
                                         value={block.volume !== undefined ? block.volume : 1}
                                         onChange={(e) => updateBlockFields(block.id, { volume: parseFloat(e.target.value) || 0 })}
                                         className="w-full accent-emerald-500"
                                     />
                                 </div>
                                 <div className="flex items-center">
                                     <span className="text-gray-500 mx-2 text-[10px] uppercase font-bold tracking-widest">Fade In</span>
                                     <input 
                                         type="number" 
                                         step="0.1"
                                         value={block.fadeTime !== undefined ? block.fadeTime : 1}
                                         onChange={(e) => updateBlockFields(block.id, { fadeTime: parseFloat(e.target.value) || 0 })}
                                         className="bg-[#1A1A1A] border border-[#333] w-16 text-center text-white p-1.5 rounded font-mono focus:border-emerald-500 outline-none transition-colors"
                                     />
                                     <span className="text-gray-500 ml-1 text-[10px] uppercase font-bold tracking-widest mr-3">s</span>
                                 </div>
                                 <label className="flex items-center gap-1 text-gray-500 text-[10px] uppercase font-bold tracking-widest cursor-pointer whitespace-nowrap">
                                     <input 
                                         type="checkbox"
                                         checked={block.resetBeforePlay || false}
                                         onChange={(e) => updateBlockFields(block.id, { resetBeforePlay: e.target.checked })}
                                         className="rounded bg-black border-[#444] text-emerald-500 accent-emerald-500"
                                     />
                                     <span>Resetar</span>
                                 </label>
                              </div>
                           )}
                           {block.type === 'stop_ost' && (
                              <div className="flex items-center w-full">
                                 <PauseCircle size={20} className="text-emerald-400 mr-2" />
                                 <span className="font-bold uppercase tracking-wider text-sm text-emerald-400 mr-4">Parar OST</span>
                                 <span className="text-gray-500 mx-2 text-[10px] uppercase font-bold tracking-widest">Fade Out</span>
                                 <input 
                                     type="number" 
                                     step="0.1"
                                     value={block.fadeTime !== undefined ? block.fadeTime : 1}
                                     onChange={(e) => updateBlockFields(block.id, { fadeTime: parseFloat(e.target.value) || 0 })}
                                     className="bg-[#1A1A1A] border border-[#333] w-16 text-center text-white p-1.5 rounded font-mono focus:border-emerald-500 outline-none transition-colors"
                                 />
                                 <span className="text-gray-500 ml-1 text-[10px] uppercase font-bold tracking-widest">s</span>
                              </div>
                           )}
                           {block.type === 'loop' && (
                              <div className="flex items-center w-full border-b sm:border-b-0 sm:border-r border-blue-500/20 pb-2 sm:pb-0 sm:pr-4">
                                 <Layers size={20} className="text-blue-500 mr-2" />
                                 <span className="font-bold uppercase tracking-wider text-sm text-blue-500">Loop (Início)</span>
                              </div>
                           )}
                           {block.type === 'loop_end' && (
                              <div className="flex items-center w-full">
                                 <StopCircle size={20} className="text-blue-500 mr-2" />
                                 <span className="font-bold uppercase tracking-wider text-sm text-blue-500">Loop (Fim)</span>
                              </div>
                           )}
                           
                           <div className="flex items-center ml-auto gap-1 sm:opacity-0 group-hover:opacity-100 transition-opacity mt-2 sm:mt-0 select-none">
                               <button title="Duplicar Bloco" onClick={(e) => { e.stopPropagation(); duplicateBlock(block.id); }} className="text-[#555] hover:text-yellow-400 p-1.5 transition-colors"><Copy size={16} /></button>
                               <div className="w-[1px] h-4 bg-[#333] mx-1"></div>
                               <button disabled={index === 0} onClick={(e) => { e.stopPropagation(); moveBlock(index, -1); }} className="text-[#555] hover:text-white p-1.5 disabled:opacity-30 disabled:cursor-not-allowed"><ArrowUp size={18} /></button>
                               <button disabled={index === editingEvent.blocks.length - 1} onClick={(e) => { e.stopPropagation(); moveBlock(index, 1); }} className="text-[#555] hover:text-white p-1.5 disabled:opacity-30 disabled:cursor-not-allowed" title="Mover para baixo"><ArrowDown size={18} /></button>
                               <div className="w-[1px] h-4 bg-[#333] mx-1"></div>
                               <button onClick={(e) => { e.stopPropagation(); removeBlock(block.id); }} className="text-[#555] hover:text-red-500 p-1.5 transition-colors" title="Excluir Bloco"><Trash2 size={18} /></button>
                           </div>
                       </div>
                   </div>
               ))}
           </div>

           <div className="fixed bottom-20 right-6 z-50 flex flex-col items-end gap-2">
               {showAddMenuBlock && (
                  <div className="bg-black/95 border border-[#333] p-5 sm:p-6 rounded-xl shadow-[0_0_30px_rgba(0,0,0,0.95)] flex flex-col gap-5 w-72 sm:w-80 max-h-[75vh] overflow-y-auto overflow-x-hidden mb-2 origin-bottom-right animate-in slide-in-from-bottom-5">
                      <div>
                          <p className="text-[11px] uppercase font-black tracking-widest text-gray-500 mb-3 pl-1 border-b border-[#1A1A1A] pb-1.5">Evento</p>
                          <button onClick={() => addBlock('quando_iniciado')} className="w-full text-left bg-transparent hover:bg-yellow-500/15 text-yellow-500 p-3 rounded-lg text-sm font-bold uppercase tracking-wider flex items-center transition-colors"><Play size={16} className="mr-3"/> Quando Iniciado</button>
                      </div>
                      <div>
                          <p className="text-[11px] uppercase font-black tracking-widest text-[#555] mb-3 pl-1 border-b border-[#1A1A1A] pb-1.5">Controle</p>
                          <button onClick={() => addBlock('aguarde')} className="w-full text-left bg-transparent hover:bg-blue-500/15 text-blue-400 p-3 rounded-lg text-sm font-bold uppercase tracking-wider flex items-center transition-colors"><Clock size={16} className="mr-3"/> Aguarde</button>
                          <button onClick={() => addBlock('loop')} className="w-full text-left bg-transparent hover:bg-blue-500/15 text-blue-400 p-3 rounded-lg text-sm font-bold uppercase tracking-wider flex items-center transition-colors"><Layers size={16} className="mr-3"/> Início do Loop</button>
                          <button onClick={() => addBlock('loop_end')} className="w-full text-left bg-transparent hover:bg-blue-500/15 text-blue-400 p-3 rounded-lg text-sm font-bold uppercase tracking-wider flex items-center transition-colors"><StopCircle size={16} className="mr-3"/> Fim do Loop</button>
                      </div>
                      <div>
                          <p className="text-[11px] uppercase font-black tracking-widest text-[#555] mb-3 pl-1 border-b border-[#1A1A1A] pb-1.5">Aparência</p>
                          <button onClick={() => addBlock('mudar_fundo')} className="w-full text-left bg-transparent hover:bg-purple-500/15 text-purple-400 p-3 rounded-lg text-sm font-bold uppercase tracking-wider flex items-center transition-colors"><ImageIcon size={16} className="mr-3"/> Trocar Fundo</button>
                          <button onClick={() => addBlock('fundo_original')} className="w-full text-left bg-transparent hover:bg-purple-500/15 text-purple-400 p-3 rounded-lg text-sm font-bold uppercase tracking-wider flex items-center transition-colors"><Undo2 size={16} className="mr-3"/> Fundo Original</button>
                          <button onClick={() => addBlock('imagem_fade')} className="w-full text-left bg-transparent hover:bg-purple-500/15 text-purple-400 p-3 rounded-lg text-sm font-bold uppercase tracking-wider flex items-center transition-colors"><Contrast size={16} className="mr-3"/> Imagem Fade</button>
                      </div>
                      <div>
                          <p className="text-[11px] uppercase font-black tracking-widest text-[#555] mb-3 pl-1 border-b border-[#1A1A1A] pb-1.5">Som</p>
                          <button onClick={() => addBlock('play_ost')} className="w-full text-left bg-transparent hover:bg-emerald-500/15 text-emerald-400 p-3 rounded-lg text-sm font-bold uppercase tracking-wider flex items-center transition-colors"><Music size={16} className="mr-3"/> Tocar OST</button>
                          <button onClick={() => addBlock('stop_ost')} className="w-full text-left bg-transparent hover:bg-emerald-500/15 text-emerald-400 p-3 rounded-lg text-sm font-bold uppercase tracking-wider flex items-center transition-colors"><PauseCircle size={16} className="mr-3"/> Parar OST</button>
                      </div>
                  </div>
               )}
               <button 
                  onClick={() => setShowAddMenuBlock(!showAddMenuBlock)}
                  className={`w-16 h-16 rounded-full flex items-center justify-center shadow-[0_0_25px_rgba(0,0,0,0.9)] border transition-all z-[150] cursor-pointer ${showAddMenuBlock ? 'bg-[#1A1A1A] border-[#444] rotate-45' : 'bg-blood-red hover:bg-red-700 border-red-500/40'}`}
               >
                  <Plus size={32} className="text-white" strokeWidth={2.5} />
               </button>
           </div>
        </div>
     );
  }

  return (
    <div className="max-w-3xl mx-auto flex flex-col gap-6 px-4">
        <div className="flex items-center justify-between gap-3 mb-6 mt-2 border-b border-[#1A1A1A] pb-6">
           <div>
              <h3 className="text-xl font-bold text-white uppercase tracking-widest flex items-center gap-2"><Settings className="text-blood-red" /> Skill Builder</h3>
              <p className="text-gray-500 text-xs mt-1 uppercase tracking-wider">Crie lógicas e automatize eventos</p>
           </div>
        </div>

        {savedEvents.length === 0 ? (
           <div className="text-center flex flex-col items-center py-32 text-[#444]">
              <Layers size={56} className="mb-4 opacity-30" />
              <span className="text-base uppercase font-bold tracking-widest mb-3 text-[#666]">Nenhum evento criado</span>
              <span className="text-xs max-w-xs leading-relaxed text-[#555]">Crie rotinas visuais, automatize fundos e crie eventos toggle clicando no (+) abaixo.</span>
           </div>
        ) : (
           <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 mt-4 pb-24">
              {savedEvents.map((ev: any) => {
                 const isToggleActive = ev.isToggle && activeToggles[ev.id];
                 return (
                 <div key={ev.id} className={`bg-black/80 backdrop-blur-md border ${isToggleActive ? 'border-blood-red/50 shadow-[0_0_20px_rgba(255,0,0,0.2)]' : 'border-[#1A1A1A] hover:border-[#444]'} rounded-xl p-5 relative overflow-hidden transition-all flex flex-col justify-between`}>
                    <div className={`absolute top-0 left-0 w-full h-1 bg-gradient-to-r ${ev.isToggle ? 'from-yellow-600' : 'from-blood-red'} to-transparent opacity-30`}></div>
                    <div>
                        <div className="flex items-center justify-between mb-2">
                           <h4 className="text-white font-bold text-lg uppercase tracking-widest truncate">{ev.name}</h4>
                           {ev.isToggle && <span className="text-[9px] uppercase tracking-widest text-yellow-500 border border-yellow-500/30 bg-yellow-900/20 px-2 py-0.5 rounded ml-2">Toggle</span>}
                        </div>
                        <div className="flex gap-2 items-center text-xs text-gray-400 font-mono bg-[#1A1A1A] border border-[#1A1A1A] w-fit px-2 py-1 rounded mb-6">
                           <Layers size={12} /> {ev.blocks?.length || 0} Blocos
                        </div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                        <button onClick={() => setEditingEvent(ev)} className="w-[45%] flex-1 bg-[#1a1a1a] border border-[#333] hover:bg-[#333] hover:border-gray-500 text-gray-300 hover:text-white uppercase font-bold text-[10px] tracking-wider rounded py-3 transition-all cursor-pointer text-center">
                           Editar
                        </button>
                        
                        {ev.isToggle ? (
                            isToggleActive ? (
                               <button onClick={() => executeEvent(ev, 'all', 'stop')} className="w-[45%] flex-1 bg-red-900/50 hover:bg-black border border-red-500/50 hover:border-gray-500 text-white hover:text-gray-400 uppercase font-bold text-[10px] tracking-wider rounded py-3 transition-all cursor-pointer flex justify-center items-center">
                                  <StopCircle size={14} className="mr-1.5" /> Parar
                               </button>
                            ) : (
                               <button onClick={() => setShowPlayerSelect({ eventId: ev.id, action: 'start' })} className="w-[45%] flex-1 bg-yellow-600 hover:bg-yellow-500 text-white uppercase font-bold text-[10px] tracking-wider rounded py-3 transition-all shadow-[0_0_10px_rgba(202,138,4,0.3)] cursor-pointer flex justify-center items-center">
                                  <Play size={14} className="mr-1.5" /> Iniciar
                               </button>
                            )
                        ) : (
                            <button onClick={() => setShowPlayerSelect({ eventId: ev.id })} className="w-[45%] flex-1 bg-blood-red hover:bg-red-700 text-white uppercase font-bold text-[10px] tracking-wider rounded py-3 transition-all shadow-[0_0_10px_rgba(255,0,0,0.3)] cursor-pointer flex justify-center items-center">
                               <Play size={14} className="mr-1.5" /> Executar
                            </button>
                        )}
                        
                        <button onClick={() => deleteEvent(ev.id)} className="w-10 flex items-center justify-center bg-transparent border border-transparent hover:border-red-900/50 hover:bg-red-900/20 text-[#555] hover:text-red-500 rounded transition-all cursor-pointer">
                           <Trash2 size={16} />
                        </button>
                    </div>
                 </div>
              )})}
           </div>
        )}

        <div className="fixed bottom-24 right-6 z-[160] flex flex-col items-end gap-2">
            {showAddMenuMain && (
               <div className="bg-black/95 border border-[#333] p-4 rounded-xl shadow-2xl flex flex-col gap-2 min-w-[200px] mb-2 origin-bottom-right animate-in fade-in slide-in-from-bottom-5">
                   <button onClick={() => createEvent(false)} className="w-full text-left hover:bg-[#1A1A1A] p-3 rounded text-sm font-bold uppercase tracking-widest text-[#aaa] hover:text-white transition-colors border border-transparent hover:border-[#444]"><span className="text-blood-red mr-2">●</span> Evento Padrão</button>
                   <button onClick={() => createEvent(true)} className="w-full text-left hover:bg-[#1A1A1A] p-3 rounded text-sm font-bold uppercase tracking-widest text-[#aaa] hover:text-white transition-colors border border-transparent hover:border-[#444]"><span className="text-yellow-500 mr-2">●</span> Evento Toggle</button>
               </div>
            )}
            <button 
               onClick={() => setShowAddMenuMain(!showAddMenuMain)}
               className={`w-14 h-14 rounded-full flex items-center justify-center shadow-[0_0_20px_rgba(0,0,0,0.8)] border transition-all cursor-pointer group ${showAddMenuMain ? 'bg-[#1A1A1A] border-[#555] rotate-45' : 'bg-[#1A1A1A] hover:bg-[#2a2a2a] border-[#333] hover:border-blood-red'}`}
            >
               <Plus size={28} className={`transition-colors ${showAddMenuMain ? 'text-white' : 'text-blood-red group-hover:text-red-500'}`} strokeWidth={2} />
            </button>
        </div>

        {showPlayerSelect && (
           <div className="fixed inset-0 bg-black/90 z-[300] flex flex-col items-center justify-center p-4 backdrop-blur-sm">
              <div className="bg-[#0a0a0a] border border-[#333] p-6 rounded-xl shadow-[0_0_30px_rgba(255,0,0,0.15)] max-w-sm w-full relative">
                 <button onClick={() => setShowPlayerSelect(null)} className="absolute top-4 right-4 text-gray-500 hover:text-white"><X size={20} /></button>
                 <h2 className="text-xl font-bold text-white uppercase tracking-widest mb-4 flex items-center border-b border-[#1A1A1A] pb-3"><Play size={20} className="text-blood-red mr-2" /> Executar Em:</h2>
                 
                 <div className="flex flex-col gap-3">
                    <button onClick={() => executeEvent(savedEvents.find(e => e.id === showPlayerSelect.eventId), 'all', showPlayerSelect.action as any)} className="w-full bg-[#1A1A1A] hover:bg-blood-red/20 border border-[#333] hover:border-blood-red text-white p-4 rounded flex items-center justify-between uppercase tracking-wider text-xs font-bold transition-all group cursor-pointer">
                       <span>Todos os Jogadores</span>
                       <ArrowRight size={16} className="text-gray-500 group-hover:text-blood-red transition-colors" />
                    </button>
                    
                    <div className="w-full h-[1px] bg-[#1A1A1A] my-2"></div>
                    
                    {players.length === 0 && <span className="text-[#555] text-xs text-center italic">Nenhum jogador online.</span>}
                    {players.map(p => (
                       <button key={p.id} onClick={() => executeEvent(savedEvents.find(e => e.id === showPlayerSelect.eventId), p.id, showPlayerSelect.action as any)} className="w-full bg-[#1A1A1A] hover:bg-[#2a2a2a] border border-[#333] hover:border-gray-500 text-gray-300 hover:text-white p-4 rounded flex items-center justify-between uppercase tracking-wider text-xs font-bold transition-all group cursor-pointer">
                         <span>{p.name || 'Desconhecido'}</span>
                         <ArrowRight size={16} className="text-gray-600 group-hover:text-white transition-colors" />
                       </button>
                    ))}
                 </div>
              </div>
           </div>
        )}
    </div>
  );
};
