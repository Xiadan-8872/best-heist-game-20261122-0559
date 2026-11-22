// The Velvet Vault — Midnight Heist. Bootstrap, input and the game loop.
// The game is static files only: no build step, no libraries, no network.
// Open game/index.html in a desktop browser and play.
import { Game } from './engine.js';
import { Renderer } from './render.js';
import { parseShot, stageShot, autopilotTick } from './shots.js';

const canvas = document.getElementById('game');
const renderer = new Renderer(canvas);
const { shot, seed } = parseShot();
const game = new Game(seed);

function toGameCoords(ev) {
  const rect = canvas.getBoundingClientRect();
  return {
    x: ((ev.clientX - rect.left) / rect.width) * 1280,
    y: ((ev.clientY - rect.top) / rect.height) * 800,
  };
}

function confirm() {
  game.sounds.ensure();
  if (game.state === 'title') {
    game.startNight();
  } else if (game.state === 'jobdone') {
    game.jobIndex += 1;
    game.state = 'loadout';
  } else if (game.state === 'nightdone' || game.state === 'gameover') {
    game.startNight();
  }
}

window.addEventListener('keydown', (ev) => {
  if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(ev.code)) {
    ev.preventDefault();
  }
  if (ev.repeat) return;
  game.setKey(ev.code, true);
  if (ev.code === 'Enter') confirm();
  if (ev.code === 'KeyP' || ev.code === 'Escape') {
    if (game.state === 'play') game.state = 'paused';
    else if (game.state === 'paused') game.state = 'play';
  }
  if (ev.code === 'KeyM') {
    game.sounds.setMuted(!game.sounds.muted);
    game.say(game.sounds.muted ? 'Muted.' : 'Sound on.', 2);
  }
  if (game.state === 'loadout') {
    if (ev.code === 'Digit1' || ev.code === 'Numpad1') game.chooseLoadout('lockpick');
    if (ev.code === 'Digit2' || ev.code === 'Numpad2') game.chooseLoadout('emp');
  }
});
window.addEventListener('keyup', (ev) => game.setKey(ev.code, false));

canvas.addEventListener('mousedown', (ev) => {
  game.sounds.ensure();
  if (game.state === 'title' || game.state === 'jobdone' || game.state === 'nightdone' || game.state === 'gameover') {
    confirm();
    return;
  }
  if (game.state === 'loadout') {
    const p = toGameCoords(ev);
    // Loadout panel: two rows, lockpick upper, EMP lower.
    if (p.y > 380 && p.y < 420) game.chooseLoadout('lockpick');
    else if (p.y > 420 && p.y < 460) game.chooseLoadout('emp');
    return;
  }
  if (game.state === 'play') {
    const p = toGameCoords(ev);
    if (p.y > 64) game.clickTarget = p;
  }
});
canvas.addEventListener('contextmenu', (ev) => ev.preventDefault());

// Stage a screenshot, or start the title screen for a human player.
if (shot) {
  stageShot(game, shot, seed);
} else {
  game.state = 'title';
}

let last = performance.now();
function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  autopilotTick(game, dt);
  game.update(dt);
  renderer.draw(game);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
