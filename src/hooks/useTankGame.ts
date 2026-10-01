import { useCallback, useEffect, useRef, useState } from 'react';
import { GameEngine } from '@/game/engine';
import type { Hud, InputState } from '@/game/engine';
import type { Dir } from '@/game/constants';
import { WORLD } from '@/game/constants';
import { render } from '@/game/render';
import { sfx } from '@/game/audio';

const KEY_DIRS: Record<string, Dir> = {
  ArrowUp: 0, KeyW: 0,
  ArrowRight: 1, KeyD: 1,
  ArrowDown: 2, KeyS: 2,
  ArrowLeft: 3, KeyA: 3,
};

interface InstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export function useTankGame() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const engineRef = useRef<GameEngine | null>(null);
  const inputRef = useRef<InputState>({ dir: null, fire: false });
  const dirsRef = useRef<Dir[]>([]);
  const deferredRef = useRef<InstallPromptEvent | null>(null);

  const [hud, setHud] = useState<Hud>(() => new GameEngine().hud());
  const [muted, setMuted] = useState(sfx.muted);
  const [canInstall, setCanInstall] = useState(false);
  const [isTouch] = useState(
    () =>
      typeof window !== 'undefined' &&
      (window.matchMedia?.('(pointer: coarse)').matches ||
        'ontouchstart' in window ||
        new URLSearchParams(window.location.search).has('touch')),
  );

  const setTouchDir = useCallback((d: Dir | null) => {
    if (d === null) dirsRef.current = [];
    else if (!dirsRef.current.includes(d)) dirsRef.current.push(d);
    inputRef.current.dir = dirsRef.current.length
      ? dirsRef.current[dirsRef.current.length - 1]
      : null;
  }, []);

  const setTouchFire = useCallback((f: boolean) => {
    inputRef.current.fire = f;
  }, []);

  const startGame = useCallback(() => {
    sfx.ensure();
    engineRef.current?.startGame();
    inputRef.current = { dir: null, fire: false };
    dirsRef.current = [];
  }, []);

  const nextLoop = useCallback(() => {
    sfx.ensure();
    engineRef.current?.nextLoop();
  }, []);

  const toMenu = useCallback(() => {
    engineRef.current?.toMenu();
  }, []);

  const togglePause = useCallback(() => {
    engineRef.current?.togglePause();
  }, []);

  const toggleMute = useCallback(() => {
    const m = !sfx.muted;
    sfx.setMuted(m);
    setMuted(m);
  }, []);

  const installPwa = useCallback(async () => {
    const ev = deferredRef.current;
    if (!ev) return false;
    deferredRef.current = null;
    setCanInstall(false);
    await ev.prompt();
    return true;
  }, []);

  useEffect(() => {
    const engine = new GameEngine();
    engineRef.current = engine;
    // 调试/演示：?autostart 直接进入游戏
    if (new URLSearchParams(window.location.search).has('autostart')) {
      engine.startGame();
    }
    setHud(engine.hud());

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const fit = () => {
      const cssW = canvas.clientWidth || WORLD;
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      const px = Math.round(cssW * dpr);
      if (canvas.width !== px || canvas.height !== px) {
        canvas.width = px;
        canvas.height = px;
      }
    };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(canvas);

    // 键盘
    const held = dirsRef.current;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.repeat) {
        if (e.code === 'Space') e.preventDefault();
        return;
      }
      const d = KEY_DIRS[e.code];
      if (d !== undefined) {
        e.preventDefault();
        if (!held.includes(d)) held.push(d);
        inputRef.current.dir = held[held.length - 1];
        return;
      }
      if (e.code === 'Space' || e.code === 'KeyJ') {
        e.preventDefault();
        inputRef.current.fire = true;
        return;
      }
      if (e.code === 'KeyP' || e.code === 'Escape') {
        engine.togglePause();
        return;
      }
      if (e.code === 'KeyM') {
        toggleMute();
        return;
      }
      if (e.code === 'Enter') {
        if (engine.phase === 'menu') startGame();
        else if (engine.phase === 'gameover') startGame();
        else if (engine.phase === 'victory') nextLoop();
      }
    };
    const onKeyUp = (e: KeyboardEvent) => {
      const d = KEY_DIRS[e.code];
      if (d !== undefined) {
        const i = held.indexOf(d);
        if (i >= 0) held.splice(i, 1);
        inputRef.current.dir = held.length ? held[held.length - 1] : null;
        return;
      }
      if (e.code === 'Space' || e.code === 'KeyJ') inputRef.current.fire = false;
    };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);

    // 切后台自动暂停
    const onVis = () => {
      if (document.hidden && engine.phase === 'playing') engine.togglePause();
    };
    document.addEventListener('visibilitychange', onVis);

    // PWA 安装提示
    const onBIP = (e: Event) => {
      e.preventDefault();
      deferredRef.current = e as InstallPromptEvent;
      setCanInstall(true);
    };
    window.addEventListener('beforeinstallprompt', onBIP);

    // 主循环：固定步长逻辑 + 每帧渲染
    let raf = 0;
    let last = performance.now();
    let acc = 0;
    let hudT = 0;
    let lastPhase = engine.phase;
    const STEP = 1000 / 60;
    const loop = (now: number) => {
      raf = requestAnimationFrame(loop);
      let dt = now - last;
      last = now;
      if (dt > 250) dt = 250;
      acc += dt;
      let steps = 0;
      while (acc >= STEP && steps < 4) {
        engine.update(STEP, inputRef.current);
        acc -= STEP;
        steps += 1;
      }
      if (steps === 4) acc = 0;

      const scale = canvas.width / WORLD;
      ctx.setTransform(scale, 0, 0, scale, 0, 0);
      render(ctx, engine, engine.timeMs);

      hudT += dt;
      if (hudT >= 120 || engine.phase !== lastPhase) {
        hudT = 0;
        lastPhase = engine.phase;
        setHud(engine.hud());
      }
    };
    raf = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      document.removeEventListener('visibilitychange', onVis);
      window.removeEventListener('beforeinstallprompt', onBIP);
      engineRef.current = null;
    };
  }, [startGame, nextLoop, toggleMute]);

  return {
    canvasRef,
    hud,
    muted,
    canInstall,
    isTouch,
    setTouchDir,
    setTouchFire,
    startGame,
    nextLoop,
    toMenu,
    togglePause,
    toggleMute,
    installPwa,
  };
}
