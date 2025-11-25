import {
    GameMode,
    Player
} from '@minecraft/server';
import {
    CustomCommand,
    CommandExecutor
} from './commandManager.js';
import {
    getPlayer
} from '../../core/playerDataManager.js';
import {
    errorLog
} from '../../core/logger.js';
import {
    sendMessage
} from '../../core/messaging.js';
import * as mc from '@minecraft/server';
const gamemodes: {
    [key: string]: mc.GameMode
} = {
    'survival': mc.GameMode.Survival,
    's': mc.GameMode.Survival,
    'creative': mc.GameMode.Creative,
    'c': mc.GameMode.Creative,
    'adventure': mc.GameMode.Adventure,
    'a': mc.GameMode.Adventure,
    'spectator': mc.GameMode.Spectator,
    'sp': mc.GameMode.Spectator
};
const gamemodeNames: {
    [key in mc.GameMode] ? : string
} = {
    [mc.GameMode.Survival]: 'Survival',
    [mc.GameMode.Creative]: 'Creative',
    [mc.GameMode.Adventure]: 'Adventure',
    [mc.GameMode.Spectator]: 'Spectator'
};

function setGamemode(player: CommandExecutor, gamemode: string, target ? : mc.Player[]) {
    let targetPlayer: mc.Player;
    if (target && target.length > 0) {
        targetPlayer = target[0];
    } else {
        if (!(player instanceof mc.Player)) {
            player.sendMessage('§cYou must specify a target player when running this command from the console.');
            return;
        }
        targetPlayer = player;
    }
    if (player instanceof mc.Player) {
        const executorData = getPlayer(player.id);
        const targetData = getPlayer(targetPlayer.id);
        if (executorData && targetData && executorData.permissionLevel >= targetData.permissionLevel && player.id !== targetPlayer.id) {
            sendMessage('§cYou cannot change the gamemode of a player with the same or higher rank.', player);
            return;
        }
    }
    const gameModeValue = gamemodes[gamemode.toLowerCase()];
    if (gameModeValue === undefined) {
        player.sendMessage(`§cInvalid gamemode specified: ${gamemode}`);
        return;
    }
    try {
        targetPlayer.setGameMode(gameModeValue);
        const gamemodeName = gamemodeNames[gameModeValue];
        const announcer = !(player instanceof mc.Player) ? 'the Console' : player.name;
        if (!(player instanceof mc.Player) || player.id !== targetPlayer.id) {
            player.sendMessage(`§aSuccessfully set §e${targetPlayer.name}§a's gamemode to §e${gamemodeName}§a.`);
            sendMessage(`§aYour gamemode was set to §e${gamemodeName}§a by §e${announcer}§a.`, targetPlayer);
        } else {
            sendMessage(`§aYour gamemode has been set to §e${gamemodeName}§a.`, player);
        }
    } catch (e: any) {
        player.sendMessage('§cFailed to set gamemode. Please check the console for details.');
        errorLog(`[/gamemode] Failed to set gamemode for ${targetPlayer.name}: ${e.stack}`);
    }
}
const gamemodeCommand: CustomCommand = {
    name: 'gamemode',
    slashName: 'xgamemode',
    aliases: ['gm'],
    description: "Sets your or another player's gamemode.",
    category: 'Moderation',
    permissionLevel: 1,
    allowConsole: true,
    parameters: [{
        name: 'gamemode',
        type: 'string',
        optional: false
    }, {
        name: 'target',
        type: 'player',
        optional: true
    }],
    execute: (player, args) => {
        if (!args.gamemode) {
            player.sendMessage('§cYou must specify a gamemode.');
            return;
        }
        setGamemode(player, args.gamemode as string, args.target as Player[]);
    }
};
const legacyCommandSetup = [{
    name: 'gms',
    aliases: ['s', 'survival'],
    gamemode: 'survival',
    description: 'Sets your gamemode to Survival.'
}, {
    name: 'gmc',
    aliases: ['c', 'creative'],
    gamemode: 'creative',
    description: 'Sets your gamemode to Creative.'
}, {
    name: 'gma',
    aliases: ['a', 'adventure'],
    gamemode: 'adventure',
    description: 'Sets your gamemode to Adventure.'
}, {
    name: 'gmsp',
    aliases: ['sp', 'spectator'],
    gamemode: 'spectator',
    description: 'Sets your gamemode to Spectator.'
}];
const legacyCommands: CustomCommand[] = legacyCommandSetup.map(cmd => ({
    name: cmd.name,
    aliases: cmd.aliases,
    description: cmd.description,
    category: 'Moderation',
    permissionLevel: 1,
    allowConsole: true,
    parameters: [{
        name: 'target',
        type: 'player',
        optional: true
    }],
    execute: (player, args) => {
        setGamemode(player, cmd.gamemode, args.target as Player[]);
    }
}));
export default [gamemodeCommand, ...legacyCommands];