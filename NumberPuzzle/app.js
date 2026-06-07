/**
 * NumberPuzzle - Precision Sliding Puzzle Engine & Game Loop
 */

document.addEventListener('DOMContentLoaded', () => {
  // DOM Elements
  const puzzleBoard = document.getElementById('puzzle-board');
  const startBtn = document.getElementById('start-btn');
  const movesCountSpan = document.getElementById('moves-count');
  const levelTextSpan = document.getElementById('level-text');
  const boardOverlay = document.getElementById('board-overlay');

  // Stage Clear Modal Elements
  const stageClearModal = document.getElementById('stage-clear-modal');
  const stageMovesSpan = document.getElementById('stage-moves');
  const nextStageBtn = document.getElementById('next-stage-btn');

  // Grand Victory Modal Elements
  const grandClearModal = document.getElementById('grand-clear-modal');
  const finalTotalMovesSpan = document.getElementById('final-total-moves');
  const playerNameInput = document.getElementById('player-name');
  const saveRecordBtn = document.getElementById('save-record-btn');
  const saveStatus = document.getElementById('save-status');

  // Rankings Modal Elements
  const rankingsBtn = document.getElementById('rankings-btn');
  const rankingsModal = document.getElementById('rankings-modal');
  const closeRankingsBtn = document.getElementById('close-rankings-btn');
  const rankingsList = document.getElementById('rankings-list');
  const noRankingsDiv = document.getElementById('no-rankings');

  // Game Configuration & State
  const BOARD_SIZE = 800; // 800px × 800px fixed board size
  const MIN_LEVEL = 4;    // Starts at 4x4
  const MAX_LEVEL = 9;    // Ends at 9x9

  let currentLevel = MIN_LEVEL;
  let movesCount = 0;
  let totalMovesCount = 0; // Accumulated moves from all stages
  let isGameActive = false;

  // Puzzle array representation
  let tilesArray = [];
  let blankIndex = -1;

  // Initialize viewports
  setupGameStage(true);

  // Event Listeners
  startBtn.addEventListener('click', handleStartBtnClick);
  nextStageBtn.addEventListener('click', handleNextStageClick);
  rankingsBtn.addEventListener('click', openRankings);
  closeRankingsBtn.addEventListener('click', closeRankings);
  saveRecordBtn.addEventListener('click', saveFinalScore);

  // Close modals on clicking backdrop
  document.querySelectorAll('.modal-backdrop').forEach(backdrop => {
    backdrop.addEventListener('click', (e) => {
      // Clear modals should not close randomly on backdrop clicks as per strict request
      const parentModal = backdrop.closest('.modal');
      if (parentModal && (parentModal.id === 'stage-clear-modal' || parentModal.id === 'grand-clear-modal')) {
        return; 
      }
      closeAllModals();
    });
  });

  playerNameInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      saveFinalScore();
    }
  });

  /**
   * Set up board structure based on currentLevel
   */
  function setupGameStage(isInitialStart = false) {
    isGameActive = false;
    
    // Reset global counter only on initial 4x4 start
    if (isInitialStart) {
      movesCount = 0;
      totalMovesCount = 0;
    }
    
    movesCountSpan.textContent = movesCount;
    levelTextSpan.textContent = `${currentLevel}X${currentLevel}`;

    // Reset overlay
    boardOverlay.style.opacity = '1';
    boardOverlay.style.pointerEvents = 'auto';
    puzzleBoard.classList.remove('active');

    // Build the sorted board (represented by sequential numbers 1 to N^2 - 1, and null)
    const totalCells = currentLevel * currentLevel;
    tilesArray = [];
    for (let i = 1; i < totalCells; i++) {
      tilesArray.push(i);
    }
    tilesArray.push(null); // Last slot is the blank spacer
    blankIndex = totalCells - 1;

    // Render static sorted board inside the viewport
    renderBoard();
  }

  /**
   * Start / Restart Game Trigger (Shuffles puzzle)
   */
  function handleStartBtnClick() {
    if (isGameActive) {
      // Restart current level: roll back moves to the value at the start of this stage
      movesCount = totalMovesCount;
      setupGameStage(false);
    } else {
      // If we are starting from scratch (Welcome screen) on 4x4
      if (currentLevel === MIN_LEVEL) {
        movesCount = 0;
        totalMovesCount = 0;
      }
    }

    // Hide overlays & Activate Board
    boardOverlay.style.opacity = '0';
    boardOverlay.style.pointerEvents = 'none';
    puzzleBoard.classList.add('active');

    // Perform mathematically solvable shuffle
    solvabilityShuffle();

    movesCountSpan.textContent = movesCount;
    isGameActive = true;
    startBtn.textContent = 'RESTART';
  }

  /**
   * SOLVABILITY SHUFFLE ENGINE
   * We start from the perfectly solved state and perform random legal moves.
   * This guarantees with 100% mathematical certainty that the board is solvable.
   */
  function solvabilityShuffle() {
    const N = currentLevel;
    const totalCells = N * N;
    // Perform N * 80 shuffle moves to thoroughly scramble the tiles
    const shuffleSteps = N * 90;
    
    let currentBlankIdx = totalCells - 1;

    for (let step = 0; step < shuffleSteps; step++) {
      const validNeighbors = [];
      const row = Math.floor(currentBlankIdx / N);
      const col = currentBlankIdx % N;

      // Up Neighbor
      if (row > 0) validNeighbors.push(currentBlankIdx - N);
      // Down Neighbor
      if (row < N - 1) validNeighbors.push(currentBlankIdx + N);
      // Left Neighbor
      if (col > 0) validNeighbors.push(currentBlankIdx - 1);
      // Right Neighbor
      if (col < N - 1) validNeighbors.push(currentBlankIdx + 1);

      // Choose a random legal neighbor and swap
      const randomNeighbor = validNeighbors[Math.floor(Math.random() * validNeighbors.length)];
      
      // Perform Swap in array representation
      tilesArray[currentBlankIdx] = tilesArray[randomNeighbor];
      tilesArray[randomNeighbor] = null;
      currentBlankIdx = randomNeighbor;
    }

    blankIndex = currentBlankIdx;
    renderBoard(); // Render the shuffled layout
  }

  /**
   * DOM Renderer for absolute layout placement with transition ease
   */
  function renderBoard() {
    // Clear old DOM tiles
    const overlays = [boardOverlay];
    puzzleBoard.innerHTML = '';
    overlays.forEach(o => puzzleBoard.appendChild(o));

    const N = currentLevel;
    const gap = currentLevel >= 8 ? 4 : 6; // Compact gap on larger levels
    
    // Exact sizing math to perfectly sit inside 800px boundary
    const tileSize = (BOARD_SIZE - (gap * (N + 1))) / N;
    
    // Scale font size proportionally to tile size (Dynamic scalability)
    const fontSize = Math.max(16, tileSize * 0.4);

    tilesArray.forEach((tileVal, idx) => {
      const row = Math.floor(idx / N);
      const col = idx % N;
      const left = gap + col * (tileSize + gap);
      const top = gap + row * (tileSize + gap);

      const tileElement = document.createElement('div');
      tileElement.classList.add('puzzle-tile');
      tileElement.style.width = `${tileSize}px`;
      tileElement.style.height = `${tileSize}px`;
      tileElement.style.fontSize = `${fontSize}px`;
      
      // Apply hardware accelerated absolute positioning coordinates
      tileElement.style.transform = `translate3d(${left}px, ${top}px, 0)`;

      if (tileVal === null) {
        tileElement.classList.add('blank');
      } else {
        tileElement.textContent = tileVal;
        tileElement.setAttribute('role', 'button');
        tileElement.setAttribute('aria-label', `Tile ${tileVal}`);
        tileElement.addEventListener('click', () => handleTileClick(tileVal));
      }

      puzzleBoard.appendChild(tileElement);
    });
  }

  /**
   * Core Game Loop - Sliding Tile Event handler
   */
  function handleTileClick(tileVal) {
    if (!isGameActive) return;

    // Dynamically retrieve the absolute current index of this value inside tilesArray
    const clickedIdx = tilesArray.indexOf(tileVal);
    if (clickedIdx === -1) return;

    const N = currentLevel;
    const clickedRow = Math.floor(clickedIdx / N);
    const clickedCol = clickedIdx % N;
    const blankRow = Math.floor(blankIndex / N);
    const blankCol = blankIndex % N;

    // Check if the clicked tile is adjacent to the blank cell (distance is exactly 1)
    const isAdjacent = Math.abs(clickedRow - blankRow) + Math.abs(clickedCol - blankCol) === 1;

    if (isAdjacent) {
      // 1. Swap tiles in Array
      tilesArray[blankIndex] = tilesArray[clickedIdx];
      tilesArray[clickedIdx] = null;

      // 2. Set new blank index
      const oldBlankIndex = blankIndex;
      blankIndex = clickedIdx;

      // 3. Update DOM positions smoothly (Avoid fully re-rendering to let CSS transitions work!)
      updateTileDOMPositions(oldBlankIndex, clickedIdx);

      // 4. Increment Move Counter
      movesCount++;
      movesCountSpan.textContent = movesCount;

      // 5. Audit Win State
      if (checkWinState()) {
        triggerStageWin();
      }
    }
  }

  /**
   * Refined translation updates targeting only swapped DOM Nodes for smooth visual glide transitions
   */
  function updateTileDOMPositions(oldBlankIdx, newBlankIdx) {
    const N = currentLevel;
    const gap = currentLevel >= 8 ? 4 : 6;
    const tileSize = (BOARD_SIZE - (gap * (N + 1))) / N;

    const tilesDOM = puzzleBoard.querySelectorAll('.puzzle-tile');
    
    // Indices inside tilesDOM map to rendering order in loop
    // We update the translation coords of the blank tile and the moving numbered tile
    [oldBlankIdx, newBlankIdx].forEach(idx => {
      const row = Math.floor(idx / N);
      const col = idx % N;
      const left = gap + col * (tileSize + gap);
      const top = gap + row * (tileSize + gap);

      // Find matching DOM node by mapping array indexes
      const val = tilesArray[idx];
      let targetNode = null;

      if (val === null) {
        // Blank DOM Node
        targetNode = Array.from(tilesDOM).find(node => node.classList.contains('blank'));
      } else {
        // Numbered DOM Node
        targetNode = Array.from(tilesDOM).find(node => parseInt(node.textContent) === val);
      }

      if (targetNode) {
        targetNode.style.transform = `translate3d(${left}px, ${top}px, 0)`;
      }
    });
  }

  /**
   * Evaluate if all tiles are aligned correctly in ascending order
   */
  function checkWinState() {
    const totalCells = currentLevel * currentLevel;
    
    for (let i = 0; i < totalCells - 1; i++) {
      if (tilesArray[i] !== i + 1) {
        return false;
      }
    }
    
    // Bottom-right must be the empty blank slot
    return tilesArray[totalCells - 1] === null;
  }

  /**
   * Trigger Stage Completed Modal overlay
   */
  function triggerStageWin() {
    isGameActive = false;
    puzzleBoard.classList.remove('active');
    startBtn.textContent = 'START GAME';

    if (currentLevel < MAX_LEVEL) {
      // 1. Regular Stage Clear (4x4 to 8x8 Stages)
      // Display the moves spent solely in the completed stage
      stageMovesSpan.textContent = movesCount - totalMovesCount;
      
      // Save checkpoint of cumulative score before advancing
      totalMovesCount = movesCount;
      
      stageClearModal.classList.add('active');
    } else {
      // 2. Final Game Clear (Ultimate 9x9 Stage victory)
      totalMovesCount = movesCount; // Final checkpoint save
      
      finalTotalMovesSpan.textContent = movesCount;
      playerNameInput.value = '';
      saveStatus.textContent = '';
      saveStatus.className = 'status-message';
      saveRecordBtn.disabled = false;
      
      grandClearModal.classList.add('active');
      
      // Auto focus entry field
      setTimeout(() => {
        playerNameInput.focus();
      }, 150);
    }
  }

  /**
   * Handle Transitioning to the Next Stage level
   */
  function handleNextStageClick() {
    stageClearModal.classList.remove('active');
    if (currentLevel < MAX_LEVEL) {
      currentLevel++;
      setupGameStage();
    }
  }

  /**
   * Save Grand Decipher Score to Central Database and LocalStorage backup
   */
  async function saveFinalScore() {
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

    const newScore = {
      name: rawName.toUpperCase(),
      moves: totalMovesCount,
      date: dateStr
    };

    // 1. Always save to LocalStorage as a secure local backup
    try {
      let rankings = JSON.parse(localStorage.getItem('number_puzzle_rankings')) || [];
      rankings.push(newScore);
      rankings.sort((a, b) => a.moves - b.moves);
      rankings = rankings.slice(0, 20);
      localStorage.setItem('number_puzzle_rankings', JSON.stringify(rankings));
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
          game: 'number_puzzle',
          name: newScore.name,
          score: newScore.moves,
          date: newScore.date
        })
      });

      const result = await response.json();
      if (response.ok && result.success) {
        showStatus('DECIPHER RECORD SECURED!', 'success');
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

    // Gracefully transition to leaderboard display
    setTimeout(() => {
      closeAllModals();
      saveRecordBtn.disabled = false;
      
      // Reset full game parameters to start over from 4x4 with 0 moves
      currentLevel = MIN_LEVEL;
      setupGameStage(true);
      
      openRankings();
    }, 1200);
  }

  /**
   * Load and render the rankings modal popup
   */
  async function openRankings() {
    closeAllModals();

    // Clear dynamic rows
    rankingsList.innerHTML = '';

    let rankings = [];
    let isDbData = false;

    // 1. Attempt to load rankings from Database
    try {
      const response = await fetch('../api.php?action=rankings&game=number_puzzle');
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
      rankings = JSON.parse(localStorage.getItem('number_puzzle_rankings')) || [];
    }

    if (rankings.length === 0) {
      noRankingsDiv.classList.remove('hidden');
    } else {
      noRankingsDiv.classList.add('hidden');

      // Inject sorted rows
      rankings.forEach((entry, idx) => {
        const row = document.createElement('tr');
        
        let medal = idx + 1;
        if (medal === 1) medal = '🥇 1';
        else if (medal === 2) medal = '🥈 2';
        else if (medal === 3) medal = '🥉 3';

        row.innerHTML = `
          <td>${medal}</td>
          <td style="font-weight: 600; letter-spacing: 1px;">${escapeHTML(entry.name)}</td>
          <td class="neon-yellow" style="font-family: 'Orbitron'; font-weight: 700;">${entry.moves}</td>
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
    stageClearModal.classList.remove('active');
    grandClearModal.classList.remove('active');
    rankingsModal.classList.remove('active');
  }

  /**
   * Helper: Form Status Message Printer
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
