/*
  Bolsolula - Simple Pac-like with phases and start menu
  Canvas: 672x744 -> 28x31 tiles at 24px
*/

(() => {
  const canvas = document.getElementById('gameCanvas');
  const ctx = canvas.getContext('2d');
  const scoreEl = document.getElementById('score');
  const levelEl = document.getElementById('level');
  const livesEl = document.getElementById('lives');
  const muteBtn = document.getElementById('muteBtn');
  const restartBtn = document.getElementById('restartBtn');
  const startBtn = document.getElementById('startBtn');
  const menuOverlay = document.getElementById('menuOverlay');
  const phaseBanner = document.getElementById('phaseBanner');
  const difficultySel = document.getElementById('difficulty');
  const opponentsSel = document.getElementById('opponents');
  const controlsSel = document.getElementById('controls');
  const soundSel = document.getElementById('sound');

  if (!canvas || !ctx) {
    console.error('Canvas not found.');
    return;
  }

  // Constants
  const TILE_SIZE = 24;
  const COLS = 28;
  const ROWS = 31;

  // Phases
  const Phase = Object.freeze({
    BOOT: 'BOOT',
    READY: 'READY',
    SCATTER: 'SCATTER',
    CHASE: 'CHASE',
    FRIGHTENED: 'FRIGHTENED',
    LIFE_LOST: 'LIFE_LOST',
    LEVEL_CLEARED: 'LEVEL_CLEARED',
    GAME_OVER: 'GAME_OVER',
  });

  // Assets
  const images = {
    player: new Image(),
    ghost: new Image(),
  };
  let playerImageLoaded = false;
  let ghostImageLoaded = false;
  images.player.onload = () => (playerImageLoaded = true);
  images.ghost.onload = () => (ghostImageLoaded = true);
  images.player.src = 'assets/bolsonaro.png';
  images.ghost.src = 'assets/lula.png';

  // Audio
  let audioEnabled = true;
  let audioCtx;
  function ensureAudio() {
    if (!audioCtx) {
      try {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      } catch (e) {
        console.warn('AudioContext unavailable');
      }
    }
  }
  function beep(freq = 440, durationMs = 100, volume = 0.1, type = 'square') {
    if (!audioEnabled) return;
    ensureAudio();
    if (!audioCtx) return;
    const oscillator = audioCtx.createOscillator();
    const gainNode = audioCtx.createGain();
    oscillator.type = type;
    oscillator.frequency.value = freq;
    gainNode.gain.value = volume;
    oscillator.connect(gainNode).connect(audioCtx.destination);
    oscillator.start();
    oscillator.stop(audioCtx.currentTime + durationMs / 1000);
  }

  // Options and state
  const gameOptions = {
    difficulty: 'normal',
    opponentCount: 3,
    controlScheme: 'both',
    startLives: 3,
    frightenedSeconds: 6,
    ghostBaseSpeed: 75, // px/sec
    playerBaseSpeed: 90, // px/sec
  };

  const difficultyConfigs = {
    easy: { frightenedSeconds: 8, ghostSpeed: 70, playerSpeed: 96 },
    normal: { frightenedSeconds: 6, ghostSpeed: 80, playerSpeed: 90 },
    hard: { frightenedSeconds: 5, ghostSpeed: 88, playerSpeed: 88 },
  };

  // Map: 28x31. W=wall, .=pellet, o=power,  =empty, T=tunnel
  // This is a compact, symmetric maze inspired by classic layouts but simplified.
  const MAP = [
    'WWWWWWWWWWWWWWWWWWWWWWWWWW',
    'W..........WW..........o.W',
    'W.WWWW.WWWW.WW.WWWW.WWWW.W',
    'WoW  W.W  W.WW.W  W.W  WoW',
    'W.WWWW.WWWW.WW.WWWW.WWWW.W',
    'W........................W',
    'W.WWWW.WW.WWWWWW.WW.WWWW.W',
    'W.W    WW.W    W.WW    W.W',
    'W.WWWW.WW.WWWW W.WW.WWWW.W',
    'W......WW....   ....WW...W',
    'WWWWWW.WW.WWWWWWW.WW.WWWWW',
    '     W.WW.W   G  W.WW.W   ',
    'WWWW W.WW.W WWWWW W.W WWWW',
    '.... .   .   PPP   .   ....',
    'WWWW W.WW.W WWWWW W.W WWWW',
    '     W.WW.W       W.WW.W   ',
    'WWWWWW.WW.WWWWWWW.WW.WWWWW',
    'W.........................W',
    'W.WWWW.WWWW.WW.WWWW.WWWW.W',
    'W.W    W    WW    W    W.W',
    'W.WWWW.WW.WWWWWW.WW.WWWW.W',
    'W...WW....WW  WW....WW...W',
    'WWW.WW.WWWW      WWWW.W.WW',
    'W...WW....WW  WW....WW...W',
    'W.WWWW.WW.WWWWWW.WW.WWWW.W',
    'W.W    W    WW    W    W.W',
    'W.WWWW.WWWW.WW.WWWW.WWWW.W',
    'Wo.......................oW',
    'WWWWWWWWWWWWWWWWWWWWWWWWWW',
    'T                        T',
    'WWWWWWWWWWWWWWWWWWWWWWWWWW',
  ];
  // Legend notes:
  // - 'G' marks the ghost house area; 'P' marks player start corridor; spaces are walkable.
  // - Row 29 (0-indexed 28) has power pellets 'o' on ends.
  // - Row 30 is a tunnel row denoted with 'T' which teleports left<->right.

  function tileAt(col, row) {
    if (row < 0 || row >= ROWS || col < 0 || col >= COLS) return 'W';
    return MAP[row][col] || 'W';
  }
  function isWallTile(ch) {
    return ch === 'W';
  }
  function isTunnel(col, row) {
    return MAP[row][0] === 'T' && MAP[row][COLS - 1] === 'T' && (col === 0 || col === COLS - 1);
  }

  // Build pellets from map
  function buildLevelPellets() {
    const pellets = new Set();
    const powers = new Set();
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const ch = tileAt(c, r);
        if (ch === '.' || ch === ' ') {
          // Place normal pellet on '.' and sparse on spaces
          if (ch === '.' || ((r + c) % 2 === 0 && !isWallTile(ch))) {
            pellets.add(`${c},${r}`);
          }
        } else if (ch === 'o') {
          powers.add(`${c},${r}`);
        }
      }
    }
    return { pellets, powers };
  }

  function tileCenter(col, row) {
    return { x: col * TILE_SIZE + TILE_SIZE / 2, y: row * TILE_SIZE + TILE_SIZE / 2 };
  }

  function positionToTile(x, y) {
    return { col: Math.floor(x / TILE_SIZE), row: Math.floor(y / TILE_SIZE) };
  }

  function isPassable(col, row) {
    const ch = tileAt(col, row);
    return !isWallTile(ch) && ch !== 'G';
  }

  function clamp(val, min, max) { return Math.max(min, Math.min(max, val)); }

  function drawRoundedRect(x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
    ctx.fill();
  }

  // Entities
  class Entity {
    constructor(x, y, color) {
      this.x = x; this.y = y; this.color = color;
      this.dir = { x: 0, y: 0 };
      this.speed = 80; // px/sec
    }
    centerAligned() {
      const cx = Math.abs((this.x - TILE_SIZE / 2) % TILE_SIZE) < 0.5;
      const cy = Math.abs((this.y - TILE_SIZE / 2) % TILE_SIZE) < 0.5;
      return cx && cy;
    }
    currentTile() { return positionToTile(this.x, this.y); }
    trySetDirection(nextDir) {
      const { col, row } = this.currentTile();
      const targetCol = col + nextDir.x;
      const targetRow = row + nextDir.y;
      if (this.centerAligned() && isPassable(targetCol, targetRow)) {
        this.dir = nextDir;
        return true;
      }
      return false;
    }
    move(dt) {
      this.x += this.dir.x * this.speed * dt;
      this.y += this.dir.y * this.speed * dt;
      // Handle tunnel wrap
      const { col, row } = this.currentTile();
      if (MAP[row] && MAP[row][0] === 'T' && MAP[row][COLS - 1] === 'T') {
        if (this.x < -TILE_SIZE / 2) this.x = COLS * TILE_SIZE - TILE_SIZE / 2 - 1;
        if (this.x > COLS * TILE_SIZE - TILE_SIZE / 2) this.x = -TILE_SIZE / 2 + 1;
      }
    }
  }

  class Player extends Entity {
    constructor(x, y) { super(x, y, '#7bdff2'); this.nextDir = { x: 0, y: 0 }; }
    update(dt) {
      // Try to apply queued direction at tile centers
      if (this.centerAligned()) {
        this.trySetDirection(this.nextDir);
        // prevent moving into wall
        const { col, row } = this.currentTile();
        const nc = col + this.dir.x; const nr = row + this.dir.y;
        if (!isPassable(nc, nr)) this.dir = { x: 0, y: 0 };
      }
      this.move(dt);
    }
    draw() {
      const size = TILE_SIZE * 0.8;
      const x = this.x - size / 2;
      const y = this.y - size / 2;
      if (playerImageLoaded) {
        ctx.drawImage(images.player, x, y, size, size);
      } else {
        ctx.fillStyle = this.color;
        drawRoundedRect(x, y, size, size, 6);
      }
    }
  }

  class Ghost extends Entity {
    constructor(x, y, id, color) {
      super(x, y, color);
      this.id = id;
      this.scatterTarget = [
        { col: 1, row: 1 },
        { col: COLS - 2, row: 1 },
        { col: 1, row: ROWS - 3 },
        { col: COLS - 2, row: ROWS - 3 },
      ][id % 4];
      this.state = 'normal'; // or 'frightened' or 'eaten'
      this.frightenedTimer = 0;
      this.previousDir = { x: 0, y: 0 };
    }
    update(dt, phase, player, maze) {
      if (this.state === 'eaten') {
        // Move to ghost house center
        const target = tileCenter(14, 12);
        this.chaseTowards(dt, target, 1.2);
        const dist = Math.hypot(this.x - target.x, this.y - target.y);
        if (dist < 6) {
          this.state = 'normal';
        }
        return;
      }
      if (this.state === 'frightened') {
        this.frightenedTimer -= dt;
        if (this.frightenedTimer <= 0) {
          this.state = 'normal';
        }
        this.randomWalk(dt);
        return;
      }
      // normal: choose behavior by phase
      if (phase === Phase.SCATTER) {
        this.chaseTile(dt, this.scatterTarget);
      } else if (phase === Phase.CHASE) {
        // target player's next tile
        const pTile = player.currentTile();
        const target = { col: pTile.col + player.dir.x * 2, row: pTile.row + player.dir.y * 2 };
        this.chaseTile(dt, target);
      } else {
        // READY or other: idle drift
        this.randomWalk(dt);
      }
    }
    chaseTile(dt, targetTile) {
      const { col, row } = this.currentTile();
      if (this.centerAligned()) {
        const options = [
          { x: 1, y: 0 }, { x: -1, y: 0 }, { x: 0, y: 1 }, { x: 0, y: -1 }
        ].filter(d => !(d.x === -this.dir.x && d.y === -this.dir.y)) // avoid reverse when possible
         .filter(d => isPassable(col + d.x, row + d.y));
        if (options.length === 0) {
          // reverse if blocked
          const rev = { x: -this.dir.x, y: -this.dir.y };
          if (isPassable(col + rev.x, row + rev.y)) this.dir = rev;
        } else {
          // choose next step minimizing distance to target
          let best = options[0];
          let bestDist = 1e9;
          for (const d of options) {
            const nc = col + d.x; const nr = row + d.y;
            const dist = Math.hypot(nc - targetTile.col, nr - targetTile.row);
            if (dist < bestDist) { bestDist = dist; best = d; }
          }
          this.dir = best;
        }
      }
      this.move(dt);
    }
    chaseTowards(dt, targetPoint, speedFactor = 1) {
      const dx = targetPoint.x - this.x;
      const dy = targetPoint.y - this.y;
      const len = Math.hypot(dx, dy) || 1;
      this.x += (dx / len) * this.speed * speedFactor * dt;
      this.y += (dy / len) * this.speed * speedFactor * dt;
    }
    randomWalk(dt) {
      const { col, row } = this.currentTile();
      if (this.centerAligned()) {
        const options = [
          { x: 1, y: 0 }, { x: -1, y: 0 }, { x: 0, y: 1 }, { x: 0, y: -1 }
        ].filter(d => isPassable(col + d.x, row + d.y));
        if (options.length) {
          // Avoid reversing, bias to continue straight
          const straight = options.find(d => d.x === this.dir.x && d.y === this.dir.y);
          const choices = straight ? [straight, ...options] : options;
          this.dir = choices[Math.floor(Math.random() * choices.length)];
        }
      }
      this.move(dt);
    }
    draw(phase) {
      const size = TILE_SIZE * 0.8;
      const x = this.x - size / 2;
      const y = this.y - size / 2;
      if (this.state === 'frightened') {
        ctx.fillStyle = '#3b82f6';
      } else if (this.state === 'eaten') {
        ctx.fillStyle = '#94a3b8';
      } else {
        ctx.fillStyle = this.color;
      }
      if (ghostImageLoaded && this.state === 'normal') {
        ctx.drawImage(images.ghost, x, y, size, size);
      } else {
        drawRoundedRect(x, y, size, size, 6);
        // eyes
        ctx.fillStyle = '#fff';
        ctx.beginPath(); ctx.arc(this.x - 5, this.y - 2, 3, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(this.x + 5, this.y - 2, 3, 0, Math.PI * 2); ctx.fill();
      }
    }
  }

  // Game state
  const state = {
    running: false,
    phase: Phase.BOOT,
    phaseTimer: 0,
    phaseScriptIndex: 0,
    score: 0,
    level: 1,
    lives: 3,
    pellets: new Set(),
    powers: new Set(),
    player: null,
    ghosts: [],
    keysDown: new Set(),
    frightenedCombo: 0,
  };

  function setPhase(phase, duration = 0, bannerText = '') {
    state.phase = phase;
    state.phaseTimer = duration;
    if (bannerText) showBanner(bannerText);
  }

  function showBanner(text, ms = 1400) {
    if (!phaseBanner) return;
    phaseBanner.textContent = text;
    phaseBanner.classList.remove('hidden');
    window.clearTimeout(showBanner._t);
    showBanner._t = window.setTimeout(() => {
      phaseBanner.classList.add('hidden');
    }, ms);
  }

  function updateHUD() {
    scoreEl.textContent = String(state.score);
    levelEl.textContent = String(state.level);
    livesEl.textContent = String(state.lives);
  }

  function resetLevelEntities() {
    const pStart = tileCenter(14, 15);
    state.player = new Player(pStart.x, pStart.y);
    state.player.speed = gameOptions.playerBaseSpeed;
    // set initial horizontal motion to right
    state.player.dir = { x: 0, y: 0 };
    state.player.nextDir = { x: 1, y: 0 };

    const colors = ['#ff6b6b', '#f7d794', '#a0e7e5', '#cdb4db'];
    state.ghosts = [];
    const gStart = tileCenter(14, 12);
    for (let i = 0; i < gameOptions.opponentCount; i++) {
      const g = new Ghost(gStart.x + (i - 1.5) * 10, gStart.y, i, colors[i % colors.length]);
      g.speed = gameOptions.ghostBaseSpeed;
      // stagger initial directions
      g.dir = i % 2 === 0 ? { x: 1, y: 0 } : { x: -1, y: 0 };
      state.ghosts.push(g);
    }
  }

  function buildNewLevel() {
    const { pellets, powers } = buildLevelPellets();
    state.pellets = pellets;
    state.powers = powers;
    resetLevelEntities();
  }

  function nextLevel() {
    state.level += 1;
    // Slightly faster each level
    gameOptions.playerBaseSpeed *= 1.02;
    gameOptions.ghostBaseSpeed *= 1.04;
    buildNewLevel();
    updateHUD();
    setPhase(Phase.READY, 2.0, 'Ready!');
  }

  function loseLife() {
    state.lives -= 1;
    updateHUD();
    if (state.lives <= 0) {
      setPhase(Phase.GAME_OVER, 0, 'Game Over');
      state.running = false;
      // Show menu again after short delay
      window.setTimeout(() => { menuOverlay.classList.remove('hidden'); }, 1200);
      beep(220, 250, 0.12, 'sawtooth');
      return;
    }
    resetLevelEntities();
    setPhase(Phase.LIFE_LOST, 1.5, 'Life Lost');
  }

  // Phase script: Scatter/Chase cycles
  const PHASE_SCRIPT = [
    { phase: Phase.SCATTER, seconds: 7 },
    { phase: Phase.CHASE, seconds: 20 },
    { phase: Phase.SCATTER, seconds: 7 },
    { phase: Phase.CHASE, seconds: 20 },
    { phase: Phase.SCATTER, seconds: 5 },
    { phase: Phase.CHASE, seconds: 20 },
  ];

  function beginPhaseScript() {
    state.phaseScriptIndex = 0;
    const s = PHASE_SCRIPT[state.phaseScriptIndex];
    setPhase(s.phase, s.seconds, s.phase);
  }

  function advancePhaseScript() {
    state.phaseScriptIndex += 1;
    if (state.phaseScriptIndex >= PHASE_SCRIPT.length) {
      // loop chase
      setPhase(Phase.CHASE, 9999, 'Chase');
      return;
    }
    const s = PHASE_SCRIPT[state.phaseScriptIndex];
    setPhase(s.phase, s.seconds, s.phase);
  }

  // Input
  function isAllowedKey(code) {
    const scheme = gameOptions.controlScheme;
    const arrow = code.startsWith('Arrow');
    const wasd = ['KeyW', 'KeyA', 'KeyS', 'KeyD'].includes(code);
    if (scheme === 'both') return arrow || wasd;
    if (scheme === 'arrows') return arrow;
    if (scheme === 'wasd') return wasd;
    return true;
  }
  window.addEventListener('keydown', (e) => {
    if (!isAllowedKey(e.code)) return;
    state.keysDown.add(e.code);
    const p = state.player;
    if (!p) return;
    let nd = null;
    switch (e.code) {
      case 'ArrowLeft': case 'KeyA': nd = { x: -1, y: 0 }; break;
      case 'ArrowRight': case 'KeyD': nd = { x: 1, y: 0 }; break;
      case 'ArrowUp': case 'KeyW': nd = { x: 0, y: -1 }; break;
      case 'ArrowDown': case 'KeyS': nd = { x: 0, y: 1 }; break;
    }
    if (nd) {
      p.nextDir = nd;
      // If currently stopped, try to start immediately
      if (p.dir.x === 0 && p.dir.y === 0) p.trySetDirection(nd);
      e.preventDefault();
    }
  });
  window.addEventListener('keyup', (e) => state.keysDown.delete(e.code));

  muteBtn?.addEventListener('click', () => {
    audioEnabled = !audioEnabled;
    muteBtn.textContent = audioEnabled ? '🔈' : '🔇';
    if (audioEnabled) beep(880, 60, 0.06, 'sine');
  });
  restartBtn?.addEventListener('click', () => {
    // Return to menu
    state.running = false;
    menuOverlay.classList.remove('hidden');
  });

  startBtn?.addEventListener('click', () => {
    // Apply options
    const diff = difficultySel.value;
    const conf = difficultyConfigs[diff] || difficultyConfigs.normal;
    gameOptions.difficulty = diff;
    gameOptions.opponentCount = parseInt(opponentsSel.value, 10) || 3;
    gameOptions.controlScheme = controlsSel.value;
    audioEnabled = soundSel.value !== 'off';
    muteBtn.textContent = audioEnabled ? '🔈' : '🔇';
    gameOptions.frightenedSeconds = conf.frightenedSeconds;
    gameOptions.ghostBaseSpeed = conf.ghostSpeed;
    gameOptions.playerBaseSpeed = conf.playerSpeed;

    // Reset game
    state.score = 0;
    state.level = 1;
    state.lives = gameOptions.startLives;
    state.frightenedCombo = 0;
    updateHUD();
    buildNewLevel();
    menuOverlay.classList.add('hidden');
    setPhase(Phase.READY, 2.0, 'Ready!');
    state.running = true;
    beginPhaseScriptAfterReady();
    beep(880, 80, 0.08, 'triangle');
  });

  function beginPhaseScriptAfterReady() {
    // After READY, start script
    // We keep READY active separately and then hand off to script
  }

  // Collision helpers
  function tilesEqualKey(col, row) { return `${col},${row}`; }

  function handlePelletConsumption() {
    const p = state.player;
    const { col, row } = p.currentTile();
    const key = tilesEqualKey(col, row);
    if (state.pellets.has(key)) {
      state.pellets.delete(key);
      state.score += 10;
      updateHUD();
      beep(880, 30, 0.05, 'sine');
    }
    if (state.powers.has(key)) {
      state.powers.delete(key);
      state.score += 50;
      updateHUD();
      triggerFrightened();
      beep(220, 200, 0.08, 'square');
    }
    if (state.pellets.size === 0 && state.powers.size === 0) {
      setPhase(Phase.LEVEL_CLEARED, 2.0, 'Level Cleared');
      state.running = false;
      window.setTimeout(() => {
        state.running = true;
        nextLevel();
        // Phase script will start automatically after READY expires
      }, 1500);
    }
  }

  function triggerFrightened() {
    for (const g of state.ghosts) {
      if (g.state !== 'eaten') {
        g.state = 'frightened';
        g.frightenedTimer = gameOptions.frightenedSeconds;
      }
    }
    state.frightenedCombo = 0;
    setPhase(Phase.FRIGHTENED, gameOptions.frightenedSeconds, 'Frightened');
  }

  function handleCollisions() {
    const p = state.player;
    for (const g of state.ghosts) {
      const d = Math.hypot(p.x - g.x, p.y - g.y);
      if (d < TILE_SIZE * 0.6) {
        if (g.state === 'frightened') {
          g.state = 'eaten';
          const base = 200;
          const gain = base * Math.pow(2, state.frightenedCombo);
          state.frightenedCombo = Math.min(state.frightenedCombo + 1, 3);
          state.score += gain;
          updateHUD();
          beep(120, 120, 0.12, 'sawtooth');
        } else if (g.state !== 'eaten' && state.phase !== Phase.READY && state.phase !== Phase.LIFE_LOST) {
          loseLife();
          return; // stop checking further collisions
        }
      }
    }
  }

  // Rendering
  function drawMaze() {
    // Background
    ctx.fillStyle = '#0a0c10';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Walls
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const ch = tileAt(c, r);
        if (ch === 'W' || ch === 'G') {
          ctx.fillStyle = '#273043';
          const x = c * TILE_SIZE; const y = r * TILE_SIZE;
          drawRoundedRect(x + 2, y + 2, TILE_SIZE - 4, TILE_SIZE - 4, 6);
        }
      }
    }

    // Pellets
    for (const key of state.pellets) {
      const [c, r] = key.split(',').map(Number);
      const { x, y } = tileCenter(c, r);
      ctx.fillStyle = '#f7d794';
      ctx.beginPath();
      ctx.arc(x, y, 3, 0, Math.PI * 2);
      ctx.fill();
    }
    // Power pellets (gavels)
    for (const key of state.powers) {
      const [c, r] = key.split(',').map(Number);
      const { x, y } = tileCenter(c, r);
      ctx.fillStyle = '#ffd166';
      ctx.beginPath();
      ctx.arc(x, y, 6, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function drawEntities() {
    state.player?.draw();
    for (const g of state.ghosts) g.draw(state.phase);
  }

  // Loop
  let lastTime = performance.now();
  function tick(now) {
    const dt = clamp((now - lastTime) / 1000, 0, 0.05);
    lastTime = now;

    if (state.running) {
      // Timers
      if (state.phase === Phase.READY || state.phase === Phase.FRIGHTENED || state.phase === Phase.SCATTER || state.phase === Phase.CHASE || state.phase === Phase.LIFE_LOST) {
        state.phaseTimer -= dt;
        if (state.phase === Phase.READY && state.phaseTimer <= 0) {
          beginPhaseScript();
        } else if (state.phase === Phase.FRIGHTENED && state.phaseTimer <= 0) {
          state.frightenedCombo = 0;
          beginPhaseScript();
        } else if ((state.phase === Phase.SCATTER || state.phase === Phase.CHASE) && state.phaseTimer <= 0) {
          advancePhaseScript();
        } else if (state.phase === Phase.LIFE_LOST && state.phaseTimer <= 0) {
          setPhase(Phase.READY, 1.2, 'Ready!');
        }
      }

      // Speeds adjusted by phase
      const playerSpeedFactor = state.phase === Phase.FRIGHTENED ? 1.05 : 1.0;
      const ghostSpeedFactor = state.phase === Phase.FRIGHTENED ? 0.7 : 1.0;
      state.player.speed = gameOptions.playerBaseSpeed * playerSpeedFactor;
      for (const g of state.ghosts) g.speed = gameOptions.ghostBaseSpeed * ghostSpeedFactor;

      // Update
      state.player.update(dt);
      for (const g of state.ghosts) g.update(dt, state.phase, state.player, MAP);

      // Pellet consumption and collisions
      handlePelletConsumption();
      handleCollisions();
    }

    // Draw
    drawMaze();
    drawEntities();

    // Phase overlay text "PAUSED" like if not running but not menu visible
    if (!state.running && menuOverlay.classList.contains('hidden')) {
      ctx.fillStyle = 'rgba(0,0,0,0.5)';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = '#e6e6ea';
      ctx.font = 'bold 28px Rubik, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('Paused', canvas.width / 2, canvas.height / 2);
    }

    requestAnimationFrame(tick);
  }

  // Initialize
  function boot() {
    updateHUD();
    menuOverlay.classList.remove('hidden');
    setPhase(Phase.BOOT, 0);
    requestAnimationFrame(tick);
  }

  boot();
})();