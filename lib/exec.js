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
const cp = require('child_process');

/**
 * @param {string} command
 * @param {{cwd: string}} [options]
 * @returns {Promise<{ stdout: string, stderr: string }>}
 */
module.exports = async (command, options) => {
  console.log(`Running: ${command}`);
  return new Promise((resolve, reject) => {
    const child = cp.exec(command, options, (error, stdout, stderr) => {
      if (error) {
        return reject(error);
      }
      resolve({ stdout, stderr });
    });
    child.stdout.pipe(process.stdout);
    child.stderr.pipe(process.stderr);
  });
};
