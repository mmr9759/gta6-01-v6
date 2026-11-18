// main.ts — VELMARA: Streets of Gold v6 (gta6-01).
// Node 22, standard library only, no network, deterministic.
// Copies game/ and screenshots/ from this repository into the output
// directory and writes /output/dossier.json with buildDossier from
// vendor/makefun-game.ts. Never deletes the output directory: the grader
// mounts /output as a volume, so only mkdir + writes happen here.
import { buildDossier } from './vendor/makefun-game.ts';
import { copyFileSync, existsSync, mkdirSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = dirname(fileURLToPath(import.meta.url));
const OUT = process.env.MAKEFUN_OUTPUT_DIR || '/output';

function copyTree(srcDir: string, dstDir: string): void {
  mkdirSync(dstDir, { recursive: true });
  const entries = readdirSync(srcDir).sort();
  for (const name of entries) {
    const src = join(srcDir, name);
    const dst = join(dstDir, name);
    const st = statSync(src);
    if (st.isDirectory()) copyTree(src, dst);
    else if (st.isFile()) copyFileSync(src, dst);
  }
}

function main(): void {
  mkdirSync(OUT, { recursive: true });
  const gameSrc = join(ROOT, 'game');
  const shotsSrc = join(ROOT, 'screenshots');
  if (!existsSync(gameSrc)) throw new Error('game/ missing next to main.ts');
  copyTree(gameSrc, join(OUT, 'game'));
  if (existsSync(shotsSrc)) copyTree(shotsSrc, join(OUT, 'screenshots'));
  const dossier = buildDossier(OUT, {
    text_max_bytes: 163840,
    screenshots: { max: 4, max_bytes: 262144 },
    game_max_files: 993,
    game_max_bytes: 48 * 1024 * 1024,
    game_path_max_bytes: 1000,
  });
  writeFileSync(join(OUT, 'dossier.json'), dossier);
  console.log(`velmara v6: dossier ${dossier.length} bytes -> ${OUT}/dossier.json`);
}

main();
