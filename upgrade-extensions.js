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
const exec = require('./lib/exec');
const gitHubScraper = require('./lib/github-scraper');
const readFile = util.promisify(fs.readFile);
const writeFile = util.promisify(fs.writeFile);

const dontUpgrade = [
  'alefragnani.Bookmarks', // https://github.com/alefragnani/vscode-bookmarks/issues/315
  'alefragnani.project-manager', // https://github.com/alefragnani/vscode-bookmarks/issues/315
  'ms-vscode.js-debug', // Version on master (1.52.1) is older than the latest release (1.52.2)
  'file-icons.file-icons', // Git submodule uses unsupported 'git@github.com' URL format
  'DotJoshJohnson.xml', // https://github.com/DotJoshJohnson/vscode-xml/issues/345
  'dracula-theme.theme-dracula', // https://github.com/dracula/visual-studio-code/issues/168
  'wingrunr21.vscode-ruby', // This script gets confused and switches to rebornix.Ruby .vsix release (same repo)
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
        const repository = extension.download.replace(/\/releases\/download\/.*$/, '');
        const latest = await gitHubScraper.findLatestVSIXRelease(repository);
        await exec('node add-extension --download=' + (latest || extension.download));
    }

    // One last pass to clean up results with a few helpful heuristics.
    const { extensions: upgradedExtensions } = JSON.parse(await readFile('./extensions.json', 'utf-8'));
    for (const upgradedExtension of upgradedExtensions) {
        const originalExtension = extensionRepositoriesToUpgrade.find(extension => extension.id === upgradedExtension.id);
        if (!originalExtension) {
            // This extension likely wasn't actually upgraded, leave it as is.
            continue;
        }
        if (upgradedExtension.version && upgradedExtension.version !== originalExtension.version && !upgradedExtension.checkout && !upgradedExtension.download) {
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
