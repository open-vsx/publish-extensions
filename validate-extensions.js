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
const util = require('util');
const readFile = util.promisify(fs.readFile);

(async () => {
  try {
    /**
     * @type {{
     *    extensions: {
     *        id: string,
     *        repository: string,
     *        version?: string,
     *        checkout?: string,
     *        location?: string,
     *        prepublish?: string,
     *        download?: string,
     *        extensionFile?: string
     *    }[]
     * }}
     */
    const { extensions } = JSON.parse(await readFile('./extensions.json', 'utf-8'));

    for (const extension of extensions) {
      if (!extension.id) {
        console.error("[ERROR] Found entry without id: " + JSON.stringify(extension));
        process.exit(1);
      }
      if (extension.download) {
        if (extension.repository) {
          console.warn('[WARN] Ignoring `repository` property because `download` was given.')
        }
        if (extension.checkout) {
          console.warn('[WARN] Ignoring `checkout` property because `download` was given.')
        }
        if (extension.prepublish) {
          console.warn('[WARN] Ignoring `prepublish` property because `download` was given.')
        }
        if (extension.location) {
          console.warn('[WARN] Ignoring `location` property because `download` was given.')
        }
        if (extension.extensionFile) {
          console.warn('[WARN] Ignoring `extensionFile` property because `download` was given.')
        }
      } else if (!extension.repository) {
        console.error(`[ERROR] Extension ${extension.id} has neither 'repository' nor 'download'.`);
        process.exit(1);
      }
    }
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
})();
