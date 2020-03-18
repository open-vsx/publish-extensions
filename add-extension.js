/********************************************************************************
 * Copyright (c) 2020 TypeFox and others
 *
 * This program and the accompanying materials are made available under the
 * terms of the Eclipse Public License v. 2.0 which is available at
 * http://www.eclipse.org/legal/epl-2.0.
 *
 * SPDX-License-Identifier: EPL-2.0
 ********************************************************************************/

const fs = require('fs');
const path = require('path');
const util = require('util');
const exec = require('./lib/exec');
const readFile = util.promisify(fs.readFile);
const writeFile = util.promisify(fs.writeFile);

(async () => {
  const argv = process.argv.slice(2);
  const { extensions } = JSON.parse(await readFile('./extensions.json', 'utf-8'));

  if (argv.length !== 1) {
    console.log('Usage: node add-extension [REPOSITORY]');
    process.exit();
  }

  const repository = argv[0];
  const existing = extensions.find(extension => extension.repository.toLowerCase() === repository.toLowerCase());
  if (existing) {
    console.log(`[SKIPPED] Repository already in extensions.json: ${JSON.stringify(existing, null, 2)}`);
    return;
  }

  try {
    if (!new URL(repository)) {
      throw new Error(`Invalid repository URL: ${repository}`);
    }

    // Clone the repository to determine the extension's latest version.
    await exec(`git clone ${repository} /tmp/repository`);

    // Locate and parse package.json.
    const { stdout: files } = await exec('ls package.json 2>/dev/null || git ls-files | grep package\\.json', { cwd: '/tmp/repository' });
    if (!files.trim()) {
      throw new Error(`No package.json found in repository!`);
    }
    const locations = files.trim().split('\n');
    if (locations.length > 1) {
      console.warn(`[WARNING] Multiple package.json found in repository, arbitrarily using the first one:\n> ${locations[0]}\n${locations.slice(1).map(l => '  ' + l).join('\n')}`);
    }
    const package = JSON.parse(await readFile(path.join('/tmp/repository', locations[0]), 'utf-8'));
    ['publisher', 'name', 'version'].forEach(key => {
      if (!(key in package)) {
        throw new Error(`Expected "${key}" in ${locations[0]}: ${JSON.stringify(package, null, 2)}`);
      }
    });

    // Add extension to the list.
    const extension = { id: `${package.publisher}.${package.name}`, version: package.version, repository };
    const location = path.dirname(locations[0]);
    if (location !== '.') {
      extension.location = location;
    }
    extensions.push(extension);

    // Sort extensions alphabetically by ID.
    extensions.sort((a, b) => {
      if (b.id > a.id) return -1;
      if (b.id < a.id) return 1;
      return 0;
    });

    // Save new extensions list.
    await writeFile('./extensions.json', JSON.stringify({ extensions }, null, 2), 'utf-8');
    console.log(`[OK] Succesfully added new extension: ${JSON.stringify(extension, null, 2)}`);
  } catch (error) {
    console.error(`[FAIL] Could not add ${repository}!`);
    console.error(error);
    process.exitCode = -1;
  } finally {
    await exec('rm -rf /tmp/repository');
  }
})();
