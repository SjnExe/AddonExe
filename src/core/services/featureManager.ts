import { getConfig } from '@core/config/configManager.js';
import * as configs from '@core/config/configurations.js';
import { featureRegistry } from '@core/services/featureRegistry.js';
import { isDefined } from '@lib/guards.js';

export function isFeatureActive(featureId: string): boolean {
    const feature = featureRegistry.find((f) => f.id === featureId);

    const CORE_FEATURES = ['essentials', 'mod', 'ranks', 'ac', 'test'];
    if (CORE_FEATURES.includes(featureId)) {
        return true;
    }

    const parts = featureId.split('.');
    if (parts.length > 1) {
        let currentPath = parts[0];
        if (currentPath && !isFeatureActive(currentPath)) {
            return false;
        }

        for (let i = 1; i < parts.length - 1; i++) {
            currentPath += '.' + parts[i];
            if (currentPath && !isFeatureActive(currentPath)) {
                return false;
            }
        }
    }

    if (isDefined(feature)) {
        for (const dep of feature.dependencies) {
            if (!isFeatureActive(dep)) {
                return false;
            }
        }
    }

    let mainConfig: ReturnType<typeof getConfig> | undefined;
    try {
        mainConfig = getConfig();
    } catch {
        // Config might not be ready yet
    }

    switch (featureId) {
        case 'eco':
            return mainConfig ? mainConfig.economy.enabled === true : false;
        case 'soc': {
            const friendCfg = configs.getFriendConfig();
            return isDefined(friendCfg) ? friendCfg.enabled === true : true;
        }
        case 'tp':
            return true;
        case 'util':
            return true;
        case 'game': {
            const gamesCfg = configs.getGamesConfig();
            return isDefined(gamesCfg) ? gamesCfg.enabled === true : false;
        }

        case 'eco.shop':
            return mainConfig ? mainConfig.shop.enabled === true : false;
        case 'eco.ah': {
            const ahCfg = configs.getAuctionHouseConfig();
            const mainAh = mainConfig ? mainConfig.auctionHouse.enabled === true : true;
            return mainAh && (isDefined(ahCfg) ? ahCfg.enabled === true : true);
        }
        case 'eco.bounty':
            return mainConfig ? mainConfig.bounties.enabled === true : false;

        case 'util.daily': {
            const dailyCfg = configs.getDailyRewardsConfig();
            const mainDaily = mainConfig ? mainConfig.dailyRewards.enabled === true : true;
            return mainDaily && (isDefined(dailyCfg) ? dailyCfg.enabled === true : true);
        }
        case 'util.vote':
            return mainConfig ? mainConfig.voting.enabled === true : false;
        case 'util.kit':
            return mainConfig ? mainConfig.kits.enabled === true : false;
        case 'util.sidebar': {
            const sidebarCfg = configs.getSidebarConfig();
            return isDefined(sidebarCfg) ? sidebarCfg.enabled === true : false;
        }

        case 'soc.team': {
            const teamCfg = configs.getTeamConfig();
            return isDefined(teamCfg) ? teamCfg.enabled === true : false;
        }

        case 'game.tictactoe': {
            const gCfg = configs.getGamesConfig();
            return isDefined(gCfg) ? gCfg.enabled === true && gCfg.ticTacToe?.enabled !== false : false;
        }
        case 'game.wordle': {
            const gCfg = configs.getGamesConfig();
            const wCfg = configs.getWordleConfig();
            return (isDefined(gCfg) ? gCfg.wordle?.enabled !== false : true) && (isDefined(wCfg) ? wCfg.enabled === true : false);
        }

        case 'tp.home':
            return mainConfig ? mainConfig.homes.enabled === true : false;
        case 'tp.tpa':
            return mainConfig ? mainConfig.tpa.enabled === true : false;
        case 'tp.rtp':
            return mainConfig ? mainConfig.rtp.enabled === true : false;
        case 'tp.warp':
            return mainConfig ? mainConfig.warps.enabled === true : false;
        case 'tp.back':
            return mainConfig ? mainConfig.back.enabled === true : false;
        case 'tp.spawn':
            return true;

        default:
            return true;
    }
}
