import { serviceLocator } from '@core/services/serviceLocator.js';
import { TeleportPanelHandler } from '@features/teleport/ui/panel.js';
import { findSafeLocation, saveLastLocation } from '@features/teleport/utils.js';
import { panelRouter } from '@ui/PanelRouter.js';

export function initialize() {
    panelRouter.register(new TeleportPanelHandler());

    serviceLocator.registerService('teleport.utils', {
        saveLastLocation,
        findSafeLocation
    });
}
