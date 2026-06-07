/**
 * HoverEscape - Dynamic Physics cave glider & Canvas Neon Engine
 */

document.addEventListener('DOMContentLoaded', () => {
  // DOM Elements
  const gameViewport = document.getElementById('game-viewport');
  const gameCanvas = document.getElementById('game-canvas');
  const ctx = gameCanvas.getContext('2d');
  const airplane = document.getElementById('airplane');
  const startBtn = document.getElementById('start-btn');
  const distanceCountSpan = document.getElementById('distance-count');
  const viewportOverlay = document.getElementById('viewport-overlay');

  // Game Over Modal Elements
  const gameOverModal = document.getElementById('game-over-modal');
  const finalDistanceSpan = document.getElementById('final-distance');
  const playerNameInput = document.getElementById('player-name');
  const saveRecordBtn = document.getElementById('save-record-btn');
  const saveStatus = document.getElementById('save-status');

  // Leaderboard Modal Elements
  const rankingsBtn = document.getElementById('rankings-btn');
  const rankingsModal = document.getElementById('rankings-modal');
  const closeRankingsBtn = document.getElementById('close-rankings-btn');
  const rankingsList = document.getElementById('rankings-list');
  const noRankingsDiv = document.getElementById('no-rankings');

  // Physics & Mechanics Constants
  const CANVAS_WIDTH = 800;
  const CANVAS_HEIGHT = 800;
  const AIRCRAFT_SIZE = 50;
  const AIRCRAFT_X = 50; // Fixed horizontal position
  const CAVE_POINT_GAP = 10; // X interval between generated cave ceiling/floor nodes
  
  // Speed metrics
  const SCROLL_SPEED = 4.5; // Cave forward speed (pixels per frame)
  const Y_SPEED = 1.125;      // Reduced to 1/4 (original 4.5) for comfortable vertical control

  // Game State variables
  let isGameActive = false;
  let isThrustInitiated = false; // Flight starts upon first click after starting
  let distance = 0; // Flight distance in meters
  let startTime = 0;
  let accumulatedTime = 0;
  let animationFrameId = null;
  let lastFrameTime = 0;

  // Aircraft variables
  let aircraftY = 375; // Starts in the dead center vertical (800 - 50)/2
  let aircraftDirection = -1; // -1 for ascending (up), 1 for descending (down)

  // Cave Generation buffers
  let cavePoints = []; // Holds list of {x, ceilingY, floorY} nodes
  let currentGap = 400; // Starting corridor gap (Increased to 400px)

  // Initialize Viewport
  setupInitialState();

  // Event Listeners
  startBtn.addEventListener('click', handleStartButtonClick);
  gameViewport.addEventListener('mousedown', handleViewportClick);
  rankingsBtn.addEventListener('click', openRankings);
  closeRankingsBtn.addEventListener('click', closeRankings);
  saveRecordBtn.addEventListener('click', saveFlightRecord);

  // Close modals on clicking backdrop (excluding gameover modal for security)
  document.querySelectorAll('.modal-backdrop').forEach(backdrop => {
    backdrop.addEventListener('click', (e) => {
      const parentModal = backdrop.closest('.modal');
      if (parentModal && parentModal.id === 'game-over-modal') {
        return; 
      }
      closeAllModals();
    });
  });

  playerNameInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      saveFlightRecord();
    }
  });

  /**
   * Reset game layout and place jet to initial center-left
   */
  function setupInitialState() {
    isGameActive = false;
    isThrustInitiated = false;
    distance = 0;
    distanceCountSpan.textContent = '0.000m';
    
    aircraftY = (CANVAS_HEIGHT - AIRCRAFT_SIZE) / 2; // 375px
    aircraftDirection = -1; // Ascending by default on first click
    
    // Position jet physically to left-center with 0 rotation
    airplane.style.transform = `translate3d(${AIRCRAFT_X}px, ${aircraftY}px, 0) rotate(0deg)`;
    
    viewportOverlay.style.opacity = '1';
    viewportOverlay.style.pointerEvents = 'auto';
    gameViewport.classList.remove('active');
    
    startBtn.textContent = '게임 시작';
    startBtn.disabled = false;

    // Seed flat initial corridor for startup
    currentGap = 400;
    initializeFlatCave();
    drawCave();
  }

  /**
   * Seed starting corridor cave layout (flat line tunnel)
   */
  function initializeFlatCave() {
    cavePoints = [];
    const totalPoints = Math.ceil(CANVAS_WIDTH / CAVE_POINT_GAP) + 3;
    const centerY = CANVAS_HEIGHT / 2; // 400px
    const ceilingStart = centerY - (currentGap / 2); // 200px

    for (let i = 0; i < totalPoints; i++) {
      const pxX = i * CAVE_POINT_GAP;
      cavePoints.push({
        x: pxX,
        ceilingY: ceilingStart,
        floorY: ceilingStart + currentGap
      });
    }
  }

  /**
   * Start Thrust & Initiate procedurals
   */
  function handleStartButtonClick() {
    if (isGameActive) return; // Prevent double triggers
    
    closeAllModals();
    
    isGameActive = true;
    isThrustInitiated = false; // Awaiting first viewport click to engage thruster
    distance = 0;
    accumulatedTime = 0;
    
    // Clean form status messages
    saveStatus.textContent = '';
    saveStatus.className = 'status-message';
    playerNameInput.value = '';
    
    aircraftY = (CANVAS_HEIGHT - AIRCRAFT_SIZE) / 2;
    aircraftDirection = -1;
    airplane.style.transform = `translate3d(${AIRCRAFT_X}px, ${aircraftY}px, 0) rotate(0deg)`;
    
    viewportOverlay.style.opacity = '0';
    viewportOverlay.style.pointerEvents = 'none';
    gameViewport.classList.add('active');

    // Button states
    startBtn.textContent = '자동 비행';
    startBtn.disabled = true;

    // Reset cave to starting corridor
    currentGap = 400;
    initializeFlatCave();

    // Fire engine game loop
    const now = performance.now();
    lastFrameTime = now;
    startTime = now;

    if (animationFrameId) cancelAnimationFrame(animationFrameId);
    animationFrameId = requestAnimationFrame(gameLoop);
  }

  /**
   * Click Viewport to Toggle vertical vectors
   */
  function handleViewportClick(e) {
    // Prevent trigger if clicking rankings buttons or start buttons
    if (e.target.closest('#start-btn') || e.target.closest('#rankings-btn')) {
      return;
    }
    
    if (!isGameActive) return;

    // Engage thrust on first viewport click
    if (!isThrustInitiated) {
      isThrustInitiated = true;
      startTime = performance.now();
      lastFrameTime = startTime;
      startBtn.textContent = '추진 중';
    }

    // Toggle directions
    aircraftDirection = aircraftDirection === 1 ? -1 : 1;
    
    // Smooth angle tilt update immediately (14 degrees matches the new 1/4 Y-speed flight path)
    const angle = aircraftDirection === 1 ? 14 : -14;
    airplane.style.transform = `translate3d(${AIRCRAFT_X}px, ${aircraftY}px, 0) rotate(${angle}deg)`;
  }

  /**
   * Main Dynamic Game Loop
   */
  function gameLoop(timestamp) {
    if (!isGameActive) return;

    const deltaTime = timestamp - lastFrameTime;
    lastFrameTime = timestamp;

    if (isThrustInitiated) {
      // 1. Telemetry Distance: 10m/s -> 0.01m/ms
      accumulatedTime += deltaTime;
      distance = accumulatedTime * 0.01;
      distanceCountSpan.textContent = `${distance.toFixed(3)}m`;

      // 2. Shrink Gap Progression: drops 10px every 10 seconds down to min 60px
      // 10 seconds = 10000 milliseconds (Starting at 400px)
      currentGap = Math.max(60, 400 - Math.floor(accumulatedTime / 10000) * 10);

      // 3. Jet Glider vertical movement physics
      // Moves vertically at constant speed Y_SPEED
      aircraftY += aircraftDirection * Y_SPEED;

      // Keep inside hard physical limits (clamped to viewport edges)
      if (aircraftY < 0) aircraftY = 0;
      if (aircraftY > CANVAS_HEIGHT - AIRCRAFT_SIZE) {
        aircraftY = CANVAS_HEIGHT - AIRCRAFT_SIZE;
      }

      // Render jet transformations
      const angle = aircraftDirection === 1 ? 14 : -14;
      airplane.style.transform = `translate3d(${AIRCRAFT_X}px, ${aircraftY}px, 0) rotate(${angle}deg)`;

      // 4. Procedural Cave Scroller
      scrollCave();

      // 5. Collision Inspector
      if (checkCavernCollisions()) {
        triggerGameOver();
        return;
      }
    }

    // Draw frame
    drawCave();

    // Recurse frame
    animationFrameId = requestAnimationFrame(gameLoop);
  }

  /**
   * Procedural infinite corridor generation
   */
  function scrollCave() {
    // Scroll all coordinates leftwards
    cavePoints.forEach(point => {
      point.x -= SCROLL_SPEED;
    });

    // Drop leftmost out of boundary nodes
    while (cavePoints.length > 0 && cavePoints[0].x < -CAVE_POINT_GAP * 2) {
      cavePoints.shift();
    }

    // Generate new nodes at the right edge
    const lastPoint = cavePoints[cavePoints.length - 1];
    let nextX = lastPoint.x + CAVE_POINT_GAP;

    while (nextX < CANVAS_WIDTH + CAVE_POINT_GAP * 3) {
      // Procedural ceiling height generator
      const prevCeilingY = cavePoints[cavePoints.length - 1].ceilingY;
      
      // Slope control mathematically constrained to strictly LESS THAN 45 degrees
      // slope = deltaY / deltaX <= 1. Since CAVE_POINT_GAP is 10px, 
      // max height deltaY must be strictly bounded in [-10px, 10px].
      // We set a max delta to 8.5px to guarantee complete safety and smooth visual curvature.
      const maxDeltaY = CAVE_POINT_GAP * 0.85; 
      const deltaY = (Math.random() - 0.5) * 2 * maxDeltaY;
      
      let nextCeilingY = prevCeilingY + deltaY;

      // Keep corridor bounds inside vertical safe margin (prevent squeezing ceiling to top 50px or bottom limit)
      const verticalMargin = 50;
      const bottomLimit = CANVAS_HEIGHT - currentGap - verticalMargin;
      
      if (nextCeilingY < verticalMargin) nextCeilingY = verticalMargin;
      if (nextCeilingY > bottomLimit) nextCeilingY = bottomLimit;

      cavePoints.push({
        x: nextX,
        ceilingY: nextCeilingY,
        floorY: nextCeilingY + currentGap
      });

      nextX += CAVE_POINT_GAP;
    }
  }

  /**
   * Evaluate if jet fighter coordinates cross cave ceiling/floor lines
   */
  function checkCavernCollisions() {
    // Jet horizontal boundary bounding box: [AIRCRAFT_X, AIRCRAFT_X + AIRCRAFT_SIZE] (50px to 100px)
    const jetLeft = AIRCRAFT_X;
    const jetRight = AIRCRAFT_X + AIRCRAFT_SIZE;
    const jetTop = aircraftY;
    const jetBottom = aircraftY + AIRCRAFT_SIZE;

    // Find cave nodes overlapping with the jet fuselage
    const overlaps = cavePoints.filter(p => p.x >= jetLeft - CAVE_POINT_GAP && p.x <= jetRight + CAVE_POINT_GAP);

    if (overlaps.length === 0) return false;

    // Walk across overlapping segments to perform precise vertical boundary audit
    for (let i = 0; i < overlaps.length - 1; i++) {
      const p1 = overlaps[i];
      const p2 = overlaps[i + 1];

      // Linear interpolation to find precise ceiling/floor height at jet horizontal segment points
      // Check collision at left edge (x = 50) and right edge (x = 100)
      for (let checkX = jetLeft; checkX <= jetRight; checkX += 10) {
        if (checkX >= p1.x && checkX <= p2.x) {
          // Compute interpolation factor
          const ratio = (checkX - p1.x) / (p2.x - p1.x);
          const currentCeilingY = p1.ceilingY + ratio * (p2.ceilingY - p1.ceilingY);
          const currentFloorY = p1.floorY + ratio * (p2.floorY - p1.floorY);

          // Bounding intersection checks
          if (jetTop < currentCeilingY || jetBottom > currentFloorY) {
            return true; // Collision!
          }
        }
      }
    }

    return false;
  }

  /**
   * HTML5 Canvas High Performance Neon Renderer
   */
  function drawCave() {
    // Clear canvas
    ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    if (cavePoints.length === 0) return;

    // 1. Draw glowing background grid stars (subtle visual element)
    ctx.save();
    ctx.globalAlpha = 0.3;
    ctx.strokeStyle = 'rgba(0, 240, 255, 0.05)';
    ctx.lineWidth = 1;
    for (let gridX = 0; gridX < CANVAS_WIDTH; gridX += 100) {
      ctx.beginPath();
      ctx.moveTo(gridX, 0);
      ctx.lineTo(gridX, CANVAS_HEIGHT);
      ctx.stroke();
    }
    ctx.restore();

    // 2. Draw solid cavern dark zones (ceiling and floor solid masks)
    ctx.save();
    
    // Ceiling Zone Mask
    ctx.beginPath();
    ctx.moveTo(cavePoints[0].x, 0);
    ctx.lineTo(cavePoints[0].x, cavePoints[0].ceilingY);
    for (let i = 1; i < cavePoints.length; i++) {
      ctx.lineTo(cavePoints[i].x, cavePoints[i].ceilingY);
    }
    ctx.lineTo(cavePoints[cavePoints.length - 1].x, 0);
    ctx.closePath();
    ctx.fillStyle = 'rgba(6, 4, 18, 0.95)';
    ctx.fill();

    // Floor Zone Mask
    ctx.beginPath();
    ctx.moveTo(cavePoints[0].x, CANVAS_HEIGHT);
    ctx.lineTo(cavePoints[0].x, cavePoints[0].floorY);
    for (let i = 1; i < cavePoints.length; i++) {
      ctx.lineTo(cavePoints[i].x, cavePoints[i].floorY);
    }
    ctx.lineTo(cavePoints[cavePoints.length - 1].x, CANVAS_HEIGHT);
    ctx.closePath();
    ctx.fillStyle = 'rgba(6, 4, 18, 0.95)';
    ctx.fill();
    ctx.restore();

    // 3. Draw Neon Glowing Cavern Lines
    // Draw Ceiling Line
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(cavePoints[0].x, cavePoints[0].ceilingY);
    for (let i = 1; i < cavePoints.length; i++) {
      ctx.lineTo(cavePoints[i].x, cavePoints[i].ceilingY);
    }
    ctx.strokeStyle = varColor('--neon-pink', '#ff007f');
    ctx.lineWidth = 4;
    ctx.shadowColor = varColor('--neon-pink', '#ff007f');
    ctx.shadowBlur = 10;
    ctx.stroke();
    ctx.restore();

    // Draw Floor Line
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(cavePoints[0].x, cavePoints[0].floorY);
    for (let i = 1; i < cavePoints.length; i++) {
      ctx.lineTo(cavePoints[i].x, cavePoints[i].floorY);
    }
    ctx.strokeStyle = varColor('--neon-cyan', '#00f0ff');
    ctx.lineWidth = 4;
    ctx.shadowColor = varColor('--neon-cyan', '#00f0ff');
    ctx.shadowBlur = 10;
    ctx.stroke();
    ctx.restore();
  }

  /**
   * Helper: Retrieve CSS Variables for Canvas drawing
   */
  function varColor(name, fallback) {
    const color = getComputedStyle(document.body).getPropertyValue(name).trim();
    return color || fallback;
  }

  /**
   * Trigger Flight Game Over
   */
  function triggerGameOver() {
    isGameActive = false;
    isThrustInitiated = false;
    cancelAnimationFrame(animationFrameId);
    
    gameViewport.classList.remove('active');
    startBtn.textContent = '게임 시작';
    startBtn.disabled = false;

    // Show Gameover Registry modal
    finalDistanceSpan.textContent = `${distance.toFixed(3)}m`;
    gameOverModal.classList.add('active');
    
    setTimeout(() => {
      playerNameInput.focus();
    }, 150);
  }

  /**
   * Save Flight Record to Central Database and LocalStorage backup
   */
  async function saveFlightRecord() {
    const rawName = playerNameInput.value.trim();
    if (!rawName) {
      showStatus('PLEASE ENTER A VALID NAME', 'error');
      return;
    }

    const dateStr = new Date().toLocaleDateString('ko-KR', {
      year: '2-digit',
      month: '2-digit',
      day: '2-digit'
    });

    const newRecord = {
      name: rawName.toUpperCase(),
      distanceVal: parseFloat(distance.toFixed(3)),
      formattedDistance: `${distance.toFixed(3)}m`,
      date: dateStr
    };

    // 1. Always save to LocalStorage as a secure local backup
    try {
      let rankings = JSON.parse(localStorage.getItem('hover_escape_rankings')) || [];
      rankings.push(newRecord);
      rankings.sort((a, b) => b.distanceVal - a.distanceVal);
      rankings = rankings.slice(0, 20);
      localStorage.setItem('hover_escape_rankings', JSON.stringify(rankings));
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
          game: 'hover_escape',
          name: newRecord.name,
          score: newRecord.distanceVal,
          date: newRecord.date
        })
      });

      const result = await response.json();
      if (response.ok && result.success) {
        showStatus('PILOT FLIGHT RECORD SECURED!', 'success');
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

    // Gracefully slide to Leaderboard view
    setTimeout(() => {
      closeAllModals();
      saveRecordBtn.disabled = false;
      
      // Reset game to default startup state
      setupInitialState();
      
      openRankings();
    }, 1200);
  }

  /**
   * Open Rankings Leaderboard Modal
   */
  async function openRankings() {
    closeAllModals();

    // Clear dynamic rows
    rankingsList.innerHTML = '';

    let rankings = [];
    let isDbData = false;

    // 1. Attempt to load rankings from Database
    try {
      const response = await fetch('../api.php?action=rankings&game=hover_escape');
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
      rankings = JSON.parse(localStorage.getItem('hover_escape_rankings')) || [];
    }

    if (rankings.length === 0) {
      noRankingsDiv.classList.remove('hidden');
    } else {
      noRankingsDiv.classList.add('hidden');

      rankings.forEach((entry, idx) => {
        const row = document.createElement('tr');
        
        let medal = idx + 1;
        if (medal === 1) medal = '🥇 1';
        else if (medal === 2) medal = '🥈 2';
        else if (medal === 3) medal = '🥉 3';

        const displayDistance = entry.formattedDistance || (parseFloat(entry.distanceVal).toFixed(3) + 'm');

        row.innerHTML = `
          <td>${medal}</td>
          <td style="font-weight: 600; letter-spacing: 1px;">${escapeHTML(entry.name)}</td>
          <td class="neon-cyan" style="font-family: 'Orbitron'; font-weight: 700;">${displayDistance}</td>
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
    gameOverModal.classList.remove('active');
    rankingsModal.classList.remove('active');
  }

  /**
   * Helper: Form status printer
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
