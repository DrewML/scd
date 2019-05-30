/**
 * Copyright © Magento, Inc. All rights reserved.
 * See COPYING.txt for license details.
 */

import fromEntries from 'fromentries';

// For better console logging with types not supported in JSON
// (mainly Map/Set)
export function serialize(data: object | any[]) {
    return JSON.stringify(data, replace, 2);
}

function replace(key: string, value: any) {
    if (Object.prototype.toString.call(value) === '[object Set]') {
        return Array.from(value);
    }

    if (Object.prototype.toString.call(value) === '[object Map]') {
        return fromEntries(value.entries());
    }

    return value;
}
