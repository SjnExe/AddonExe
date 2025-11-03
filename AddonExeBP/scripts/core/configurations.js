import createConfigManager from './configManagerFactory.js';
import { restartAnnouncer } from '../modules/commands/announcement.js';
import { initializeSpawnProtection } from '../modules/detections/spawnProtection.js';
import { reloadRanks } from './rankManager.js';
import { setLockState } from './playerDataManager.js';
import { getConfig } from './configManager.js';


const kitsConfigManager = createConfigManager('exe:kitsConfig:current', './kitsConfig.js', 'Kits', 'kitsConfig');
const shopConfigManager = createConfigManager('exe:shopConfig:current', './shopConfig.js', 'Shop', 'shopConfig');
const spawnConfigManager = createConfigManager('exe:spawnConfig:current', './spawnConfig.js', 'Spawn', 'spawnConfig');
// The last parameter 'rankDefinitions' is the wrapperKey. It ensures the imported array
// is wrapped in an object like { rankDefinitions: [...] }, which the addon expects.
const ranksConfigManager = createConfigManager('exe:ranksConfig', './ranksConfig.js', 'Ranks', 'rankDefinitions', 'rankDefinitions');
const economyConfigManager = createConfigManager('exe:economyConfig:current', './economyConfig.js', 'Economy', 'economyConfig');
const xrayConfigManager = createConfigManager('exe:xrayConfig:current', './xrayConfig.js', 'X-Ray', 'xrayConfig');

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
export const saveEconomyConfig = economyConfigManager.save;
export const resetEconomyConfig = economyConfigManager.reset;

export const loadXrayConfig = xrayConfigManager.load;
export const getXrayConfig = xrayConfigManager.get;
export const saveXrayConfig = xrayConfigManager.set;
export const resetXrayConfig = xrayConfigManager.reset;

export const configResetRegistry = {
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
export const configResetCallbacks = {
    'announcements': (player) => {
        restartAnnouncer();
        if (player) {
            player.sendMessage('§aAnnouncement system has been updated with new settings.');
        }
    },
    'dimensionLock': (player) => {
        const config = getConfig(); // Get the freshly reset config
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