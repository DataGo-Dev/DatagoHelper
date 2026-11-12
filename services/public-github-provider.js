/**
 * Provider de atualização que usa a API pública do GitHub (sem token).
 * Evita o feed releases.atom que retorna 404; usa GET /repos/:owner/:repo/releases/latest
 * e browser_download_url dos assets para download sem autenticação.
 */

const path = require('path');
const { URL } = require('url');
const yaml = require('js-yaml');
const { CancellationToken, newError } = require('builder-util-runtime');

// Acesso aos helpers do electron-updater (não exportados no pacote principal)
const { Provider, getFileList } = require('electron-updater/out/providers/Provider');
const { getChannelFilename } = require('electron-updater/out/util');

const API_BASE = 'https://api.github.com';
const USER_AGENT = 'DatagoHelper-Updater (https://github.com/DataGo-Dev/DatagoHelper)';

class PublicGitHubProvider extends Provider {
  constructor(options, updater, runtimeOptions) {
    super(runtimeOptions);
    this.options = options;
    this.updater = updater;
  }

  getDefaultChannelName() {
    return this.getCustomChannelName('latest');
  }

  getCustomChannelName(channel) {
    const prefix = this.runtimeOptions.platform === 'darwin' ? '-mac' : '';
    return `${channel}${prefix}`;
  }

  async getLatestVersion() {
    const cancellationToken = new CancellationToken();
    const channelFile = getChannelFilename(this.getDefaultChannelName());
    const release = await this.fetchLatestRelease(cancellationToken);
    const asset = release.assets.find((a) => a.name === channelFile);
    if (!asset) {
      throw newError(
        `Cannot find ${channelFile} in the release ${release.html_url || release.tag_name}. ` +
          'Anexe o arquivo ao Release no GitHub.',
        'ERR_UPDATER_CHANNEL_FILE_NOT_FOUND'
      );
    }
    const downloadUrl = asset.browser_download_url;
    let rawYaml;
    try {
      rawYaml = await this.httpRequest(
        new URL(downloadUrl),
        { accept: 'application/octet-stream', 'User-Agent': USER_AGENT },
        cancellationToken
      );
    } catch (e) {
      throw newError(
        `Cannot download ${channelFile} (${downloadUrl}): ${e.message || e}`,
        'ERR_UPDATER_CHANNEL_FILE_NOT_FOUND'
      );
    }
    let result;
    try {
      result = yaml.load(rawYaml);
    } catch (e) {
      throw newError(
        `Cannot parse ${channelFile}: ${e.message || e}`,
        'ERR_UPDATER_INVALID_UPDATE_INFO'
      );
    }
    // Para resolveFiles: usar browser_download_url para download sem token
    result.assets = release.assets.map((a) => ({
      ...a,
      url: a.browser_download_url,
    }));
    return result;
  }

  async fetchLatestRelease(cancellationToken) {
    const { owner, repo } = this.options;
    const headers = {
      accept: 'application/vnd.github.v3+json',
      'User-Agent': USER_AGENT,
    };
    const urlLatest = `${API_BASE}/repos/${owner}/${repo}/releases/latest`;
    let body;
    try {
      body = await this.httpRequest(new URL(urlLatest), headers, cancellationToken);
      return JSON.parse(body);
    } catch (e1) {
      const code = (e1 && (e1.statusCode ?? e1.status)) || 0;
      if (code !== 404) throw e1;
      const urlList = `${API_BASE}/repos/${owner}/${repo}/releases`;
      try {
        body = await this.httpRequest(new URL(urlList), headers, cancellationToken);
        const list = JSON.parse(body);
        const latest = Array.isArray(list) && list.find((r) => !r.draft && !r.prerelease);
        if (latest) return latest;
      } catch (e2) {
        throw newError(
          `Unable to find latest version on GitHub (${urlLatest}). ` +
            'Ensure a production release exists and is published (not draft). ' +
            (e1.message || String(e1)),
          'ERR_UPDATER_LATEST_VERSION_NOT_FOUND'
        );
      }
      throw newError(
        `No production release found (${urlList}). Publish a release that is not draft and not pre-release. ` +
          (e1.message || String(e1)),
        'ERR_UPDATER_LATEST_VERSION_NOT_FOUND'
      );
    }
  }

  resolveFiles(updateInfo) {
    return getFileList(updateInfo).map((fileInfo) => {
      const name = path.posix.basename(fileInfo.url).replace(/ /g, '-');
      const asset = updateInfo.assets.find((a) => a != null && a.name === name);
      if (!asset) {
        throw newError(
          `Cannot find asset "${name}" in release.`,
          'ERR_UPDATER_ASSET_NOT_FOUND'
        );
      }
      return {
        url: new URL(asset.url),
        info: fileInfo,
      };
    });
  }
}

module.exports = { PublicGitHubProvider };
