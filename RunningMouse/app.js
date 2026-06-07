/**
 * RunningMouse - Game Controller & Precision Engine
 */

document.addEventListener('DOMContentLoaded', () => {
  // DOM Elements
  const gameViewport = document.getElementById('game-viewport');
  const gameMouse = document.getElementById('game-mouse');
  const startBtn = document.getElementById('start-btn');
  const clicksLeftSpan = document.getElementById('clicks-left');
  const playTimeSpan = document.getElementById('play-time');
  const viewportOverlay = document.getElementById('viewport-overlay');
  
  // Clear Modal Elements
  const clearModal = document.getElementById('clear-modal');
  const finalTimeSpan = document.getElementById('final-time');
  const playerNameInput = document.getElementById('player-name');
  const saveRecordBtn = document.getElementById('save-record-btn');
  const saveStatus = document.getElementById('save-status');

  // Rankings Modal Elements
  const rankingsBtn = document.getElementById('rankings-btn');
  const rankingsModal = document.getElementById('rankings-modal');
  const closeRankingsBtn = document.getElementById('close-rankings-btn');
  const rankingsList = document.getElementById('rankings-list');
  const noRankingsDiv = document.getElementById('no-rankings');

  // Constants
  const TOTAL_CLICKS = 15;
  const VIEWPORT_LIMIT = 800;
  const MOUSE_SIZE = 50;
  const MAX_COORDINATE = VIEWPORT_LIMIT - MOUSE_SIZE; // 750px

  // Game Engine State Variables
  let isGameActive = false;
  let clicksRemaining = TOTAL_CLICKS;
  let startTime = 0;
  let elapsedTime = 0;
  let animationFrameId = null;

  // Mouse Physics & Movement State
  let mouseX = 375; // Initial centered coordinates (800 - 50)/2
  let mouseY = 375;
  let dx = 0; // Movement unit vector X
  let dy = 0; // Movement unit vector Y
  let currentSpeed = 0;
  let lastDirectionChangeTime = 0;
  let currentTempo = 1500; // in milliseconds

  // Initialize Game Board
  setupInitialState();

  // Event Listeners
  startBtn.addEventListener('click', handleStartButtonClick);
  gameMouse.addEventListener('mousedown', handleMouseHit);
  rankingsBtn.addEventListener('click', openRankings);
  closeRankingsBtn.addEventListener('click', closeRankings);
  saveRecordBtn.addEventListener('click', saveRecord);

  // Close modals on clicking backdrop
  document.querySelectorAll('.modal-backdrop').forEach(backdrop => {
    backdrop.addEventListener('click', (e) => {
      // Prevent closing when clicking the backdrop of the clear-modal
      const parentModal = backdrop.closest('.modal');
      if (parentModal && parentModal.id === 'clear-modal') {
        return;
      }
      closeAllModals();
    });
  });

  // Prevent input keypresses from bubbling or triggering game events if needed
  playerNameInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      saveRecord();
    }
  });

  /**
   * Initial placement and styling reset
   */
  function setupInitialState() {
    isGameActive = false;
    clicksRemaining = TOTAL_CLICKS;
    clicksLeftSpan.textContent = clicksRemaining;
    playTimeSpan.textContent = '00:00.000';
    
    // Position mouse centrally initially
    mouseX = MAX_COORDINATE / 2;
    mouseY = MAX_COORDINATE / 2;
    updateMouseDOMPosition(0);
    
    gameMouse.classList.add('hidden');
    viewportOverlay.style.opacity = '1';
    viewportOverlay.style.pointerEvents = 'auto';
    
    gameViewport.classList.remove('active');
    startBtn.textContent = '게임 시작';
    startBtn.disabled = false;
  }

  /**
   * Start / Restart Game Trigger
   */
  function handleStartButtonClick() {
    if (isGameActive) return; // Prevent double trigger
    
    closeAllModals();
    isGameActive = true;
    clicksRemaining = TOTAL_CLICKS;
    clicksLeftSpan.textContent = clicksRemaining;
    
    // Initialize parameters
    currentSpeed = 1.7; // Additional 30% reduced starting speed (originally 2.4)
    currentTempo = 1600; // Initial direction tempo: 1.6s
    
    // Set starting position (centered or slightly random within limits)
    mouseX = Math.random() * MAX_COORDINATE;
    mouseY = Math.random() * MAX_COORDINATE;
    setRandomDirection();
    
    // Show mouse & hide landing overlay
    gameMouse.classList.remove('hidden');
    viewportOverlay.style.opacity = '0';
    viewportOverlay.style.pointerEvents = 'none';
    gameViewport.classList.add('active');
    
    // Disable start button during active gameplay
    startBtn.textContent = '추적 중...';
    startBtn.disabled = true;
 
    // Reset status messages
    saveStatus.textContent = '';
    saveStatus.className = 'status-message';
    playerNameInput.value = '';
 
    // Synchronize Clocks
    const now = performance.now();
    startTime = now;
    lastDirectionChangeTime = now;
    
    // Spin up dynamic engine loop
    if (animationFrameId) cancelAnimationFrame(animationFrameId);
    animationFrameId = requestAnimationFrame(gameLoop);
  }

  /**
   * Main Engine Loop - Runs up to 120+ FPS natively
   */
  function gameLoop(timestamp) {
    if (!isGameActive) return;

    // 1. Calculate Play Time with millisecond resolution
    elapsedTime = timestamp - startTime;
    playTimeSpan.textContent = formatTime(elapsedTime);

    // 2. Dynamic Direction Switching
    // Check if the current direction has been kept longer than the dynamic tempo
    const timeSinceLastChange = timestamp - lastDirectionChangeTime;
    if (timeSinceLastChange >= currentTempo) {
      setRandomDirection();
      lastDirectionChangeTime = timestamp;
    }

    // 3. Move Mouse according to velocity vectors and scaled speed
    mouseX += dx * currentSpeed;
    mouseY += dy * currentSpeed;

    // 4. Wall Bounce & Bounds Safety Clamp (Ensures it NEVER leaves the 800x800 frame)
    let boundaryHit = false;

    if (mouseX < 0) {
      mouseX = 0;
      dx = Math.abs(dx); // Force deflection to the right
      boundaryHit = true;
    } else if (mouseX > MAX_COORDINATE) {
      mouseX = MAX_COORDINATE;
      dx = -Math.abs(dx); // Force deflection to the left
      boundaryHit = true;
    }

    if (mouseY < 0) {
      mouseY = 0;
      dy = Math.abs(dy); // Force deflection downwards
      boundaryHit = true;
    } else if (mouseY > MAX_COORDINATE) {
      mouseY = MAX_COORDINATE;
      dy = -Math.abs(dy); // Force deflection upwards
      boundaryHit = true;
    }

    // If we bounced against walls, add a dynamic vector nudge to keep paths unpredictable
    if (boundaryHit) {
      // Retain minimum 300ms hold but allow natural vector variations
      lastDirectionChangeTime = timestamp - (currentTempo - 300);
    }

    // 5. Update DOM
    const angleRad = Math.atan2(dy, dx);
    updateMouseDOMPosition(angleRad);

    // Keep spinning
    animationFrameId = requestAnimationFrame(gameLoop);
  }

  /**
   * Set random movement direction vectors
   */
  function setRandomDirection() {
    const angle = Math.random() * Math.PI * 2; // Random angle [0, 360 deg]
    dx = Math.cos(angle);
    dy = Math.sin(angle);
  }

  /**
   * Apply translations, rotations and pop scaling on the mouse DOM Node
   */
  function updateMouseDOMPosition(angleRad) {
    // Add a +90 degree offset because the minimalist cute mouse template faces straight upwards (12 o'clock).
    // Adding 90 degrees aligns the rodent's nose seamlessly in the direction of vector dx/dy.
    const angleDeg = ((angleRad * 180) / Math.PI) + 90;
    
    // Retrieve transient hit scaling from the class state
    const isHit = gameMouse.classList.contains('hit-flash');
    const scale = isHit ? 1.25 : 1.0;
    
    // Using hardware-accelerated transform with smooth translation, rotation, and click-scale
    gameMouse.style.transform = `translate3d(${mouseX}px, ${mouseY}px, 0) rotate(${angleDeg}deg) scale(${scale})`;
  }

  /**
   * Handle Click Hits on the mouse
   */
  function handleMouseHit(e) {
    e.preventDefault();
    e.stopPropagation(); // Avoid double bubbling
    
    if (!isGameActive) return;

    clicksRemaining--;
    clicksLeftSpan.textContent = clicksRemaining;

    // Visual Flash Feedback on Successful Hit
    gameMouse.classList.remove('hit-flash');
    void gameMouse.offsetWidth; // Force CSS reflow to re-trigger animation
    gameMouse.classList.add('hit-flash');

    // Auto-remove flash styling after CSS animation completes (200ms) to ensure clean reset and prevent lockups
    setTimeout(() => {
      gameMouse.classList.remove('hit-flash');
    }, 200);

    if (clicksRemaining <= 0) {
      triggerGameClear();
    } else {
      // Speed and Tempo Progression
      // Scale difficulty progressively based on successful clicks
      const clicksMade = TOTAL_CLICKS - clicksRemaining; // Ranges from 1 to 14
      
      // Speed Formula: Additional 30% reduced speed scaling (starting at 1.7px up to 8.0px/frame max)
      currentSpeed = 1.7 + clicksMade * 0.45;
      
      // Tempo Formula: direction-hold cycle drops from 1600ms down to exactly 300ms (0.3s) at 14 clicks.
      // (1600 - 300) = 1300ms range span.
      currentTempo = 1600 - (clicksMade * (1300 / 14));
      
      // Enforce the requirement: minimum duration a direction is held must be at least 0.3s (300ms)
      if (currentTempo < 300) {
        currentTempo = 300;
      }

      // Immediately randomize direction upon a successful hit to keep it responsive
      setRandomDirection();
      lastDirectionChangeTime = performance.now();
    }
  }

  /**
   * Handle Winning Phase
   */
  function triggerGameClear() {
    isGameActive = false;
    cancelAnimationFrame(animationFrameId);
    
    gameViewport.classList.remove('active');
    startBtn.textContent = '다시 하기';
    startBtn.disabled = false;
    gameMouse.classList.add('hidden');

    // Show Winning Modal & Final Timing
    finalTimeSpan.textContent = formatTime(elapsedTime);
    clearModal.classList.add('active');
    
    // Auto focus name input
    setTimeout(() => {
      playerNameInput.focus();
    }, 150);
  }

  /**
   * Central Database API & LocalStorage Score Registry (Leaderboard Logic)
   */
  async function saveRecord() {
    const rawName = playerNameInput.value.trim();
    if (!rawName) {
      showStatus('PLEASE ENTER A VALID NAME', 'error');
      return;
    }

    const timeVal = parseFloat(elapsedTime.toFixed(0)); // Precision integer milliseconds
    const dateStr = new Date().toLocaleDateString('ko-KR', {
      year: '2-digit',
      month: '2-digit',
      day: '2-digit'
    });

    const newRecord = {
      name: rawName.toUpperCase(),
      time: timeVal,
      formattedTime: formatTime(elapsedTime),
      date: dateStr
    };

    // 1. Always save to LocalStorage as a secure local backup
    try {
      let rankings = JSON.parse(localStorage.getItem('running_mouse_rankings')) || [];
      rankings.push(newRecord);
      rankings.sort((a, b) => a.time - b.time);
      rankings = rankings.slice(0, 20);
      localStorage.setItem('running_mouse_rankings', JSON.stringify(rankings));
    } catch (err) {
      console.error('LocalStorage backup failed:', err);
    }

    // 2. Attempt to save to Database via API
    let dbSaved = false;
    try {
      saveRecordBtn.disabled = true;
      showStatus('SECURING IN DATABASE...', 'success');
      
      const response = await fetch('../api.php', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          action: 'save',
          game: 'running_mouse',
          name: newRecord.name,
          score: newRecord.time,
          date: newRecord.date
        })
      });

      const result = await response.json();
      if (response.ok && result.success) {
        showStatus('DATABASE RECORD SECURED!', 'success');
        dbSaved = true;
      } else {
        console.warn('API returned failure:', result.message);
      }
    } catch (err) {
      console.error('Database connection failed:', err);
    }

    if (!dbSaved) {
      // If DB failed, notify user it fell back to local storage
      showStatus('SECURED LOCALLY (OFFLINE MODE)', 'success');
    }

    // Gracefully shift view to show the new leaderboard
    setTimeout(() => {
      closeAllModals();
      saveRecordBtn.disabled = false;
      openRankings();
    }, 1000);
  }

  /**
   * Render and open the Leaderboard modal
   */
  async function openRankings() {
    closeAllModals();
    
    // Clear dynamic children
    rankingsList.innerHTML = '';
    
    let rankings = [];
    let isDbData = false;

    // 1. Attempt to load rankings from Database
    try {
      const response = await fetch('../api.php?action=rankings&game=running_mouse');
      const result = await response.json();
      if (response.ok && result.success && Array.isArray(result.rankings)) {
        rankings = result.rankings;
        isDbData = true;
      } else {
        console.warn('API rankings query failed, falling back to LocalStorage:', result.message);
      }
    } catch (err) {
      console.error('Database query failed, falling back to LocalStorage:', err);
    }

    // 2. Fall back to LocalStorage if DB is unavailable or empty
    if (!isDbData || rankings.length === 0) {
      rankings = JSON.parse(localStorage.getItem('running_mouse_rankings')) || [];
    }

    if (rankings.length === 0) {
      noRankingsDiv.classList.remove('hidden');
    } else {
      noRankingsDiv.classList.add('hidden');
      
      // Inject rows
      rankings.forEach((entry, idx) => {
        const row = document.createElement('tr');
        
        let medal = idx + 1;
        if (medal === 1) medal = '🥇 1';
        else if (medal === 2) medal = '🥈 2';
        else if (medal === 3) medal = '🥉 3';

        const displayTime = entry.formattedTime || formatTime(entry.time);

        row.innerHTML = `
          <td>${medal}</td>
          <td style="font-weight: 600; letter-spacing: 1px;">${escapeHTML(entry.name)}</td>
          <td class="neon-cyan" style="font-family: 'Orbitron'; font-weight: 700;">${displayTime}</td>
          <td style="color: var(--text-muted); font-size: 0.8rem;">${entry.date}</td>
        `;
        rankingsList.appendChild(row);
      });
    }

    rankingsModal.classList.add('active');
  }

  function closeRankings() {
    rankingsModal.classList.remove('active');
  }

  function closeAllModals() {
    clearModal.classList.remove('active');
    rankingsModal.classList.remove('active');
  }

  /**
   * Helper: Precision Time String formatting (MM:SS.mmm)
   */
  function formatTime(ms) {
    if (ms < 0) ms = 0;
    
    const minutes = Math.floor(ms / 60000);
    const seconds = Math.floor((ms % 60000) / 1000);
    const milliseconds = Math.floor(ms % 1000);

    const padMin = String(minutes).padStart(2, '0');
    const padSec = String(seconds).padStart(2, '0');
    const padMs = String(milliseconds).padStart(3, '0');

    return `${padMin}:${padSec}.${padMs}`;
  }

  /**
   * Helper: Form Status Printer
   */
  function showStatus(msg, type) {
    saveStatus.textContent = msg;
    saveStatus.className = `status-message ${type}`;
  }

  /**
   * Helper: Secure XSS prevention
   */
  function escapeHTML(str) {
    return str.replace(/[&<>'"]/g, 
      tag => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        "'": '&#39;',
        '"': '&quot;'
      }[tag] || tag)
    );
  }
});
