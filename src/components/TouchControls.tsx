import { useRef } from 'react';
import type { Dir } from '@/game/constants';

interface Props {
  onDir: (d: Dir | null) => void;
  onFire: (f: boolean) => void;
}

function Arrow({ rotate }: { rotate: number }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" style={{ transform: `rotate(${rotate}deg)` }}>
      <path d="M12 4 L20 18 L4 18 Z" fill="currentColor" />
    </svg>
  );
}

function PadButton({ dir, rotate, onDir }: { dir: Dir; rotate: number; onDir: Props['onDir'] }) {
  const ref = useRef<HTMLButtonElement>(null);
  const press = (e: React.PointerEvent) => {
    e.preventDefault();
    ref.current?.setPointerCapture(e.pointerId);
    onDir(dir);
  };
  const release = (e: React.PointerEvent) => {
    e.preventDefault();
    if (ref.current?.hasPointerCapture(e.pointerId)) ref.current.releasePointerCapture(e.pointerId);
    onDir(null);
  };
  return (
    <button
      ref={ref}
      type="button"
      aria-label={`方向${dir}`}
      className="flex h-14 w-14 items-center justify-center rounded-xl bg-white/10 text-white/90 shadow-[inset_0_2px_0_rgba(255,255,255,0.08)] transition-colors touch-none select-none active:bg-amber-400/70 active:text-black"
      style={{ touchAction: 'none' }}
      onPointerDown={press}
      onPointerUp={release}
      onPointerCancel={release}
      onLostPointerCapture={release}
      onContextMenu={(e) => e.preventDefault()}
    >
      <Arrow rotate={rotate} />
    </button>
  );
}

export function TouchControls({ onDir, onFire }: Props) {
  const fireRef = useRef<HTMLButtonElement>(null);
  const fireDown = (e: React.PointerEvent) => {
    e.preventDefault();
    fireRef.current?.setPointerCapture(e.pointerId);
    onFire(true);
  };
  const fireUp = (e: React.PointerEvent) => {
    e.preventDefault();
    if (fireRef.current?.hasPointerCapture(e.pointerId)) fireRef.current.releasePointerCapture(e.pointerId);
    onFire(false);
  };

  return (
    <div className="game-controls flex w-full max-w-[520px] items-end justify-between gap-4 px-2 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
      {/* 方向键 */}
      <div
        className="grid grid-cols-3 grid-rows-3 gap-1.5"
        onContextMenu={(e) => e.preventDefault()}
      >
        <div />
        <PadButton dir={0} rotate={0} onDir={onDir} />
        <div />
        <PadButton dir={3} rotate={-90} onDir={onDir} />
        <div />
        <PadButton dir={1} rotate={90} onDir={onDir} />
        <div />
        <PadButton dir={2} rotate={180} onDir={onDir} />
        <div />
      </div>

      <div className="flex flex-col items-center gap-2">
        <span className="text-[10px] tracking-widest text-white/40">按住连发</span>
        <button
          ref={fireRef}
          type="button"
          aria-label="开火"
          className="flex h-20 w-20 flex-col items-center justify-center rounded-full bg-red-500/80 text-white shadow-[0_0_24px_rgba(239,68,68,0.35)] touch-none select-none active:bg-red-400 active:scale-95"
          style={{ touchAction: 'none' }}
          onPointerDown={fireDown}
          onPointerUp={fireUp}
          onPointerCancel={fireUp}
          onLostPointerCapture={fireUp}
          onContextMenu={(e) => e.preventDefault()}
        >
          <svg width="26" height="26" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 2 L14.5 9.5 L22 12 L14.5 14.5 L12 22 L9.5 14.5 L2 12 L9.5 9.5 Z" />
          </svg>
          <span className="mt-0.5 text-xs font-bold tracking-widest">开火</span>
        </button>
      </div>
    </div>
  );
}
