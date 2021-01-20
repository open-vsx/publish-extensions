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
const { DH_UNABLE_TO_CHECK_GENERATOR } = require('constants');
const readFile = util.promisify(fs.readFile);
const writeFile = util.promisify(fs.writeFile);

const registry = new ovsx.Registry();

// don't run this part if this module is not exported 
// @ts-ignore
if (!module.parent) {
  (async () => {
    const extensionFilePath = './extensions.json'
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
    const { extensions } = await readExtensionsFromFile(extensionFilePath)
  
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
  
    // Handle 'node add-extension --download=VSIX_URL':
    if (argv.download) {
      try {
        await exec('mkdir -p /tmp/vsix');
        await exec(`wget -O extension.vsix ${argv.download}`, { cwd: '/tmp/vsix' });
        await exec('unzip -q extension.vsix', { cwd: '/tmp/vsix' });
        /** @type {{ publisher: string, name: string, version: string }} */
        const package = JSON.parse(await readFile('/tmp/vsix/extension/package.json', 'utf-8'));
        ovsx.validateManifest(package)
        const extension = { id: `${package.publisher}.${package.name}`, download: argv.download, version: package.version };
        await addNewExtension(extension, package, extensions);
        onDidAddExtension(extension);
        await writeToExtensionsFile(extensions, extensionFilePath)
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
      // @ts-ignore
      const { extension, package } = await fetchExtInfoFromClonedRepo(repository, argv)
      await addNewExtension(extension, package, extensions);
      await writeToExtensionsFile(extensions, extensionFilePath)
      onDidAddExtension(extension);
    } catch (error) {
      console.error(`[FAIL] Could not add ${repository}!`);
      console.error(error);
      process.exitCode = -1;
    }
  })();
}

async function fetchExtInfoFromClonedRepo(repository, { checkout, location, extensionFile, prepublish }) {
  const tmpRepoFolder = '/tmp/repository';
  
  try {
    const { packagePath }  = await cloneRepo(tmpRepoFolder, repository, checkout, location)
    /** @type {{ publisher: string, name: string, version: string }} */
    const package = JSON.parse(await readFile(packagePath, 'utf-8'));
    if (registry.requiresLicense && !(await ovsx.isLicenseOk(packagePath, package))) {
      throw new Error(`License must be present, please ask author of extension to add license (${repository})`)
    } else {
      ovsx.validateManifest(package)
    }
  
    // Check whether the extension is already published on Open VSX.
    await ensureNotAlreadyOnOpenVSX(package, registry);
  
    // Add extension to the list.
    const extension = { id: `${package.publisher}.${package.name}`, repository, version: package.version };
    if (checkout) {
        extension.checkout = checkout;
    }
    if (location !== '.') {
      extension.location = location;
    }
    if (prepublish) {
        extension.prepublish = prepublish;
    }
    if (extensionFile) {
      extension.extensionFile = extensionFile;
    }
    return { extension, package }
  } finally {
    await exec(`rm -rf ${tmpRepoFolder}`);
  }
}

async function cloneRepo(tmpRepoFolder, repository, checkout, location) {
  if (!new URL(repository)) {
    throw new Error(`Invalid repository URL: ${repository}`);
  }

  // Clone the repository to determine the extension's latest version.
  await exec(`git clone --recurse-submodules ${repository} ${tmpRepoFolder}`);
  if (typeof checkout === 'string') {
    // Check out the specified Git branch, tag, or commit.
    await exec(`git checkout ${checkout}`, { cwd: tmpRepoFolder });
  } else if (checkout === true) {
    // If --checkout is passed without a value, set its value to the repository's default Git branch.
    const { stdout: defaultBranch } = await exec(`git rev-parse --abbrev-ref HEAD`, { cwd: tmpRepoFolder });
    checkout = defaultBranch.trim();
  }

  // Locate and parse package.json.
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
  return { packagePath: path.join(tmpRepoFolder, location, 'package.json') };
}

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

async function onDidAddExtension (extension) {
  console.log(`[OK] Succesfully added new extension: ${JSON.stringify(extension, null, 2)}`);
}

async function writeToExtensionsFile (extensions, path = './extensions.json') {
  // Save new extensions list.
  await writeFile(path, JSON.stringify({ extensions }, null, 2) + '\n', 'utf-8');
}

async function readExtensionsFromFile (extensionFilePath) {
  return JSON.parse(await readFile(extensionFilePath, 'utf-8'));
}

async function addNewExtension(extension, package, extensions) {
  // Check whether the extension is already published on Open VSX.
  await ensureNotAlreadyOnOpenVSX(package, registry);

  extensions.push(extension);

  // Sort extensions alphabetically by ID (not case-sensitive).
  extensions.sort((a, b) => {
    if (b.id.toLowerCase() > a.id.toLowerCase()) return -1;
    if (b.id.toLowerCase() < a.id.toLowerCase()) return 1;
    return 0;
  });
}

module.exports = {
  addNewExtension,
  onDidAddExtension,
  writeToExtensionsFile,
  readExtensionsFromFile,
  fetchExtInfoFromClonedRepo,
  cloneRepo
}