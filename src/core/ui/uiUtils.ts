import { ActionFormData } from '@minecraft/server-ui';

import { getConfig, updateMultipleConfig, Config } from '../configManager.js';
import {
    getSpawnConfig,
    saveSpawnConfig,
    getEconomyConfig,
    saveEconomyConfig,
    getXrayConfig,
    saveXrayConfig,
    getTeamConfig,
    saveTeamConfig
} from '../configurations.js';
import { spawnConfig } from '../spawnConfig.default.js';
import { economyConfig } from '../economyConfig.default.js';
import { xrayConfig } from '../xrayConfig.default.js';
import { teamConfig } from '../teamConfig.default.js';
import { ranksConfig } from '../ranksConfig.default.js';
import { kitsConfig } from '../kitsConfig.default.js';
import { shopConfig } from '../shopConfig.default.js';
import { PlayerData } from '../playerDataManager.js';

type SpawnConfig = typeof spawnConfig;
type EconomyConfig = typeof economyConfig;
type XrayConfig = typeof xrayConfig;
type TeamConfig = typeof teamConfig;
type RanksConfig = typeof ranksConfig;
type KitsConfig = typeof kitsConfig;
type ShopConfig = typeof shopConfig;

import { configPanelSchema } from './configPanelRegistry.js';

export const itemsPerPage = 8;

interface ConfigHandler {
    get: () =>
        | typeof Config
        | SpawnConfig
        | EconomyConfig
        | XrayConfig
        | TeamConfig
        | RanksConfig
        | KitsConfig
        | ShopConfig;
    save: (
        config:
            | typeof Config
            | SpawnConfig
            | EconomyConfig
            | XrayConfig
            | TeamConfig
            | RanksConfig
            | KitsConfig
            | ShopConfig
            | Record<string, unknown>
    ) => void;
}

export const configHandlers: Record<string, ConfigHandler> = {
    main: {
        get: getConfig,
        save: (updates: Record<string, unknown>) => updateMultipleConfig(updates)
    },
    spawn: {
        get: getSpawnConfig,
        save: (config: SpawnConfig) => saveSpawnConfig(config)
    },
    economy: {
        get: getEconomyConfig,
        save: (config: EconomyConfig) => saveEconomyConfig(config)
    },
    xray: {
        get: getXrayConfig,
        save: (config: XrayConfig) => saveXrayConfig(config)
    },
    team: {
        get: getTeamConfig,
        save: (config: TeamConfig) => saveTeamConfig(config)
    }
};

/**
 * Helper to slice items for pagination.
 */
export function getPaginatedItems<T>(items: T[], page: number): T[] {
    const startIndex = (page - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    return items.slice(startIndex, endIndex);
}

/**
 * Helper to add pagination buttons to a form.
 */
export function addPaginationButtons(form: ActionFormData, page: number, totalItems: number): void {
    const totalPages = Math.ceil(totalItems / itemsPerPage);
    if (page > 1) {
        form.button('§l§4< §1Previous');
    }
    if (page < totalPages) {
        form.button('§l§1Next §4>');
    }
}

export interface SystemItem {
    id: string;
    title: string;
    icon: string;
}

/**
 * Generates a synchronized list of visible configuration systems for a player.
 * This serves as the single source of truth for both building the panel and handling its responses.
 * @param pData The player data object containing permissionLevel.
 * @returns A sorted array of system objects ({ id, title, icon }).
 */
export function getVisibleConfigSystems(pData: PlayerData): SystemItem[] {
    const allSystems: SystemItem[] = [
        ...configPanelSchema
            .filter((c) => c.id !== 'economyGeneralSettings')
            .map((c) => ({ id: `config_${c.id}`, title: c.title, icon: c.icon }))
    ];

    if (pData.permissionLevel <= 1) {
        allSystems.push({ id: 'commandSystemPanel', title: '§l§1Command System§r', icon: 'textures/ui/Wrenches1' });
        allSystems.push({ id: 'kitManagementPanel', title: '§l§dKit System§r', icon: 'textures/ui/inventory_icon' });
        allSystems.push({ id: 'shopManagementPanel', title: '§l§2Shop System§r', icon: 'textures/items/emerald' });
        allSystems.push({
            id: 'rankManagementPanel',
            title: '§l§4Rank System§r',
            icon: 'textures/ui/permissions_member_star.png'
        });
        allSystems.push({ id: 'economyPanel', title: '§l§6Economy System§r', icon: 'textures/items/emerald' });
    }
    if (pData.permissionLevel === 0) {
        allSystems.push({ id: 'configResetPanel', title: '§l§cReset Settings§r', icon: 'textures/ui/wysiwyg_reset' });
    }

    // Custom sorting: Server Info first, Gameplay, System, Reset last, rest alphabetical
    const serverInfo = allSystems.find((s) => s.id === 'config_general_server');
    const gameplay = allSystems.find((s) => s.id === 'config_general_gameplay');
    const system = allSystems.find((s) => s.id === 'config_general_system');
    const resetSystem = allSystems.find((s) => s.id === 'configResetPanel');

    const otherSystems = allSystems.filter(
        (s) =>
            s.id !== 'config_general_server' &&
            s.id !== 'config_general_gameplay' &&
            s.id !== 'config_general_system' &&
            s.id !== 'configResetPanel'
    );
    otherSystems.sort((a, b) => a.title.replace(/§./g, '').localeCompare(b.title.replace(/§./g, '')));

    const sortedSystems: SystemItem[] = [];
    if (serverInfo) {
        sortedSystems.push(serverInfo);
    }
    if (gameplay) {
        sortedSystems.push(gameplay);
    }
    if (system) {
        sortedSystems.push(system);
    }
    sortedSystems.push(...otherSystems);
    if (resetSystem) {
        sortedSystems.push(resetSystem);
    }

    return sortedSystems;
}
