import createConfigManager from './configManagerFactory.js';
import { kitsConfig as defaultKitsConfig } from './kitsConfig.js';
import { shopConfig as defaultShopConfig } from './shopConfig.js';
import { rankDefinitions as defaultRanks } from './ranksConfig.js';

const kitsConfigManager = createConfigManager('exe:kitsConfig:current', defaultKitsConfig, 'Kits');
const shopConfigManager = createConfigManager('exe:shopConfig:current', defaultShopConfig, 'Shop');
const ranksConfigManager = createConfigManager('exe:ranksConfig', { rankDefinitions: defaultRanks }, 'Ranks');

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