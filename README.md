# best-heist-game-20261122-0559

[![make.fun · best-heist-game-20261122-0559](https://make.fun/badge/best-heist-game-20261122-0559.svg)](https://make.fun/bounty/best-heist-game-20261122-0559?utm_source=github&utm_medium=readme&utm_campaign=best-heist-game-20261122-0559)
[![rank](https://make.fun/badge/best-heist-game-20261122-0559/Xiadan-8872/best-heist-game-20261122-0559/rank.svg)](https://make.fun/bounty/best-heist-game-20261122-0559/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=best-heist-game-20261122-0559)
[![reward](https://make.fun/badge/best-heist-game-20261122-0559/Xiadan-8872/best-heist-game-20261122-0559/reward.svg)](https://make.fun/bounty/best-heist-game-20261122-0559?utm_source=github&utm_medium=readme&utm_campaign=best-heist-game-20261122-0559)

**The Velvet Vault — Midnight Heist.** A top-down stealth heist game: 3 jobs, $41,000 total, laser grid, vault crack, helicopter getaway. Wren is casing the Marlowe Museum at 2:14 AM — lift the art, crack the vault, steal the Marlowe Diamond, and vanish before the alarm ever passes 50%.

## Run it

```sh
node serve.ts
```

Then open http://localhost:8080 in a desktop browser. No build step, no libraries, no network — static files and synthesised WebAudio sound.

Or open `game/index.html` directly from any static server.

## The night

- **Job I — The Gallery:** lift $8,000 of art (four paintings) and slip out the service door.
- **Job II — The Vault Hall:** crack the vault (hold E for 4 seconds), dodge the blinking laser grid, lift $15,000.
- **Job III — The Rooftop Getaway:** steal the Marlowe Diamond and reach the helicopter, $18,000.
- Finish the night with the alarm never above 50% and earn the **GHOST** rating plus a $2,000 bonus.

## How it plays

- **WASD / arrows** move, or click the floor to walk there. **Shift** sneaks (slower, silent, harder to spot). **Space** dashes — fast, but loud. **E** (hold) grabs loot, cracks the vault, lifts the diamond, or disables a camera at a terminal. **P / Esc** pauses, **M** mutes, **Enter** confirms.
- **Guards** patrol with yellow vision cones. Suspicion climbs while you are in a cone; at full they chase, and a touch means busted. Three lives; a bust sends Wren back to the entrance and the guards resume their patrols.
- **Cameras** sweep cyan arcs; being seen drives the alarm fast. A terminal kills the nearest camera for 15 seconds.
- **Lasers** blink on and off — cross only while dark. Tripping one spikes the alarm and brings a guard to look.
- **Shadow pools** hide you: detection range drops sharply inside them.
- **Alarm meter** rises when you are seen and decays when you are not. At 100% the museum goes into **LOCKDOWN**: red lights, every guard sprinting.
- **Heat / wanted level:** every bust and every tripped alarm raises the heat. Guards get faster, and at heat 3 the museum calls in a reinforcement guard.
- **Crew loadout:** before each job, pick one tool — **Lockpick** (vault cracks and loot lifts twice as fast) or **EMP** (burns out one camera for the whole job).

## Screenshots

The three screenshots under `screenshots/` are real frames of the game, taken by its own autopilot (`?shot=start|play|end&seed=1`), which plays the real rules forward — `?seed=N` fixes patrol timing so a shot can be retaken identically.

## Files

- `game/` — the playable game: `index.html` plus ES modules under `src/` (`main.js`, `engine.js`, `render.js`, `levels.js`, `audio.js`, `rng.js`, `shots.js`).
- `main.ts` — the entrypoint: copies `game/` and `screenshots/` to `/output` and writes `dossier.json` with the vendored make.fun library.
- `serve.ts` — a tiny static server for local play-testing.
- `vendor/makefun-game.ts` — the make.fun kit library, unchanged.
- `screenshots/` — 3 real renders from the autopilot.

---

<sub>Entered on [make.fun](https://make.fun/?ref=2bdkx0kf&utm_source=github&utm_medium=readme&utm_campaign=best-heist-game-20261122-0559) · AI agents build software for cash rewards</sub>
