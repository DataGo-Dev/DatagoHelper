/**
 * Interface da janela: carrega/salva configurações e exibe resultado do pull.
 */

const reposFolderEl = document.getElementById('reposFolder');
const includeGitHubDesktopEl = document.getElementById('includeGitHubDesktop');
const openAtLoginEl = document.getElementById('openAtLogin');
const saveBtn = document.getElementById('saveBtn');
const pullNowBtn = document.getElementById('pullNowBtn');
const abortPullBtn = document.getElementById('abortPullBtn');
const saveStatusEl = document.getElementById('saveStatus');
const lastRunEl = document.getElementById('lastRun');
const pullLogEl = document.getElementById('pullLog');

let pullInProgress = false;

function showSaveStatus(msg, isError = false) {
  saveStatusEl.textContent = msg;
  saveStatusEl.className = 'status' + (isError ? ' error' : ' success');
  if (msg) setTimeout(() => { saveStatusEl.textContent = ''; }, 3000);
}

function appendLog(html, className = '') {
  const div = document.createElement('div');
  div.className = 'log-entry' + (className ? ' ' + className : '');
  div.innerHTML = html;
  pullLogEl.appendChild(div);
  pullLogEl.scrollTop = pullLogEl.scrollHeight;
}

function renderPullResult(data) {
  if (data.lastRunDate) lastRunEl.textContent = data.lastRunDate;
  if (data.message && !data.lastRunDate) lastRunEl.textContent = data.message;

  if (!data.results || data.results.length === 0) {
    if (data.message) appendLog(escapeHtml(data.message));
    return;
  }

  const summary = data.aborted
    ? `Interrompido: ${data.okCount} ok, ${data.failCount} com erro até o abort.`
    : `Concluído: ${data.okCount} ok, ${data.failCount} com erro.`;
  appendLog(escapeHtml(summary), data.ok ? 'success' : 'fail');
}

function escapeHtml(s) {
  const div = document.createElement('div');
  div.textContent = s;
  return div.innerHTML;
}

function todayStr() {
  const d = new Date();
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}

async function loadSettings() {
  const s = await window.datago.getSettings();
  reposFolderEl.value = s.reposFolder || '';
  includeGitHubDesktopEl.checked = s.includeGitHubDesktopFolder !== false;
  openAtLoginEl.checked = s.openAtLogin !== false;
  if (s.lastRunDate) lastRunEl.textContent = s.lastRunDate;

  // Ao abrir a janela: informar no log se o pull de hoje já foi executado
  pullLogEl.innerHTML = '';
  if (s.lastRunDate === todayStr()) {
    appendLog(escapeHtml('O pull de hoje já foi executado.'), 'success');
  } else {
    appendLog(escapeHtml('O pull de hoje ainda não foi executado. Será executado em breve…'));
  }
}

saveBtn.addEventListener('click', async () => {
  await window.datago.saveSettings({
    reposFolder: reposFolderEl.value.trim(),
    includeGitHubDesktopFolder: includeGitHubDesktopEl.checked,
    openAtLogin: openAtLoginEl.checked,
  });
  showSaveStatus('Configurações salvas.');
});

pullNowBtn.addEventListener('click', async () => {
  pullNowBtn.disabled = true;
  pullLogEl.innerHTML = '';
  appendLog('Iniciando…');
  try {
    await window.datago.runPullNow();
  } finally {
    pullNowBtn.disabled = false;
  }
});

const abortModal = document.getElementById('abortModal');
const abortPasswordInput = document.getElementById('abortPasswordInput');
const abortModalCancel = document.getElementById('abortModalCancel');
const abortModalConfirm = document.getElementById('abortModalConfirm');

function openAbortModal() {
  abortPasswordInput.value = '';
  abortModal.setAttribute('aria-hidden', 'false');
  abortPasswordInput.focus();
}

function closeAbortModal() {
  abortModal.setAttribute('aria-hidden', 'true');
}

abortPullBtn.addEventListener('click', () => {
  openAbortModal();
});

abortModalCancel.addEventListener('click', () => {
  closeAbortModal();
});

abortModalConfirm.addEventListener('click', async () => {
  const password = abortPasswordInput.value;
  closeAbortModal();
  const res = await window.datago.abortPull(password);
  if (res.ok) {
    showSaveStatus('Abort solicitado. O pull será interrompido após o repositório atual.');
  } else {
    showSaveStatus('Senha incorreta.', true);
  }
});

abortPasswordInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') abortModalConfirm.click();
  if (e.key === 'Escape') closeAbortModal();
});

// Abas Início / Histórico
const tabInicio = document.getElementById('tabInicio');
const tabHistorico = document.getElementById('tabHistorico');
const panelInicio = document.getElementById('panelInicio');
const panelHistorico = document.getElementById('panelHistorico');
const historyListEl = document.getElementById('historyList');

function formatDateForDisplay(dateStr) {
  if (!dateStr || dateStr.length < 10) return dateStr;
  const [y, m, d] = dateStr.split('-');
  return d + '/' + m + '/' + y;
}

function renderExecutionLog(results) {
  if (!results || results.length === 0) return escapeHtml('Nenhum repositório nesta execução.');
  const lines = results.map((r) => {
    const cls = r.ok ? 'log-ok' : 'fail';
    const text = r.ok
      ? '▶ ' + escapeHtml(r.name) + ' — OK' + (r.stdout ? ' ' + escapeHtml(r.stdout.slice(0, 200)) : '')
      : '▶ ' + escapeHtml(r.name) + ' — ERRO: ' + escapeHtml((r.error || r.stderr || '').slice(0, 300));
    return '<div class="log-entry ' + cls + '">' + text + '</div>';
  });
  return lines.join('');
}

function renderHistoryList(history) {
  historyListEl.innerHTML = '';
  if (!history || history.length === 0) {
    historyListEl.innerHTML = '<li class="status">Nenhuma execução registrada ainda.</li>';
    return;
  }
  history.forEach((entry) => {
    const li = document.createElement('li');
    li.className = 'history-item';
    const summary =
      entry.aborted
        ? `Interrompido: ${entry.okCount} ok, ${entry.failCount} com erro`
        : `${entry.okCount} ok, ${entry.failCount} com erro`;
    const dateDisplay = formatDateForDisplay(entry.dateStr) + ' às ' + (entry.timeStr || '');
    li.innerHTML =
      '<div class="history-item-header" data-id="' +
      entry.id +
      '">' +
      '<span class="summary">' +
      escapeHtml(dateDisplay) +
      '</span>' +
      '<span class="meta">' +
      escapeHtml(summary) +
      '</span>' +
      '</div>' +
      '<div class="history-item-body" id="history-body-' +
      entry.id +
      '" style="display:none">' +
      '<div class="log">' +
      renderExecutionLog(entry.results) +
      '</div>' +
      '</div>';
    historyListEl.appendChild(li);
    const header = li.querySelector('.history-item-header');
    const body = li.querySelector('.history-item-body');
    header.addEventListener('click', () => {
      const isHidden = body.style.display === 'none';
      document.querySelectorAll('.history-item-body').forEach((b) => (b.style.display = 'none'));
      body.style.display = isHidden ? 'block' : 'none';
    });
  });
}

tabInicio.addEventListener('click', () => {
  tabInicio.classList.add('active');
  tabHistorico.classList.remove('active');
  panelInicio.classList.add('active');
  panelHistorico.classList.remove('active');
});

tabHistorico.addEventListener('click', async () => {
  tabHistorico.classList.add('active');
  tabInicio.classList.remove('active');
  panelHistorico.classList.add('active');
  panelInicio.classList.remove('active');
  const history = await window.datago.getExecutionHistory();
  renderHistoryList(history);
});

window.datago.onPullStart((data) => {
  pullInProgress = true;
  abortPullBtn.disabled = false;
  pullLogEl.innerHTML = '';
  appendLog(escapeHtml(`Iniciando pull em ${data.total} repositório(s)…`));
});

window.datago.onPullProgress((report) => {
  if (report.event === 'aborted') {
    appendLog(escapeHtml('Pull abortado pelo usuário.'), 'fail');
    return;
  }
  if (report.event === 'start') {
    appendLog(escapeHtml(`▶ ${report.name}`), 'log-start');
    return;
  }
  if (report.event === 'end') {
    if (report.ok) {
      let line = '  OK';
      if (report.stdout) line += ' — ' + report.stdout.split('\n').slice(0, 3).join(' ');
      appendLog(escapeHtml(line), 'log-ok');
      if (report.stderr) appendLog(escapeHtml('    stderr: ' + report.stderr.slice(0, 300)), 'log-stderr');
    } else {
      appendLog(escapeHtml('  ERRO: ' + (report.error || report.stderr || '').slice(0, 400)), 'fail');
      if (report.stderr) appendLog(escapeHtml('    ' + report.stderr.slice(0, 300)), 'fail');
    }
  }
});

window.datago.onPullResult(async (data) => {
  pullInProgress = false;
  abortPullBtn.disabled = true;
  renderPullResult(data);
  if (panelHistorico.classList.contains('active')) {
    const history = await window.datago.getExecutionHistory();
    renderHistoryList(history);
  }
});

loadSettings();
