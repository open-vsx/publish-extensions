/********************************************************************************
 * Copyright (c) 2021 Gitpod and others
 *
 * This program and the accompanying materials are made available under the
 * terms of the Eclipse Public License v. 2.0 which is available at
 * http://www.eclipse.org/legal/epl-2.0.
 *
 * SPDX-License-Identifier: EPL-2.0
 ********************************************************************************/

//@ts-check

export interface MSExtensionStat {
    msInstalls: number,
    msVersion: string
}

export interface ExtensionStat extends MSExtensionStat {
    daysInBetween: number,
    openVersion: string,
}

export interface PublishStat {
    upToDate: {
        [id: string]: ExtensionStat
    }
    unstable: {
        [id: string]: ExtensionStat
    }
    outdated: {
        [id: string]: ExtensionStat
    }
    notInOpen: {
        [id: string]: MSExtensionStat
    }
    notInMS: string[]

    msPublished: {
        [id: string]: MSExtensionStat
    }
    hitMiss: {
        [id: string]: (ExtensionStat | ExtensionStat) & { hit: boolean }
    }
    failed: string[]
}

export interface Extension {
    id: string,
    repository?: string
    version?: string
    checkout?: string
    location?: string
    prepublish?: string
    download?: string
    extensionFile?: string
    timeout?: unknown
}