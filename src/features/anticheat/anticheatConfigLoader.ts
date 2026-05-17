import createConfigManager from '@core/configManagerFactory.js';

import { anticheatConfig } from '@features/anticheat/anticheatConfig.js';

export type AnticheatConfig = typeof anticheatConfig;

const configManager = createConfigManager<AnticheatConfig>('exe:anticheatConfig:current', anticheatConfig, 'AntiCheat');

export const loadAnticheatConfig = (isMigration: boolean) => {
    // Note: To support file-based config, we would need to copy anticheatConfig.js to the build output.
    // For now, we rely on the internal default and dynamic properties.
    configManager.load(isMigration);
};

export const getAnticheatConfig = () => configManager.get();
export const saveAnticheatConfig = (cfg: AnticheatConfig) => configManager.set(cfg);
