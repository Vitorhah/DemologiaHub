/**
 * Definições e contratos reutilizáveis para o sistema de Eventos e Automação
 * Salvo para eventual reutilização ou expansão futura do RPG.
 */

export type EventBlockType =
  | 'aguarde'
  | 'mudar_fundo'
  | 'fundo_original'
  | 'imagem_fade'
  | 'play_ost'
  | 'stop_ost'
  | 'cutscene'
  | 'fade_block'
  | 'open_board'
  | 'loop_start'
  | 'loop_end';

export interface BaseEventBlock {
  id: string;
  type: EventBlockType;
}

export interface WaitBlock extends BaseEventBlock {
  type: 'aguarde';
  value: number; // segundos
}

export interface ChangeBackgroundBlock extends BaseEventBlock {
  type: 'mudar_fundo';
  value: string; // url da imagem ou vídeo
}

export interface ResetBackgroundBlock extends BaseEventBlock {
  type: 'fundo_original';
}

export interface ImageFadeBlock extends BaseEventBlock {
  type: 'imagem_fade';
  value: number; // 0-100 porcentagem
}

export interface PlayOstBlock extends BaseEventBlock {
  type: 'play_ost';
  ostId: string;
  volume: number; // 0.0 - 1.0
  fadeTime: number; // segundos
  resetBeforePlay?: boolean;
}

export interface StopOstBlock extends BaseEventBlock {
  type: 'stop_ost';
  fadeTime: number; // segundos
}

export interface CutsceneBlock extends BaseEventBlock {
  type: 'cutscene';
  title: string;
  subtitle: string;
  zoom: number;
  bars: boolean;
  duration: number; // segundos
  ostId?: string;
  textColor?: string;
  subtitleColor?: string;
  fontFamily?: string;
  textShadow?: boolean;
}

export interface FadeBlock extends BaseEventBlock {
  type: 'fade_block';
  opacityStart: number;
  opacityEnd: number;
  duration: number;
  fadeStyle: 'Linear' | 'EaseInOut';
  layer: 'Tela' | 'Background';
}

export interface OpenBoardBlock extends BaseEventBlock {
  type: 'open_board';
  aba: string; // 'null' | 'ficha' | 'log' | 'pericias' | etc.
  delay: number; // segundos
}

export interface LoopBlock extends BaseEventBlock {
  type: 'loop_start' | 'loop_end';
  count?: number;
}

export type EventBlock =
  | WaitBlock
  | ChangeBackgroundBlock
  | ResetBackgroundBlock
  | ImageFadeBlock
  | PlayOstBlock
  | StopOstBlock
  | CutsceneBlock
  | FadeBlock
  | OpenBoardBlock
  | LoopBlock
  | (BaseEventBlock & Record<string, any>);

export interface AutomationEvent {
  id: string;
  name: string;
  isToggle: boolean;
  blocks: EventBlock[];
  description?: string;
  createdAt?: number;
  target?: 'all' | string;
}

export interface BuilderEventPayload {
  eventId: string;
  isToggle: boolean;
  action?: 'start' | 'stop';
  blocks?: EventBlock[];
  target: 'all' | string;
}

/**
 * Cria bloco padrão baseado no tipo selecionado (utilitário para builders futuros)
 */
export function createDefaultEventBlock(type: EventBlockType): EventBlock {
  const id = `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  switch (type) {
    case 'aguarde':
      return { id, type, value: 1 };
    case 'mudar_fundo':
      return { id, type, value: '' };
    case 'fundo_original':
      return { id, type };
    case 'imagem_fade':
      return { id, type, value: 50 };
    case 'play_ost':
      return { id, type, ostId: '', volume: 1, fadeTime: 1 };
    case 'stop_ost':
      return { id, type, fadeTime: 1 };
    case 'cutscene':
      return {
        id,
        type,
        title: '',
        subtitle: '',
        zoom: 2.5,
        bars: true,
        duration: 6,
        ostId: '',
        textColor: '#FFFFFF',
        subtitleColor: '#ef4444',
        fontFamily: '',
        textShadow: true,
      };
    case 'fade_block':
      return {
        id,
        type,
        opacityStart: 0,
        opacityEnd: 1,
        duration: 1,
        fadeStyle: 'Linear',
        layer: 'Tela',
      };
    case 'open_board':
      return { id, type, aba: 'null', delay: 0 };
    case 'loop_start':
      return { id, type, count: 1 };
    case 'loop_end':
      return { id, type };
    default:
      return { id, type, value: null };
  }
}
