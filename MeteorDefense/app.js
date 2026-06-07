/* ==========================================================================
   MeteorDefense - Game Engine & Logic Script
   ========================================================================== */

// --------------------------------------------------------------------------
// 1. DOM Elements & State Management
// --------------------------------------------------------------------------
const canvas = document.getElementById('game-canvas');
const ctx = canvas.getContext('2d');

const scoreVal = document.getElementById('score-val');
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
let score = 0;
let baseSpeed = 1.0;
let speedMultiplier = 1.0;
let lastTime = 0;
let speedIncreaseTimer = 0; // Cumulative time tracker for speedup (every 10s)
let nextSpawnTimer = 0;
let spawnInterval = 1600; // ms between spawns (procedurally adjusts)

// Pools for Entities
let stars = [];
let meteors = [];
let particles = [];
let laserBeams = [];

// Turret & Control Parameters
const turretPos = { x: 400, y: 750 };
const groundY = 750;
let turretAngle = -Math.PI / 2; // Face straight up by default
let mousePos = { x: 400, y: 0 };
const maxMeteors = 5;

// Synthesized Audio Context
let audioCtx = null;

// Initialize Starfield once
function initStars() {
  stars = [];
  for (let i = 0; i < 80; i++) {
    stars.push({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height,
      size: Math.random() * 2 + 0.5,
      opacity: Math.random() * 0.7 + 0.2,
      speed: Math.random() * 0.02 + 0.005
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
    
    // Quick flash confirmation to show audio engine started successfully
    audioWarmupToast.classList.remove('hidden');
    setTimeout(() => {
      audioWarmupToast.classList.add('hidden');
    }, 1800);
  }
}

function playLaserSound() {
  if (!audioCtx) return;
  if (audioCtx.state === 'suspended') {
    audioCtx.resume();
  }
  
  try {
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(900, audioCtx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(120, audioCtx.currentTime + 0.14);
    
    gain.gain.setValueAtTime(0.18, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.005, audioCtx.currentTime + 0.14);
    
    // Connect node chain
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    
    osc.start();
    osc.stop(audioCtx.currentTime + 0.14);
  } catch (e) {
    console.warn("Audio failure:", e);
  }
}

function playExplosionSound() {
  if (!audioCtx) return;
  if (audioCtx.state === 'suspended') {
    audioCtx.resume();
  }
  
  try {
    // Generate buffer filled with white noise
    const bufferSize = audioCtx.sampleRate * 0.45; // 450ms duration
    const buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
    const data = buffer.getChannelData(0);
    
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    
    const noiseSource = audioCtx.createBufferSource();
    noiseSource.buffer = buffer;
    
    // Lowpass filter to shape deep bass explosions
    const filter = audioCtx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(260, audioCtx.currentTime);
    filter.frequency.exponentialRampToValueAtTime(15, audioCtx.currentTime + 0.4);
    
    // Exponential envelope decay
    const gain = audioCtx.createGain();
    gain.gain.setValueAtTime(0.4, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.005, audioCtx.currentTime + 0.43);
    
    noiseSource.connect(filter);
    filter.connect(gain);
    gain.connect(audioCtx.destination);
    
    noiseSource.start();
  } catch (e) {
    console.warn("Audio failure:", e);
  }
}

// --------------------------------------------------------------------------
// 3. Game Spawning & Physics
// --------------------------------------------------------------------------
function spawnMeteor() {
  if (meteors.length >= maxMeteors) return;
  
  const radius = Math.random() * 12 + 10; // 10px to 22px sized asteroids
  const startX = Math.random() * (canvas.width - 60) + 30; // buffer bounds
  const startY = -radius - 10;
  
  // Straight or slightly angled trajectory targeting the ground shield base
  const angleSpread = (Math.random() - 0.5) * 0.4; // slight random diagonal drift
  
  const speed = (Math.random() * 0.6 + 0.7) * baseSpeed;
  
  meteors.push({
    id: Date.now() + Math.random(),
    x: startX,
    y: startY,
    radius: radius,
    vy: speed,
    vx: angleSpread * speed,
    color: `hsl(${Math.random() * 25 + 5}, 100%, 55%)`, // Blazing red-orange HSL variations
    trailTime: 0
  });
}

function createExplosionParticles(x, y, color) {
  const particleCount = Math.floor(Math.random() * 15 + 15);
  for (let i = 0; i < particleCount; i++) {
    const angle = Math.random() * Math.PI * 2;
    const speed = Math.random() * 4 + 1.5;
    particles.push({
      x: x,
      y: y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      size: Math.random() * 4 + 2,
      alpha: 1.0,
      decay: Math.random() * 0.03 + 0.015,
      color: Math.random() > 0.4 ? color : '#ffff00' // mix in yellow sparks
    });
  }
}

// --------------------------------------------------------------------------
// 4. Input Coordinates & Aiming Barrel
// --------------------------------------------------------------------------
function getCanvasMousePos(e) {
  const rect = canvas.getBoundingClientRect();
  const x = (e.clientX - rect.left) * (canvas.width / rect.width);
  const y = (e.clientY - rect.top) * (canvas.height / rect.height);
  return { x, y };
}

canvas.addEventListener('mousemove', (e) => {
  mousePos = getCanvasMousePos(e);
  // Calculate angle between base (400, 750) and cursor position
  turretAngle = Math.atan2(mousePos.y - turretPos.y, mousePos.x - turretPos.x);
  
  // Constrain turret rotation so it doesn't aim below the ground line
  if (turretAngle > 0 && turretAngle < Math.PI) {
    if (turretAngle < Math.PI / 2) {
      turretAngle = 0;
    } else {
      turretAngle = Math.PI;
    }
  }
});

// Primary Targeting Click Handler
canvas.addEventListener('mousedown', (e) => {
  if (gameState !== 'PLAYING') return;
  
  initAudio(); // Warm up context if needed
  
  const clickPos = getCanvasMousePos(e);
  let hit = false;
  let clickedMeteorIndex = -1;
  
  // Calculate aiming angle for active shoot line orientation
  turretAngle = Math.atan2(clickPos.y - turretPos.y, clickPos.x - turretPos.x);
  
  // Check collision (distance check with lenient clickable hit-box margin)
  for (let i = 0; i < meteors.length; i++) {
    const meteor = meteors[i];
    const dx = clickPos.x - meteor.x;
    const dy = clickPos.y - meteor.y;
    const distance = Math.sqrt(dx*dx + dy*dy);
    
    // Add 16px buffer to the radius to make clicking dynamic meteors responsive and satisfying
    if (distance <= meteor.radius + 16) {
      hit = true;
      clickedMeteorIndex = i;
      break;
    }
  }
  
  playLaserSound();
  
  // Barrel offset endpoint (laser firing origin)
  const barrelLen = 35;
  const originX = turretPos.x + Math.cos(turretAngle) * barrelLen;
  const originY = turretPos.y + Math.sin(turretAngle) * barrelLen;
  
  if (hit && clickedMeteorIndex !== -1) {
    const m = meteors[clickedMeteorIndex];
    
    // Push visual cyan laser ray
    laserBeams.push({
      startX: originX,
      startY: originY,
      endX: m.x,
      endY: m.y,
      alpha: 1.0,
      color: 'cyan'
    });
    
    playExplosionSound();
    createExplosionParticles(m.x, m.y, m.color);
    
    // Remove meteor and increment counters
    meteors.splice(clickedMeteorIndex, 1);
    score++;
    updateHUD();
    
    // Quick success animation details on LED panel
    const ledVal = document.querySelector('.led-score-panel');
    ledVal.style.borderColor = 'var(--neon-green)';
    setTimeout(() => {
      ledVal.style.borderColor = 'rgba(0, 240, 255, 0.4)';
    }, 150);
    
  } else {
    // Firing a laser to missed click coordinate coordinates keeps UX reactive!
    laserBeams.push({
      startX: originX,
      startY: originY,
      endX: clickPos.x,
      endY: clickPos.y,
      alpha: 0.8,
      color: 'pink'
    });
  }
});

// --------------------------------------------------------------------------
// 5. Game Core Loop (requestAnimationFrame)
// --------------------------------------------------------------------------
function update(dt) {
  // Starfield twinkles
  stars.forEach(star => {
    star.opacity += (Math.random() - 0.5) * 0.05;
    star.opacity = Math.max(0.1, Math.min(1.0, star.opacity));
  });

  if (gameState !== 'PLAYING') return;

  // Process speed difficulty increment timers (Every 10 seconds / 10000ms)
  speedIncreaseTimer += dt;
  if (speedIncreaseTimer >= 10000) {
    speedIncreaseTimer = 0;
    speedMultiplier += 0.22; // increment speed factor
    spawnInterval = Math.max(700, spawnInterval - 120); // spawn rate speeds up slightly too
    triggerDifficultyAlert();
  }

  // Handle spawn ticks
  nextSpawnTimer += dt;
  if (nextSpawnTimer >= spawnInterval) {
    nextSpawnTimer = 0;
    if (meteors.length < maxMeteors) {
      spawnMeteor();
    }
  }

  // Update Laser Beams decay fade-out
  for (let i = laserBeams.length - 1; i >= 0; i--) {
    laserBeams[i].alpha -= 0.15;
    if (laserBeams[i].alpha <= 0) {
      laserBeams.splice(i, 1);
    }
  }

  // Update Particles physics
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.x += p.vx;
    p.y += p.vy;
    p.alpha -= p.decay;
    if (p.alpha <= 0) {
      particles.splice(i, 1);
    }
  }

  // Update Meteors movement & ground collision
  for (let i = meteors.length - 1; i >= 0; i--) {
    const m = meteors[i];
    
    // Apply speed scaling multiplier
    m.y += m.vy * speedMultiplier;
    m.x += m.vx * speedMultiplier;
    
    // Boundaries bouncing on frame sides to prevent flying completely off screen
    if (m.x - m.radius < 0) {
      m.x = m.radius;
      m.vx = -m.vx;
    } else if (m.x + m.radius > canvas.width) {
      m.x = canvas.width - m.radius;
      m.vx = -m.vx;
    }

    // Ground Shield Collision Breached! Game Over!
    if (m.y >= groundY - 10) {
      triggerGameOver();
      return;
    }
  }
}

function render() {
  // Clear Frame with radial background space shadow
  ctx.fillStyle = '#06040c';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  
  // Render Stars
  stars.forEach(star => {
    ctx.fillStyle = `rgba(255, 255, 255, ${star.opacity})`;
    ctx.beginPath();
    ctx.arc(star.x, star.y, star.size, 0, Math.PI * 2);
    ctx.fill();
  });

  // Render Meteor Trails (Smoke particles/flame tail effects drawn under objects)
  meteors.forEach(m => {
    // Draw trail circles trailing upwards
    const tailLength = 6;
    for (let i = 1; i <= tailLength; i++) {
      const trailX = m.x - (m.vx * speedMultiplier * i * 2.5);
      const trailY = m.y - (m.vy * speedMultiplier * i * 2.5);
      const sizeRatio = (tailLength - i) / tailLength;
      
      const grad = ctx.createRadialGradient(trailX, trailY, 0, trailX, trailY, m.radius * sizeRatio * 0.9);
      grad.addColorStop(0, 'rgba(255, 100, 0, 0.4)');
      grad.addColorStop(0.5, 'rgba(255, 0, 100, 0.15)');
      grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
      
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(trailX, trailY, m.radius * sizeRatio * 1.5, 0, Math.PI * 2);
      ctx.fill();
    }
  });

  // Render Active Meteors
  meteors.forEach(m => {
    // Render outer core glow
    const glowGrad = ctx.createRadialGradient(m.x, m.y, m.radius * 0.2, m.x, m.y, m.radius * 1.3);
    glowGrad.addColorStop(0, '#ffffff');
    glowGrad.addColorStop(0.3, '#ffcc00');
    glowGrad.addColorStop(0.7, '#ff003c');
    glowGrad.addColorStop(1, 'rgba(255,0,0,0)');
    
    ctx.fillStyle = glowGrad;
    ctx.beginPath();
    ctx.arc(m.x, m.y, m.radius * 1.4, 0, Math.PI * 2);
    ctx.fill();
    
    // Draw solid asteroid center structure
    ctx.fillStyle = '#2c253d';
    ctx.strokeStyle = '#ff3366';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(m.x, m.y, m.radius * 0.7, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Adding craggy tech/neon dots inside asteroid for detailed premium assets
    ctx.fillStyle = '#ff3366';
    ctx.beginPath();
    ctx.arc(m.x - m.radius * 0.2, m.y - m.radius * 0.2, 2, 0, Math.PI*2);
    ctx.arc(m.x + m.radius * 0.3, m.y + m.radius * 0.1, 1.5, 0, Math.PI*2);
    ctx.fill();
  });

  // Render Laser beams
  laserBeams.forEach(laser => {
    ctx.save();
    // Wide glowing outer ray
    ctx.strokeStyle = laser.color === 'cyan' ? 'rgba(0, 240, 255, 0.3)' : 'rgba(255, 0, 127, 0.3)';
    ctx.lineWidth = 10 * laser.alpha;
    ctx.shadowBlur = 15;
    ctx.shadowColor = laser.color === 'cyan' ? '#00f0ff' : '#ff007f';
    ctx.beginPath();
    ctx.moveTo(laser.startX, laser.startY);
    ctx.lineTo(laser.endX, laser.endY);
    ctx.stroke();
    
    // Thin bright hot center beam
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 3 * laser.alpha;
    ctx.beginPath();
    ctx.moveTo(laser.startX, laser.startY);
    ctx.lineTo(laser.endX, laser.endY);
    ctx.stroke();
    ctx.restore();
  });

  // Render Debris Particles
  particles.forEach(p => {
    ctx.fillStyle = p.color;
    ctx.globalAlpha = p.alpha;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
    ctx.fill();
  });
  ctx.globalAlpha = 1.0; // reset

  // Render Ground Base (Shield barrier and tech panel, bottom 50px)
  const shieldGrad = ctx.createLinearGradient(0, groundY - 18, 0, groundY);
  shieldGrad.addColorStop(0, 'rgba(0, 240, 255, 0.2)');
  shieldGrad.addColorStop(0.3, 'rgba(0, 240, 255, 0.05)');
  shieldGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
  
  ctx.fillStyle = shieldGrad;
  ctx.fillRect(0, groundY - 18, canvas.width, 18);
  
  // Neon Blue glowing border shield line
  ctx.strokeStyle = 'rgba(0, 240, 255, 0.7)';
  ctx.lineWidth = 3;
  ctx.shadowBlur = 10;
  ctx.shadowColor = '#00f0ff';
  ctx.beginPath();
  ctx.moveTo(0, groundY);
  ctx.lineTo(canvas.width, groundY);
  ctx.stroke();
  ctx.shadowBlur = 0; // reset

  // Draw Ground under shield
  ctx.fillStyle = '#0f0c1b';
  ctx.fillRect(0, groundY, canvas.width, canvas.height - groundY);
  
  // Tech metal panel grid lines on ground
  ctx.strokeStyle = 'rgba(255, 0, 127, 0.15)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  // draw grids
  for (let x = 40; x < canvas.width; x += 40) {
    ctx.moveTo(x, groundY);
    ctx.lineTo(x, canvas.height);
  }
  ctx.stroke();

  // Render Aim-Tracking Gun Turret
  ctx.save();
  ctx.translate(turretPos.x, turretPos.y);
  
  // Turret barrel rotation drawing
  ctx.save();
  ctx.rotate(turretAngle);
  
  // Twin rail guns base structure
  ctx.fillStyle = 'rgba(0, 240, 255, 0.15)';
  ctx.strokeStyle = '#00f0ff';
  ctx.lineWidth = 1.5;
  ctx.fillRect(0, -9, 32, 18);
  ctx.strokeRect(0, -9, 32, 18);
  
  // Glowing blue plasma cores inside barrel rails
  ctx.fillStyle = '#ffffff';
  ctx.shadowBlur = 8;
  ctx.shadowColor = '#00f0ff';
  ctx.fillRect(8, -4, 20, 2);
  ctx.fillRect(8, 2, 20, 2);
  ctx.restore();
  
  // Turret dome core base
  const domeGrad = ctx.createRadialGradient(0, 0, 5, 0, 0, 22);
  domeGrad.addColorStop(0, '#15102a');
  domeGrad.addColorStop(0.7, '#07050f');
  domeGrad.addColorStop(1, '#ff007f');
  
  ctx.fillStyle = domeGrad;
  ctx.strokeStyle = '#ff007f';
  ctx.lineWidth = 2.5;
  ctx.shadowBlur = 10;
  ctx.shadowColor = '#ff007f';
  ctx.beginPath();
  ctx.arc(0, 0, 20, Math.PI, 0); // draw half-circle dome base
  ctx.fill();
  ctx.stroke();
  ctx.restore();
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
  score = 0;
  baseSpeed = 1.25;
  speedMultiplier = 1.0;
  speedIncreaseTimer = 0;
  nextSpawnTimer = 0;
  spawnInterval = 1600;
  
  meteors = [];
  particles = [];
  laserBeams = [];
  
  // Hide UI overlays
  overlayStart.classList.remove('active');
  overlayGameOver.classList.remove('active');
  
  updateHUD();
  
  // Toggle status light
  statusDot.classList.remove('offline');
  btnStartHeader.querySelector('.btn-text').innerText = 'ACTIVE COMMAND';
  btnStartHeader.disabled = true; // prevent double triggers
  
  lastTime = performance.now();
}

function triggerDifficultyAlert() {
  toastWarning.classList.add('show');
  
  // Brief screen impact warning sound
  if (audioCtx) {
    try {
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(380, audioCtx.currentTime);
      osc.frequency.setValueAtTime(450, audioCtx.currentTime + 0.1);
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
  
  // Play large screen collapse boom sound
  if (audioCtx) {
    try {
      const osc = audioCtx.createOscillator();
      const noise = audioCtx.createGain();
      osc.frequency.setValueAtTime(100, audioCtx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(10, audioCtx.currentTime + 1.2);
      
      noise.gain.setValueAtTime(0.8, audioCtx.currentTime);
      noise.gain.exponentialRampToValueAtTime(0.005, audioCtx.currentTime + 1.2);
      
      osc.connect(noise);
      noise.connect(audioCtx.destination);
      osc.start();
      osc.stop(audioCtx.currentTime + 1.2);
    } catch (e) {}
  }
  
  // Trigger layout screen shake animation
  const viewport = document.querySelector('.game-viewport');
  viewport.classList.add('shake-anim');
  setTimeout(() => {
    viewport.classList.remove('shake-anim');
  }, 450);
  
  // Display GameOver HUD components
  statusDot.classList.add('offline');
  btnStartHeader.querySelector('.btn-text').innerText = 'SYSTEM offline';
  btnStartHeader.disabled = false;
  
  finalScoreVal.innerText = score;
  playerNameInput.value = '';
  playerNameInput.disabled = false;
  btnSubmitScore.disabled = false;
  submissionError.style.display = 'none';
  
  overlayGameOver.classList.add('active');
  
  // Refresh and populate tables
  renderLeaderboards();
}

function updateHUD() {
  // Format counter to LED format: e.g. 003, 024, 153
  const formatted = String(score).padStart(3, '0');
  scoreVal.innerText = formatted;
}

// --------------------------------------------------------------------------
// 7. Rankings Persistence (localStorage Top 20)
// --------------------------------------------------------------------------
const RANKINGS_KEY = 'meteor_defense_rankings';

// Fallback seed data if database is empty to make UI look complete
const defaultRankings = [
  { name: 'NEO_PILOT', score: 45, date: '2026-05-28 14:10' },
  { name: 'X_CORPS_1', score: 38, date: '2026-05-27 19:35' },
  { name: 'CYBER_ACE', score: 32, date: '2026-05-29 02:40' },
  { name: 'OMEGA', score: 25, date: '2026-05-28 22:15' },
  { name: 'BARRIER_GUY', score: 20, date: '2026-05-29 11:05' },
  { name: 'FUSION_1', score: 18, date: '2026-05-26 13:20' },
  { name: 'HULL_ENGINE', score: 15, date: '2026-05-27 08:50' },
  { name: 'SOLAR_CORE', score: 12, date: '2026-05-29 18:00' },
  { name: 'SHIELD_MAX', score: 10, date: '2026-05-25 15:45' },
  { name: 'RECRUIT_A', score: 5, date: '2026-05-28 09:12' }
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
  
  // Format current timestamp
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const hour = String(now.getHours()).padStart(2, '0');
  const minute = String(now.getMinutes()).padStart(2, '0');
  const dateStr = `${year}-${month}-${day} ${hour}:${minute}`;
  
  // Push and Sort descending
  list.push({ name: name.toUpperCase(), score: score, date: dateStr });
  list.sort((a, b) => b.score - a.score);
  
  // Slice to Top 20 slots
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
  
  let tableHTML = '';
  ranks.forEach((r, idx) => {
    let rankClass = '';
    if (idx === 0) rankClass = 'rank-1';
    else if (idx === 1) rankClass = 'rank-2';
    else if (idx === 2) rankClass = 'rank-3';
    
    const isHighlighted = highlightName && r.name === highlightName.toUpperCase() && r.score === score;
    const trClass = isHighlighted ? 'class="highlighted"' : '';
    
    tableHTML += `
      <tr ${trClass}>
        <td class="${rankClass}">#${idx + 1}</td>
        <td>${escapeHtml(r.name)}</td>
        <td class="gold-text">${r.score}</td>
        <td style="font-size:0.75rem; color:var(--text-muted);">${r.date}</td>
      </tr>
    `;
  });
  
  // Fill both identical ranking panels
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

// View high-scores modal toggle
btnViewRanking.addEventListener('click', () => {
  renderLeaderboards();
  modalRanking.classList.add('active');
});

btnCloseModal.addEventListener('click', () => {
  modalRanking.classList.remove('active');
});

// Close modal when clicking outside card boundary
modalRanking.addEventListener('click', (e) => {
  if (e.target === modalRanking) {
    modalRanking.classList.remove('active');
  }
});

// Score database logging handler
btnSubmitScore.addEventListener('click', performScoreSubmission);
playerNameInput.addEventListener('keypress', (e) => {
  if (e.key === 'Enter') {
    performScoreSubmission();
  }
});

function performScoreSubmission() {
  const rawName = playerNameInput.value.trim();
  
  // Validation checks
  if (rawName.length === 0) {
    submissionError.innerText = "COMMANDER NAME CANNOT BE VOID";
    submissionError.style.display = 'block';
    return;
  }
  
  if (rawName.length < 2) {
    submissionError.innerText = "NAME MUST CONTAIN AT LEAST 2 CHARACTERS";
    submissionError.style.display = 'block';
    return;
  }
  
  submissionError.style.display = 'none';
  
  // Log item to database
  saveRanking(rawName, score);
  
  // Re-draw board with highlight
  renderLeaderboards(rawName);
  
  playerNameInput.disabled = true;
  btnSubmitScore.disabled = true;
  
  // Scroll leaderboard section smoothly into view
  const lbSection = document.querySelector('.leaderboard-table-container');
  lbSection.scrollIntoView({ behavior: 'smooth' });
}

// --------------------------------------------------------------------------
// 9. Startup Initialization
// --------------------------------------------------------------------------
initStars();
renderLeaderboards();

// Start animating stars background on start
requestAnimationFrame(loop);
