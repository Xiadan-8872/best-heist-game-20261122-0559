// The Velvet Vault — game engine.
// Pure rules: movement, collision, guard patrols and vision cones, cameras,
// blinking lasers, the alarm meter, the heat/wanted level, loot, the vault,
// the diamond, lives and busts. The renderer only reads this state; the
// autopilot drives the same update() a human player drives.
import { buildLevels, payableLoot, PLAY } from './levels.js';
import { clamp, dist, angleTo, angleDiff, distToSegment } from './rng.js';
import { SoundBank } from './audio.js';

export const WORLD = { w: 1280, h: 800, hud: 64 };
const TAU = Math.PI * 2;

function segHitsRect(x1, y1, x2, y2, r) {
  // Slab test: does segment (x1,y1)-(x2,y2) cross rectangle r?
  const dx = x2 - x1;
  const dy = y2 - y1;
  let tmin = 0;
  let tmax = 1;
  const axes = [
    [dx, x1, r.x, r.x + r.w],
    [dy, y1, r.y, r.y + r.h],
  ];
  for (const [d, o, lo, hi] of axes) {
    if (Math.abs(d) < 1e-9) {
      if (o < lo || o > hi) return false;
    } else {
      let t1 = (lo - o) / d;
      let t2 = (hi - o) / d;
      if (t1 > t2) [t1, t2] = [t2, t1];
      tmin = Math.max(tmin, t1);
      tmax = Math.min(tmax, t2);
      if (tmin > tmax) return false;
    }
  }
  return true;
}

export class Game {
  constructor(seed) {
    this.seed = seed || '1';
    this.levels = buildLevels();
    this.sounds = new SoundBank();
    this.time = 0; // game time, seconds (drives patrols, cameras, lasers)
    this.state = 'title'; // title | loadout | play | paused | busted | jobdone | nightdone | gameover
    this.jobIndex = 0;
    this.lives = 3;
    this.totalLoot = 0;
    this.jobLoot = 0;
    this.alarm = 0;
    this.peakAlarm = 0;
    this.heat = 0;
    this.heatTrippedAt75 = false;
    this.lockdown = false;
    this.loadout = 'lockpick';
    this.message = '';
    this.messageUntil = 0;
    this.jobResults = [];
    this.ghost = true;
    this.keys = {};
    this.clickTarget = null;
    this.autopilot = false;
    this.apStatus = '';
    this.bustedAt = 0;
    this.jobDoneAt = 0;
    this.alarmBeepAt = 0;
    this.vaultProgress = 0;
    this.holdTarget = null;
    this.holdProgress = 0;
    this.nightTime = 0;
    this.loadLevel(0);
  }

  get level() {
    return this.levels[this.jobIndex];
  }

  loadLevel(i) {
    this.jobIndex = i;
    const lv = this.level;
    this.player = {
      x: lv.entrance.x, y: lv.entrance.y, r: 13,
      vx: 0, vy: 0, facing: -Math.PI / 2, moving: false,
      sneak: false, dashT: 0, dashCd: 0, stepT: 0,
    };
    this.guards = lv.guards.map((g, idx) => ({
      id: idx,
      path: g.path,
      wp: 0,
      x: g.path[0][0], y: g.path[0][1],
      speed: g.speed, pause: g.pause, pauseT: 0,
      facing: 0, suspicion: 0, mode: 'patrol', // patrol | chase | investigate
      investigate: null, loseT: 0, baseSpeed: g.speed,
    }));
    this.reinforcementSpawned = false;
    this.cameras = lv.cameras.map((c) => ({
      ...c, angle: c.base, disabledUntil: -1,
    }));
    if (this.loadout === 'emp' && this.cameras.length > 0) {
      this.cameras[0].disabledUntil = Infinity; // EMP burns one camera out for the job
    }
    this.loot = payableLoot(lv).map((l) => ({ ...l, taken: false }));
    this.vaultCracked = false;
    this.diamondTaken = false;
    this.jobLoot = 0;
    this.holdTarget = null;
    this.holdProgress = 0;
    this.laserTrips = lv.lasers.map(() => -10);
    this.heatTrippedAt75 = false;
    this.flash = 0;
    this.flashColor = '255,60,60';
    this.apBuildGrid();
    this.apPath = null;
    this.apPathObj = '';
    this.apRepathAt = 0;
  }

  // ---- queries used by engine and renderer ----
  inShadow(x, y) {
    return this.level.shadows.some((s) => dist(x, y, s.x, s.y) < s.r);
  }

  losClear(x1, y1, x2, y2) {
    for (const w of this.level.walls) {
      if (segHitsRect(x1, y1, x2, y2, w)) return false;
    }
    return true;
  }

  laserOn(laser, t) {
    const ph = ((t + laser.phase) % laser.period) / laser.period;
    return ph < laser.onFrac;
  }

  cameraAngle(cam, t) {
    return cam.base + Math.sin((t / cam.period) * TAU) * cam.sweep;
  }

  guardRange(g) {
    let r = 260;
    if (this.player.sneak) r -= 55;
    if (this.inShadow(this.player.x, this.player.y)) r -= 130;
    return r;
  }

  // Is point (x,y) inside guard g's vision cone right now?
  inGuardCone(g, x, y, rangeOverride) {
    const range = rangeOverride ?? 260;
    const d = dist(g.x, g.y, x, y);
    if (d > range) return false;
    const ang = angleTo(g.x, g.y, x, y);
    if (Math.abs(angleDiff(ang, g.facing)) > 0.56) return false;
    return this.losClear(g.x, g.y, x, y);
  }

  inCameraArc(cam, x, y, t) {
    if (t < cam.disabledUntil) return false;
    const d = dist(cam.x, cam.y, x, y);
    if (d > cam.range) return false;
    const ang = angleTo(cam.x, cam.y, x, y);
    if (Math.abs(angleDiff(ang, this.cameraAngle(cam, t))) > 0.44) return false;
    return this.losClear(cam.x, cam.y, x, y);
  }

  // Is the player visible to anyone right now? Returns 'guard' | 'camera' | null.
  spottedBy() {
    const p = this.player;
    for (const g of this.guards) {
      if (this.inGuardCone(g, p.x, p.y, this.guardRange(g))) return 'guard';
    }
    for (const c of this.cameras) {
      if (this.inCameraArc(c, p.x, p.y, this.time)) return 'camera';
    }
    return null;
  }

  collideCircle(e) {
    // Keep inside the playfield.
    e.x = clamp(e.x, PLAY.x + e.r, PLAY.x + PLAY.w - e.r);
    e.y = clamp(e.y, PLAY.y + e.r, PLAY.y + PLAY.h - e.r);
    for (const w of this.level.walls) {
      const cx = clamp(e.x, w.x, w.x + w.w);
      const cy = clamp(e.y, w.y, w.y + w.h);
      const dx = e.x - cx;
      const dy = e.y - cy;
      const d2 = dx * dx + dy * dy;
      if (d2 < e.r * e.r) {
        if (d2 > 0.0001) {
          const d = Math.sqrt(d2);
          e.x = cx + (dx / d) * e.r;
          e.y = cy + (dy / d) * e.r;
        } else {
          e.y = w.y - e.r;
        }
      }
    }
  }

  // ---- flow ----
  startNight() {
    this.state = 'loadout';
    this.jobIndex = 0;
    this.lives = 3;
    this.totalLoot = 0;
    this.alarm = 0;
    this.peakAlarm = 0;
    this.heat = 0;
    this.ghost = true;
    this.jobResults = [];
    this.nightTime = 0;
    this.loadLevel(0);
  }

  beginJob() {
    this.loadLevel(this.jobIndex);
    this.state = 'play';
    this.say(`${this.level.numeral} — ${this.level.name}: ${this.level.briefing}`, 5);
  }

  chooseLoadout(kind) {
    this.loadout = kind;
    this.beginJob();
  }

  say(text, secs) {
    this.message = text;
    this.messageUntil = this.time + (secs || 4);
  }

  addHeat(n, why) {
    const before = this.heat;
    this.heat = clamp(this.heat + n, 0, 5);
    if (this.heat >= 3 && !this.reinforcementSpawned) {
      this.reinforcementSpawned = true;
      const lv = this.level;
      this.guards.push({
        id: 99, path: [[640, 700], [640, 240]], wp: 0,
        x: 640, y: 700, speed: 78, pause: 0.5, pauseT: 0,
        facing: -Math.PI / 2, suspicion: 0, mode: 'patrol',
        investigate: null, loseT: 0, baseSpeed: 78, reinforcement: true,
      });
      this.say(`HEAT ${this.heat}: the museum calls in a reinforcement guard.`, 5);
    } else if (this.heat > before) {
      this.say(`HEAT ${this.heat} — ${why || 'the museum is on edge.'} Guards move faster.`, 4);
    }
  }

  bust(cause) {
    this.lives -= 1;
    this.flash = 0.5;
    this.sounds.busted();
    this.addHeat(1, 'you were caught');
    if (this.lives <= 0) {
      this.state = 'gameover';
      this.apStatus = 'gameover';
      return;
    }
    this.state = 'busted';
    this.bustedAt = this.time;
    this.say(`BUSTED — ${cause}. ${this.lives} ${this.lives === 1 ? 'life' : 'lives'} left. Wren slips back to the entrance…`, 3);
  }

  respawn() {
    const lv = this.level;
    this.player.x = lv.entrance.x;
    this.player.y = lv.entrance.y;
    this.player.dashT = 0;
    this.player.dashCd = 0;
    this.clickTarget = null;
    for (const g of this.guards) {
      g.x = g.path[0][0];
      g.y = g.path[0][1];
      g.wp = 0;
      g.mode = 'patrol';
      g.suspicion = 0;
      g.investigate = null;
    }
    this.alarm = Math.max(this.alarm, 25);
    this.state = 'play';
  }

  jobComplete() {
    const lv = this.level;
    this.jobResults.push({
      numeral: lv.numeral, name: lv.name, loot: this.jobLoot, target: lv.target,
    });
    this.totalLoot += this.jobLoot;
    this.sounds.jobDone();
    if (this.jobIndex >= this.levels.length - 1) {
      this.finishNight();
      return;
    }
    this.state = 'jobdone';
    this.jobDoneAt = this.time;
  }

  finishNight() {
    let bonus = 0;
    if (this.ghost && this.peakAlarm <= 50) {
      bonus = 2000;
      this.totalLoot += bonus;
    }
    this.nightBonus = bonus;
    this.state = 'nightdone';
    this.apStatus = 'nightdone';
    this.sounds.nightDone(this.ghost && this.peakAlarm <= 50);
  }

  // ---- input ----
  setKey(code, down) {
    this.keys[code] = down;
    if (down) this.sounds.ensure();
  }

  // ---- per-frame update ----
  update(dt) {
    this.time += dt;
    if (this.flash > 0) this.flash -= dt;
    if (this.state === 'busted' && this.time - this.bustedAt > 2.2) this.respawn();
    if (this.state !== 'play') return;
    this.nightTime += dt;

    const p = this.player;
    const k = this.keys;
    const up = k['KeyW'] || k['ArrowUp'];
    const down = k['KeyS'] || k['ArrowDown'];
    const left = k['KeyA'] || k['ArrowLeft'];
    const right = k['KeyD'] || k['ArrowRight'];
    p.sneak = !!(k['ShiftLeft'] || k['ShiftRight']);

    let mx = (right ? 1 : 0) - (left ? 1 : 0);
    let my = (down ? 1 : 0) - (up ? 1 : 0);
    if (mx === 0 && my === 0 && this.clickTarget) {
      const d = dist(p.x, p.y, this.clickTarget.x, this.clickTarget.y);
      if (d > 8) {
        mx = (this.clickTarget.x - p.x) / d;
        my = (this.clickTarget.y - p.y) / d;
      } else {
        this.clickTarget = null;
      }
    }
    const mag = Math.hypot(mx, my);
    if (mag > 0) {
      mx /= mag;
      my /= mag;
    }

    // Dash: fast, loud. Nearby guards come to look.
    if ((k['Space'] || this.apDash) && p.dashCd <= 0 && mag > 0) {
      p.dashT = 0.18;
      p.dashCd = 1.2;
      p.dashDir = { x: mx, y: my };
      this.sounds.dash();
      for (const g of this.guards) {
        if (dist(g.x, g.y, p.x, p.y) < 260 && g.mode === 'patrol') {
          g.mode = 'investigate';
          g.investigate = { x: p.x, y: p.y };
        }
      }
    }
    p.dashCd = Math.max(0, p.dashCd - dt);

    const baseSpeed = p.sneak ? 96 : 172;
    let speed = baseSpeed;
    if (p.dashT > 0) {
      p.dashT -= dt;
      speed = 430;
      mx = p.dashDir.x;
      my = p.dashDir.y;
    }
    p.moving = mag > 0;
    if (p.moving) {
      p.facing = Math.atan2(my, mx);
      p.x += mx * speed * dt;
      p.y += my * speed * dt;
      this.collideCircle(p);
      p.stepT -= dt * (p.sneak ? 0.5 : 1);
      if (p.stepT <= 0) {
        p.stepT = 0.42;
        if (!p.sneak) this.sounds.step(false);
      }
    }

    this.updateInteractions(dt);
    this.updateGuards(dt);
    this.updateDetection(dt);
    this.updateLasers(dt);
    this.updateAlarm(dt);
    this.checkJobDone();
  }

  nearestLoot() {
    let best = null;
    let bd = 1e9;
    for (const l of this.loot) {
      if (l.taken) continue;
      const d = dist(this.player.x, this.player.y, l.x, l.y);
      if (d < bd) { bd = d; best = l; }
    }
    return { loot: best, d: bd };
  }

  updateInteractions(dt) {
    const p = this.player;
    const eHeld = !!(this.keys['KeyE'] || this.apHoldE);
    const lv = this.level;
    let target = null;
    let need = 0;
    let label = '';

    const { loot, d } = this.nearestLoot();
    if (loot && d < 36) {
      target = { kind: 'loot', loot };
      need = this.loadout === 'lockpick' ? 0.4 : 0.8;
      label = `Lifting ${loot.label}…`;
    } else if (lv.vault && !this.vaultCracked && dist(p.x, p.y, lv.vault.x, lv.vault.y + 62) < 62) {
      target = { kind: 'vault' };
      need = this.loadout === 'lockpick' ? 2 : 4;
      label = 'Cracking the vault…';
    } else if (lv.diamond && !this.diamondTaken && dist(p.x, p.y, lv.diamond.x, lv.diamond.y) < 44) {
      target = { kind: 'diamond' };
      need = this.loadout === 'lockpick' ? 0.6 : 1.2;
      label = 'Lifting the Marlowe Diamond…';
    } else if (lv.terminal && dist(p.x, p.y, lv.terminal.x, lv.terminal.y) < 44) {
      const live = this.cameras.find((c) => this.time >= c.disabledUntil);
      if (live) {
        target = { kind: 'terminal', cam: live };
        need = 1;
        label = 'Disabling camera…';
      }
    }

    if (target && eHeld) {
      if (!this.holdTarget || this.holdTarget.kind !== target.kind) {
        this.holdTarget = target;
        this.holdProgress = 0;
      }
      this.holdProgress += dt;
      this.holdLabel = label;
      if (target.kind === 'vault' && Math.floor(this.holdProgress * 4) !== Math.floor((this.holdProgress - dt) * 4)) {
        this.sounds.vaultTick(this.holdProgress / need);
      }
      if (this.holdProgress >= need) this.finishHold(target);
    } else {
      // Breaking off a hold does not erase it at once: the work done so
      // far leaks away slowly, so a vault cracked in two careful visits
      // still counts. Only switching to a different job loses it outright.
      if (this.holdTarget && target && this.holdTarget.kind !== target.kind) {
        this.holdTarget = null;
        this.holdProgress = 0;
      } else if (this.holdTarget) {
        this.holdProgress = Math.max(0, this.holdProgress - 0.5 * dt);
        if (this.holdProgress <= 0) this.holdTarget = null;
      }
    }
  }

  finishHold(target) {
    this.holdTarget = null;
    this.holdProgress = 0;
    if (target.kind === 'loot') {
      target.loot.taken = true;
      this.jobLoot += target.loot.value;
      this.sounds.pickup();
      this.say(`Lifted ${target.loot.label} — $${target.loot.value.toLocaleString()}.`, 3);
    } else if (target.kind === 'vault') {
      this.vaultCracked = true;
      this.jobLoot += this.level.vault.value;
      this.sounds.vaultOpen();
      this.say(`Vault open — $${this.level.vault.value.toLocaleString()}. Get to the service door.`, 4);
    } else if (target.kind === 'diamond') {
      this.diamondTaken = true;
      this.jobLoot += this.level.diamond.value;
      this.sounds.pickup();
      this.say(`The Marlowe Diamond is yours — $${this.level.diamond.value.toLocaleString()}. Reach the helicopter!`, 4);
    } else if (target.kind === 'terminal') {
      target.cam.disabledUntil = this.time + 15;
      this.sounds.cameraOff();
      this.say('Camera disabled for 15 seconds.', 3);
    }
  }

  updateGuards(dt) {
    const p = this.player;
    const heatMul = 1 + this.heat * 0.07;
    const lockMul = this.lockdown ? 1.6 : 1;
    for (const g of this.guards) {
      const speed = g.baseSpeed * heatMul * lockMul;
      if (g.mode === 'chase') {
        const d = dist(g.x, g.y, p.x, p.y);
        const ang = angleTo(g.x, g.y, p.x, p.y);
        g.facing = ang;
        g.x += Math.cos(ang) * speed * 1.55 * dt;
        g.y += Math.sin(ang) * speed * 1.55 * dt;
        const probe = { x: g.x, y: g.y, r: 12 };
        this.collideCircle(probe);
        g.x = probe.x;
        g.y = probe.y;
        if (d < 24) {
          this.bust('a guard caught Wren');
          return;
        }
        const seen = this.inGuardCone(g, p.x, p.y, this.guardRange(g));
        g.loseT = seen ? 0 : g.loseT + dt;
        if (g.loseT > 2.5) {
          g.mode = 'patrol';
          g.suspicion = 0.3;
        }
      } else if (g.mode === 'investigate') {
        const t = g.investigate;
        if (!t) { g.mode = 'patrol'; continue; }
        const d = dist(g.x, g.y, t.x, t.y);
        if (d < 14) {
          g.pauseT += dt;
          g.facing += dt * 1.5;
          if (g.pauseT > 2) { g.mode = 'patrol'; g.pauseT = 0; }
        } else {
          const ang = angleTo(g.x, g.y, t.x, t.y);
          g.facing = ang;
          g.x += Math.cos(ang) * speed * 1.15 * dt;
          g.y += Math.sin(ang) * speed * 1.15 * dt;
          const probe = { x: g.x, y: g.y, r: 12 };
          this.collideCircle(probe);
          g.x = probe.x;
          g.y = probe.y;
        }
      } else {
        // Patrol: walk the loop, pausing at each waypoint to look around.
        if (g.pauseT > 0) {
          g.pauseT -= dt;
          g.facing += Math.sin(this.time * 1.4 + g.id) * dt * 0.9;
          continue;
        }
        const wp = g.path[g.wp];
        const d = dist(g.x, g.y, wp[0], wp[1]);
        if (d < 10) {
          g.wp = (g.wp + 1) % g.path.length;
          g.pauseT = g.pause;
          continue;
        }
        const ang = angleTo(g.x, g.y, wp[0], wp[1]);
        g.facing = ang;
        g.x += Math.cos(ang) * speed * dt;
        g.y += Math.sin(ang) * speed * dt;
        const probe = { x: g.x, y: g.y, r: 12 };
        this.collideCircle(probe);
        g.x = probe.x;
        g.y = probe.y;
      }
    }
  }

  updateDetection(dt) {
    const p = this.player;
    const inShadow = this.inShadow(p.x, p.y);
    for (const g of this.guards) {
      if (g.mode === 'chase') continue;
      const seen = this.inGuardCone(g, p.x, p.y, this.guardRange(g));
      if (seen) {
        let rate = p.sneak ? 0.45 : 0.9;
        if (inShadow) rate *= 0.35;
        const before = g.suspicion;
        g.suspicion = clamp(g.suspicion + rate * dt, 0, 1);
        if (g.suspicion >= 1 && before < 1) {
          g.mode = 'chase';
          g.loseT = 0;
          this.sounds.spotted();
          this.say('Spotted! Break line of sight!', 2.5);
        }
      } else {
        g.suspicion = clamp(g.suspicion - 0.35 * dt, 0, 1);
      }
    }
  }

  updateLasers(dt) {
    const p = this.player;
    this.level.lasers.forEach((lz, i) => {
      if (!this.laserOn(lz, this.time)) return;
      if (this.time - this.laserTrips[i] < 2) return;
      if (distToSegment(p.x, p.y, lz.x1, lz.y1, lz.x2, lz.y2) < p.r + 4) {
        this.laserTrips[i] = this.time;
        this.alarm = clamp(this.alarm + 25, 0, 100);
        this.flash = 0.4;
        this.flashColor = '255,40,40';
        this.sounds.spotted();
        this.say('Laser tripped! The alarm screams.', 3);
        // The nearest guard comes to look at the beam.
        let best = null;
        let bd = 1e9;
        for (const g of this.guards) {
          const d = dist(g.x, g.y, p.x, p.y);
          if (d < bd) { bd = d; best = g; }
        }
        if (best && best.mode === 'patrol') {
          best.mode = 'investigate';
          best.investigate = { x: p.x, y: p.y };
        }
      }
    });
  }

  updateAlarm(dt) {
    const seen = this.spottedBy();
    if (seen === 'camera') {
      this.alarm = clamp(this.alarm + 20 * dt, 0, 100);
    } else if (seen === 'guard') {
      this.alarm = clamp(this.alarm + 6 * dt, 0, 100);
    } else if (this.guards.some((g) => g.suspicion > 0.5)) {
      this.alarm = clamp(this.alarm + 3 * dt, 0, 100);
    } else {
      const decay = this.lockdown ? 4 : 2.5;
      this.alarm = clamp(this.alarm - decay * dt, 0, 100);
    }
    if (this.alarm > this.peakAlarm) this.peakAlarm = this.alarm;
    if (this.peakAlarm > 50) this.ghost = false;

    if (this.alarm >= 100 && !this.lockdown) {
      this.lockdown = true;
      this.say('LOCKDOWN! Every guard is sprinting. Lay low until it passes.', 5);
      this.sounds.alarmLoop(true);
    }
    if (this.lockdown && this.alarm < 60) {
      this.lockdown = false;
      this.say('Lockdown lifted — but the museum remembers.', 4);
    }
    if (!this.heatTrippedAt75 && this.alarm >= 75) {
      this.heatTrippedAt75 = true;
      this.addHeat(1, 'the alarm tripped');
    }
    if (this.alarm > 60 && this.time - this.alarmBeepAt > 1) {
      this.alarmBeepAt = this.time;
      this.sounds.alarmLoop(true);
    }
  }

  checkJobDone() {
    const lv = this.level;
    const p = this.player;
    if (lv.exit) {
      const e = lv.exit;
      const inExit = p.x > e.x && p.x < e.x + e.w && p.y > e.y && p.y < e.y + e.h;
      if (inExit) {
        if (this.jobIndex === 0) {
          if (this.loot.every((l) => l.taken)) this.jobComplete();
        } else if (this.jobIndex === 1) {
          if (this.vaultCracked) this.jobComplete();
        }
      }
    }
    if (lv.heli && this.diamondTaken) {
      if (dist(p.x, p.y, lv.heli.x, lv.heli.y) < lv.heli.r) this.jobComplete();
    }
  }

  // ---- autopilot: plays the real rules forward ----
  // The autopilot is a cautious thief: it sneaks everywhere, waits in the
  // open only when no cone, camera arc or live laser covers the next step,
  // and retreats to the entrance when a guard's suspicion climbs.
  // It navigates with a coarse grid A* over the level (walls are the only
  // obstacle), so it walks around furniture instead of pushing into it.
  apBuildGrid() {
    const cell = 32;
    const cols = Math.ceil(PLAY.w / cell);
    const rows = Math.ceil(PLAY.h / cell);
    const blocked = new Uint8Array(cols * rows);
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const x0 = PLAY.x + c * cell - 14;
        const y0 = PLAY.y + r * cell - 14;
        const x1 = x0 + cell + 28;
        const y1 = y0 + cell + 28;
        for (const w of this.level.walls) {
          if (x0 < w.x + w.w && x1 > w.x && y0 < w.y + w.h && y1 > w.y) {
            blocked[r * cols + c] = 1;
            break;
          }
        }
      }
    }
    this.apGrid = { cell, cols, rows, blocked };
  }

  apFindPath(sx, sy, tx, ty) {
    const g = this.apGrid;
    if (!g) return null;
    const inB = (c, r) => c >= 0 && c < g.cols && r >= 0 && r < g.rows;
    const key = (c, r) => r * g.cols + c;
    // A loot point can sit in a cell the wall margin marks blocked (it is
    // beside the wall, not inside it), and the thief can stand in one too.
    // In that case path to/from the nearest open cell instead.
    const nearestOpen = (c, r) => {
      if (inB(c, r) && !g.blocked[key(c, r)]) return [c, r];
      for (let rad = 1; rad <= 3; rad++) {
        for (let dr = -rad; dr <= rad; dr++) {
          for (let dc = -rad; dc <= rad; dc++) {
            if (Math.max(Math.abs(dc), Math.abs(dr)) !== rad) continue;
            if (inB(c + dc, r + dr) && !g.blocked[key(c + dc, r + dr)]) return [c + dc, r + dr];
          }
        }
      }
      return [c, r];
    };
    const [sc, sr] = nearestOpen(Math.floor((sx - PLAY.x) / g.cell), Math.floor((sy - PLAY.y) / g.cell));
    const [tc, tr] = nearestOpen(Math.floor((tx - PLAY.x) / g.cell), Math.floor((ty - PLAY.y) / g.cell));
    if (!inB(sc, sr) || !inB(tc, tr)) return null;
    const open = [{ c: sc, r: sr, f: 0, g: 0 }];
    const came = new Map();
    const cost = new Map([[key(sc, sr), 0]]);
    const closed = new Set();
    const h = (c, r) => Math.hypot(c - tc, r - tr);
    while (open.length) {
      let bi = 0;
      for (let i = 1; i < open.length; i++) if (open[i].f < open[bi].f) bi = i;
      const cur = open.splice(bi, 1)[0];
      const ck = key(cur.c, cur.r);
      if (closed.has(ck)) continue;
      closed.add(ck);
      if (cur.c === tc && cur.r === tr) {
        const cells = [];
        let k = ck;
        let cc = cur.c;
        let rr = cur.r;
        while (k !== key(sc, sr)) {
          cells.push([cc, rr]);
          const prev = came.get(k);
          if (!prev) break;
          [cc, rr] = prev;
          k = key(cc, rr);
        }
        cells.reverse();
        return cells.map(([c, r]) => ({
          x: PLAY.x + (c + 0.5) * g.cell,
          y: PLAY.y + (r + 0.5) * g.cell,
        }));
      }
      for (let dr = -1; dr <= 1; dr++) {
        for (let dc = -1; dc <= 1; dc++) {
          if (!dc && !dr) continue;
          const nc = cur.c + dc;
          const nr = cur.r + dr;
          if (!inB(nc, nr) || g.blocked[key(nc, nr)]) continue;
          // No cutting corners through a blocked diagonal neighbour.
          if (dc && dr && (g.blocked[key(cur.c + dc, cur.r)] || g.blocked[key(cur.c, cur.r + dr)])) continue;
          const nk = key(nc, nr);
          const ng = cost.get(ck) + (dc && dr ? 1.414 : 1);
          if (ng < (cost.get(nk) ?? Infinity)) {
            cost.set(nk, ng);
            came.set(nk, [cur.c, cur.r]);
            open.push({ c: nc, r: nr, f: ng + h(nc, nr), g: ng });
          }
        }
      }
    }
    return null;
  }
  apObjective() {
    const lv = this.level;
    const { loot } = this.nearestLoot();
    if (loot) return { x: loot.x, y: loot.y, kind: 'loot' };
    if (lv.vault && !this.vaultCracked) return { x: lv.vault.x, y: lv.vault.y + 62, kind: 'vault' };
    if (lv.diamond && !this.diamondTaken) return { x: lv.diamond.x, y: lv.diamond.y, kind: 'diamond' };
    if (lv.exit) return { x: lv.exit.x + lv.exit.w / 2, y: lv.exit.y + lv.exit.h / 2, kind: 'exit' };
    if (lv.heli) return { x: lv.heli.x, y: lv.heli.y, kind: 'heli' };
    return null;
  }

  apVisionSafe(x, y) {
    for (const g of this.guards) {
      const range = g.mode === 'chase' ? 9999 : 260;
      if (this.inGuardCone(g, x, y, range)) return false;
    }
    for (const c of this.cameras) {
      if (this.inCameraArc(c, x, y, this.time)) return false;
    }
    return true;
  }

  apLaserSafe(x, y) {
    for (const lz of this.level.lasers) {
      const d = distToSegment(x, y, lz.x1, lz.y1, lz.x2, lz.y2);
      if (this.laserOn(lz, this.time)) {
        if (d < 30) return false;
      } else if (d < 44) {
        // The beam is dark — but for how long? A crossing takes about
        // a second, so do not step into the beam's reach unless the
        // dark beat outlasts the crossing with room to spare.
        const ph = ((this.time + lz.phase) % lz.period) / lz.period;
        const untilOn = (1 - ph) * lz.period;
        if (untilOn < 1.1) return false;
      }
    }
    return true;
  }

  apPointSafe(x, y) {
    return this.apVisionSafe(x, y) && this.apLaserSafe(x, y);
  }

  apStep(dt) {
    const p = this.player;
    this.keys['ShiftLeft'] = true; // the autopilot always sneaks
    this.apHoldE = false;
    this.apDash = false;

    let obj = this.apObjective();
    if (!obj) return;

    // If a guard is close to spotting us, back off toward the entrance
    // (walked via the same A* path as any other objective) — unless we
    // are mid-crossing a laser beam, in which case finish the crossing
    // first: turning back on the line is how a thief trips it.
    const nearBeamNow = this.level.lasers.some(
      (lz) => distToSegment(p.x, p.y, lz.x1, lz.y1, lz.x2, lz.y2) < 44,
    );
    const danger = this.guards.some((g) => g.suspicion > 0.55 || g.mode === 'chase');
    if (danger && !nearBeamNow) {
      obj = { x: this.level.entrance.x, y: this.level.entrance.y, kind: 'retreat' };
    }

    // At an interaction point: hold E and stand still.
    const atLoot = obj.kind === 'loot' && dist(p.x, p.y, obj.x, obj.y) < 30;
    const atVault = obj.kind === 'vault' && dist(p.x, p.y, obj.x, obj.y) < 46;
    const atDiamond = obj.kind === 'diamond' && dist(p.x, p.y, obj.x, obj.y) < 36;
    if (atLoot || atVault || atDiamond) {
      // Only hold still if the spot itself is safe right now.
      if (this.apPointSafe(p.x, p.y)) {
        this.apHoldE = true;
        return;
      }
      // Unsafe while holding: step back to the entrance shadow and wait.
      this.apMoveToward(this.level.entrance.x, this.level.entrance.y);
      return;
    }

    // Walk toward the objective along the A* path, one short step at a
    // time, waiting whenever the next step would be seen. Lasers: only
    // step across while dark.
    //
    // Waiting is committed: when a step is unsafe the thief retreats to
    // the nearest shadow and stays there for a couple of seconds. Without
    // the commitment the thief paces on a cone's edge forever, stepping
    // back in the moment the edge moves.
    const objKey = `${obj.kind}:${Math.round(obj.x)},${Math.round(obj.y)}`;
    if (objKey !== this.apPathObj || this.time > this.apRepathAt || !this.apPath) {
      this.apPathObj = objKey;
      this.apRepathAt = this.time + 3;
      this.apPath = this.apFindPath(p.x, p.y, obj.x, obj.y) || [{ x: obj.x, y: obj.y }];
    }
    // Drop waypoints already reached.
    while (this.apPath.length && dist(p.x, p.y, this.apPath[0].x, this.apPath[0].y) < 16) {
      this.apPath.shift();
    }
    const next = this.apPath[0] || obj;
    const d = dist(p.x, p.y, next.x, next.y);
    const stepLen = 26;
    const nx = p.x + ((next.x - p.x) / d) * Math.min(stepLen, d);
    const ny = p.y + ((next.y - p.y) / d) * Math.min(stepLen, d);

    // A lit beam right underfoot takes priority over everything else:
    // step back off the line, perpendicular to the beam, before a guard
    // cone or a camera gets another thought. Waiting on the line is how
    // a thief trips it when the beat turns.
    for (const lz of this.level.lasers) {
      if (!this.laserOn(lz, this.time)) continue;
      if (distToSegment(p.x, p.y, lz.x1, lz.y1, lz.x2, lz.y2) < 22) {
        const dx = lz.x2 - lz.x1;
        const dy = lz.y2 - lz.y1;
        const len2 = dx * dx + dy * dy;
        const tt = len2 === 0 ? 0 : Math.max(0, Math.min(1, ((p.x - lz.x1) * dx + (p.y - lz.y1) * dy) / len2));
        const cx = lz.x1 + dx * tt;
        const cy = lz.y1 + dy * tt;
        const ax = p.x - cx;
        const ay = p.y - cy;
        const alen = Math.hypot(ax, ay) || 1;
        this.apMoveToward(p.x + (ax / alen) * 44, p.y + (ay / alen) * 44);
        return;
      }
    }

    // A crossing is decisive: once the thief is inside a beam's reach,
    // stopping for a guard cone or a lit beat would leave them standing
    // on the line when it turns — so inside the reach, keep walking.
    const nearBeam = this.level.lasers.some(
      (lz) => distToSegment(p.x, p.y, lz.x1, lz.y1, lz.x2, lz.y2) < 44,
    );
    if (nearBeam) {
      this.apMoveToward(next.x, next.y);
      return;
    }

    // Eyes and lasers are different problems. A guard cone or a camera
    // arc means retreat to a shadow and wait for the patrol to move on.
    // A laser only means wait in place for the dark beat — and dash
    // across it while it is dark, so the crossing is over in a blink.
    const visionBlocked = !this.apVisionSafe(nx, ny) || !this.apVisionSafe(p.x, p.y);
    if (visionBlocked && this.time > (this.apHideUntil || 0)) {
      // Hide in the nearest shadow that is itself out of every cone and
      // arc right now — a shadow between the laser beams is no hiding
      // place at all while a patrol is sweeping past it.
      let best = null;
      let bd = 1e9;
      for (const s of this.level.shadows) {
        if (!this.apVisionSafe(s.x, s.y)) continue;
        const dd = dist(p.x, p.y, s.x, s.y);
        if (dd < bd) { bd = dd; best = s; }
      }
      if (!best) {
        for (const s of this.level.shadows) {
          const dd = dist(p.x, p.y, s.x, s.y);
          if (dd < bd) { bd = dd; best = s; }
        }
      }
      this.apHideSpot = best;
      this.apHideUntil = this.time + 2.5;
    }
    if (this.apHideSpot && this.time < this.apHideUntil) {
      this.apMoveToward(this.apHideSpot.x, this.apHideSpot.y);
      return;
    }
    this.apHideSpot = null;
    if (visionBlocked) return; // wait where we are — patrols move on.
    if (!this.apLaserSafe(nx, ny)) return; // wait for the dark beat.
    // Sneak across a dark beam: the dark beat lasts about a second and a
    // half, and a dash would be loud enough to call a guard over.
    this.apMoveToward(next.x, next.y);
  }

  apMoveToward(x, y) {
    const p = this.player;
    const d = dist(p.x, p.y, x, y);
    if (d < 6) return;
    const ang = angleTo(p.x, p.y, x, y);
    // Feed the movement keys the same way a human would.
    this.keys['KeyW'] = Math.sin(ang) < -0.2;
    this.keys['KeyS'] = Math.sin(ang) > 0.2;
    this.keys['KeyA'] = Math.cos(ang) < -0.2;
    this.keys['KeyD'] = Math.cos(ang) > 0.2;
  }

  apClearKeys() {
    for (const k of ['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ShiftLeft', 'Space', 'KeyE']) {
      this.keys[k] = false;
    }
  }

  // Fast-forward the autopilot through the whole night, synchronously.
  // Used by ?shot=end so the end screenshot is a genuine frame of a
  // night the real rules played to completion.
  apFastForward(maxSeconds) {
    const dt = 1 / 60;
    const steps = Math.floor((maxSeconds || 480) / dt);
    for (let i = 0; i < steps; i++) {
      if (this.state === 'nightdone' || this.state === 'gameover') break;
      // The autopilot picks its tool per job: EMP for the vault hall,
      // where the camera over the vault is the problem, lockpick elsewhere.
      if (this.state === 'loadout') this.chooseLoadout(this.jobIndex === 1 ? 'emp' : 'lockpick');
      if (this.state === 'jobdone') { this.jobIndex += 1; this.beginJob(); continue; }
      if (this.state === 'play') {
        this.apClearKeys();
        this.apStep(dt);
        this.update(dt);
      } else if (this.state === 'busted') {
        // Let the busted timer run out through update().
        this.update(dt);
      } else {
        break;
      }
    }
    return this.state;
  }
}
