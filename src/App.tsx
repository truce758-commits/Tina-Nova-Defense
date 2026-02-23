/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Shield, Target, Trophy, RotateCcw, Play, Languages, Volume2 } from 'lucide-react';
import { 
  GameStatus, 
  Rocket, 
  Interceptor, 
  Explosion, 
  Battery, 
  City, 
  GAME_CONFIG 
} from './types';

// Audio Synthesis for Explosion
const playExplosionSound = (audioCtx: AudioContext | null) => {
  if (!audioCtx) return;
  const duration = 0.5;
  const sampleRate = audioCtx.sampleRate;
  const bufferSize = sampleRate * duration;
  const buffer = audioCtx.createBuffer(1, bufferSize, sampleRate);
  const data = buffer.getChannelData(0);

  for (let i = 0; i < bufferSize; i++) {
    data[i] = (Math.random() * 2 - 1) * (1 - i / bufferSize);
  }

  const noise = audioCtx.createBufferSource();
  noise.buffer = buffer;

  const filter = audioCtx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.setValueAtTime(1000, audioCtx.currentTime);
  filter.frequency.exponentialRampToValueAtTime(40, audioCtx.currentTime + duration);

  const gain = audioCtx.createGain();
  gain.gain.setValueAtTime(0.3, audioCtx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + duration);

  noise.connect(filter);
  filter.connect(gain);
  gain.connect(audioCtx.destination);

  noise.start();
  noise.stop(audioCtx.currentTime + duration);
};

const INITIAL_BATTERIES = (width: number, height: number): Battery[] => [
  { id: 'b-left', x: 80, y: height - 40, ammo: 20, maxAmmo: 20, health: GAME_CONFIG.BATTERY_MAX_HEALTH, maxHealth: GAME_CONFIG.BATTERY_MAX_HEALTH, isDestroyed: false },
  { id: 'b-mid', x: width / 2, y: height - 40, ammo: 40, maxAmmo: 40, health: GAME_CONFIG.BATTERY_MAX_HEALTH, maxHealth: GAME_CONFIG.BATTERY_MAX_HEALTH, isDestroyed: false },
  { id: 'b-right', x: width - 80, y: height - 40, ammo: 20, maxAmmo: 20, health: GAME_CONFIG.BATTERY_MAX_HEALTH, maxHealth: GAME_CONFIG.BATTERY_MAX_HEALTH, isDestroyed: false },
];

const INITIAL_CITIES = (width: number, height: number): City[] => {
  const spacing = (width - 300) / 7;
  return Array.from({ length: 6 }).map((_, i) => ({
    id: `city-${i}`,
    x: 150 + (i < 3 ? i : i + 1) * spacing,
    y: height - 20,
    isDestroyed: false,
  }));
};

const UFO = ({ size, top, left, delay }: { size: number, top: string, left: string, delay: number }) => (
  <motion.div
    initial={{ x: -100, opacity: 0, scale: 0.8 }}
    animate={{ 
      x: [0, 30, -30, 0],
      y: [0, -15, 15, 0],
      rotate: [0, 2, -2, 0],
      opacity: 1,
      scale: 1
    }}
    transition={{ 
      x: { duration: 8, repeat: Infinity, ease: "easeInOut" },
      y: { duration: 5, repeat: Infinity, ease: "easeInOut" },
      rotate: { duration: 6, repeat: Infinity, ease: "easeInOut" },
      opacity: { duration: 1, delay }
    }}
    style={{ top, left, position: 'absolute' }}
    className="z-10 pointer-events-none filter drop-shadow-[0_0_15px_rgba(16,185,129,0.3)]"
  >
    <div style={{ width: size, height: size / 2.5 }} className="relative group">
      {/* Tractor Beam Glow */}
      <motion.div 
        animate={{ opacity: [0.1, 0.3, 0.1], scale: [1, 1.1, 1] }}
        transition={{ duration: 2, repeat: Infinity }}
        className="absolute top-[80%] left-1/2 -translate-x-1/2 w-[40%] h-[200%] bg-gradient-to-b from-emerald-500/40 to-transparent blur-xl"
      />
      
      {/* UFO Body - Metallic Gradient */}
      <div className="absolute inset-0 bg-gradient-to-b from-zinc-300 via-zinc-500 to-zinc-800 rounded-full border-b-4 border-black/40 shadow-2xl" />
      
      {/* UFO Dome - Glassy */}
      <div className="absolute top-[-25%] left-[25%] w-[50%] h-[70%] bg-gradient-to-br from-emerald-300/40 to-emerald-600/20 rounded-full border border-white/20 backdrop-blur-md shadow-inner overflow-hidden">
        <div className="absolute top-1/4 left-1/4 w-2 h-2 bg-white/40 rounded-full blur-[1px]" />
      </div>

      {/* UFO Ring Detail */}
      <div className="absolute top-[45%] left-[5%] w-[90%] h-[10%] bg-black/20 rounded-full" />

      {/* UFO Lights - Pulsing */}
      <div className="absolute bottom-[25%] left-0 w-full flex justify-around px-4">
        {[1, 2, 3, 4, 5].map(i => (
          <motion.div
            key={i}
            animate={{ 
              backgroundColor: ['#10b981', '#34d399', '#10b981'],
              boxShadow: [
                '0 0 5px rgba(16,185,129,0.5)',
                '0 0 15px rgba(16,185,129,0.8)',
                '0 0 5px rgba(16,185,129,0.5)'
              ]
            }}
            transition={{ duration: 1.5, repeat: Infinity, delay: i * 0.3 }}
            className="w-2 h-2 rounded-full"
          />
        ))}
      </div>
    </div>
  </motion.div>
);

export default function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [status, setStatus] = useState<GameStatus>(GameStatus.START);
  const [score, setScore] = useState(0);
  const [level, setLevel] = useState(1);
  const [lang, setLang] = useState<'en' | 'cn'>('cn');
  const [timeLeft, setTimeLeft] = useState(GAME_CONFIG.LEVEL_DURATION_SEC);
  const audioCtxRef = useRef<AudioContext | null>(null);
  
  const stateRef = useRef({
    rockets: [] as Rocket[],
    interceptors: [] as Interceptor[],
    explosions: [] as Explosion[],
    batteries: [] as Battery[],
    cities: [] as City[],
    width: 0,
    height: 0,
    stars: [] as {x: number, y: number, size: number}[],
    silhouette: [] as {x: number, y: number, w: number, h: number}[],
    rocketsToSpawn: 0,
    levelStartTime: 0,
  });

  const [uiBatteries, setUiBatteries] = useState<Battery[]>([]);

  const t = {
    en: {
      title: "Tina Nova Defense",
      start: "Start Game",
      win: "Victory!",
      loss: "Game Over",
      levelComplete: "Level Complete!",
      score: "Score",
      level: "Level",
      winMsg: "Level cleared! Next challenge awaits.",
      lossMsg: "All cities destroyed. Civilization has fallen.",
      restart: "Restart from Level 1",
      nextLevel: "Next Level",
      endGame: "Quit to Menu",
      ammo: "Ammo",
      instructions: "Tap anywhere to intercept incoming rockets. Protect the cities!",
      rocketsLeft: "Rockets",
    },
    cn: {
      title: "Tina新星防御",
      start: "开始游戏",
      win: "胜利！",
      loss: "游戏结束",
      levelComplete: "关卡完成！",
      score: "得分",
      level: "关卡",
      winMsg: "关卡已清除！下一个挑战在等待。",
      lossMsg: "所有城市已被摧毁。文明已经沦陷。",
      restart: "从第一关重新开始",
      nextLevel: "下一局",
      endGame: "结束游戏",
      ammo: "弹药",
      instructions: "点击屏幕任意位置拦截敌方火箭。保卫城市！",
      rocketsLeft: "剩余火箭",
    }
  }[lang];

  const getRocketsForLevel = (l: number) => {
    if (l >= GAME_CONFIG.TOTAL_LEVELS) return GAME_CONFIG.LEVEL_100_ROCKETS;
    const range = GAME_CONFIG.LEVEL_100_ROCKETS - GAME_CONFIG.LEVEL_1_ROCKETS;
    return Math.floor(GAME_CONFIG.LEVEL_1_ROCKETS + (l - 1) * (range / (GAME_CONFIG.TOTAL_LEVELS - 1)));
  };

  const initGame = useCallback((resetLevel = true, isNextLevel = false) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const width = window.innerWidth;
    const height = window.innerHeight;
    canvas.width = width;
    canvas.height = height;
    
    stateRef.current.width = width;
    stateRef.current.height = height;
    
    let currentLevel = level;
    if (resetLevel) {
      currentLevel = 1;
      setLevel(1);
      setScore(0);
    } else if (isNextLevel) {
      currentLevel = level + 1;
      setLevel(currentLevel);
    }

    const totalRockets = getRocketsForLevel(currentLevel);
    const totalAmmo = Math.floor(totalRockets * GAME_CONFIG.AMMO_MULTIPLIER);
    
    // Distribute ammo: 25% sides, 50% middle
    const sideAmmo = Math.floor(totalAmmo * 0.25);
    const midAmmo = totalAmmo - (sideAmmo * 2);

    stateRef.current.batteries = [
      { id: 'b-left', x: 80, y: height - 40, ammo: sideAmmo, maxAmmo: sideAmmo, health: GAME_CONFIG.BATTERY_MAX_HEALTH, maxHealth: GAME_CONFIG.BATTERY_MAX_HEALTH, isDestroyed: false },
      { id: 'b-mid', x: width / 2, y: height - 40, ammo: midAmmo, maxAmmo: midAmmo, health: GAME_CONFIG.BATTERY_MAX_HEALTH, maxHealth: GAME_CONFIG.BATTERY_MAX_HEALTH, isDestroyed: false },
      { id: 'b-right', x: width - 80, y: height - 40, ammo: sideAmmo, maxAmmo: sideAmmo, health: GAME_CONFIG.BATTERY_MAX_HEALTH, maxHealth: GAME_CONFIG.BATTERY_MAX_HEALTH, isDestroyed: false },
    ];
    
    stateRef.current.cities = INITIAL_CITIES(width, height);
    stateRef.current.rockets = [];
    stateRef.current.interceptors = [];
    stateRef.current.explosions = [];
    stateRef.current.rocketsToSpawn = totalRockets;
    stateRef.current.levelStartTime = Date.now();
    
    setTimeLeft(GAME_CONFIG.LEVEL_DURATION_SEC);

    // Generate stars
    stateRef.current.stars = Array.from({ length: 100 }).map(() => ({
      x: Math.random() * width,
      y: Math.random() * (height * 0.7),
      size: Math.random() * 2,
    }));

    // Pre-calculate silhouette
    stateRef.current.silhouette = Array.from({ length: 20 }).map((_, i) => ({
      x: i * (width / 15),
      y: height,
      w: 40 + Math.random() * 60,
      h: 50 + Math.random() * 150,
    }));
    
    setUiBatteries([...stateRef.current.batteries]);

    if (!audioCtxRef.current) {
      audioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
  }, [level]);

  const startGame = () => {
    initGame(true);
    setStatus(GameStatus.PLAYING);
  };

  const handleNextLevel = () => {
    initGame(false, true);
    setStatus(GameStatus.PLAYING);
  };

  const endGame = () => {
    setStatus(GameStatus.START);
  };

  const handleCanvasClick = (e: React.MouseEvent | React.TouchEvent) => {
    if (status !== GameStatus.PLAYING) return;

    let clientX, clientY;
    if ('touches' in e) {
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else {
      clientX = (e as React.MouseEvent).clientX;
      clientY = (e as React.MouseEvent).clientY;
    }

    const availableBatteries = stateRef.current.batteries.filter(b => !b.isDestroyed && b.ammo > 0);
    if (availableBatteries.length === 0) return;

    let nearest = availableBatteries[0];
    let minDist = Infinity;

    availableBatteries.forEach(b => {
      const dist = Math.sqrt(Math.pow(b.x - clientX, 2) + Math.pow(b.y - clientY, 2));
      if (dist < minDist) {
        minDist = dist;
        nearest = b;
      }
    });

    nearest.ammo--;
    setUiBatteries([...stateRef.current.batteries]);

    const dx = clientX - nearest.x;
    const dy = (clientY - (nearest.y - 30));
    const dist = Math.sqrt(dx * dx + dy * dy);

    stateRef.current.interceptors.push({
      id: Math.random().toString(36).substr(2, 9),
      x: nearest.x,
      y: nearest.y - 30,
      startX: nearest.x,
      startY: nearest.y - 30,
      targetX: clientX,
      targetY: clientY,
      vx: (dx / dist) * GAME_CONFIG.INTERCEPTOR_SPEED,
      vy: (dy / dist) * GAME_CONFIG.INTERCEPTOR_SPEED,
      speed: GAME_CONFIG.INTERCEPTOR_SPEED,
      progress: 0,
      isExploded: false,
    });
  };

  // Drawing Helpers
  const drawMissile = (ctx: CanvasRenderingContext2D, x: number, y: number, angle: number, color: string, scale: number = 1) => {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle);
    ctx.scale(scale, scale);
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.roundRect(-8, -2, 12, 4, 1);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(4, 0, 6, 2, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(-8, -2);
    ctx.lineTo(-12, -6);
    ctx.lineTo(-12, 6);
    ctx.lineTo(-8, 2);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  };

  const drawBattery = (ctx: CanvasRenderingContext2D, b: Battery) => {
    if (b.isDestroyed) {
      ctx.fillStyle = '#18181b';
      ctx.beginPath();
      ctx.ellipse(b.x, b.y, 20, 8, 0, 0, Math.PI * 2);
      ctx.fill();
      return;
    }
    ctx.save();
    ctx.translate(b.x, b.y);
    
    // Modern Base - Metallic/Carbon look
    const baseGrad = ctx.createLinearGradient(-35, 0, 35, 0);
    baseGrad.addColorStop(0, '#1e293b');
    baseGrad.addColorStop(0.5, '#475569');
    baseGrad.addColorStop(1, '#1e293b');
    ctx.fillStyle = baseGrad;
    ctx.beginPath();
    ctx.moveTo(-40, 0);
    ctx.lineTo(40, 0);
    ctx.lineTo(30, -18);
    ctx.lineTo(-30, -18);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = '#64748b';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Launcher body - Sleek Hexagonal/Modern
    ctx.translate(0, -18);
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(-18, -28, 36, 28);
    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 1;
    ctx.strokeRect(-18, -28, 36, 28);
    
    // Glow effect for barrels
    ctx.shadowBlur = 10;
    ctx.shadowColor = '#10b981';
    
    ctx.fillStyle = '#020617';
    for (let i = 0; i < 2; i++) {
      for (let j = 0; j < 2; j++) {
        const tx = -9 + i * 18;
        const ty = -20 + j * 14;
        ctx.beginPath();
        ctx.arc(tx, ty, 5, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#1e293b';
        ctx.stroke();
        
        // High-tech core
        ctx.fillStyle = '#10b981';
        ctx.beginPath();
        ctx.arc(tx, ty, 2.5, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.shadowBlur = 0;
    ctx.restore();
  };

  const drawCityBuilding = (ctx: CanvasRenderingContext2D, c: City, index: number) => {
    if (c.isDestroyed) {
      ctx.fillStyle = '#18181b';
      ctx.beginPath();
      ctx.ellipse(c.x, c.y, 25, 5, 0, 0, Math.PI * 2);
      ctx.fill();
      return;
    }
    ctx.save();
    ctx.translate(c.x, c.y);
    const styles = [
      () => {
        ctx.fillStyle = '#78350f';
        ctx.fillRect(-15, -40, 30, 40);
        ctx.fillStyle = '#bae6fd';
        for (let i = 0; i < 3; i++) {
          for (let j = 0; j < 4; j++) {
            ctx.fillRect(-10 + i * 8, -35 + j * 8, 4, 4);
          }
        }
      },
      () => {
        ctx.fillStyle = '#991b1b';
        ctx.fillRect(-15, -30, 30, 30);
        ctx.beginPath();
        ctx.moveTo(-18, -30);
        ctx.lineTo(0, -45);
        ctx.lineTo(18, -30);
        ctx.closePath();
        ctx.fillStyle = '#450a0a';
        ctx.fill();
        ctx.fillStyle = '#fef08a';
        ctx.fillRect(-5, -15, 10, 15);
      },
      () => {
        ctx.fillStyle = '#1e3a8a';
        ctx.fillRect(-10, -60, 20, 60);
        ctx.fillStyle = '#60a5fa';
        for (let j = 0; j < 8; j++) {
          ctx.fillRect(-6, -55 + j * 6, 12, 2);
        }
      },
      () => {
        ctx.fillStyle = '#065f46';
        ctx.beginPath();
        ctx.moveTo(-15, 0);
        ctx.lineTo(15, 0);
        ctx.lineTo(15, -40);
        ctx.lineTo(-15, -55);
        ctx.closePath();
        ctx.fill();
      },
      () => {
        ctx.fillStyle = '#57534e';
        ctx.fillRect(-20, -35, 40, 35);
        ctx.fillStyle = '#fbbf24';
        for (let i = 0; i < 4; i++) {
          ctx.fillRect(-15 + i * 8, -25, 4, 4);
          ctx.fillRect(-15 + i * 8, -15, 4, 4);
        }
      },
      () => {
        ctx.fillStyle = '#854d0e';
        ctx.fillRect(-12, -50, 24, 50);
        ctx.fillRect(-4, -70, 8, 20);
        ctx.strokeStyle = '#854d0e';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(0, -70);
        ctx.lineTo(0, -90);
        ctx.stroke();
      }
    ];
    styles[index % styles.length]();
    ctx.restore();
  };

  useEffect(() => {
    if (status !== GameStatus.PLAYING) return;

    let animationId: number;
    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx) return;

    const loop = () => {
      const { width, height } = stateRef.current;
      const now = Date.now();
      const elapsed = (now - stateRef.current.levelStartTime) / 1000;
      const remainingTime = Math.max(0, GAME_CONFIG.LEVEL_DURATION_SEC - elapsed);
      setTimeLeft(Math.floor(remainingTime));

      // 1. Update State
      // Spawn Rockets based on remaining time and count
      if (stateRef.current.rocketsToSpawn > 0 && remainingTime > 0) {
        // progress within the level (0 to 1)
        const progress = elapsed / GAME_CONFIG.LEVEL_DURATION_SEC;
        // base rate to distribute remaining rockets over remaining frames (approx 60fps)
        const baseRate = stateRef.current.rocketsToSpawn / (remainingTime * 60);
        // weight increases from 0.4 to 1.6 to create a "gradual increase" feel
        const weight = 0.4 + (progress * 1.2);
        const expectedSpawnRate = baseRate * weight;

        if (Math.random() < expectedSpawnRate) {
          const targets = [
            ...stateRef.current.cities.filter(c => !c.isDestroyed),
            ...stateRef.current.batteries.filter(b => !b.isDestroyed)
          ];
          if (targets.length > 0) {
            const target = targets[Math.floor(Math.random() * targets.length)];
            stateRef.current.rockets.push({
              id: Math.random().toString(36).substr(2, 9),
              x: Math.random() * width,
              y: 0,
              targetX: target.x,
              targetY: target.y,
              speed: GAME_CONFIG.ROCKET_SPEED_MIN + Math.random() * (GAME_CONFIG.ROCKET_SPEED_MAX - GAME_CONFIG.ROCKET_SPEED_MIN),
              progress: 0,
              isDestroyed: false,
            });
            stateRef.current.rocketsToSpawn--;
          }
        }
      }

      stateRef.current.rockets.forEach(r => {
        const dx = r.targetX - r.x;
        const dy = r.targetY - r.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < r.speed) {
          r.isDestroyed = true;
          stateRef.current.cities.forEach(c => {
            if (Math.abs(c.x - r.targetX) < 15 && Math.abs(c.y - r.targetY) < 15) c.isDestroyed = true;
          });
          stateRef.current.batteries.forEach(b => {
            if (!b.isDestroyed && Math.abs(b.x - r.targetX) < 20 && Math.abs(b.y - r.targetY) < 20) {
              b.health--;
              if (b.health <= 0) {
                b.health = 0;
                b.isDestroyed = true;
              }
              setUiBatteries([...stateRef.current.batteries]);
            }
          });
          playExplosionSound(audioCtxRef.current);
          stateRef.current.explosions.push({
            id: r.id, x: r.x, y: r.y, radius: 2, maxRadius: GAME_CONFIG.EXPLOSION_MAX_RADIUS, growthRate: GAME_CONFIG.EXPLOSION_GROWTH_RATE, isFinished: false, phase: 'growing'
          });
        } else {
          r.x += (dx / dist) * r.speed;
          r.y += (dy / dist) * r.speed;
        }
      });

      stateRef.current.interceptors.forEach(i => {
        i.x += i.vx;
        i.y += i.vy;

        // Check proximity with rockets
        stateRef.current.rockets.forEach(r => {
          if (!r.isDestroyed) {
            const rDist = Math.sqrt(Math.pow(r.x - i.x, 2) + Math.pow(r.y - i.y, 2));
            // Trigger explosion if within 3x rocket radius
            if (rDist < GAME_CONFIG.ROCKET_BASE_RADIUS * 3) {
              i.isExploded = true;
              r.isDestroyed = true;
              playExplosionSound(audioCtxRef.current);
              stateRef.current.explosions.push({
                id: i.id, 
                x: i.x, 
                y: i.y, 
                radius: 2, 
                maxRadius: GAME_CONFIG.EXPLOSION_MAX_RADIUS * GAME_CONFIG.COLLISION_EXPLOSION_MULTIPLIER, 
                growthRate: GAME_CONFIG.EXPLOSION_GROWTH_RATE * 2, 
                isFinished: false, 
                phase: 'growing'
              });
              setScore(s => s + GAME_CONFIG.POINTS_PER_ROCKET);
            }
          }
        });

        // Remove if off screen
        if (i.x < -50 || i.x > width + 50 || i.y < -50 || i.y > height + 50) {
          i.isExploded = true; // Mark for removal
        }
      });

      stateRef.current.explosions.forEach(e => {
        if (e.phase === 'growing') {
          e.radius += e.growthRate;
          if (e.radius >= e.maxRadius) e.phase = 'shrinking';
        } else {
          e.radius -= e.growthRate * 0.5;
          if (e.radius <= 0) e.isFinished = true;
        }
        stateRef.current.rockets.forEach(r => {
          if (!r.isDestroyed) {
            const dist = Math.sqrt(Math.pow(r.x - e.x, 2) + Math.pow(r.y - e.y, 2));
            if (dist < e.radius) {
              r.isDestroyed = true;
              setScore(prev => prev + GAME_CONFIG.POINTS_PER_ROCKET);
            }
          }
        });
      });

      stateRef.current.rockets = stateRef.current.rockets.filter(r => !r.isDestroyed);
      stateRef.current.interceptors = stateRef.current.interceptors.filter(i => !i.isExploded);
      stateRef.current.explosions = stateRef.current.explosions.filter(e => !e.isFinished);

      // Check Win/Loss
      if (stateRef.current.cities.every(c => c.isDestroyed)) {
        setStatus(GameStatus.LOST);
      } else if (stateRef.current.rocketsToSpawn === 0 && stateRef.current.rockets.length === 0) {
        setStatus(GameStatus.LEVEL_COMPLETE);
      }

      // 2. Render
      ctx.clearRect(0, 0, width, height);
      const skyGrad = ctx.createLinearGradient(0, 0, 0, height);
      skyGrad.addColorStop(0, '#020617');
      skyGrad.addColorStop(0.7, '#0f172a');
      skyGrad.addColorStop(1, '#1e1b4b');
      ctx.fillStyle = skyGrad;
      ctx.fillRect(0, 0, width, height);
      ctx.fillStyle = '#ffffff';
      stateRef.current.stars.forEach(s => {
        ctx.globalAlpha = 0.5 + Math.random() * 0.5;
        ctx.fillRect(s.x, s.y, s.size, s.size);
      });
      ctx.globalAlpha = 1;
      ctx.fillStyle = '#020617';
      stateRef.current.silhouette.forEach(s => {
        ctx.fillRect(s.x, s.y - s.h, s.w, s.h);
      });
      ctx.fillStyle = '#09090b';
      ctx.fillRect(0, height - 20, width, 20);
      stateRef.current.cities.forEach((c, i) => drawCityBuilding(ctx, c, i));
      stateRef.current.batteries.forEach(b => drawBattery(ctx, b));
      stateRef.current.rockets.forEach(r => {
        const angle = Math.atan2(r.targetY - r.y, r.targetX - r.x);
        drawMissile(ctx, r.x, r.y, angle, '#ef4444', 2.4);
        ctx.strokeStyle = 'rgba(239, 68, 68, 0.3)';
        ctx.beginPath();
        ctx.moveTo(r.x, r.y);
        ctx.lineTo(r.x - Math.cos(angle) * 20, r.y - Math.sin(angle) * 20);
        ctx.stroke();
      });
      stateRef.current.interceptors.forEach(i => {
        const angle = Math.atan2(i.vy, i.vx);
        drawMissile(ctx, i.x, i.y, angle, '#fbbf24', 1);
        ctx.strokeStyle = 'rgba(251, 191, 36, 0.5)';
        ctx.setLineDash([2, 2]);
        ctx.beginPath();
        ctx.moveTo(i.startX, i.startY);
        ctx.lineTo(i.x, i.y);
        ctx.stroke();
        ctx.setLineDash([]);
      });
      stateRef.current.explosions.forEach(e => {
        const grad = ctx.createRadialGradient(e.x, e.y, 0, e.x, e.y, e.radius);
        grad.addColorStop(0, '#ffffff');
        grad.addColorStop(0.3, '#fbbf24');
        grad.addColorStop(0.7, '#ef4444');
        grad.addColorStop(1, 'transparent');
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(e.x, e.y, e.radius, 0, Math.PI * 2);
        ctx.fill();
      });
      animationId = requestAnimationFrame(loop);
    };
    animationId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animationId);
  }, [status, level]);

  return (
    <div className="relative w-full h-screen bg-zinc-950 overflow-hidden font-sans">
      <div className="scanline" />
      <div className="absolute inset-0 pointer-events-none opacity-20" 
           style={{ backgroundImage: 'radial-gradient(circle at 2px 2px, rgba(255,255,255,0.05) 1px, transparent 0)', backgroundSize: '40px 40px' }} />
      
      <canvas 
        ref={canvasRef}
        className="game-canvas w-full h-full cursor-crosshair"
        onClick={handleCanvasClick}
        onTouchStart={handleCanvasClick}
      />

      {/* HUD */}
      <div className="absolute top-0 left-0 w-full p-6 flex justify-between items-start pointer-events-none">
        <div className="flex flex-col gap-3">
          <div className="glass-panel p-4 rounded-2xl neon-border min-w-[160px]">
            <div className="text-[10px] uppercase tracking-[0.2em] text-emerald-500/70 font-bold mb-1 font-display">Tactical Score</div>
            <div className="text-3xl font-display font-medium text-white tabular-nums tracking-tight">{score.toLocaleString()}</div>
          </div>
          <div className="glass-panel px-4 py-2 rounded-xl flex items-center gap-3 border-emerald-500/20">
            <Target className="w-4 h-4 text-emerald-400" />
            <div className="text-xs font-mono text-zinc-400 uppercase tracking-wider">
              {t.level} <span className="text-white font-bold">{level}</span> | {t.rocketsLeft} <span className="text-white font-bold">{stateRef.current.rocketsToSpawn + stateRef.current.rockets.length}</span>
            </div>
          </div>
        </div>

        <div className="flex flex-col items-end gap-3">
          <div className="glass-panel p-4 rounded-2xl min-w-[120px] text-center border-white/5">
            <div className="text-[10px] uppercase tracking-[0.2em] text-zinc-500 font-bold mb-1 font-display">Operation Time</div>
            <div className={`text-3xl font-display font-medium tabular-nums ${timeLeft < 10 ? 'text-red-500 animate-pulse' : 'text-white'}`}>
              {Math.floor(timeLeft / 60)}:{(timeLeft % 60).toString().padStart(2, '0')}
            </div>
          </div>
          <button 
            onClick={() => setLang(l => l === 'en' ? 'cn' : 'en')}
            className="pointer-events-auto glass-panel hover:bg-white/10 p-3 rounded-full transition-all active:scale-90"
          >
            <Languages className="w-5 h-5 text-zinc-300" />
          </button>
        </div>
      </div>

      {/* Ammo & Health HUD Bottom */}
      <div className="absolute bottom-12 left-0 w-full px-12 flex justify-between pointer-events-none">
        {uiBatteries.map((b) => (
          <div key={b.id} className="flex flex-col items-center gap-3">
            {/* Health Bar */}
            <div className="flex gap-1.5">
              {Array.from({ length: b.maxHealth }).map((_, i) => (
                <div 
                  key={i} 
                  className={`w-4 h-1.5 rounded-full border border-white/10 transition-all duration-500 ${i < b.health ? 'bg-emerald-400 shadow-[0_0_12px_rgba(52,211,153,0.4)]' : 'bg-zinc-800'}`}
                />
              ))}
            </div>
            {/* Ammo Bar */}
            <div className="flex flex-col items-center gap-1.5">
              <div className="h-2 w-24 rounded-full bg-zinc-900/80 overflow-hidden border border-white/10 p-[1px]">
                <motion.div 
                  className={`h-full rounded-full ${b.isDestroyed ? 'bg-zinc-800' : 'bg-gradient-to-r from-emerald-600 to-emerald-400'}`}
                  initial={{ width: '100%' }}
                  animate={{ width: `${(b.ammo / b.maxAmmo) * 100}%` }}
                  transition={{ type: 'spring', stiffness: 50 }}
                />
              </div>
              <div className="text-[9px] font-mono text-zinc-500 uppercase tracking-[0.15em] font-bold">{t.ammo} {b.ammo}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Overlays */}
      <AnimatePresence>
        {status === GameStatus.START && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-zinc-950 flex items-center justify-center p-6 z-50 overflow-hidden"
          >
            {/* Start Screen Background - Detailed City */}
            <div className="absolute inset-0 pointer-events-none">
              {/* Background Image Layer for HD feel */}
              <img 
                src="https://images.unsplash.com/photo-1477959858617-67f85cf4f1df?auto=format&fit=crop&w=1920&q=80" 
                alt="City Night"
                className="absolute inset-0 w-full h-full object-cover opacity-40 mix-blend-screen"
                referrerPolicy="no-referrer"
              />
              
              <div className="absolute bottom-0 w-full h-[60vh] bg-gradient-to-t from-zinc-950 via-zinc-950/40 to-transparent z-10" />
              
              {/* Detailed Silhouette with Windows */}
              <div className="absolute bottom-0 left-0 w-full h-[45vh] flex items-end justify-between px-0 overflow-hidden">
                {[...Array(15)].map((_, i) => {
                  const h = 30 + Math.random() * 60;
                  const w = 5 + Math.random() * 8;
                  return (
                    <div 
                      key={i} 
                      className="relative bg-zinc-800 border-x border-white/10 flex flex-col gap-1 p-2 pt-4 shadow-[0_-10px_30px_rgba(0,0,0,0.5)]"
                      style={{ width: `${w}%`, height: `${h}%` }}
                    >
                      {/* Antennae */}
                      {Math.random() > 0.5 && (
                        <div className="absolute top-[-20px] left-1/2 -translate-x-1/2 w-px h-5 bg-zinc-600">
                          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-1.5 h-1.5 bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.8)] animate-pulse rounded-full" />
                        </div>
                      )}
                      
                      {/* Windows */}
                      <div className="grid grid-cols-2 gap-1 opacity-50">
                        {[...Array(Math.floor(h / 5))].map((_, j) => (
                          <div 
                            key={j} 
                            className={`h-1 rounded-sm ${Math.random() > 0.6 ? 'bg-yellow-100 shadow-[0_0_8px_rgba(254,240,138,0.6)]' : 'bg-zinc-700'}`} 
                          />
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* UFOs */}
            <UFO size={220} top="15%" left="10%" delay={0.5} />
            <UFO size={80} top="10%" left="70%" delay={1.2} />
            <UFO size={50} top="30%" left="80%" delay={1.8} />

            <div className="max-w-2xl w-full text-center space-y-12 z-20">
              <motion.div
                initial={{ y: 40, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ duration: 0.8, ease: "easeOut" }}
                className="space-y-4"
              >
                <h1 className="text-6xl md:text-8xl font-display font-black text-white tracking-tighter leading-none">
                  TINA<span className="text-emerald-500">NOVA</span><br/>
                  <span className="text-zinc-600">DEFENSE</span>
                </h1>
                <div className="h-px w-24 bg-emerald-500 mx-auto my-8" />
                <p className="text-zinc-400 font-display text-sm tracking-[0.3em] uppercase max-w-md mx-auto leading-relaxed">
                  {t.instructions}
                </p>
              </motion.div>
              <motion.button
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ delay: 0.4 }}
                whileHover={{ scale: 1.05, boxShadow: '0 0 30px rgba(16,185,129,0.2)' }}
                whileTap={{ scale: 0.95 }}
                onClick={startGame}
                className="group relative inline-flex items-center gap-4 bg-emerald-500 text-black px-12 py-5 rounded-full font-bold text-xl overflow-hidden transition-all font-display"
              >
                <Play className="w-6 h-6 fill-current" />
                <span className="tracking-tight">{t.start}</span>
              </motion.button>
            </div>
          </motion.div>
        )}

        {(status === GameStatus.WON || status === GameStatus.LOST || status === GameStatus.LEVEL_COMPLETE) && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="absolute inset-0 bg-black/90 backdrop-blur-2xl flex items-center justify-center p-6 z-50"
          >
            <div className="max-w-md w-full glass-panel p-10 rounded-[2.5rem] text-center space-y-8 shadow-2xl border-white/10">
              <motion.div 
                initial={{ scale: 0, rotate: -180 }}
                animate={{ scale: 1, rotate: 0 }}
                className={`w-24 h-24 mx-auto rounded-3xl flex items-center justify-center rotate-12 ${status !== GameStatus.LOST ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-red-500/20 text-red-400 border border-red-500/30'}`}
              >
                {status !== GameStatus.LOST ? <Trophy className="w-12 h-12" /> : <Shield className="w-12 h-12" />}
              </motion.div>
              <div className="space-y-3">
                <h2 className="text-4xl font-display font-bold text-white tracking-tight">
                  {status === GameStatus.LEVEL_COMPLETE ? t.levelComplete : (status === GameStatus.WON ? t.win : t.loss)}
                </h2>
                <p className="text-zinc-400 text-base font-display">{status !== GameStatus.LOST ? t.winMsg : t.lossMsg}</p>
              </div>
              <div className="bg-white/5 p-6 rounded-3xl border border-white/5">
                <div className="text-[11px] uppercase tracking-[0.2em] text-zinc-500 font-bold mb-2 font-display">Final Score</div>
                <div className="text-5xl font-display font-bold text-white tabular-nums">{score.toLocaleString()}</div>
              </div>
              <div className="flex flex-col gap-4">
                {status === GameStatus.LEVEL_COMPLETE && (
                  <button
                    onClick={handleNextLevel}
                    className="w-full flex items-center justify-center gap-3 bg-emerald-500 text-black py-5 rounded-2xl font-bold text-lg hover:bg-emerald-400 transition-all font-display shadow-lg shadow-emerald-500/20"
                  >
                    <Play className="w-6 h-6 fill-current" />
                    {t.nextLevel}
                  </button>
                )}
                <button
                  onClick={startGame}
                  className="w-full flex items-center justify-center gap-3 bg-white text-black py-5 rounded-2xl font-bold text-lg hover:bg-zinc-200 transition-all font-display"
                >
                  <RotateCcw className="w-6 h-6" />
                  {t.restart}
                </button>
                <button
                  onClick={endGame}
                  className="w-full flex items-center justify-center gap-3 bg-zinc-900 text-white py-5 rounded-2xl font-bold text-lg hover:bg-zinc-800 transition-all font-display border border-white/5"
                >
                  <RotateCcw className="w-6 h-6" />
                  {t.endGame}
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
