import { copyFile, mkdir, readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const modules = path.join(root, 'node_modules');
const target = path.join(root, 'public/ocr/v7');
await mkdir(path.join(target, 'core'), { recursive: true });
await mkdir(path.join(target, 'lang'), { recursive: true });
await copyFile(path.join(modules, 'tesseract.js/dist/worker.min.js'), path.join(target, 'worker.min.js'));
// Copy every core variant so the engine can choose the browser's supported WASM.
for (const name of await readdir(path.join(modules, 'tesseract.js-core'))) {
  if (/^tesseract-core.*\.(wasm|js)$/.test(name)) {
    await copyFile(path.join(modules, 'tesseract.js-core', name), path.join(target, 'core', name));
  }
}
for (const language of ['chi_sim', 'eng']) {
  await copyFile(path.join(modules, `@tesseract.js-data/${language}/4.0.0_best_int/${language}.traineddata.gz`), path.join(target, 'lang', `${language}.traineddata.gz`));
}
// Retain the bundled licenses alongside the self-hosted resources.
for (const [pkg, label] of [['tesseract.js', 'engine'], ['tesseract.js-core', 'core'], ['@tesseract.js-data/chi_sim', 'chi_sim'], ['@tesseract.js-data/eng', 'eng']]) {
  const names = await readdir(path.join(modules, pkg));
  const license = names.find((name) => /^license/i.test(name));
  if (license) await copyFile(path.join(modules, pkg, license), path.join(target, `LICENSE-${label}.txt`));
}
console.log('Prepared same-origin OCR worker, core, Chinese and English resources.');
