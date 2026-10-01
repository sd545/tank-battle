import {
  BASE_X, BASE_Y, BASE_SIZE, CELLS, DX, DY, ENEMY_KINDS, ENEMY_SPAWNS,
  HALF, HI_KEY, PLAYER_BULLET_SPEED, PLAYER_COOLDOWN, PLAYER_MAX_BULLETS,
  PLAYER_POWER, PLAYER_SPAWN, PLAYER_SPEED, POWERUP_KINDS, POWERUP_SCORE,
  SUB, TANK, TERRAIN, WORLD,
} from './constants';
import type { Dir, PowerupKind } from './constants';
import { LEVELS } from './levels';
import { sfx } from './audio';

export type Phase = 'menu' | 'playing' | 'paused' | 'levelclear' | 'gameover' | 'victory';

export interface Tank {
  id: number;
  cx: number; cy: number; // 中心坐标
  dir: Dir;
  isPlayer: boolean;
  kind: number;
  hp: number;
  speed: number;
  cooldown: number;
  fireTimer: number;
  aiTimer: number;
  stuckTime: number;
  frozen: boolean;
  shield: number;
  spawnT: number;
  upgrade: number;
  moving: boolean;
  tread: number;
  alive: boolean;
  respawnT: number;
  flash: number;
}

export interface Bullet {
  x: number; y: number; // 中心
  dir: Dir;
  speed: number;
  power: number;
  fromPlayer: boolean;
  owner: number;
  dead: boolean;
}

export interface Powerup {
  kind: PowerupKind;
  cx: number; cy: number; // 格坐标（40px 格）
  ttl: number;
}

export interface Boom {
  x: number; y: number; t: number; max: number; big: boolean;
}

export interface Particle {
  x: number; y: number; vx: number; vy: number;
  life: number; max: number; color: string; size: number;
}

export interface InputState {
  dir: Dir | null;
  fire: boolean;
}

export interface Hud {
  phase: Phase;
  score: number;
  hi: number;
  lives: number;
  level: number; // 1-based
  levelName: string;
  levelCount: number;
  remaining: number;
  upgrade: number;
  shieldS: number;
  freezeS: number;
  baseAlive: boolean;
  loop: number;
  levelT: number; // 关卡开场横幅
}

const cellIndex = (cx: number, cy: number) => cy * CELLS + cx;

export class GameEngine {
  cells = new Uint8Array(CELLS * CELLS);
  tanks: Tank[] = [];
  bullets: Bullet[] = [];
  powerups: Powerup[] = [];
  booms: Boom[] = [];
  particles: Particle[] = [];

  phase: Phase = 'menu';
  phaseT = 0;
  timeMs = 0;
  shakeT = 0;

  score = 0;
  hi = 0;
  lives = 3;
  levelIdx = 0;
  loop = 0;
  baseAlive = true;
  freezeT = 0;
  shovelT = 0;
  levelT = 0; // 开场横幅计时

  private nextId = 1;
  private spawnQueue = 0;
  private spawnT = 0;
  private spawnIdx = 0;
  private ringCells: { i: number; prev: number }[] = [];

  player: Tank | null = null;

  constructor() {
    try {
      this.hi = Number(localStorage.getItem(HI_KEY) || '0') || 0;
    } catch {
      this.hi = 0;
    }
  }

  get level() {
    return LEVELS[this.levelIdx % LEVELS.length];
  }

  get levelNo() {
    return this.levelIdx + 1 + this.loop * LEVELS.length;
  }

  hud(): Hud {
    const enemiesAlive = this.tanks.filter((t) => !t.isPlayer && t.alive).length;
    return {
      phase: this.phase,
      score: this.score,
      hi: Math.max(this.hi, this.score),
      lives: this.lives,
      level: this.levelNo,
      levelName: this.level.name,
      levelCount: LEVELS.length,
      remaining: this.spawnQueue + enemiesAlive,
      upgrade: this.player?.upgrade ?? 0,
      shieldS: this.player ? Math.ceil(this.player.shield / 1000) : 0,
      freezeS: Math.ceil(this.freezeT / 1000),
      baseAlive: this.baseAlive,
      loop: this.loop,
      levelT: this.levelT,
    };
  }

  startGame() {
    this.score = 0;
    this.lives = 3;
    this.levelIdx = 0;
    this.loadLevel();
    this.phase = 'playing';
    sfx.stageStart();
  }

  nextLoop() {
    this.loop += 1;
    this.levelIdx = 0;
    this.lives = Math.max(this.lives, 3);
    this.loadLevel();
    this.phase = 'playing';
    sfx.stageStart();
  }

  toMenu() {
    this.saveHi();
    this.phase = 'menu';
    this.tanks = [];
    this.bullets = [];
    this.powerups = [];
    this.booms = [];
    this.particles = [];
  }

  togglePause() {
    if (this.phase === 'playing') this.phase = 'paused';
    else if (this.phase === 'paused') this.phase = 'playing';
  }

  private saveHi() {
    this.hi = Math.max(this.hi, this.score);
    try {
      localStorage.setItem(HI_KEY, String(this.hi));
    } catch {
      /* ignore */
    }
  }

  private loadLevel() {
    this.cells.fill(TERRAIN.EMPTY);
    this.tanks = [];
    this.bullets = [];
    this.powerups = [];
    this.booms = [];
    this.particles = [];
    this.freezeT = 0;
    this.shovelT = 0;
    this.baseAlive = true;
    this.ringCells = [];

    const def = this.level;
    for (let r = 0; r < 13; r++) {
      const row = def.map[r] || '';
      for (let c = 0; c < 13; c++) {
        const ch = row[c] || '.';
        let t: number = TERRAIN.EMPTY;
        if (ch === '#') t = TERRAIN.BRICK;
        else if (ch === '@') t = TERRAIN.STEEL;
        else if (ch === '~') t = TERRAIN.WATER;
        else if (ch === '%') t = TERRAIN.BUSH;
        if (t !== TERRAIN.EMPTY) {
          const cx0 = c * 2;
          const cy0 = r * 2;
          for (let dy = 0; dy < 2; dy++)
            for (let dx = 0; dx < 2; dx++)
              this.cells[cellIndex(cx0 + dx, cy0 + dy)] = t;
        }
      }
    }

    // 基地护圈（ring）
    const ringTiles = [
      [5, 11], [6, 11], [7, 11], [5, 12], [7, 12],
    ];
    if (def.ring) {
      for (const [tx, ty] of ringTiles) {
        const i0 = cellIndex(tx * 2, ty * 2);
        for (const di of [0, 1, CELLS, CELLS + 1]) {
          const i = i0 + di;
          if (this.cells[i] === TERRAIN.EMPTY) {
            this.cells[i] = TERRAIN.BRICK;
            this.ringCells.push({ i, prev: TERRAIN.BRICK });
          }
        }
      }
    }

    this.spawnPlayer();
    this.spawnQueue = def.enemies + this.loop * 2;
    this.spawnT = 1500; // 给开场横幅留时间
    this.spawnIdx = 0;
    this.levelT = 1600;
  }

  private spawnPlayer() {
    const p = this.makeTank(PLAYER_SPAWN.x, PLAYER_SPAWN.y, true, 0);
    p.dir = 0;
    p.shield = 2000;
    p.spawnT = 400;
    this.tanks.push(p);
    this.player = p;
  }

  private makeTank(cx: number, cy: number, isPlayer: boolean, kind: number): Tank {
    const k = ENEMY_KINDS[kind];
    return {
      id: this.nextId++,
      cx, cy,
      dir: isPlayer ? 0 : 2,
      isPlayer,
      kind,
      hp: isPlayer ? 1 : k.hp,
      speed: isPlayer ? PLAYER_SPEED : k.speed * (1 + this.loop * 0.06),
      cooldown: 0,
      fireTimer: 600 + Math.random() * 1200,
      aiTimer: 300 + Math.random() * 600,
      stuckTime: 0,
      frozen: false,
      shield: 0,
      spawnT: 700,
      upgrade: 0,
      moving: false,
      tread: 0,
      alive: true,
      respawnT: 0,
      flash: 0,
    };
  }

  update(dtMs: number, input: InputState) {
    const dt = Math.min(dtMs, 50);
    this.timeMs += dt;

    if (this.phase === 'levelclear') {
      this.phaseT -= dt;
      this.updateEffects(dt);
      if (this.phaseT <= 0) {
        this.levelIdx += 1;
        if (this.levelIdx >= LEVELS.length) {
          this.phase = 'victory';
          this.saveHi();
        } else {
          this.loadLevel();
          this.phase = 'playing';
          sfx.stageStart();
        }
      }
      return;
    }
    if (this.phase === 'gameover') {
      this.phaseT -= dt;
      this.updateEffects(dt);
      return;
    }
    if (this.phase !== 'playing') return;

    if (this.levelT > 0) this.levelT -= dt;
    if (this.freezeT > 0) this.freezeT -= dt;
    if (this.shovelT > 0) {
      this.shovelT -= dt;
      if (this.shovelT <= 0) this.restoreRing();
    }
    if (this.shakeT > 0) this.shakeT -= dt;

    this.spawnEnemies(dt);
    this.updateTanks(dt, input);
    this.updateBullets(dt);
    this.updatePowerups(dt);
    this.updateEffects(dt);

    const enemiesAlive = this.tanks.some((t) => !t.isPlayer && t.alive);
    if (this.spawnQueue === 0 && !enemiesAlive && this.baseAlive) {
      this.phase = 'levelclear';
      this.phaseT = 2400;
      this.saveHi();
      sfx.levelClear();
    }
  }

  private spawnEnemies(dt: number) {
    if (this.spawnQueue <= 0) return;
    const onField = this.tanks.filter((t) => !t.isPlayer && t.alive).length;
    if (onField >= 4) return;
    this.spawnT -= dt;
    if (this.spawnT > 0) return;
    this.spawnT = Math.max(1300, 2500 - this.loop * 150);

    const def = this.level;
    const sp = ENEMY_SPAWNS[this.spawnIdx % ENEMY_SPAWNS.length];
    this.spawnIdx += 1;
    const kind = def.pool[Math.floor(Math.random() * def.pool.length)];
    const t = this.makeTank(sp.x, sp.y, false, kind);
    // 出生点被占用则顺延
    if (this.tankAt(sp.x, sp.y, 0)) {
      t.spawnT = 900;
    }
    this.tanks.push(t);
    this.spawnQueue -= 1;
  }

  private tankAt(cx: number, cy: number, ignoreId: number): Tank | null {
    for (const t of this.tanks) {
      if (!t.alive || t.id === ignoreId || t.spawnT > 0) continue;
      if (Math.abs(t.cx - cx) < TANK - 4 && Math.abs(t.cy - cy) < TANK - 4) return t;
    }
    return null;
  }

  private updateTanks(dt: number, input: InputState) {
    for (const t of this.tanks) {
      if (!t.alive) {
        if (t.isPlayer && this.phase === 'playing') {
          t.respawnT -= dt;
          if (t.respawnT <= 0 && this.lives > 0) this.respawnPlayer();
        }
        continue;
      }
      if (t.spawnT > 0) {
        t.spawnT -= dt;
        continue;
      }
      if (t.flash > 0) t.flash -= dt;
      if (t.shield > 0) t.shield -= dt;
      t.frozen = !t.isPlayer && this.freezeT > 0;
      if (t.cooldown > 0) t.cooldown -= dt;

      if (t.isPlayer) this.updatePlayer(t, dt, input);
      else this.updateEnemy(t, dt);
    }
    // 清理尸体
    this.tanks = this.tanks.filter((t) => t.alive || (t.isPlayer && this.lives > 0 && this.phase === 'playing'));
  }

  private updatePlayer(p: Tank, dt: number, input: InputState) {
    p.moving = false;
    if (input.dir !== null) {
      // 转向时辅助对齐，便于钻走廊
      const perp = input.dir % 2 === 0 ? 'x' : 'y';
      if (perp === 'x') p.cx = this.snap(p.cx);
      else p.cy = this.snap(p.cy);
      p.dir = input.dir;
      const step = p.speed * (dt / 1000);
      p.moving = this.tryMove(p, DX[p.dir] * step, DY[p.dir] * step);
    }
    if (p.moving) p.tread += dt / 90;
    if (input.fire && p.spawnT <= 0) this.tryFire(p);
  }

  private snap(v: number): number {
    const m = v % 8;
    if (m <= 5 || m >= 3) {
      const base = Math.round(v / 8) * 8;
      if (Math.abs(base - v) <= 5) return Math.max(HALF, Math.min(WORLD - HALF, base));
    }
    return v;
  }

  private updateEnemy(t: Tank, dt: number) {
    if (t.frozen) {
      t.moving = false;
      return;
    }
    t.aiTimer -= dt;
    if (t.aiTimer <= 0) {
      t.aiTimer = 350 + Math.random() * 700;
      const r = Math.random();
      if (r < 0.32) {
        // 朝目标（玩家或基地）逼近
        const target = Math.random() < 0.55 && this.player?.alive ? this.player : null;
        const tx = target ? target.cx : BASE_X + BASE_SIZE / 2;
        const ty = target ? target.cy : BASE_Y + BASE_SIZE / 2;
        const dx = tx - t.cx;
        const dy = ty - t.cy;
        t.dir = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 1 : 3) : (dy > 0 ? 2 : 0);
      } else if (r < 0.6) {
        t.dir = Math.floor(Math.random() * 4) as Dir;
      }
    }
    const step = t.speed * (dt / 1000);
    const moved = this.tryMove(t, DX[t.dir] * step, DY[t.dir] * step);
    t.moving = moved;
    if (moved) {
      t.tread += dt / 90;
      t.stuckTime = 0;
    } else {
      t.stuckTime += dt;
      if (t.stuckTime > 180) {
        t.stuckTime = 0;
        // 撞墙后大概率换方向，偶尔掉头沿垂直方向
        t.dir = Math.random() < 0.7
          ? ((t.dir + (Math.random() < 0.5 ? 1 : 3)) % 4) as Dir
          : ((t.dir + 2) % 4) as Dir;
      }
    }
    t.fireTimer -= dt;
    if (t.fireTimer <= 0) {
      t.fireTimer = 900 + Math.random() * 1900 - Math.min(500, this.levelIdx * 50);
      this.tryFire(t);
    }
  }

  private tryMove(t: Tank, dx: number, dy: number): boolean {
    if (dx === 0 && dy === 0) return false;
    const nx = Math.max(HALF, Math.min(WORLD - HALF, t.cx + dx));
    const ny = Math.max(HALF, Math.min(WORLD - HALF, t.cy + dy));
    if (this.tankBlockedAt(nx, ny, t)) return false;
    t.cx = nx;
    t.cy = ny;
    return true;
  }

  private tankBlockedAt(cx: number, cy: number, self: Tank): boolean {
    const x = cx - HALF + 2;
    const y = cy - HALF + 2;
    const s = TANK - 4;
    // 地形
    if (this.rectHitsTerrain(x, y, s, true)) return true;
    // 基地
    if (this.baseAlive && this.rectOverlap(x, y, s, s, BASE_X, BASE_Y, BASE_SIZE, BASE_SIZE)) return true;
    // 其他坦克
    for (const o of this.tanks) {
      if (o.id === self.id || !o.alive || o.spawnT > 0) continue;
      if (Math.abs(o.cx - cx) < TANK - 2 && Math.abs(o.cy - cy) < TANK - 2) return true;
    }
    return false;
  }

  private rectHitsTerrain(x: number, y: number, s: number, forTank: boolean): boolean {
    const cx0 = Math.max(0, Math.floor(x / SUB));
    const cy0 = Math.max(0, Math.floor(y / SUB));
    const cx1 = Math.min(CELLS - 1, Math.floor((x + s - 1) / SUB));
    const cy1 = Math.min(CELLS - 1, Math.floor((y + s - 1) / SUB));
    for (let cy = cy0; cy <= cy1; cy++) {
      for (let cx = cx0; cx <= cx1; cx++) {
        const v = this.cells[cellIndex(cx, cy)];
        if (forTank) {
          if (v === TERRAIN.BRICK || v === TERRAIN.STEEL || v === TERRAIN.WATER) return true;
        } else {
          if (v === TERRAIN.BRICK || v === TERRAIN.STEEL) return true;
        }
      }
    }
    return false;
  }

  private rectOverlap(
    ax: number, ay: number, aw: number, ah: number,
    bx: number, by: number, bw: number, bh: number,
  ): boolean {
    return ax < bx + bw && ax + aw > bx && ay < by + bh && ay + ah > by;
  }

  private tryFire(t: Tank) {
    if (t.cooldown > 0 || !t.alive) return;
    if (t.isPlayer) {
      const up = t.upgrade;
      const active = this.bullets.filter((b) => b.fromPlayer && !b.dead).length;
      if (active >= PLAYER_MAX_BULLETS[up]) return;
      t.cooldown = PLAYER_COOLDOWN[up];
      this.spawnBullet(t, PLAYER_BULLET_SPEED[up], PLAYER_POWER[up]);
    } else {
      const enemyBullets = this.bullets.filter((b) => !b.fromPlayer && !b.dead).length;
      if (enemyBullets >= 6) return;
      const own = this.bullets.filter((b) => !b.fromPlayer && b.owner === t.id && !b.dead).length;
      if (own >= 1) return;
      t.cooldown = 400;
      this.spawnBullet(t, ENEMY_KINDS[t.kind].bulletSpeed * (1 + this.loop * 0.05), 1);
    }
  }

  private spawnBullet(t: Tank, speed: number, power: number) {
    const mx = t.cx + DX[t.dir] * (HALF + 2);
    const my = t.cy + DY[t.dir] * (HALF + 2);
    this.bullets.push({
      x: mx, y: my, dir: t.dir, speed, power,
      fromPlayer: t.isPlayer, owner: t.id, dead: false,
    });
    if (t.isPlayer) sfx.shoot();
  }

  private updateBullets(dt: number) {
    for (const b of this.bullets) {
      if (b.dead) continue;
      let dist = b.speed * (dt / 1000);
      const stepLen = 8;
      while (dist > 0 && !b.dead) {
        const step = Math.min(stepLen, dist);
        dist -= step;
        b.x += DX[b.dir] * step;
        b.y += DY[b.dir] * step;
        this.collideBullet(b);
      }
    }
    // 子弹对撞
    for (let i = 0; i < this.bullets.length; i++) {
      const a = this.bullets[i];
      if (a.dead) continue;
      for (let j = i + 1; j < this.bullets.length; j++) {
        const c = this.bullets[j];
        if (c.dead || a.fromPlayer === c.fromPlayer) continue;
        if (Math.abs(a.x - c.x) < 8 && Math.abs(a.y - c.y) < 8) {
          a.dead = c.dead = true;
          this.spark((a.x + c.x) / 2, (a.y + c.y) / 2, '#ffffff', 5);
          break;
        }
      }
    }
    this.bullets = this.bullets.filter((b) => !b.dead);
  }

  private collideBullet(b: Bullet) {
    // 边界
    if (b.x < 2 || b.x > WORLD - 2 || b.y < 2 || b.y > WORLD - 2) {
      b.dead = true;
      this.spark(b.x, b.y, '#ffd23f', 4);
      return;
    }
    // 基地
    if (this.baseAlive && b.x > BASE_X && b.x < BASE_X + BASE_SIZE && b.y > BASE_Y && b.y < BASE_Y + BASE_SIZE) {
      b.dead = true;
      this.destroyBase();
      return;
    }
    // 地形
    const cx = Math.floor(b.x / SUB);
    const cy = Math.floor(b.y / SUB);
    if (cx >= 0 && cx < CELLS && cy >= 0 && cy < CELLS) {
      const v = this.cells[cellIndex(cx, cy)];
      if (v === TERRAIN.BRICK) {
        b.dead = true;
        this.destroyBrick(cx, cy, b.dir);
        sfx.hitBrick();
        return;
      }
      if (v === TERRAIN.STEEL) {
        b.dead = true;
        if (b.power >= 2) {
          this.cells[cellIndex(cx, cy)] = TERRAIN.EMPTY;
          this.debris(cx, cy, '#9aa3ad');
          sfx.hitSteel();
        } else {
          this.spark(b.x, b.y, '#cfd6dd', 4);
          sfx.hitSteel();
        }
        return;
      }
    }
    // 坦克
    for (const t of this.tanks) {
      if (!t.alive || t.id === b.owner || t.spawnT > 0) continue;
      if (t.isPlayer === b.fromPlayer) continue;
      if (Math.abs(b.x - t.cx) < HALF + 2 && Math.abs(b.y - t.cy) < HALF + 2) {
        b.dead = true;
        this.hitTank(t);
        return;
      }
    }
  }

  private destroyBrick(cx: number, cy: number, dir: Dir) {
    const kill = (x: number, y: number) => {
      if (x < 0 || x >= CELLS || y < 0 || y >= CELLS) return;
      const i = cellIndex(x, y);
      if (this.cells[i] === TERRAIN.BRICK) {
        this.cells[i] = TERRAIN.EMPTY;
        this.debris(x, y, '#b0562e');
      }
    };
    kill(cx, cy);
    // 沿垂直于弹道的方向多打一格，形成约 40px 缺口
    if (dir % 2 === 0) {
      kill(cx - 1, cy);
      kill(cx + 1, cy);
    } else {
      kill(cx, cy - 1);
      kill(cx, cy + 1);
    }
  }

  private hitTank(t: Tank) {
    if (t.isPlayer) {
      if (t.shield > 0 || t.spawnT > 0) {
        this.spark(t.cx, t.cy, '#7ecbff', 6);
        return;
      }
      this.lives -= 1;
      sfx.explosion();
      this.boom(t.cx, t.cy, true);
      t.alive = false;
      t.respawnT = 1500;
      if (this.player) this.player.upgrade = 0;
      this.shakeT = 250;
      if (this.lives <= 0) this.gameOver();
      return;
    }
    t.hp -= 1;
    t.flash = 120;
    if (t.hp > 0) {
      sfx.hitTank();
      this.spark(t.cx, t.cy, '#ffffff', 5);
      return;
    }
    // 敌军击毁
    t.alive = false;
    const gained = ENEMY_KINDS[t.kind].score;
    this.score += gained;
    this.hi = Math.max(this.hi, this.score);
    sfx.explosion();
    this.boom(t.cx, t.cy, false);
    // 掉落道具
    if (Math.random() < 0.13 && this.powerups.length < 2) {
      this.dropPowerup();
    }
  }

  private respawnPlayer() {
    const p = this.player;
    if (!p) return;
    p.alive = true;
    p.cx = PLAYER_SPAWN.x;
    p.cy = PLAYER_SPAWN.y;
    p.dir = 0;
    p.hp = 1;
    p.shield = 2500;
    p.spawnT = 400;
    p.cooldown = 0;
    p.upgrade = 0;
    this.tanks.push(p);
  }

  private destroyBase() {
    if (!this.baseAlive) return;
    this.baseAlive = false;
    sfx.bigExplosion();
    this.boom(BASE_X + BASE_SIZE / 2, BASE_Y + BASE_SIZE / 2, true);
    this.shakeT = 500;
    this.gameOver();
  }

  private gameOver() {
    if (this.phase === 'gameover') return;
    this.phase = 'gameover';
    this.phaseT = 2200;
    this.saveHi();
    sfx.gameOver();
  }

  private dropPowerup() {
    for (let tries = 0; tries < 40; tries++) {
      const tx = Math.floor(Math.random() * 11) + 1;
      const ty = Math.floor(Math.random() * 11) + 1;
      if (tx >= 5 && tx <= 7 && ty >= 11) continue; // 避开基地
      const i0 = cellIndex(tx * 2, ty * 2);
      let clear = true;
      for (const di of [0, 1, CELLS, CELLS + 1]) {
        if (this.cells[i0 + di] !== TERRAIN.EMPTY) { clear = false; break; }
      }
      if (!clear) continue;
      const kind = POWERUP_KINDS[Math.floor(Math.random() * POWERUP_KINDS.length)];
      this.powerups.push({ kind, cx: tx, cy: ty, ttl: 11000 });
      return;
    }
  }

  private updatePowerups(dt: number) {
    for (const p of this.powerups) {
      p.ttl -= dt;
      if (p.ttl <= 0) continue;
      const px = p.cx * 40 + 20;
      const py = p.cy * 40 + 20;
      for (const t of this.tanks) {
        if (!t.alive || t.spawnT > 0) continue;
        if (Math.abs(t.cx - px) < 34 && Math.abs(t.cy - py) < 34) {
          p.ttl = 0;
          if (t.isPlayer) this.applyPowerup(p.kind);
          break;
        }
      }
    }
    this.powerups = this.powerups.filter((p) => p.ttl > 0);
  }

  private applyPowerup(kind: PowerupKind) {
    this.score += POWERUP_SCORE;
    const p = this.player;
    switch (kind) {
      case 'star':
        if (p && p.alive) p.upgrade = Math.min(3, p.upgrade + 1);
        sfx.powerup();
        break;
      case 'shield':
        if (p && p.alive) p.shield = 10000;
        sfx.powerup();
        break;
      case 'bomb': {
        for (const t of this.tanks) {
          if (!t.isPlayer && t.alive) {
            t.alive = false;
            this.boom(t.cx, t.cy, false);
          }
        }
        this.shakeT = 400;
        sfx.bigExplosion();
        break;
      }
      case 'freeze':
        this.freezeT = 6000;
        sfx.freeze();
        break;
      case 'life':
        this.lives = Math.min(9, this.lives + 1);
        sfx.oneUp();
        break;
      case 'shovel':
        this.fortifyRing();
        this.shovelT = 15000;
        sfx.powerup();
        break;
    }
  }

  private fortifyRing() {
    for (const r of this.ringCells) {
      if (this.cells[r.i] === TERRAIN.BRICK) this.cells[r.i] = TERRAIN.STEEL;
    }
  }

  private restoreRing() {
    for (const r of this.ringCells) {
      if (this.cells[r.i] === TERRAIN.STEEL) this.cells[r.i] = TERRAIN.BRICK;
    }
  }

  private boom(x: number, y: number, big: boolean) {
    this.booms.push({ x, y, t: 0, max: big ? 520 : 360, big });
  }

  private spark(x: number, y: number, color: string, n: number) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = 40 + Math.random() * 80;
      this.particles.push({
        x, y,
        vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
        life: 200 + Math.random() * 150, max: 350,
        color, size: 2 + Math.random() * 2,
      });
    }
  }

  private debris(cx: number, cy: number, color: string) {
    for (let i = 0; i < 4; i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = 30 + Math.random() * 60;
      this.particles.push({
        x: cx * SUB + SUB / 2, y: cy * SUB + SUB / 2,
        vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
        life: 260 + Math.random() * 200, max: 460,
        color, size: 3 + Math.random() * 3,
      });
    }
  }

  private updateEffects(dt: number) {
    for (const b of this.booms) b.t += dt;
    this.booms = this.booms.filter((b) => b.t < b.max);
    for (const p of this.particles) {
      p.life -= dt;
      p.x += (p.vx * dt) / 1000;
      p.y += (p.vy * dt) / 1000;
      p.vx *= 0.98;
      p.vy *= 0.98;
    }
    this.particles = this.particles.filter((p) => p.life > 0);
  }
}
