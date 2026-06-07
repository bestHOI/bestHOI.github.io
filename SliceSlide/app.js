/* ==========================================================================
   SliceSlide - Core Game Loop & Physics Logic
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
const toastPerfect = document.getElementById('toast-perfect');
const audioWarmupToast = document.getElementById('audio-warmup-toast');

const finalScoreVal = document.getElementById('final-score-val');
const playerNameInput = document.getElementById('player-name');
const submissionError = document.getElementById('submission-error');
const leaderboardBody = document.getElementById('leaderboard-body');
const modalLeaderboardBody = document.getElementById('modal-leaderboard-body');
const statusDot = document.querySelector('.status-indicator-dot');

// Game State Variables
let gameState = 'START'; // 'START' | 'PLAYING' | 'GAMEOVER'
let score = 0;
let baseSpeed = 3.5; // Base velocity of sliding blocks
let speedMultiplier = 1.0;
let lastTime = 0;

// Grid Block Vectors
let targetBlock = { x: 300, y: 300, w: 200, h: 200 }; // Centered initial 200x200 block
let slideBlock = { x: -200, y: 300, w: 200, h: 200, vx: 0, vy: 0 };
let slideDirection = 0; // 0: L->R | 1: T->B | 2: R->L | 3: B->T
let perfectToastSide = 'left'; // Alternates between 'left' and 'right' corner placements

// Entity Pools
let stars = [];
let fallingSlices = [];

// Physics Constants
const gravity = 0.45; // g-force for slice debris dropping
const perfectThreshold = 3.0; // Margin in pixels to reward a perfect alignment!

// Synthesized Audio Context
let audioCtx = null;

// Initialize Starfield once
function initStars() {
  stars = [];
  for (let i = 0; i < 70; i++) {
    stars.push({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height,
      size: Math.random() * 2 + 0.5,
      opacity: Math.random() * 0.7 + 0.2
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
    
    // Flash visual audio ready
    audioWarmupToast.classList.remove('hidden');
    setTimeout(() => {
      audioWarmupToast.classList.add('hidden');
    }, 1800);
  }
}

function playPlaceSound() {
  if (!audioCtx) return;
  if (audioCtx.state === 'suspended') audioCtx.resume();
  
  try {
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(320, audioCtx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(620, audioCtx.currentTime + 0.12);
    
    gain.gain.setValueAtTime(0.2, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.005, audioCtx.currentTime + 0.12);
    
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    
    osc.start();
    osc.stop(audioCtx.currentTime + 0.12);
  } catch (e) {}
}

function playPerfectSound() {
  if (!audioCtx) return;
  if (audioCtx.state === 'suspended') audioCtx.resume();
  
  try {
    // Generate a beautiful perfect dual major chord (C5 & G5) for visual triumph
    const osc1 = audioCtx.createOscillator();
    const osc2 = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(523.25, audioCtx.currentTime); // C5
    osc1.frequency.exponentialRampToValueAtTime(1046.50, audioCtx.currentTime + 0.22); // Ascend C6
    
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(783.99, audioCtx.currentTime); // G5
    osc2.frequency.exponentialRampToValueAtTime(1567.98, audioCtx.currentTime + 0.22); // Ascend G6
    
    gain.gain.setValueAtTime(0.22, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.005, audioCtx.currentTime + 0.24);
    
    osc1.connect(gain);
    osc2.connect(gain);
    gain.connect(audioCtx.destination);
    
    osc1.start();
    osc2.start();
    osc1.stop(audioCtx.currentTime + 0.24);
    osc2.stop(audioCtx.currentTime + 0.24);
  } catch (e) {}
}

function playGameOverSound() {
  if (!audioCtx) return;
  if (audioCtx.state === 'suspended') audioCtx.resume();
  
  try {
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(320, audioCtx.currentTime);
    osc.frequency.linearRampToValueAtTime(30, audioCtx.currentTime + 0.8);
    
    gain.gain.setValueAtTime(0.35, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.005, audioCtx.currentTime + 0.85);
    
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    
    osc.start();
    osc.stop(audioCtx.currentTime + 0.85);
  } catch (e) {}
}

// --------------------------------------------------------------------------
// 3. Spawning & Movement Mechanics
// --------------------------------------------------------------------------
function spawnSlidingBlock() {
  // Width and height of new sliding block matches the current target base dimensions!
  slideBlock.w = targetBlock.w;
  slideBlock.h = targetBlock.h;
  
  // Slide velocity increases gently as the operator scores higher
  const speed = baseSpeed + score * 0.05;
  
  switch (slideDirection) {
    case 0: // Left to Right (Horizontal positive)
      slideBlock.x = -slideBlock.w - 10;
      slideBlock.y = targetBlock.y;
      slideBlock.vx = speed;
      slideBlock.vy = 0;
      break;
      
    case 1: // Top to Bottom (Vertical positive)
      slideBlock.x = targetBlock.x;
      slideBlock.y = -slideBlock.h - 10;
      slideBlock.vx = 0;
      slideBlock.vy = speed;
      break;
      
    case 2: // Right to Left (Horizontal negative)
      slideBlock.x = canvas.width + 10;
      slideBlock.y = targetBlock.y;
      slideBlock.vx = -speed;
      slideBlock.vy = 0;
      break;
      
    case 3: // Bottom to Top (Vertical negative)
      slideBlock.x = targetBlock.x;
      slideBlock.y = canvas.height + 10;
      slideBlock.vx = 0;
      slideBlock.vy = -speed;
      break;
  }
}

function createSliceDebris(x, y, w, h, vx, vy, color) {
  // Spawn a block fragment matching the exact sliced dimensions
  fallingSlices.push({
    x: x,
    y: y,
    w: w,
    h: h,
    vx: vx,
    vy: vy,
    rot: 0,
    rotSpeed: (Math.random() - 0.5) * 0.15, // dynamic spinning tumble
    alpha: 1.0,
    color: color
  });
}

// --------------------------------------------------------------------------
// 4. Overlap & Slicing calculations (Precision Slicing Engine)
// --------------------------------------------------------------------------
function handlePrecisionClick() {
  if (gameState !== 'PLAYING') return;
  
  initAudio();
  
  let overlapExists = false;
  let newTarget = { x: targetBlock.x, y: targetBlock.y, w: targetBlock.w, h: targetBlock.h };
  let perfectHit = false;
  
  if (slideDirection === 0 || slideDirection === 2) {
    // Horizontal Slides: check X boundaries against target
    const xStart = Math.max(slideBlock.x, targetBlock.x);
    const xEnd = Math.min(slideBlock.x + slideBlock.w, targetBlock.x + targetBlock.w);
    const wOverlap = xEnd - xStart;
    
    if (wOverlap > 0) {
      overlapExists = true;
      newTarget.x = xStart;
      newTarget.w = wOverlap;
      
      // Calculate alignment error
      const diff = Math.abs(slideBlock.x - targetBlock.x);
      if (diff <= perfectThreshold) {
        perfectHit = true;
      } else {
        // Create sliced-off debris piece on overshoot
        if (slideBlock.x > targetBlock.x) {
          // slice piece is on the right side
          const sliceW = slideBlock.x + slideBlock.w - (targetBlock.x + targetBlock.w);
          createSliceDebris(targetBlock.x + targetBlock.w, targetBlock.y, sliceW, targetBlock.h, Math.random() * 2 + 1, -2, 'rgba(255, 0, 127, 0.7)');
        } else {
          // slice piece is on the left side
          const sliceW = targetBlock.x - slideBlock.x;
          createSliceDebris(slideBlock.x, targetBlock.y, sliceW, targetBlock.h, -(Math.random() * 2 + 1), -2, 'rgba(255, 0, 127, 0.7)');
        }
      }
    }
    
  } else {
    // Vertical Slides: check Y boundaries against target
    const yStart = Math.max(slideBlock.y, targetBlock.y);
    const yEnd = Math.min(slideBlock.y + slideBlock.h, targetBlock.y + targetBlock.h);
    const hOverlap = yEnd - yStart;
    
    if (hOverlap > 0) {
      overlapExists = true;
      newTarget.y = yStart;
      newTarget.h = hOverlap;
      
      const diff = Math.abs(slideBlock.y - targetBlock.y);
      if (diff <= perfectThreshold) {
        perfectHit = true;
      } else {
        // Create sliced-off debris piece on overshoot
        if (slideBlock.y > targetBlock.y) {
          // slice piece is on the bottom side
          const sliceH = slideBlock.y + slideBlock.h - (targetBlock.y + targetBlock.h);
          createSliceDebris(targetBlock.x, targetBlock.y + targetBlock.h, targetBlock.w, sliceH, Math.random() * 1.5 - 0.75, -3, 'rgba(0, 240, 255, 0.7)');
        } else {
          // slice piece is on the top side
          const sliceH = targetBlock.y - slideBlock.y;
          createSliceDebris(targetBlock.x, slideBlock.y, targetBlock.w, sliceH, Math.random() * 1.5 - 0.75, -2, 'rgba(0, 240, 255, 0.7)');
        }
      }
    }
  }
  
  if (overlapExists) {
    if (perfectHit) {
      // Snap to exact target block coordinates
      newTarget.x = targetBlock.x;
      newTarget.y = targetBlock.y;
      
      // Symmetrically grow by 20px in width & height, capped at 200px max
      const prevW = targetBlock.w;
      const prevH = targetBlock.h;
      newTarget.w = Math.min(200, targetBlock.w + 20);
      newTarget.h = Math.min(200, targetBlock.h + 20);
      
      // Shift coordinates outward symmetrically from current center
      newTarget.x -= (newTarget.w - prevW) / 2;
      newTarget.y -= (newTarget.h - prevH) / 2;
      
      // Safety bounds clamp to keep target fully inside 800x800 viewport
      newTarget.x = Math.max(10, Math.min(canvas.width - newTarget.w - 10, newTarget.x));
      newTarget.y = Math.max(10, Math.min(canvas.height - newTarget.h - 10, newTarget.y));
      
      triggerPerfectAlignment();
      playPerfectSound();
    } else {
      // standard slice
      playPlaceSound();
    }
    
    // Commit new target bounds
    targetBlock.x = newTarget.x;
    targetBlock.y = newTarget.y;
    targetBlock.w = newTarget.w;
    targetBlock.h = newTarget.h;
    
    score++;
    updateHUD();
    
    // Cycle direction: 0 -> 1 -> 2 -> 3 -> 0 ...
    slideDirection = (slideDirection + 1) % 4;
    
    // Trigger Speed warning at milestones
    if (score > 0 && score % 10 === 0) {
      triggerSpeedUpToast();
    }
    
    // Spawn next block
    spawnSlidingBlock();
    
  } else {
    // Clicked completely off-base! base breach!
    triggerGameOver();
  }
}

// Attach clicking triggers anywhere inside viewport frame
canvas.addEventListener('mousedown', (e) => {
  e.preventDefault();
  handlePrecisionClick();
});

// --------------------------------------------------------------------------
// 5. Game Core Loops (requestAnimationFrame)
// --------------------------------------------------------------------------
function update(dt) {
  if (gameState !== 'PLAYING') return;
  
  // 1. Move sliding block
  slideBlock.x += slideBlock.vx;
  slideBlock.y += slideBlock.vy;
  
  // 2. Check complete offscreen bypass boundary (No-Click failure)
  let offscreen = false;
  if (slideDirection === 0 && slideBlock.x > canvas.width) offscreen = true;
  else if (slideDirection === 1 && slideBlock.y > canvas.height) offscreen = true;
  else if (slideDirection === 2 && slideBlock.x + slideBlock.w < 0) offscreen = true;
  else if (slideDirection === 3 && slideBlock.y + slideBlock.h < 0) offscreen = true;
  
  if (offscreen) {
    triggerGameOver();
    return;
  }
  
  // 3. Update debris fragments pool
  for (let i = fallingSlices.length - 1; i >= 0; i--) {
    const s = fallingSlices[i];
    s.x += s.vx;
    s.y += s.vy;
    s.vy += gravity; // apply gravity pull
    s.rot += s.rotSpeed; // apply spin
    s.alpha -= 0.022; // fade
    
    if (s.alpha <= 0 || s.y > canvas.height) {
      fallingSlices.splice(i, 1);
    }
  }
}

function render() {
  // Clear viewport canvas
  ctx.fillStyle = '#05030b';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  
  // Draw starry background
  stars.forEach(star => {
    ctx.fillStyle = `rgba(255, 255, 255, ${star.opacity})`;
    ctx.beginPath();
    ctx.arc(star.x, star.y, star.size, 0, Math.PI * 2);
    ctx.fill();
  });
  
  // --------------------------------------------------------
  // A. Draw Dynamic Neon Alignment Corridor Roads
  // --------------------------------------------------------
  ctx.save();
  // Draw Horizontal glowing road corresponding to target height bounds
  ctx.fillStyle = 'rgba(255, 0, 127, 0.035)';
  ctx.fillRect(0, targetBlock.y, canvas.width, targetBlock.h);
  
  ctx.strokeStyle = 'rgba(255, 0, 127, 0.25)';
  ctx.lineWidth = 1.5;
  ctx.setLineDash([8, 12]); // neon dashes
  ctx.beginPath();
  ctx.moveTo(0, targetBlock.y);
  ctx.lineTo(canvas.width, targetBlock.y);
  ctx.moveTo(0, targetBlock.y + targetBlock.h);
  ctx.lineTo(canvas.width, targetBlock.y + targetBlock.h);
  ctx.stroke();
  
  // Draw Vertical glowing road corresponding to target width bounds
  ctx.fillStyle = 'rgba(0, 240, 255, 0.035)';
  ctx.fillRect(targetBlock.x, 0, targetBlock.w, canvas.height);
  
  ctx.strokeStyle = 'rgba(0, 240, 255, 0.25)';
  ctx.beginPath();
  ctx.moveTo(targetBlock.x, 0);
  ctx.lineTo(targetBlock.x, canvas.height);
  ctx.moveTo(targetBlock.x + targetBlock.w, 0);
  ctx.lineTo(targetBlock.x + targetBlock.w, canvas.height);
  ctx.stroke();
  ctx.restore();
  
  // --------------------------------------------------------
  // B. Draw Static Stable Base Core Block
  // --------------------------------------------------------
  ctx.save();
  const baseGrad = ctx.createLinearGradient(targetBlock.x, targetBlock.y, targetBlock.x + targetBlock.w, targetBlock.y + targetBlock.h);
  baseGrad.addColorStop(0, '#8f00ff');
  baseGrad.addColorStop(1, '#ff007f');
  
  ctx.fillStyle = baseGrad;
  ctx.shadowBlur = 12;
  ctx.shadowColor = '#ff007f';
  ctx.fillRect(targetBlock.x, targetBlock.y, targetBlock.w, targetBlock.h);
  
  // Bright neon grid accent on base block
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
  ctx.lineWidth = 2;
  ctx.strokeRect(targetBlock.x, targetBlock.y, targetBlock.w, targetBlock.h);
  ctx.restore();
  
  // --------------------------------------------------------
  // C. Draw Sliding Block (Active target)
  // --------------------------------------------------------
  if (gameState === 'PLAYING') {
    ctx.save();
    // Sliding blocks glow Cyan
    ctx.fillStyle = 'rgba(0, 240, 255, 0.85)';
    ctx.shadowBlur = 15;
    ctx.shadowColor = '#00f0ff';
    ctx.fillRect(slideBlock.x, slideBlock.y, slideBlock.w, slideBlock.h);
    
    // Core white border for crisp arcade definition
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(slideBlock.x, slideBlock.y, slideBlock.w, slideBlock.h);
    ctx.restore();
  }
  
  // --------------------------------------------------------
  // D. Draw Falling Slices (Debris blocks with gravity)
  // --------------------------------------------------------
  fallingSlices.forEach(s => {
    ctx.save();
    ctx.translate(s.x + s.w/2, s.y + s.h/2);
    ctx.rotate(s.rot); // spin
    ctx.globalAlpha = s.alpha;
    
    ctx.fillStyle = s.color;
    ctx.shadowBlur = 10;
    ctx.shadowColor = s.color;
    ctx.fillRect(-s.w/2, -s.h/2, s.w, s.h);
    
    ctx.strokeStyle = 'rgba(255,255,255,0.7)';
    ctx.lineWidth = 1.2;
    ctx.strokeRect(-s.w/2, -s.h/2, s.w, s.h);
    ctx.restore();
  });
  ctx.globalAlpha = 1.0; // reset
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
// 6. Action Triggers
// --------------------------------------------------------------------------
function startGame() {
  initAudio();
  
  gameState = 'PLAYING';
  score = 0;
  baseSpeed = 3.5;
  speedMultiplier = 1.0;
  slideDirection = 0;
  
  // Reset target stack base to central 200x200
  targetBlock = { x: 300, y: 300, w: 200, h: 200 };
  fallingSlices = [];
  
  // Hide UI overlays
  overlayStart.classList.remove('active');
  overlayGameOver.classList.remove('active');
  
  updateHUD();
  spawnSlidingBlock();
  
  // Status panel light toggle
  statusDot.classList.remove('offline');
  btnStartHeader.querySelector('.btn-text').innerText = 'ALIGNING CORE';
  btnStartHeader.disabled = true; // block double starts
  
  lastTime = performance.now();
}

function triggerPerfectAlignment() {
  toastPerfect.querySelector('.perfect-txt').innerText = `+${score} PRECISE FIT`;
  
  // Remove existing position and visual classes
  toastPerfect.classList.remove('top-left', 'top-right', 'show');
  
  // Alternate positions to keep center viewport clear
  if (perfectToastSide === 'left') {
    toastPerfect.classList.add('top-left');
    perfectToastSide = 'right';
  } else {
    toastPerfect.classList.add('top-right');
    perfectToastSide = 'left';
  }
  
  // Trigger DOM reflow to ensure CSS transitions play smoothly
  void toastPerfect.offsetWidth;
  
  toastPerfect.classList.add('show');
  
  // Golden visual screen border flash reward!
  const viewport = document.querySelector('.game-viewport');
  viewport.classList.add('flash-gold-anim');
  
  setTimeout(() => {
    toastPerfect.classList.remove('show');
  }, 1200);
  
  setTimeout(() => {
    viewport.classList.remove('flash-gold-anim');
  }, 350);
}

function triggerSpeedUpToast() {
  toastWarning.classList.add('show');
  
  if (audioCtx) {
    try {
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(600, audioCtx.currentTime);
      osc.frequency.setValueAtTime(800, audioCtx.currentTime + 0.1);
      gain.gain.setValueAtTime(0.06, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.18);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start();
      osc.stop(audioCtx.currentTime + 0.18);
    } catch (e) {}
  }
  
  setTimeout(() => {
    toastWarning.classList.remove('show');
  }, 1800);
}

function triggerGameOver() {
  gameState = 'GAMEOVER';
  
  playGameOverSound();
  
  // Visual screen shake fail transition
  const viewport = document.querySelector('.game-viewport');
  viewport.classList.add('shake-anim');
  setTimeout(() => {
    viewport.classList.remove('shake-anim');
  }, 450);
  
  statusDot.classList.add('offline');
  btnStartHeader.querySelector('.btn-text').innerText = 'CORE OFFLINE';
  btnStartHeader.disabled = false;
  
  finalScoreVal.innerText = score;
  playerNameInput.value = '';
  playerNameInput.disabled = false;
  btnSubmitScore.disabled = false;
  submissionError.style.display = 'none';
  
  overlayGameOver.classList.add('active');
  
  // Refresh leaderboards
  renderLeaderboards();
}

function updateHUD() {
  const formatted = String(score).padStart(3, '0');
  scoreVal.innerText = formatted;
}

// --------------------------------------------------------------------------
// 7. Rankings Persistence (localStorage Top 20)
// --------------------------------------------------------------------------
const RANKINGS_KEY = 'slice_slide_rankings';

const defaultRankings = [
  { name: 'ALIGN_MASTER', score: 32, date: '2026-05-28 14:10' },
  { name: 'STACK_GOD', score: 28, date: '2026-05-27 19:35' },
  { name: 'NEON_GRID', score: 24, date: '2026-05-29 02:40' },
  { name: 'SLICE_ACE', score: 20, date: '2026-05-28 22:15' },
  { name: 'BARRIER_Z', score: 16, date: '2026-05-29 11:05' },
  { name: 'FUSION_2', score: 14, date: '2026-05-26 13:20' },
  { name: 'CHRONO_1', score: 11, date: '2026-05-27 08:50' },
  { name: 'GLIDE_CORE', score: 9, date: '2026-05-29 18:00' },
  { name: 'STACKER_A', score: 6, date: '2026-05-25 15:45' },
  { name: 'RECRUIT_B', score: 3, date: '2026-05-28 09:12' }
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
// 8. User Interface Event Listeners
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
  
  if (rawName.length === 0) {
    submissionError.innerText = "OPERATOR SIGNATURE CANNOT BE EMPTY";
    submissionError.style.display = 'block';
    return;
  }
  
  if (rawName.length < 2) {
    submissionError.innerText = "SIGNATURE MUST HAVE AT LEAST 2 CHARACTERS";
    submissionError.style.display = 'block';
    return;
  }
  
  submissionError.style.display = 'none';
  
  saveRanking(rawName, score);
  renderLeaderboards(rawName);
  
  playerNameInput.disabled = true;
  btnSubmitScore.disabled = true;
  
  const lbSection = document.querySelector('.leaderboard-table-container');
  lbSection.scrollIntoView({ behavior: 'smooth' });
}

// --------------------------------------------------------------------------
// 9. Startup Initialization
// --------------------------------------------------------------------------
initStars();
renderLeaderboards();

// Start background animations loop immediately
requestAnimationFrame(loop);
