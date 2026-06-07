/* ==========================================================================
   Kunai - Game Engine & Logic Script
   ========================================================================== */

// --------------------------------------------------------------------------
// 1. DOM Elements & State Management
// --------------------------------------------------------------------------
const canvas = document.getElementById('game-canvas');
const ctx = canvas.getContext('2d');

const scoreVal = document.getElementById('score-val');
const ammoStatusVal = document.getElementById('ammo-status-val');
const btnStartHeader = document.getElementById('btn-start');
const btnStartOverlay = document.getElementById('btn-start-overlay');
const btnRestart = document.getElementById('btn-restart');
const btnSubmitScore = document.getElementById('btn-submit-score');
const btnViewRanking = document.getElementById('btn-view-ranking');
const btnCloseModal = document.getElementById('btn-close-modal');

const overlayStart = document.getElementById('overlay-start');
const overlayUpgrade = document.getElementById('overlay-upgrade');
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

// Upgrade UI Options Elements
const upgradeStandardOptions = document.getElementById('upgrade-standard-options');
const upgradeSpecialBox = document.getElementById('upgrade-special-box');

const btnUpSpeed = document.getElementById('btn-up-speed');
const btnUpSize = document.getElementById('btn-up-size');
const btnUpPenetration = document.getElementById('btn-up-penetration');
const btnUpQuantity = document.getElementById('btn-up-quantity');

const txtSpeed = document.getElementById('level-txt-speed');
const txtSize = document.getElementById('level-txt-size');
const txtPenetration = document.getElementById('level-txt-penetration');
const txtQuantity = document.getElementById('level-txt-quantity');

const fillSpeed = document.getElementById('level-fill-speed');
const fillSize = document.getElementById('level-fill-size');
const fillPenetration = document.getElementById('level-fill-penetration');

// Game Engine State Variables
let gameState = 'START'; // 'START' | 'PLAYING' | 'UPGRADING' | 'GAMEOVER'
let score = 0;
let lastTime = 0;
let speedIncreaseTimer = 0;
let difficultyFactor = 1.0;

let spawnTimer = 0;
let spawnInterval = 2800; // ms between bomb spawns

// Upgrade levels (0 to 10 max)
const upgrades = {
  speed: 0,
  size: 0,
  penetration: 0,
  quantity: 1
};
let scoreAtMaxed = null; // score when all 3 standard reached level 10

// Entities Pools
let kunais = [];
let bombs = [];
let particles = [];

// Launcher Configuration
const launcher = {
  x: 400,
  y: 750,
  radius: 40,
  aimAngle: -Math.PI / 2, // Straight up
  aimTime: 0,
  aimSweepSpeed: 1.6, // angular oscillation speed
};

// Web Audio API Synthesis
let audioCtx = null;
let lastAlarmTickTime = 0; // throttle beep sounds

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

function playThrowSound() {
  if (!audioCtx) return;
  if (audioCtx.state === 'suspended') audioCtx.resume();
  try {
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(440, audioCtx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(150, audioCtx.currentTime + 0.12);
    
    gain.gain.setValueAtTime(0.15, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.12);
    
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    
    osc.start();
    osc.stop(audioCtx.currentTime + 0.12);
  } catch (e) {}
}

function playDefuseSound() {
  if (!audioCtx) return;
  if (audioCtx.state === 'suspended') audioCtx.resume();
  try {
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    
    osc.type = 'sine';
    osc.frequency.setValueAtTime(600, audioCtx.currentTime);
    osc.frequency.setValueAtTime(900, audioCtx.currentTime + 0.05);
    
    gain.gain.setValueAtTime(0.12, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.15);
    
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    
    osc.start();
    osc.stop(audioCtx.currentTime + 0.15);
  } catch (e) {}
}

function playAlarmBeep() {
  if (!audioCtx) return;
  if (audioCtx.state === 'suspended') audioCtx.resume();
  try {
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(880, audioCtx.currentTime);
    
    gain.gain.setValueAtTime(0.08, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.005, audioCtx.currentTime + 0.1);
    
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    
    osc.start();
    osc.stop(audioCtx.currentTime + 0.1);
  } catch (e) {}
}

function playUpgradeSelectSound() {
  if (!audioCtx) return;
  if (audioCtx.state === 'suspended') audioCtx.resume();
  try {
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    
    osc.type = 'triangle';
    const now = audioCtx.currentTime;
    osc.frequency.setValueAtTime(261.63, now); // C4
    osc.frequency.setValueAtTime(329.63, now + 0.08); // E4
    osc.frequency.setValueAtTime(392.00, now + 0.16); // G4
    osc.frequency.setValueAtTime(523.25, now + 0.24); // C5
    
    gain.gain.setValueAtTime(0.15, now);
    gain.gain.exponentialRampToValueAtTime(0.005, now + 0.45);
    
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    
    osc.start();
    osc.stop(now + 0.45);
  } catch (e) {}
}

function playExplosionSound() {
  if (!audioCtx) return;
  if (audioCtx.state === 'suspended') audioCtx.resume();
  try {
    const bufferSize = audioCtx.sampleRate * 0.7;
    const buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    
    const noiseSource = audioCtx.createBufferSource();
    noiseSource.buffer = buffer;
    
    const filter = audioCtx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(280, audioCtx.currentTime);
    filter.frequency.exponentialRampToValueAtTime(10, audioCtx.currentTime + 0.6);
    
    const gain = audioCtx.createGain();
    gain.gain.setValueAtTime(0.45, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.005, audioCtx.currentTime + 0.65);
    
    noiseSource.connect(filter);
    filter.connect(gain);
    gain.connect(audioCtx.destination);
    
    noiseSource.start();
  } catch (e) {}
}

// --------------------------------------------------------------------------
// 3. Spawning System & Bomb Entity
// --------------------------------------------------------------------------
function spawnBomb() {
  const radius = 33;
  // Spawn within grid borders (x: 50 to 750)
  const spawnX = Math.random() * (700) + 50;
  const spawnY = -radius - 10;
  
  // Downward speed scales gradually with difficultyFactor
  const fallSpeed = (Math.random() * 20 + 35) * difficultyFactor;
  
  bombs.push({
    id: Date.now() + Math.random(),
    x: spawnX,
    y: spawnY,
    radius: radius,
    vy: fallSpeed,
    timer: 20.0, // 20 seconds countdown
    fuseSparkTime: 0
  });
}

function createExplosionParticles(x, y, color, count = 15) {
  for (let i = 0; i < count; i++) {
    const angle = Math.random() * Math.PI * 2;
    const speed = Math.random() * 4 + 2;
    particles.push({
      x: x,
      y: y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      size: Math.random() * 5 + 2,
      color: color,
      alpha: 1.0,
      decay: Math.random() * 0.03 + 0.015
    });
  }
}

// --------------------------------------------------------------------------
// 4. Input & Controls (Automatic sweep angle click-to-shoot)
// --------------------------------------------------------------------------
function handleInput() {
  if (gameState !== 'PLAYING') return;
  initAudio();
  
  // Can only fire if current active kunais is below the maximum allowed quantity
  if (kunais.length < upgrades.quantity) {
    const kSpeed = 460 * (1.0 + upgrades.speed * 0.1);
    const kSize = 1.0 + upgrades.size * 0.1;

    // Firing origin at launcher's barrel endpoint
    const barrelLen = 35;
    const spawnX = launcher.x + Math.cos(launcher.aimAngle) * barrelLen;
    const spawnY = launcher.y + Math.sin(launcher.aimAngle) * barrelLen;

    kunais.push({
      x: spawnX,
      y: spawnY,
      vx: Math.cos(launcher.aimAngle) * kSpeed,
      vy: Math.sin(launcher.aimAngle) * kSpeed,
      angle: launcher.aimAngle,
      radius: 12 * kSize, // collision detection radius
      sizeMultiplier: kSize,
      hitBombs: [] // keep track of already hit bomb IDs to avoid multi-colliding
    });
    
    playThrowSound();
    updateHUD();
  }
}

// Trigger bindings
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
  if (gameState === 'PLAYING') {
  // 1. Aim Sweeping Angle (Oscillates between -177deg and -3deg relative to positive X, i.e. 3deg to 177deg)
  launcher.aimTime += launcher.aimSweepSpeed * (dt / 1000);
  launcher.aimAngle = -Math.PI / 2 + Math.sin(launcher.aimTime) * Math.PI * (87 / 180);

    // 2. Progression
    speedIncreaseTimer += dt;
    if (speedIncreaseTimer >= 12000) {
      speedIncreaseTimer = 0;
      difficultyFactor += 0.12;
      spawnInterval = Math.max(800, spawnInterval - 150);
      triggerDifficultyAlert();
    }

    // 3. Spawning ticks
    spawnTimer += dt;
    if (spawnTimer >= spawnInterval) {
      spawnTimer = 0;
      spawnBomb();
    }

    // 4. Update Kunais
    for (let i = kunais.length - 1; i >= 0; i--) {
      const k = kunais[i];
      k.x += k.vx * (dt / 1000);
      k.y += k.vy * (dt / 1000);

      // Trail particles
      if (Math.random() < 0.3) {
        particles.push({
          x: k.x,
          y: k.y,
          vx: (Math.random() - 0.5) * 0.5,
          vy: (Math.random() - 0.5) * 0.5,
          size: Math.random() * 2 + 1,
          color: 'rgba(0, 240, 255, 0.4)',
          alpha: 0.8,
          decay: 0.04
        });
      }

      // Border destruction
      if (k.x < 0 || k.x > 800 || k.y < 0 || k.y > 800) {
        kunais.splice(i, 1);
        updateHUD();
      }
    }

    // 5. Update Bombs & Countdown
    let alarmNeeded = false;
    for (let i = bombs.length - 1; i >= 0; i--) {
      const b = bombs[i];
      b.y += b.vy * (dt / 1000);
      b.timer -= dt / 1000;
      b.fuseSparkTime += 12 * (dt / 1000);

      // If timer is near ending, tick alarm flags
      if (b.timer <= 3.0) {
        alarmNeeded = true;
      }

      // Fuse spark particle leakage
      if (Math.random() < 0.4) {
        const fuseX = b.x + Math.cos(b.fuseSparkTime) * 12;
        const fuseY = b.y - b.radius - 8 + Math.sin(b.fuseSparkTime) * 4;
        particles.push({
          x: fuseX,
          y: fuseY,
          vx: (Math.random() - 0.5) * 2,
          vy: -Math.random() * 2,
          size: Math.random() * 2.5 + 1,
          color: '#ffea00',
          alpha: 1.0,
          decay: 0.05
        });
      }

      // Detonation Trigger Game Over
      if (b.timer <= 0) {
        b.timer = 0;
        triggerGameOver(b);
        return;
      }
      
      // Bottom ground border: stop bomb at the ground level (750 - radius) instead of triggering game over
      const groundContactY = 750 - b.radius;
      if (b.y >= groundContactY) {
        b.y = groundContactY;
        b.vy = 0; // stop falling, timer keeps counting down
      }
    }

    // Throttle beep sounds every 600ms if any bomb timer is <= 3s
    if (alarmNeeded && Date.now() - lastAlarmTickTime > 600) {
      lastAlarmTickTime = Date.now();
      playAlarmBeep();
    }

    // 6. Collision checks: Kunais vs Bombs
    for (let i = kunais.length - 1; i >= 0; i--) {
      const k = kunais[i];
      for (let j = bombs.length - 1; j >= 0; j--) {
        const b = bombs[j];

        // Skip if this bomb was already defused or hit by this kunai
        if (k.hitBombs.includes(b.id)) continue;

        const dist = Math.hypot(k.x - b.x, k.y - b.y);
        if (dist < k.radius + b.radius) {
          // Collision!
          k.hitBombs.push(b.id);
          
          // Defuse Bomb
          playDefuseSound();
          createExplosionParticles(b.x, b.y, '#39ff14', 15);
          createExplosionParticles(b.x, b.y, '#ffff00', 8);
          bombs.splice(j, 1);
          
          score++;
          updateHUD();

          // Check for Upgrade eligibility
          let triggerUpgrade = false;
          const isMaxed = (upgrades.speed === 10 && upgrades.size === 10 && upgrades.penetration === 10);
          
          if (!isMaxed) {
            if (score > 0 && score % 20 === 0) {
              triggerUpgrade = true;
            }
          } else {
            if (scoreAtMaxed === null) {
              scoreAtMaxed = score;
            }
            if (score > scoreAtMaxed && (score - scoreAtMaxed) % 100 === 0) {
              triggerUpgrade = true;
            }
          }

          if (triggerUpgrade) {
            openUpgradeMenu();
            return; // pause loop immediately
          }

          // Penetration logic test
          const penProb = upgrades.penetration * 0.1;
          if (Math.random() >= penProb) {
            // No penetration: destroy kunai
            kunais.splice(i, 1);
            updateHUD();
            break; // break inner loop since kunai is gone
          } else {
            // Penetration: spark particle feedback
            createExplosionParticles(k.x, k.y, '#00f0ff', 5);
          }
        }
      }
    }
  }

  // 7. Update Particles (Runs even in GAMEOVER state so particles fly and fade)
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
function drawLauncher(ctx) {
  ctx.save();
  ctx.translate(launcher.x, launcher.y);

  // 1. Draw Green glowing half-dome base
  ctx.shadowBlur = 15;
  ctx.shadowColor = 'var(--neon-green)';
  ctx.fillStyle = 'rgba(57, 255, 20, 0.12)';
  ctx.strokeStyle = 'var(--neon-green)';
  ctx.lineWidth = 3.5;
  
  ctx.beginPath();
  ctx.arc(0, 0, launcher.radius, Math.PI, 0);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // 2. Draw rotating aiming barrel pointer
  ctx.save();
  ctx.rotate(launcher.aimAngle + Math.PI / 2); // Rotate straight up

  // Draw glowing aiming guide line
  ctx.strokeStyle = 'rgba(0, 240, 255, 0.2)';
  ctx.lineWidth = 2.5;
  ctx.setLineDash([8, 12]);
  ctx.shadowBlur = 0;
  ctx.beginPath();
  ctx.moveTo(0, -25);
  ctx.lineTo(0, -600);
  ctx.stroke();
  ctx.setLineDash([]); // reset

  // Barrel metal launcher tube
  ctx.fillStyle = '#0a1d0f';
  ctx.strokeStyle = 'var(--neon-cyan)';
  ctx.lineWidth = 2;
  ctx.fillRect(-10, -32, 20, 26);
  ctx.strokeRect(-10, -32, 20, 26);

  // Barrel glowing nozzle ring
  ctx.fillStyle = '#ffffff';
  ctx.shadowBlur = 6;
  ctx.shadowColor = 'var(--neon-cyan)';
  ctx.fillRect(-12, -37, 24, 5);

  ctx.restore();
  ctx.restore();
}

function drawKunai(ctx, x, y, angle, scale) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  ctx.scale(scale, scale);

  ctx.shadowBlur = 10;
  ctx.shadowColor = 'var(--neon-cyan)';
  ctx.strokeStyle = 'var(--neon-cyan)';
  ctx.fillStyle = 'rgba(0, 240, 255, 0.15)';
  ctx.lineWidth = 2;

  // Draw Japanese Kunai Dagger Path
  ctx.beginPath();
  // Tip pointing right (0 rad orientation)
  ctx.moveTo(20, 0);
  ctx.lineTo(5, -6);
  ctx.lineTo(-10, -6);
  // Grip hilt
  ctx.lineTo(-10, -2);
  ctx.lineTo(-24, -2);
  // Ring pommel at end of grip
  ctx.arc(-26, 0, 4, 0, Math.PI * 2);
  ctx.moveTo(-24, 2);
  ctx.lineTo(-10, 2);
  ctx.lineTo(-10, 6);
  ctx.lineTo(5, 6);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // White inner razor edge highlight
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(-8, 0);
  ctx.lineTo(18, 0);
  ctx.stroke();

  ctx.restore();
}

function drawBomb(ctx, bomb) {
  ctx.save();
  ctx.translate(bomb.x, bomb.y);

  // Glow color changes depending on warning state
  const isEmergency = bomb.timer <= 3.0;
  const glowColor = isEmergency ? 'var(--neon-red)' : 'var(--neon-yellow)';
  
  // 1. Draw dark bomb body
  ctx.shadowBlur = 12;
  ctx.shadowColor = glowColor;
  ctx.fillStyle = '#0f1411';
  ctx.strokeStyle = glowColor;
  ctx.lineWidth = 2.5;

  ctx.beginPath();
  ctx.arc(0, 0, bomb.radius, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  // 2. Draw bomb metal collar / fuse neck
  ctx.fillStyle = '#261b0c';
  ctx.fillRect(-6, -bomb.radius - 5, 12, 6);
  ctx.strokeRect(-6, -bomb.radius - 5, 12, 6);

  // 3. Draw fuse line
  ctx.strokeStyle = '#ff9000';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(0, -bomb.radius - 5);
  ctx.quadraticCurveTo(8, -bomb.radius - 12, 4, -bomb.radius - 16);
  ctx.stroke();

  // 4. Draw warning/timer overlay label
  ctx.shadowBlur = 0; // reset
  ctx.fillStyle = isEmergency ? '#ff003c' : '#ffffff';
  ctx.font = "900 13px 'Orbitron', sans-serif";
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  
  // Display countdown timer (formatted, e.g. 7.4s)
  const displayTimer = bomb.timer.toFixed(1);
  ctx.fillText(displayTimer, 0, 0);

  ctx.restore();
}

function varToString(varName) {
  return getComputedStyle(document.documentElement).getPropertyValue(varName).trim();
}

function render() {
  // Clear frame
  ctx.fillStyle = '#06040d';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Draw Grid lines on playground
  ctx.strokeStyle = 'rgba(57, 255, 20, 0.015)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let x = 50; x < 800; x += 50) {
    ctx.moveTo(x, 0); ctx.lineTo(x, 750);
  }
  for (let y = 50; y < 750; y += 50) {
    ctx.moveTo(0, y); ctx.lineTo(800, y);
  }
  ctx.stroke();

  // Draw Ground base panel (Bottom 50px, Y: [750, 800])
  const groundY = 750;
  const groundGrad = ctx.createLinearGradient(0, groundY - 15, 0, groundY);
  groundGrad.addColorStop(0, 'rgba(57, 255, 20, 0.18)');
  groundGrad.addColorStop(0.3, 'rgba(57, 255, 20, 0.05)');
  groundGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
  
  ctx.fillStyle = groundGrad;
  ctx.fillRect(0, groundY - 15, canvas.width, 15);

  ctx.strokeStyle = 'rgba(57, 255, 20, 0.65)';
  ctx.lineWidth = 3.5;
  ctx.shadowBlur = 10;
  ctx.shadowColor = 'var(--neon-green)';
  ctx.beginPath();
  ctx.moveTo(0, groundY);
  ctx.lineTo(canvas.width, groundY);
  ctx.stroke();
  ctx.shadowBlur = 0; // reset

  // Draw Ground metal plate
  ctx.fillStyle = '#07160b';
  ctx.fillRect(0, groundY, canvas.width, canvas.height - groundY);
  
  // Tech panel grid lines under launcher
  ctx.strokeStyle = 'rgba(255, 255, 0, 0.1)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  for (let x = 80; x < canvas.width; x += 80) {
    ctx.moveTo(x, groundY);
    ctx.lineTo(x, canvas.height);
  }
  ctx.stroke();

  // Render Launcher
  drawLauncher(ctx);

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

  // Render Bombs
  bombs.forEach(b => {
    drawBomb(ctx, b);
  });

  // Render Active Kunais
  kunais.forEach(k => {
    drawKunai(ctx, k.x, k.y, k.angle, k.sizeMultiplier);
  });
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
// 6. Game State Actions & Upgrades Management
// --------------------------------------------------------------------------
function startGame() {
  initAudio();
  
  gameState = 'PLAYING';
  score = 0;
  difficultyFactor = 1.0;
  speedIncreaseTimer = 0;
  spawnTimer = 0;
  spawnInterval = 2800;
  
  // Reset upgrade levels
  upgrades.speed = 0;
  upgrades.size = 0;
  upgrades.penetration = 0;
  upgrades.quantity = 1;
  scoreAtMaxed = null;

  bombs = [];
  kunais = [];
  particles = [];

  // Toggle DOM components
  overlayStart.classList.remove('active');
  overlayUpgrade.classList.remove('active');
  overlayGameOver.classList.remove('active');
  
  statusDot.classList.remove('offline');
  btnStartHeader.querySelector('.btn-text').innerText = 'DEFENSE ACTIVE';
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
      osc.frequency.setValueAtTime(400, audioCtx.currentTime + 0.15);
      gain.gain.setValueAtTime(0.06, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.25);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start();
      osc.stop(audioCtx.currentTime + 0.25);
    } catch (e) {}
  }
  
  setTimeout(() => {
    toastWarning.classList.remove('show');
  }, 1800);
}

function triggerGameOver(detonatedBomb) {
  gameState = 'GAMEOVER';
  
  playExplosionSound();
  
  // Explosion particle burst centered on detonated bomb
  if (detonatedBomb) {
    createExplosionParticles(detonatedBomb.x, detonatedBomb.y, '#ff3131', 40);
    createExplosionParticles(detonatedBomb.x, detonatedBomb.y, '#ffff00', 30);
    const idx = bombs.indexOf(detonatedBomb);
    if (idx !== -1) {
      bombs.splice(idx, 1);
    }
  }
  
  // Clear flying kunais to clean up screen
  kunais = [];

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

  finalScoreVal.innerText = score;
  playerNameInput.value = '';
  playerNameInput.disabled = false;
  btnSubmitScore.disabled = false;
  submissionError.style.display = 'none';

  overlayGameOver.classList.add('active');
  
  renderLeaderboards();
}

function updateHUD() {
  const formatted = String(score).padStart(3, '0');
  scoreVal.innerText = formatted;
  
  // Ammo Panel: active flying kunais vs total allowed quantity
  const current = upgrades.quantity - kunais.length;
  ammoStatusVal.innerText = `AMMO ${Math.max(0, current)}/${upgrades.quantity}`;
}

// --------------------------------------------------------------------------
// Upgrade Screen Open & Select Handlers
// --------------------------------------------------------------------------
function openUpgradeMenu() {
  gameState = 'UPGRADING';
  
  const isMaxed = (upgrades.speed === 10 && upgrades.size === 10 && upgrades.penetration === 10);
  
  if (!isMaxed) {
    // Populate standard upgrade levels
    txtSpeed.innerText = `Lv. ${upgrades.speed} / 10`;
    fillSpeed.style.width = `${upgrades.speed * 10}%`;
    btnUpSpeed.disabled = upgrades.speed >= 10;
    btnUpSpeed.innerText = upgrades.speed >= 10 ? 'MAXED' : '강화 SELECT';

    txtSize.innerText = `Lv. ${upgrades.size} / 10`;
    fillSize.style.width = `${upgrades.size * 10}%`;
    btnUpSize.disabled = upgrades.size >= 10;
    btnUpSize.innerText = upgrades.size >= 10 ? 'MAXED' : '강화 SELECT';

    txtPenetration.innerText = `Lv. ${upgrades.penetration} / 10`;
    fillPenetration.style.width = `${upgrades.penetration * 10}%`;
    btnUpPenetration.disabled = upgrades.penetration >= 10;
    btnUpPenetration.innerText = upgrades.penetration >= 10 ? 'MAXED' : '강화 SELECT';

    // Show standard card box, hide special box
    upgradeStandardOptions.classList.remove('hidden');
    upgradeSpecialBox.classList.add('hidden');
  } else {
    // Standard is fully maxed, show Special quantity upgrade
    txtQuantity.innerText = `현재 수량: ${upgrades.quantity}개`;
    
    // Hide standard card box, show special box
    upgradeStandardOptions.classList.add('hidden');
    upgradeSpecialBox.classList.remove('hidden');
  }

  overlayUpgrade.classList.add('active');
}

function selectUpgrade(type) {
  if (type === 'speed' && upgrades.speed < 10) {
    upgrades.speed++;
  } else if (type === 'size' && upgrades.size < 10) {
    upgrades.size++;
  } else if (type === 'penetration' && upgrades.penetration < 10) {
    upgrades.penetration++;
  } else if (type === 'quantity') {
    upgrades.quantity++;
  }

  playUpgradeSelectSound();
  overlayUpgrade.classList.remove('active');
  
  // Close menu and resume playing
  gameState = 'PLAYING';
  updateHUD();
  lastTime = performance.now();
}

btnUpSpeed.addEventListener('click', () => selectUpgrade('speed'));
btnUpSize.addEventListener('click', () => selectUpgrade('size'));
btnUpPenetration.addEventListener('click', () => selectUpgrade('penetration'));
btnUpQuantity.addEventListener('click', () => selectUpgrade('quantity'));

// --------------------------------------------------------------------------
// 7. Rankings Persistence (localStorage Top 20)
// --------------------------------------------------------------------------
const RANKINGS_KEY = 'kunai_storm_rankings';

const defaultRankings = [
  { name: 'KUNAI_LORD', score: 120, date: '2026-06-02 12:10' },
  { name: 'DEFENDER_X', score: 95, date: '2026-06-03 18:35' },
  { name: 'SHINOBI_Z', score: 80, date: '2026-06-01 22:40' },
  { name: 'BLADE_MASTER', score: 65, date: '2026-06-04 15:15' },
  { name: 'PILOT_404', score: 50, date: '2026-06-02 09:05' },
  { name: 'FUSE_SQUAD', score: 35, date: '2026-06-05 13:20' },
  { name: 'RECRUIT_C', score: 20, date: '2026-06-04 08:50' },
  { name: 'GENIN_B', score: 10, date: '2026-06-05 11:00' }
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
    showError("대원 코드를 입력해 주세요.");
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
  
  saveRanking(rawName, score);
  
  playerNameInput.disabled = true;
  btnSubmitScore.disabled = true;
  submissionError.style.display = 'none';
  
  renderLeaderboards(rawName);
}

function showError(msg) {
  submissionError.innerText = msg;
  submissionError.style.display = 'block';
}

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

// Initialize loop
requestAnimationFrame(loop);
