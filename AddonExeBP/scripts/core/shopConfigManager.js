import createConfigManager from './configManagerFactory.js';
import { shopConfig as defaultShopConfig } from './shopConfig.js';

const shopConfigManager = createConfigManager('exe:shopConfig:current', defaultShopConfig, 'Shop');

export const loadShopConfig = shopConfigManager.load;
export const getShopConfig = shopConfigManager.get;
export const saveShopConfig = shopConfigManager.save;
export const resetShopConfig = shopConfigManager.reset;