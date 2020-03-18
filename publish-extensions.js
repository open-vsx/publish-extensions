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
const ovsx = require('ovsx');
const util = require('util');
const exec = util.promisify(require('child_process').exec);

const { extensions } = JSON.parse(fs.readFileSync('./extensions.json', 'utf-8'));
const registry = new ovsx.Registry();

(async () => {
  for (const { repository, namespace, name } of extensions) {
    console.log(`\nProcessing extension: ${JSON.stringify({ repository, namespace, name }, null, 2)}\n`);
    try {
      if (!new URL(repository)) {
        throw new Error(`Invalid repository URL: ${repository}`);
      }

      console.log(`Cloning ${repository}...`);
      await exec(`git clone ${repository} /tmp/repository`);

      console.log(`Looking for Open VSX version of "${namespace}/${name}"...`);
      let ovsxVersion;
      const metadata = await registry.getMetadata(namespace, name);
      if (metadata.error) {
        console.error(metadata.error);
      } else {
        console.log(`Found version: ${metadata.version}`)
        ovsxVersion = metadata.version;
      }
    } catch (error) {
      console.error(error);
    } finally {
      await exec('rm -rf /tmp/repository');
    }
  }
})();
