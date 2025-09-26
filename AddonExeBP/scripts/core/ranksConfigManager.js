import createConfigManager from './configManagerFactory.js';
import { rankDefinitions as defaultRanks } from './ranksConfig.js';

const ranksConfigManager = createConfigManager('exe:ranksConfig', { rankDefinitions: defaultRanks }, 'Ranks');

export const loadRanksConfig = ranksConfigManager.load;
export const getRanksConfig = ranksConfigManager.get;
export const saveRanksConfig = ranksConfigManager.save;
export const resetRanksConfig = ranksConfigManager.reset;