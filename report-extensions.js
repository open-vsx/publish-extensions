/********************************************************************************
 * Copyright (c) 2021 Gitpod and others
 *
 * This program and the accompanying materials are made available under the
 * terms of the Eclipse Public License v. 2.0 which is available at
 * http://www.eclipse.org/legal/epl-2.0.
 *
 * SPDX-License-Identifier: EPL-2.0
 ********************************************************************************/

// @ts-check
const fs = require('fs');

(async () => {
    const failed = (await fs.promises.readFile("/tmp/failed-extensions.log", { encoding: 'utf8' })).trim();
    if (failed.length) {
        process.exitCode = -1;
        console.error('following extensions failed to publish: ' + failed);
    } else {
        console.info('all extensions published sucessfully')
    }
})();