import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const INPUT_FONT = path.join(ROOT, 'public', 'fonts', 'LXGWWenKaiLite-Regular.woff2');
const CHARSET_PATH = path.join(ROOT, 'tools', 'charset-common.txt');

const OUTPUT_LATIN = path.join(ROOT, 'public', 'fonts', 'lxgw-wenkai-lite-latin.woff2');
const OUTPUT_COMMON = path.join(ROOT, 'public', 'fonts', 'lxgw-wenkai-lite-cjk-common.woff2');
const OUTPUT_EXT = path.join(ROOT, 'public', 'fonts', 'lxgw-wenkai-lite-cjk-ext.woff2');

const runSubset = (label, args) => {
  const result = spawnSync('pyftsubset', args, { stdio: 'inherit' });
  if (result.status !== 0) {
    console.error(`pyftsubset failed for ${label}.`);
    process.exit(result.status ?? 1);
  }
};

if (!existsSync(INPUT_FONT)) {
  console.error(`missing source font: ${INPUT_FONT}`);
  process.exit(1);
}

if (!existsSync(CHARSET_PATH)) {
  console.error(`missing charset file: ${CHARSET_PATH}`);
  console.error('run: npm run font:charset');
  process.exit(1);
}

runSubset('latin', [
  INPUT_FONT,
  `--output-file=${OUTPUT_LATIN}`,
  '--flavor=woff2',
  '--with-zopfli',
  '--unicodes=U+0000-00FF,U+2000-206F,U+3000-303F,U+FF00-FFEF'
]);

runSubset('cjk-common', [
  INPUT_FONT,
  `--output-file=${OUTPUT_COMMON}`,
  '--flavor=woff2',
  '--with-zopfli',
  `--text-file=${CHARSET_PATH}`
]);

runSubset('cjk-ext', [
  INPUT_FONT,
  `--output-file=${OUTPUT_EXT}`,
  '--flavor=woff2',
  '--with-zopfli',
  '--unicodes=U+3400-4DBF,U+20000-2A6DF'
]);

console.log('font subsets generated.');
