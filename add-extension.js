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
const minimist = require('minimist');
const ovsx = require('ovsx');
const exec = require('./lib/exec');
const { readExtensionsFromFile, addNewExtension, onDidAddExtension, writeToExtensionsFile, fetchExtInfoFromClonedRepo } = require('./lib/utils');

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
      const package = await ovsx.readManifest('/tmp/vsix/extension/package.json');
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
