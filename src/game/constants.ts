// 世界尺寸常量
export const TILE = 40;
export const COLS = 13;
export const ROWS = 13;
export const WORLD = TILE * COLS; // 520
export const SUB = 20; // 半砖网格
export const CELLS = WORLD / SUB; // 26

export const TANK = 36;
export const HALF = TANK / 2;

export const TERRAIN = { EMPTY: 0, BRICK: 1, STEEL: 2, WATER: 3, BUSH: 4 } as const;

export type Dir = 0 | 1 | 2 | 3; // 上右下左
export const DX = [0, 1, 0, -1];
export const DY = [-1, 0, 1, 0];

export const BASE_X = 6 * TILE; // 240
export const BASE_Y = 12 * TILE; // 480
export const BASE_SIZE = TILE;

// 出生点（中心坐标）
export const PLAYER_SPAWN = { x: 4.5 * TILE, y: 12.5 * TILE }; // (180, 500)
export const ENEMY_SPAWNS = [
  { x: 0.5 * TILE, y: 0.5 * TILE },
  { x: 6.5 * TILE, y: 0.5 * TILE },
  { x: 12.5 * TILE, y: 0.5 * TILE },
];

// 敌军种类参数
export const ENEMY_KINDS = [
  { speed: 58, hp: 1, score: 100, bulletSpeed: 200, color: '#9aa3ad', name: '普通' },
  { speed: 118, hp: 1, score: 200, bulletSpeed: 220, color: '#7ec850', name: '快速' },
  { speed: 78, hp: 1, score: 300, bulletSpeed: 300, color: '#e0a33e', name: '火力' },
  { speed: 58, hp: 4, score: 400, bulletSpeed: 200, color: '#d14b3c', name: '装甲' },
];

// 玩家参数（按星级 upgrade 0..3）
export const PLAYER_SPEED = 100;
export const PLAYER_BULLET_SPEED = [280, 330, 370, 420];
export const PLAYER_COOLDOWN = [380, 340, 300, 260];
export const PLAYER_MAX_BULLETS = [1, 1, 2, 2];
export const PLAYER_POWER = [1, 1, 1, 2]; // 2 可破钢

export const POWERUP_KINDS = ['star', 'shield', 'bomb', 'freeze', 'life', 'shovel'] as const;
export type PowerupKind = (typeof POWERUP_KINDS)[number];
export const POWERUP_NAMES: Record<PowerupKind, string> = {
  star: '火力升级',
  shield: '防护罩',
  bomb: '全屏炸弹',
  freeze: '冻结敌军',
  life: '额外生命',
  shovel: '基地钢墙',
};
export const POWERUP_SCORE = 500;

export const HI_KEY = 'tank-battle-hiscore';
export const MUTE_KEY = 'tank-battle-muted';
