/********************************************************************************
 * Copyright (c) 2020 TypeFox and others
 *
 * This program and the accompanying materials are made available under the
 * terms of the Eclipse Public License v. 2.0 which is available at
 * http://www.eclipse.org/legal/epl-2.0.
 *
 * SPDX-License-Identifier: EPL-2.0
 ********************************************************************************/

const ovsx = require('ovsx');
const path = require('path');
const util = require('util');
const semver = require('semver');
const exec = require('./lib/exec');
const readFile = util.promisify(require('fs').readFile);

(async () => {
  const { extensions } = JSON.parse(await readFile('./extensions.json', 'utf-8'));
  const registry = new ovsx.Registry();

  for (const extension of extensions) {
    console.log(`\nProcessing extension: ${JSON.stringify(extension, null, 2)}\n`);
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

      console.log(`\nAttempting to publish ${id} to Open VSX`);
      await exec(`git clone ${repository} /tmp/repository`);
      const location = path.join('/tmp/repository', extension.location || '.');
      await exec(`npm install`, { cwd: location });
      await ovsx.publish({ packagePath: location });
      console.log(`[OK] Successfully published ${id} to Open VSX!`)
    } catch (error) {
      console.error('[FAIL] Could not process extension!');
      console.error(error);
      process.exitCode = -1;
    } finally {
      await exec('rm -rf /tmp/repository');
    }
  }
})();
