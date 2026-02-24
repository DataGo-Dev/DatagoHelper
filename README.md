# Datago Helper

Aplicativo que roda em segundo plano no Windows e no Mac e **agenda um `git pull`** em todos os repositórios Git do usuário:

- **Horário:** todo dia às **09:30**, ou na primeira vez que o computador for ligado/reiniciado (se ainda não tiver rodado naquele dia).
- **Repositórios:** pasta que você informar **e/ou** a pasta padrão do GitHub Desktop (`Documents/GitHub`).
- **Início com o sistema:** opção para abrir ao iniciar o computador (ativada por padrão).

O app fica na **bandeja do sistema** (tray). Clique no ícone para abrir a janela de configurações e ver o resultado da última execução.

---

## Como rodar

### Pré-requisitos

- Node.js instalado (recomendado LTS).
- Git instalado e acessível no PATH.

### Instalação e execução

```bash
cd DatagoHelper
npm install
npm start
```

Na primeira execução, abra a janela pelo ícone na bandeja e:

1. **(Opcional)** Informe a **pasta onde estão seus repositórios** (ex.: `C:\Repos` ou `/Users/voce/Projetos`).
2. Marque ou desmarque **“Incluir pasta padrão do GitHub Desktop”** (Documents/GitHub).
3. Marque **“Abrir ao iniciar o computador”** se quiser que o app inicie com o sistema.
4. Clique em **Salvar**.

O pull será executado às 09:30 ou assim que você ligar o PC (se ainda não tiver rodado no dia). Você também pode clicar em **“Rodar pull agora”** para testar.

---

## Ícone na bandeja

Se quiser um ícone personalizado na bandeja, coloque um PNG em:

- **`assets/tray-icon.png`**

Tamanhos sugeridos: 22×22 px (Mac) e 16×16 px (Windows). Se o arquivo não existir, um ícone mínimo é usado.

---

## Gerar instalador (build)

- **Mac:** `npm run build:mac` → gera app e DMG em `dist/`.
- **Windows:** `npm run build:win` → gera instalador NSIS em `dist/`.

Depois de instalar, o “abrir ao iniciar” passa a funcionar conforme a opção nas configurações.

---

## Estrutura do projeto

- **`main.js`** – Processo principal: bandeja, agendamento 09:30, execução ao iniciar, configurações.
- **`preload.js`** – Ponte segura entre a janela e o main.
- **`index.html`** + **`renderer.js`** – Janela de configurações e status.
- **`services/git-pull.js`** – Descoberta de repositórios (pasta do usuário + Documents/GitHub) e execução de `git pull`.

Configurações são salvas com `electron-store` (arquivo no perfil do usuário).
