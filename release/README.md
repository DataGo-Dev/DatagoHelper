# Pasta para arquivos do GitHub Release

Os arquivos desta pasta são os que você deve **anexar** ao Release no GitHub para a atualização automática funcionar.

## Como gerar os arquivos

1. Gere o build:
   - **Mac:** `npm run build:mac`
   - **Windows:** `npm run build:win`

2. Copie os artefatos para esta pasta:
   ```bash
   node scripts/copy-to-release.js
   ```

3. No GitHub: **Releases** → crie ou edite o release (tag ex.: `v1.0.4`) → **Attach binaries** → anexe **todos** os arquivos que estão dentro de `release/` (incluindo os `.yml`).

## Arquivos necessários

- **Mac:** `latest-mac.yml` + o instalador (`.dmg` e/ou `.zip`)
- **Windows:** `latest.yml` + o instalador (`.exe`)

O electron-updater procura o arquivo `.yml` no release para saber a versão e o link do instalador. Sem o `.yml`, o app não encontra a atualização.

## Repositório público

O `package.json` está com `"private": false` em `build.publish`. Com o repositório público, não é necessário configurar token para a verificação de atualização.
