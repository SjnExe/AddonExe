import createConfigManager from './configManagerFactory.js';

const kitsConfigManager = createConfigManager('exe:kitsConfig:current', './kitsConfig.js', 'Kits', 'kitsConfig');
const shopConfigManager = createConfigManager('exe:shopConfig:current', './shopConfig.js', 'Shop', 'shopConfig');
const ranksConfigManager = createConfigManager('exe:ranksConfig', './ranksConfig.js', 'Ranks', 'rankDefinitions', 'rankDefinitions');

export const loadKitsConfig = kitsConfigManager.load;
export const getKitsConfig = kitsConfigManager.get;
export const saveKitsConfig = kitsConfigManager.save;
export const resetKitsConfig = kitsConfigManager.reset;

export const loadShopConfig = shopConfigManager.load;
export const getShopConfig = shopConfigManager.get;
export const saveShopConfig = shopConfigManager.save;
export const resetShopConfig = shopConfigManager.reset;

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
    // Currently, only the main config manager supports reloading,
    // but this function can be expanded if others do in the future.
    // The individual managers like kits, shop, etc., are not designed for live reload.
    // The main config reload is handled separately in main.js.
}