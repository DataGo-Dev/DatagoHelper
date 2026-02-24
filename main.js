/**
 * Datago Helper - Processo principal (Electron)
 *
 * - Ícone na bandeja do sistema
 * - Agenda pull às 09:30 ou executa ao iniciar se ainda não rodou no dia
 * - Repositórios: pasta informada pelo usuário + opcionalmente pasta padrão do GitHub Desktop
 */

const { app, BrowserWindow, Tray, ipcMain, nativeImage, dialog } = require('electron');
const path = require('path');
const Store = require('electron-store');
const { getReposPaths, runPullInRepos } = require('./services/git-pull');

let autoUpdater;
if (app.isPackaged) {
  autoUpdater = require('electron-updater').autoUpdater;
}

const store = new Store({ name: 'datago-helper' });

const ABORT_PULL_PASSWORD = 'Data123!';

let mainWindow = null;
let tray = null;
let pullAbortRequested = false;

// Criar janela principal (configurações + status)
function createWindow() {
  if (mainWindow) {
    mainWindow.show();
    mainWindow.focus();
    return;
  }
  mainWindow = new BrowserWindow({
    width: 480,
    height: 520,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
    title: 'Datago Helper',
  });
  mainWindow.loadFile(path.join(__dirname, 'index.html'));
  mainWindow.once('ready-to-show', () => mainWindow.show());
  mainWindow.on('close', (e) => {
    if (!app.isQuitting) {
      e.preventDefault();
      mainWindow.hide();
    }
  });
  mainWindow.on('closed', () => { mainWindow = null; });
}

// Ícone da bandeja: assets/tray-icon.png ou ícone mínimo embutido
function getTrayIcon() {
  const iconPath = path.join(__dirname, 'assets', 'tray-icon.png');
  const img = nativeImage.createFromPath(iconPath);
  if (!img.isEmpty()) return img;
  // Fallback: ícone 1x1 (evita bandeja vazia no Mac)
  const fallback = nativeImage.createFromDataURL(
    'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=='
  );
  return fallback;
}

function createTray() {
  const icon = getTrayIcon();
  tray = new Tray(icon.isEmpty() ? nativeImage.createEmpty() : icon);
  tray.setToolTip('Datago Helper - Pull agendado 09:30');
  tray.on('click', () => createWindow());
  if (process.platform !== 'darwin') {
    tray.on('double-click', () => createWindow());
  }
}

// Abrir no login (Windows / Mac)
function applyOpenAtLogin(open) {
  app.setLoginItemSettings({
    openAtLogin: open,
    openAsHidden: true,
  });
}

// Retorna se já rodou hoje (para não rodar de novo ao iniciar)
function getLastRunDate() {
  return store.get('lastRunDate', null);
}

function setLastRunDate(dateStr) {
  store.set('lastRunDate', dateStr);
}

function todayStr() {
  const d = new Date();
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}

// Executar pull em todos os repositórios e notificar a janela
async function runScheduledPull() {
  const reposFolder = store.get('reposFolder', '');
  const includeGitHubDesktopFolder = store.get('includeGitHubDesktopFolder', true);

  if (!reposFolder && !includeGitHubDesktopFolder) {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('pull-result', { ok: false, message: 'Configure uma pasta de repositórios.' });
    }
    return;
  }

  const paths = await getReposPaths(reposFolder, includeGitHubDesktopFolder);

  pullAbortRequested = false;
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('pull-start', { total: paths.length });
  }

  const result = await runPullInRepos(
    paths,
    (report) => {
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('pull-progress', report);
      }
    },
    () => pullAbortRequested
  );

  pullAbortRequested = false;
  if (!result.aborted) setLastRunDate(todayStr());

  // Persistir esta execução no histórico (com data/hora e log de sucessos/erros)
  const now = new Date();
  const dateStr = now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0') + '-' + String(now.getDate()).padStart(2, '0');
  const timeStr = String(now.getHours()).padStart(2, '0') + ':' + String(now.getMinutes()).padStart(2, '0') + ':' + String(now.getSeconds()).padStart(2, '0');
  const entry = {
    id: Date.now(),
    dateStr,
    timeStr,
    dateTime: now.toISOString(),
    okCount: result.okCount,
    failCount: result.failCount,
    total: result.total,
    aborted: result.aborted,
    message: result.message,
    results: (result.results || []).map((r) => ({
      name: r.name,
      ok: r.ok,
      error: r.error,
      stdout: r.stdout,
      stderr: r.stderr,
    })),
  };
  const history = store.get('executionHistory', []);
  history.unshift(entry);
  store.set('executionHistory', history.slice(0, 50));

  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('pull-result', { ...result, lastRunDate: result.aborted ? null : todayStr() });
  }
}

// Agenda execução diária às 09:30. A cada minuto verifica se é 09:30 e ainda não rodou hoje.
function scheduleNextRun() {
  const CHECK_INTERVAL_MS = 60 * 1000;

  setInterval(() => {
    const now = new Date();
    const is930 = now.getHours() === 9 && now.getMinutes() >= 30;
    const alreadyRanToday = getLastRunDate() === todayStr();
    if (is930 && !alreadyRanToday) {
      runScheduledPull();
    }
  }, CHECK_INTERVAL_MS);
}

function setupAutoUpdate() {
  if (!autoUpdater) return;
  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;

  autoUpdater.on('update-available', (info) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('update-available', { version: info.version });
    }
  });

  autoUpdater.on('update-downloaded', () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      dialog.showMessageBox(mainWindow, {
        type: 'info',
        title: 'Atualização disponível',
        message: 'Uma nova versão foi baixada. Reiniciar o Datago Helper agora para instalar?',
        buttons: ['Reiniciar agora', 'Depois'],
      }).then(({ response }) => {
        if (response === 0) autoUpdater.quitAndInstall(false, true);
      });
    }
  });

  autoUpdater.on('error', (err) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('update-error', { message: err.message });
    }
  });

  // Verificar após um pequeno delay para não bloquear a abertura
  setTimeout(() => {
    autoUpdater.checkForUpdates().catch(() => {});
  }, 3000);
}

function onAppReady() {
  createTray();
  applyOpenAtLogin(store.get('openAtLogin', true));

  const lastRun = getLastRunDate();
  const today = todayStr();
  if (lastRun !== today) {
    runScheduledPull();
  }
  scheduleNextRun();

  setupAutoUpdate();

  // Abrir janela ao iniciar para facilitar a primeira configuração
  createWindow();
}

// IPC: configurações e ações da interface
ipcMain.handle('get-settings', () => ({
  reposFolder: store.get('reposFolder', ''),
  includeGitHubDesktopFolder: store.get('includeGitHubDesktopFolder', true),
  openAtLogin: store.get('openAtLogin', true),
  lastRunDate: getLastRunDate(),
  appVersion: app.getVersion(),
}));

ipcMain.handle('get-execution-history', () => store.get('executionHistory', []));

ipcMain.handle('save-settings', (_e, { reposFolder, includeGitHubDesktopFolder, openAtLogin }) => {
  store.set('reposFolder', reposFolder || '');
  store.set('includeGitHubDesktopFolder', !!includeGitHubDesktopFolder);
  store.set('openAtLogin', !!openAtLogin);
  applyOpenAtLogin(!!openAtLogin);
  return { ok: true };
});

ipcMain.handle('run-pull-now', async () => {
  await runScheduledPull();
  return { ok: true };
});

ipcMain.handle('abort-pull', (_e, password) => {
  if (password === ABORT_PULL_PASSWORD) {
    pullAbortRequested = true;
    return { ok: true };
  }
  return { ok: false };
});

app.whenReady().then(onAppReady);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('before-quit', () => {
  app.isQuitting = true;
});
