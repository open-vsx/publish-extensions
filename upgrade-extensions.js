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
const https = require('https');
const util = require('util');
const exec = require('./lib/exec');
const readFile = util.promisify(fs.readFile);
const writeFile = util.promisify(fs.writeFile);

const dontUpgrade = [
  'alefragnani.Bookmarks', // https://github.com/alefragnani/vscode-bookmarks/issues/315
  'alefragnani.project-manager', // https://github.com/alefragnani/vscode-bookmarks/issues/315
  'ms-vscode.js-debug', // Version on master (1.52.1) is older than the latest release (1.52.2)
];

(async () => {
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
   *        download?: string
   *    }[]
   * }}
   */
  const { extensions } = JSON.parse(await readFile('./extensions.json', 'utf-8'));
  const extensionRepositoriesToUpgrade = extensions.filter(e => !dontUpgrade.includes(e.id) && !!e.version && !e.download);
  const extensionDownloadsToUpgrade = extensions.filter(e => !dontUpgrade.includes(e.id) && /https:\/\/github.com\/.*\/releases\/download\//.test(e.download));
  const extensionsToNotUpgrade = extensions.filter(e => !extensionRepositoriesToUpgrade.concat(extensionDownloadsToUpgrade).map(e => e.id).includes(e.id));

  fs.renameSync('./extensions.json', './extensions.json.old');
  try {
    await writeFile('./extensions.json', JSON.stringify({ extensions: extensionsToNotUpgrade }, null, 2) + '\n', 'utf-8');

    for (const extension of extensionRepositoriesToUpgrade) {
      let command = 'node add-extension ' + extension.repository;
      if (extension.checkout) {
          // Since we're upgrading, don't use the currently pinned Git branch, tag, or commit. Use the default Git branch instead.
          command += ' --checkout';
      }
      if (extension.location) {
          command += ' --location=' + JSON.stringify(extension.location);
      }
      if (extension.prepublish) {
          command += ' --prepublish=' + JSON.stringify(extension.prepublish);
      }
      if (extension.extensionFile) {
        command += ' --extensionFile=' + JSON.stringify(extension.extensionFile);
      }
      await exec(command);
    }

    for (const extension of extensionDownloadsToUpgrade) {
        // Scrape the latest GitHub releases to check for updates.
        const releasesUrl = extension.download.replace(/\/releases\/download\/.*$/, '/releases');
        console.log(`Scraping ${releasesUrl} to check for updates...`);
        const releases = await get(releasesUrl);
        const latest = releases.match(/\/releases\/download\/[-._a-zA-Z0-9\/%]*\.vsix/g).filter(release => !/(nightly|-rc|-alpha|-dev|-next|-[iI]nsider|-beta)/.test(release)).shift();
        await exec('node add-extension --download=' + (latest ? extension.download.replace(/\/releases\/download\/.*$/, latest) : extension.download));
    }

    // One last pass to clean up results with a few helpful heuristics.
    const { extensions: upgradedExtensions } = JSON.parse(await readFile('./extensions.json', 'utf-8'));
    for (const upgradedExtension of upgradedExtensions) {
        const originalExtension = extensionRepositoriesToUpgrade.find(extension => extension.id === upgradedExtension.id);
        if (!originalExtension) {
            // This extension likely wasn't actually upgraded, leave it as is.
            continue;
        }
        if (upgradedExtension.version && upgradedExtension.version !== originalExtension.version && !upgradedExtension.checkout) {
            // If "version" was bumped, but we're publishing from the default branch, it's probably better to just unpin the version.
            delete upgradedExtension.version;
        }
        if (upgradedExtension.checkout !== originalExtension.checkout && upgradedExtension.version === originalExtension.version) {
            // If "checkout" was modified, but "version" stayed the same, the change of "checkout" is unhelpful. Reset it.
            upgradedExtension.checkout = originalExtension.checkout;
        }
    }
    await writeFile('./extensions.json', JSON.stringify({ extensions: upgradedExtensions }, null, 2) + '\n', 'utf-8');
  } catch (error) {
    console.error(`[FAIL] Could not upgrade extensions.json!`);
    console.error(error);
    process.exitCode = -1;
    fs.renameSync('./extensions.json.old', './extensions.json');
  }
})();

function get(url) {
  return new Promise((resolve, reject) => {
    https.get(url, res => {
      if (res.statusCode >= 400) {
        reject(new Error(`Couldn't get ${url} - Response status: ${res.statusCode}`));
        return;
      }
      let body = '';
      res.on('data', chunk => { body += chunk; });
      res.on('error', error => { reject(error); });
      res.on('end', () => { resolve(body); });
    }).on('error', error => {
      reject(error);
    });
  });
}
