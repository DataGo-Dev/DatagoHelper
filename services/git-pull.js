/**
 * Serviço de descoberta de repositórios Git e execução de `git pull`.
 *
 * - Repositórios: pasta informada pelo usuário
 * - Opcional: pasta padrão do GitHub Desktop (Documents/GitHub no Mac, Documents\GitHub no Windows)
 */

const fs = require('fs');
const path = require('path');
const { execFile } = require('child_process');
const { promisify } = require('util');

const execFileAsync = promisify(execFile);

const MAX_DEPTH = 3;
const GIT_OPTS = { timeout: 120000, maxBuffer: 2 * 1024 * 1024 };

function git(cwd, args) {
  return execFileAsync('git', args, { cwd, ...GIT_OPTS });
}

/**
 * Retorna true se existir alguma alteração no working tree (modificados, staged, untracked).
 */
async function hasLocalChanges(repoPath) {
  try {
    const { stdout } = await git(repoPath, ['status', '--porcelain']);
    return (stdout || '').trim().length > 0;
  } catch {
    return false;
  }
}

/**
 * Retorna o caminho da pasta padrão do GitHub Desktop (onde muitos usuários têm os clones).
 * Mac: ~/Documents/GitHub
 * Windows: %USERPROFILE%\Documents\GitHub
 */
function getGitHubDesktopDefaultFolder() {
  const home = process.platform === 'win32' ? process.env.USERPROFILE : process.env.HOME;
  if (!home) return null;
  return path.join(home, 'Documents', 'GitHub');
}

/**
 * Verifica se o diretório `dirPath` é a raiz de um repositório Git
 * (tem .git como pasta ou arquivo, no caso de worktrees).
 */
function isGitRepo(dirPath) {
  try {
    const gitPath = path.join(dirPath, '.git');
    const stat = fs.statSync(gitPath);
    return stat.isDirectory() || stat.isFile();
  } catch {
    return false;
  }
}

/**
 * Coleta caminhos de todos os repositórios dentro de `rootDir`, até profundidade MAX_DEPTH.
 * Evita varrer o disco inteiro.
 */
function findReposInDir(rootDir, depth = 0) {
  const repos = [];
  if (depth > MAX_DEPTH) return repos;

  let entries;
  try {
    entries = fs.readdirSync(rootDir, { withFileTypes: true });
  } catch {
    return repos;
  }

  for (const ent of entries) {
    if (!ent.isDirectory()) continue;
    const fullPath = path.join(rootDir, ent.name);
    if (isGitRepo(fullPath)) {
      repos.push(fullPath);
    } else {
      repos.push(...findReposInDir(fullPath, depth + 1));
    }
  }
  return repos;
}

/**
 * Retorna lista de caminhos absolutos das raízes dos repositórios.
 * @param {string} reposFolder - Pasta informada pelo usuário (pode ser vazia)
 * @param {boolean} includeGitHubDesktopFolder - Incluir Documents/GitHub
 */
async function getReposPaths(reposFolder, includeGitHubDesktopFolder) {
  const paths = [];
  const seen = new Set();

  if (reposFolder && fs.existsSync(reposFolder)) {
    const normalized = path.resolve(reposFolder);
    for (const p of findReposInDir(normalized)) {
      const resolved = path.resolve(p);
      if (!seen.has(resolved)) {
        seen.add(resolved);
        paths.push(resolved);
      }
    }
  }

  if (includeGitHubDesktopFolder) {
    const defaultFolder = getGitHubDesktopDefaultFolder();
    if (defaultFolder && fs.existsSync(defaultFolder)) {
      const normalized = path.resolve(defaultFolder);
      for (const p of findReposInDir(normalized)) {
        const resolved = path.resolve(p);
        if (!seen.has(resolved)) {
          seen.add(resolved);
          paths.push(resolved);
        }
      }
    }
  }

  return paths;
}

/**
 * Executa `git pull` em cada repositório.
 * Retorna resumo e detalhes por repositório.
 * @param {string[]} repoPaths - Caminhos das raízes dos repositórios
 * @param {(report: { event: 'start'|'end'|'aborted', name?: string, path?: string, ok?: boolean, stdout?: string, stderr?: string, error?: string }) => void} [onProgress] - Chamado a cada início/fim de pull para log em tempo real
 * @param {() => boolean} [shouldAbort] - Se retornar true, interrompe após o repositório atual (antes do próximo)
 */
async function runPullInRepos(repoPaths, onProgress, shouldAbort) {
  const results = [];
  let aborted = false;

  for (const repoPath of repoPaths) {
    if (shouldAbort && shouldAbort()) {
      aborted = true;
      if (onProgress) onProgress({ event: 'aborted' });
      break;
    }

    const name = path.basename(repoPath);
    if (onProgress) onProgress({ event: 'start', name, path: repoPath });

    let didStash = false;

    try {
      // 1) Stash só se existir alteração (inclui untracked com -u, como o GitHub Desktop)
      const hasChanges = await hasLocalChanges(repoPath);
      if (hasChanges) {
        try {
          await git(repoPath, ['stash', 'push', '-u', '-m', 'datago-helper']);
          didStash = true;
        } catch (_) {
          didStash = false;
        }
      }

      // 2) Pull
      const { stdout, stderr } = await git(repoPath, ['pull']);
      const out = (stdout || '').trim();
      const err = (stderr || '').trim();
      let fullOut = [didStash ? '(stash feito antes do pull)' : null, out].filter(Boolean).join('\n');

      // 3) Restaurar stash se foi feito
      if (didStash) {
        try {
          const popRes = await git(repoPath, ['stash', 'pop']);
          if (popRes.stderr) fullOut += '\n' + (popRes.stderr || '').trim();
        } catch (popErr) {
          const stashPopErr = (popErr.stderr || popErr.message || String(popErr)).trim();
          fullOut += '\n(stash pop falhou: ' + stashPopErr + ')';
        }
      }

      results.push({
        path: repoPath,
        name,
        ok: true,
        stdout: fullOut,
        stderr: err,
      });
      if (onProgress) {
        onProgress({ event: 'end', name, path: repoPath, ok: true, stdout: fullOut, stderr: err });
      }
    } catch (e) {
      const err = e;
      const out = (err.stdout || '').trim();
      const errMsg = (err.stderr || err.message || String(err)).trim();
      if (didStash) {
        try {
          await git(repoPath, ['stash', 'pop']);
        } catch (_) {
          /* tenta restaurar stash mesmo após falha no pull */
        }
      }
      results.push({
        path: repoPath,
        name,
        ok: false,
        error: err.message || String(err),
        stdout: out,
        stderr: (err.stderr || '').trim(),
      });
      if (onProgress) {
        onProgress({ event: 'end', name, path: repoPath, ok: false, stdout: out, stderr: (err.stderr || '').trim(), error: errMsg });
      }
    }
  }

  const okCount = results.filter((r) => r.ok).length;
  const failCount = results.length - okCount;

  return {
    ok: failCount === 0 && !aborted,
    total: results.length,
    okCount,
    failCount,
    results,
    aborted,
    message:
      aborted
        ? 'Pull abortado pelo usuário.'
        : results.length === 0
          ? 'Nenhum repositório encontrado.'
          : `Concluído: ${okCount} ok, ${failCount} com erro.`,
  };
}

module.exports = {
  getReposPaths,
  runPullInRepos,
  getGitHubDesktopDefaultFolder,
};
