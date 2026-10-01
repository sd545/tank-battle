import { useState } from 'react';
import type { ReactNode } from 'react';
import { useTankGame } from '@/hooks/useTankGame';
import { TouchControls } from '@/components/TouchControls';

function Btn({
  children, onClick, variant = 'outline', className = '',
}: {
  children: ReactNode;
  onClick: () => void;
  variant?: 'primary' | 'danger' | 'outline' | 'green';
  className?: string;
}) {
  const styles = {
    primary: 'bg-amber-400 text-black hover:bg-amber-300 shadow-[0_0_20px_rgba(245,201,60,0.35)]',
    danger: 'bg-red-500/90 text-white hover:bg-red-400',
    green: 'bg-emerald-500/90 text-white hover:bg-emerald-400',
    outline: 'bg-white/10 text-white hover:bg-white/20 border border-white/20',
  } as const;
  return (
    <button
      type="button"
      onClick={onClick}
      className={`min-h-11 rounded-xl px-5 py-2.5 text-base font-bold tracking-wider transition-colors ${styles[variant]} ${className}`}
    >
      {children}
    </button>
  );
}

function Panel({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <div className={`absolute inset-0 z-20 flex flex-col items-center justify-center gap-4 bg-[#0b0e14]/95 px-6 text-center ${className}`}>
      {children}
    </div>
  );
}

function Title({ children }: { children: ReactNode }) {
  return (
    <h1 className="text-4xl font-black tracking-[0.2em] text-amber-400 [text-shadow:0_3px_0_#7a5c00,0_0_30px_rgba(245,201,60,0.4)]">
      {children}
    </h1>
  );
}

export default function App() {
  const g = useTankGame();
  const [showHelp, setShowHelp] = useState(false);
  const [showInstall, setShowInstall] = useState(false);
  const { hud } = g;

  const pauseBtn = (hud.phase === 'playing' || hud.phase === 'paused') && (
    <button
      type="button"
      aria-label="暂停"
      onClick={g.togglePause}
      className="flex h-11 w-11 items-center justify-center rounded-lg bg-white/10 text-white/80 hover:bg-white/20"
    >
      {hud.phase === 'paused' ? (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M6 4 L20 12 L6 20 Z" /></svg>
      ) : (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M6 4 H10 V20 H6 Z M14 4 H18 V20 H14 Z" /></svg>
      )}
    </button>
  );

  return (
    <div className="flex min-h-dvh w-full flex-col items-center bg-[#0b0e14] text-white [padding-top:env(safe-area-inset-top)]">
      {/* 顶栏 */}
      <header className="flex w-full max-w-[540px] items-center justify-between gap-1.5 px-2 py-2 whitespace-nowrap">
        <div className="flex items-baseline gap-2">
          <span className="text-sm font-black tracking-widest text-amber-400">坦克大战</span>
          <span className="hidden min-[420px]:inline text-[11px] text-white/50">第 {hud.level} 关</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="rounded bg-white/10 px-1.5 py-1 text-[11px] text-white/70">
            分 <b className="text-amber-300">{hud.score}</b>
          </span>
          <span className="rounded bg-white/10 px-1.5 py-1 text-[11px] text-white/70">
            <b className="text-red-400">♥</b> {hud.lives}
          </span>
          <span className="rounded bg-white/10 px-1.5 py-1 text-[11px] text-white/70" title="剩余敌军">
            敌 <b className="text-white">{hud.remaining}</b>
          </span>
          {pauseBtn}
          <button
            type="button"
            aria-label="静音"
            onClick={g.toggleMute}
            className="flex h-11 w-11 items-center justify-center rounded-lg bg-white/10 text-white/80 hover:bg-white/20"
          >
            {g.muted ? '🔇' : '🔊'}
          </button>
        </div>
      </header>

      {/* 游戏画布区 */}
      <div className={`game-layout flex w-full flex-col items-center ${g.isTouch ? 'touch-layout' : ''}`}>
      <main className="game-canvas-col relative w-full max-w-[540px] px-2">
        <div className="relative overflow-hidden rounded-xl border border-white/10 shadow-[0_0_50px_rgba(0,0,0,0.6)]">
          <canvas
            ref={g.canvasRef}
            className="block aspect-square w-full"
            style={{ touchAction: 'none' }}
          />
          {/* 扫描线效果 */}
          <div className="pointer-events-none absolute inset-0 bg-[repeating-linear-gradient(0deg,rgba(255,255,255,0.025)_0_1px,transparent_1px_3px)]" />

          {/* 关卡开场横幅 */}
          {hud.phase === 'playing' && hud.levelT > 0 && (
            <div className="pointer-events-none absolute inset-0 z-10 flex flex-col items-center justify-center bg-black/40">
              <div className="text-2xl font-black tracking-[0.3em] text-amber-400">
                第 {hud.level} 关
              </div>
              <div className="mt-2 text-sm tracking-[0.5em] text-white/80">{hud.levelName}</div>
            </div>
          )}

          {/* 过关横幅 */}
          {hud.phase === 'levelclear' && (
            <div className="pointer-events-none absolute inset-0 z-10 flex flex-col items-center justify-center bg-black/40">
              <div className="text-3xl font-black tracking-[0.3em] text-emerald-400 [text-shadow:0_0_24px_rgba(52,211,153,0.6)]">
                过关！
              </div>
              <div className="mt-2 text-sm text-white/70">即将进入下一关…</div>
            </div>
          )}

          {/* 主菜单 */}
          {hud.phase === 'menu' && (
            <Panel>
              <Title>坦克大战</Title>
              <p className="text-xs tracking-[0.4em] text-white/40">BATTLE CITY · 复古像素</p>
              <p className="text-sm text-white/60">
                最高分 <span className="font-bold text-amber-300">{hud.hi}</span>
              </p>
              <div className="flex w-full max-w-[280px] flex-col gap-2.5">
                <Btn variant="primary" onClick={g.startGame}>▶ 开始游戏</Btn>
                {g.canInstall && (
                  <Btn variant="green" onClick={() => { void g.installPwa(); }}>📲 安装到手机</Btn>
                )}
                <Btn onClick={() => setShowInstall(true)}>📲 如何安装到桌面</Btn>
                <Btn onClick={() => setShowHelp(true)}>❓ 操作说明</Btn>
              </div>
              <p className="text-[11px] leading-relaxed text-white/35">
                消灭所有敌军即可过关 · 保护好金色基地
              </p>
            </Panel>
          )}

          {/* 暂停 */}
          {hud.phase === 'paused' && (
            <Panel>
              <h2 className="text-2xl font-black tracking-[0.3em] text-white/90">已暂停</h2>
              <div className="flex w-full max-w-[280px] flex-col gap-2.5">
                <Btn variant="primary" onClick={g.togglePause}>▶ 继续</Btn>
                <Btn onClick={g.startGame}>↻ 重新开始</Btn>
                <Btn onClick={g.toMenu}>🏠 返回主页</Btn>
              </div>
            </Panel>
          )}

          {/* 游戏结束 */}
          {hud.phase === 'gameover' && (
            <Panel>
              <h2 className="text-3xl font-black tracking-[0.25em] text-red-500 [text-shadow:0_0_26px_rgba(239,68,68,0.5)]">
                游戏结束
              </h2>
              <p className="text-sm text-white/60">
                得分 <b className="text-amber-300">{hud.score}</b>
                {' · '}最高 <b className="text-amber-300">{hud.hi}</b>
              </p>
              {!hud.baseAlive && (
                <p className="text-xs text-red-400/80">基地被摧毁了…</p>
              )}
              <div className="flex w-full max-w-[280px] flex-col gap-2.5">
                <Btn variant="primary" onClick={g.startGame}>↻ 重新开始</Btn>
                <Btn onClick={g.toMenu}>🏠 返回主页</Btn>
              </div>
            </Panel>
          )}

          {/* 通关 */}
          {hud.phase === 'victory' && (
            <Panel>
              <h2 className="text-3xl font-black tracking-[0.25em] text-emerald-400 [text-shadow:0_0_26px_rgba(52,211,153,0.5)]">
                通关胜利！
              </h2>
              <p className="text-sm text-white/60">
                全部 {hud.levelCount} 关通过 · 得分 <b className="text-amber-300">{hud.score}</b>
              </p>
              <div className="flex w-full max-w-[280px] flex-col gap-2.5">
                <Btn variant="primary" onClick={g.nextLoop}>▶ 再战一轮（敌军强化）</Btn>
                <Btn onClick={g.toMenu}>🏠 返回主页</Btn>
              </div>
            </Panel>
          )}
        </div>
      </main>

      {/* 触屏控制 / 桌面提示 */}
      {g.isTouch ? (
        <TouchControls onDir={g.setTouchDir} onFire={g.setTouchFire} />
      ) : (
        <footer className="w-full max-w-[540px] px-4 pt-3 pb-4 text-center text-xs leading-relaxed text-white/35">
          移动：WASD / 方向键　开火：J / 空格　暂停：P　静音：M
          <br />
          手机访问时可像 App 一样安装到桌面，离线也能玩
        </footer>
      )}
      </div>

      {/* 安装说明 */}
      {showInstall && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onClick={() => setShowInstall(false)}>
          <div
            className="w-full max-w-sm rounded-2xl border border-white/15 bg-[#141824] p-5 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="mb-3 text-lg font-bold tracking-widest text-amber-400">安装到手机桌面</h3>
            <ol className="list-decimal space-y-2 pl-5 text-sm leading-relaxed text-white/80">
              <li>在手机上用 <b>Chrome</b> 打开本游戏的链接（发布后发给朋友即可）。</li>
              <li>点浏览器右上角 <b>⋮ 菜单</b> → 选择「<b>安装应用</b>」或「<b>添加到主屏幕</b>」。</li>
              <li>桌面出现「坦克大战」图标，点开即<b className="text-emerald-400">全屏离线游玩</b>。</li>
            </ol>
            <p className="mt-3 text-xs leading-relaxed text-white/40">
              iPhone：用 Safari 打开 → 分享按钮 →「添加到主屏幕」。
              主菜单的「安装到手机」按钮在 Chrome 下可一键弹出安装提示。
            </p>
            <Btn variant="primary" className="mt-4 w-full" onClick={() => setShowInstall(false)}>
              知道了
            </Btn>
          </div>
        </div>
      )}

      {/* 操作说明 */}
      {showHelp && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onClick={() => setShowHelp(false)}>
          <div
            className="w-full max-w-sm rounded-2xl border border-white/15 bg-[#141824] p-5 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="mb-3 text-lg font-bold tracking-widest text-amber-400">操作说明</h3>
            <div className="space-y-2 text-sm leading-relaxed text-white/80">
              <p>🕹 <b>手机</b>：左下方向键移动，右下红色按钮开火（可按住连发）。</p>
              <p>⌨️ <b>电脑</b>：WASD / 方向键移动，J / 空格开火，P 暂停，M 静音。</p>
              <p>🎯 <b>目标</b>：消灭全部敌军过关；老家（金色雄鹰）被毁或生命耗尽即失败。</p>
              <p>⭐ <b>道具</b>：击杀闪烁的敌军会掉落道具——火力升级、防护罩、全屏炸弹、冻结、1UP、基地钢墙。</p>
              <p>🧱 砖墙可击破，钢墙只有满级火力可击破，河流不可通行，草丛可隐蔽。</p>
            </div>
            <Btn variant="primary" className="mt-4 w-full" onClick={() => setShowHelp(false)}>
              开玩！
            </Btn>
          </div>
        </div>
      )}
    </div>
  );
}
