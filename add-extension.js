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
const minimist = require('minimist');
const ovsx = require('ovsx');
const path = require('path');
const util = require('util');
const semver = require('semver');
const exec = require('./lib/exec');
const readFile = util.promisify(fs.readFile);
const writeFile = util.promisify(fs.writeFile);

(async () => {
  const argv = minimist(process.argv.slice(2));
  /** @type {{ extensions: { id: string, repository: string, version?: string, checkout?: string, location?: string, prepublish?: string }[] }} */
  const { extensions } = JSON.parse(await readFile('./extensions.json', 'utf-8'));
  const registry = new ovsx.Registry();

  if (argv._.length !== 1) {
    console.log('Usage: node add-extension [REPOSITORY]');
    process.exit();
  }

  const repository = argv._[0].replace(/\/*$/, '');
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
    /** @type {{ name: string, version: string, publisher: string }} */
    const package = JSON.parse(await readFile(path.join('/tmp/repository', locations[0]), 'utf-8'));
    ['publisher', 'name', 'version'].forEach(key => {
      if (!(key in package)) {
        throw new Error(`Expected "${key}" in ${locations[0]}: ${JSON.stringify(package, null, 2)}`);
      }
    });

    // Check whether the extension is already published on Open VSX.
    const id = `${package.publisher}.${package.name}`;
    const metadata = await registry.getMetadata(package.publisher, package.name);
    if (metadata.error) {
      console.warn(`[WARNING] Could not check Open VSX version of ${id}:`);
      console.warn(metadata.error);
    } else if (metadata.version) {
      if (semver.gt(metadata.version, package.version)) {
        throw new Error(`Open VSX already has a more recent version of ${id}: ${metadata.version} > ${package.version}`);
      }
      console.warn(`[WARNING] Open VSX already has ${id} in version ${metadata.version}. Adding ${package.version} here anyway.`);
    }

    // Add extension to the list.
    const extension = { id, repository, version: package.version };
    const location = path.dirname(locations[0]);
    if (location !== '.') {
      extension.location = location;
    }
    extensions.push(extension);

    // Sort extensions alphabetically by ID (not case-sensitive).
    extensions.sort((a, b) => {
      if (b.id.toLowerCase() > a.id.toLowerCase()) return -1;
      if (b.id.toLowerCase() < a.id.toLowerCase()) return 1;
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
