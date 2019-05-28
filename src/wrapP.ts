/**
 * Copyright © Magento, Inc. All rights reserved.
 * See COPYING.txt for license details.
 */

export async function wrapP<T>(
    promise: Promise<T>,
): Promise<[null, T] | [Error]> {
    try {
        const result = await promise;
        return [null, result];
    } catch (err) {
        return [err];
    }
}
