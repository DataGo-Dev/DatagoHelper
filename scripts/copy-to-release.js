/**
 * Copia os artefatos de dist/ para release/ para você anexar ao GitHub Release.
 * Rode após: npm run build:mac ou npm run build:win
 */

const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const distDir = path.join(root, 'dist');
const releaseDir = path.join(root, 'release');

if (!fs.existsSync(distDir)) {
  console.error('Pasta dist/ não encontrada. Rode antes: npm run build:mac ou npm run build:win');
  process.exit(1);
}

if (!fs.existsSync(releaseDir)) {
  fs.mkdirSync(releaseDir, { recursive: true });
}

function copyRecursive(src, dest) {
  const stat = fs.statSync(src);
  if (stat.isDirectory()) {
    if (!fs.existsSync(dest)) fs.mkdirSync(dest, { recursive: true });
    for (const name of fs.readdirSync(src)) {
      copyRecursive(path.join(src, name), path.join(dest, name));
    }
  } else {
    fs.copyFileSync(src, dest);
    console.log('  ' + path.relative(root, dest));
  }
}

console.log('Copiando artefatos de dist/ para release/...');
for (const name of fs.readdirSync(distDir)) {
  const src = path.join(distDir, name);
  const dest = path.join(releaseDir, name);
  copyRecursive(src, dest);
}
console.log('Pronto. Anexe o conteúdo de release/ ao seu Release no GitHub.');
