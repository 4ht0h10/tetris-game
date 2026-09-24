# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Classic Tetris in vanilla JavaScript + HTML5 Canvas + CSS. No dependencies, no `package.json`, no build step, no test suite, no linter. User-facing text (UI labels, README) is in Spanish.

## Running

Open `index.html` directly in a browser, or serve the folder statically (recommended):

```bash
python -m http.server 8000   # then http://localhost:8000
npx serve .
```

Verification is manual: reload the page and play.

## Architecture

- `index.html` — DOM: `<canvas id="board">` (300×600), side panel (`#score`, `#lines`, `#level`, `<canvas id="next-canvas">` 120×120), and a shared `#overlay` used for both PAUSE and GAME OVER (toggled via the `hidden` class). `game.js` looks up these elements by id at load time, so renaming ids requires changing both files.
- `game.js` — all game logic, as top-level functions sharing module-level mutable state (`board`, `current`, `next`, `score`, `lines`, `level`, `paused`, `gameOver`, `dropInterval`, `dropAccum`, `animId`). `init()` resets all of it and is also the restart handler.
- `style.css` — dark/retro visual theme only.

Key conventions in `game.js`:

- **Board** is a `ROWS × COLS` matrix; `0` = empty, `1–7` = piece type, which doubles as the index into `COLORS` and `PIECES`. Piece shape matrices store their type number in filled cells, so merging a piece copies color info directly into the board.
- **Pieces** are `{ type, shape, x, y }`; `shape` is a square matrix copied from `PIECES` (never mutate `PIECES` itself). Rotation is `rotateCW` (transpose + reverse), with simple horizontal wall kicks `[0, -1, 1, -2, 2]` in `tryRotate`.
- **`collide(shape, x, y)`** is the single source of truth for movement validity; cells with `y < 0` are allowed (above the board).
- **Lock pipeline**: `lockPiece()` → `merge()` → `clearLines()` (updates lines/score/level/`dropInterval`) → `spawn()` (promotes `next` to `current`; collision at spawn triggers `endGame()`).
- **Game loop**: `loop(ts)` via `requestAnimationFrame`, accumulating time in `dropAccum` until `dropInterval`; it redraws the whole board each frame. Pause/game over stop the loop with `cancelAnimationFrame(animId)`.
- Speed formula: `max(100, 1000 − (level − 1) × 90)` ms; level = `floor(lines / 10) + 1`. Scoring: `LINE_SCORES[cleared] × level`, +1 per soft-drop row, +2 per hard-drop row.

If `COLS`, `ROWS` or `BLOCK` change, update the `<canvas id="board">` `width`/`height` in `index.html` to `COLS × BLOCK` by `ROWS × BLOCK`. `drawNext` assumes a 4×4 grid of 30px cells (matches the 120×120 preview canvas).
