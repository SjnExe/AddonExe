import createConfigManager from './configManagerFactory.js';
import { kitsConfig as defaultKitsConfig } from './kitsConfig.js';

const kitsConfigManager = createConfigManager('exe:kitsConfig:current', defaultKitsConfig, 'Kits');

export const loadKitsConfig = kitsConfigManager.load;
export const getKitsConfig = kitsConfigManager.get;
export const saveKitsConfig = kitsConfigManager.save;
export const resetKitsConfig = kitsConfigManager.reset;