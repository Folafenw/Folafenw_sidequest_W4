
const TS = 32;

// Raw JSON data (from levels.json).
let levelsData;

// Array of Level instances.
let levels = [];

// Current level index.
let li = 0;

// Player instance (tile-based).
let player;

function preload() {
  // Ensure level data is ready before setup runs.
  levelsData = loadJSON("levels.json");
}

function setup() {
  /*
  Convert raw JSON grids into Level objects.
  levelsData.levels is an array of 2D arrays. 
  */
  levels = levelsData.levels.map((grid) => new Level(copyGrid(grid), TS));

  // Generated levels
  const procGrid = buildProceduralLevel (12, 18, 424242);
  levels.push (new Level (copyGrid (procGrid), TS));
  
  // Create a player.
  player = new Player(TS);

  // Load the first level (sets player start + canvas size).
  loadLevel(0);

  noStroke();
  textFont("sans-serif");
  textSize(14);
}

function draw() {
  background(240);

  // Draw current level then player on top.
  levels[li].draw();
  player.draw();

  drawHUD();
}

function drawHUD() {
  // HUD matches your original idea: show level count and controls.
  fill(0);
  text(`Level ${li + 1}/${levels.length} — WASD/Arrows to move`, 10, 16);
  text ('Spikes reset you to start', 10, 34);
}

function keyPressed() {
  /*
  Convert key presses into a movement direction. (WASD + arrows)
  */
  let dr = 0;
  let dc = 0;

  if (keyCode === LEFT_ARROW || key === "a" || key === "A") dc = -1;
  else if (keyCode === RIGHT_ARROW || key === "d" || key === "D") dc = 1;
  else if (keyCode === UP_ARROW || key === "w" || key === "W") dr = -1;
  else if (keyCode === DOWN_ARROW || key === "s" || key === "S") dr = 1;
  else return; // not a movement key

  // Try to move. If blocked, nothing happens.
  const moved = player.tryMove(levels[li], dr, dc);

  if (moved && levels[li].isSpike(player.r, player.c)) {
    loadLevel(li);
    return;
  }

  // If the player moved onto a goal tile, advance levels.
  if (moved && levels[li].isGoal(player.r, player.c)) {
    nextLevel();
  }
}

// ----- Level switching -----

function loadLevel(idx) {
  li = idx;

  const level = levels[li];

  // Place player at the level's start tile (2), if present.
  if (level.start) {
    player.setCell(level.start.r, level.start.c);
  } else {
    // Fallback spawn: top-left-ish (but inside bounds).
    player.setCell(1, 1);
  }

  // Ensure the canvas matches this level’s dimensions.
  resizeCanvas(level.pixelWidth(), level.pixelHeight());
}

function nextLevel() {
  // Wrap around when we reach the last level.
  const next = (li + 1) % levels.length;
  loadLevel(next);
}

// ----- Utility -----

function copyGrid(grid) {
  /*
  Make a deep-ish copy of a 2D array:
  - new outer array
  - each row becomes a new array

  Why copy?
  - Because Level constructor may normalize tiles (e.g., replace 2 with 0)
  - And we don’t want to accidentally mutate the raw JSON data object. 
  */
  return grid.map((row) => row.slice());
}


function buildProceduralLevel(rows, cols, seed = 12345) {
  // Safety: minimum viable size with outer walls
  rows = Math.max(rows, 7);
  cols = Math.max(cols, 10);

  // 1) Start with all walls
  const G = Array.from({ length: rows }, () => Array(cols).fill(1));

  // 2) Carve interior floors with a double loop
  for (let r = 1; r < rows - 1; r++) {
    for (let c = 1; c < cols - 1; c++) {
      G[r][c] = 0; // floor
    }
  }

  // 3) Place start & goal
  const start = { r: 1, c: 1 };
  const goal  = { r: rows - 2, c: cols - 2 };
  G[start.r][start.c] = 2;
  G[goal.r][goal.c] = 3;

  // 4) Add some internal wall “pillars” using loops
  //    (simple columns to create navigation choices)
  for (let r = 2; r < rows - 2; r++) {
    if (r % 2 === 0) {
      const c1 = Math.floor(cols * 0.33);
      const c2 = Math.floor(cols * 0.66);
      G[r][c1] = 1;
      G[r][c2] = 1;
    }
  }

  // 5) Spike patterns with loops

  // 5a) Checkerboard spikes in a band (every 2 tiles)
  for (let r = 2; r < rows - 2; r++) {
    for (let c = 2; c < cols - 2; c++) {
      if ((r + c) % 2 === 0 && r >= Math.floor(rows * 0.35) && r <= Math.floor(rows * 0.65)) {
        if (!isStartOrGoal(start, goal, r, c) && G[r][c] === 0) G[r][c] = 4;
      }
    }
  }

  // 5b) A vertical “spike line” on every 3rd column
  for (let c = 3; c < cols - 3; c += 3) {
    for (let r = 2; r < rows - 2; r++) {
      if (!isStartOrGoal(start, goal, r, c) && G[r][c] === 0) G[r][c] = 4;
    }
  }

  // 5c) Sprinkle some random spikes (deterministic with a seed)
  const rnd = mulberry32(seed);
  let sprinkled = Math.floor((rows * cols) * 0.08);
  while (sprinkled > 0) {
    const r = 1 + Math.floor(rnd() * (rows - 2));
    const c = 1 + Math.floor(rnd() * (cols - 2));
    if (!isStartOrGoal(start, goal, r, c) && G[r][c] === 0) {
      G[r][c] = 4;
      sprinkled--;
    }
  }

  // Optional: ensure at least a horizontal corridor from start side
  // (reduce frustration; keeps a guaranteed safe band)
  const safeRow = start.r + 1;
  for (let c = start.c; c < cols - 1; c++) {
    if (!isStartOrGoal(start, goal, safeRow, c) && G[safeRow][c] !== 1) {
      G[safeRow][c] = 0; // clear any spikes from this band
    }
  }

  return G;
}

function isStartOrGoal(start, goal, r, c) {
  return (r === start.r && c === start.c) || (r === goal.r && c === goal.c);
}

// Deterministic RNG for reproducible procedural levels
function mulberry32(a) {
  return function () {
    let t = a += 0x6D2B79F5;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
