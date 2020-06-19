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
const ovsx = require('ovsx');
const path = require('path');
const util = require('util');
const semver = require('semver');
const exec = require('./lib/exec');
const readFile = util.promisify(fs.readFile);

(async () => {
  /** @type {{ extensions: { id: string, repository: string, version?: string, checkout?: string, location?: string, prepublish?: string }[] }} */
  const { extensions } = JSON.parse(await readFile('./extensions.json', 'utf-8'));
  const registry = new ovsx.Registry();

  // Also install extensions' devDependencies when using `npm install` or `yarn install`.
  process.env.NODE_ENV = 'development';

  for (const extension of extensions) {
    console.log(`\nProcessing extension: ${JSON.stringify(extension, null, 2)}`);
    try {
      const { id, repository } = extension;
      if (!new URL(repository)) {
        throw new Error(`Invalid repository URL: ${repository}`);
      }

      console.log(`Checking Open VSX version of ${id}`);
      let ovsxVersion;
      const [namespace, name] = id.split('.');
      const metadata = await registry.getMetadata(namespace, name);
      if (metadata.error) {
        console.error(metadata.error);
      } else {
        console.log(`Found version: ${metadata.version}`);
        ovsxVersion = metadata.version;
      }

      // Check if the requested version is greater than the one on Open VSX.
      if (ovsxVersion && extension.version) {
        if (semver.gt(ovsxVersion, extension.version)) {
          throw new Error(`extensions.json is out-of-date: Open VSX version ${ovsxVersion} is already greater than specified version ${extension.version}`);
        }
        if (semver.eq(ovsxVersion, extension.version)) {
          console.log(`[SKIPPED] Requested version ${extension.version} is already published on Open VSX`);
          continue;
        }
      }

      console.log(`Attempting to publish ${id} to Open VSX`);

      // Clone and set up the repository.
      await exec(`git clone --recurse-submodules ${repository} /tmp/repository`);
      if (extension.checkout) {
        await exec(`git checkout ${extension.checkout}`, { cwd: '/tmp/repository' });
      }
      let yarn = await new Promise(resolve => {
        fs.access(path.join('/tmp/repository', 'yarn.lock'), error => resolve(!error));
      });
      await exec(`${yarn ? 'yarn' : 'npm'} install`, { cwd: '/tmp/repository' });
      if (extension.prepublish) {
        await exec(extension.prepublish, { cwd: '/tmp/repository' })
      }

      // Create a public Open VSX namespace if needed.
      try {
        await ovsx.createNamespace({ name: namespace });
      } catch (error) {
        console.log(`Creating Open VSX namespace failed -- assuming that it already exists`);
        console.log(error);
      }

      // Publish the extension.
      const options = { packagePath: path.join('/tmp/repository', extension.location || '.') };
      if (yarn) {
        options.yarn = true;
      }
      await ovsx.publish(options);
      console.log(`[OK] Successfully published ${id} to Open VSX!`)
    } catch (error) {
      console.error(`[FAIL] Could not process extension: ${JSON.stringify(extension, null, 2)}`);
      console.error(error);
      process.exitCode = -1;
    } finally {
      await exec('rm -rf /tmp/repository');
    }
  }
})();
