/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export enum GameStatus {
  START = 'START',
  PLAYING = 'PLAYING',
  WON = 'WON',
  LOST = 'LOST',
  LEVEL_COMPLETE = 'LEVEL_COMPLETE',
}

export interface Point {
  x: number;
  y: number;
}

export interface Entity extends Point {
  id: string;
}

export interface Rocket extends Entity {
  targetX: number;
  targetY: number;
  speed: number;
  progress: number; // 0 to 1
  isDestroyed: boolean;
}

export interface Interceptor extends Entity {
  startX: number;
  startY: number;
  targetX: number;
  targetY: number;
  vx: number;
  vy: number;
  speed: number;
  progress: number;
  isExploded: boolean;
}

export interface Explosion extends Entity {
  radius: number;
  maxRadius: number;
  growthRate: number;
  isFinished: boolean;
  phase: 'growing' | 'shrinking';
}

export interface Battery extends Entity {
  ammo: number;
  maxAmmo: number;
  health: number;
  maxHealth: number;
  isDestroyed: boolean;
}

export interface City extends Entity {
  isDestroyed: boolean;
}

export const GAME_CONFIG = {
  TOTAL_LEVELS: 100,
  LEVEL_DURATION_SEC: 60,
  LEVEL_1_ROCKETS: 50,
  LEVEL_100_ROCKETS: 200,
  AMMO_MULTIPLIER: 3.0,
  ROCKET_SPEED_MIN: 0.5,
  ROCKET_SPEED_MAX: 1.5,
  ROCKET_BASE_RADIUS: 12, // Base radius for collision
  INTERCEPTOR_SPEED: 4.5, // 3 * ROCKET_SPEED_MAX
  BATTERY_MAX_HEALTH: 3,
  EXPLOSION_MAX_RADIUS: 40, // Reduced by half from 80
  EXPLOSION_GROWTH_RATE: 1.5,
  COLLISION_EXPLOSION_MULTIPLIER: 3,
  POINTS_PER_ROCKET: 20,
};
