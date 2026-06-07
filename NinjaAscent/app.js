/* ==========================================================================
   NinjaAscent - Game Engine & Logic Script
   ========================================================================== */

// --------------------------------------------------------------------------
// 1. DOM Elements & State Management
// --------------------------------------------------------------------------
const canvas = document.getElementById('game-canvas');
const ctx = canvas.getContext('2d');

const scoreVal = document.getElementById('score-val');
const hudShieldPanel = document.getElementById('hud-shield-panel');
const shieldStatusVal = document.getElementById('shield-status-val');
const btnStartHeader = document.getElementById('btn-start');
const btnStartOverlay = document.getElementById('btn-start-overlay');
const btnRestart = document.getElementById('btn-restart');
const btnSubmitScore = document.getElementById('btn-submit-score');
const btnViewRanking = document.getElementById('btn-view-ranking');
const btnCloseModal = document.getElementById('btn-close-modal');

const overlayStart = document.getElementById('overlay-start');
const overlayGameOver = document.getElementById('overlay-gameover');
const modalRanking = document.getElementById('modal-ranking');
const toastWarning = document.getElementById('toast-warning');
const audioWarmupToast = document.getElementById('audio-warmup-toast');

const finalScoreVal = document.getElementById('final-score-val');
const playerNameInput = document.getElementById('player-name');
const submissionError = document.getElementById('submission-error');
const leaderboardBody = document.getElementById('leaderboard-body');
const modalLeaderboardBody = document.getElementById('modal-leaderboard-body');
const statusDot = document.querySelector('.status-indicator-dot');

// Game Engine State Variables
let gameState = 'START'; // 'START' | 'PLAYING' | 'GAMEOVER'
let heightScore = 0;
let scrollSpeed = 220; // base pixels per second
let speedMultiplier = 1.0;
let lastTime = 0;
let speedIncreaseTimer = 0;
let spawnTimer = 0;
let spawnInterval = 1500; // ms between spawns

// Left & Right Wall Boundaries
const wallWidth = 50;
const playAreaLeft = wallWidth;
const playAreaRight = 800 - wallWidth;
let currentLeftWall = playAreaLeft;
let currentRightWall = playAreaRight;

// Entities Pools
let obstacles = [];
let items = [];
let particles = [];
let wallDecos = []; // scrolling notches/lines on the walls

// Player object
const player = {
  x: playAreaLeft + 16,
  y: 500, // fixed Y height
  width: 30,
  height: 44,
  state: 'RUNNING', // 'RUNNING' | 'JUMPING'
  side: 'LEFT', // 'LEFT' | 'RIGHT'
  vx: 0,
  targetSide: 'LEFT',
  hasShield: false,
  runCycle: 0, // animation loop variable
  spinRotation: 0, // rotation for jumping spin-dash
  invulnerableTime: 0, // invulnerable after shield break
  airReversals: 0
};

// Web Audio API Synthesis
let audioCtx = null;

// Initialize wall notches for visual movement
function initWallDecos() {
  wallDecos = [];
  for (let y = -50; y < 900; y += 80) {
    wallDecos.push({
      y: y,
      length: 25
    });
  }
}

// --------------------------------------------------------------------------
// 2. Web Audio API Sound Effects Synthesizer
// --------------------------------------------------------------------------
function initAudio() {
  if (audioCtx) return;
  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  if (AudioContextClass) {
    audioCtx = new AudioContextClass();
    
    audioWarmupToast.classList.remove('hidden');
    setTimeout(() => {
      audioWarmupToast.classList.add('hidden');
    }, 1800);
  }
}

function playJumpSound() {
  if (!audioCtx) return;
  if (audioCtx.state === 'suspended') audioCtx.resume();
  try {
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(300, audioCtx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(1200, audioCtx.currentTime + 0.15);
    
    gain.gain.setValueAtTime(0.15, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.15);
    
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    
    osc.start();
    osc.stop(audioCtx.currentTime + 0.15);
  } catch (e) {}
}

function playLandingSound() {
  if (!audioCtx) return;
  if (audioCtx.state === 'suspended') audioCtx.resume();
  try {
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    
    osc.type = 'sine';
    osc.frequency.setValueAtTime(180, audioCtx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(50, audioCtx.currentTime + 0.08);
    
    gain.gain.setValueAtTime(0.12, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.08);
    
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    
    osc.start();
    osc.stop(audioCtx.currentTime + 0.08);
  } catch (e) {}
}

function playShieldCollectSound() {
  if (!audioCtx) return;
  if (audioCtx.state === 'suspended') audioCtx.resume();
  try {
    const osc1 = audioCtx.createOscillator();
    const osc2 = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(520, audioCtx.currentTime);
    osc1.frequency.setValueAtTime(780, audioCtx.currentTime + 0.08);
    osc1.frequency.setValueAtTime(1040, audioCtx.currentTime + 0.16);

    osc2.type = 'triangle';
    osc2.frequency.setValueAtTime(260, audioCtx.currentTime);
    osc2.frequency.setValueAtTime(390, audioCtx.currentTime + 0.08);
    osc2.frequency.setValueAtTime(520, audioCtx.currentTime + 0.16);
    
    gain.gain.setValueAtTime(0.18, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.005, audioCtx.currentTime + 0.3);
    
    osc1.connect(gain);
    osc2.connect(gain);
    gain.connect(audioCtx.destination);
    
    osc1.start();
    osc2.start();
    osc1.stop(audioCtx.currentTime + 0.3);
    osc2.stop(audioCtx.currentTime + 0.3);
  } catch (e) {}
}

function playShieldBreakSound() {
  if (!audioCtx) return;
  if (audioCtx.state === 'suspended') audioCtx.resume();
  try {
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(1200, audioCtx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(150, audioCtx.currentTime + 0.25);
    
    gain.gain.setValueAtTime(0.2, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.25);
    
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    
    osc.start();
    osc.stop(audioCtx.currentTime + 0.25);
  } catch (e) {}
}

function playExplosionSound() {
  if (!audioCtx) return;
  if (audioCtx.state === 'suspended') audioCtx.resume();
  try {
    const bufferSize = audioCtx.sampleRate * 0.5;
    const buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    
    const noiseSource = audioCtx.createBufferSource();
    noiseSource.buffer = buffer;
    
    const filter = audioCtx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(300, audioCtx.currentTime);
    filter.frequency.exponentialRampToValueAtTime(10, audioCtx.currentTime + 0.45);
    
    const gain = audioCtx.createGain();
    gain.gain.setValueAtTime(0.4, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.005, audioCtx.currentTime + 0.48);
    
    noiseSource.connect(filter);
    filter.connect(gain);
    gain.connect(audioCtx.destination);
    
    noiseSource.start();
  } catch (e) {}
}

// --------------------------------------------------------------------------
// 3. Spawning System & Obstacle Physics
// --------------------------------------------------------------------------
function spawnEntity() {
  // 12% chance of spawning shield item if player doesn't already have one
  if (Math.random() < 0.15 && !player.hasShield && items.length === 0) {
    spawnShield();
  } else {
    spawnObstacle();
  }
}

function spawnShield() {
  // Shields can spawn on left wall, right wall, or right in the middle (air)
  const spawnTypes = ['LEFT', 'RIGHT', 'CENTER'];
  const type = spawnTypes[Math.floor(Math.random() * spawnTypes.length)];
  let xVal = 400; // CENTER default
  
  if (type === 'LEFT') {
    xVal = currentLeftWall + 40; // slightly off the wall
  } else if (type === 'RIGHT') {
    xVal = currentRightWall - 40;
  } else {
    xVal = 400; // middle
  }

  items.push({
    x: xVal,
    y: -40,
    width: 32,
    height: 32,
    pulseTime: 0,
    rotation: 0
  });
}

function spawnObstacle() {
  const side = Math.random() > 0.5 ? 'LEFT' : 'RIGHT';
  const obstacleTypes = ['SHURIKEN', 'THORN', 'TRAP', 'PLANK'];
  const type = obstacleTypes[Math.floor(Math.random() * obstacleTypes.length)];
  
  let obs = {
    type: type,
    side: side,
    y: -80,
    width: 0,
    height: 0,
    rotation: 0,
    rotationSpeed: Math.random() * 4 + 3 // rads per sec (only for shuriken)
  };

  // Configure sizes & starting coordinates
  switch (type) {
    case 'SHURIKEN':
      obs.width = 40;
      obs.height = 40;
      obs.x = (side === 'LEFT') ? currentLeftWall + 25 : currentRightWall - 25;
      break;
    case 'THORN':
      obs.width = 50;
      obs.height = 70;
      obs.x = (side === 'LEFT') ? currentLeftWall : currentRightWall - 50;
      break;
    case 'TRAP':
      obs.width = 44;
      obs.height = 30;
      obs.x = (side === 'LEFT') ? currentLeftWall : currentRightWall - 44;
      break;
    case 'PLANK':
      obs.width = 52;
      obs.height = 25;
      obs.x = (side === 'LEFT') ? currentLeftWall : currentRightWall - 52;
      break;
  }

  obstacles.push(obs);
}

function createParticles(x, y, color, count = 10) {
  for (let i = 0; i < count; i++) {
    const angle = Math.random() * Math.PI * 2;
    const speed = Math.random() * 3 + 1.5;
    particles.push({
      x: x,
      y: y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      size: Math.random() * 4 + 2,
      color: color,
      alpha: 1.0,
      decay: Math.random() * 0.03 + 0.015
    });
  }
}

// --------------------------------------------------------------------------
// 4. Input & Controls (Jump / Mid-Air Reversal)
// --------------------------------------------------------------------------
function handleInput() {
  if (gameState !== 'PLAYING') return;
  initAudio();
  
  const vJump = 950; // Jump speed (pixels/sec)
  
  if (player.state === 'RUNNING') {
    // Normal Jump
    player.state = 'JUMPING';
    player.airReversals = 0; // reset air reversals counter on new jump
    if (player.side === 'LEFT') {
      player.vx = vJump;
      player.targetSide = 'RIGHT';
    } else {
      player.vx = -vJump;
      player.targetSide = 'LEFT';
    }
    playJumpSound();
  } else if (player.state === 'JUMPING') {
    // Mid-air click reversal! Max 2 times
    if (player.airReversals < 2) {
      player.airReversals++;
      if (player.targetSide === 'RIGHT') {
        player.vx = -vJump;
        player.targetSide = 'LEFT';
      } else {
        player.vx = vJump;
        player.targetSide = 'RIGHT';
      }
      playJumpSound();
      createParticles(player.x, player.y, '#00f0ff', 6); // visual feedback on double click
    }
  }
}

// Attach input triggers (canvas click, whole screen touch, spacebar key)
canvas.addEventListener('mousedown', (e) => {
  e.preventDefault();
  handleInput();
});

window.addEventListener('keydown', (e) => {
  if (e.key === ' ' || e.key === 'Spacebar') {
    e.preventDefault();
    handleInput();
  }
});

// --------------------------------------------------------------------------
// 5. Game Core Loop (update & render)
// --------------------------------------------------------------------------
function update(dt) {
  if (gameState !== 'PLAYING') return;

  const currentScrollSpeed = scrollSpeed * speedMultiplier;

  // Invulnerability ticking
  if (player.invulnerableTime > 0) {
    player.invulnerableTime -= dt;
  }

  // Dynamic Corridor Narrowing: narrow by 20px on both sides every 1000m (limit to keep at least 300px corridor width)
  const targetLeftWall = Math.min(250, playAreaLeft + Math.floor(heightScore / 1000) * 20);
  const targetRightWall = Math.max(550, playAreaRight - Math.floor(heightScore / 1000) * 20);
  
  // Smoothly glide the walls to the target positions
  currentLeftWall += (targetLeftWall - currentLeftWall) * 2 * (dt / 1000);
  currentRightWall += (targetRightWall - currentRightWall) * 2 * (dt / 1000);

  // 1. Difficulty progression
  speedIncreaseTimer += dt;
  if (speedIncreaseTimer >= 10000) {
    speedIncreaseTimer = 0;
    speedMultiplier += 0.15;
    spawnInterval = Math.max(500, spawnInterval - 80); // speed up to min of 500ms
    triggerDifficultyAlert();
  }

  // 2. Score climbing
  heightScore += (currentScrollSpeed * (dt / 1000)) * 0.15; // metric height
  updateHUD();

  // 3. Entity spawning
  spawnTimer += dt;
  if (spawnTimer >= spawnInterval) {
    spawnTimer = 0;
    spawnEntity();
  }

  // 4. Update Wall decos (scrolling visual grid notches)
  wallDecos.forEach(deco => {
    deco.y += currentScrollSpeed * (dt / 1000);
  });
  // Wrap deco line arrays
  wallDecos.forEach(deco => {
    if (deco.y > 850) {
      deco.y = -50;
    }
  });

  // 5. Update Player physics
  if (player.state === 'JUMPING') {
    player.x += player.vx * (dt / 1000);
    player.spinRotation += 12 * (dt / 1000); // spin animation

    // Boundary landing tests (using dynamic wall positions)
    if (player.targetSide === 'RIGHT' && player.x >= currentRightWall - 16) {
      player.x = currentRightWall - 16;
      player.vx = 0;
      player.side = 'RIGHT';
      player.state = 'RUNNING';
      playLandingSound();
      createParticles(player.x, player.y, '#ff007f', 5);
    } else if (player.targetSide === 'LEFT' && player.x <= currentLeftWall + 16) {
      player.x = currentLeftWall + 16;
      player.vx = 0;
      player.side = 'LEFT';
      player.state = 'RUNNING';
      playLandingSound();
      createParticles(player.x, player.y, '#ff007f', 5);
    }
  } else {
    // RUNNING: Lock player X to the dynamic wall boundary
    if (player.side === 'LEFT') {
      player.x = currentLeftWall + 16;
    } else {
      player.x = currentRightWall - 16;
    }
    // RUNNING animation ticker
    player.runCycle += 15 * (dt / 1000);
  }

  // 6. Update Items (Shield)
  for (let i = items.length - 1; i >= 0; i--) {
    const item = items[i];
    item.y += currentScrollSpeed * (dt / 1000);
    item.pulseTime += 5 * (dt / 1000);
    item.rotation += 2 * (dt / 1000);

    // Collision check with player
    const dist = Math.hypot(player.x - item.x, player.y - item.y);
    if (dist < 32) {
      // Collect shield
      player.hasShield = true;
      hudShieldPanel.classList.add('active');
      shieldStatusVal.innerText = 'ACTIVE';
      playShieldCollectSound();
      createParticles(item.x, item.y, '#00f0ff', 18);
      items.splice(i, 1);
      continue;
    }

    // Cull offscreen
    if (item.y > 850) {
      items.splice(i, 1);
    }
  }

  // 7. Update Obstacles
  for (let i = obstacles.length - 1; i >= 0; i--) {
    const obs = obstacles[i];
    obs.y += currentScrollSpeed * (dt / 1000);

    if (obs.type === 'SHURIKEN') {
      obs.rotation += obs.rotationSpeed * (dt / 1000);
    }

    // Collision Check (AABB with buffer margins)
    let pLeft = player.x - 12;
    let pRight = player.x + 12;
    let pTop = player.y - 18;
    let pBottom = player.y + 18;

    let oLeft, oRight, oTop, oBottom;

    if (obs.type === 'SHURIKEN') {
      oLeft = obs.x - obs.width / 2;
      oRight = obs.x + obs.width / 2;
      oTop = obs.y - obs.height / 2;
      oBottom = obs.y + obs.height / 2;
    } else {
      oLeft = obs.x;
      oRight = obs.x + obs.width;
      oTop = obs.y;
      oBottom = obs.y + obs.height;
    }

    // Check overlap
    if (pRight > oLeft && pLeft < oRight && pBottom > oTop && pTop < oBottom) {
      // Hit!
      if (player.invulnerableTime <= 0) {
        if (player.hasShield) {
          // Consume Shield
          player.hasShield = false;
          hudShieldPanel.classList.remove('active');
          shieldStatusVal.innerText = 'READY';
          player.invulnerableTime = 1000; // 1 second invulnerability
          playShieldBreakSound();
          createParticles(player.x, player.y, '#00f0ff', 25);
          // Destroy obstacle
          obstacles.splice(i, 1);
        } else {
          // Game Over
          triggerGameOver();
          return;
        }
        continue;
      }
    }

    // Cull offscreen
    if (obs.y > 850) {
      obstacles.splice(i, 1);
    }
  }

  // 8. Update Particles
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.x += p.vx;
    p.y += p.vy;
    p.alpha -= p.decay;
    if (p.alpha <= 0) {
      particles.splice(i, 1);
    }
  }
}

// --------------------------------------------------------------------------
// Vector Artwork Render Functions
// --------------------------------------------------------------------------
function drawNinja(ctx, x, y, isJumping, side, scaleDirection, cycle) {
  ctx.save();
  ctx.translate(x, y);

  if (isJumping) {
    // Spin Dash rotating circle
    ctx.rotate(player.spinRotation);
    
    // Draw outer neon spinning trails
    ctx.strokeStyle = 'rgba(255, 0, 127, 0.4)';
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.arc(0, 0, 20, 0, Math.PI * 2);
    ctx.stroke();

    ctx.strokeStyle = 'var(--neon-purple)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(0, 0, 16, 0, Math.PI * 2);
    ctx.stroke();

    // Hot neon pink core
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(0, 0, 8, 0, Math.PI * 2);
    ctx.fill();
  } else {
    // Running ninja stick-art
    ctx.scale(scaleDirection, 1);

    // Dynamic angles based on running stride cycle
    const armAngle = Math.sin(cycle) * 0.6;
    const legAngle1 = Math.cos(cycle) * 0.7;
    const legAngle2 = -Math.cos(cycle) * 0.7;

    // Glowing Neon Theme Styles
    ctx.shadowBlur = 8;
    ctx.shadowColor = 'var(--neon-purple)';
    ctx.strokeStyle = 'var(--neon-purple)';
    ctx.lineWidth = 4;
    ctx.lineCap = 'round';

    // 1. Draw Torso
    ctx.beginPath();
    ctx.moveTo(0, 8);
    ctx.lineTo(0, -12);
    ctx.stroke();

    // 2. Draw Legs
    // Front Leg (bent)
    ctx.beginPath();
    ctx.moveTo(0, 8);
    ctx.lineTo(10 * Math.sin(legAngle1), 16 + 4 * Math.cos(legAngle1));
    ctx.lineTo(10 * Math.sin(legAngle1) + 4, 24);
    ctx.stroke();

    // Back Leg
    ctx.beginPath();
    ctx.moveTo(0, 8);
    ctx.lineTo(10 * Math.sin(legAngle2), 16 + 4 * Math.cos(legAngle2));
    ctx.lineTo(10 * Math.sin(legAngle2) - 4, 24);
    ctx.stroke();

    // 3. Draw Arms
    ctx.beginPath();
    ctx.moveTo(0, -6);
    ctx.lineTo(12 * Math.cos(armAngle), -2 + 10 * Math.sin(armAngle));
    ctx.stroke();

    // 4. Draw Head
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(0, -18, 6, 0, Math.PI * 2);
    ctx.fill();

    // 5. Draw Cyan Headband Tails (Trailing backwards)
    ctx.strokeStyle = 'var(--neon-cyan)';
    ctx.shadowColor = 'var(--neon-cyan)';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(-5, -18);
    ctx.quadraticCurveTo(-14, -14 + Math.sin(cycle) * 4, -22, -18 + Math.cos(cycle) * 3);
    ctx.stroke();
    
    ctx.beginPath();
    ctx.moveTo(-5, -18);
    ctx.quadraticCurveTo(-12, -22 + Math.cos(cycle) * 4, -19, -24 + Math.sin(cycle) * 3);
    ctx.stroke();
  }

  // Draw Shield Bubble around player if active
  if (player.hasShield) {
    ctx.shadowBlur = 12;
    ctx.shadowColor = 'var(--neon-cyan)';
    ctx.strokeStyle = 'rgba(0, 240, 255, 0.75)';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.arc(0, 0, 28, 0, Math.PI * 2);
    ctx.stroke();
    
    // Transparent glow fill
    ctx.fillStyle = 'rgba(0, 240, 255, 0.06)';
    ctx.fill();
  }

  ctx.restore();
}

function drawThornVines(ctx, side, x, y, width, height) {
  ctx.save();
  ctx.shadowBlur = 8;
  ctx.shadowColor = 'var(--neon-green)';
  ctx.strokeStyle = 'var(--neon-green)';
  ctx.lineWidth = 3;

  ctx.beginPath();
  if (side === 'LEFT') {
    // Vine stem along left wall
    ctx.moveTo(x, y);
    ctx.bezierCurveTo(x + 20, y + 20, x + 10, y + 50, x, y + height);
    ctx.stroke();

    // Thorns sticking rightwards
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.moveTo(x + 8, y + 15); ctx.lineTo(x + 28, y + 18); ctx.lineTo(x + 6, y + 25);
    ctx.moveTo(x + 12, y + 38); ctx.lineTo(x + 32, y + 35); ctx.lineTo(x + 8, y + 46);
    ctx.fill();
    ctx.stroke();
  } else {
    // Vine stem along right wall
    ctx.moveTo(x + width, y);
    ctx.bezierCurveTo(x + width - 20, y + 20, x + width - 10, y + 50, x + width, y + height);
    ctx.stroke();

    // Thorns sticking leftwards
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.moveTo(x + width - 8, y + 15); ctx.lineTo(x + width - 28, y + 18); ctx.lineTo(x + width - 6, y + 25);
    ctx.moveTo(x + width - 12, y + 38); ctx.lineTo(x + width - 32, y + 35); ctx.lineTo(x + width - 8, y + 46);
    ctx.fill();
    ctx.stroke();
  }
  ctx.restore();
}

function drawMousetrap(ctx, side, x, y, width, height) {
  ctx.save();
  ctx.translate(x, y);
  
  ctx.shadowBlur = 6;
  ctx.shadowColor = 'var(--neon-purple)';
  ctx.fillStyle = '#1c152e';
  ctx.strokeStyle = 'var(--neon-purple)';
  ctx.lineWidth = 2;
  
  // Steel base board
  ctx.fillRect(0, 0, width, height);
  ctx.strokeRect(0, 0, width, height);
  
  // Neon Red clamping spring wire
  ctx.shadowColor = 'var(--neon-red)';
  ctx.strokeStyle = 'var(--neon-red)';
  ctx.lineWidth = 3;
  ctx.beginPath();
  if (side === 'LEFT') {
    ctx.arc(5, height/2, 8, -Math.PI/2, Math.PI/2);
    ctx.moveTo(5, height/2);
    ctx.lineTo(width - 5, height/2 - 5);
  } else {
    ctx.arc(width - 5, height/2, 8, Math.PI/2, -Math.PI/2);
    ctx.moveTo(width - 5, height/2);
    ctx.lineTo(5, height/2 - 5);
  }
  ctx.stroke();
  ctx.restore();
}

function drawBrokenPlank(ctx, side, x, y, width, height) {
  ctx.save();
  ctx.translate(x, y);
  
  ctx.shadowBlur = 8;
  ctx.shadowColor = 'var(--neon-yellow)';
  ctx.fillStyle = '#261b0c';
  ctx.strokeStyle = 'var(--neon-yellow)';
  ctx.lineWidth = 2.5;
  
  // Draw sharp broken plank polygon sticking out
  ctx.beginPath();
  if (side === 'LEFT') {
    ctx.moveTo(0, 0);
    ctx.lineTo(width, height * 0.4);
    ctx.lineTo(width - 15, height * 0.6);
    ctx.lineTo(width, height);
    ctx.lineTo(0, height);
  } else {
    ctx.moveTo(width, 0);
    ctx.lineTo(0, height * 0.4);
    ctx.lineTo(15, height * 0.6);
    ctx.lineTo(0, height);
    ctx.lineTo(width, height);
  }
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.restore();
}

function render() {
  // Clear frame
  ctx.fillStyle = '#06040d';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Twinkling stars in viewport
  ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
  for (let i = 0; i < 40; i++) {
    const starX = (Math.sin(i * 123) * 0.5 + 0.5) * canvas.width;
    const starY = (Math.cos(i * 321 + heightScore * 0.05) * 0.5 + 0.5) * canvas.height;
    ctx.fillRect(starX, starY, 1.5, 1.5);
  }

  // Draw Left Wall (X: [0, currentLeftWall])
  ctx.fillStyle = '#0f0a1c';
  ctx.fillRect(0, 0, currentLeftWall, canvas.height);
  
  // Draw Right Wall (X: [currentRightWall, 800])
  ctx.fillRect(currentRightWall, 0, 800 - currentRightWall, canvas.height);

  // Draw Wall visual decos (scrolling ticks)
  ctx.strokeStyle = 'rgba(157, 0, 255, 0.45)';
  ctx.shadowBlur = 4;
  ctx.shadowColor = 'var(--neon-purple)';
  ctx.lineWidth = 2.5;

  wallDecos.forEach(deco => {
    // Left Wall notch
    ctx.beginPath();
    ctx.moveTo(currentLeftWall - 10, deco.y);
    ctx.lineTo(currentLeftWall, deco.y);
    ctx.stroke();

    // Right Wall notch
    ctx.beginPath();
    ctx.moveTo(currentRightWall, deco.y);
    ctx.lineTo(currentRightWall + 10, deco.y);
    ctx.stroke();
  });

  // Highlight neon lines separating walls
  ctx.strokeStyle = 'var(--neon-purple)';
  ctx.shadowBlur = 10;
  ctx.shadowColor = 'var(--neon-purple)';
  ctx.lineWidth = 3;
  
  // Left wall edge
  ctx.beginPath();
  ctx.moveTo(currentLeftWall, 0);
  ctx.lineTo(currentLeftWall, canvas.height);
  ctx.stroke();

  // Right wall edge
  ctx.beginPath();
  ctx.moveTo(currentRightWall, 0);
  ctx.lineTo(currentRightWall, canvas.height);
  ctx.stroke();
  ctx.shadowBlur = 0;

  // Render Items (Shields)
  items.forEach(item => {
    ctx.save();
    ctx.translate(item.x, item.y);
    
    // Sparkle pulse effects
    const scale = 1.0 + Math.sin(item.pulseTime * 2) * 0.12;
    ctx.scale(scale, scale);
    ctx.rotate(item.rotation);

    // Neon Cyan Shield Drawing
    ctx.shadowBlur = 12;
    ctx.shadowColor = 'var(--neon-cyan)';
    ctx.strokeStyle = 'var(--neon-cyan)';
    ctx.fillStyle = '#0a1a2e';
    ctx.lineWidth = 2.5;

    ctx.beginPath();
    // Shield shape path
    ctx.moveTo(0, -14);
    ctx.lineTo(12, -10);
    ctx.lineTo(10, 4);
    ctx.quadraticCurveTo(0, 14, 0, 16);
    ctx.quadraticCurveTo(0, 14, -10, 4);
    ctx.lineTo(-12, -10);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Bright core cross highlight
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(0, -8);
    ctx.lineTo(0, 8);
    ctx.moveTo(-6, -2);
    ctx.lineTo(6, -2);
    ctx.stroke();

    // Shield Sparkle Star Particle Dots
    ctx.fillStyle = '#ffffff';
    const sparkleAngle = item.rotation * 2.5;
    ctx.fillRect(Math.cos(sparkleAngle) * 20, Math.sin(sparkleAngle) * 20, 2.5, 2.5);
    ctx.fillRect(Math.cos(sparkleAngle + Math.PI) * 20, Math.sin(sparkleAngle + Math.PI) * 20, 2.5, 2.5);

    ctx.restore();
  });

  // Render Obstacles
  obstacles.forEach(obs => {
    if (obs.type === 'SHURIKEN') {
      ctx.save();
      ctx.translate(obs.x, obs.y);
      ctx.rotate(obs.rotation);
      
      // Neon pink & orange laser saw-blade
      ctx.shadowBlur = 12;
      ctx.shadowColor = 'var(--neon-pink)';
      ctx.strokeStyle = 'var(--neon-pink)';
      ctx.fillStyle = 'rgba(255, 0, 127, 0.15)';
      ctx.lineWidth = 2.5;

      // Draw 8 curved buzz-saw teeth
      ctx.beginPath();
      for (let j = 0; j < 8; j++) {
        const angle = (j * Math.PI) / 4;
        const outerX = Math.cos(angle) * 22;
        const outerY = Math.sin(angle) * 22;
        const innerX = Math.cos(angle + 0.2) * 10;
        const innerY = Math.sin(angle + 0.2) * 10;
        
        if (j === 0) ctx.moveTo(outerX, outerY);
        else ctx.lineTo(outerX, outerY);
        ctx.quadraticCurveTo(innerX, innerY, Math.cos(angle + Math.PI/4) * 22, Math.sin(angle + Math.PI/4) * 22);
      }
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // Outer rings
      ctx.strokeStyle = 'var(--neon-purple)';
      ctx.beginPath();
      ctx.arc(0, 0, 12, 0, Math.PI * 2);
      ctx.stroke();

      // Inner glowing core
      ctx.fillStyle = '#ffffff';
      ctx.shadowBlur = 5;
      ctx.shadowColor = '#ffffff';
      ctx.beginPath();
      ctx.arc(0, 0, 5, 0, Math.PI * 2);
      ctx.fill();

      ctx.restore();
    } 
    else if (obs.type === 'THORN') {
      drawThornVines(ctx, obs.side, obs.x, obs.y, obs.width, obs.height);
    } 
    else if (obs.type === 'TRAP') {
      drawMousetrap(ctx, obs.side, obs.x, obs.y, obs.width, obs.height);
    } 
    else if (obs.type === 'PLANK') {
      drawBrokenPlank(ctx, obs.side, obs.x, obs.y, obs.width, obs.height);
    }
  });

  // Render Particles
  particles.forEach(p => {
    ctx.save();
    ctx.globalAlpha = p.alpha;
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  });

  // Render Player (Ninja)
  const isJumping = player.state === 'JUMPING';
  const scaleDir = player.side === 'LEFT' ? 1 : -1;
  const isBlinking = player.invulnerableTime > 0 && Math.floor(player.invulnerableTime / 80) % 2 === 0;

  if (!isBlinking) {
    drawNinja(ctx, player.x, player.y, isJumping, player.side, scaleDir, player.runCycle);
  }
}

function loop(timestamp) {
  if (!lastTime) lastTime = timestamp;
  const dt = timestamp - lastTime;
  lastTime = timestamp;

  update(dt);
  render();

  requestAnimationFrame(loop);
}

// --------------------------------------------------------------------------
// 6. Game State Actions
// --------------------------------------------------------------------------
function startGame() {
  initAudio();
  
  gameState = 'PLAYING';
  heightScore = 0;
  speedMultiplier = 1.0;
  speedIncreaseTimer = 0;
  spawnTimer = 0;
  spawnInterval = 1000; // start faster
  
  currentLeftWall = playAreaLeft;
  currentRightWall = playAreaRight;

  obstacles = [];
  items = [];
  particles = [];
  initWallDecos();

  // Reset player configuration
  player.state = 'RUNNING';
  player.side = 'LEFT';
  player.targetSide = 'LEFT';
  player.x = playAreaLeft + 16;
  player.vx = 0;
  player.hasShield = false;
  player.invulnerableTime = 0;
  player.airReversals = 0;
  
  hudShieldPanel.classList.remove('active');
  shieldStatusVal.innerText = 'READY';

  // Toggle DOM components
  overlayStart.classList.remove('active');
  overlayGameOver.classList.remove('active');
  
  statusDot.classList.remove('offline');
  btnStartHeader.querySelector('.btn-text').innerText = 'ACTIVE CLIMB';
  btnStartHeader.disabled = true;
  
  updateHUD();
  lastTime = performance.now();
}

function triggerDifficultyAlert() {
  toastWarning.classList.add('show');
  
  if (audioCtx) {
    try {
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(320, audioCtx.currentTime);
      osc.frequency.setValueAtTime(400, audioCtx.currentTime + 0.1);
      gain.gain.setValueAtTime(0.08, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.2);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start();
      osc.stop(audioCtx.currentTime + 0.2);
    } catch (e) {}
  }
  
  setTimeout(() => {
    toastWarning.classList.remove('show');
  }, 1800);
}

function triggerGameOver() {
  gameState = 'GAMEOVER';
  
  playExplosionSound();
  createParticles(player.x, player.y, '#ff007f', 40); // large collision particle burst
  createParticles(player.x, player.y, '#ffff00', 20);

  // Viewport shake trigger
  const viewport = document.querySelector('.game-viewport');
  viewport.classList.add('shake-anim');
  setTimeout(() => {
    viewport.classList.remove('shake-anim');
  }, 450);

  // Toggle HUD details
  statusDot.classList.add('offline');
  btnStartHeader.querySelector('.btn-text').innerText = 'SYSTEM offline';
  btnStartHeader.disabled = false;

  const finalScore = Math.floor(heightScore);
  finalScoreVal.innerText = `${finalScore}m`;
  playerNameInput.value = '';
  playerNameInput.disabled = false;
  btnSubmitScore.disabled = false;
  submissionError.style.display = 'none';

  overlayGameOver.classList.add('active');
  
  renderLeaderboards();
}

function updateHUD() {
  const finalScore = Math.floor(heightScore);
  scoreVal.innerText = `${String(finalScore).padStart(3, '0')}m`;
}

// --------------------------------------------------------------------------
// 7. Rankings Persistence (localStorage Top 20)
// --------------------------------------------------------------------------
const RANKINGS_KEY = 'ninja_ascent_rankings';

const defaultRankings = [
  { name: 'SASUKE_99', score: 320, date: '2026-06-01 10:15' },
  { name: 'NEON_SHADOW', score: 260, date: '2026-06-02 14:30' },
  { name: 'CYBER_SHINOBI', score: 215, date: '2026-06-03 19:40' },
  { name: 'KUNAI_PRO', score: 180, date: '2026-06-02 22:15' },
  { name: 'CHROME_NINJA', score: 140, date: '2026-06-04 11:05' },
  { name: 'WALL_RUNNER', score: 125, date: '2026-06-05 09:22' },
  { name: 'SCROLL_MASTER', score: 90, date: '2026-06-04 18:00' },
  { name: 'ROOKIE_GENIN', score: 45, date: '2026-06-05 13:20' }
];

function getRankings() {
  try {
    const raw = localStorage.getItem(RANKINGS_KEY);
    if (!raw) {
      localStorage.setItem(RANKINGS_KEY, JSON.stringify(defaultRankings));
      return defaultRankings;
    }
    return JSON.parse(raw);
  } catch (e) {
    console.error("Rankings DB Fetch Error:", e);
    return defaultRankings;
  }
}

function saveRanking(name, score) {
  const list = getRankings();
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const hour = String(now.getHours()).padStart(2, '0');
  const minute = String(now.getMinutes()).padStart(2, '0');
  const dateStr = `${year}-${month}-${day} ${hour}:${minute}`;

  list.push({ name: name.toUpperCase(), score: score, date: dateStr });
  list.sort((a, b) => b.score - a.score);
  
  const top20 = list.slice(0, 20);
  try {
    localStorage.setItem(RANKINGS_KEY, JSON.stringify(top20));
  } catch (e) {
    console.error("Saving High-scores failure:", e);
  }
  return top20;
}

function renderLeaderboards(highlightName = null) {
  const ranks = getRankings();
  const currentFinalScore = Math.floor(heightScore);
  
  let tableHTML = '';
  ranks.forEach((r, idx) => {
    let rankClass = '';
    if (idx === 0) rankClass = 'rank-1';
    else if (idx === 1) rankClass = 'rank-2';
    else if (idx === 2) rankClass = 'rank-3';

    const isHighlighted = highlightName && r.name === highlightName.toUpperCase() && r.score === currentFinalScore;
    const trClass = isHighlighted ? 'class="highlighted"' : '';

    tableHTML += `
      <tr ${trClass}>
        <td class="${rankClass}">#${idx + 1}</td>
        <td>${escapeHtml(r.name)}</td>
        <td class="gold-text">${r.score}m</td>
        <td style="font-size:0.75rem; color:var(--text-muted);">${r.date}</td>
      </tr>
    `;
  });

  leaderboardBody.innerHTML = tableHTML;
  modalLeaderboardBody.innerHTML = tableHTML;
}

function escapeHtml(str) {
  return str.replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
}

// --------------------------------------------------------------------------
// 8. Event Listeners Config
// --------------------------------------------------------------------------
btnStartHeader.addEventListener('click', startGame);
btnStartOverlay.addEventListener('click', startGame);
btnRestart.addEventListener('click', startGame);

btnViewRanking.addEventListener('click', () => {
  renderLeaderboards();
  modalRanking.classList.add('active');
});

btnCloseModal.addEventListener('click', () => {
  modalRanking.classList.remove('active');
});

modalRanking.addEventListener('click', (e) => {
  if (e.target === modalRanking) {
    modalRanking.classList.remove('active');
  }
});

btnSubmitScore.addEventListener('click', performScoreSubmission);
playerNameInput.addEventListener('keypress', (e) => {
  if (e.key === 'Enter') {
    performScoreSubmission();
  }
});

function performScoreSubmission() {
  const rawName = playerNameInput.value.trim();
  if (!rawName) {
    showError("닌자 코드를 입력해 주세요.");
    return;
  }
  
  const alphaNumericRegex = /^[A-Za-z0-9_가-힣\s\-]+$/;
  if (!alphaNumericRegex.test(rawName)) {
    showError("특수 기호는 사용할 수 없습니다.");
    return;
  }
  
  if (rawName.length < 2 || rawName.length > 12) {
    showError("2글자에서 12글자 사이로 작성해 주세요.");
    return;
  }
  
  // Save score
  const finalScore = Math.floor(heightScore);
  saveRanking(rawName, finalScore);
  
  // Disable form input/button to prevent multiple submission
  playerNameInput.disabled = true;
  btnSubmitScore.disabled = true;
  submissionError.style.display = 'none';
  
  // Re-render and highlight entry
  renderLeaderboards(rawName);
}

function showError(msg) {
  submissionError.innerText = msg;
  submissionError.style.display = 'block';
}

// Initialize loop
initWallDecos();
requestAnimationFrame(loop);

// --------------------------------------------------------------------------
// 9. Fullscreen Warnings (Only runs on Desktop/PC browsers)
// --------------------------------------------------------------------------
const fsModal = document.getElementById('fullscreen-warning-modal');
const fsBtn = document.getElementById('close-fs-modal-btn');

function checkIsFullscreen() {
  const apiFullscreen = !!(
    document.fullscreenElement ||
    document.webkitFullscreenElement ||
    document.mozFullScreenElement ||
    document.msFullscreenElement
  );
  if (apiFullscreen) return true;

  const widthDiff = Math.abs(window.innerWidth - window.screen.width);
  const heightDiff = Math.abs(window.innerHeight - window.screen.height);
  const outerWidthDiff = Math.abs(window.outerWidth - window.screen.width);
  const outerHeightDiff = Math.abs(window.outerHeight - window.screen.height);

  return (widthDiff <= 8 && heightDiff <= 8) || (outerWidthDiff <= 8 && outerHeightDiff <= 8);
}

function updateFullscreenModal() {
  const userAgent = navigator.userAgent || navigator.vendor || window.opera;
  const isMobile = /android|avantgo|blackberry|iemobile|ipad|iphone|ipod|j2me|midp|mmp|mobile|o2|opera mini|palm|plucker|pocket|psp|smartphone|symbian|treo|up\.browser|up\.link|vodafone|wap|windows ce|xda|xiino/i.test(userAgent) ||
                  (/Macintosh/i.test(userAgent) && navigator.maxTouchPoints > 1) ||
                  (window.innerWidth <= 1024 && ('ontouchstart' in window || navigator.maxTouchPoints > 0));

  if (isMobile) return; // skip modal block check for mobile screens

  if (checkIsFullscreen()) {
    fsModal.classList.remove('active');
  } else {
    fsModal.classList.add('active');
  }
}

// Check slightly after loading to enable smooth entrance animation
setTimeout(updateFullscreenModal, 800);

window.addEventListener('resize', updateFullscreenModal);
document.addEventListener('fullscreenchange', updateFullscreenModal);
document.addEventListener('webkitfullscreenchange', updateFullscreenModal);
document.addEventListener('mozfullscreenchange', updateFullscreenModal);
document.addEventListener('MSFullscreenChange', updateFullscreenModal);

fsBtn.addEventListener('click', () => {
  const elem = document.documentElement;
  if (elem.requestFullscreen) {
    elem.requestFullscreen();
  } else if (elem.webkitRequestFullscreen) {
    elem.webkitRequestFullscreen();
  } else if (elem.msRequestFullscreen) {
    elem.msRequestFullscreen();
  } else {
    fsModal.classList.remove('active');
  }
});
