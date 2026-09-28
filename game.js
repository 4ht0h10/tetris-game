'use strict';

const COLS = 10;
const ROWS = 20;
const BLOCK = 30;

// Skins: each one supplies its own palette (indexed by piece type, like the board cells),
// grid colour, rainbow stops for the wildcard and the function that paints a single cell.
const SKINS = {
  retro: {
    colors: [
      null,
      '#4dd0e1', // I - cyan
      '#ffd54f', // O - yellow
      '#ba68c8', // T - purple
      '#81c784', // S - green
      '#e57373', // Z - red
      '#7986cb', // J - indigo
      '#ffb74d', // L - orange
      '#ec407a', // Single - pink
      '#8d6e63', // Hollow - brown
      '#ff8a65', // Bomb - orange
      '#4fc3f7', // Ray - light blue
      '#f48fb1', // Tint - pink
      '#b0bec5', // Gravity - light blue grey
      '#ffffff', // Wildcard (drawn as a rainbow gradient)
    ],
    rainbow: ['#e57373', '#ffd54f', '#81c784', '#4dd0e1', '#ba68c8'],
    grid: { dark: '#22222e', light: '#c8c8d8' },
    drawCell: drawCellRetro,
  },
  neon: {
    colors: [
      null,
      '#00f0ff', '#fff200', '#d600ff', '#39ff14', '#ff073a', '#4d6bff', '#ff9f00',
      '#ff00c8', '#ff8c42', '#ff5e00', '#00c3ff', '#ff4fd8', '#c0d8ff', '#ffffff',
    ],
    rainbow: ['#ff073a', '#fff200', '#39ff14', '#00f0ff', '#d600ff'],
    grid: '#0c1624', // neon always plays on a black board
    drawCell: drawCellNeon,
  },
  pastel: {
    colors: [
      null,
      '#a8e6ef', '#fdeea0', '#d7b8e8', '#bfe5c0', '#f6b5b5', '#b8c0ec', '#fbd3a4',
      '#f7bcd4', '#d2bcae', '#ffc3a8', '#b3e0f7', '#f9cde0', '#d5dde1', '#ffffff',
    ],
    rainbow: ['#f6b5b5', '#fdeea0', '#bfe5c0', '#a8e6ef', '#d7b8e8'],
    grid: { dark: '#2e2b38', light: '#ece4f2' },
    drawCell: drawCellPastel,
  },
  pixel: {
    colors: [
      null,
      '#3cbcfc', '#f8b800', '#9c4ce0', '#38b848', '#e83828', '#3858e0', '#f87818',
      '#f85898', '#a0602c', '#e45c10', '#58d8f8', '#f878f8', '#a8a8a8', '#ffffff',
    ],
    rainbow: ['#e83828', '#f8b800', '#38b848', '#3cbcfc', '#9c4ce0'],
    grid: { dark: '#1c1c28', light: '#d0d0dc' },
    drawCell: drawCellPixel,
  },
};
const DEFAULT_SKIN = 'retro';
const SKIN_STORAGE_KEY = 'tetris-skin';

const PIECES = [
  null,
  [[0,0,0,0],[1,1,1,1],[0,0,0,0],[0,0,0,0]], // I
  [[2,2],[2,2]],                               // O
  [[0,3,0],[3,3,3],[0,0,0]],                  // T
  [[0,4,4],[4,4,0],[0,0,0]],                  // S
  [[5,5,0],[0,5,5],[0,0,0]],                  // Z
  [[6,0,0],[6,6,6],[0,0,0]],                  // J
  [[0,0,7],[7,7,7],[0,0,0]],                  // L
  [[8]],                                       // Single (reward after a Tetris)
  [[9,9,9],[9,0,9],[9,9,9]],                  // Hollow (challenge)
  [[10]],                                      // Bomb (power-up)
  [[11]],                                      // Ray (power-up)
  [[12]],                                      // Tint (power-up)
  [[13]],                                      // Gravity (power-up)
  null,                                        // Wildcard (board-only cell value)
];

const SINGLE = 8;
const HOLLOW = 9;
const HOLLOW_WEIGHT = 0.5; // relative to 1 for each standard piece

const BOMB = 10;
const RAY = 11;
const TINT = 12;
const GRAVITY = 13;
const WILDCARD = 14;
const POWER_UPS = [BOMB, RAY, TINT, GRAVITY];
const POWER_ICONS = { [BOMB]: '💣', [RAY]: '⚡', [TINT]: '🎨', [GRAVITY]: '⬇️' };
const POWER_UP_EVERY = 3;     // a power-up is queued every N cleared lines
const EFFECT_CELL_SCORE = 10; // × level, per block destroyed by Bomb / Ray column
const WILDCARD_SCORE = 50;    // × level, per wildcard removed on a line clear
const POWER_NAMES = { [BOMB]: '¡Bum!', [RAY]: '¡Rayo!', [TINT]: '¡Comodín!', [GRAVITY]: '¡Gravedad!' };
const EFFECT_FLASH_MS = 350;  // cell flash after a power-up lands
const EFFECT_TEXT_MS = 800;   // floating score / name text

const LINE_SCORES = [0, 100, 300, 500, 800];

const THEME_STORAGE_KEY = 'tetris-theme';

const canvas = document.getElementById('board');
const ctx = canvas.getContext('2d');
const nextCanvas = document.getElementById('next-canvas');
const nextCtx = nextCanvas.getContext('2d');
const scoreEl = document.getElementById('score');
const linesEl = document.getElementById('lines');
const levelEl = document.getElementById('level');
const overlay = document.getElementById('overlay');
const overlayTitle = document.getElementById('overlay-title');
const overlayScore = document.getElementById('overlay-score');
const restartBtn = document.getElementById('restart-btn');
const resumeBtn = document.getElementById('resume-btn');
const themeToggleBtn = document.getElementById('theme-toggle');
const skinSelect = document.getElementById('skin-select');

let board, current, next, score, lines, level, paused, gameOver, lastTime, dropAccum, dropInterval, animId, theme, skin, pendingPowerUps, effects;

function createBoard() {
  return Array.from({ length: ROWS }, () => new Array(COLS).fill(0));
}

function makePiece(type) {
  const shape = PIECES[type].map(row => [...row]);
  return { type, shape, x: Math.floor(COLS / 2) - Math.floor(shape[0].length / 2), y: 0 };
}

function randomPiece() {
  const r = Math.random() * (7 + HOLLOW_WEIGHT);
  return makePiece(r >= 7 ? HOLLOW : Math.floor(r) + 1);
}

function isPowerUp(type) {
  return POWER_UPS.includes(type);
}

function scoreMultiplier(piece) {
  return piece.type === SINGLE || piece.type === HOLLOW ? 2 : 1;
}

function collide(shape, ox, oy) {
  for (let r = 0; r < shape.length; r++) {
    for (let c = 0; c < shape[r].length; c++) {
      if (!shape[r][c]) continue;
      const nx = ox + c;
      const ny = oy + r;
      if (nx < 0 || nx >= COLS || ny >= ROWS) return true;
      if (ny >= 0 && board[ny][nx]) return true;
    }
  }
  return false;
}

function rotateCW(shape) {
  const rows = shape.length, cols = shape[0].length;
  const result = Array.from({ length: cols }, () => new Array(rows).fill(0));
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++)
      result[c][rows - 1 - r] = shape[r][c];
  return result;
}

function tryRotate() {
  const rotated = rotateCW(current.shape);
  const kicks = [0, -1, 1, -2, 2];
  for (const kick of kicks) {
    if (!collide(rotated, current.x + kick, current.y)) {
      current.shape = rotated;
      current.x += kick;
      return;
    }
  }
}

function merge() {
  for (let r = 0; r < current.shape.length; r++)
    for (let c = 0; c < current.shape[r].length; c++)
      if (current.shape[r][c])
        board[current.y + r][current.x + c] = current.shape[r][c];
}

function clearLines(mult) {
  let cleared = 0;
  for (let r = ROWS - 1; r >= 0; r--) {
    if (board[r].every(v => v !== 0)) {
      board.splice(r, 1);
      board.unshift(new Array(COLS).fill(0));
      cleared++;
      r++;
    }
  }
  if (cleared) {
    // Any line clear also dissolves every wildcard left on the board
    let wildcards = 0;
    for (let r = 0; r < ROWS; r++)
      for (let c = 0; c < COLS; c++)
        if (board[r][c] === WILDCARD) { board[r][c] = 0; wildcards++; }
    lines += cleared;
    score += (LINE_SCORES[cleared] || 0) * level * mult;
    score += wildcards * WILDCARD_SCORE * level;
    level = Math.floor(lines / 10) + 1;
    dropInterval = Math.max(100, 1000 - (level - 1) * 90);
    updateHUD();
  }
  return cleared;
}

function ghostY() {
  let gy = current.y;
  while (!collide(current.shape, current.x, gy + 1)) gy++;
  return gy;
}

function hardDrop() {
  const gy = ghostY();
  score += (gy - current.y) * 2 * scoreMultiplier(current);
  current.y = gy;
  lockPiece();
}

function softDrop() {
  if (!collide(current.shape, current.x, current.y + 1)) {
    current.y++;
    score += scoreMultiplier(current);
    updateHUD();
  } else {
    lockPiece();
  }
}

function lockPiece() {
  if (isPowerUp(current.type)) applyPowerUp(current.x, current.y, current.type);
  else merge();
  const linesBefore = lines;
  const cleared = clearLines(scoreMultiplier(current));
  pendingPowerUps += Math.floor(lines / POWER_UP_EVERY) - Math.floor(linesBefore / POWER_UP_EVERY);
  spawn();
  if (cleared === 4 && !gameOver) {
    // Tetris reward: the upcoming piece becomes a 1×1 (a displaced power-up goes back to the queue)
    if (isPowerUp(next.type)) pendingPowerUps++;
    next = makePiece(SINGLE);
    drawNext();
  }
}

function applyPowerUp(x, y, type) {
  let destroyed = 0;
  const cells = [];
  switch (type) {
    case BOMB:
      // 3×3 blast centred on the cell below the landing spot, so it always bites into the stack
      for (let r = y; r <= y + 2; r++)
        for (let c = x - 1; c <= x + 1; c++)
          if (r >= 0 && r < ROWS && c >= 0 && c < COLS) {
            cells.push([c, r]);
            if (board[r][c]) { board[r][c] = 0; destroyed++; }
          }
      break;
    case RAY:
      for (let r = 0; r < ROWS; r++) {
        cells.push([x, r]);
        if (r !== y && board[r][x]) { board[r][x] = 0; destroyed++; }
      }
      for (let c = 0; c < COLS; c++) if (c !== x) cells.push([c, y]);
      // Fill the landing row so clearLines() removes it as a regular line
      board[y].fill(RAY);
      break;
    case TINT: {
      let target = y + 1 < ROWS ? board[y + 1][x] : 0;
      if (!target || target === WILDCARD) target = mostCommonColor();
      if (target)
        for (let r = 0; r < ROWS; r++)
          for (let c = 0; c < COLS; c++)
            if (board[r][c] === target) { board[r][c] = WILDCARD; cells.push([c, r]); }
      break;
    }
    case GRAVITY:
      for (let c = 0; c < COLS; c++) {
        const filled = [];
        for (let r = 0; r < ROWS; r++) if (board[r][c]) filled.push(board[r][c]);
        for (let r = ROWS - 1; r >= 0; r--) {
          board[r][c] = filled.pop() || 0;
          if (board[r][c]) cells.push([c, r]);
        }
      }
      break;
  }
  const gained = destroyed * EFFECT_CELL_SCORE * level;
  score += gained;
  effects.push({
    cells,
    color: skin.colors[type],
    flashAlpha: type === GRAVITY ? 0.4 : 0.8,
    text: `${POWER_ICONS[type]} ${gained ? '+' + gained : POWER_NAMES[type]}`,
    tx: x * BLOCK + BLOCK / 2,
    ty: y * BLOCK + BLOCK / 2,
    start: performance.now(),
  });
  updateHUD();
}

function mostCommonColor() {
  const counts = {};
  let best = 0;
  for (const row of board)
    for (const v of row)
      if (v && v !== WILDCARD) {
        counts[v] = (counts[v] || 0) + 1;
        if (!best || counts[v] > counts[best]) best = v;
      }
  return best;
}

function spawn() {
  current = next;
  if (pendingPowerUps > 0) {
    pendingPowerUps--;
    next = makePiece(POWER_UPS[Math.floor(Math.random() * POWER_UPS.length)]);
  } else {
    next = randomPiece();
  }
  dropAccum = 0;
  if (collide(current.shape, current.x, current.y)) {
    endGame();
  }
  drawNext();
}

function updateHUD() {
  scoreEl.textContent = score.toLocaleString();
  linesEl.textContent = lines;
  levelEl.textContent = level;
}

function drawBlock(context, x, y, colorIndex, size, alpha) {
  if (!colorIndex) return;
  const px = x * size, py = y * size;
  let fill = skin.colors[colorIndex];
  if (colorIndex === WILDCARD) {
    fill = context.createLinearGradient(px, py, px + size, py + size);
    skin.rainbow.forEach((c, i, a) => fill.addColorStop(i / (a.length - 1), c));
  }
  context.save();
  context.globalAlpha = alpha ?? 1;
  skin.drawCell(context, px, py, size, fill, colorIndex);
  context.restore();
  if (isPowerUp(colorIndex)) drawPowerUpMark(context, px, py, size, colorIndex, alpha ?? 1);
}

function drawCellRetro(context, px, py, size, fill) {
  context.fillStyle = fill;
  context.fillRect(px + 1, py + 1, size - 2, size - 2);
  // highlight
  context.fillStyle = 'rgba(255,255,255,0.12)';
  context.fillRect(px + 1, py + 1, size - 2, 4);
}

function drawCellNeon(context, px, py, size, fill, colorIndex) {
  const alpha = context.globalAlpha;
  context.shadowColor = colorIndex === WILDCARD ? '#ffffff' : fill;
  context.shadowBlur = size * 0.5;
  // dim tinted core + bright glowing outline
  context.fillStyle = fill;
  context.globalAlpha = alpha * 0.35;
  context.fillRect(px + 3, py + 3, size - 6, size - 6);
  context.globalAlpha = alpha;
  context.strokeStyle = fill;
  context.lineWidth = 2;
  context.strokeRect(px + 3, py + 3, size - 6, size - 6);
  context.shadowBlur = 0;
  context.fillStyle = 'rgba(255,255,255,0.55)';
  context.fillRect(px + 6, py + 6, size * 0.25, 2);
}

// Canvas 2D roundRect() is not available everywhere, so build the path with arcTo
function roundRectPath(context, x, y, w, h, r) {
  context.beginPath();
  context.moveTo(x + r, y);
  context.arcTo(x + w, y, x + w, y + h, r);
  context.arcTo(x + w, y + h, x, y + h, r);
  context.arcTo(x, y + h, x, y, r);
  context.arcTo(x, y, x + w, y, r);
  context.closePath();
}

function drawCellPastel(context, px, py, size, fill) {
  const r = size * 0.25;
  roundRectPath(context, px + 1.5, py + 1.5, size - 3, size - 3, r);
  context.fillStyle = fill;
  context.fill();
  context.strokeStyle = 'rgba(90,70,110,0.18)';
  context.lineWidth = 1;
  context.stroke();
  // soft glossy highlight in the upper half
  roundRectPath(context, px + 5, py + 4, size - 10, size * 0.3, r * 0.6);
  context.fillStyle = 'rgba(255,255,255,0.45)';
  context.fill();
}

function drawCellPixel(context, px, py, size, fill) {
  const u = size / 10; // 10×10 "pixels" per block
  context.fillStyle = fill;
  context.fillRect(px, py, size, size);
  // bevel: light top/left, dark bottom/right, dark outline
  context.fillStyle = 'rgba(255,255,255,0.45)';
  context.fillRect(px + u, py + u, size - 2 * u, u);
  context.fillRect(px + u, py + u, u, size - 2 * u);
  context.fillStyle = 'rgba(0,0,0,0.35)';
  context.fillRect(px + u, py + size - 2 * u, size - 2 * u, u);
  context.fillRect(px + size - 2 * u, py + u, u, size - 2 * u);
  context.strokeStyle = 'rgba(0,0,0,0.6)';
  context.lineWidth = u * 0.6;
  context.strokeRect(px + u * 0.3, py + u * 0.3, size - u * 0.6, size - u * 0.6);
  // dithered texture on the inner face
  context.fillStyle = 'rgba(0,0,0,0.18)';
  for (let i = 2; i < 8; i++)
    for (let j = 2; j < 8; j++)
      if ((i + 2 * j) % 5 === 0) context.fillRect(px + i * u, py + j * u, u, u);
  context.fillStyle = 'rgba(255,255,255,0.7)';
  context.fillRect(px + 2 * u, py + 2 * u, u, u);
}

function drawPowerUpMark(context, px, py, size, type, alpha) {
  const cx = px + size / 2, cy = py + size / 2;
  context.globalAlpha = alpha;
  // light disc behind the emoji keeps it readable on any background
  context.fillStyle = 'rgba(255,255,255,0.85)';
  context.beginPath();
  context.arc(cx, cy, size * 0.38, 0, Math.PI * 2);
  context.fill();
  // pulsing gold border marks the piece as special
  context.globalAlpha = alpha * (0.6 + 0.4 * Math.sin(performance.now() / 150));
  context.strokeStyle = '#ffd700';
  context.lineWidth = 2;
  context.strokeRect(px + 2, py + 2, size - 4, size - 4);
  context.globalAlpha = alpha;
  context.font = `${Math.floor(size * 0.6)}px sans-serif`;
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  context.fillText(POWER_ICONS[type], cx, cy + 1);
  context.globalAlpha = 1;
}

function drawEffects() {
  const now = performance.now();
  effects = effects.filter(e => now - e.start < EFFECT_TEXT_MS);
  for (const e of effects) {
    const t = now - e.start;
    if (t < EFFECT_FLASH_MS) {
      ctx.globalAlpha = e.flashAlpha * (1 - t / EFFECT_FLASH_MS);
      ctx.fillStyle = e.color;
      for (const [c, r] of e.cells) ctx.fillRect(c * BLOCK, r * BLOCK, BLOCK, BLOCK);
    }
    const p = t / EFFECT_TEXT_MS;
    ctx.globalAlpha = 1 - p;
    ctx.font = 'bold 16px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const half = ctx.measureText(e.text).width / 2 + 4;
    const tx = Math.min(Math.max(e.tx, half), canvas.width - half);
    const ty = Math.max(e.ty - p * 30, 12);
    ctx.lineWidth = 3;
    ctx.strokeStyle = 'rgba(0,0,0,0.85)';
    ctx.strokeText(e.text, tx, ty);
    ctx.fillStyle = '#ffffff';
    ctx.fillText(e.text, tx, ty);
  }
  ctx.globalAlpha = 1;
}

function drawGrid() {
  ctx.strokeStyle = typeof skin.grid === 'string' ? skin.grid : skin.grid[theme] || skin.grid.dark;
  ctx.lineWidth = 0.5;
  for (let c = 1; c < COLS; c++) {
    ctx.beginPath();
    ctx.moveTo(c * BLOCK, 0);
    ctx.lineTo(c * BLOCK, ROWS * BLOCK);
    ctx.stroke();
  }
  for (let r = 1; r < ROWS; r++) {
    ctx.beginPath();
    ctx.moveTo(0, r * BLOCK);
    ctx.lineTo(COLS * BLOCK, r * BLOCK);
    ctx.stroke();
  }
}

function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  drawGrid();

  // board
  for (let r = 0; r < ROWS; r++)
    for (let c = 0; c < COLS; c++)
      drawBlock(ctx, c, r, board[r][c], BLOCK);

  // ghost
  const gy = ghostY();
  for (let r = 0; r < current.shape.length; r++)
    for (let c = 0; c < current.shape[r].length; c++)
      if (current.shape[r][c])
        drawBlock(ctx, current.x + c, gy + r, current.shape[r][c], BLOCK, 0.2);

  // current piece
  for (let r = 0; r < current.shape.length; r++)
    for (let c = 0; c < current.shape[r].length; c++)
      drawBlock(ctx, current.x + c, current.y + r, current.shape[r][c], BLOCK);

  drawEffects();
}

function drawNext() {
  const NB = 30;
  nextCtx.clearRect(0, 0, nextCanvas.width, nextCanvas.height);
  const shape = next.shape;
  const offX = Math.floor((4 - shape[0].length) / 2);
  const offY = Math.floor((4 - shape.length) / 2);
  for (let r = 0; r < shape.length; r++)
    for (let c = 0; c < shape[r].length; c++)
      drawBlock(nextCtx, offX + c, offY + r, shape[r][c], NB);
}

function endGame() {
  gameOver = true;
  cancelAnimationFrame(animId);
  overlayTitle.textContent = 'GAME OVER';
  overlayScore.textContent = `Puntuación: ${score.toLocaleString()}`;
  resumeBtn.hidden = true;
  overlay.classList.remove('hidden');
}

function applyTheme(newTheme) {
  theme = newTheme;
  document.body.dataset.theme = theme;
  localStorage.setItem(THEME_STORAGE_KEY, theme);
  themeToggleBtn.setAttribute('aria-pressed', String(theme === 'light'));
  themeToggleBtn.setAttribute('aria-label', theme === 'dark' ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro');
  if (current) draw();
  if (next) drawNext();
}

function applySkin(name) {
  if (!SKINS[name]) name = DEFAULT_SKIN;
  skin = SKINS[name];
  document.body.dataset.skin = name;
  localStorage.setItem(SKIN_STORAGE_KEY, name);
  skinSelect.value = name;
  if (current) draw();
  if (next) drawNext();
}

function toggleTheme() {
  applyTheme(theme === 'dark' ? 'light' : 'dark');
}

function togglePause() {
  if (gameOver) return;
  paused = !paused;
  if (!paused) {
    overlay.classList.add('hidden');
    lastTime = performance.now();
    loop(lastTime);
  } else {
    cancelAnimationFrame(animId);
    overlayTitle.textContent = 'PAUSA';
    overlayScore.textContent = '';
    resumeBtn.hidden = false;
    overlay.classList.remove('hidden');
  }
}

function loop(ts) {
  const dt = ts - lastTime;
  lastTime = ts;
  dropAccum += dt;
  if (dropAccum >= dropInterval) {
    dropAccum = 0;
    if (!collide(current.shape, current.x, current.y + 1)) {
      current.y++;
    } else {
      lockPiece();
    }
  }
  draw();
  if (!gameOver) animId = requestAnimationFrame(loop);
}

function init() {
  board = createBoard();
  score = 0;
  lines = 0;
  level = 1;
  paused = false;
  gameOver = false;
  dropInterval = 1000;
  dropAccum = 0;
  pendingPowerUps = 0;
  effects = [];
  lastTime = performance.now();
  next = randomPiece();
  spawn();
  updateHUD();
  overlay.classList.add('hidden');
  cancelAnimationFrame(animId);
  animId = requestAnimationFrame(loop);
}

document.addEventListener('keydown', e => {
  if (e.target === skinSelect) return; // arrows/space belong to the focused selector
  if (e.code === 'KeyP') { togglePause(); return; }
  if (paused || gameOver) return;
  switch (e.code) {
    case 'ArrowLeft':
      if (!collide(current.shape, current.x - 1, current.y)) current.x--;
      break;
    case 'ArrowRight':
      if (!collide(current.shape, current.x + 1, current.y)) current.x++;
      break;
    case 'ArrowDown':
      softDrop();
      break;
    case 'ArrowUp':
    case 'KeyX':
      tryRotate();
      break;
    case 'Space':
      e.preventDefault();
      hardDrop();
      break;
  }
  updateHUD();
});

restartBtn.addEventListener('click', init);
resumeBtn.addEventListener('click', togglePause);
themeToggleBtn.addEventListener('click', toggleTheme);
skinSelect.addEventListener('change', () => {
  applySkin(skinSelect.value);
  skinSelect.blur(); // give the keyboard back to the game
});

const savedTheme = localStorage.getItem(THEME_STORAGE_KEY);
applySkin(localStorage.getItem(SKIN_STORAGE_KEY));
applyTheme(savedTheme === 'light' ? 'light' : 'dark');

init();
