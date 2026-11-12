/**
 * Copia para release/ só os arquivos da versão atual (package.json) para anexar ao GitHub Release:
 * - latest-mac.yml, latest.yml (do build atual)
 * - .dmg, .zip, .exe cujo nome contenha a versão atual (ex.: 1.0.4)
 * Não copia pastas (mac-arm64, etc.) nem arquivos de outras versões.
 */

const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const distDir = path.join(root, 'dist');
const releaseDir = path.join(root, 'release');

const pkgPath = path.join(root, 'package.json');
const version = require(pkgPath).version; // ex.: "1.0.4"

if (!fs.existsSync(distDir)) {
  console.error('Pasta dist/ não encontrada. Rode antes: npm run build:mac ou npm run build:win');
  process.exit(1);
}

const CANAL_YML = ['latest-mac.yml', 'latest.yml'];
const EXT_INSTALADOR = ['.dmg', '.zip', '.exe'];

function copiarArquivos(dir) {
  const itens = fs.readdirSync(dir);
  for (const name of itens) {
    const src = path.join(dir, name);
    const stat = fs.statSync(src);
    if (stat.isDirectory()) continue;
    const base = path.basename(name);
    const ext = path.extname(name).toLowerCase();
    const ehCanal = CANAL_YML.includes(base);
    const ehInstalador = EXT_INSTALADOR.includes(ext) && base.includes(version);
    if (!ehCanal && !ehInstalador) continue;
    const dest = path.join(releaseDir, name);
    fs.copyFileSync(src, dest);
    console.log('  ' + path.relative(root, dest));
  }
}

if (!fs.existsSync(releaseDir)) {
  fs.mkdirSync(releaseDir, { recursive: true });
}

// Limpa release/ (menos README.md) para não deixar mac-arm64 etc.
const keep = ['README.md'];
for (const name of fs.readdirSync(releaseDir)) {
  if (keep.includes(name)) continue;
  const p = path.join(releaseDir, name);
  if (fs.statSync(p).isDirectory()) {
    fs.rmSync(p, { recursive: true });
  } else {
    fs.unlinkSync(p);
  }
}

console.log('Copiando para release/ (versão ' + version + ')...');
copiarArquivos(distDir);
console.log('Pronto. Anexe o conteúdo de release/ ao Release no GitHub.');