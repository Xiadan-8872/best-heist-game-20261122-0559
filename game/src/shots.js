// Screenshot autopilot for The Velvet Vault.
// ?shot=start|play|end&seed=N stages a genuine frame of play:
//   start — the title over the live gallery, guards on patrol;
//   play  — the autopilot sneaks through Job I by the real rules;
//   end   — the autopilot plays the whole night forward (fast-forwarded
//           through the same update loop) and the results screen is shown.
// ?seed=N fixes patrol timing, so a shot can be retaken identically.
// The autopilot never cheats: it feeds the same movement keys a human
// would, holds E at the same points, and can be busted like anyone else.
import { Game } from './engine.js';

export function parseShot() {
  const q = new URLSearchParams(window.location.search);
  return {
    shot: q.get('shot') || null,
    seed: q.get('seed') || '1',
  };
}

// Stage the game for a screenshot. Returns the game. For shot=end the
// whole night is played forward synchronously before the first paint.
export function stageShot(game, shot, seed) {
  const statusEl = document.getElementById('ap-status');
  const note = (s) => {
    game.apStatus = s;
    if (statusEl) statusEl.textContent = s;
  };
  if (shot === 'start') {
    game.autopilot = true;
    game.state = 'title';
    // The title draws over the live gallery: guards patrol behind it.
    game.jobIndex = 0;
    game.loadLevel(0);
    game.time = 6; // let the patrols spread out before the frame
    note('staged:start');
    return game;
  }
  if (shot === 'play') {
    game.autopilot = true;
    game.startNight();
    game.chooseLoadout('lockpick');
    // Play forward a little so the frame catches Wren mid-room, not at
    // the door. The live loop keeps playing after this.
    game.apFastForward(9);
    note(`staged:play state=${game.state} job=${game.jobIndex + 1} loot=$${game.jobLoot}`);
    return game;
  }
  if (shot === 'end') {
    game.autopilot = true;
    game.startNight();
    const endState = game.apFastForward(600);
    note(`staged:end state=${endState} total=$${game.totalLoot} peakAlarm=${Math.round(game.peakAlarm)} lives=${game.lives} nightTime=${Math.round(game.nightTime)}s`);
    return game;
  }
  return game;
}

// While the autopilot is on and the state is play, drive the thief.
export function autopilotTick(game, dt) {
  if (!game.autopilot || game.state !== 'play') return;
  game.apClearKeys();
  game.apStep(dt);
}
