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
const resolveExtension = require('./lib/resolveExtension').resolveExtension;
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
  if (process.env.EXTENSIONS) {
    toVerify = process.env.EXTENSIONS.split(',').map(s => s.trim());
  }
  /**
   * @type {Readonly<import('./types').Extensions>}
   */
  const extensions = JSON.parse(await fs.promises.readFile('./extensions.json', 'utf-8'));

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
  for (const id in extensions) {
    if (id === '$schema') {
      continue;
    }
    if (toVerify && toVerify.indexOf(id) === -1) {
      continue;
    }
    const extension = Object.freeze({ id, ...extensions[id] });
    /** @type {import('./types').PublishContext} */
    const context = {};
    let timeoutDelay = Number(extension.timeout);
    if (!Number.isInteger(timeoutDelay)) {
      timeoutDelay = 5;
    }
    try {
      /** @type {[PromiseSettledResult<PublishedExtension | undefined>]} */
      let [msExtension] = await Promise.allSettled([msGalleryApi.getExtension(extension.id, flags)]);
      if (msExtension.status === 'fulfilled') {
        context.msVersion = msExtension.value?.versions[0]?.version;
        context.msLastUpdated = msExtension.value?.versions[0]?.lastUpdated;
        context.msInstalls = msExtension.value?.statistics?.find(s => s.statisticName === 'install')?.value;
        context.msPublisher = msExtension.value?.publisher.publisherName;
      }
      if (msPublishers.has(context.msPublisher)) {
        stat.msPublished[extension.id] = { msInstalls: context.msInstalls, msVersion: context.msVersion };
      }

      async function updateStat() {
        /** @type {[PromiseSettledResult<PublishedExtension | undefined>]} */
        const [ovsxExtension] = await Promise.allSettled([openGalleryApi.getExtension(extension.id, flags)]);
        if (ovsxExtension.status === 'fulfilled') {
          context.ovsxVersion = ovsxExtension.value?.versions[0]?.version;
          context.ovsxLastUpdated = ovsxExtension.value?.versions[0]?.lastUpdated;
        }
        const daysInBetween = context.ovsxLastUpdated && context.msLastUpdated ? ((context.ovsxLastUpdated.getTime() - context.msLastUpdated.getTime()) / (1000 * 3600 * 24)) : undefined;
        const extStat = { msInstalls: context.msInstalls, msVersion: context.msVersion, openVersion: context.ovsxVersion, daysInBetween };

        const i = stat.notInMS.indexOf(extension.id);
        if (i !== -1) {
          stat.notInMS.splice(i, 1);
        }
        delete stat.notInOpen[extension.id];
        delete stat.upToDate[extension.id];
        delete stat.outdated[extension.id];
        delete stat.unstable[extension.id];
        delete stat.hitMiss[extension.id];

        if (!context.msVersion) {
          stat.notInMS.push(extension.id);
        } else if (!context.ovsxVersion) {
          stat.notInOpen[extension.id] = extStat;
        } else if (semver.eq(context.msVersion, context.ovsxVersion)) {
          stat.upToDate[extension.id] = extStat;
        } else if (semver.gt(context.msVersion, context.ovsxVersion)) {
          stat.outdated[extension.id] = extStat;
        } else if (semver.lt(context.msVersion, context.ovsxVersion)) {
          stat.unstable[extension.id] = extStat;
        }

        if (context.msVersion && context.msLastUpdated && monthAgo.getTime() <= context.msLastUpdated.getTime()) {
          stat.hitMiss[extension.id] = {
            ...extStat,
            hit: typeof daysInBetween === 'number' && 0 < daysInBetween && daysInBetween <= 2
          }
        }
      }

      await updateStat();
      if (process.env.FORCE !== 'true') {
        if (stat.upToDate[extension.id]) {
          console.log(`${extension.id}: skipping, since up-to-date`);
          continue;
        }
        if (stat.unstable[extension.id]) {
          console.log(`${extension.id}: skipping, since version in Open VSX is never than in MS marketplace`);
          continue;
        }
      }

      if (!extension.repository) {
        throw `${extension.id}: repository not specified`;
      }

      await exec('rm -rf /tmp/repository /tmp/download', { quiet: true });

      const resolved = await resolveExtension(extension, context.msVersion && {
        version: context.msVersion,
        lastUpdated: context.msLastUpdated
      });
      context.version = resolved?.version;

      if (process.env.FORCE !== 'true' && resolved?.ref?.latest && context.version === context.ovsxVersion) {
        console.log(`${extension.id}: skipping, since very latest commit already published to Open VSX`);
        stat.upToDate[extension.id] = stat.outdated[extension.id];
        delete stat.outdated[extension.id];
        continue;
      }

      // TODO(ak) incorporate into reporting
      if (resolved?.release) {
        console.log(`${extension.id}: resolved ${resolved.release.link} from release`);
        context.file = resolved.release.file;
      } else if (resolved?.ref?.releaseTag) {
        console.log(`${extension.id}: resolved ${resolved.ref.releaseTag} from release tag`);
        context.repo = resolved.ref.path;
        context.ref = resolved.ref.releaseTag;
      } else if (resolved?.ref?.tag) {
        console.log(`${extension.id}: resolved ${resolved.ref.tag} from tags`);
        context.repo = resolved.ref.path;
        context.ref = resolved.ref.tag;
      } else if (resolved?.ref?.latest) {
        if (context.msVersion) {
          // TODO(ak) report as not actively maintained
          console.log(`${extension.id}: resolved ${resolved.ref.latest} from the very latest commit, since it is not actively maintained`);
        } else {
          console.log(`${extension.id}: resolved ${resolved.ref.latest} from the very latest commit, since it is not published to MS marketplace`);
        }
        context.repo = resolved.ref.path;
        context.ref = resolved.ref.latest;
      } else if (resolved?.ref?.matchedLatest) {
        console.log(`${extension.id}: resolved ${resolved.ref.matchedLatest} from the very latest commit`);
        context.repo = resolved.ref.path;
        context.ref = resolved.ref.matchedLatest;
      } else if (resolved?.ref?.matched) {
        console.log(`${extension.id}: resolved ${resolved.ref.matched} from the latest commit on the last update date`);
        context.repo = resolved.ref.path;
        context.ref = resolved.ref.matched;
      } else {
        throw `${extension.id}: failed to resolve`;
      }

      if (process.env.SKIP_BUILD === 'true') {
        continue;
      }

      let timeout;
      await new Promise((resolve, reject) => {
        const p = cp.spawn(process.execPath, ['publish-extension.js', JSON.stringify({ extension, context })], {
          stdio: ['ignore', 'inherit', 'inherit'],
          cwd: process.cwd(),
          env: process.env
        });
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
      console.error(`[FAIL] Could not process extension: ${JSON.stringify({ extension, context }, null, 2)}`);
      console.error(error);
    }
  }

  await fs.promises.writeFile("/tmp/stat.json", JSON.stringify(stat), { encoding: 'utf8' });
  process.exit();
})();
