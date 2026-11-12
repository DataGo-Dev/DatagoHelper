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

Os módulos em **`dependencies`** são empacotados dentro do app (DMG/instalador). Quem instala pelo DMG não roda `npm install` — tudo já vai no pacote. Antes de gerar o build, rode `npm install` e depois o build:

- **Mac:** `npm run build:mac` → gera app e DMG em `dist/`.
- **Windows:** `npm run build:win` → gera instalador NSIS em `dist/`.

Depois de instalar, o “abrir ao iniciar” passa a funcionar conforme a opção nas configurações.

### Mac: mensagem "O arquivo está danificado"

Em outras máquinas, o macOS pode exibir que o app "está danificado" ao abrir o DMG ou o app. **Isso acontece porque o app não está assinado** com um certificado da Apple (Gatekeeper bloqueia apps de desenvolvedor não identificado).

**Quem for instalar (contorno rápido):**

1. Abra o DMG e arraste o app para Aplicativos.
2. Em **Aplicativos**, clique com o **botão direito** (ou Control + clique) em **Datago Helper** → **Abrir**.
3. Confirme em "Abrir" na janela que aparecer. Na próxima vez o app abre normalmente.

Alternativa no Terminal (remove o atributo de quarentena do app já instalado):

```bash
xattr -cr "/Applications/Datago Helper.app"
```

**Para distribuir sem esse aviso (solução definitiva):** é preciso **assinar e notarizar** o app com uma conta **Apple Developer** (paga, ~US$ 99/ano). Em [developer.apple.com](https://developer.apple.com) crie um certificado **Developer ID Application** e um App-specific password; depois defina as variáveis `CSC_LINK`, `CSC_KEY_PASSWORD`, `APPLE_ID`, `APPLE_APP_SPECIFIC_PASSWORD` e `CSC_NAME` e rode `npm run build:mac`. Documentação: [Code Signing (macOS) – electron-builder](https://www.electron.build/code-signing-mac.html).

---

## Atualização automática

Ao iniciar, o app (quando instalado a partir do build) **verifica no GitHub** se existe uma versão mais nova. Se existir:

1. O download da nova versão é feito em segundo plano.
2. Quando terminar, aparece um diálogo perguntando se deseja **reiniciar agora** para instalar.
3. Se escolher “Depois”, a instalação ocorre na próxima vez que você fechar o app.

**Para publicar uma nova versão e seus usuários receberem a atualização:**

1. Atualize o `version` no `package.json` (ex.: `"1.1.0"`).
2. Gere o build: `npm run build:mac` e/ou `npm run build:win`.
3. No GitHub, vá em **Releases** → **Create a new release**:
   - **Tag:** ex. `v1.1.0` (com "v" + número da versão).
   - **Release title:** ex. "v1.1.0".
   - **Importante:** publique o release (clique em **Publish release**), não deixe como rascunho (Draft). Não marque como **Pre-release**, senão o app não o considera como "latest".
4. Anexe **todos** os arquivos relevantes de `dist/` ao release:
   - **Mac:** o `.dmg` (ou `.zip`) e o **`latest-mac.yml`** (obrigatório para o updater encontrar a versão).
   - **Windows:** o instalador `.exe` e o **`latest.yml`**.
   - O GitHub aceita .dmg e .exe: na página do release, role até **"Attach binaries by dropping them here or selecting them"** e arraste ou selecione os arquivos. Se não aparecer opção de anexar, use o link "Edit" do release e role até o final.

**Repositório privado e 404 em "releases/latest":** use um token **clássico** (classic PAT) com escopo **`repo`**. Tokens fine-grained só com "Contents: read" podem gerar 404 na API de Releases; o escopo `repo` evita isso.

O `package.json` já está configurado com `repository` e `build.publish` apontando para o repositório GitHub. Se o seu repositório for outro, altere `owner` e `repo` em `build.publish` e a URL em `repository`.

Na aba **Início**, o app mostra o status da verificação (“Verificando atualização…”, “Você está na versão mais recente” ou “Nova versão X disponível”) e um botão **Verificar novamente** para checar de novo.

**Se a atualização não aparecer:** confira se o Release no GitHub tem a **tag** no formato `v1.0.2` (com “v”) e se os **arquivos do build** (ex.: `.dmg` no Mac) estão anexados ao Release. Em caso de erro, a mensagem na tela exibe o motivo (rede, URL, etc.).

**Repositório privado:** é possível usar atualização automática com repo privado. Com o campo Token em branco, o app tenta usar, nesta ordem: **GitHub CLI (gh)** se estiver logado; em seguida a conta salva no **Git** ou **GitHub Desktop** (credential para github.com). Se não houver nenhuma, em **Configurações** preencha o campo **Token do GitHub**: crie um Personal Access Token (GitHub → Settings → Developer settings → Personal access tokens) com permissão de leitura do repositório (`repo` ou fine-grained “Contents: Read”) e cole no app. O token fica salvo localmente no seu usuário. Todos os usuários que tiverem acesso ao repositório podem usar o próprio token.

---

## Estrutura do projeto

- **`main.js`** – Processo principal: bandeja, agendamento 09:30, execução ao iniciar, configurações.
- **`preload.js`** – Ponte segura entre a janela e o main.
- **`index.html`** + **`renderer.js`** – Janela de configurações e status.
- **`services/git-pull.js`** – Descoberta de repositórios (pasta do usuário + Documents/GitHub) e execução de `git pull`.

Configurações são salvas com `electron-store` (arquivo no perfil do usuário).
