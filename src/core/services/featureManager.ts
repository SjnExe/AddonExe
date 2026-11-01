import { getConfig } from '@core/config/configManager.js';
import * as configs from '@core/config/configurations.js';

export function isFeatureActive(featureId: string): boolean {
  let mainConfig: ReturnType<typeof getConfig> | undefined;
  try {
    mainConfig = getConfig();
  } catch {
    // Config might not be ready yet
  }

  switch (featureId) {
    case 'eco':
      return mainConfig?.economy?.enabled === true;
    case 'eco.shop':
      return mainConfig?.shop?.enabled === true;
    case 'eco.ah':
      return mainConfig?.auctionHouse?.enabled === true;
    case 'eco.bounty':
      return mainConfig?.bounties?.enabled === true;
    case 'eco.trade':
      return mainConfig?.trading?.enabled === true;
    case 'eco.bank':
      return mainConfig?.bank?.enabled === true;
    case 'eco.playtime':
      return mainConfig?.playtimeRewards?.enabled === true;

    case 'util.daily':
      return mainConfig?.dailyRewards?.enabled === true;
    case 'util.kit':
      return mainConfig?.kits?.enabled === true;
    case 'util.vote':
      return mainConfig?.voting?.enabled === true;
    case 'util.sidebar':
      return configs.getSidebarConfig()?.enabled === true;

    case 'soc':
      return configs.getFriendConfig()?.enabled === true;
    case 'soc.team':
      return configs.getTeamConfig()?.enabled === true;
    case 'soc.mail':
      return mainConfig?.mail?.enabled === true;

    case 'game':
      return configs.getGamesConfig()?.enabled === true;
    case 'game.tictactoe':
      return configs.getGamesConfig()?.ticTacToe?.enabled === true;
    case 'game.rps':
      return configs.getGamesConfig()?.rps?.enabled === true;
    case 'game.minesweeper':
      return configs.getGamesConfig()?.minesweeper?.enabled === true;
    case 'game.coinflip':
      return configs.getGamesConfig()?.coinFlip?.enabled === true;
    case 'game.2048':
      return configs.getGamesConfig()?.game2048?.enabled === true;
    case 'game.connect4':
      return configs.getGamesConfig()?.connect4?.enabled === true;
    case 'game.codebreaker':
      return configs.getGamesConfig()?.codebreaker?.enabled === true;
    case 'game.scramble':
      return configs.getGamesConfig()?.scramble?.enabled === true;
    case 'game.fastmath':
      return configs.getGamesConfig()?.fastMath?.enabled === true;
    case 'game.numberguess':
      return configs.getGamesConfig()?.numberGuess?.enabled === true;
    case 'game.wordle':
      return configs.getWordleConfig()?.enabled === true;

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
