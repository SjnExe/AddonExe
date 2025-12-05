import * as mc from '@minecraft/server';

import { errorLog } from '@core/logger.js';
import { sendMessage } from '@core/messaging.js';
import { findPlayerByName } from '@core/playerCache.js';
import { getPlayer } from '@core/playerDataManager.js';

import { CommandExecutor, CustomCommand } from './commandManager.js';

// --- Gamemode Definitions ---

const gamemodes: Record<string, mc.GameMode> = {
    survival: mc.GameMode.Survival,
    s: mc.GameMode.Survival,
    creative: mc.GameMode.Creative,
    c: mc.GameMode.Creative,
    adventure: mc.GameMode.Adventure,
    a: mc.GameMode.Adventure,
    spectator: mc.GameMode.Spectator,
    sp: mc.GameMode.Spectator
};

const gamemodeNames = new Map<mc.GameMode, string>([
    [mc.GameMode.Survival, 'Survival'],
    [mc.GameMode.Creative, 'Creative'],
    [mc.GameMode.Adventure, 'Adventure'],
    [mc.GameMode.Spectator, 'Spectator']
]);

// --- Core Logic ---

function setGamemode(executor: CommandExecutor, gamemode: string, targetName?: string): void {
    let targetPlayer: mc.Player | undefined;

    if (targetName) {
        targetPlayer = findPlayerByName(targetName);
        if (!targetPlayer) {
            sendMessage(`§cPlayer "${targetName}" not found.`);
            return;
        }
    } else {
        if (!(executor instanceof mc.Player)) {
            sendMessage('§cYou must specify a target player when running this command from the console.');
            return;
        }
        targetPlayer = executor;
    }

    // Permission check: Ensure executor isn't targeting a higher/equal rank
    if (executor instanceof mc.Player && executor.id !== targetPlayer.id) {
        const executorData = getPlayer(executor.id);
        const targetData = getPlayer(targetPlayer.id);
        if (executorData && targetData && executorData.permissionLevel >= targetData.permissionLevel) {
            sendMessage('§cYou cannot change the gamemode of a player with the same or higher rank.');
            return;
        }
    }

    const gameModeValue = gamemodes[gamemode.toLowerCase()];
    if (gameModeValue === undefined) {
        sendMessage(`§cInvalid gamemode specified: ${gamemode}`);
        return;
    }

    try {
        targetPlayer.setGameMode(gameModeValue);
        const gamemodeName = gamemodeNames.get(gameModeValue);
        const announcer = executor instanceof mc.Player ? executor.name : 'Console';

        if (executor instanceof mc.Player && executor.id === targetPlayer.id) {
            sendMessage(`§aYour gamemode has been set to §e${gamemodeName}§a.`);
        } else {
            sendMessage(`§aSuccessfully set §e${targetPlayer.name}§a's gamemode to §e${gamemodeName}§a.`);
            sendMessage(`§aYour gamemode was set to §e${gamemodeName}§a by §e${announcer}§a.`, targetPlayer);
        }
    } catch (e: unknown) {
        sendMessage('§cFailed to set gamemode. Please check the console for details.');
        if (e instanceof Error) {
            errorLog(`[/gamemode] Failed to set gamemode for ${targetPlayer.name}: ${e.stack}`);
        }
    }
}

// --- Command Definitions ---

const mainGamemodeCommand: CustomCommand = {
    name: 'gamemode',
    aliases: ['gm'],
    description: "Sets your or another player's gamemode.",
    category: 'Administration',
    permissionLevel: 1,
    allowConsole: true,
    parameters: [
        {
            name: 'gamemode',
            type: 'string',
            description: 'Gamemode (s, c, a, sp, or full name)',
            enumOptions: Object.keys(gamemodes)
        },
        { name: 'target', type: 'string', description: 'The target player name', optional: true }
    ],
    execute: (executor, args) => {
        const { gamemode, target } = args;
        setGamemode(executor, gamemode as string, target as string | undefined);
    }
};

interface LegacyCommandDef {
    name: string;
    aliases: string[];
    gamemode: string;
    description: string;
}

const legacyCommandDefs: LegacyCommandDef[] = [
    { name: 'gms', aliases: ['s', 'survival'], gamemode: 'survival', description: 'Sets your gamemode to Survival.' },
    { name: 'gmc', aliases: ['c', 'creative'], gamemode: 'creative', description: 'Sets your gamemode to Creative.' },
    {
        name: 'gma',
        aliases: ['a', 'adventure'],
        gamemode: 'adventure',
        description: 'Sets your gamemode to Adventure.'
    },
    {
        name: 'gmsp',
        aliases: ['sp', 'spectator'],
        gamemode: 'spectator',
        description: 'Sets your gamemode to Spectator.'
    }
];

const legacyCommands: CustomCommand[] = legacyCommandDefs.map((cmd) => ({
    name: cmd.name,
    aliases: cmd.aliases,
    description: cmd.description,
    category: 'Administration',
    permissionLevel: 1,
    allowConsole: true,
    parameters: [{ name: 'target', type: 'string', description: 'The player to set the gamemode for', optional: true }],
    execute: (executor, args) => {
        const { target } = args;
        setGamemode(executor, cmd.gamemode, target as string | undefined);
    }
}));

export default [mainGamemodeCommand, ...legacyCommands];
