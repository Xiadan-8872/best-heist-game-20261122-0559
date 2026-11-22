// The Velvet Vault — Midnight Heist. Entrypoint for the make.fun grader.
//
// What this program does, and nothing else:
//   1. copies this repository's game/ and screenshots/ into the output dir
//      (/output in the grader, or $MAKEFUN_OUTPUT_DIR when run locally),
//   2. writes /output/dossier.json with buildDossier from the vendored
//      make.fun library (vendor/makefun-game.ts, the kit's copy, unchanged).
// It runs on Node 22 with the standard library only; there is no build
// step and no network request.
//
// Run it locally:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
// Then serve the result with `node serve.ts` and open http://localhost:8080.

import { cpSync, existsSync, mkdirSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

// The scorer's own caps, from the competition bundle's gate section.
const DOSSIER_CAPS = {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  game_max_files: 993,
  game_max_bytes: 50331648,
  game_path_max_bytes: 1000,
};

function fail(message) {
  console.error(`main.ts: ${message}`);
  process.exit(1);
}

function describeTree(dir) {
  const names = readdirSync(dir);
  let files = 0;
  let bytes = 0;
  for (const name of names) {
    const st = statSync(join(dir, name));
    if (st.isFile()) {
      files += 1;
      bytes += st.size;
    } else if (st.isDirectory()) {
      const sub = describeTree(join(dir, name));
      files += sub.files;
      bytes += sub.bytes;
    }
  }
  return { files, bytes, names };
}

const here = fileURLToPath(new URL('.', import.meta.url));
const outDir = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';
const gameDir = join(here, 'game');
const shotsDir = join(here, 'screenshots');

if (!existsSync(gameDir)) fail('game/ is missing next to main.ts');
if (!existsSync(join(gameDir, 'index.html'))) fail('game/index.html is missing');
if (!existsSync(shotsDir)) fail('screenshots/ is missing next to main.ts');

mkdirSync(outDir, { recursive: true });
cpSync(gameDir, join(outDir, 'game'), { recursive: true });
mkdirSync(join(outDir, 'screenshots'), { recursive: true });
cpSync(shotsDir, join(outDir, 'screenshots'), { recursive: true });

const gameInfo = describeTree(join(outDir, 'game'));
const shotInfo = describeTree(join(outDir, 'screenshots'));
if (shotInfo.files < 3 || shotInfo.files > 4) {
  fail(`expected 3 or 4 screenshots, found ${shotInfo.files}`);
}

const dossier = buildDossier(outDir, DOSSIER_CAPS);
writeFileSync(join(outDir, 'dossier.json'), dossier);

console.log('The Velvet Vault handed in:');
console.log(`  game/: ${gameInfo.files} files, ${gameInfo.bytes} bytes`);
console.log(`  screenshots/: ${shotInfo.names.sort().join(', ')}`);
console.log(`  dossier.json: ${dossier.length} bytes`);
console.log(`  output: ${outDir}`);
