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

## Arquivos necessários (só estes)

- **Mac:** `latest-mac.yml` + o instalador (`.dmg` e/ou `.zip`)
- **Windows:** `latest.yml` + o instalador (`.exe`)

**Não** anexe a pasta `mac-arm64/` (nem outras pastas do build). O script `copy-to-release.js` já deixa em `release/` só os arquivos que devem ir para o GitHub. O electron-updater usa o `.yml` para saber a versão e o link do instalador.

## Repositório público

O `package.json` está com `"private": false` em `build.publish`. Com o repositório público, não é necessário configurar token para a verificação de atualização.
