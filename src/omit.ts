/**
 * Copyright © Magento, Inc. All rights reserved.
 * See COPYING.txt for license details.
 */

/**
 * @summary Shallow clone an object, discarding specified keys
 */
export function omit<T>(object: Record<string, T>, keys: string[]) {
    const obj: Record<string, T> = {};

    for (const [key, val] of Object.entries(object)) {
        if (!keys.includes(key)) obj[key] = val;
    }

    return obj;
}
