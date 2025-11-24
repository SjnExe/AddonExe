import * as mc from '@minecraft/server';
import createConfigManager from './configManagerFactory.js';
import { restartAnnouncer } from '../modules/commands/announcement.js';
import { initializeSpawnProtection } from '../modules/detections/spawnProtection.js';
import { reloadRanks } from './rankManager.js';
import { setLockState } from './playerDataManager.js';
import { getConfig } from './configManager.js';

// Import default configs directly for synchronous initialization
import { kitsConfig as defaultKitsConfig } from './kitsConfig.js';
import { shopConfig as defaultShopConfig } from './shopConfig.js';
import { spawnConfig as defaultSpawnConfig } from './spawnConfig.js';
import { rankDefinitions as defaultRankDefinitions } from './ranksConfig.js';
import { economyConfig as defaultEconomyConfig } from './economyConfig.js';
import { xrayConfig as defaultXrayConfig } from './xrayConfig.js';
import { teamConfig as defaultTeamConfig } from './teamConfig.js';

const kitsConfigManager = createConfigManager('exe:kitsConfig:current', defaultKitsConfig, 'Kits');
const shopConfigManager = createConfigManager('exe:shopConfig:current', defaultShopConfig, 'Shop');
const spawnConfigManager = createConfigManager('exe:spawnConfig:current', defaultSpawnConfig, 'Spawn');
const ranksConfigManager = createConfigManager('exe:ranksConfig', defaultRankDefinitions, 'Ranks', 'rankDefinitions');
const economyConfigManager = createConfigManager('exe:economyConfig:current', defaultEconomyConfig, 'Economy');
const xrayConfigManager = createConfigManager('exe:xrayConfig:current', defaultXrayConfig, 'X-Ray');
const teamConfigManager = createConfigManager('exe:teamConfig:current', defaultTeamConfig, 'Teams');

export const loadKitsConfig = kitsConfigManager.load;
export const getKitsConfig = kitsConfigManager.get;
export const saveKitsConfig = kitsConfigManager.save;
export const resetKitsConfig = kitsConfigManager.reset;

export const loadShopConfig = shopConfigManager.load;
export const getShopConfig = shopConfigManager.get;
export const saveShopConfig = shopConfigManager.save;
export const resetShopConfig = shopConfigManager.reset;

export const loadSpawnConfig = spawnConfigManager.load;
export const getSpawnConfig = spawnConfigManager.get;
export const saveSpawnConfig = spawnConfigManager.set;
export const resetSpawnConfig = spawnConfigManager.reset;

export const loadRanksConfig = ranksConfigManager.load;
export const getRanksConfig = ranksConfigManager.get;
export const saveRanksConfig = ranksConfigManager.save;
export const resetRanksConfig = ranksConfigManager.reset;

export const loadEconomyConfig = economyConfigManager.load;
export const getEconomyConfig = economyConfigManager.get;
export const saveEconomyConfig = economyConfigManager.set;
export const resetEconomyConfig = economyConfigManager.reset;

export const loadXrayConfig = xrayConfigManager.load;
export const getXrayConfig = xrayConfigManager.get;
export const saveXrayConfig = xrayConfigManager.set;
export const resetXrayConfig = xrayConfigManager.reset;

export const loadTeamConfig = teamConfigManager.load;
export const getTeamConfig = teamConfigManager.get;
export const saveTeamConfig = teamConfigManager.set;
export const resetTeamConfig = teamConfigManager.reset;

type ResetRegistryEntry = {
    reset: () => void;
    message: string;
    postResetCallback?: (player?: mc.Player) => void;
};

export const configResetRegistry: Record<string, ResetRegistryEntry> = {
    'team': {
        reset: resetTeamConfig,
        message: 'The \'team\' configuration section has been reset to default.'
    },
    'xray': {
        reset: resetXrayConfig,
        message: 'The \'X-ray\' configuration section has been reset to default.'
    },
    'economy': {
        reset: resetEconomyConfig,
        message: 'The \'economy\' configuration section has been reset to default.'
    },
    'kits': {
        reset: resetKitsConfig,
        message: 'The \'kits\' configuration section has been reset to default.'
        // No post-reset callback needed, data is read live.
    },
    'shop': {
        reset: resetShopConfig,
        message: 'The \'shop\' configuration section has been reset to default.'
        // No post-reset callback needed, data is read live.
    },
    'spawn': {
        reset: resetSpawnConfig,
        message: 'The \'spawn\' configuration section has been reset to default.',
        postResetCallback: (player) => {
            initializeSpawnProtection();
            if (player) {
                player.sendMessage('§aSpawn protection system has been updated based on new settings.');
            }
        }
    },
    'ranks': {
        reset: resetRanksConfig,
        message: 'The \'ranks\' configuration section has been reset to default.',
        postResetCallback: (player) => {
            reloadRanks();
            if (player) {
                player.sendMessage('§aRanks have been reloaded with new settings.');
            }
        }
    }
};

/**
 * A registry of functions to call after a specific config section is reset.
 * This is for sections within the main `config.js` file.
 */
export const configResetCallbacks: Record<string, (player?: mc.Player) => void> = {
    'announcements': (player) => {
        restartAnnouncer();
        if (player) {
            player.sendMessage('§aAnnouncement system has been updated with new settings.');
        }
    },
    'dimensionLock': (player) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const config: any = getConfig(); // Get the freshly reset config
        setLockState('nether', !!config.dimensionLock.lockNether);
        setLockState('end', !!config.dimensionLock.lockEnd);
        if (player) {
            player.sendMessage('§aLive dimension lock states have been updated to match config.');
        }
    }
};


/**
 * Reloads all configurations that support it.
 * @returns {Promise<void>}
 */
export async function reloadAllConfigs() {
    // This function is a placeholder for potential future use.
    // Currently, only the main config is designed for live reloading,
    // which is handled in the 'reload.js' command file.
}
