import createConfigManager from './configManagerFactory.js';

const kitsConfigManager = createConfigManager('exe:kitsConfig:current', './kitsConfig.js', 'Kits', 'kitsConfig');
const shopConfigManager = createConfigManager('exe:shopConfig:current', './shopConfig.js', 'Shop', 'shopConfig');
const spawnConfigManager = createConfigManager('exe:spawnConfig:current', './spawnConfig.js', 'Spawn', 'spawnConfig');
// The last parameter 'rankDefinitions' is the wrapperKey. It ensures the imported array
// is wrapped in an object like { rankDefinitions: [...] }, which the addon expects.
const ranksConfigManager = createConfigManager('exe:ranksConfig', './ranksConfig.js', 'Ranks', 'rankDefinitions', 'rankDefinitions');

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
export const saveSpawnConfig = spawnConfigManager.save;
export const resetSpawnConfig = spawnConfigManager.reset;

export const loadRanksConfig = ranksConfigManager.load;
export const getRanksConfig = ranksConfigManager.get;
export const saveRanksConfig = ranksConfigManager.save;
export const resetRanksConfig = ranksConfigManager.reset;

export const configResetRegistry = {
    'kits': {
        reset: resetKitsConfig,
        message: 'The \'kits\' configuration section has been reset to default.'
    },
    'shop': {
        reset: resetShopConfig,
        message: 'The \'shop\' configuration section has been reset to default.'
    },
    'spawn': {
        reset: resetSpawnConfig,
        message: 'The \'spawn\' configuration section has been reset to default.'
    },
    'ranks': {
        reset: resetRanksConfig,
        message: 'The \'ranks\' configuration section has been reset to default.'
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