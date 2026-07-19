import { serviceLocator } from '@core/services/serviceLocator.js';

import { findSafeLocation, saveLastLocation } from '@features/teleport/utils.js';

export function initialize() {
    serviceLocator.registerService('teleport.utils', {
        saveLastLocation,
        findSafeLocation
    });
}
