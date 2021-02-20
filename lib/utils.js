// @ts-check
const fs = require('fs');
const path = require('path');
const util = require('util');
const ovsx = require('ovsx');
const semver = require('semver');
const exec = require('./exec');
const readFile = util.promisify(fs.readFile);
const writeFile = util.promisify(fs.writeFile);
const registry = new ovsx.Registry();

async function fetchExtInfoFromClonedRepo(repository, { checkout, location, extensionFile, prepublish }) {
  const tmpRepoFolder = '/tmp/repository';
  
  try {
    const { packagePath }  = await cloneRepo(tmpRepoFolder, repository, checkout, location)
    const package = await ovsx.readManifest(packagePath)
    if (registry.requiresLicense && !(await ovsx.isLicenseOk(packagePath, package))) {
      throw new Error(`License must be present, please ask author of extension to add license (${repository})`)
    } else {
      ovsx.validateManifest(package)
    }
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
  return { packagePath: path.join(tmpRepoFolder, location) };
}

module.exports = {
  addNewExtension,
  onDidAddExtension,
  writeToExtensionsFile,
  readExtensionsFromFile,
  fetchExtInfoFromClonedRepo,
  cloneRepo
}