import React, { useState, useEffect, useRef, useMemo } from 'react';
import { 
  MousePointer, 
  Move, 
  Square, 
  Grid, 
  Eraser, 
  Plus, 
  Trash2, 
  Settings, 
  Layers, 
  Lock, 
  Unlock, 
  Save, 
  FolderOpen, 
  ZoomIn, 
  ZoomOut, 
  RotateCcw, 
  Upload, 
  User, 
  Check, 
  X,
  Copy,
  Sliders,
  Sparkles,
  RefreshCw,
  Eye,
  Minimize2,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  ChevronDown,
  Pencil,
  Search,
  PaintBucket
} from 'lucide-react';
import { supabase } from '../lib/supabase';

// Standard base cell size for sizing reference (64px)
const CELL_SIZE = 64;

export interface GridObject {
  id: string;
  type: 'wall' | 'floor' | 'token' | 'obstacle' | 'room';
  name: string;
  x: number; // World X in pixels
  y: number; // World Y in pixels
  width: number; // Width in pixels
  height: number; // Height in pixels
  rotation: number; // Rotation in degrees
  color: string; // Theme color
  isLocked: boolean;
  opacity?: number;
  
  // Specific fields
  ownerId?: string | null;     // Token character link
  ownerName?: string;          // Token character name
  customImage?: string;        // Token raw base64 or external url
  hp?: { current: number; max: number }; // Token HP bar
  layer: 'ground' | 'character' | 'overlay';
}

export interface GridState {
  objects: GridObject[];
  tiles?: Record<string, 'wall' | 'floor'>;
}

interface TabletopGridProps {
  supabase: any;
  globalChannelRef: React.MutableRefObject<any>;
  userUid: string | null;
  players: any[];
  isMestreAuth: boolean;
  globalGridState: GridState | null;
  setGlobalGridState: React.Dispatch<React.SetStateAction<GridState>>;
}

const SHAPE_COLORS = [
  { id: '#1E293B', name: 'Zinco', class: 'bg-slate-800' },
  { id: '#3F3F46', name: 'Ferro', class: 'bg-zinc-700' },
  { id: '#7F1D1D', name: 'Sangue', class: 'bg-red-950' },
  { id: '#451A03', name: 'Madeira', class: 'bg-amber-950' },
  { id: '#064E3B', name: 'Esmalda', class: 'bg-emerald-950' },
  { id: '#1E3A8A', name: 'Abismo', class: 'bg-blue-950' },
  { id: '#581C87', name: 'Rúnico', class: 'bg-purple-950' },
  { id: '#111827', name: 'Sombra', class: 'bg-gray-900' },
];

const DEFAULT_OBJECTS: GridObject[] = [];

// Gerador inicial de Tiles Padrão
const DEFAULT_TILES: Record<string, 'wall' | 'floor'> = {};
for (let y = -4; y <= 4; y++) {
  for (let x = -4; x <= 4; x++) {
    if (x === -4 || x === 4 || y === -4 || y === 4) {
      DEFAULT_TILES[`${x},${y}`] = 'wall';
    } else {
      DEFAULT_TILES[`${x},${y}`] = 'floor';
    }
  }
}

export function TabletopGrid({
  supabase,
  globalChannelRef,
  userUid,
  players,
  isMestreAuth,
  globalGridState,
  setGlobalGridState
}: TabletopGridProps) {
  // Ensure we have a valid state format
  const sanitizedGridState = useMemo<GridState>(() => {
    let tiles = globalGridState?.tiles || {};
    if (!globalGridState || !Array.isArray(globalGridState.objects)) {
      return { objects: DEFAULT_OBJECTS, tiles: DEFAULT_TILES };
    }
    if (Object.keys(tiles).length === 0 && globalGridState.objects.length === 0) {
      tiles = DEFAULT_TILES;
    }
    return { ...globalGridState, tiles };
  }, [globalGridState]);

  // Navigation states
  const [cameraOffset, setCameraOffset] = useState({ x: 0, y: 0 }); // Offset in pixels
  const [zoom, setZoom] = useState(1.0); // 0.25 to 4.0
  const [snapToGrid, setSnapToGrid] = useState(true);

  // Interaction Tools
  // 'select': Choose & transform shapes
  // 'pan': Move visual viewport
  // 'create_floor': Drag and drop/paint a single floor block
  // 'create_wall': Drag and drop/paint a single wall block
  // 'erase': Erase painted tiles
  const [activeTool, setActiveTool] = useState<'select' | 'pan' | 'create_floor' | 'create_wall' | 'erase'>('select');
  const [activeLayer, setActiveLayer] = useState<'ground' | 'character' | 'overlay'>('character');
  const [brushSize, setBrushSize] = useState<{w: number, h: number}>({w: 1, h: 1});

  // Mobile/PixelStudio Zoom Knob State
  const [isZoomDragging, setIsZoomDragging] = useState(false);
  const zoomDragStartY = useRef<number | null>(null);
  const zoomStartValue = useRef<number>(1.0);

  const handleZoomKnobStart = (e: React.PointerEvent) => {
    setIsZoomDragging(true);
    zoomDragStartY.current = e.clientY;
    zoomStartValue.current = zoom;
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const handleZoomKnobMove = (e: React.PointerEvent) => {
    if (isZoomDragging && zoomDragStartY.current !== null) {
      const deltaY = e.clientY - zoomDragStartY.current;
      // Drag up zooms in (deltaY < 0), drag down zooms out (deltaY > 0)
      const ratio = Math.exp(-deltaY / 150); // Adjust divisor for sensitivity
      const nextZoom = Math.max(0.25, Math.min(4.0, zoomStartValue.current * ratio));
      
      if (containerRef.current) {
        // Center of the screen in 'local' centered coordinates is 0, 0
        const localX = 0;
        const localY = 0;
        
        const worldX = (localX - cameraOffset.x) / zoom;
        const worldY = (localY - cameraOffset.y) / zoom;
        
        setCameraOffset({
          x: localX - worldX * nextZoom,
          y: localY - worldY * nextZoom
        });
      }

      setZoom(nextZoom);
    }
  };

  const handleZoomKnobEnd = (e: React.PointerEvent) => {
    setIsZoomDragging(false);
    zoomDragStartY.current = null;
    e.currentTarget.releasePointerCapture(e.pointerId);
  };

  // Prevent browser-level gesture zooming and page scrolling inside canvas view on touch screen
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handlePrevent = (e: TouchEvent) => {
      const target = e.target as HTMLElement;
      // Never block elements with input controls on the UI HUD
      if (target.closest('.hud-ui')) return;

      // Prevent native scroll, bounce, and pinch-to-zoom completely!
      e.preventDefault();
    };

    container.addEventListener('touchstart', handlePrevent, { passive: false });
    container.addEventListener('touchmove', handlePrevent, { passive: false });
    container.addEventListener('gesturestart', handlePrevent, { passive: false });

    return () => {
      container.removeEventListener('touchstart', handlePrevent);
      container.removeEventListener('touchmove', handlePrevent);
      container.removeEventListener('gesturestart', handlePrevent);
    };
  }, []);

  // Selected state
  const [selectedObjectId, setSelectedObjectId] = useState<string | null>(null);

  // Painting/Dragging states
  // Removed old bounds

  // Transformation states
  const [transformingAction, setTransformingAction] = useState<'move' | 'resize' | 'rotate' | null>(null);
  const [resizeHandleId, setResizeHandleId] = useState<string | null>(null); // 'tl', 'tr', 'bl', 'br', 'tm', 'bm', 'lm', 'rm'
  const transformStartObj = useRef<GridObject | null>(null);
  const transformStartLoc = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  // Token creation modal
  const [showAddTokenModal, setShowAddTokenModal] = useState(false);
  const [newTokenName, setNewTokenName] = useState('');
  const [newTokenOwner, setNewTokenOwner] = useState<string>(''); // "" for NPC
  const [newTokenColor, setNewTokenColor] = useState('#e63946');
  const [newTokenImage, setNewTokenImage] = useState<string>('');

  // Local storage Scenario Slots
  const [scenarioSlots, setScenarioSlots] = useState<{ id: number; name: string; timestamp: string }[]>([]);
  const [showScenarioModal, setShowScenarioModal] = useState(false);
  const [editingSlotId, setEditingSlotId] = useState<number | null>(null);
  const [editingSlotName, setEditingSlotName] = useState('');

  // Dom structures
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 });
  const isDraggingCamera = useRef(false);
  const cameraDragStart = useRef({ x: 0, y: 0 });

  // Load viewport size and keep responsive
  useEffect(() => {
    if (!containerRef.current) return;
    const resizeObserver = new ResizeObserver((entries) => {
      for (let entry of entries) {
        setDimensions({
          width: entry.contentRect.width || 800,
          height: entry.contentRect.height || 600
        });
      }
    });
    resizeObserver.observe(containerRef.current);
    
    const rect = containerRef.current.getBoundingClientRect();
    setDimensions({ width: rect.width || 800, height: rect.height || 600 });

    return () => resizeObserver.disconnect();
  }, []);

  // Sync / Load saved tabletop scenario slots
  useEffect(() => {
    const loaded = localStorage.getItem('tabletop_scenarios_modern');
    if (loaded) {
      try {
        setScenarioSlots(JSON.parse(loaded));
      } catch (e) {
        console.error(e);
      }
    } else {
      const initial = [
        { id: 1, name: "Masmorra Clássica", timestamp: "" },
        { id: 2, name: "Salão de Banquete", timestamp: "" },
        { id: 3, name: "Floresta Maldita", timestamp: "" },
        { id: 4, name: "Laboratório Cibernético", timestamp: "" },
        { id: 5, name: "Cenário Ad-hoc", timestamp: "" },
      ];
      localStorage.setItem('tabletop_scenarios_modern', JSON.stringify(initial));
      setScenarioSlots(initial);
    }
  }, []);

  // Helper helper: Translate viewport pixel coordinate to absolute world coordinate
  const screenToWorld = (clientX: number, clientY: number) => {
    if (!containerRef.current) return { x: 0, y: 0 };
    const rect = containerRef.current.getBoundingClientRect();
    const localX = clientX - rect.left;
    const localY = clientY - rect.top;

    // Apply viewport scale reverse
    const worldX = (localX - rect.width / 2 - cameraOffset.x) / zoom;
    const worldY = (localY - rect.height / 2 - cameraOffset.y) / zoom;

    return { x: worldX, y: worldY };
  };

  // Broadcast & Sync DB helpers
  const saveAndSyncGrid = (newState: GridState) => {
    setGlobalGridState(newState);

    if (globalChannelRef.current) {
      globalChannelRef.current.send({
        type: 'broadcast',
        event: 'grid_broadcast',
        payload: newState
      }).then(
        () => {},
        (e: any) => console.warn("Broadcast err:", e.message)
      );
    }

    supabase.from('players').upsert({
      id: 'TABLETOP_GRID',
      data: newState,
      updated_at: new Date().toISOString()
    }).then(
      ({ error }) => {
        if (error) console.warn("DB Storage warning:", error.message);
      },
      (e: any) => console.warn("DB Storage error rejection:", e.message)
    );
  };

  // Helper to round/snap to grid cell (snapToGrid checks)
  const snapValue = (val: number, step = CELL_SIZE) => {
    if (!snapToGrid) return val;
    return Math.round(val / step) * step;
  };

  // Map Painting
  const [isPaintingTiles, setIsPaintingTiles] = useState(false);
  const paintValueRef = useRef<'wall' | 'floor' | 'erase' | null>(null);
  const [hoverGridPos, setHoverGridPos] = useState<{x: number, y: number} | null>(null);

  const getGridCoordsFromEvent = (clientX: number, clientY: number) => {
    const world = screenToWorld(clientX, clientY);
    return {
      gridX: Math.floor(world.x / CELL_SIZE),
      gridY: Math.floor(world.y / CELL_SIZE)
    };
  };

  const paintTile = (gridX: number, gridY: number, type: 'wall' | 'floor' | 'erase') => {
    setGlobalGridState((prev) => {
      const currentTiles = prev.tiles || {};
      const newTiles = { ...currentTiles };
      let changed = false;

      for (let w = 0; w < brushSize.w; w++) {
        for (let h = 0; h < brushSize.h; h++) {
          const key = `${gridX + w},${gridY + h}`;
          if (type === 'erase') {
             if (newTiles[key] !== undefined) {
               delete newTiles[key];
               changed = true;
             }
          } else {
             if (newTiles[key] !== type) {
               newTiles[key] = type;
               changed = true;
             }
          }
        }
      }

      if (!changed) return prev;
      return { ...prev, tiles: newTiles };
    });
  };

  // Retrieve current selected entity
  const selectedObject = useMemo(() => {
    if (!selectedObjectId) return null;
    return sanitizedGridState.objects.find(o => o.id === selectedObjectId) || null;
  }, [selectedObjectId, sanitizedGridState]);

  // Duplicate current selected
  const duplicateSelected = () => {
    if (!selectedObject || !isMestreAuth) return;

    // Shift offset a bit so they do not overlap perfectly
    const duplicated: GridObject = {
      ...selectedObject,
      id: `map_item_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 6)}`,
      name: `${selectedObject.name} copia`,
      x: selectedObject.x + CELL_SIZE,
      y: selectedObject.y + CELL_SIZE,
      isLocked: false // Start unlocked
    };

    const newState = {
      objects: [...sanitizedGridState.objects, duplicated]
    };
    saveAndSyncGrid(newState);
    setSelectedObjectId(duplicated.id);
  };

  // Delete current selected
  const deleteSelected = () => {
    if (!selectedObject) return;
    
    // Authorization check
    if (!isMestreAuth) {
      const isMine = selectedObject.ownerId === userUid;
      if (!isMine) return; // Player can only delete their own token if allowed
    }

    const updated = sanitizedGridState.objects.filter(o => o.id !== selectedObject.id);
    saveAndSyncGrid({ objects: updated });
    setSelectedObjectId(null);
  };

  // Move camera & transform events using Unified Pointers (Touch and Mouse)
  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    // Avoid double trigger from iframe touch events
    const target = e.target as HTMLElement;
    if (target.closest('.hud-ui')) return;

    e.preventDefault();
    (e.target as HTMLElement).setPointerCapture(e.pointerId);

    const world = screenToWorld(e.clientX, e.clientY);

    // 1. If we are drawing/painting tiles
    if (activeTool === 'create_floor' || activeTool === 'create_wall' || activeTool === 'erase') {
      if (!isMestreAuth) return;
      setIsPaintingTiles(true);
      let type: 'wall' | 'floor' | 'erase' = 'erase';
      if (activeTool === 'create_wall') type = 'wall';
      if (activeTool === 'create_floor') type = 'floor';
      paintValueRef.current = type;
      const { gridX, gridY } = getGridCoordsFromEvent(e.clientX, e.clientY);
      paintTile(gridX, gridY, type);
      return;
    }

    // 2. If 'pan' (Move Camera) tool is selected, bypass hit testing and pan camera immediately
    if (activeTool === 'pan') {
      isDraggingCamera.current = true;
      cameraDragStart.current = { x: e.clientX, y: e.clientY };
      return;
    }

    // 3. Identify if we clicked inside a handle or an active object
    const isClickOnHandle = target.closest('.resize-handle') || target.closest('.rotate-handle');
    
    if (selectedObject && isClickOnHandle) {
      // Handles manipulation triggered!
      transformStartObj.current = { ...selectedObject };
      transformStartLoc.current = world;

      if (target.closest('.rotate-handle')) {
        setTransformingAction('rotate');
      } else {
        const handleId = target.getAttribute('data-handle');
        setTransformingAction('resize');
        setResizeHandleId(handleId);
      }
      return;
    }

    // 4. Try to hit-test objects on map
    // Sort reverse to select objects displayed on top first
    const hitObj = [...sanitizedGridState.objects]
      .reverse()
      .find(obj => {
        // Simple bounding box containment test
        const left = obj.x;
        const top = obj.y;
        const right = obj.x + obj.width;
        const bottom = obj.y + obj.height;

        return world.x >= left && world.x <= right && world.y >= top && world.y <= bottom;
      });

    if (hitObj) {
      // Authorization Check to see if player owns the token, or they are Mestre
      const isOwner = hitObj.ownerId === userUid;
      const canManage = isMestreAuth || (isOwner && !hitObj.isLocked);

      if (canManage) {
        setSelectedObjectId(hitObj.id);
        setTransformingAction('move');
        transformStartObj.current = { ...hitObj };
        transformStartLoc.current = world;
      } else {
        // Player viewing item
        setSelectedObjectId(hitObj.id);
      }
      return;
    }

    // 5. Default: pan the whole camera
    isDraggingCamera.current = true;
    cameraDragStart.current = { x: e.clientX, y: e.clientY };
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!containerRef.current) return;
    const world = screenToWorld(e.clientX, e.clientY);

    // Hover brush tracker
    if (activeTool === 'create_wall' || activeTool === 'create_floor' || activeTool === 'erase') {
      const { gridX, gridY } = getGridCoordsFromEvent(e.clientX, e.clientY);
      setHoverGridPos({ x: gridX, y: gridY });
    } else if (hoverGridPos !== null) {
      setHoverGridPos(null);
    }

    // Real-time tile painting
    if (isPaintingTiles && paintValueRef.current) {
      if (!isMestreAuth) return;
      const { gridX, gridY } = getGridCoordsFromEvent(e.clientX, e.clientY);
      paintTile(gridX, gridY, paintValueRef.current);
      return;
    }

    // Transforming selected objects
    if (transformingAction && selectedObject && transformStartObj.current) {
      const orig = transformStartObj.current;
      const deltaX = world.x - transformStartLoc.current.x;
      const deltaY = world.y - transformStartLoc.current.y;

      const objectsRef = [...sanitizedGridState.objects];

      if (transformingAction === 'move') {
        const nextX = snapValue(orig.x + deltaX);
        const nextY = snapValue(orig.y + deltaY);

        // Tile-based AutoTile boundary collision block check for tokens
        if (orig.type === 'token') {
          // Token is typical size (say 64). We need to check the cells it overlaps
          const cellLeft = Math.floor(nextX / CELL_SIZE);
          const cellRight = Math.floor((nextX + orig.width - 1) / CELL_SIZE);
          const cellTop = Math.floor(nextY / CELL_SIZE);
          const cellBottom = Math.floor((nextY + orig.height - 1) / CELL_SIZE);

          let collision = false;
          for (let cy = cellTop; cy <= cellBottom; cy++) {
            for (let cx = cellLeft; cx <= cellRight; cx++) {
              if (sanitizedGridState.tiles?.[`${cx},${cy}`] === 'wall') {
                collision = true;
              }
            }
          }
          
          if (collision) return; // Prevent walking into walls!
        }

        const updated = objectsRef.map(o => {
          if (o.id === selectedObject.id) {
            return { ...o, x: nextX, y: nextY };
          }
          return o;
        });
        setGlobalGridState({ objects: updated });
      } 
      
      else if (transformingAction === 'resize') {
        let nextX = orig.x;
        let nextY = orig.y;
        let nextWidth = orig.width;
        let nextHeight = orig.height;

        // Bounding calculation based on handle dragged
        if (resizeHandleId?.includes('r')) {
          nextWidth = snapValue(orig.width + deltaX);
        }
        if (resizeHandleId?.includes('l')) {
          const proposedWidth = orig.width - deltaX;
          if (proposedWidth > 16) {
            nextX = snapValue(orig.x + deltaX);
            nextWidth = snapValue(proposedWidth);
          }
        }
        if (resizeHandleId?.includes('b')) {
          nextHeight = snapValue(orig.height + deltaY);
        }
        if (resizeHandleId?.includes('t')) {
          const proposedHeight = orig.height - deltaY;
          if (proposedHeight > 16) {
            nextY = snapValue(orig.y + deltaY);
            nextHeight = snapValue(proposedHeight);
          }
        }

        // Apply strict min bounds
        nextWidth = Math.max(16, nextWidth);
        nextHeight = Math.max(16, nextHeight);

        const updated = objectsRef.map(o => {
          if (o.id === selectedObject.id) {
            return { ...o, x: nextX, y: nextY, width: nextWidth, height: nextHeight };
          }
          return o;
        });
        setGlobalGridState({ objects: updated });
      } 
      
      else if (transformingAction === 'rotate') {
        // Find angle in degrees relative to center point of object
        const centerX = orig.x + orig.width / 2;
        const centerY = orig.y + orig.height / 2;

        const rads = Math.atan2(world.y - centerY, world.x - centerX);
        let degrees = Math.round(rads * (180 / Math.PI));

        // Snap rotation options every 15 degrees if snap to grid
        if (snapToGrid) {
          degrees = Math.round(degrees / 15) * 15;
        }

        const updated = objectsRef.map(o => {
          if (o.id === selectedObject.id) {
            return { ...o, rotation: degrees };
          }
          return o;
        });
        setGlobalGridState({ objects: updated });
      }
      return;
    }

    // General Camera dragging
    if (isDraggingCamera.current) {
      const dx = e.clientX - cameraDragStart.current.x;
      const dy = e.clientY - cameraDragStart.current.y;
      cameraDragStart.current = { x: e.clientX, y: e.clientY };

      setCameraOffset(prev => ({
        x: prev.x + dx,
        y: prev.y + dy
      }));
    }
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    (e.target as HTMLElement).releasePointerCapture(e.pointerId);

    const world = screenToWorld(e.clientX, e.clientY);

    // Finished dynamic tile painting?
    if (isPaintingTiles) {
      setIsPaintingTiles(false);
      paintValueRef.current = null;
      // Sync the tile matrix to server
      saveAndSyncGrid({ 
        objects: sanitizedGridState.objects, 
        tiles: sanitizedGridState.tiles 
      });
      return;
    }

    // Save final state on DB and notify peers
    if (transformingAction) {
      saveAndSyncGrid({ objects: sanitizedGridState.objects });
    }

    isDraggingCamera.current = false;
    setTransformingAction(null);
    setResizeHandleId(null);
    transformStartObj.current = null;
  };

  // High performance touch event interceptor for mobile zooming
  const startTouchDist = useRef<number | null>(null);
  const startTouchZoom = useRef<number>(1.0);
  
  const handleTouchStart = (e: React.TouchEvent) => {
    // Intercept standard touch response behaviors to solve parent viewport navigation issues!
    if (e.touches.length === 2) {
      const t1 = e.touches[0];
      const t2 = e.touches[1];
      startTouchDist.current = Math.hypot(t1.clientX - t2.clientX, t1.clientY - t2.clientY);
      startTouchZoom.current = zoom;
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (e.touches.length === 2 && startTouchDist.current !== null) {
      e.preventDefault(); // Solve browser page zoom completely on mobile!
      const t1 = e.touches[0];
      const t2 = e.touches[1];
      const currentDist = Math.hypot(t1.clientX - t2.clientX, t1.clientY - t2.clientY);
      const ratio = currentDist / startTouchDist.current;
      
      const nextZoom = Math.max(0.25, Math.min(4.0, startTouchZoom.current * ratio));

      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        const centerX = (t1.clientX + t2.clientX) / 2;
        const centerY = (t1.clientY + t2.clientY) / 2;

        const localX = centerX - rect.left - rect.width / 2;
        const localY = centerY - rect.top - rect.height / 2;

        const worldX = (localX - cameraOffset.x) / zoom;
        const worldY = (localY - cameraOffset.y) / zoom;

        setCameraOffset({
          x: localX - worldX * nextZoom,
          y: localY - worldY * nextZoom
        });
      }

      setZoom(nextZoom);
    }
  };

  const handleTouchEnd = () => {
    startTouchDist.current = null;
  };

  // Wheel Zoom for desktop zooming
  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const ratio = e.deltaY < 0 ? 1.1 : 0.9;
    const nextZoom = Math.max(0.25, Math.min(4.0, zoom * ratio));
    
    if (containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      const localX = e.clientX - rect.left - rect.width / 2;
      const localY = e.clientY - rect.top - rect.height / 2;
      
      const worldX = (localX - cameraOffset.x) / zoom;
      const worldY = (localY - cameraOffset.y) / zoom;
      
      setCameraOffset({
        x: localX - worldX * nextZoom,
        y: localY - worldY * nextZoom
      });
    }

    setZoom(nextZoom);
  };

  // Reset Vision Helper
  const recenterCamera = () => {
    setCameraOffset({ x: 0, y: 0 });
    setZoom(1.0);
  };

  const handleZoomChangeFixedCenter = (delta: number) => {
    setZoom(prev => {
      const nextZoom = Math.max(0.25, Math.min(4.0, prev + delta));
      
      if (containerRef.current) {
        const localX = 0;
        const localY = 0;
        
        const worldX = (localX - cameraOffset.x) / prev;
        const worldY = (localY - cameraOffset.y) / prev;
        
        setCameraOffset({
          x: localX - worldX * nextZoom,
          y: localY - worldY * nextZoom
        });
      }
      
      return nextZoom;
    });
  };

  // New Custom Token Creator Admin panel
  const handleAddTokenSubmit = () => {
    if (!newTokenName.trim()) return;

    const matchedPlayer = players.find(p => p.id === newTokenOwner);
    const ownerNameStr = matchedPlayer ? matchedPlayer.name : 'Mestre / NPC';

    const cleanToken: GridObject = {
      id: `token_${Date.now().toString(36)}`,
      type: 'token',
      name: newTokenName,
      x: snapValue(-cameraOffset.x / zoom - CELL_SIZE / 2),
      y: snapValue(-cameraOffset.y / zoom - CELL_SIZE / 2),
      width: CELL_SIZE,
      height: CELL_SIZE,
      rotation: 0,
      color: newTokenColor,
      customImage: newTokenImage || undefined,
      isLocked: false,
      layer: 'character',
      ownerId: newTokenOwner || null,
      ownerName: ownerNameStr,
      hp: matchedPlayer?.hp ? { current: matchedPlayer.hp.current, max: matchedPlayer.hp.max } : undefined
    };

    const newState = {
      objects: [...sanitizedGridState.objects, cleanToken]
    };
    saveAndSyncGrid(newState);
    setSelectedObjectId(cleanToken.id);

    // Reset fields
    setNewTokenName('');
    setNewTokenOwner('');
    setNewTokenImage('');
    setShowAddTokenModal(false);
  };

  // Local Scenario storage slots mechanics
  const handleSaveScenario = (slotId: number) => {
    const timeFormatted = new Date().toLocaleString('pt-BR');
    const slotLabel = editingSlotName.trim() || `Cenário #${slotId}`;

    // Get scenarios data in LocalStorage pool
    const loadedData = localStorage.getItem('tabletop_scenarios_pool_modern') || '{}';
    let scenariosData: Record<number, any> = {};
    try { scenariosData = JSON.parse(loadedData); } catch {}

    // Save only visual static/ground templates, ignore temporary character tokens unless custom
    const visualScenery = sanitizedGridState.objects.filter(o => o.type !== 'token');
    scenariosData[slotId] = {
      name: slotLabel,
      scenery: visualScenery
    };

    localStorage.setItem('tabletop_scenarios_pool_modern', JSON.stringify(scenariosData));

    const updatedSlots = scenarioSlots.map(s => {
      if (s.id === slotId) {
        return { id: slotId, name: slotLabel, timestamp: timeFormatted };
      }
      return s;
    });

    localStorage.setItem('tabletop_scenarios_modern', JSON.stringify(updatedSlots));
    setScenarioSlots(updatedSlots);
    setEditingSlotId(null);
    setEditingSlotName('');
  };

  const handleLoadScenario = (slotId: number) => {
    if (!isMestreAuth) return;

    const loadedData = localStorage.getItem('tabletop_scenarios_pool_modern');
    if (!loadedData) return;

    try {
      const parsed = JSON.parse(loadedData);
      const targetSlot = parsed[slotId];
      if (targetSlot?.scenery) {
        // Keep active characters but replace walls/piso layout perfectly
        const currentTokens = sanitizedGridState.objects.filter(o => o.type === 'token');
        const nextState = {
          objects: [...targetSlot.scenery, ...currentTokens]
        };
        saveAndSyncGrid(nextState);
        setShowScenarioModal(false);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const clearSceneryOnly = () => {
    if (!confirm('Deseja apagar todos as estruturas do mestre? (Seus tokens serão mantidos intactos)')) return;
    const tokensOnly = sanitizedGridState.objects.filter(o => o.type === 'token');
    saveAndSyncGrid({ objects: tokensOnly });
    setSelectedObjectId(null);
  };

  return (
    <div 
      className="flex-1 flex flex-col h-[calc(100vh-3.5rem)] relative overflow-hidden bg-[#030303] select-none"
      style={{ touchAction: 'none' }} // Crucial to prevent accidental mobile zooming
    >
      
      {/* 1. MAP HEADER OVERLAYS */}
      <div className="absolute top-4 left-4 z-40 bg-black/90 backdrop-blur-md border border-[#1A1A1A] p-4 rounded-xl shadow-[0_4px_30px_rgba(0,0,0,0.8)] flex flex-wrap gap-4 items-center max-w-[calc(150px+40vw)] sm:max-w-xl hud-ui animate-in fade-in zoom-in-95">
        <div>
          <h3 className="font-black text-blood-red uppercase tracking-widest text-xs flex items-center gap-1.5"><Sparkles size={14} className="text-yellow-500 animate-pulse"/> Canva Tabletop</h3>
          <p className="text-[9px] text-gray-500 uppercase tracking-widest mt-0.5">Sincronização em tempo real</p>
        </div>

        <div className="hidden sm:block h-8 w-px bg-white/10" />

        <div className="flex items-center gap-2">
          {/* Zoom In & Out */}
          <button 
            onClick={() => handleZoomChangeFixedCenter(-0.25)}
            className="p-1.5 bg-[#121212] hover:bg-[#1A1A1A] border border-[#222] rounded transition-all text-gray-300 hover:text-white"
            title="Afastar"
          >
            <ZoomOut size={16} />
          </button>
          <span className="text-xs font-mono font-bold text-gray-300 w-12 text-center select-none">
            {Math.round(zoom * 100)}%
          </span>
          <button 
            onClick={() => handleZoomChangeFixedCenter(0.25)}
            className="p-1.5 bg-[#121212] hover:bg-[#1A1A1A] border border-[#222] rounded transition-all text-gray-300 hover:text-white"
            title="Aproximar"
          >
            <ZoomIn size={16} />
          </button>

          {/* Reset position & Center view */}
          <button 
            onClick={recenterCamera}
            className="p-1.5 bg-[#150202] hover:bg-blood-red/20 border border-blood-red/40 rounded transition-all text-blood-red hover:text-white flex items-center justify-center animate-pulse"
            title="Recentralizar Visão"
          >
            <RotateCcw size={16} />
          </button>

          {/* Magnetic grid align option toggler */}
          <button 
            onClick={() => setSnapToGrid(!snapToGrid)}
            className={`p-1.5 border rounded transition-all flex items-center justify-center ${snapToGrid ? 'bg-yellow-500/10 border-yellow-500/30 text-yellow-500' : 'bg-[#121212] border-[#222] text-gray-600'}`}
            title={snapToGrid ? "Magnetismo Grid: Ativado" : "Magnetismo Grid: Desativado"}
          >
            <Grid size={16} />
          </button>

          {isMestreAuth && (
            <button 
              onClick={() => setShowScenarioModal(true)}
              className="py-1.5 px-2.5 bg-blue-950 hover:bg-blue-900 border border-blue-500/30 rounded text-[10px] uppercase font-bold tracking-widest text-blue-400 flex items-center gap-1 shadow transition-all"
            >
              <FolderOpen size={13} /> Mapas
            </button>
          )}
        </div>
      </div>

      {/* 2. INFINITE INTERACTIVE WORKSPACE AREA AREA */}
      <div 
        ref={containerRef}
        className={`w-full h-full relative overflow-hidden select-none ${
          activeTool === 'pan' 
            ? isDraggingCamera.current 
              ? 'cursor-grabbing' 
              : 'cursor-grab' 
            : 'cursor-default'
        }`}
        style={{ touchAction: 'none' }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onWheel={handleWheel}
      >
        
        {/* Visual Backgrid coordinates reference system */}
        <div 
          className="absolute inset-0 pointer-events-none"
          style={{
            backgroundImage: `
              linear-gradient(to right, rgba(239, 68, 68, 0.04) 1px, transparent 1px),
              linear-gradient(to bottom, rgba(239, 68, 68, 0.04) 1px, transparent 1px)
            `,
            backgroundSize: `${CELL_SIZE * zoom}px ${CELL_SIZE * zoom}px`,
            backgroundPosition: `${dimensions.width / 2 + cameraOffset.x}px ${dimensions.height / 2 + cameraOffset.y}px`
          }}
        />

        {/* Central visual core anchor lines */}
        <div 
          className="absolute h-0.5 bg-blood-red/10 pointer-events-none"
          style={{
            left: 0,
            right: 0,
            top: dimensions.height / 2 + cameraOffset.y
          }}
        />
        <div 
          className="absolute w-0.5 bg-blood-red/10 pointer-events-none"
          style={{
            top: 0,
            bottom: 0,
            left: dimensions.width / 2 + cameraOffset.x
          }}
        />

        {/* Transformation World Map Objects Container */}
        <div 
          className="absolute pointer-events-none origin-top-left"
          style={{
            left: dimensions.width / 2 + cameraOffset.x,
            top: dimensions.height / 2 + cameraOffset.y,
            transform: `scale(${zoom})`
          }}
        >
          {/* Render Tiles */}
          {Object.entries(sanitizedGridState.tiles || {}).map(([key, type]) => {
            const [gx, gy] = key.split(',').map(Number);
            const x = gx * CELL_SIZE;
            const y = gy * CELL_SIZE;

            if (type === 'floor') {
              return (
                <div 
                  key={key}
                  className="absolute"
                  style={{
                    left: x, top: y, width: CELL_SIZE, height: CELL_SIZE,
                    backgroundColor: '#3F3F46', // Chão (Floor) baseline
                    border: '1px solid #27272A' // Subtle grid outline
                  }}
                />
              );
            }

            // For walls, we calculate auto-tile bitmask
            const tiles = sanitizedGridState.tiles || {};
            let mask = 0;
            if (tiles[`${gx},${gy-1}`] === 'wall') mask += 1; // N
            if (tiles[`${gx+1},${gy}`] === 'wall') mask += 2; // E
            if (tiles[`${gx},${gy+1}`] === 'wall') mask += 4; // S
            if (tiles[`${gx-1},${gy}`] === 'wall') mask += 8; // W

            // Generate precise connection shapes based on mask
            // thickness of the connections:
            const ts = 24; // thickness size
            const bs = (CELL_SIZE - ts) / 2; // border size (20 for 64px cell)

            return (
              <div 
                key={key}
                className="absolute flex items-center justify-center"
                style={{
                  left: x, top: y, width: CELL_SIZE, height: CELL_SIZE,
                }}
              >
                <div style={{ position: 'relative', width: '100%', height: '100%', backgroundColor: '#09090b' /* ambient shadow / ground underneath wall */ }}>
                  {/* Central Hub block */}
                  <div className="absolute bg-[#1E293B] border border-slate-700/50" style={{ left: bs, top: bs, width: ts, height: ts, zIndex: 2 }} />
                  
                  {/* North Connection */}
                  {(mask & 1) !== 0 && (
                    <div className="absolute bg-[#1E293B] border-x border-slate-700/50" style={{ left: bs, top: 0, width: ts, height: bs + 1 /* +1 for overlap */, zIndex: 1 }} />
                  )}
                  {/* East Connection */}
                  {(mask & 2) !== 0 && (
                    <div className="absolute bg-[#1E293B] border-y border-slate-700/50" style={{ left: bs + ts - 1, top: bs, width: bs + 1, height: ts, zIndex: 1 }} />
                  )}
                  {/* South Connection */}
                  {(mask & 4) !== 0 && (
                    <div className="absolute bg-[#1E293B] border-x border-slate-700/50" style={{ left: bs, top: bs + ts - 1, width: ts, height: bs + 1, zIndex: 1 }} />
                  )}
                  {/* West Connection */}
                  {(mask & 8) !== 0 && (
                    <div className="absolute bg-[#1E293B] border-y border-slate-700/50" style={{ left: 0, top: bs, width: bs + 1, height: ts, zIndex: 1 }} />
                  )}
                </div>
              </div>
            );
          })}

          {/* Brush Hover Indicator */}
          {hoverGridPos && (activeTool === 'create_floor' || activeTool === 'create_wall' || activeTool === 'erase') && (
            <div 
              className="absolute pointer-events-none z-[190]"
              style={{
                left: hoverGridPos.x * CELL_SIZE,
                top: hoverGridPos.y * CELL_SIZE,
                width: brushSize.w * CELL_SIZE,
                height: brushSize.h * CELL_SIZE,
                backgroundColor: activeTool === 'erase' ? 'rgba(239, 68, 68, 0.4)' : (activeTool === 'create_floor' ? 'rgba(168, 85, 247, 0.4)' : 'rgba(59, 130, 246, 0.4)'),
                border: `2px solid ${activeTool === 'erase' ? '#ef4444' : (activeTool === 'create_floor' ? '#a855f7' : '#3b82f6')}`
              }}
            />
          )}

          {/* Render All Dynamic Objects in Layers order */}
          {sanitizedGridState.objects.map((obj) => {
            const isSelected = selectedObjectId === obj.id;
            const isMyToken = obj.ownerId === userUid;

            // Render object layout
            return (
              <div 
                key={obj.id}
                className="absolute"
                style={{
                  left: obj.x,
                  top: obj.y,
                  width: obj.width,
                  height: obj.height,
                  transform: `rotate(${obj.rotation}deg)`,
                  transformOrigin: 'center center',
                  zIndex: isSelected ? 150 : obj.type === 'floor' ? 20 : obj.type === 'wall' ? 40 : 100
                }}
              >
                {/* 3. CHARACTER & NPC TOKENS */}
                {obj.type === 'token' && (
                  <div className="w-full h-full relative p-0.5 select-none text-center">
                    <div 
                      className={`w-full h-full rounded-full border-2 flex flex-col items-center justify-center relative shadow-[0_4px_15px_rgba(0,0,0,0.85)] ${
                        isMyToken 
                          ? 'border-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.3)]' 
                          : 'border-blood-red/80 shadow-[0_0_10px_rgba(178,0,0,0.3)]'
                      }`}
                      style={{
                        backgroundColor: obj.customImage ? '#000' : obj.color
                      }}
                    >
                      {obj.customImage ? (
                        <img 
                          src={obj.customImage}
                          alt={obj.name}
                          className="w-full h-full rounded-full object-cover select-none pointer-events-none"
                          referrerPolicy="no-referrer"
                        />
                      ) : (
                        <span className="font-extrabold text-sm select-none uppercase tracking-widest text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.85)]">
                          {obj.name.slice(0, 2)}
                        </span>
                      )}

                      {/* Locked status lock */}
                      {obj.isLocked && (
                        <div className="absolute -top-1 -right-1 bg-black border border-[#333] p-1 rounded-full text-red-500 transform scale-75">
                          <Lock size={10} />
                        </div>
                      )}

                      {/* Character linkage banner tag */}
                      {obj.ownerId ? (
                        <div className="absolute -bottom-1 bg-emerald-950/95 border border-emerald-500/40 text-[7px] font-bold text-emerald-400 py-0.5 px-1.5 rounded-full uppercase tracking-widest whitespace-nowrap scale-75 select-none pointer-events-none">
                          {obj.ownerName}
                        </div>
                      ) : (
                        <div className="absolute -bottom-1 bg-red-950/95 border border-red-500/40 text-[7px] font-bold text-red-400 py-0.5 px-1.5 rounded-full uppercase tracking-widest whitespace-nowrap scale-75 select-none pointer-events-none">
                          NPC
                        </div>
                      )}
                    </div>

                    {/* Simple Overhead Health Bar Indicator */}
                    {obj.hp !== undefined && (
                      <div className="absolute -top-1.5 left-1/2 -translate-x-1/2 w-[80%] h-1.5 bg-black border border-[#222] rounded overflow-hidden select-none pointer-events-none">
                        <div 
                          className="h-full bg-emerald-500"
                          style={{ width: `${Math.max(0, Math.min(100, (obj.hp.current / obj.hp.max) * 100))}%` }}
                        />
                      </div>
                    )}
                  </div>
                )}

                {/* 4. VISUAL SELECTION OUTLINE BOX WITH DRAG HANDLES (Active Canva bounding box) */}
                {isSelected && (
                  <div className="absolute inset-0 border-2 border-yellow-500 pointer-events-none select-none z-[160]">
                    
                    {/* Corner Handles */}
                    {isMestreAuth && (
                      <>
                        {/* Top-Left */}
                        <div 
                          className="absolute w-6 h-6 bg-white border-2 border-yellow-500 rounded-full cursor-nwse-resize -top-3 -left-3 resize-handle pointer-events-auto shadow-md transition-transform hover:scale-110 active:scale-125 flex items-center justify-center"
                          data-handle="tl"
                        />
                        {/* Top-Right */}
                        <div 
                          className="absolute w-6 h-6 bg-white border-2 border-yellow-500 rounded-full cursor-nesw-resize -top-3 -right-3 resize-handle pointer-events-auto shadow-md transition-transform hover:scale-110 active:scale-125 flex items-center justify-center"
                          data-handle="tr"
                        />
                        {/* Bottom-Left */}
                        <div 
                          className="absolute w-6 h-6 bg-white border-2 border-yellow-500 rounded-full cursor-nesw-resize -bottom-3 -left-3 resize-handle pointer-events-auto shadow-md transition-transform hover:scale-110 active:scale-125 flex items-center justify-center"
                          data-handle="bl"
                        />
                        {/* Bottom-Right */}
                        <div 
                          className="absolute w-6 h-6 bg-white border-2 border-yellow-500 rounded-full cursor-nwse-resize -bottom-3 -right-3 resize-handle pointer-events-auto shadow-md transition-transform hover:scale-110 active:scale-125 flex items-center justify-center"
                          data-handle="br"
                        />

                        {/* Mid Sides Sizing Handles */}
                        {/* Mid-Top */}
                        <div 
                          className="absolute w-5 h-5 bg-white border border-yellow-500 cursor-ns-resize -top-2.5 left-1/2 -translate-x-1/2 resize-handle pointer-events-auto shadow-sm transition-transform hover:scale-110 active:scale-125"
                          data-handle="tm"
                        />
                        {/* Mid-Bottom */}
                        <div 
                          className="absolute w-5 h-5 bg-white border border-yellow-500 cursor-ns-resize -bottom-2.5 left-1/2 -translate-x-1/2 resize-handle pointer-events-auto shadow-sm transition-transform hover:scale-110 active:scale-125"
                          data-handle="bm"
                        />
                        {/* Mid-Left */}
                        <div 
                          className="absolute w-5 h-5 bg-white border border-yellow-500 cursor-ew-resize top-1/2 -translate-y-1/2 -left-2.5 resize-handle pointer-events-auto shadow-sm transition-transform hover:scale-110 active:scale-125"
                          data-handle="lm"
                        />
                        {/* Mid-Right */}
                        <div 
                          className="absolute w-5 h-5 bg-white border border-yellow-500 cursor-ew-resize top-1/2 -translate-y-1/2 -right-2.5 resize-handle pointer-events-auto shadow-sm transition-transform hover:scale-110 active:scale-125"
                          data-handle="rm"
                        />

                        {/* Rotation Handle coming from top edge */}
                        <div className="absolute -top-10 left-1/2 -translate-x-1/2 flex flex-col items-center pointer-events-none select-none">
                          <div className="w-0.5 h-4 bg-yellow-500" />
                          <div 
                            className="w-6 h-6 bg-yellow-500 hover:bg-yellow-400 rounded-full cursor-alias pointer-events-auto rotate-handle shadow-lg flex items-center justify-center border border-white transition-transform hover:scale-110 active:scale-125"
                            title="Rotacionar Forma"
                          >
                            <RefreshCw size={10} className="text-black pointer-events-none" />
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* MAP PAINT CONFIGURATION */}
      {isMestreAuth && (activeTool === 'create_floor' || activeTool === 'create_wall' || activeTool === 'erase') && (
        <div className="absolute bottom-6 left-4 z-40 bg-black/95 backdrop-blur-md border border-neutral-800 p-4 rounded-2xl shadow-2xl max-w-sm hud-ui animate-in slide-in-from-left-5">
          <div className="flex justify-between items-center border-b border-white/10 pb-1.5 mb-2.5">
            <div className="flex items-center gap-1.5 text-gray-300 font-extrabold uppercase text-[10px] tracking-wider">
              {activeTool === 'create_floor' && <PaintBucket size={12} className="text-purple-400" />}
              {activeTool === 'create_wall' && <Pencil size={12} className="text-blue-400" />}
              {activeTool === 'erase' && <Eraser size={12} className="text-red-400" />}
              <span>Configuração do Pincel</span>
            </div>
          </div>
          <p className="text-[10px] text-gray-400 mb-3 leading-relaxed">
            Selecione a ferramenta de desenho à direita e o tamanho do pincel. Toque e arraste pelo mapa.
          </p>
          <div className="flex gap-2 w-full mb-1">
            <button 
              onClick={() => setBrushSize({w: 1, h: 1})}
              className={`flex-1 py-1.5 px-2 rounded font-bold text-[10px] border transition-all ${brushSize.w === 1 && brushSize.h === 1 ? 'bg-white/20 border-white/40 text-white' : 'bg-white/5 border-transparent text-gray-400 hover:bg-white/10'}`}
            >
              1x1
            </button>
            <button 
              onClick={() => setBrushSize({w: 2, h: 2})}
              className={`flex-1 py-1.5 px-2 rounded font-bold text-[10px] border transition-all ${brushSize.w === 2 && brushSize.h === 2 ? 'bg-white/20 border-white/40 text-white' : 'bg-white/5 border-transparent text-gray-400 hover:bg-white/10'}`}
            >
              2x2
            </button>
            <button 
              onClick={() => setBrushSize({w: 3, h: 3})}
              className={`flex-1 py-1.5 px-2 rounded font-bold text-[10px] border transition-all ${brushSize.w === 3 && brushSize.h === 3 ? 'bg-white/20 border-white/40 text-white' : 'bg-white/5 border-transparent text-gray-400 hover:bg-white/10'}`}
            >
              3x3
            </button>
            <button 
              onClick={() => setBrushSize({w: 4, h: 4})}
              className={`flex-1 py-1.5 px-2 rounded font-bold text-[10px] border transition-all ${brushSize.w === 4 && brushSize.h === 4 ? 'bg-white/20 border-white/40 text-white' : 'bg-white/5 border-transparent text-gray-400 hover:bg-white/10'}`}
            >
              4x4
            </button>
          </div>
        </div>
      )}

      {/* 3. FIXED LATERAL CANVA HOTBAR MENU (Direita) */}
      <div className="absolute bottom-24 left-1/2 -translate-x-1/2 sm:left-auto sm:transform-none sm:right-4 sm:top-1/2 sm:-translate-y-1/2 z-40 bg-black/95 backdrop-blur-md border border-[#1A1A1A] p-2 sm:p-3 rounded-2xl flex flex-row sm:flex-col gap-2 sm:gap-3.5 shadow-2xl items-center hud-ui animate-in fade-in zoom-in-95">
        <span className="hidden sm:block text-[8px] font-black uppercase text-gray-500 tracking-widest border-b border-white/5 pb-1 w-full text-center">Menu</span>

        {/* 1. SELECT TOOL BUTTON */}
        <button 
          onClick={() => { setActiveTool('select'); }}
          className={`w-11 h-11 rounded-xl flex items-center justify-center transition-all ${
            activeTool === 'select' 
            ? 'bg-blood-red text-white shadow-[0_0_15px_rgba(180,0,0,0.6)] border border-red-500/20' 
            : 'bg-[#121212]/70 text-gray-400 hover:text-white hover:bg-[#1A1A1A]'
          }`}
          title="Selecionar e Mover objetos"
        >
          <MousePointer size={20} />
        </button>

        {/* 1.1 MOVE CAMERA (HAND/PAN) TOOL BUTTON */}
        <button 
          onClick={() => { setActiveTool('pan'); }}
          className={`w-11 h-11 rounded-xl flex items-center justify-center transition-all ${
            activeTool === 'pan' 
            ? 'bg-amber-600 text-white shadow-[0_0_15px_rgba(217,119,6,0.6)] border border-amber-500/20' 
            : 'bg-[#121212]/70 text-gray-400 hover:text-white hover:bg-[#1A1A1A]'
          }`}
          title="Mover Câmera de forma segura (ignora cliques em objetos)"
        >
          <Move size={20} />
        </button>

        {/* Scenery Design Tools (Mestre only) */}
        {isMestreAuth && (
          <>
            <div className="w-px h-6 sm:w-full sm:h-px bg-white/10" />

            {/* 2. SPATIAL FLOORS DESIGNER DRAG & DRAW */}
            <button 
              onClick={() => { setActiveTool('create_floor'); }}
              className={`w-11 h-11 rounded-xl flex items-center justify-center transition-all ${
                activeTool === 'create_floor' 
                ? 'bg-purple-900 border border-purple-500 text-purple-200 shadow-[0_0_15px_rgba(139,92,246,0.4)]' 
                : 'bg-[#121212]/70 text-purple-400/80 hover:text-white hover:bg-[#1A1A1A]'
              }`}
              title="Pintar Chão"
            >
              <PaintBucket size={20} />
            </button>

            {/* 3. SPATIAL WALLS BUILDER DRAG & DRAW */}
            <button 
              onClick={() => { setActiveTool('create_wall'); }}
              className={`w-11 h-11 rounded-xl flex items-center justify-center transition-all ${
                activeTool === 'create_wall' 
                ? 'bg-blue-900 border border-blue-500 text-blue-200 shadow-[0_0_15px_rgba(59,130,246,0.4)]' 
                : 'bg-[#121212]/70 text-blue-400/80 hover:text-white hover:bg-[#1A1A1A]'
              }`}
              title="Pintar Parede e Adicionar Colisão"
            >
              <Pencil size={20} />
            </button>
            
            {/* 4. ERASER */}
            <button 
              onClick={() => { setActiveTool('erase'); }}
              className={`w-11 h-11 rounded-xl flex items-center justify-center transition-all ${
                activeTool === 'erase' 
                ? 'bg-red-900 border border-red-500 text-red-200 shadow-[0_0_15px_rgba(239,68,68,0.4)]' 
                : 'bg-[#121212]/70 text-red-400/80 hover:text-white hover:bg-[#1A1A1A]'
              }`}
              title="Apagar (Borracha)"
            >
              <Eraser size={20} />
            </button>
          </>
        )}

        <div className="w-px h-6 sm:w-full sm:h-px bg-white/10" />

        {/* 4. SPAWN AD-HOC TOKEN OR NPC (Mestre only) */}
        {isMestreAuth && (
          <button 
            onClick={() => setShowAddTokenModal(true)}
            className="w-11 h-11 rounded-xl bg-emerald-950 hover:bg-emerald-900 border border-emerald-500/30 text-emerald-400 hover:text-white flex items-center justify-center transition-all shadow-md"
            title="Adicionar Token ou NPC"
          >
            <Plus size={20} />
          </button>
        )}
      </div>

      {/* 4. OBJECT CONFIGURATIONS PANEL & TRANSFORMATION ACTIONS BAR */}
      {selectedObjectId && selectedObject && (
        <div className="absolute bottom-20 left-4 right-4 sm:left-auto sm:w-80 z-40 bg-black/95 backdrop-blur-md border border-[#1A1A1A] p-4 rounded-xl shadow-2xl hud-ui animate-in slide-in-from-bottom-5">
          <div className="flex justify-between items-center border-b border-white/15 pb-2 mb-3">
            <div>
              <h4 className="font-extrabold text-white text-xs uppercase tracking-wider">{selectedObject.name}</h4>
              <p className="text-[7.5px] text-gray-500 font-mono tracking-widest mt-0.5 uppercase">TIPO: {selectedObject.type}</p>
            </div>
            <button 
              onClick={() => setSelectedObjectId(null)}
              className="text-gray-500 hover:text-white"
            >
              <X size={15} />
            </button>
          </div>

          <div className="space-y-3">
            {/* Quick Actions (Duplicate/Clone, Remove) */}
            <div className="flex gap-2">
              {isMestreAuth && (
                <button 
                  onClick={duplicateSelected}
                  className="flex-1 py-1.5 px-3 bg-[#111] hover:bg-[#1C1C1C] border border-[#222] rounded text-[10px] uppercase font-bold tracking-widest text-gray-300 transition-colors flex items-center justify-center gap-1.5"
                  title="Duplicar Objeto"
                >
                  <Copy size={12} /> Clonar
                </button>
              )}

              <button 
                onClick={deleteSelected}
                className="flex-1 py-1.5 px-3 bg-red-950/80 hover:bg-red-900 border border-red-500/40 rounded text-[10px] uppercase font-bold tracking-widest text-white transition-colors flex items-center justify-center gap-1.5"
                title="Apagar Objeto"
              >
                <Trash2 size={12} /> Remover
              </button>
            </div>

            {/* Customizer options (Change label/name, color themes for ceilings/decorations) */}
            {isMestreAuth && (
              <div className="space-y-2 border-t border-white/5 pt-3">
                <div className="text-[8px] font-black text-gray-500 uppercase tracking-widest">Estilizar Objeto</div>
                
                {/* Visual Label input */}
                <input 
                  type="text"
                  value={selectedObject.name}
                  onChange={(e) => {
                    const nextVal = e.target.value;
                    const updated = sanitizedGridState.objects.map(o => {
                      if (o.id === selectedObject.id) return { ...o, name: nextVal };
                      return o;
                    });
                    setGlobalGridState({ objects: updated });
                  }}
                  onBlur={() => saveAndSyncGrid({ objects: sanitizedGridState.objects })}
                  placeholder="Nome/Rótulo"
                  maxLength={24}
                  className="w-full bg-black/85 border border-[#222] text-white py-1 px-2 rounded font-mono text-[10px] uppercase focus:border-yellow-500 outline-none"
                />

                {/* Color blocks palette selection for walls or pavimentos */}
                <div className="grid grid-cols-4 gap-1.5">
                  {SHAPE_COLORS.map(c => (
                    <button 
                      key={c.id}
                      onClick={() => {
                        const updated = sanitizedGridState.objects.map(o => {
                          if (o.id === selectedObject.id) return { ...o, color: c.id };
                          return o;
                        });
                        saveAndSyncGrid({ objects: updated });
                      }}
                      className={`h-5 rounded border text-[8px] ${c.class} ${selectedObject.color === c.id ? 'border-yellow-500 ring-1 ring-yellow-500' : 'border-[#222]'}`}
                    />
                  ))}
                </div>

                {/* Lock elements constraint toggle */}
                <div className="flex gap-2">
                  <button 
                    onClick={() => {
                      const updated = sanitizedGridState.objects.map(o => {
                        if (o.id === selectedObject.id) return { ...o, isLocked: !o.isLocked };
                        return o;
                      });
                      saveAndSyncGrid({ objects: updated });
                    }}
                    className={`w-full py-1.5 px-3 rounded text-[9px] font-bold uppercase border flex items-center justify-center gap-1 transition-all ${selectedObject.isLocked ? 'bg-amber-950/40 border-amber-500/40 text-amber-500' : 'bg-transparent border-[#222] text-gray-400 hover:text-white hover:border-[#333]'}`}
                  >
                    {selectedObject.isLocked ? <><Lock size={11} /> Pinado (Bloqueado)</> : <><Unlock size={11} /> Livre (Movível)</>}
                  </button>
                </div>

                {/* Touch/Quick Adjustments controls */}
                <div className="space-y-2 border-t border-white/5 pt-2 text-[10px]">
                  <div className="text-[8px] font-black text-gray-500 uppercase tracking-widest leading-none mb-1">Ajuste Fino (Toque)</div>
                  
                  {/* Position adjusts */}
                  <div className="flex items-center justify-between text-xs text-white">
                    <span className="text-[9px] text-gray-400 font-mono">MOVER:</span>
                    <div className="flex gap-1">
                      <button 
                        onClick={() => {
                          const updated = sanitizedGridState.objects.map(o => {
                            if (o.id === selectedObject.id) return { ...o, x: o.x - 64 };
                            return o;
                          });
                          saveAndSyncGrid({ objects: updated });
                        }}
                        className="py-1 px-2 bg-[#121212] hover:bg-neutral-800 border border-[#222] rounded flex items-center justify-center font-bold text-gray-300"
                        title="Mover Esquerda"
                      >
                        <ChevronLeft size={14} />
                      </button>
                      <button 
                        onClick={() => {
                          const updated = sanitizedGridState.objects.map(o => {
                            if (o.id === selectedObject.id) return { ...o, x: o.x + 64 };
                            return o;
                          });
                          saveAndSyncGrid({ objects: updated });
                        }}
                        className="py-1 px-2 bg-[#121212] hover:bg-neutral-800 border border-[#222] rounded flex items-center justify-center font-bold text-gray-300"
                        title="Mover Direita"
                      >
                        <ChevronRight size={14} />
                      </button>
                      <button 
                        onClick={() => {
                          const updated = sanitizedGridState.objects.map(o => {
                            if (o.id === selectedObject.id) return { ...o, y: o.y - 64 };
                            return o;
                          });
                          saveAndSyncGrid({ objects: updated });
                        }}
                        className="py-1 px-2 bg-[#121212] hover:bg-neutral-800 border border-[#222] rounded flex items-center justify-center font-bold text-gray-300"
                        title="Mover Cima"
                      >
                        <ChevronUp size={14} />
                      </button>
                      <button 
                        onClick={() => {
                          const updated = sanitizedGridState.objects.map(o => {
                            if (o.id === selectedObject.id) return { ...o, y: o.y + 64 };
                            return o;
                          });
                          saveAndSyncGrid({ objects: updated });
                        }}
                        className="py-1 px-2 bg-[#121212] hover:bg-neutral-800 border border-[#222] rounded flex items-center justify-center font-bold text-gray-300"
                        title="Mover Baixo"
                      >
                        <ChevronDown size={14} />
                      </button>
                    </div>
                  </div>

                  {/* Sizing Width Adjust */}
                  <div className="flex items-center justify-between text-xs text-white">
                    <span className="text-[9px] text-gray-400 font-mono">LARGURA:</span>
                    <div className="flex gap-1">
                      <button 
                        onClick={() => {
                          const updated = sanitizedGridState.objects.map(o => {
                            if (o.id === selectedObject.id) return { ...o, width: Math.max(16, o.width - 64) };
                            return o;
                          });
                          saveAndSyncGrid({ objects: updated });
                        }}
                        className="py-0.5 px-2 bg-[#121212] hover:bg-neutral-800 border border-[#222] rounded text-[9px] font-bold text-gray-300"
                      >
                        -1C
                      </button>
                      <button 
                        onClick={() => {
                          const updated = sanitizedGridState.objects.map(o => {
                            if (o.id === selectedObject.id) return { ...o, width: o.width + 64 };
                            return o;
                          });
                          saveAndSyncGrid({ objects: updated });
                        }}
                        className="py-0.5 px-2 bg-[#121212] hover:bg-neutral-800 border border-[#222] rounded text-[9px] font-bold text-emerald-400"
                      >
                        +1C
                      </button>
                    </div>
                  </div>

                  {/* Sizing Height Adjust */}
                  <div className="flex items-center justify-between text-xs text-white">
                    <span className="text-[9px] text-gray-400 font-mono">ALTURA:</span>
                    <div className="flex gap-1">
                      <button 
                        onClick={() => {
                          const updated = sanitizedGridState.objects.map(o => {
                            if (o.id === selectedObject.id) return { ...o, height: Math.max(16, o.height - 64) };
                            return o;
                          });
                          saveAndSyncGrid({ objects: updated });
                        }}
                        className="py-0.5 px-2 bg-[#121212] hover:bg-neutral-800 border border-[#222] rounded text-[9px] font-bold text-gray-300"
                      >
                        -1C
                      </button>
                      <button 
                        onClick={() => {
                          const updated = sanitizedGridState.objects.map(o => {
                            if (o.id === selectedObject.id) return { ...o, height: o.height + 64 };
                            return o;
                          });
                          saveAndSyncGrid({ objects: updated });
                        }}
                        className="py-0.5 px-2 bg-[#121212] hover:bg-neutral-800 border border-[#222] rounded text-[9px] font-bold text-emerald-400"
                      >
                        +1C
                      </button>
                    </div>
                  </div>

                  {/* Rotation Adjust */}
                  <div className="flex items-center justify-between text-xs text-white">
                    <span className="text-[9px] text-gray-400 font-mono">ROTAÇÃO:</span>
                    <div className="flex gap-1">
                      <button 
                        onClick={() => {
                          const updated = sanitizedGridState.objects.map(o => {
                            if (o.id === selectedObject.id) return { ...o, rotation: ((o.rotation || 0) - 90) % 360 };
                            return o;
                          });
                          saveAndSyncGrid({ objects: updated });
                        }}
                        className="py-0.5 px-2 bg-[#121212] hover:bg-neutral-800 border border-[#222] rounded text-[9px] font-bold text-gray-300"
                      >
                        -90°
                      </button>
                      <button 
                        onClick={() => {
                          const updated = sanitizedGridState.objects.map(o => {
                            if (o.id === selectedObject.id) return { ...o, rotation: ((o.rotation || 0) + 90) % 360 };
                            return o;
                          });
                          saveAndSyncGrid({ objects: updated });
                        }}
                        className="py-0.5 px-2 bg-[#121212] hover:bg-neutral-800 border border-[#222] rounded text-[9px] font-bold text-amber-400"
                      >
                        +90°
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Coordinates visual indicators */}
            <div className="flex justify-between items-center text-[8.5px] font-mono text-gray-500 pt-2 border-t border-white/5 uppercase">
              <span>POS: {selectedObject.x}, {selectedObject.y}</span>
              <span>DIM: {selectedObject.width}×{selectedObject.height} px</span>
            </div>
          </div>
        </div>
      )}

      {/* FLOATING ZOOM KNOB (Mobile PixelStudio style) */}
      <div 
        className="absolute bottom-24 right-4 sm:right-20 z-40 bg-black/80 backdrop-blur border border-white/20 rounded-full w-12 h-12 flex items-center justify-center shadow-lg touch-none hud-ui cursor-ns-resize"
        onPointerDown={handleZoomKnobStart}
        onPointerMove={handleZoomKnobMove}
        onPointerUp={handleZoomKnobEnd}
        onPointerCancel={handleZoomKnobEnd}
        title="Arraste para cima/baixo para Zoom"
      >
        <Search size={20} className={isZoomDragging ? "text-[#a259ff]" : "text-gray-400"} />
        <div className="absolute -top-6 text-[9px] font-mono text-gray-500 font-bold pointer-events-none select-none">
          {Math.round(zoom * 100)}%
        </div>
      </div>

      {/* POPUP: ADicionar novo TOKEN / NPC */}
      {isMestreAuth && showAddTokenModal && (
        <div className="fixed inset-0 bg-black/95 z-[250] flex items-center justify-center p-4 backdrop-blur-sm hud-ui">
          <div className="bg-[#0a0a0a] border border-[#1A1A1A] max-w-sm w-full rounded-2xl p-6 flex flex-col gap-5 shadow-2xl animate-in fade-in zoom-in-95">
            <div className="flex justify-between items-center border-b border-white/10 pb-3">
              <h3 className="font-extrabold text-blood-red uppercase tracking-widest text-sm flex items-center gap-1.5"><User size={16}/> Inserir Token</h3>
              <button 
                onClick={() => setShowAddTokenModal(false)}
                className="text-gray-500 hover:text-white"
              >
                <X size={18} />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-[10px] text-gray-500 uppercase font-black tracking-widest block mb-1">Nome do Token/Monstro</label>
                <input 
                  type="text" 
                  value={newTokenName}
                  onChange={(e) => setNewTokenName(e.target.value)}
                  placeholder="Ex: Dragão Vermelho, Zumbi, etc"
                  className="w-full bg-[#121212] border border-[#222] p-2.5 rounded text-xs text-white focus:border-blood-red outline-none uppercase font-bold"
                />
              </div>

              <div>
                <label className="text-[10px] text-gray-500 uppercase font-black tracking-widest block mb-1">Dono / Jogador Vinculado</label>
                <select 
                  value={newTokenOwner}
                  onChange={(e) => setNewTokenOwner(e.target.value)}
                  className="w-full bg-[#121212] border border-[#222] p-2.5 rounded text-xs text-white focus:border-blood-red outline-none uppercase font-bold"
                >
                  <option value="">Nenhum (Mestre / NPC)</option>
                  {players.map(p => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-[10px] text-gray-500 uppercase font-black tracking-widest block mb-1">Imagem customizada (Opcional - link ou Base64)</label>
                <div className="flex gap-2">
                  <input 
                    type="text" 
                    value={newTokenImage}
                    onChange={(e) => setNewTokenImage(e.target.value)}
                    placeholder="Cole link de imagem ou anexe abaixo"
                    className="flex-1 bg-[#121212] border border-[#222] p-2 text-[11px] text-white focus:border-blood-red outline-none"
                  />
                  
                  {/* Local image uploader button */}
                  <label className="bg-[#1a1a1a] border border-[#222] hover:border-[#333] hover:text-white px-3 py-2 text-gray-400 rounded cursor-pointer flex items-center justify-center transition-colors">
                    <Upload size={14} />
                    <input 
                      type="file" 
                      accept="image/*" 
                      className="hidden" 
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          const reader = new FileReader();
                          reader.onloadend = () => {
                            setNewTokenImage(reader.result as string);
                          };
                          reader.readAsDataURL(file);
                        }
                      }}
                    />
                  </label>
                </div>
              </div>

              <div>
                <label className="text-[10px] text-gray-500 uppercase font-black tracking-widest block mb-1">Cor do Token (Caso não use imagem)</label>
                <div className="flex gap-1.5 flex-wrap">
                  {['#e63946', '#3a86c8', '#2a9d8f', '#e9c46a', '#f4a261', '#9b5de5', '#ffffff', '#000000'].map(c => (
                    <button 
                      key={c}
                      onClick={() => setNewTokenColor(c)}
                      className="w-6 h-6 rounded-full border border-[#222] relative"
                      style={{ backgroundColor: c }}
                    >
                      {newTokenColor === c && <Check size={10} className="text-white absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 drop-shadow-[0_1px_2px_#000]" />}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <button 
              onClick={handleAddTokenSubmit}
              className="w-full py-3 bg-blood-red hover:bg-red-700 text-white font-black rounded-lg uppercase tracking-wider text-xs transition-colors mt-2"
            >
              Criar Token na Grid
            </button>
          </div>
        </div>
      )}

      {/* POPUP: GERENCIADOR DE MAPAS / CENÁRIOS SALVOS EM SLOTS */}
      {isMestreAuth && showScenarioModal && (
        <div className="fixed inset-0 bg-black/95 z-[250] flex items-center justify-center p-4 backdrop-blur-sm hud-ui">
          <div className="bg-[#0a0a0a] border border-[#1A1A1A] max-w-md w-full rounded-2xl p-6 sm:p-8 flex flex-col gap-5 shadow-2xl animate-in fade-in zoom-in-95">
            <div className="flex justify-between items-center border-b border-white/10 pb-3">
              <div>
                <h3 className="font-extrabold text-[#a259ff] uppercase tracking-widest text-sm flex items-center gap-1.5"><Grid size={16}/> Slots de Cenários</h3>
                <p className="text-[9px] text-gray-500 uppercase tracking-widest mt-0.5">Salve esboços e cômodos de mestre</p>
              </div>
              <button 
                onClick={() => { setShowScenarioModal(false); setEditingSlotId(null); }}
                className="text-gray-500 hover:text-white"
              >
                <X size={18} />
              </button>
            </div>

            <div className="space-y-3.5 max-h-[50vh] overflow-y-auto pr-1 no-scrollbar">
              {scenarioSlots.map((slot) => {
                const isEditingThisSlot = editingSlotId === slot.id;

                return (
                  <div 
                    key={slot.id}
                    className="bg-[#121212]/85 border border-[#222] p-4 rounded-xl flex items-center justify-between gap-4 transition-all hover:bg-[#161616]"
                  >
                    <div className="flex-1 overflow-hidden">
                      {isEditingThisSlot ? (
                        <div className="flex gap-2">
                          <input 
                            type="text"
                            value={editingSlotName}
                            onChange={(e) => setEditingSlotName(e.target.value)}
                            placeholder="Nome do Esboço"
                            maxLength={32}
                            autoFocus
                            className="bg-black border border-purple-500 p-2 text-xs rounded text-white outline-none flex-1 font-semibold uppercase tracking-wider focus:border-purple-400"
                          />
                          <button 
                            onClick={() => handleSaveScenario(slot.id)}
                            className="p-2 bg-purple-900 border border-purple-500 text-purple-200 rounded hover:bg-purple-800 transition-colors"
                          >
                            <Check size={14} />
                          </button>
                          <button 
                            onClick={() => setEditingSlotId(null)}
                            className="p-2 bg-transparent border border-gray-600 text-gray-400 rounded hover:text-white"
                          >
                            <X size={14} />
                          </button>
                        </div>
                      ) : (
                        <div>
                          <div className="font-extrabold text-white uppercase text-xs tracking-wider truncate">
                            {slot.name}
                          </div>
                          <div className="text-[8.5px] text-gray-500 font-mono mt-1 uppercase leading-none">
                            {slot.timestamp ? `MODIFICADO: ${slot.timestamp}` : 'Esboço livre'}
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      {/* Save action button */}
                      <button 
                        onClick={() => {
                          setEditingSlotId(slot.id);
                          setEditingSlotName(slot.name);
                        }}
                        className="py-1 px-2.5 bg-purple-950/60 hover:bg-purple-900 border border-purple-500/30 rounded-lg text-[9px] uppercase font-bold tracking-widest text-purple-400"
                      >
                        Salvar
                      </button>

                      {/* Load saved template button */}
                      {slot.timestamp && (
                        <button 
                          onClick={() => handleLoadScenario(slot.id)}
                          className="py-1 px-2.5 bg-blue-950/60 hover:bg-blue-900 border border-blue-500/30 rounded-lg text-[9px] uppercase font-bold tracking-widest text-blue-400"
                        >
                          Carregar
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="border-t border-white/10 pt-4 flex gap-3">
              <button 
                onClick={clearSceneryOnly}
                className="flex-1 py-3 px-4 bg-red-950 hover:bg-red-900 text-red-300 font-bold rounded-lg border border-red-500/30 uppercase tracking-wider text-xs transition-colors"
              >
                Limpar Cenário
              </button>
              <button 
                onClick={() => setShowScenarioModal(false)}
                className="flex-1 py-3 px-4 bg-transparent hover:bg-[#121212] text-gray-400 font-bold rounded-lg border border-[#222] uppercase tracking-wider text-xs transition-colors"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
