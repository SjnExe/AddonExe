import * as mc from '@minecraft/server';

import { config } from '@core/../config.js';
import { errorLog } from '@core/logger.js';
import { sendMessage } from '@core/messaging.js';
import { canTarget } from '@core/rankManager.js';

import { CommandExecutor, CustomCommand } from '@commands/commandManager.js';

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

function setGamemode(executor: CommandExecutor, gamemode: string, targets?: mc.Player[]): void {
    if (!targets || targets.length === 0) {
        if (executor instanceof mc.Player) {
            targets = [executor];
        } else {
            sendMessage('§cYou must specify a target player when running this command from the console.');
            return;
        }
    }

    const gameModeValue = gamemodes[gamemode.toLowerCase()];
    if (gameModeValue === undefined) {
        sendMessage(`§cInvalid gamemode specified: ${gamemode}`, executor);
        return;
    }

    const gamemodeName = gamemodeNames.get(gameModeValue);
    const announcer = executor instanceof mc.Player ? executor.name : 'Console';

    let successCount = 0;

    for (const targetPlayer of targets) {
        // Permission check
        if (executor instanceof mc.Player && executor.id !== targetPlayer.id) {
            if (!canTarget(executor, targetPlayer.id, config)) {
                sendMessage(`§cSkipped ${targetPlayer.name}: You cannot change their gamemode (equal/higher rank).`, executor);
                continue;
            }
        }

        try {
            targetPlayer.setGameMode(gameModeValue);
            sendMessage(`§aYour gamemode was set to §e${gamemodeName}§a by §e${announcer}§a.`, targetPlayer);
            successCount++;
        } catch (error: unknown) {
            if (error instanceof Error) {
                errorLog(`[/gamemode] Failed to set gamemode for ${targetPlayer.name}: ${error.stack}`);
            }
        }
    }

    if (successCount > 0) {
        sendMessage(`§aSuccessfully set gamemode to §e${gamemodeName}§a for ${successCount} player(s).`, executor);
    }
}

// --- Command Definitions ---

const mainGamemodeCommand: CustomCommand = {
    name: 'gamemode',
    slashName: 'xgamemode',
    aliases: ['gm'],
    description: "Sets your or another player's gamemode.",
    category: 'Administration',
    permissionNode: 'cmd.gamemode.admin',
    allowConsole: true,
    parameters: [
        {
            type: 'string',
            description: 'Gamemode (s, c, a, sp, or full name)',
            enumOptions: Object.keys(gamemodes)
        },
        { name: 'targets', type: 'player', description: 'The target player(s)', optional: true }
    ],
    execute: (executor, args) => {
        const { gamemode, targets } = args;
        setGamemode(executor, gamemode as string, targets as mc.Player[] | undefined);
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
    permissionNode: 'cmd.gamemode.admin',
    allowConsole: true,
    parameters: [{ name: 'targets', type: 'player', description: 'The player(s) to set the gamemode for', optional: true }],
    execute: (executor, args) => {
        const { targets } = args;
        setGamemode(executor, cmd.gamemode, targets as mc.Player[] | undefined);
    }
}));

export default [mainGamemodeCommand, ...legacyCommands];
