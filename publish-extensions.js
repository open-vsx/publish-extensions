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
const cp = require('child_process');

(async () => {
  /**
   * @type {string[] | undefined}
   */
  let toVerify = undefined;
  if (process.env.FAILED_EXTENSIONS) {
    toVerify = process.env.FAILED_EXTENSIONS.split(', ')
  }
  const { extensions } = JSON.parse(await fs.promises.readFile('./extensions.json', 'utf-8'));

  // Also install extensions' devDependencies when using `npm install` or `yarn install`.
  process.env.NODE_ENV = 'development';

  const failed = [];

  for (const extension of extensions) {
    if (toVerify && toVerify.indexOf(extension.id) === -1) {
      continue;
    }
    let timeoutDelay = Number(extension.timeout);
    if (!Number.isInteger(timeoutDelay)) {
      timeoutDelay = 5;
    }
    try {
      let timeout;
      await new Promise((resolve, reject) => {
        const p = cp.spawn(process.execPath, ['publish-extension.js', JSON.stringify(extension)], {
          stdio: ['ignore', 'inherit', 'inherit'],
          cwd: process.cwd(),
          env: process.env
        })
        p.on('error', reject);
        p.on('exit', code => {
          if (code) {
            return reject(new Error('failed with exit status: ' + code));
          }
          resolve();
        });
        timeout = setTimeout(() => {
          try {
            p.kill('SIGKILL');
          } catch { }
          reject(new Error(`timeout after ${timeoutDelay} mins`));
        }, timeoutDelay * 60 * 1000);
      });
      if (timeout !== undefined) {
        clearTimeout(timeout);
      }
    } catch (error) {
      failed.push(extension.id);
      console.error(`[FAIL] Could not process extension: ${JSON.stringify(extension, null, 2)}`);
      console.error(error);
    }
  }

  await fs.promises.writeFile("/tmp/failed-extensions.log", failed.join(', '), { encoding: 'utf8' });
})();
