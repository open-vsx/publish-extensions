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
const util = require('util');
const cp = require('child_process');
const { getPublicGalleryAPI } = require('vsce/out/util');
const { PublicGalleryAPI } = require('vsce/out/publicgalleryapi');
const { ExtensionQueryFlags, PublishedExtension } = require('azure-devops-node-api/interfaces/GalleryInterfaces');
const semver = require('semver');
const getReleases = require('./lib/getReleases');
const exec = require('./lib/exec');
const minimist = require('minimist');
const writeFile = util.promisify(fs.writeFile);

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

  const dontUpgrade = [
    'file-icons.file-icons', // Git submodule uses unsupported 'git@github.com' URL format
    'DotJoshJohnson.xml', // https://github.com/DotJoshJohnson/vscode-xml/issues/345
    'wingrunr21.vscode-ruby', // This script gets confused and switches to rebornix.Ruby .vsix release (same repo)
    'andreweinand.mock-debug', // https://github.com/open-vsx/publish-extensions/pull/274#issue-562452193
    'DigitalBrainstem.javascript-ejs-support', // https://github.com/Digitalbrainstem/ejs-grammar tagged 1.3.1 but hasn't had a new release tag in over year
    'ecmel.vscode-html-css', // https://github.com/ecmel/vscode-html-css/issues/213
    'ms-vscode.atom-keybindings', // https://github.com/microsoft/vscode-atom-keybindings/releases didn't have a release in 2 years
    'wmaurer.change-case', // https://github.com/wmaurer/vscode-change-case/releases didn't have a release in 6 years
    'jebbs.plantuml', // https://github.com/open-vsx/publish-extensions/pull/290/files#r576063404
    'ms-vscode.hexeditor', // https://github.com/open-vsx/publish-extensions/pull/290#discussion_r576063874
    'mtxr.sqltools', // https://github.com/open-vsx/publish-extensions/pull/290#discussion_r576067381
    'lextudio.restructuredtext', // https://github.com/open-vsx/publish-extensions/pull/317#discussion_r598852958
    'haskell.haskell', // https://github.com/open-vsx/publish-extensions/pull/317#discussion_r598852655
    'miguelsolorio.fluent-icons', // Latest release (0.0.1) is way behind latest tag (0.0.7)
    'eamodio.tsl-problem-matcher', // Latest release (0.0.4) was never published to https://github.com/eamodio/vscode-tsl-problem-matcher/releases
    'vscode-org-mode.org-mode', // https://github.com/vscode-org-mode/vscode-org-mode doesn't have releases or tags, so we've pinned the 1.0.0 commit
    'amazonwebservices.aws-toolkit-vscode', // Latest release in https://github.com/aws/aws-toolkit-vscode/releases is an experimental pre-release, causing this script to fail with "Error: Open VSX already has a more recent version of amazonwebservices.aws-toolkit-vscode: 1.27.0 > 1.27.0-6c4644db65c7"
    "johnsoncodehk.vscode-typescript-vue-plugin", // Failing in update build for missing license https://github.com/open-vsx/publish-extensions/runs/3849684249?check_suite_focus=true
    "johnsoncodehk.volar", // Failing in update build for missing license: https://github.com/open-vsx/publish-extensions/runs/3849684249?check_suite_focus=true
  ];

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
  fs.renameSync('./extensions.json', './extensions.json.old');

  const cliCommandFlags = minimist(process.argv.slice(2));

  const extensionRepositoriesToUpgrade = extensions.filter(e => (!cliCommandFlags.extension || e.id.includes(cliCommandFlags.extension)) && !dontUpgrade.includes(e.id) && !!e.version && !e.download);
  const extensionDownloadsToUpgrade = extensions.filter(e => (!cliCommandFlags.extension || e.id.includes(cliCommandFlags.extension)) && !dontUpgrade.includes(e.id) && /https:\/\/github.com\/.*\/releases\/download\//.test(e.download));
  const extensionsToNotUpgrade = extensions.filter(e => !extensionRepositoriesToUpgrade.concat(extensionDownloadsToUpgrade).map(e => e.id).includes(e.id));

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
  await writeFile('./extensions.json', JSON.stringify({ extensions: extensionsToNotUpgrade }, null, 2) + '\n', 'utf-8');

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

      async function updateStat(customExtension = extension) {
        /** @type {[PromiseSettledResult<PublishedExtension | undefined>]} */
        const [openExtension] = await Promise.allSettled([openGalleryApi.getExtension(customExtension.id, flags)]);
        let openVersion;
        let openLastUpdated;
        if (openExtension.status === 'fulfilled') {
          openVersion = openExtension.value?.versions[0]?.version;
          openLastUpdated = openExtension.value?.versions[0]?.lastUpdated;
        }
        const daysInBetween = openLastUpdated && msLastUpdated ? ((openLastUpdated.getTime() - msLastUpdated.getTime()) / (1000 * 3600 * 24)) : undefined;
        const extStat = { msInstalls, msVersion, openVersion, daysInBetween };

        const i = stat.notInMS.indexOf(customExtension.id);
        if (i !== -1) {
          stat.notInMS.splice(i, 1);
        }
        delete stat.notInOpen[customExtension.id];
        delete stat.upToDate[customExtension.id];
        delete stat.outdated[customExtension.id];
        delete stat.unstable[customExtension.id];
        delete stat.hitMiss[customExtension.id];

        if (!msVersion) {
          stat.notInMS.push(customExtension.id);
        } else if (!openVersion) {
          stat.notInOpen[customExtension.id] = extStat;
        } else if (semver.eq(msVersion, openVersion)) {
          stat.upToDate[customExtension.id] = extStat;
        } else if (semver.gt(msVersion, openVersion)) {
          stat.outdated[customExtension.id] = extStat;
        } else if (semver.lt(msVersion, openVersion)) {
          stat.unstable[customExtension.id] = extStat;
        }

        if (msVersion && msLastUpdated && monthAgo.getTime() <= msLastUpdated.getTime()) {
          stat.hitMiss[customExtension.id] = {
            ...extStat,
            hit: typeof daysInBetween === 'number' && 0 < daysInBetween && daysInBetween <= 2
          }
        }
      }

      async function upgradeExtensionDownload() {
        try {
          // Fetch the latest GitHub releases to check for updates.

          const repository = extension.download.replace(/\/releases\/download\/.*$/, '');
          const latest = await getReleases.findLatestVSIXRelease(repository, extension.version, msVersion || undefined);
          await exec('node add-extension --download=' + (latest || extension.download));
          return { id: extension.id, download: latest || extension.download, version: msVersion || extension.version };
        } catch (e) {
          console.error(`${extension.id}: failed to upgrade downloads:`, e);
          stat.failed.push(extension.id);
          try {
            await exec('node add-extension --download=' + (extension.download));
          } catch (e) { }
        }

      }

      if (extensionDownloadsToUpgrade.includes(extension)) {
        // @ts-ignore
        await updateStat((await upgradeExtensionDownload()));
      } else {
        continue;
      }

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
