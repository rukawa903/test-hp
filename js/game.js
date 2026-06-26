"use strict";

/* =========================================================
   3分マージ部屋 - 最小プレイ可能プロトタイプ
   - 7x7盤面 / 絵文字スプライト（画像素材なし）
   - 生成装置でLv1を出す / 同レベルをドラッグで重ねてマージ
   - localStorageで状態保存・復元
   ========================================================= */

/* ---- 設定 ---- */
const SERIES = ["🌱", "🌿", "🪴", "🌳", "🌸", "🌺"]; // index0=Lv1 ... 最終形
const MAX_LEVEL = SERIES.length;                       // 6
const BOARD_SIZE = 7;
const CELL_COUNT = BOARD_SIZE * BOARD_SIZE;            // 49
const SAVE_KEY = "mergeRoom.save";
const SAVE_VERSION = 1;

/* ---- 状態 ---- */
let state = null; // { version, board: Array(49) of (level|null) }

/* ---- DOM ---- */
const titleScreen = document.getElementById("title-screen");
const gameScreen = document.getElementById("game-screen");
const boardEl = document.getElementById("board");
const bestLevelEl = document.getElementById("best-level");

/* =========================================================
   セーブ / ロード
   ========================================================= */
function newState() {
  const board = new Array(CELL_COUNT).fill(null);
  // 開始時に少しだけ種を置く（すぐマージを試せるように）
  board[16] = 1;
  board[17] = 1;
  board[24] = 1;
  return { version: SAVE_VERSION, board };
}

function save() {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(state));
  } catch (e) {
    /* 保存不可環境でもプレイは継続 */
  }
}

function load() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (
      !data ||
      data.version !== SAVE_VERSION ||
      !Array.isArray(data.board) ||
      data.board.length !== CELL_COUNT
    ) {
      return null;
    }
    return data;
  } catch (e) {
    return null;
  }
}

/* =========================================================
   描画
   ========================================================= */
function render() {
  boardEl.innerHTML = "";
  for (let i = 0; i < CELL_COUNT; i++) {
    const cell = document.createElement("div");
    cell.className = "cell";
    cell.dataset.index = i;

    const level = state.board[i];
    if (level) {
      const tile = document.createElement("div");
      tile.className = "tile";
      tile.dataset.index = i;
      tile.innerHTML =
        `<span class="emoji">${SERIES[level - 1]}</span>` +
        `<span class="lv">Lv${level}</span>`;
      cell.appendChild(tile);
    }
    boardEl.appendChild(cell);
  }
  updateBestLevel();
}

function updateBestLevel() {
  let best = 1;
  for (const level of state.board) {
    if (level && level > best) best = level;
  }
  bestLevelEl.textContent = best;
}

/* =========================================================
   ゲーム操作
   ========================================================= */
function generate() {
  const empty = state.board.indexOf(null);
  if (empty === -1) return; // 盤面が満杯
  state.board[empty] = 1;
  save();
  render();
}

// from を to に適用： 空き→移動 / 同レベル→マージ / それ以外→何もしない
function applyDrop(from, to) {
  if (from === to) return false;
  const a = state.board[from];
  const b = state.board[to];
  if (!a) return false;

  if (b === null) {
    // 移動
    state.board[to] = a;
    state.board[from] = null;
    return true;
  }
  if (a === b && a < MAX_LEVEL) {
    // マージ
    state.board[to] = a + 1;
    state.board[from] = null;
    return true;
  }
  return false; // 異種・最終形どうしは不可
}

/* =========================================================
   ドラッグ（pointer events: マウス/タッチ共通）
   ========================================================= */
let drag = null; // { from, ghost }

function onPointerDown(e) {
  const tile = e.target.closest(".tile");
  if (!tile) return;
  const from = Number(tile.dataset.index);
  if (!state.board[from]) return;

  e.preventDefault();
  const level = state.board[from];

  const ghost = document.createElement("div");
  ghost.id = "drag-ghost";
  ghost.textContent = SERIES[level - 1];
  const rect = boardEl.querySelector(`.cell[data-index="${from}"]`).getBoundingClientRect();
  ghost.style.width = rect.width + "px";
  ghost.style.height = rect.height + "px";
  document.body.appendChild(ghost);

  tile.classList.add("dragging");
  drag = { from, ghost };
  moveGhost(e.clientX, e.clientY);

  window.addEventListener("pointermove", onPointerMove);
  window.addEventListener("pointerup", onPointerUp);
}

function moveGhost(x, y) {
  if (!drag) return;
  drag.ghost.style.left = x + "px";
  drag.ghost.style.top = y + "px";
}

function cellIndexAt(x, y) {
  const el = document.elementFromPoint(x, y);
  if (!el) return -1;
  const cell = el.closest(".cell");
  if (!cell) return -1;
  return Number(cell.dataset.index);
}

function clearDropHighlight() {
  const prev = boardEl.querySelector(".cell.drop-target");
  if (prev) prev.classList.remove("drop-target");
}

function onPointerMove(e) {
  if (!drag) return;
  moveGhost(e.clientX, e.clientY);
  clearDropHighlight();
  const idx = cellIndexAt(e.clientX, e.clientY);
  if (idx >= 0 && idx !== drag.from) {
    const cell = boardEl.querySelector(`.cell[data-index="${idx}"]`);
    if (cell) cell.classList.add("drop-target");
  }
}

function onPointerUp(e) {
  if (!drag) return;
  const to = cellIndexAt(e.clientX, e.clientY);
  const from = drag.from;

  // 後片付け
  drag.ghost.remove();
  clearDropHighlight();
  window.removeEventListener("pointermove", onPointerMove);
  window.removeEventListener("pointerup", onPointerUp);
  drag = null;

  if (to >= 0 && applyDrop(from, to)) {
    save();
  }
  render();
}

/* =========================================================
   画面遷移 / 初期化
   ========================================================= */
function showScreen(name) {
  titleScreen.classList.toggle("active", name === "title");
  gameScreen.classList.toggle("active", name === "game");
}

function startGame() {
  state = load() || newState();
  save();
  render();
  showScreen("game");
}

function resetGame() {
  state = newState();
  save();
  render();
}

function init() {
  document.getElementById("start-btn").addEventListener("click", startGame);
  document.getElementById("generate-btn").addEventListener("click", generate);
  document.getElementById("reset-btn").addEventListener("click", resetGame);
  boardEl.addEventListener("pointerdown", onPointerDown);
}

init();
