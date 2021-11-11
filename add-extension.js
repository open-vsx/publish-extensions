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
const getReleases = require('./lib/getReleases');
const { DH_UNABLE_TO_CHECK_GENERATOR } = require('constants');
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
   *        extensionFile?: string,
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
    --extensionFile=EXTENSION_FILE

Alternative usage: node add-extension --download=VSIX_URL`);
    process.exitCode = 1;
    process.exit();
  }

  const repository = (argv._[0] || '').replace(/(\.git)?\/*$/, '');

  // If possible, always prefer re-publishing an official VSIX release over trying to re-package ourselves.
  if (repository && !argv.download) {
    const latestVSIXRelease = await getReleases.findLatestVSIXRelease(repository);
    if (latestVSIXRelease) {
      // Simulate a 'node add-extension --download=VSIX_URL' CLI call.
      argv.download = latestVSIXRelease;
      delete argv.checkout;
      delete argv.location;
      delete argv.prepublish;
      delete argv.extensionFile;
    }
  }

  // Handle 'node add-extension --download=VSIX_URL':
  if (argv.download) {
    try {
      await exec('mkdir -p /tmp/vsix');
      await exec(`wget -O extension.vsix ${argv.download}`, { cwd: '/tmp/vsix' });
      await exec('unzip -q extension.vsix', { cwd: '/tmp/vsix' });
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
    await exec(`git clone --depth=1${typeof argv.checkout === 'string' ? `--branch ${argv.checkout}` : ''} --recurse-submodules ${repository} /tmp/repository`);

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
    const packagePath = path.join('/tmp/repository', location, 'package.json')
    /** @type {{ publisher: string, name: string, version: string }} */
    const package = JSON.parse(await readFile(packagePath, 'utf-8'));
    if (registry.requiresLicense && !(await ovsx.isLicenseOk(path.dirname(packagePath), package))) {
      throw new Error(`License must be present, please ask author of extension to add license (${repository})`)
    } else {
      ovsx.validateManifest(package)
    }

    // Check whether the extension is already published on Open VSX.
    await ensureNotAlreadyOnOpenVSX(package, registry);

    // If --checkout is passed without a value, try to find an appropriate-looking release tag if available.
    if (argv.checkout === true) {
      // Non-failing grep, source: https://unix.stackexchange.com/a/330662
      const { stdout: releaseTags } = await exec(`git tag | { grep ${package.version} || true; }`, { cwd: '/tmp/repository' });
      const releaseTag = releaseTags.split('\n')[0].trim();
      if (releaseTag) {
        argv.checkout = releaseTag;
      } else {
        delete argv.checkout;
      }
    }

    // Add extension to the list.
    const extension = { id: `${package.publisher}.${package.name}`, repository, version: package.version };
    if (argv.checkout) {
      extension.checkout = argv.checkout;
    } else {
      // No need to pin a specific version if we're not also using "checkout".
      delete extension.version;
    }
    if (location !== '.') {
      extension.location = location;
    }
    if (argv.prepublish) {
      extension.prepublish = argv.prepublish;
    }
    if (argv.extensionFile) {
      extension.extensionFile = argv.extensionFile;
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
  let metadata;
  try {
    metadata = await registry.getMetadata(package.publisher, package.name);
  } catch (error) {
    console.warn(`[WARNING] Could not check Open VSX version of ${id}:`);
    console.warn(error);
    return;
  }
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
