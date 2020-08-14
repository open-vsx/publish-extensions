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
const readFile = util.promisify(fs.readFile);
const writeFile = util.promisify(fs.writeFile);

const dontUpgrade = [
  'felixfbecker.php-debug', // https://github.com/open-vsx/publish-extensions/issues/4
  'felixfbecker.php-intellisense', // https://github.com/open-vsx/publish-extensions/issues/4
  'Luxcium.pop-n-lock-theme-vscode', // Error: Open VSX already has a more recent version of Luxcium.pop-n-lock-theme-vscode: 3.28.5 > 3.28.0
  'alefragnani.Bookmarks', // https://github.com/alefragnani/vscode-bookmarks/issues/315
  'alefragnani.project-manager', // https://github.com/alefragnani/vscode-bookmarks/issues/315
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
   *        download?: string
   *    }[]
   * }}
   */
  const { extensions } = JSON.parse(await readFile('./extensions.json', 'utf-8'));
  const extensionsToUpgrade = extensions.filter(e => !dontUpgrade.includes(e.id) && !!e.version && !e.download);
  const extensionsToNotUpgrade = extensions.filter(e => !extensionsToUpgrade.map(e => e.id).includes(e.id));

  fs.renameSync('./extensions.json', './extensions.json.old');
  try {
    await writeFile('./extensions.json', JSON.stringify({ extensions: extensionsToNotUpgrade }, null, 2) + '\n', 'utf-8');

    for (const extension of extensionsToUpgrade) {
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
      await exec(command);
    }

    // One last pass to clean up results with a few helpful heuristics.
    const { extensions: upgradedExtensions } = JSON.parse(await readFile('./extensions.json', 'utf-8'));
    for (const upgradedExtension of upgradedExtensions) {
        const originalExtension = extensionsToUpgrade.find(extension => extension.id === upgradedExtension.id);
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
