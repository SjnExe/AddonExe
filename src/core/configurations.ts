import * as mc from '@minecraft/server';

import { restartAnnouncer } from '../modules/commands/announcement.js';
import { initializeSpawnProtection } from '../modules/detections/spawnProtection.js';

import { loadConfig as asyncLoadConfig } from './configLoader.js';
import { getConfig } from './configManager.js';
import createConfigManager from './configManagerFactory.js';
import { setLockState } from './playerDataManager.js';
import { reloadRanks } from './rankManager.js';

let kitsConfigManager: any,
    shopConfigManager: any,
    spawnConfigManager: any,
    ranksConfigManager: any,
    economyConfigManager: any,
    xrayConfigManager: any,
    teamConfigManager: any;

export const loadKitsConfig = async (isMigration: boolean) => {
    const defaultConfig = await asyncLoadConfig('./kitsConfig.js');
    kitsConfigManager = createConfigManager('exe:kitsConfig:current', defaultConfig, 'Kits');
    await kitsConfigManager.load(isMigration);
};
export const getKitsConfig = () => kitsConfigManager.get();
export const saveKitsConfig = (config: any) => kitsConfigManager.save(config);
export const resetKitsConfig = () => kitsConfigManager.reset();

export const loadShopConfig = async (isMigration: boolean) => {
    const defaultConfig = await asyncLoadConfig('./shopConfig.js');
    shopConfigManager = createConfigManager('exe:shopConfig:current', defaultConfig, 'Shop');
    await shopConfigManager.load(isMigration);
};
export const getShopConfig = () => shopConfigManager.get();
export const saveShopConfig = (config: any) => shopConfigManager.save(config);
export const resetShopConfig = () => shopConfigManager.reset();

export const loadSpawnConfig = async (isMigration: boolean) => {
    const defaultConfig = await asyncLoadConfig('./spawnConfig.js');
    spawnConfigManager = createConfigManager('exe:spawnConfig:current', defaultConfig, 'Spawn');
    await spawnConfigManager.load(isMigration);
};
export const getSpawnConfig = () => spawnConfigManager.get();
export const saveSpawnConfig = (config: any) => spawnConfigManager.set(config);
export const resetSpawnConfig = () => spawnConfigManager.reset();

export const loadRanksConfig = async (isMigration: boolean) => {
    const defaultConfig = await asyncLoadConfig('./ranksConfig.js');
    ranksConfigManager = createConfigManager('exe:ranksConfig', defaultConfig, 'Ranks', 'rankDefinitions');
    await ranksConfigManager.load(isMigration);
};
export const getRanksConfig = () => ranksConfigManager.get();
export const saveRanksConfig = (config: any) => ranksConfigManager.set(config);
export const resetRanksConfig = () => ranksConfigManager.reset();

export const loadEconomyConfig = async (isMigration: boolean) => {
    const defaultConfig = await asyncLoadConfig('./economyConfig.js');
    economyConfigManager = createConfigManager('exe:economyConfig:current', defaultConfig, 'Economy');
    await economyConfigManager.load(isMigration);
};
export const getEconomyConfig = () => economyConfigManager.get();
export const saveEconomyConfig = (config: any) => economyConfigManager.set(config);
export const resetEconomyConfig = () => economyConfigManager.reset();

export const loadXrayConfig = async (isMigration: boolean) => {
    const defaultConfig = await asyncLoadConfig('./xrayConfig.js');
    xrayConfigManager = createConfigManager('exe:xrayConfig:current', defaultConfig, 'X-Ray');
    await xrayConfigManager.load(isMigration);
};
export const getXrayConfig = () => xrayConfigManager.get();
export const saveXrayConfig = (config: any) => xrayConfigManager.set(config);
export const resetXrayConfig = () => xrayConfigManager.reset();

export const loadTeamConfig = async (isMigration: boolean) => {
    const defaultConfig = await asyncLoadConfig('./teamConfig.js');
    teamConfigManager = createConfigManager('exe:teamConfig:current', defaultConfig, 'Teams');
    await teamConfigManager.load(isMigration);
};
export const getTeamConfig = () => teamConfigManager.get();
export const saveTeamConfig = (config: any) => teamConfigManager.set(config);
export const resetTeamConfig = () => teamConfigManager.reset();

type ResetRegistryEntry = {
    reset: () => void;
    message: string;
    postResetCallback?: (player?: mc.Player) => void;
};

export const configResetRegistry: Record<string, ResetRegistryEntry> = {
    team: {
        reset: resetTeamConfig,
        message: "The 'team' configuration section has been reset to default."
    },
    xray: {
        reset: resetXrayConfig,
        message: "The 'X-ray' configuration section has been reset to default."
    },
    economy: {
        reset: resetEconomyConfig,
        message: "The 'economy' configuration section has been reset to default."
    },
    kits: {
        reset: resetKitsConfig,
        message: "The 'kits' configuration section has been reset to default."
    },
    shop: {
        reset: resetShopConfig,
        message: "The 'shop' configuration section has been reset to default."
    },
    spawn: {
        reset: resetSpawnConfig,
        message: "The 'spawn' configuration section has been reset to default.",
        postResetCallback: (player) => {
            initializeSpawnProtection();
            if (player) {
                player.sendMessage('§aSpawn protection system has been updated based on new settings.');
            }
        }
    },
    ranks: {
        reset: resetRanksConfig,
        message: "The 'ranks' configuration section has been reset to default.",
        postResetCallback: (player) => {
            reloadRanks();
            if (player) {
                player.sendMessage('§aRanks have been reloaded with new settings.');
            }
        }
    }
};

export const configResetCallbacks: Record<string, (player?: mc.Player) => void> = {
    announcements: (player) => {
        restartAnnouncer();
        if (player) {
            player.sendMessage('§aAnnouncement system has been updated with new settings.');
        }
    },
    dimensionLock: (player) => {
        const config: any = getConfig();
        setLockState('nether', !!config.dimensionLock.lockNether);
        setLockState('end', !!config.dimensionLock.lockEnd);
        if (player) {
            player.sendMessage('§aLive dimension lock states have been updated to match config.');
        }
    }
};

export async function reloadAllConfigs() {
    // This function is a placeholder for potential future use.
}