/* ==========================================================================
   NEON SHELL - Game Engine & Logical Controller
   ========================================================================== */

// --------------------------------------------------------------------------
// 1. DOM Elements & Initialization
// --------------------------------------------------------------------------
const canvas = document.getElementById('game-canvas');
const ctx = canvas.getContext('2d');

const stageVal = document.getElementById('stage-val');
const timerBar = document.getElementById('timer-bar');
const statusText = document.getElementById('status-text');

const overlayStart = document.getElementById('overlay-start');
const overlayGameOver = document.getElementById('overlay-gameover');
const btnStartOverlay = document.getElementById('btn-start-overlay');
const btnRestart = document.getElementById('btn-restart');
const btnSubmitScore = document.getElementById('btn-submit-score');
const btnViewRanking = document.getElementById('btn-view-ranking');

const finalStageVal = document.getElementById('final-stage-val');
const playerNameInput = document.getElementById('player-name');
const submissionError = document.getElementById('submission-error');
const leaderboardBody = document.getElementById('leaderboard-body');
const modalLeaderboardBody = document.getElementById('modal-leaderboard-body');
const modalRanking = document.getElementById('modal-ranking');
const btnCloseModal = document.getElementById('btn-close-modal');

const toastWarmup = document.getElementById('audio-warmup-toast');

// --------------------------------------------------------------------------
// 2. Global Game Variables
// --------------------------------------------------------------------------
let gameState = 'START'; // 'START' | 'REVEAL_START' | 'COVER' | 'SHUFFLING' | 'WAIT_CHOICE' | 'REVEAL_CHOICE' | 'GAMEOVER'
let stage = 1;
let lastTime = 0;

// Shuffling Configs
let cups = [];
let ballIndex = 0; // The index of the cup containing the golden sphere
let revealTimer = 0;
let choiceTimer = 5.0; // 5 seconds limit
const maxChoiceTime = 5.0;

// Shuffling movement state
let shuffleQueue = []; // array of pairs to swap e.g. [[0, 1], [2, 0]]
let currentSwap = null; // { idxA, idxB, progress, speed, arcDir }
let shuffleCount = 0;
let totalShufflesNeeded = 0;

// Particle arrays
let particles = [];

// Web Audio API Synthesis
let audioCtx = null;
let lastBeepSecond = 5;

// Cup Layout Config
const cupRadius = 50;
const centerY = 450;

// --------------------------------------------------------------------------
// 3. Web Audio Synth Engine
// --------------------------------------------------------------------------
function initAudio() {
  if (audioCtx) return;
  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  if (AudioContextClass) {
    audioCtx = new AudioContextClass();
    
    // Toast alert warmup
    toastWarmup.classList.add('show');
    setTimeout(() => {
      toastWarmup.classList.remove('show');
    }, 1800);
  }
}

function playSound(type) {
  if (!audioCtx) return;
  if (audioCtx.state === 'suspended') audioCtx.resume();

  try {
    const now = audioCtx.currentTime;
    
    if (type === 'lift') {
      // Ascending slide tone
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(180, now);
      osc.frequency.exponentialRampToValueAtTime(650, now + 0.35);
      gain.gain.setValueAtTime(0.12, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start();
      osc.stop(now + 0.35);
    } 
    else if (type === 'lower') {
      // Thump drop tone
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(150, now);
      osc.frequency.exponentialRampToValueAtTime(40, now + 0.15);
      gain.gain.setValueAtTime(0.2, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start();
      osc.stop(now + 0.15);
    }
    else if (type === 'shuffle') {
      // Soft woosh sound
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(220, now);
      osc.frequency.quadraticCurveToValueAtTime(120, now + 0.1, now + 0.25);
      gain.gain.setValueAtTime(0.08, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start();
      osc.stop(now + 0.25);
    }
    else if (type === 'beep') {
      // High alarm beep
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(800, now);
      gain.gain.setValueAtTime(0.05, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start();
      osc.stop(now + 0.1);
    }
    else if (type === 'correct') {
      // Double positive ring
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(440, now);
      osc.frequency.setValueAtTime(554.37, now + 0.08); // C#5
      osc.frequency.setValueAtTime(659.25, now + 0.16); // E5
      gain.gain.setValueAtTime(0.15, now);
      gain.gain.exponentialRampToValueAtTime(0.005, now + 0.45);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start();
      osc.stop(now + 0.45);
    }
    else if (type === 'wrong') {
      // Harsh buzzer explosion
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(180, now);
      osc.frequency.linearRampToValueAtTime(60, now + 0.5);
      gain.gain.setValueAtTime(0.25, now);
      gain.gain.exponentialRampToValueAtTime(0.005, now + 0.6);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start();
      osc.stop(now + 0.6);
    }
  } catch (e) {
    console.error("Audio Synthesis Interrupted:", e);
  }
}

// --------------------------------------------------------------------------
// 4. Setup Cups & Stage Config
// --------------------------------------------------------------------------
function setupStage(currentStage) {
  // Clear pools
  cups = [];
  shuffleQueue = [];
  currentSwap = null;
  
  // Decide how many cups are needed based on stage
  // Stage 1 = 2 cups, Stage 2 = 3 cups, Stage 3 = 4 cups, Stage 4+ = 5 cups, etc.
  const numCups = Math.min(6, 1 + currentStage);
  
  // Distribute basic spacing coordinates along horizontal center line (Y = 450)
  // Total playground X space is 800px. Margin of 80px left and right.
  const totalPlayWidth = 800;
  const margin = 120;
  const slotWidth = (totalPlayWidth - margin * 2) / (numCups - 1 || 1);

  for (let i = 0; i < numCups; i++) {
    const defaultX = (numCups === 1) ? 400 : margin + i * slotWidth;
    cups.push({
      id: i,
      x: defaultX,
      y: centerY,
      baseX: defaultX,
      baseY: centerY,
      revealYOffset: 0, // for rising reveal animation
      isTarget: false
    });
  }

  // Hide the Golden Ball randomly under one of the cups
  ballIndex = Math.floor(Math.random() * numCups);
  cups[ballIndex].isTarget = true;

  // Configure shuffle counts and swap speeds
  // Shuffling needs more speed and shuffles in later stages
  totalShufflesNeeded = 3 + currentStage * 2; // e.g. 5 shuffles for stage 1
  shuffleCount = 0;
  
  // We want the shuffle to be observable, not too fast
  // Progression speed caps at 0.5s per swap
  const baseSpeed = 1.45; // lower is faster (seconds per swap)
  const swapDuration = Math.max(0.48, baseSpeed - (currentStage * 0.08)); 
  
  // Build queue of swaps
  // Make sure we shuffle adjacent or non-adjacent cups randomly
  for (let s = 0; s < totalShufflesNeeded; s++) {
    let idxA = Math.floor(Math.random() * numCups);
    let idxB = Math.floor(Math.random() * numCups);
    while (idxA === idxB) {
      idxB = Math.floor(Math.random() * numCups);
    }
    shuffleQueue.push({ idxA, idxB, duration: swapDuration * 1000 });
  }

  // Reset HUD Time Bar UI
  timerBar.style.width = '0%';
  stageVal.innerText = String(currentStage).padStart(2, '0');
}

// --------------------------------------------------------------------------
// 5. Game Core Loop (State Machine Updates)
// --------------------------------------------------------------------------
function update(dt) {
  // Update particles
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.x += p.vx;
    p.y += p.vy;
    p.alpha -= p.decay;
    if (p.alpha <= 0) {
      particles.splice(i, 1);
    }
  }

  if (gameState === 'REVEAL_START') {
    statusText.innerText = "REVEAL COIN";
    revealTimer += dt;
    
    // Lift cups up smoothly for first 0.6s
    cups.forEach(c => {
      if (revealTimer <= 600) {
        c.revealYOffset = easeOutQuad(revealTimer, 0, -100, 600);
      }
    });

    // Stay elevated for 0.7s, then cover back down
    if (revealTimer >= 1400) {
      gameState = 'COVER';
      revealTimer = 0;
      playSound('lower');
    }
  }
  
  else if (gameState === 'COVER') {
    statusText.innerText = "COVERING";
    revealTimer += dt;
    cups.forEach(c => {
      if (revealTimer <= 500) {
        c.revealYOffset = easeOutQuad(revealTimer, -100, 100, 500);
      } else {
        c.revealYOffset = 0;
      }
    });

    if (revealTimer >= 600) {
      gameState = 'SHUFFLING';
      revealTimer = 0;
      triggerNextSwap();
    }
  }
  
  else if (gameState === 'SHUFFLING') {
    statusText.innerText = "SHUFFLING";
    
    if (currentSwap) {
      currentSwap.progress += dt;
      let t = currentSwap.progress / currentSwap.duration;
      if (t >= 1.0) {
        t = 1.0;
        
        // Lock final base positions for swap
        const cupA = cups[currentSwap.idxA];
        const cupB = cups[currentSwap.idxB];
        
        const tempX = cupA.baseX;
        cupA.baseX = cupB.baseX;
        cupB.baseX = tempX;
        
        cupA.x = cupA.baseX;
        cupB.x = cupB.baseX;
        cupA.y = centerY;
        cupB.y = centerY;
        
        // Proceed to next swap in queue
        shuffleCount++;
        currentSwap = null;
        triggerNextSwap();
      } else {
        // Evaluate Circular Arc position interpolation
        const cupA = cups[currentSwap.idxA];
        const cupB = cups[currentSwap.idxB];
        
        const startX = cupA.baseX;
        const endX = cupB.baseX;
        const midX = (startX + endX) / 2;
        const dist = Math.abs(endX - startX);
        
        // Angle goes from 0 to PI
        const angle = t * Math.PI;
        
        // A curves upward or downward depending on arcDir
        cupA.x = midX - (dist / 2) * Math.cos(angle);
        cupA.y = centerY - (dist / 2) * Math.sin(angle) * currentSwap.arcDir;
        
        // B moves in opposite curve direction
        cupB.x = midX + (dist / 2) * Math.cos(angle);
        cupB.y = centerY + (dist / 2) * Math.sin(angle) * currentSwap.arcDir;
      }
    }
  }
  
  else if (gameState === 'WAIT_CHOICE') {
    statusText.innerText = "CHOOSE!";
    choiceTimer -= dt / 1000;
    
    // Shrink timer gauge bar
    const pct = Math.max(0, (choiceTimer / maxChoiceTime) * 100);
    timerBar.style.width = `${pct}%`;
    
    // Play countdown beep sounds in last 3 seconds
    const currentCeilSecond = Math.ceil(choiceTimer);
    if (choiceTimer > 0 && currentCeilSecond <= 3 && currentCeilSecond !== lastBeepSecond) {
      lastBeepSecond = currentCeilSecond;
      playSound('beep');
    }

    if (choiceTimer <= 0) {
      choiceTimer = 0;
      timerBar.style.width = '0%';
      // Game Over by Timeout
      playSound('wrong');
      triggerGameOver();
    }
  }
  
  else if (gameState === 'REVEAL_CHOICE') {
    statusText.innerText = "CONFIRMING";
    revealTimer += dt;
    
    // Lift all cups to show who was correct
    cups.forEach(c => {
      if (revealTimer <= 600) {
        c.revealYOffset = easeOutQuad(revealTimer, 0, -100, 600);
      }
    });

    if (revealTimer >= 1800) {
      revealTimer = 0;
      // Check if clicked cup is correct
      if (cups[revealIndex].isTarget) {
        // Advance Stage
        stage++;
        gameState = 'REVEAL_START';
        playSound('lift');
        setupStage(stage);
      } else {
        triggerGameOver();
      }
    }
  }
}

function triggerNextSwap() {
  if (shuffleQueue.length > 0) {
    const swap = shuffleQueue.shift();
    
    // Alternate circular arc direction (up/down) to avoid overlapping look
    const arcDir = (shuffleCount % 2 === 0) ? 0.75 : -0.75;
    
    currentSwap = {
      idxA: swap.idxA,
      idxB: swap.idxB,
      progress: 0,
      duration: swap.duration,
      arcDir: arcDir
    };
    playSound('shuffle');
  } else {
    // Shuffling is done!
    gameState = 'WAIT_CHOICE';
    choiceTimer = maxChoiceTime;
    lastBeepSecond = 5;
  }
}

// --------------------------------------------------------------------------
// 6. Graphics Render Engine (Canvas Painting)
// --------------------------------------------------------------------------
function drawCup(ctx, cup) {
  const cx = cup.x;
  const cy = cup.y + cup.revealYOffset;
  const r = cupRadius;

  ctx.save();

  // Draw Neonic shadow blur
  ctx.shadowBlur = 18;
  ctx.shadowColor = 'var(--neon-magenta)';
  ctx.strokeStyle = 'var(--neon-magenta)';
  ctx.lineWidth = 3;

  // Cup Shape: Trapezoid cup body
  ctx.fillStyle = '#0b061c';
  ctx.beginPath();
  ctx.moveTo(cx - r + 8, cy - r);      // top left
  ctx.lineTo(cx + r - 8, cy - r);      // top right
  ctx.lineTo(cx + r, cy + r - 5);      // bottom right
  ctx.lineTo(cx - r, cy + r - 5);      // bottom left
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // Cup Brim bottom line
  ctx.shadowBlur = 0;
  ctx.fillStyle = '#1c0f42';
  ctx.strokeStyle = 'var(--neon-cyan)';
  ctx.lineWidth = 2;
  
  ctx.beginPath();
  ctx.ellipse(cx, cy + r - 5, r + 4, 8, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  // Glowing core decoration (Arcade design highlights)
  ctx.shadowBlur = 8;
  ctx.shadowColor = 'var(--neon-cyan)';
  ctx.strokeStyle = 'var(--neon-cyan)';
  ctx.lineWidth = 2.5;
  
  // Center triangle emblem on the cup
  ctx.beginPath();
  ctx.moveTo(cx, cy - 20);
  ctx.lineTo(cx - 12, cy + 10);
  ctx.lineTo(cx + 12, cy + 10);
  ctx.closePath();
  ctx.stroke();

  ctx.restore();
}

function drawBall(ctx, cup) {
  // Center the ball under its parent cup baseY (rests on ground)
  const bx = cup.x;
  const by = cup.baseY + cupRadius - 10; 
  const r = 20;

  ctx.save();

  // Deep Golden Glow
  ctx.shadowBlur = 25;
  ctx.shadowColor = 'var(--neon-gold)';
  ctx.lineWidth = 2;
  ctx.strokeStyle = '#fff';

  // Radial Gold gradient
  const grad = ctx.createRadialGradient(bx - 6, by - 6, 2, bx, by, r);
  grad.addColorStop(0, '#ffffff'); // Glare spot
  grad.addColorStop(0.3, '#ffdf00'); // Shiny gold
  grad.addColorStop(0.85, '#cca300'); // Deep gold
  grad.addColorStop(1, '#664d00'); // Shadows
  
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(bx, by, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  ctx.restore();
}

function createExplosionParticles(x, y, color, count = 25) {
  for (let i = 0; i < count; i++) {
    const angle = Math.random() * Math.PI * 2;
    const speed = Math.random() * 5 + 3;
    particles.push({
      x: x,
      y: y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      size: Math.random() * 4.5 + 1.5,
      color: color,
      alpha: 1.0,
      decay: Math.random() * 0.025 + 0.012
    });
  }
}

function render() {
  // Clear Playground Canvas
  ctx.fillStyle = '#06030c';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Draw playground grid lines
  ctx.strokeStyle = 'rgba(255, 0, 127, 0.015)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let x = 50; x < canvas.width; x += 50) {
    ctx.moveTo(x, 0); ctx.lineTo(x, canvas.height);
  }
  for (let y = 50; y < canvas.height; y += 50) {
    ctx.moveTo(0, y); ctx.lineTo(canvas.width, y);
  }
  ctx.stroke();

  // Draw Ground Platform Line (Y = centerY + cupRadius)
  const floorY = centerY + cupRadius;
  ctx.shadowBlur = 10;
  ctx.shadowColor = 'var(--neon-cyan)';
  ctx.strokeStyle = 'rgba(0, 240, 255, 0.6)';
  ctx.lineWidth = 3.5;
  ctx.beginPath();
  ctx.moveTo(80, floorY);
  ctx.lineTo(720, floorY);
  ctx.stroke();
  ctx.shadowBlur = 0; // Reset

  // Ground base neon illumination reflection
  const gradient = ctx.createLinearGradient(0, floorY, 0, floorY + 40);
  gradient.addColorStop(0, 'rgba(0, 240, 255, 0.12)');
  gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');
  ctx.fillStyle = gradient;
  ctx.fillRect(80, floorY, 640, 40);

  // Draw the Golden Sphere if revealed
  // The sphere sits on the floor. It is only shown when cups are raised.
  if (gameState === 'REVEAL_START' || gameState === 'COVER' || gameState === 'REVEAL_CHOICE' || gameState === 'GAMEOVER') {
    cups.forEach(c => {
      if (c.isTarget) {
        drawBall(ctx, c);
      }
    });
  }

  // Draw the Cups on top
  cups.forEach(c => {
    drawCup(ctx, c);
  });

  // Render particles
  particles.forEach(p => {
    ctx.save();
    ctx.globalAlpha = p.alpha;
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
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
// 7. Interactive Logic & Gameplay Functions
// --------------------------------------------------------------------------
let revealIndex = -1;

function selectCup(index) {
  if (gameState !== 'WAIT_CHOICE') return;
  
  revealIndex = index;
  gameState = 'REVEAL_CHOICE';
  revealTimer = 0;

  if (cups[index].isTarget) {
    playSound('correct');
    createExplosionParticles(cups[index].x, cups[index].baseY + cupRadius - 10, 'var(--neon-gold)', 35);
  } else {
    playSound('wrong');
    createExplosionParticles(cups[index].x, cups[index].baseY + cupRadius - 10, 'var(--neon-magenta)', 30);
  }
}

canvas.addEventListener('click', (e) => {
  if (gameState !== 'WAIT_CHOICE') return;
  initAudio();

  const rect = canvas.getBoundingClientRect();
  const clickX = ((e.clientX - rect.left) / rect.width) * canvas.width;
  const clickY = ((e.clientY - rect.top) / rect.height) * canvas.height;

  // Verify distance against all cup bases
  for (let i = 0; i < cups.length; i++) {
    const c = cups[i];
    // Focus click region near the cup shape
    const dist = Math.hypot(clickX - c.x, clickY - c.y);
    if (dist < cupRadius + 15) {
      selectCup(i);
      break;
    }
  }
});

function startGame() {
  initAudio();
  stage = 1;
  gameState = 'REVEAL_START';
  revealTimer = 0;
  
  overlayStart.classList.remove('active');
  overlayGameOver.classList.remove('active');
  
  setupStage(stage);
  playSound('lift');
}

function triggerGameOver() {
  gameState = 'GAMEOVER';
  
  // Shake viewport effect
  const viewport = document.querySelector('.game-viewport');
  viewport.classList.add('shake-anim');
  setTimeout(() => {
    viewport.classList.remove('shake-anim');
  }, 450);

  finalStageVal.innerText = stage;
  playerNameInput.value = '';
  playerNameInput.disabled = false;
  btnSubmitScore.disabled = false;
  submissionError.style.display = 'none';

  overlayGameOver.classList.add('active');
  renderLeaderboards();
}

// Math easing interpolation helpers
function easeOutQuad(t, b, c, d) {
  t /= d;
  return -c * t * (t - 2) + b;
}

// --------------------------------------------------------------------------
// 8. Leaderboard persistence (localStorage)
// --------------------------------------------------------------------------
const RANKINGS_KEY = 'neon_shell_rankings';

const defaultRankings = [
  { name: 'CYBER_SHADOW', stage: 15, date: '2026-06-03 14:22' },
  { name: 'GOLD_FINDER', stage: 12, date: '2026-06-05 18:40' },
  { name: 'MATRIX_X', stage: 9, date: '2026-06-02 22:10' },
  { name: 'SHINOBI_S', stage: 7, date: '2026-06-04 11:30' },
  { name: 'KUNAI_PRO', stage: 5, date: '2026-06-06 09:05' },
  { name: 'RECRUIT_N', stage: 3, date: '2026-06-05 16:15' },
  { name: 'ROOKIE_Z', stage: 2, date: '2026-06-04 08:20' }
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
    return defaultRankings;
  }
}

function saveRanking(name, stageReached) {
  const list = getRankings();
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const hour = String(now.getHours()).padStart(2, '0');
  const minute = String(now.getMinutes()).padStart(2, '0');
  const dateStr = `${year}-${month}-${day} ${hour}:${minute}`;

  list.push({ name: name.toUpperCase(), stage: stageReached, date: dateStr });
  list.sort((a, b) => b.stage - a.stage);
  
  const top20 = list.slice(0, 20);
  try {
    localStorage.setItem(RANKINGS_KEY, JSON.stringify(top20));
  } catch (e) {}
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

    const isHighlighted = highlightName && r.name === highlightName.toUpperCase() && r.stage === stage;
    const trClass = isHighlighted ? 'class="highlighted"' : '';

    tableHTML += `
      <tr ${trClass}>
        <td class="${rankClass}">#${idx + 1}</td>
        <td>${escapeHtml(r.name)}</td>
        <td class="gold-text">${r.stage}</td>
        <td style="font-size:0.72rem; color:var(--text-muted);">${r.date}</td>
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
  
  saveRanking(rawName, stage);
  
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
// 9. Event Listeners & Bootstrapping
// --------------------------------------------------------------------------
btnStartOverlay.addEventListener('click', startGame);
btnRestart.addEventListener('click', startGame);
btnSubmitScore.addEventListener('click', performScoreSubmission);
playerNameInput.addEventListener('keypress', (e) => {
  if (e.key === 'Enter') {
    performScoreSubmission();
  }
});

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

// Fullscreen Optimization Alert (Desktop only check)
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

  if (isMobile) return; // ignore PC fullscreen blocker checks on mobile UI

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

// Render first frame & Start loop
renderLeaderboards();
lastTime = performance.now();
requestAnimationFrame(loop);
