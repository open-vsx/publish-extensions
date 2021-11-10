/********************************************************************************
 * Copyright (c) 2020 TypeFox and others
 *
 * This program and the accompanying materials are made available under the
 * terms of the Eclipse Public License v. 2.0 which is available at
 * http://www.eclipse.org/legal/epl-2.0.
 *
 * SPDX-License-Identifier: EPL-2.0
 ********************************************************************************/

// @ts-check
const fs = require('fs');
const cp = require('child_process');
const { getPublicGalleryAPI } = require('vsce/out/util');
const { PublicGalleryAPI } = require('vsce/out/publicgalleryapi');
const { ExtensionQueryFlags, PublishedExtension } = require('azure-devops-node-api/interfaces/GalleryInterfaces');
const semver = require('semver');
const getReleases = require('./lib/getReleases');
const exec = require('./lib/exec');

const msGalleryApi = getPublicGalleryAPI();
msGalleryApi.client['_allowRetries'] = true;
msGalleryApi.client['_maxRetries'] = 5;

const openGalleryApi = new PublicGalleryAPI('https://open-vsx.org/vscode', '3.0-preview.1');
openGalleryApi.client['_allowRetries'] = true;
openGalleryApi.client['_maxRetries'] = 5;
openGalleryApi.post = (url, data, additionalHeaders) =>
  openGalleryApi.client.post(`${openGalleryApi.baseUrl}${url}`, data, additionalHeaders);

const flags = [
  ExtensionQueryFlags.IncludeStatistics,
  ExtensionQueryFlags.IncludeVersions,
];

(async () => {
  /**
   * @type {string[] | undefined}
   */
  let toVerify = undefined;
  if (process.env.FAILED_EXTENSIONS) {
    toVerify = process.env.FAILED_EXTENSIONS.split(',').map(s => s.trim());
  }

  /**
 * @type {{
   *    extensions: {
   *        id: string,
   *        repository: string,
   *        version?: string,
   *        checkout?: string,
   *        location?: string,
   *        prepublish?: string,
   *        extensionFile?: string,
   *        download?: string,
   *        timeout?: number;
   *    }[]
   * }}
   */
  const { extensions } = JSON.parse(await fs.promises.readFile('./extensions.json', 'utf-8'));

  // Also install extensions' devDependencies when using `npm install` or `yarn install`.
  process.env.NODE_ENV = 'development';

  /** @type{import('./types').PublishStat}*/
  const stat = {
    upToDate: {},
    outdated: {},
    unstable: {},
    notInOpen: {},
    notInMS: [],

    msPublished: {},
    hitMiss: {},
    failed: []
  }
  const msPublishers = new Set(['ms-python', 'ms-toolsai', 'ms-vscode', 'dbaeumer', 'GitHub', 'Tyriar', 'ms-azuretools', 'msjsdiag', 'ms-mssql', 'vscjava', 'ms-vsts']);
  const monthAgo = new Date();
  monthAgo.setMonth(monthAgo.getMonth() - 1);
  for (const extension of extensions) {
    if (toVerify && toVerify.indexOf(extension.id) === -1) {
      continue;
    }
    let timeoutDelay = Number(extension.timeout);
    if (!Number.isInteger(timeoutDelay)) {
      timeoutDelay = 5;
    }
    try {
      /** @type {[PromiseSettledResult<PublishedExtension | undefined>]} */
      const [msExtension] = await Promise.allSettled([msGalleryApi.getExtension(extension.id, flags)]);
      let msVersion;
      /** @type{Date | undefined} */
      let msLastUpdated;
      let msInstalls;
      let msPublisher;
      if (msExtension.status === 'fulfilled') {
        msVersion = msExtension.value?.versions[0]?.version;
        msLastUpdated = msExtension.value?.versions[0]?.lastUpdated;
        msInstalls = msExtension.value?.statistics?.find(s => s.statisticName === 'install')?.value;
        msPublisher = msExtension.value?.publisher.publisherName;
      }
      if (msPublishers.has(msPublisher)) {
        stat.msPublished[extension.id] = { msInstalls, msVersion };
      }

      async function updateStat() {
        /** @type {[PromiseSettledResult<PublishedExtension | undefined>]} */
        const [openExtension] = await Promise.allSettled([openGalleryApi.getExtension(extension.id, flags)]);
        let openVersion;
        let openLastUpdated;
        if (openExtension.status === 'fulfilled') {
          openVersion = openExtension.value?.versions[0]?.version;
          openLastUpdated = openExtension.value?.versions[0]?.lastUpdated;
        }
        const daysInBetween = openLastUpdated && msLastUpdated ? ((openLastUpdated.getTime() - msLastUpdated.getTime()) / (1000 * 3600 * 24)) : undefined;
        const extStat = { msInstalls, msVersion, openVersion, daysInBetween };

        const i = stat.notInMS.indexOf(extension.id);
        if (i !== -1) {
          stat.notInMS.splice(i, 1);
        }
        delete stat.notInOpen[extension.id];
        delete stat.upToDate[extension.id];
        delete stat.outdated[extension.id];
        delete stat.unstable[extension.id];
        delete stat.hitMiss[extension.id];

        if (!msVersion) {
          stat.notInMS.push(extension.id);
        } else if (!openVersion) {
          stat.notInOpen[extension.id] = extStat;
        } else if (semver.eq(msVersion, openVersion)) {
          stat.upToDate[extension.id] = extStat;
        } else if (semver.gt(msVersion, openVersion)) {
          stat.outdated[extension.id] = extStat;
        } else if (semver.lt(msVersion, openVersion)) {
          stat.unstable[extension.id] = extStat;
        }

        if (msVersion && msLastUpdated && monthAgo.getTime() <= msLastUpdated.getTime()) {
          stat.hitMiss[extension.id] = {
            ...extStat,
            hit: typeof daysInBetween === 'number' && 0 < daysInBetween && daysInBetween <= 2
          }
        }
      }

      async function upgradeExtension() {
        try {
          // Fetch the latest GitHub releases to check for updates.

          const repository = extension.download.replace(/\/releases\/download\/.*$/, '');
          const latest = await getReleases.findLatestVSIXRelease(repository, extension.version, msVersion || undefined);
          await exec('node add-extension --download=' + (latest || extension.download));
        } catch (e) {
          console.error(`${extension.id}: failed to upgrade downloads:`, e);
          stat.failed.push(extension.id);
          try {
            await exec('node add-extension --download=' + (extension.download));
          } catch (e) { }
        }

      }

      await upgradeExtension();

      await updateStat();

      if (stat.upToDate[extension.id] || stat.unstable[extension.id]) {
        continue;
      }

      let timeout;
      await new Promise((resolve, reject) => {
        const p = cp.spawn(process.execPath, ['publish-extension.js', JSON.stringify(extension)], {
          stdio: ['ignore', 'inherit', 'inherit'],
          cwd: process.cwd(),
          env: process.env
        })
        p.on('error', reject);
        p.on('exit', code => {
          if (code) {
            return reject(new Error('failed with exit status: ' + code));
          }
          resolve();
        });
        timeout = setTimeout(() => {
          try {
            p.kill('SIGKILL');
          } catch { }
          reject(new Error(`timeout after ${timeoutDelay} mins`));
        }, timeoutDelay * 60 * 1000);
      });
      if (timeout !== undefined) {
        clearTimeout(timeout);
      }

      await updateStat();
    } catch (error) {
      stat.failed.push(extension.id);
      console.error(`[FAIL] Could not process extension: ${JSON.stringify(extension, null, 2)}`);
      console.error(error);
    }
  }

  await fs.promises.writeFile("/tmp/stat.json", JSON.stringify(stat), { encoding: 'utf8' });
})();
