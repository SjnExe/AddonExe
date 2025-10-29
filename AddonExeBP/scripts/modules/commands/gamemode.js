/**
 * @fileoverview
 * This file manages the /gamemode command and its legacy aliases (/gms, /gmc, etc.),
 * allowing players with appropriate permissions to change their own or another player's gamemode.
 * It ensures that permission levels are respected, preventing unauthorized changes.
 *
 * @author AddonExe
 * @version 1.0.0
 */

import { commandManager } from './commandManager.js';
import { GameMode } from '@minecraft/server';
import { getPlayer } from '../../core/playerDataManager.js';
import { errorLog } from '../../core/logger.js';
import { sendMessage } from '../../core/messaging.js';

/**
 * A map of gamemode aliases to their corresponding GameMode enum values.
 * @type {Object<string, GameMode>}
 */
const gamemodes = {
    'survival': GameMode.Survival, 's': GameMode.Survival,
    'creative': GameMode.Creative, 'c': GameMode.Creative,
    'adventure': GameMode.Adventure, 'a': GameMode.Adventure,
    'spectator': GameMode.Spectator, 'sp': GameMode.Spectator
};

/**
 * A map of GameMode enum values to their display names.
 * @type {Object<GameMode, string>}
 */
const gamemodeNames = {
    [GameMode.Survival]: 'Survival',
    [GameMode.Creative]: 'Creative',
    [GameMode.Adventure]: 'Adventure',
    [GameMode.Spectator]: 'Spectator'
};

/**
 * Sets the gamemode for a target player after performing necessary checks.
 * @param {import('@minecraft/server').Player | object} player The player or console instance executing the command.
 * @param {string} gamemode The string representing the gamemode to set.
 * @param {import('@minecraft/server').Player[]} [target] An optional array containing the target player.
 */
function setGamemode(player, gamemode, target) {
    let targetPlayer;
    if (target && target.length > 0) {
        targetPlayer = target[0];
    } else {
        if (player.isConsole) {
            sendMessage('§cYou must specify a target player when running this command from the console.', player);
            return;
        }
        targetPlayer = player;
    }

    // Permission check: Ensure executor isn't targeting a higher/equal rank
    if (!player.isConsole) {
        const executorData = getPlayer(player.id);
        const targetData = getPlayer(targetPlayer.id);
        if (executorData && targetData && executorData.permissionLevel >= targetData.permissionLevel && player.id !== targetPlayer.id) {
            sendMessage('§cYou cannot change the gamemode of a player with the same or higher rank.', player);
            return;
        }
    }

    const gameModeValue = gamemodes[gamemode.toLowerCase()];
    if (gameModeValue === undefined) {
        sendMessage(`§cInvalid gamemode specified: ${gamemode}`, player);
        return;
    }

    try {
        targetPlayer.setGameMode(gameModeValue);
        const gamemodeName = gamemodeNames[gameModeValue];
        const announcer = player.isConsole ? 'the Console' : player.name;

        // Announce the change
        if (player.isConsole || player.id !== targetPlayer.id) {
            sendMessage(`§aSuccessfully set §e${targetPlayer.name}§a's gamemode to §e${gamemodeName}§a.`, player);
            sendMessage(`§aYour gamemode was set to §e${gamemodeName}§a by §e${announcer}§a.`, targetPlayer);
        } else {
            sendMessage(`§aYour gamemode has been set to §e${gamemodeName}§a.`, player);
        }
    } catch (e) {
        sendMessage('§cFailed to set gamemode. Please check the console for details.', player);
        errorLog(`[/gamemode] Failed to set gamemode for ${targetPlayer.name}: ${e.stack}`);
    }
}

// --- Main /gamemode Command Registration ---
commandManager.register({
    name: 'gamemode',
    slashName: 'xgamemode',
    aliases: ['gm'],
    description: "Sets your or another player's gamemode.",
    category: 'Moderation',
    permissionLevel: 1,
    allowConsole: true,
    disableSlashCommand: false,
    parameters: [
        { name: 'gamemode', type: 'string', description: 'Gamemode (s, c, a, sp, or full name)', optional: false },
        { name: 'target', type: 'player', description: 'The target player', optional: true }
    ],
    /**
     * @param {import('@minecraft/server').Player | object} player
     * @param {object} args
     */
    execute: (player, args) => {
        if (!args.gamemode) {
            sendMessage('§cYou must specify a gamemode.', player);
            return;
        }
        setGamemode(player, args.gamemode, args.target);
    }
});

// --- Legacy Gamemode Command Registration ---
const legacyCommandSetup = [
    { name: 'gms', aliases: ['s', 'survival'], gamemode: 'survival', description: 'Sets your gamemode to Survival.' },
    { name: 'gmc', aliases: ['c', 'creative'], gamemode: 'creative', description: 'Sets your gamemode to Creative.' },
    { name: 'gma', aliases: ['a', 'adventure'], gamemode: 'adventure', description: 'Sets your gamemode to Adventure.' },
    { name: 'gmsp', aliases: ['sp', 'spectator'], gamemode: 'spectator', description: 'Sets your gamemode to Spectator.' }
];

for (const cmd of legacyCommandSetup) {
    commandManager.register({
        name: cmd.name,
        aliases: cmd.aliases,
        description: cmd.description,
        category: 'Moderation',
        permissionLevel: 1,
        allowConsole: true,
        disableSlashCommand: false,
        parameters: [
            { name: 'target', type: 'player', description: 'The player to set the gamemode for', optional: true }
        ],
        /**
         * @param {import('@minecraft/server').Player | object} player
         * @param {object} args
         */
        execute: (player, args) => {
            setGamemode(player, cmd.gamemode, args.target);
        }
    });
}
