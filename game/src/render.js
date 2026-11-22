// Canvas art for The Velvet Vault — no images, everything is drawn.
// The museum at night is deep violet floor, brass trim, pools of shadow,
// yellow guard cones, cyan camera arcs and red laser light. The HUD is
// drawn on the canvas so a screenshot always shows the alarm meter, the
// heat level, the loot and the lives in the same frame as the play.
import { WORLD } from './engine.js';
import { clamp } from './rng.js';

const TAU = Math.PI * 2;

export class Renderer {
  constructor(canvas) {
    this.cv = canvas;
    this.ctx = canvas.getContext('2d');
  }

  draw(game) {
    const c = this.ctx;
    const t = game.time;
    c.clearRect(0, 0, WORLD.w, WORLD.h);
    this.drawFloor(c, game, t);
    this.drawShadows(c, game);
    this.drawExitAndHeli(c, game, t);
    this.drawLoot(c, game, t);
    this.drawVaultAndDiamond(c, game, t);
    this.drawLasers(c, game, t);
    this.drawCameras(c, game, t);
    this.drawGuards(c, game, t);
    this.drawPlayer(c, game, t);
    this.drawTerminal(c, game, t);
    this.drawHud(c, game, t);
    this.drawMessage(c, game, t);
    if (game.state === 'title') this.drawTitle(c, game, t);
    if (game.state === 'loadout') this.drawLoadout(c, game, t);
    if (game.state === 'paused') this.drawPaused(c, game);
    if (game.state === 'busted') this.drawBusted(c, game);
    if (game.state === 'jobdone') this.drawJobDone(c, game);
    if (game.state === 'nightdone') this.drawNightDone(c, game);
    if (game.state === 'gameover') this.drawGameOver(c, game);
    if (game.flash > 0) {
      c.fillStyle = `rgba(${game.flashColor},${(game.flash * 0.55).toFixed(3)})`;
      c.fillRect(0, 0, WORLD.w, WORLD.h);
    }
  }

  drawFloor(c, game, t) {
    const lv = game.level;
    // Night floor: dark violet with a subtle checker and brass skirting.
    c.fillStyle = game.lockdown ? '#1c0d14' : '#171226';
    c.fillRect(0, WORLD.hud, WORLD.w, WORLD.h - WORLD.hud);
    c.fillStyle = 'rgba(255,255,255,0.022)';
    const tile = 64;
    for (let y = WORLD.hud; y < WORLD.h; y += tile) {
      for (let x = 0; x < WORLD.w; x += tile) {
        if (((x / tile) + (y / tile)) % 2 === 0) c.fillRect(x, y, tile, tile);
      }
    }
    // Walls: raised stone with a brass edge.
    for (const w of lv.walls) {
      c.fillStyle = '#2c2340';
      c.fillRect(w.x, w.y, w.w, w.h);
      c.fillStyle = '#8a6d3b';
      c.fillRect(w.x, w.y, w.w, 3);
      c.fillStyle = 'rgba(0,0,0,0.35)';
      c.fillRect(w.x, w.y + w.h - 4, w.w, 4);
    }
    // Border walls.
    c.fillStyle = '#2c2340';
    c.fillRect(0, WORLD.hud, WORLD.w, 8);
    c.fillRect(0, WORLD.h - 8, WORLD.w, 8);
    c.fillRect(0, WORLD.hud, 8, WORLD.h - WORLD.hud);
    c.fillRect(WORLD.w - 8, WORLD.hud, 8, WORLD.h - WORLD.hud);
  }

  drawShadows(c, game) {
    for (const s of game.level.shadows) {
      const g = c.createRadialGradient(s.x, s.y, 6, s.x, s.y, s.r);
      g.addColorStop(0, 'rgba(2,2,8,0.72)');
      g.addColorStop(1, 'rgba(2,2,8,0)');
      c.fillStyle = g;
      c.beginPath();
      c.arc(s.x, s.y, s.r, 0, TAU);
      c.fill();
      c.strokeStyle = 'rgba(120,140,255,0.25)';
      c.setLineDash([4, 6]);
      c.beginPath();
      c.arc(s.x, s.y, s.r, 0, TAU);
      c.stroke();
      c.setLineDash([]);
      c.fillStyle = 'rgba(150,170,255,0.55)';
      c.font = '11px monospace';
      c.textAlign = 'center';
      c.fillText('SHADOW', s.x, s.y + s.r - 8);
    }
  }

  drawExitAndHeli(c, game, t) {
    const lv = game.level;
    if (lv.exit) {
      const e = lv.exit;
      const pulse = 0.5 + 0.5 * Math.sin(t * 3);
      c.fillStyle = '#0e3d1e';
      c.fillRect(e.x, e.y, e.w, e.h);
      c.strokeStyle = `rgba(80,255,140,${0.5 + pulse * 0.5})`;
      c.lineWidth = 2;
      c.strokeRect(e.x + 2, e.y + 2, e.w - 4, e.h - 4);
      c.fillStyle = '#7dffab';
      c.font = 'bold 12px monospace';
      c.textAlign = 'center';
      c.fillText(e.label, e.x + e.w / 2, e.y + e.h / 2 + 4);
      c.lineWidth = 1;
    }
    if (lv.heli) {
      const h = lv.heli;
      const pulse = 0.5 + 0.5 * Math.sin(t * 4);
      c.fillStyle = '#12303f';
      c.beginPath();
      c.arc(h.x, h.y, h.r, 0, TAU);
      c.fill();
      c.strokeStyle = `rgba(90,220,255,${0.5 + pulse * 0.5})`;
      c.lineWidth = 3;
      c.beginPath();
      c.arc(h.x, h.y, h.r - 4, 0, TAU);
      c.stroke();
      c.fillStyle = '#bfefff';
      c.font = 'bold 16px monospace';
      c.textAlign = 'center';
      c.fillText('H', h.x, h.y - 6);
      c.font = 'bold 11px monospace';
      c.fillText(h.label, h.x, h.y + 14);
      // Rotor blur.
      c.strokeStyle = 'rgba(190,240,255,0.35)';
      c.lineWidth = 2;
      const ra = t * 9;
      c.beginPath();
      c.moveTo(h.x - Math.cos(ra) * 34, h.y - Math.sin(ra) * 34);
      c.lineTo(h.x + Math.cos(ra) * 34, h.y + Math.sin(ra) * 34);
      c.stroke();
      c.lineWidth = 1;
    }
  }

  drawLoot(c, game, t) {
    for (const l of game.loot) {
      if (l.taken) continue;
      const bob = Math.sin(t * 2 + l.x) * 2;
      if (l.kind === 'painting') {
        c.fillStyle = '#3a2c12';
        c.fillRect(l.x - 22, l.y - 16 + bob, 44, 32);
        c.strokeStyle = '#d8b25a';
        c.lineWidth = 3;
        c.strokeRect(l.x - 22, l.y - 16 + bob, 44, 32);
        c.fillStyle = '#7a5a2e';
        c.fillRect(l.x - 15, l.y - 9 + bob, 30, 18);
        c.fillStyle = '#e8c96a';
        c.beginPath();
        c.arc(l.x, l.y + bob, 5, 0, TAU);
        c.fill();
        c.lineWidth = 1;
      } else {
        c.fillStyle = '#6a5320';
        c.fillRect(l.x - 14, l.y - 10 + bob, 28, 20);
        c.fillStyle = '#ffd94d';
        c.fillRect(l.x - 10, l.y - 6 + bob, 8, 6);
        c.fillRect(l.x + 2, l.y - 6 + bob, 8, 6);
        c.fillRect(l.x - 4, l.y + 2 + bob, 8, 6);
      }
      c.fillStyle = '#ffe9a8';
      c.font = '11px monospace';
      c.textAlign = 'center';
      c.fillText(`$${l.value.toLocaleString()}`, l.x, l.y + 32 + bob);
    }
  }

  drawVaultAndDiamond(c, game, t) {
    const lv = game.level;
    if (lv.vault) {
      const v = lv.vault;
      c.fillStyle = '#3d3d4d';
      c.fillRect(v.x - 70, v.y - 46, 140, 92);
      c.strokeStyle = '#c8b06a';
      c.lineWidth = 4;
      c.strokeRect(v.x - 70, v.y - 46, 140, 92);
      c.lineWidth = 1;
      if (game.vaultCracked) {
        c.fillStyle = '#0a0f0a';
        c.fillRect(v.x - 58, v.y - 34, 116, 68);
        c.fillStyle = '#ffd94d';
        c.font = 'bold 13px monospace';
        c.textAlign = 'center';
        c.fillText('OPEN', v.x, v.y + 4);
      } else {
        c.fillStyle = '#23232f';
        c.beginPath();
        c.arc(v.x, v.y, 26, 0, TAU);
        c.fill();
        c.strokeStyle = '#c8b06a';
        c.lineWidth = 2;
        c.beginPath();
        c.arc(v.x, v.y, 26, 0, TAU);
        c.stroke();
        c.beginPath();
        c.arc(v.x, v.y, 6, 0, TAU);
        c.fillStyle = '#c8b06a';
        c.fill();
        c.lineWidth = 1;
        c.fillStyle = '#ffe9a8';
        c.font = 'bold 12px monospace';
        c.textAlign = 'center';
        c.fillText(v.label, v.x, v.y - 56);
        c.fillStyle = '#9db3ff';
        c.font = '11px monospace';
        c.fillText('hold E to crack', v.x, v.y + 62);
      }
    }
    if (lv.diamond) {
      const d = lv.diamond;
      if (!game.diamondTaken) {
        const tw = 0.6 + 0.4 * Math.sin(t * 5);
        c.fillStyle = '#2c2340';
        c.fillRect(d.x - 26, d.y + 8, 52, 14);
        const g = c.createRadialGradient(d.x, d.y - 8, 2, d.x, d.y - 8, 30);
        g.addColorStop(0, `rgba(180,240,255,${0.75 * tw + 0.25})`);
        g.addColorStop(1, 'rgba(180,240,255,0)');
        c.fillStyle = g;
        c.beginPath();
        c.arc(d.x, d.y - 8, 30, 0, TAU);
        c.fill();
        c.fillStyle = '#aee9ff';
        c.beginPath();
        c.moveTo(d.x, d.y - 26);
        c.lineTo(d.x + 14, d.y - 8);
        c.lineTo(d.x, d.y + 6);
        c.lineTo(d.x - 14, d.y - 8);
        c.closePath();
        c.fill();
        c.fillStyle = '#e8fbff';
        c.beginPath();
        c.moveTo(d.x, d.y - 26);
        c.lineTo(d.x + 7, d.y - 8);
        c.lineTo(d.x, d.y - 2);
        c.lineTo(d.x - 7, d.y - 8);
        c.closePath();
        c.fill();
        c.fillStyle = '#bfefff';
        c.font = 'bold 12px monospace';
        c.textAlign = 'center';
        c.fillText(d.label, d.x, d.y - 38);
        c.fillStyle = '#9db3ff';
        c.font = '11px monospace';
        c.fillText('hold E to lift', d.x, d.y + 36);
      }
    }
  }

  drawLasers(c, game, t) {
    game.level.lasers.forEach((lz) => {
      const on = game.laserOn(lz, t);
      if (on) {
        c.strokeStyle = 'rgba(255,45,45,0.9)';
        c.lineWidth = 3;
        c.beginPath();
        c.moveTo(lz.x1, lz.y1);
        c.lineTo(lz.x2, lz.y2);
        c.stroke();
        c.strokeStyle = 'rgba(255,120,120,0.35)';
        c.lineWidth = 8;
        c.beginPath();
        c.moveTo(lz.x1, lz.y1);
        c.lineTo(lz.x2, lz.y2);
        c.stroke();
        c.lineWidth = 1;
      } else {
        c.strokeStyle = 'rgba(255,45,45,0.28)';
        c.setLineDash([6, 8]);
        c.lineWidth = 2;
        c.beginPath();
        c.moveTo(lz.x1, lz.y1);
        c.lineTo(lz.x2, lz.y2);
        c.stroke();
        c.setLineDash([]);
        c.lineWidth = 1;
      }
      // Emitters.
      c.fillStyle = on ? '#ff2d2d' : '#5a1f1f';
      c.beginPath();
      c.arc(lz.x1, lz.y1, 6, 0, TAU);
      c.arc(lz.x2, lz.y2, 6, 0, TAU);
      c.fill();
    });
  }

  drawCameras(c, game, t) {
    for (const cam of game.cameras) {
      const disabled = t < cam.disabledUntil;
      const ang = game.cameraAngle(cam, t);
      if (!disabled) {
        const g = c.createRadialGradient(cam.x, cam.y, 4, cam.x, cam.y, cam.range);
        g.addColorStop(0, 'rgba(60,220,255,0.30)');
        g.addColorStop(1, 'rgba(60,220,255,0)');
        c.fillStyle = g;
        c.beginPath();
        c.moveTo(cam.x, cam.y);
        c.arc(cam.x, cam.y, cam.range, ang - 0.44, ang + 0.44);
        c.closePath();
        c.fill();
      }
      c.fillStyle = disabled ? '#223' : '#0e2a33';
      c.strokeStyle = disabled ? '#445' : '#3cd8ff';
      c.lineWidth = 2;
      c.beginPath();
      c.arc(cam.x, cam.y, 11, 0, TAU);
      c.fill();
      c.stroke();
      c.lineWidth = 1;
      c.fillStyle = disabled ? '#889' : '#3cd8ff';
      c.beginPath();
      c.arc(cam.x + Math.cos(ang) * 15, cam.y + Math.sin(ang) * 15, 4, 0, TAU);
      c.fill();
      if (disabled) {
        c.fillStyle = '#8fa3b8';
        c.font = '10px monospace';
        c.textAlign = 'center';
        c.fillText('OFF', cam.x, cam.y - 18);
      }
    }
  }

  drawGuards(c, game, t) {
    for (const g of game.guards) {
      // Vision cone: yellow, brightens as suspicion climbs.
      const range = 260;
      const alpha = g.mode === 'chase' ? 0.4 : 0.16 + g.suspicion * 0.22;
      const grad = c.createRadialGradient(g.x, g.y, 6, g.x, g.y, range);
      grad.addColorStop(0, `rgba(255,214,64,${alpha})`);
      grad.addColorStop(1, 'rgba(255,214,64,0)');
      c.fillStyle = grad;
      c.beginPath();
      c.moveTo(g.x, g.y);
      c.arc(g.x, g.y, range, g.facing - 0.56, g.facing + 0.56);
      c.closePath();
      c.fill();

      // Body: a night guard in a dark uniform with a cap.
      c.fillStyle = g.mode === 'chase' ? '#7a1d1d' : '#1d2a4a';
      c.beginPath();
      c.arc(g.x, g.y, 12, 0, TAU);
      c.fill();
      c.strokeStyle = g.mode === 'chase' ? '#ff5a5a' : '#5a7bd8';
      c.lineWidth = 2;
      c.beginPath();
      c.arc(g.x, g.y, 12, 0, TAU);
      c.stroke();
      c.lineWidth = 1;
      // Facing tick.
      c.strokeStyle = '#dfe6ff';
      c.beginPath();
      c.moveTo(g.x, g.y);
      c.lineTo(g.x + Math.cos(g.facing) * 16, g.y + Math.sin(g.facing) * 16);
      c.stroke();
      // Suspicion arc over the head.
      if (g.suspicion > 0.05 && g.mode !== 'chase') {
        c.strokeStyle = g.suspicion > 0.6 ? '#ff5a3c' : '#ffd640';
        c.lineWidth = 3;
        c.beginPath();
        c.arc(g.x, g.y - 20, 8, -Math.PI / 2, -Math.PI / 2 + g.suspicion * TAU);
        c.stroke();
        c.lineWidth = 1;
      }
      if (g.mode === 'chase') {
        c.fillStyle = '#ff5a3c';
        c.font = 'bold 12px monospace';
        c.textAlign = 'center';
        c.fillText('!', g.x, g.y - 20);
      }
      if (g.reinforcement) {
        c.fillStyle = '#ffb03c';
        c.font = '10px monospace';
        c.textAlign = 'center';
        c.fillText('REINFORCEMENT', g.x, g.y + 26);
      }
    }
  }

  drawPlayer(c, game, t) {
    const p = game.player;
    const inShadow = game.inShadow(p.x, p.y);
    // Sneak silhouette: low, dark, with a velvet-red scarf.
    c.fillStyle = 'rgba(0,0,0,0.35)';
    c.beginPath();
    c.ellipse(p.x, p.y + 10, 12, 5, 0, 0, TAU);
    c.fill();
    c.fillStyle = '#3a0d2e';
    c.beginPath();
    c.arc(p.x, p.y, p.r, 0, TAU);
    c.fill();
    c.strokeStyle = inShadow ? '#8a7bff' : '#e8b4d8';
    c.lineWidth = 2;
    c.beginPath();
    c.arc(p.x, p.y, p.r, 0, TAU);
    c.stroke();
    c.lineWidth = 1;
    // Scarf points the way Wren faces.
    c.strokeStyle = '#c2185b';
    c.lineWidth = 3;
    c.beginPath();
    c.moveTo(p.x, p.y);
    c.lineTo(p.x + Math.cos(p.facing) * 18, p.y + Math.sin(p.facing) * 18);
    c.stroke();
    c.lineWidth = 1;
    // Dash cooldown pip.
    if (p.dashCd > 0) {
      c.fillStyle = 'rgba(255,255,255,0.35)';
      c.fillRect(p.x - 10, p.y + 18, 20 * (1 - p.dashCd / 1.2), 3);
    }
    // Hold-E progress ring.
    if (game.holdTarget && game.holdProgress > 0) {
      const need = game.holdTarget.kind === 'vault'
        ? (game.loadout === 'lockpick' ? 2 : 4)
        : game.holdTarget.kind === 'loot'
          ? (game.loadout === 'lockpick' ? 0.4 : 0.8)
          : 1;
      const frac = clamp(game.holdProgress / need, 0, 1);
      c.strokeStyle = '#ffd94d';
      c.lineWidth = 4;
      c.beginPath();
      c.arc(p.x, p.y, 22, -Math.PI / 2, -Math.PI / 2 + frac * TAU);
      c.stroke();
      c.lineWidth = 1;
      c.fillStyle = '#ffe9a8';
      c.font = '11px monospace';
      c.textAlign = 'center';
      c.fillText(game.holdLabel || '…', p.x, p.y - 30);
    }
    if (p.sneak && game.state === 'play') {
      c.fillStyle = 'rgba(160,170,255,0.8)';
      c.font = '10px monospace';
      c.textAlign = 'center';
      c.fillText('SNEAKING', p.x, p.y + 30);
    }
  }

  drawTerminal(c, game, t) {
    const lv = game.level;
    if (!lv.terminal) return;
    const tr = lv.terminal;
    const live = game.cameras.some((cam) => t >= cam.disabledUntil);
    c.fillStyle = '#0e2a33';
    c.fillRect(tr.x - 16, tr.y - 12, 32, 24);
    c.strokeStyle = live ? '#3cd8ff' : '#445';
    c.lineWidth = 2;
    c.strokeRect(tr.x - 16, tr.y - 12, 32, 24);
    c.lineWidth = 1;
    c.fillStyle = live ? '#3cd8ff' : '#889';
    c.font = '10px monospace';
    c.textAlign = 'center';
    c.fillText('CAM', tr.x, tr.y + 4);
    c.fillStyle = '#9db3ff';
    c.font = '10px monospace';
    c.fillText(lv.terminal.label, tr.x, tr.y + 34);
  }

  drawHud(c, game, t) {
    const lv = game.level;
    c.fillStyle = game.lockdown ? '#3d0d12' : '#0d0a18';
    c.fillRect(0, 0, WORLD.w, WORLD.hud);
    c.fillStyle = '#8a6d3b';
    c.fillRect(0, WORLD.hud - 2, WORLD.w, 2);

    c.textAlign = 'left';
    c.fillStyle = '#e8d9a8';
    c.font = 'bold 20px monospace';
    c.fillText('THE VELVET VAULT', 16, 28);
    c.fillStyle = '#9db3ff';
    c.font = '13px monospace';
    c.fillText(`Job ${lv.numeral} — ${lv.name}   ·   2:14 AM, Marlowe Museum`, 16, 50);

    // Loot. During a job the total is the night so far plus this job's
    // take; once the night is over the job's take is already in the
    // total, so showing both would count it twice.
    const nightOver = game.state === 'nightdone' || game.state === 'gameover' || game.state === 'jobdone';
    const shownTotal = nightOver ? game.totalLoot : game.totalLoot + game.jobLoot;
    c.fillStyle = '#ffd94d';
    c.font = 'bold 18px monospace';
    c.fillText(`$${shownTotal.toLocaleString()}`, 560, 28);
    c.fillStyle = '#9db3ff';
    c.font = '12px monospace';
    c.fillText(`job $${game.jobLoot.toLocaleString()} / $${lv.target.toLocaleString()}`, 560, 50);

    // Alarm meter.
    this.meter(c, 800, 14, 180, 16, game.alarm / 100, game.lockdown ? '#ff2d2d' : '#ff7a3c', 'ALARM');
    c.fillStyle = game.lockdown ? '#ff5a5a' : '#c8b8d8';
    c.font = 'bold 12px monospace';
    c.fillText(game.lockdown ? 'LOCKDOWN' : `ALARM ${Math.round(game.alarm)}%`, 800, 50);

    // Heat / wanted level.
    this.meter(c, 1010, 14, 120, 16, game.heat / 5, '#ff3c6e', 'HEAT');
    c.fillStyle = '#ffb3c8';
    c.font = 'bold 12px monospace';
    c.fillText(`WANTED ${'★'.repeat(game.heat)}${'☆'.repeat(5 - game.heat)}`, 1010, 50);

    // Lives.
    c.fillStyle = '#ff8fb0';
    c.font = 'bold 18px monospace';
    c.textAlign = 'right';
    c.fillText('♥'.repeat(game.lives) + '♡'.repeat(Math.max(0, 3 - game.lives)), 1264, 28);
    c.fillStyle = '#9db3ff';
    c.font = '12px monospace';
    c.fillText(`Wren · ${game.loadout === 'lockpick' ? 'Lockpick' : 'EMP'}`, 1264, 50);
    c.textAlign = 'left';
  }

  meter(c, x, y, w, h, frac, color, label) {
    c.fillStyle = 'rgba(255,255,255,0.12)';
    c.fillRect(x, y, w, h);
    c.fillStyle = color;
    c.fillRect(x, y, w * clamp(frac, 0, 1), h);
    c.strokeStyle = 'rgba(255,255,255,0.35)';
    c.strokeRect(x, y, w, h);
    c.fillStyle = 'rgba(255,255,255,0.75)';
    c.font = '9px monospace';
    c.textAlign = 'left';
    c.fillText(label, x + 3, y + h - 4);
  }

  drawMessage(c, game, t) {
    if (game.state !== 'play' || !game.message || t > game.messageUntil) return;
    c.fillStyle = 'rgba(10,8,20,0.82)';
    c.font = '14px monospace';
    const w = c.measureText(game.message).width + 28;
    c.fillRect((WORLD.w - w) / 2, WORLD.h - 52, w, 30);
    c.strokeStyle = '#8a6d3b';
    c.strokeRect((WORLD.w - w) / 2, WORLD.h - 52, w, 30);
    c.fillStyle = '#ffe9a8';
    c.textAlign = 'center';
    c.fillText(game.message, WORLD.w / 2, WORLD.h - 32);
    c.textAlign = 'left';
  }

  panel(c, title, lines, accent) {
    c.fillStyle = 'rgba(8,6,16,0.88)';
    c.fillRect(290, 170, 700, 460);
    c.strokeStyle = accent || '#c8a24a';
    c.lineWidth = 2;
    c.strokeRect(290, 170, 700, 460);
    c.lineWidth = 1;
    c.fillStyle = '#e8d9a8';
    c.font = 'bold 30px monospace';
    c.textAlign = 'center';
    c.fillText(title, 640, 230);
    c.fillStyle = '#c8b8d8';
    c.font = '15px monospace';
    let y = 280;
    for (const line of lines) {
      c.fillText(line, 640, y);
      y += 30;
    }
    c.textAlign = 'left';
  }

  drawTitle(c, game, t) {
    c.fillStyle = 'rgba(6,4,12,0.72)';
    c.fillRect(0, WORLD.hud, WORLD.w, WORLD.h - WORLD.hud);
    c.fillStyle = '#e8d9a8';
    c.font = 'bold 54px monospace';
    c.textAlign = 'center';
    c.fillText('THE VELVET VAULT', 640, 250);
    c.fillStyle = '#c2185b';
    c.font = 'bold 24px monospace';
    c.fillText('— MIDNIGHT HEIST —', 640, 292);
    c.fillStyle = '#c8b8d8';
    c.font = '16px monospace';
    c.fillText('Wren is casing the Marlowe Museum at 2:14 AM.', 640, 340);
    c.fillText('Three jobs, one night, $41,000 total.', 640, 368);
    c.fillText('Lift the art. Crack the vault. Steal the diamond. Vanish.', 640, 396);
    c.fillStyle = '#ffd94d';
    c.font = 'bold 18px monospace';
    const blink = 0.6 + 0.4 * Math.sin(t * 4);
    c.globalAlpha = blink;
    c.fillText('Press ENTER or click to begin', 640, 470);
    c.globalAlpha = 1;
    c.fillStyle = '#9db3ff';
    c.font = '14px monospace';
    c.fillText('WASD / arrows move · Shift sneak · Space dash · E hold to lift', 640, 520);
    c.fillText('Click the floor to walk · P pause · M mute', 640, 546);
    c.fillText('Yellow cones are guard eyes. Cyan arcs are cameras. Red lines are lasers.', 640, 580);
    c.fillText('Shadow pools hide you. Keep the alarm under 50% for the GHOST bonus.', 640, 606);
    c.textAlign = 'left';
  }

  drawLoadout(c, game, t) {
    const lv = game.level;
    this.panel(c, `JOB ${lv.numeral} — ${lv.name}`, [
      lv.briefing,
      '',
      'Choose your tool for this job:',
      '',
      '[1] LOCKPICK — crack the vault and lift loot twice as fast',
      '[2] EMP — burns out one camera for the whole job',
      '',
      'Click a tool or press 1 / 2.',
      `Target: $${lv.target.toLocaleString()}   ·   Heat: ${game.heat}   ·   Lives: ${game.lives}`,
    ], '#c2185b');
  }

  drawPaused(c, game) {
    c.fillStyle = 'rgba(6,4,12,0.7)';
    c.fillRect(0, WORLD.hud, WORLD.w, WORLD.h - WORLD.hud);
    this.panel(c, 'PAUSED', ['The museum holds its breath.', '', 'Press P or Esc to keep stealing.'], '#9db3ff');
  }

  drawBusted(c, game) {
    c.fillStyle = 'rgba(40,4,8,0.6)';
    c.fillRect(0, WORLD.hud, WORLD.w, WORLD.h - WORLD.hud);
    c.fillStyle = '#ff8fa0';
    c.font = 'bold 44px monospace';
    c.textAlign = 'center';
    c.fillText('BUSTED', 640, 380);
    c.fillStyle = '#e8d9a8';
    c.font = '16px monospace';
    c.fillText(game.message, 640, 430);
    c.textAlign = 'left';
  }

  drawJobDone(c, game) {
    const r = game.jobResults[game.jobResults.length - 1];
    this.panel(c, `JOB ${r.numeral} COMPLETE`, [
      `${r.name} — lifted $${r.loot.toLocaleString()} of $${r.target.toLocaleString()}.`,
      '',
      `Night total so far: $${game.totalLoot.toLocaleString()}`,
      `Alarm peaked at ${Math.round(game.peakAlarm)}%   ·   Heat ${game.heat}`,
      '',
      'Press ENTER for the next job.',
    ], '#7dffab');
  }

  drawNightDone(c, game) {
    const ghost = game.ghost && game.peakAlarm <= 50;
    const lines = [
      `Three jobs, one night — $${game.totalLoot.toLocaleString()} lifted.`,
      '',
      ...game.jobResults.map((r) => `Job ${r.numeral} ${r.name}: $${r.loot.toLocaleString()}`),
      '',
      ghost
        ? 'GHOST — the alarm never passed 50%. Bonus $2,000. No one ever knew.'
        : `Alarm peaked at ${Math.round(game.peakAlarm)}%. The museum will remember.`,
      '',
      'Wren vanishes into the 2:14 AM dark. Press ENTER to run it again.',
    ];
    this.panel(c, ghost ? 'GHOST — THE PERFECT NIGHT' : 'THE NIGHT IS DONE', lines, ghost ? '#ffd94d' : '#7dffab');
  }

  drawGameOver(c, game) {
    this.panel(c, 'THE NIGHT ENDS IN CUFFS', [
      'Three lives spent. The Marlowe keeps its treasures tonight.',
      '',
      `Lifted so far: $${game.totalLoot.toLocaleString()}`,
      '',
      'Press ENTER to case the museum again.',
    ], '#ff5a5a');
  }
}
