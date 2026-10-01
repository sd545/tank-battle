import {
  BASE_X, BASE_Y, BASE_SIZE, CELLS, ENEMY_KINDS, HALF, SUB, TANK, TERRAIN, WORLD,
} from './constants';
import type { Bullet, Powerup, Tank } from './engine';
import type { GameEngine } from './engine';

// ---------- 20px 地形瓦片预渲染 ----------
function makeTile(draw: (g: CanvasRenderingContext2D) => void): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = SUB;
  c.height = SUB;
  const g = c.getContext('2d')!;
  draw(g);
  return c;
}

const brickTile = makeTile((g) => {
  g.fillStyle = '#7a3b20';
  g.fillRect(0, 0, SUB, SUB);
  g.fillStyle = '#b0562e';
  g.fillRect(1, 1, 8, 8);
  g.fillRect(11, 1, 8, 8);
  g.fillRect(-4, 11, 8, 8);
  g.fillRect(6, 11, 8, 8);
  g.fillRect(16, 11, 8, 8);
  g.fillStyle = 'rgba(255,255,255,0.12)';
  g.fillRect(1, 1, 8, 2);
  g.fillRect(11, 1, 8, 2);
  g.fillRect(6, 11, 8, 2);
});

const steelTile = makeTile((g) => {
  g.fillStyle = '#5d666f';
  g.fillRect(0, 0, SUB, SUB);
  g.fillStyle = '#aab3bc';
  g.fillRect(2, 2, 16, 16);
  g.fillStyle = '#c7ced4';
  g.fillRect(3, 3, 14, 3);
  g.fillStyle = '#7d868e';
  g.fillRect(3, 15, 14, 2);
  g.fillStyle = '#3d434a';
  for (const [x, y] of [[4, 8], [16, 8], [4, 16 - 4], [16, 12]]) {
    g.fillRect(x, y, 2, 2);
  }
});

const waterTileA = makeTile((g) => {
  g.fillStyle = '#0d2b52';
  g.fillRect(0, 0, SUB, SUB);
  g.fillStyle = '#1e63b5';
  g.fillRect(0, 4, 12, 3);
  g.fillRect(8, 12, 12, 3);
  g.fillStyle = '#3f8fe0';
  g.fillRect(2, 5, 6, 1);
  g.fillRect(10, 13, 6, 1);
});

const waterTileB = makeTile((g) => {
  g.fillStyle = '#0d2b52';
  g.fillRect(0, 0, SUB, SUB);
  g.fillStyle = '#1e63b5';
  g.fillRect(6, 2, 12, 3);
  g.fillRect(-2, 10, 12, 3);
  g.fillRect(12, 16, 10, 3);
  g.fillStyle = '#3f8fe0';
  g.fillRect(8, 3, 6, 1);
});

const bushTile = makeTile((g) => {
  g.fillStyle = '#123c14';
  g.beginPath();
  g.arc(6, 7, 6, 0, Math.PI * 2);
  g.arc(14, 6, 6, 0, Math.PI * 2);
  g.arc(10, 13, 7, 0, Math.PI * 2);
  g.arc(17, 13, 5, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = '#1f5c22';
  g.beginPath();
  g.arc(7, 6, 3, 0, Math.PI * 2);
  g.arc(14, 13, 3, 0, Math.PI * 2);
  g.fill();
});

// ---------- 基地（鹰）----------
const EAGLE = [
  '....XX....XX....',
  '...XXXX..XXXX...',
  '..XXXXXXXXXXXX..',
  '.XXXXXXXXXXXXXX.',
  '.XX.XXXXXXXX.XX.',
  '..XXXXXXXXXXXX..',
  '....XXXXXXXX....',
  '......XXXX......',
  '......XXXX......',
  '.....XX..XX.....',
  '.....X....X.....',
  '....X......X....',
  '...X........X...',
  '..X..........X..',
  '................',
  '................',
];

function makeBase(alive: boolean): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = BASE_SIZE;
  c.height = BASE_SIZE;
  const g = c.getContext('2d')!;
  g.fillStyle = '#141821';
  g.fillRect(0, 0, BASE_SIZE, BASE_SIZE);
  g.strokeStyle = alive ? '#3a4150' : '#2a2d34';
  g.lineWidth = 2;
  g.strokeRect(1, 1, BASE_SIZE - 2, BASE_SIZE - 2);
  const px = BASE_SIZE / 16;
  for (let r = 0; r < 16; r++) {
    for (let col = 0; col < 16; col++) {
      if (EAGLE[r][col] !== 'X') continue;
      g.fillStyle = alive ? '#f0c93e' : '#4a4d55';
      g.fillRect(col * px, r * px, px, px);
      if (alive) {
        g.fillStyle = 'rgba(255,255,255,0.25)';
        g.fillRect(col * px, r * px, px, px / 2);
      }
    }
  }
  if (!alive) {
    g.fillStyle = '#33363d';
    g.fillRect(4, 28, 10, 6);
    g.fillRect(24, 30, 8, 5);
  }
  return c;
}

let baseAliveTile: HTMLCanvasElement | null = null;
let baseDeadTile: HTMLCanvasElement | null = null;

function baseTiles() {
  if (!baseAliveTile) {
    baseAliveTile = makeBase(true);
    baseDeadTile = makeBase(false);
  }
  return { alive: baseAliveTile, dead: baseDeadTile! };
}

// ---------- 坦克 ----------
const PLAYER_COLORS = {
  body: '#f5c93c', dark: '#a8822a', turret: '#ffd95e', track: '#3b3b30',
};
const ARMOR_BY_HP = ['#e8e8e8', '#d14b3c', '#e0a33e', '#7ec850'];

function drawTank(g: CanvasRenderingContext2D, t: Tank, timeMs: number) {
  const flash = t.flash > 0 && Math.floor(timeMs / 60) % 2 === 0;
  let body: string;
  let dark: string;
  let turret: string;
  if (t.isPlayer) {
    body = PLAYER_COLORS.body;
    dark = PLAYER_COLORS.dark;
    turret = PLAYER_COLORS.turret;
  } else if (t.kind === 3) {
    body = ARMOR_BY_HP[Math.max(0, t.hp - 1)];
    dark = '#5a5f66';
    turret = body;
  } else {
    body = ENEMY_KINDS[t.kind].color;
    dark = '#4c525a';
    turret = body;
  }
  if (flash) {
    body = '#ffffff';
    turret = '#ffffff';
    dark = '#dddddd';
  }

  g.save();
  g.translate(t.cx, t.cy);
  g.rotate((t.dir * Math.PI) / 2);

  const h = HALF; // 18
  // 履带
  g.fillStyle = PLAYER_COLORS.track;
  g.fillRect(-h, -h, 6, TANK);
  g.fillRect(h - 6, -h, 6, TANK);
  // 履带纹路（运动时滚动）
  g.fillStyle = '#6b6b58';
  const off = t.moving ? Math.floor(t.tread) % 2 : 0;
  for (let i = 0; i < 5; i++) {
    const y = -h + ((i * 8 + off * 4) % TANK);
    g.fillRect(-h, y, 6, 3);
    g.fillRect(h - 6, y, 6, 3);
  }
  // 车体
  g.fillStyle = dark;
  g.fillRect(-h + 6, -h + 3, TANK - 12, TANK - 6);
  g.fillStyle = body;
  g.fillRect(-h + 7, -h + 5, TANK - 14, TANK - 10);
  // 炮塔
  g.fillStyle = turret;
  g.beginPath();
  g.arc(0, 0, 7, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = dark;
  g.beginPath();
  g.arc(0, 0, 3, 0, Math.PI * 2);
  g.fill();
  // 炮管
  g.fillStyle = turret;
  g.fillRect(-2, -h - 1, 4, h - 4);

  g.restore();

  // 防护罩
  if (t.shield > 0 && Math.floor(timeMs / 120) % 2 === 0) {
    g.strokeStyle = '#7ecbff';
    g.lineWidth = 2;
    g.beginPath();
    g.arc(t.cx, t.cy, 24, 0, Math.PI * 2);
    g.stroke();
    g.strokeStyle = 'rgba(126,203,255,0.4)';
    g.beginPath();
    g.arc(t.cx, t.cy, 27, 0, Math.PI * 2);
    g.stroke();
  }
  // 冻结
  if (t.frozen) {
    g.fillStyle = 'rgba(140,200,255,0.35)';
    g.fillRect(t.cx - HALF, t.cy - HALF, TANK, TANK);
  }
}

// 出生动画（旋转的星形光圈）
function drawSpawn(g: CanvasRenderingContext2D, cx: number, cy: number, timeMs: number) {
  g.save();
  g.translate(cx, cy);
  g.rotate(timeMs / 120);
  g.strokeStyle = '#ffd23f';
  g.lineWidth = 3;
  const r = 16;
  g.beginPath();
  for (let i = 0; i < 4; i++) {
    const a = (i * Math.PI) / 2;
    g.moveTo(Math.cos(a) * r, Math.sin(a) * r);
    g.lineTo(-Math.cos(a) * r, -Math.sin(a) * r);
  }
  g.stroke();
  g.rotate(-timeMs / 60);
  g.strokeStyle = 'rgba(255,210,63,0.5)';
  g.lineWidth = 2;
  g.beginPath();
  for (let i = 0; i < 4; i++) {
    const a = (i * Math.PI) / 4 + Math.PI / 8;
    g.moveTo(Math.cos(a) * (r - 5), Math.sin(a) * (r - 5));
    g.lineTo(-Math.cos(a) * (r - 5), -Math.sin(a) * (r - 5));
  }
  g.stroke();
  g.restore();
}

// ---------- 道具 ----------
function drawPowerup(g: CanvasRenderingContext2D, p: Powerup, timeMs: number) {
  if (p.ttl < 4000 && Math.floor(timeMs / 250) % 2 === 0) return; // 即将消失时闪烁
  const x = p.cx * 40 + 20;
  const y = p.cy * 40 + 20;
  g.save();
  g.translate(x, y);
  g.fillStyle = '#10131a';
  g.strokeStyle = '#ffffff';
  g.lineWidth = 2;
  g.beginPath();
  g.roundRect(-18, -18, 36, 36, 6);
  g.fill();
  g.stroke();
  g.fillStyle = '#ffffff';
  g.strokeStyle = '#ffffff';
  g.lineWidth = 2.5;

  switch (p.kind) {
    case 'star': {
      g.beginPath();
      for (let i = 0; i < 10; i++) {
        const a = -Math.PI / 2 + (i * Math.PI) / 5;
        const r = i % 2 === 0 ? 12 : 5;
        const px = Math.cos(a) * r;
        const py = Math.sin(a) * r;
        if (i === 0) g.moveTo(px, py);
        else g.lineTo(px, py);
      }
      g.closePath();
      g.fill();
      break;
    }
    case 'shield': {
      g.beginPath();
      g.moveTo(0, -12);
      g.lineTo(10, -7);
      g.lineTo(10, 2);
      g.lineTo(0, 12);
      g.lineTo(-10, 2);
      g.lineTo(-10, -7);
      g.closePath();
      g.stroke();
      break;
    }
    case 'bomb': {
      g.beginPath();
      g.arc(0, 2, 9, 0, Math.PI * 2);
      g.fill();
      g.lineWidth = 2;
      g.beginPath();
      g.moveTo(3, -6);
      g.quadraticCurveTo(6, -12, 10, -12);
      g.stroke();
      break;
    }
    case 'freeze': {
      for (let i = 0; i < 3; i++) {
        const a = (i * Math.PI) / 3;
        g.beginPath();
        g.moveTo(Math.cos(a) * -11, Math.sin(a) * -11);
        g.lineTo(Math.cos(a) * 11, Math.sin(a) * 11);
        g.stroke();
      }
      break;
    }
    case 'life': {
      g.font = 'bold 13px sans-serif';
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.fillText('1UP', 0, 0);
      break;
    }
    case 'shovel': {
      g.lineWidth = 3;
      g.beginPath();
      g.moveTo(-8, -10);
      g.lineTo(4, 2);
      g.stroke();
      g.fillRect(-2, 0, 12, 9);
      break;
    }
  }
  g.restore();
}

// ---------- 子弹与爆炸 ----------
function drawBullet(g: CanvasRenderingContext2D, b: Bullet) {
  g.save();
  g.translate(b.x, b.y);
  g.rotate((b.dir * Math.PI) / 2);
  g.fillStyle = '#ffe9a8';
  g.fillRect(-2.5, -5, 5, 10);
  g.fillStyle = '#ffffff';
  g.fillRect(-1.5, -6.5, 3, 4);
  g.restore();
}

function drawBoom(g: CanvasRenderingContext2D, x: number, y: number, k: number, big: boolean) {
  const r = (big ? 26 : 18) * (0.4 + k * 0.9);
  const colors = ['#ffffff', '#ffd23f', '#ff7b2e', '#c23b22'];
  const ci = Math.min(colors.length - 1, Math.floor(k * colors.length));
  g.globalAlpha = 1 - k * 0.55;
  g.fillStyle = colors[ci];
  g.beginPath();
  g.arc(x, y, r, 0, Math.PI * 2);
  g.fill();
  if (k < 0.5) {
    g.fillStyle = '#ffffff';
    g.beginPath();
    g.arc(x, y, r * 0.5, 0, Math.PI * 2);
    g.fill();
  }
  g.globalAlpha = 1;
}

// ---------- 主渲染 ----------
export function render(g: CanvasRenderingContext2D, eng: GameEngine, timeMs: number) {
  g.save();
  g.clearRect(0, 0, WORLD, WORLD);
  g.fillStyle = '#0b0e14';
  g.fillRect(0, 0, WORLD, WORLD);

  // 屏幕震动
  if (eng.shakeT > 0) {
    const m = Math.min(4, eng.shakeT / 60);
    g.translate((Math.random() - 0.5) * m, (Math.random() - 0.5) * m);
  }

  const waterFrame = Math.floor(timeMs / 450) % 2 === 0 ? waterTileA : waterTileB;

  // 地形（草丛最后画）
  for (let cy = 0; cy < CELLS; cy++) {
    for (let cx = 0; cx < CELLS; cx++) {
      const v = eng.cells[cy * CELLS + cx];
      if (v === TERRAIN.EMPTY || v === TERRAIN.BUSH) continue;
      const tile =
        v === TERRAIN.BRICK ? brickTile :
        v === TERRAIN.STEEL ? steelTile :
        waterFrame;
      g.drawImage(tile, cx * SUB, cy * SUB);
    }
  }

  // 基地
  const bt = baseTiles();
  g.drawImage(eng.baseAlive ? bt.alive : bt.dead, BASE_X, BASE_Y);

  // 道具
  for (const p of eng.powerups) drawPowerup(g, p, timeMs);

  // 坦克
  for (const t of eng.tanks) {
    if (!t.alive) continue;
    if (t.spawnT > 0) {
      drawSpawn(g, t.cx, t.cy, timeMs);
      continue;
    }
    drawTank(g, t, timeMs);
  }

  // 子弹
  for (const b of eng.bullets) drawBullet(g, b);

  // 爆炸
  for (const b of eng.booms) {
    drawBoom(g, b.x, b.y, b.t / b.max, b.big);
  }

  // 粒子
  for (const p of eng.particles) {
    g.globalAlpha = Math.max(0, p.life / p.max);
    g.fillStyle = p.color;
    g.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
  }
  g.globalAlpha = 1;

  // 草丛盖在坦克上
  for (let cy = 0; cy < CELLS; cy++) {
    for (let cx = 0; cx < CELLS; cx++) {
      if (eng.cells[cy * CELLS + cx] === TERRAIN.BUSH) {
        g.drawImage(bushTile, cx * SUB, cy * SUB);
      }
    }
  }

  g.restore();
}
