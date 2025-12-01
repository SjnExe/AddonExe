import * as mc from '@minecraft/server';
import { ActionFormResponse, ModalFormResponse } from '@minecraft/server-ui';

import { refreshXrayCache } from '@modules/detections/xrayDetection.js';

import { getXrayConfig, saveXrayConfig } from '../../configurations.js';
import { showPanel } from '../../uiManager.js';
import { UIContext } from '../panelRegistry.js';

interface XrayOre {
    enabled: boolean;
    oreName: string;
    blocks: Array<{
        blockId: string;
        dimensionId: string;
        minY: number;
        maxY: number;
    }>;
}

// Full structure matching xrayConfig.default.ts
interface XrayConfig {
    settings?: {
        ignoreCreative: boolean;
        ignoreSpectator: boolean;
        adminBypass: boolean;
        bypassPermissionLevel: number;
    };
    notifications: {
        logToConsole: boolean;
        alertBufferingSeconds: number;
        alertPermissionLevel: number;
    };
    monitoredOreTypes: Record<string, XrayOre>;
}

/**
 * Handles X-Ray Ore Management UI interactions.
 */
export async function handleXrayPanel(
    player: mc.Player,
    panelId: string,
    response: ActionFormResponse | ModalFormResponse,
    context: UIContext
) {
    const selection = (response as ActionFormResponse).selection;
    const canceled = response.canceled;
    const formValues = (response as ModalFormResponse).formValues;

    if (panelId === 'xrayOresPanel') {
        if (selection === 0) {
            // Back
            return showPanel(player, 'config_xray', context);
        }
        if (selection === 1) {
            // Add New Ore
            return showPanel(player, 'addXrayOrePanel', context);
        }
        // Force cast to our local interface which is compatible with the default config
        const xrayConfig = getXrayConfig() as unknown as XrayConfig;
        const oreMap = xrayConfig.monitoredOreTypes || {};
        const ores = Object.values(oreMap).sort((a: XrayOre, b: XrayOre) => a.oreName.localeCompare(b.oreName));

        if (typeof selection === 'number') {
            const selectedOreIndex = selection - 2;
            if (selectedOreIndex >= 0 && selectedOreIndex < ores.length) {
                return showPanel(player, 'editXrayOrePanel', { ...context, oreIndex: selectedOreIndex });
            }
        }
        return;
    }

    if (panelId === 'addXrayOrePanel') {
        if (canceled) {
            return showPanel(player, 'xrayOresPanel', context);
        }
        const values = formValues;
        if (!values) return;

        const [blockId, dimensionId, minYStr, maxYStr, oreName] = values as string[];
        const minY = parseInt(minYStr, 10);
        const maxY = parseInt(maxYStr, 10);
        if (blockId && dimensionId && !isNaN(minY) && !isNaN(maxY) && oreName) {
            const xrayConfig = getXrayConfig() as unknown as XrayConfig;
            if (!xrayConfig.monitoredOreTypes) {
                xrayConfig.monitoredOreTypes = {};
            }
            const key = oreName.toLowerCase().replace(/\s+/g, '_');
            xrayConfig.monitoredOreTypes[key] = {
                enabled: true,
                oreName,
                blocks: [{ blockId, dimensionId, minY, maxY }]
            };
            // Cast back to any/unknown to satisfy the strict saveXrayConfig signature which expects the exact default config type
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            saveXrayConfig(xrayConfig as any);
            refreshXrayCache();
            player.sendMessage('§2Successfully added new monitored ore.');
        } else {
            player.sendMessage('§4Invalid data. Please check all fields.');
        }
        return showPanel(player, 'xrayOresPanel', context);
    }

    if (panelId === 'editXrayOrePanel') {
        if (canceled) {
            return showPanel(player, 'xrayOresPanel', context);
        }
        const values = formValues;
        if (!values) return;

        const { oreIndex } = context;
        const [blockId, dimensionId, minYStr, maxYStr, oreName] = values as string[];
        const minY = parseInt(minYStr, 10);
        const maxY = parseInt(maxYStr, 10);
        if (blockId && dimensionId && !isNaN(minY) && !isNaN(maxY) && oreName) {
            const xrayConfig = getXrayConfig() as unknown as XrayConfig;
            const oreTypes = xrayConfig.monitoredOreTypes;
            const oreKeys = Object.keys(oreTypes || {}).sort((a, b) => {
                const nameA = oreTypes?.[a].oreName || '';
                const nameB = oreTypes?.[b].oreName || '';
                return nameA.localeCompare(nameB);
            });
            const key = oreKeys[oreIndex];

            if (key && oreTypes && oreTypes[key]) {
                oreTypes[key] = {
                    enabled: true,
                    oreName,
                    blocks: [{ blockId, dimensionId, minY, maxY }]
                };
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                saveXrayConfig(xrayConfig as any);
                refreshXrayCache();
                player.sendMessage('§2Successfully updated monitored ore.');
            }
        } else {
            player.sendMessage('§4Invalid data. Please check all fields.');
        }
        return showPanel(player, 'xrayOresPanel', context);
    }
}
