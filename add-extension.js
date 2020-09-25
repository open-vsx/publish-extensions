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
  const registry = new ovsx.Registry();

  const argv = minimist(process.argv.slice(2));
  if (argv._.length !== (!!argv.download ? 0 : 1)) {
    console.log(`Usage: node add-extension REPOSITORY [OPTIONS]
OPTIONS:
    --checkout=CHECKOUT
    --location=LOCATION
    --prepublish=PREPUBLISH

Alternative usage: node add-extension --download=VSIX_URL`);
    process.exitCode = 1;
    process.exit();
  }

  // Handle 'node add-extension --download=VSIX_URL':
  if (argv.download) {
    try {
      await exec('mkdir -p /tmp/vsix');
      await exec(`wget -O extension.vsix ${argv.download}`, { cwd: '/tmp/vsix' });
      await exec('unzip extension.vsix', { cwd: '/tmp/vsix' });
      /** @type {{ publisher: string, name: string, version: string }} */
      const package = JSON.parse(await readFile('/tmp/vsix/extension/package.json', 'utf-8'));
      await ensureNotAlreadyOnOpenVSX(package, registry);
      const extension = { id: `${package.publisher}.${package.name}`, download: argv.download, version: package.version };
      await addNewExtension(extension, extensions);
    } catch (error) {
      console.error(`[FAIL] Could not add ${argv.download}!`);
      console.error(error);
      process.exitCode = -1;
    } finally {
      await exec('rm -rf /tmp/vsix');
      process.exit();
    }
  }

  // Handle 'node add-extension REPOSITORY [OPTIONS]':
  const repository = argv._[0].replace(/\/*$/, '');
  const existing = extensions.find(e => e.repository && e.repository.toLowerCase() === repository.toLowerCase() && e.location === argv.location);
  if (existing) {
    console.log(`[SKIPPED] Repository already in extensions.json: ${JSON.stringify(existing, null, 2)}`);
    return;
  }

  try {
    if (!new URL(repository)) {
      throw new Error(`Invalid repository URL: ${repository}`);
    }

    // Clone the repository to determine the extension's latest version.
    await exec(`git clone --recurse-submodules ${repository} /tmp/repository`);
    if (typeof argv.checkout === 'string') {
        // Check out the specified Git branch, tag, or commit.
        await exec(`git checkout ${argv.checkout}`, { cwd: '/tmp/repository' });
    } else if (argv.checkout === true) {
        // If --checkout is passed without a value, set its value to the repository's default Git branch.
        const { stdout: defaultBranch } = await exec(`git rev-parse --abbrev-ref HEAD`, { cwd: '/tmp/repository' });
        argv.checkout = defaultBranch.trim();
    }

    // Locate and parse package.json.
    let location = argv.location;
    if (!location) {
        const { stdout: files } = await exec('ls package.json 2>/dev/null || git ls-files | grep package\\.json', { cwd: '/tmp/repository' });
        if (!files.trim()) {
            throw new Error(`No package.json found in repository!`);
        }
        const locations = files.trim().split('\n');
        if (locations.length > 1) {
            console.warn(`[WARNING] Multiple package.json found in repository, arbitrarily using the first one:\n> ${locations[0]}\n${locations.slice(1).map(l => '  ' + l).join('\n')}`);
        }
        location = path.dirname(locations[0]);
    }
    /** @type {{ publisher: string, name: string, version: string }} */
    const package = JSON.parse(await readFile(path.join('/tmp/repository', location, 'package.json'), 'utf-8'));
    ['publisher', 'name', 'version'].forEach(key => {
      if (!(key in package)) {
        throw new Error(`Expected "${key}" in ${location}/package.json: ${JSON.stringify(package, null, 2)}`);
      }
    });

    // Check whether the extension is already published on Open VSX.
    await ensureNotAlreadyOnOpenVSX(package, registry);

    // Add extension to the list.
    const extension = { id: `${package.publisher}.${package.name}`, repository, version: package.version };
    if (argv.checkout) {
        extension.checkout = argv.checkout;
    }
    if (location !== '.') {
      extension.location = location;
    }
    if (argv.prepublish) {
        extension.prepublish = argv.prepublish;
    }
    await addNewExtension(extension, extensions);
  } catch (error) {
    console.error(`[FAIL] Could not add ${repository}!`);
    console.error(error);
    process.exitCode = -1;
  } finally {
    await exec('rm -rf /tmp/repository');
  }
})();

async function ensureNotAlreadyOnOpenVSX(package, registry) {
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
}

async function addNewExtension(extension, extensions) {
  extensions.push(extension);

  // Sort extensions alphabetically by ID (not case-sensitive).
  extensions.sort((a, b) => {
    if (b.id.toLowerCase() > a.id.toLowerCase()) return -1;
    if (b.id.toLowerCase() < a.id.toLowerCase()) return 1;
    return 0;
  });

  // Save new extensions list.
  await writeFile('./extensions.json', JSON.stringify({ extensions }, null, 2) + '\n', 'utf-8');
  console.log(`[OK] Succesfully added new extension: ${JSON.stringify(extension, null, 2)}`);
}
