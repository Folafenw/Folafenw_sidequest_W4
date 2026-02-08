
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
