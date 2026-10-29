import { getConfig } from '@core/config/configManager.js';
import * as configs from '@core/config/configurations.js';

export function isFeatureActive(featureId: string): boolean {
  let mainConfig: ReturnType<typeof getConfig> | undefined;
  try {
    mainConfig = getConfig();
  } catch {
    // Config might not be ready yet
  }

  const ecoOn = mainConfig?.economy?.enabled === true;

  switch (featureId) {
    case 'eco':
      return ecoOn;
    case 'eco.shop':
      return ecoOn && mainConfig?.shop?.enabled === true;
    case 'eco.ah':
      return ecoOn && mainConfig?.auctionHouse?.enabled === true && (configs.getAuctionHouseConfig()?.enabled ?? true);
    case 'eco.bounty':
      return ecoOn && mainConfig?.bounties?.enabled === true;
    case 'eco.trade':
      return ecoOn && mainConfig?.trading?.enabled === true;
    case 'eco.playtime':
      return ecoOn && mainConfig?.playtimeRewards?.enabled === true;

    case 'util.daily':
      return ecoOn && mainConfig?.dailyRewards?.enabled === true && (configs.getDailyRewardsConfig()?.enabled ?? true);
    case 'util.kit':
      return ecoOn && mainConfig?.kits?.enabled === true;
    case 'util.vote':
      return mainConfig?.voting?.enabled === true;
    case 'util.sidebar':
      return configs.getSidebarConfig()?.enabled === true;

    case 'soc':
      return configs.getFriendConfig()?.enabled ?? true;
    case 'soc.team':
      return ecoOn && (configs.getFriendConfig()?.enabled ?? true) && configs.getTeamConfig()?.enabled === true;
    case 'soc.mail':
      return (configs.getFriendConfig()?.enabled ?? true) && mainConfig?.mail?.enabled === true;

    case 'game':
      return configs.getGamesConfig()?.enabled === true;
    case 'game.tictactoe': {
      const g = configs.getGamesConfig();
      return g?.enabled === true && g.ticTacToe?.enabled !== false;
    }
    case 'game.rps': {
      const g = configs.getGamesConfig();
      return g?.enabled === true && g.rps?.enabled !== false;
    }
    case 'game.minesweeper': {
      const g = configs.getGamesConfig();
      return g?.enabled === true && g.minesweeper?.enabled !== false;
    }
    case 'game.coinflip': {
      const g = configs.getGamesConfig();
      return g?.enabled === true && g.coinFlip?.enabled !== false;
    }
    case 'game.2048': {
      const g = configs.getGamesConfig();
      return g?.enabled === true && g.game2048?.enabled !== false;
    }
    case 'game.connect4': {
      const g = configs.getGamesConfig();
      return g?.enabled === true && g.connect4?.enabled !== false;
    }
    case 'game.codebreaker': {
      const g = configs.getGamesConfig();
      return g?.enabled === true && g.codebreaker?.enabled !== false;
    }
    case 'game.scramble': {
      const g = configs.getGamesConfig();
      return g?.enabled === true && g.scramble?.enabled !== false;
    }
    case 'game.fastmath': {
      const g = configs.getGamesConfig();
      return g?.enabled === true && g.fastMath?.enabled !== false;
    }
    case 'game.numberguess': {
      const g = configs.getGamesConfig();
      return g?.enabled === true && g.numberGuess?.enabled !== false;
    }
    case 'game.wordle': {
      const g = configs.getGamesConfig();
      const w = configs.getWordleConfig();
      return g?.enabled === true && g.wordle?.enabled !== false && w?.enabled === true;
    }

    case 'tp.home':
      return mainConfig?.homes?.enabled === true;
    case 'tp.tpa':
      return mainConfig?.tpa?.enabled === true;
    case 'tp.rtp':
      return mainConfig?.rtp?.enabled === true;
    case 'tp.warp':
      return mainConfig?.warps?.enabled === true;
    case 'tp.back':
      return mainConfig?.back?.enabled === true;

    default:
      return true;
  }
}
