/* ==========================================================================
   DifferentColor - Game Engine (Cyber Neon Arcade System)
   ========================================================================== */

// Game States
let score = 0;
let isPlaying = false;
let timeLeft = 5000; // 5 seconds in ms
let gridSize = 3;
let timerId = null;
let lastTimestamp = 0;
let targetIndex = -1;

// Audio System
let audioCtx = null;

// DOM Elements
const gridSizeVal = document.getElementById('grid-size-val');
const timeGaugeBar = document.getElementById('time-gauge-bar');
const btnStart = document.getElementById('btn-start');
const gridContainer = document.getElementById('grid-container');

// Overlays
const overlayStart = document.getElementById('overlay-start');
const btnStartOverlay = document.getElementById('btn-start-overlay');
const overlayGameOver = document.getElementById('overlay-gameover');
const finalScoreVal = document.getElementById('final-score-val');
const playerNameInput = document.getElementById('player-name');
const btnSubmitScore = document.getElementById('btn-submit-score');
const submissionError = document.getElementById('submission-error');
const leaderboardBody = document.getElementById('leaderboard-body');
const btnRestart = document.getElementById('btn-restart');

// Modal Elements
const btnViewRanking = document.getElementById('btn-view-ranking');
const modalRanking = document.getElementById('modal-ranking');
const btnCloseModal = document.getElementById('btn-close-modal');
const modalLeaderboardBody = document.getElementById('modal-leaderboard-body');

// Audio Warmup Toast
const audioWarmupToast = document.getElementById('audio-warmup-toast');

/* ==========================================================================
   Web Audio API Retro Synthesizer
   ========================================================================== */

function initAudio() {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    // Show audio ready toast briefly
    audioWarmupToast.classList.remove('hidden');
    setTimeout(() => {
      audioWarmupToast.classList.add('hidden');
    }, 1500);
  }
  if (audioCtx.state === 'suspended') {
    audioCtx.resume();
  }
}

function playSound(type) {
  if (!audioCtx) return;
  
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  
  osc.connect(gain);
  gain.connect(audioCtx.destination);
  
  const now = audioCtx.currentTime;
  
  if (type === 'correct') {
    // Quick ascending high-pitch electronic chime
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(450, now);
    osc.frequency.exponentialRampToValueAtTime(900, now + 0.12);
    
    gain.gain.setValueAtTime(0.15, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
    
    osc.start(now);
    osc.stop(now + 0.13);
  } 
  else if (type === 'fail') {
    // Low frequency descending synth wave crash
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(280, now);
    osc.frequency.exponentialRampToValueAtTime(60, now + 0.35);
    
    gain.gain.setValueAtTime(0.2, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
    
    osc.start(now);
    osc.stop(now + 0.36);
  }
  else if (type === 'start') {
    // Uplifting arcade startup tone
    osc.type = 'sine';
    osc.frequency.setValueAtTime(523.25, now); // C5
    osc.frequency.setValueAtTime(659.25, now + 0.08); // E5
    osc.frequency.setValueAtTime(783.99, now + 0.16); // G5
    osc.frequency.setValueAtTime(1046.50, now + 0.24); // C6
    
    gain.gain.setValueAtTime(0.1, now);
    gain.gain.setValueAtTime(0.1, now + 0.24);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.4);
    
    osc.start(now);
    osc.stop(now + 0.45);
  }
}

/* ==========================================================================
   Color Generator & Matrix Logic
   ========================================================================== */

function generateMatrix() {
  gridContainer.innerHTML = '';
  
  // N x N grid dimension: N increases every 3 stages cleared
  gridSize = 3 + Math.floor(score / 3);
  gridSizeVal.textContent = `${gridSize} X ${gridSize}`;
  gridContainer.style.setProperty('--grid-size', gridSize);
  
  const totalTiles = gridSize * gridSize;
  targetIndex = Math.floor(Math.random() * totalTiles);
  
  // 1. Generate base HSL color (rich cyberpunk parameters)
  const baseH = Math.floor(Math.random() * 360);
  const baseS = Math.floor(Math.random() * 20) + 65; // 65% - 85%
  const baseL = Math.floor(Math.random() * 10) + 45; // 45% - 55%
  
  // 2. Calculate lightness delta (scales down smoothly as score builds)
  // formula: diff = Math.max(1.0, 15 - (score * 0.4))
  const diff = Math.max(1.0, 15 - (score * 0.4));
  
  // 3. Shift target color's lightness
  const shift = Math.random() > 0.5 ? diff : -diff;
  let targetL = baseL + shift;
  
  // Clamp boundaries to prevent overflows
  if (targetL > 90) targetL = baseL - diff;
  if (targetL < 15) targetL = baseL + diff;
  
  const baseColorString = `hsl(${baseH}, ${baseS}%, ${baseL}%)`;
  const targetColorString = `hsl(${baseH}, ${baseS}%, ${targetL}%)`;
  
  // Create fragment to optimize injection
  const fragment = document.createDocumentFragment();
  
  for (let i = 0; i < totalTiles; i++) {
    const tile = document.createElement('div');
    tile.className = 'grid-tile';
    
    // Set matching colors
    if (i === targetIndex) {
      tile.style.backgroundColor = targetColorString;
      tile.dataset.target = "true";
    } else {
      tile.style.backgroundColor = baseColorString;
      tile.dataset.target = "false";
    }
    
    tile.addEventListener('click', handleTileClick);
    fragment.appendChild(tile);
  }
  
  gridContainer.appendChild(fragment);
}

function handleTileClick(e) {
  if (!isPlaying) return;
  initAudio();
  
  const isTarget = e.currentTarget.dataset.target === "true";
  
  if (isTarget) {
    // Successful hit
    playSound('correct');
    score++;
    timeLeft = 5000; // Restore timer to 100% (5.00 seconds)
    generateMatrix();
  } else {
    // Misclick -> Game Over
    playSound('fail');
    endGame();
  }
}

/* ==========================================================================
   Timer Clock loop
   ========================================================================== */

function timerTick(timestamp) {
  if (!isPlaying) return;
  
  if (!lastTimestamp) lastTimestamp = timestamp;
  const elapsed = timestamp - lastTimestamp;
  lastTimestamp = timestamp;
  
  timeLeft -= elapsed;
  
  if (timeLeft <= 0) {
    timeLeft = 0;
    playSound('fail');
    endGame();
    return;
  }
  
  // Render time bar percentage
  const percentage = (timeLeft / 5000) * 100;
  timeGaugeBar.style.width = `${percentage}%`;
  
  // Pulse critical warning under 1.5 seconds (1500ms)
  if (timeLeft <= 1500) {
    timeGaugeBar.classList.add('critical');
  } else {
    timeGaugeBar.classList.remove('critical');
  }
  
  timerId = requestAnimationFrame(timerTick);
}

/* ==========================================================================
   Core Game Controls
   ========================================================================== */

function startGame() {
  initAudio();
  playSound('start');
  
  score = 0;
  timeLeft = 5000;
  isPlaying = true;
  lastTimestamp = 0;
  
  // Toggle screens
  overlayStart.classList.remove('active');
  overlayGameOver.classList.remove('active');
  timeGaugeBar.classList.remove('critical');
  
  // Update UI Start Buttons
  btnStart.innerHTML = `<span class="btn-text">동기화 완료</span>`;
  btnStart.disabled = true;
  btnStart.style.opacity = '0.6';
  btnStart.style.pointerEvents = 'none';
  
  // Run
  generateMatrix();
  
  // Stop existing loop if any
  if (timerId) cancelAnimationFrame(timerId);
  timerId = requestAnimationFrame(timerTick);
}

function endGame() {
  isPlaying = false;
  if (timerId) cancelAnimationFrame(timerId);
  
  // Re-enable Start Button
  btnStart.disabled = false;
  btnStart.style.opacity = '1';
  btnStart.style.pointerEvents = 'auto';
  btnStart.innerHTML = `<span class="btn-text">게임 시작</span><span class="btn-glow"></span>`;
  
  // Setup Game Over View details
  finalScoreVal.textContent = score;
  overlayGameOver.classList.add('active');
  playerNameInput.value = '';
  submissionError.style.display = 'none';
  
  // Clear game matrix blocks
  gridContainer.innerHTML = '';
  
  // Refresh and draw high-scores list
  renderLeaderboard();
}

/* ==========================================================================
   Rankings Local Database Engine (Top 20 rankings list)
   ========================================================================== */

function getRankings() {
  const data = localStorage.getItem('different_color_rankings');
  return data ? JSON.parse(data) : [];
}

function saveRankings(rankings) {
  localStorage.setItem('different_color_rankings', JSON.stringify(rankings));
}

function submitScore() {
  const name = playerNameInput.value.trim().toUpperCase();
  
  if (!name) {
    showError("플레이어 이름을 입력해 주세요!");
    return;
  }
  
  if (name.length > 12) {
    showError("이름은 12글자를 초과할 수 없습니다!");
    return;
  }
  
  const rankings = getRankings();
  const timestamp = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
  
  const newEntry = {
    name: name,
    score: score,
    date: timestamp
  };
  
  rankings.push(newEntry);
  // Sort descending by score, then slice top 20
  rankings.sort((a, b) => b.score - a.score);
  const slicedRankings = rankings.slice(0, 20);
  
  saveRankings(slicedRankings);
  
  // Disable input & form elements to avoid duplicate log entries
  playerNameInput.value = '';
  btnSubmitScore.disabled = true;
  btnSubmitScore.style.opacity = '0.5';
  
  // Re-populate and display high score tables
  renderLeaderboard();
  showLeaderboardModal();
  
  // Re-enable logger button after delay
  setTimeout(() => {
    btnSubmitScore.disabled = false;
    btnSubmitScore.style.opacity = '1';
  }, 1000);
}

function showError(msg) {
  submissionError.textContent = msg;
  submissionError.style.display = 'block';
}

function renderLeaderboard() {
  const rankings = getRankings();
  
  // 1. Populate Game Over screen leaderboard
  leaderboardBody.innerHTML = '';
  if (rankings.length === 0) {
    leaderboardBody.innerHTML = `<tr><td colspan="4" style="text-align: center; color: var(--text-muted);">등록된 데이터가 없습니다. 첫 랭커가 되어보세요!</td></tr>`;
  } else {
    rankings.forEach((entry, idx) => {
      const row = document.createElement('tr');
      const rank = idx + 1;
      let rankClass = '';
      if (rank === 1) rankClass = 'rank-1';
      else if (rank === 2) rankClass = 'rank-2';
      else if (rank === 3) rankClass = 'rank-3';
      
      row.innerHTML = `
        <td class="${rankClass}">${rank}위</td>
        <td>${escapeHtml(entry.name)}</td>
        <td class="gold-text">${entry.score}</td>
        <td style="color: var(--text-muted);">${entry.date}</td>
      `;
      leaderboardBody.appendChild(row);
    });
  }
  
  // 2. Populate Dedicated popup modal leaderboard
  modalLeaderboardBody.innerHTML = '';
  if (rankings.length === 0) {
    modalLeaderboardBody.innerHTML = `<tr><td colspan="4" style="text-align: center; color: var(--text-muted);">등록된 데이터가 없습니다.</td></tr>`;
  } else {
    rankings.forEach((entry, idx) => {
      const row = document.createElement('tr');
      const rank = idx + 1;
      let rankClass = '';
      if (rank === 1) rankClass = 'rank-1';
      else if (rank === 2) rankClass = 'rank-2';
      else if (rank === 3) rankClass = 'rank-3';
      
      row.innerHTML = `
        <td class="${rankClass}">${rank}위</td>
        <td>${escapeHtml(entry.name)}</td>
        <td class="gold-text">${entry.score}</td>
        <td style="color: var(--text-muted);">${entry.date}</td>
      `;
      modalLeaderboardBody.appendChild(row);
    });
  }
}

function showLeaderboardModal() {
  renderLeaderboard();
  modalRanking.classList.add('active');
}

function closeLeaderboardModal() {
  modalRanking.classList.remove('active');
}

function escapeHtml(str) {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

/* ==========================================================================
   Event Listeners Registries
   ========================================================================== */

// Start buttons triggers
btnStart.addEventListener('click', startGame);
btnStartOverlay.addEventListener('click', startGame);
btnRestart.addEventListener('click', startGame);

// Rankings triggers
btnViewRanking.addEventListener('click', showLeaderboardModal);
btnCloseModal.addEventListener('click', closeLeaderboardModal);

// Submit high score
btnSubmitScore.addEventListener('click', submitScore);
playerNameInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') submitScore();
});

// Close modal when clicking dark background overlay directly
modalRanking.addEventListener('click', (e) => {
  if (e.target === modalRanking) closeLeaderboardModal();
});

// Initialize audio context on first screen tap / key gesture
window.addEventListener('click', initAudio, { once: true });
window.addEventListener('keydown', initAudio, { once: true });

// Initial load check
renderLeaderboard();
gridSizeVal.textContent = '3 X 3';
