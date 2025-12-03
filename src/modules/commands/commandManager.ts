import * as mc from '@minecraft/server';

import { getConfig } from '@core/configManager.js';
import { getCooldown, setCooldownCustom } from '@core/cooldownManager.js';
import { errorLog, debugLog } from '@core/logger.js';
import { findPlayerByName } from '@core/playerCache.js';
import { getPlayer } from '@core/playerDataManager.js';

// --- Type Definitions ---

/**
 * Represents a parameter for a custom command.
 */
export interface CommandParameter {
    /** The name of the parameter. */
    name: string;
    /** The data type of the parameter. */
    type: 'player' | 'string' | 'text' | 'int' | 'float' | 'boolean' | 'block' | 'item' | 'position' | 'target';
    /** Whether the parameter is optional. */
    optional?: boolean;
    /** A list of possible values for an enum parameter. */
    enumOptions?: string[];
    /** A brief description of the parameter. */
    description?: string;
}

/**
 * Represents the entity executing a command, which can be a player or the console.
 */
export type CommandExecutor =
    | mc.Player
    | {
          isConsole: true;
          sendMessage: (message: string) => void;
      };

/**
 * Represents the structure for defining a custom command.
 */
export interface CustomCommand {
    /** The primary name of the command. */
    name: string;
    /** A brief description of what the command does. */
    description: string;
    /** The UI category for the command. */
    category?: string;
    /** The required permission level to execute the command. Defaults to 0 (Owner). */
    permissionLevel?: number;
    /** An array of alternative names for the command. */
    aliases?: string[];
    /** An array of parameters the command accepts. */
    parameters?: CommandParameter[];
    /** The function to execute when the command is run. */
    execute: (executor: CommandExecutor, args: Record<string, unknown>) => void | Promise<void>;
    /** Whether the command can be run from the server console. Defaults to false. */
    allowConsole?: boolean;
    /** Whether the command has a cooldown. */
    hasCooldown?: boolean;
    /** A unique identifier for the command's cooldown. Defaults to the command name. */
    cooldownId?: string;
    /** Default cooldown duration in seconds. */
    defaultCooldown?: number;
    /** If true, the command will not be registered as a slash command. */
    disableSlashCommand?: boolean;
    /** A list of aliases that should not be registered as slash commands. */
    disabledSlashAliases?: string[];
    /** An alternative name to use for the slash command registration. */
    slashName?: string;
}

interface CommandSettings {
    [key: string]: {
        enabled?: boolean;
        permissionLevel?: number;
    };
}

interface Config {
    commandSettings: CommandSettings;
    commandPrefix: string;
}

/**
 * Manages the registration and execution of both slash and chat commands.
 */
class CommandManager {
    public commands: Map<string, CustomCommand> = new Map();
    public aliases: Map<string, string> = new Map();
    private registeredSlashCommands = new Set<string>();
    private readonly prefix = 'exe'; // Namespace for all custom commands
    private vanillaCommands = new Set([
        'tp',
        'teleport',
        'kick',
        'list',
        'help',
        'clear',
        'difficulty',
        'gamemode',
        'gamerule',
        'give',
        'kill',
        'locate',
        'me',
        'msg',
        'op',
        'deop',
        'reload',
        'say',
        'save',
        'setblock',
        'setworldspawn',
        'spawnpoint',
        'stop',
        'summon',
        'tag',
        'tell',
        'testfor',
        'time',
        'title',
        'toggledownfall',
        'transfer',
        'w',
        'weather',
        'xp',
        '?'
    ]);

    constructor() {
        infoLog('[CommandManager] Subscribing to startup event for slash commands.');
        mc.system.beforeEvents.startup.subscribe(
            ({ customCommandRegistry }: { customCommandRegistry: mc.CustomCommandRegistry }) => {
                infoLog('[CommandManager] Startup event received. Registering slash commands...');
                this.commands.forEach((command) => {
                    if (command.disableSlashCommand) {
                        return;
                    }

                    // Register the primary command name
                    this._registerSlashCommand(customCommandRegistry, command, command.slashName || command.name);

                    // Register all aliases as separate slash commands
                    if (command.aliases) {
                        command.aliases.forEach((alias) => {
                            if (command.disabledSlashAliases && command.disabledSlashAliases.includes(alias)) {
                                return; // Skip slash command registration for this alias
                            }
                            this._registerSlashCommand(customCommandRegistry, command, alias);
                        });
                    }
                });
            }
        );
    }

    /**
     * Registers a new command.
     * @param {CustomCommand} commandOptions
     */
    register(commandOptions: CustomCommand) {
        const command: CustomCommand = { permissionLevel: 0, ...commandOptions };
        this.commands.set(command.name.toLowerCase(), command);

        if (command.aliases) {
            for (const alias of command.aliases) {
                this.aliases.set(alias.toLowerCase(), command.name.toLowerCase());
            }
        }
    }

    /**
     * Gets all registered commands.
     * @returns {CustomCommand[]} An array of all registered commands.
     */
    getAllCommands(): CustomCommand[] {
        return Array.from(this.commands.values());
    }

    /**
     * Gets the effective permission level for a command, considering config overrides.
     * @param {CustomCommand} command The command to check.
     * @returns {number} The effective permission level.
     */
    getEffectivePermissionLevel(command: CustomCommand): number {
        const config = getConfig() as Config;
        const commandSettings = config.commandSettings[command.name] || {};
        return commandSettings.permissionLevel !== undefined
            ? commandSettings.permissionLevel
            : (command.permissionLevel ?? 0);
    }

    /**
     * Checks if a command is effectively enabled, considering config overrides.
     * @param {CustomCommand} command The command to check.
     * @returns {boolean} True if the command is enabled.
     */
    isCommandEnabled(command: CustomCommand): boolean {
        const config = getConfig() as Config;
        const commandSettings = config.commandSettings[command.name] || {};
        return commandSettings.enabled !== false;
    }

    /**
     * The core command execution logic, shared by slash and chat commands.
     * @param {CommandExecutor} executor The player or a console identifier.
     * @param {CustomCommand} command The command to execute.
     * @param {Record<string, unknown>} args The parsed arguments for the command.
     * @private
     */
    private _executeCommand(executor: CommandExecutor, command: CustomCommand, args: Record<string, unknown>) {
        const config = getConfig() as Config;
        const commandSettings = config.commandSettings[command.name] || {};

        if (commandSettings.enabled === false) {
            if ('sendMessage' in executor) {
                executor.sendMessage('§cThis command is currently disabled.');
            }
            return;
        }

        const isPlayer = 'id' in executor; // Check if it's a player or console object

        // --- Console Execution ---
        if (!isPlayer) {
            if (!command.allowConsole) {
                executor.sendMessage(`[CommandManager] Command '${command.name}' cannot be run from the console.`);
                return;
            }
            mc.system.run(() => {
                try {
                    const result = command.execute(executor, args);
                    if (result instanceof Promise) {
                        void result.catch((error: unknown) => {
                            const stack = error instanceof Error ? error.stack : String(error);
                            executor.sendMessage(
                                `[CommandManager] Error executing async console command '${command.name}': ${stack}`
                            );
                        });
                    }
                } catch (error: unknown) {
                    const stack = error instanceof Error ? error.stack : String(error);
                    executor.sendMessage(
                        `[CommandManager] Error executing console command '${command.name}': ${stack}`
                    );
                }
            });
            return;
        }

        // --- Player Execution ---
        const player = executor;

        // Cooldown Check
        if (command.hasCooldown) {
            const cooldownId = command.cooldownId || command.name;
            const remainingCooldown = getCooldown(player.id, cooldownId);
            if (remainingCooldown > 0) {
                player.sendMessage(`§cYou must wait ${remainingCooldown} more second(s) to use this command.`);
                return;
            }
        }

        // Permission Check
        const pData = getPlayer(player.id);
        const requiredPermissionLevel = this.getEffectivePermissionLevel(command);

        if (!pData || pData.permissionLevel > requiredPermissionLevel) {
            player.sendMessage('§cYou do not have permission to use this command.');
            return;
        }

        // Execute Command
        mc.system.run(() => {
            try {
                const result = command.execute(player, args);
                if (result instanceof Promise) {
                    void result.catch((error: unknown) => {
                        const stack = error instanceof Error ? error.stack : String(error);
                        errorLog(
                            `[CommandManager] Error executing async command '${command.name}' for player '${player.name}': ${stack}`
                        );
                        player.sendMessage('§cAn unexpected error occurred while running this command.');
                    });
                }

                // Set Cooldown
                if (command.hasCooldown) {
                    const cooldownId = command.cooldownId || command.name;
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    const cmdConfig = (config.commandSettings as any)[command.name];
                    const duration = cmdConfig?.cooldownSeconds ?? command.defaultCooldown ?? 0;
                    if (duration > 0) {
                        setCooldownCustom(player.id, cooldownId, duration);
                    }
                }
            } catch (error: unknown) {
                const stack = error instanceof Error ? error.stack : String(error);
                errorLog(
                    `[CommandManager] Error executing command '${command.name}' for player '${player.name}': ${stack}`
                );
                player.sendMessage('§cAn unexpected error occurred while running this command.');
            }
        });
    }

    /**
     * Generates a usage string for a command.
     * @param {CustomCommand} command
     * @returns {string} e.g. "Usage: /gm [s|c|a] <target>"
     */
    getUsageString(command: CustomCommand): string {
        const params = command.parameters || [];
        const parts = params.map((p) => {
            if (p.optional) {
                return `[${p.name}]`;
            } else {
                if (p.enumOptions && p.enumOptions.length <= 4) {
                    return `<${p.enumOptions.join('|')}>`;
                }
                return `<${p.name}>`;
            }
        });
        return `Usage: /${command.name} ${parts.join(' ')}`;
    }

    /**
     * Registers a single slash command or alias.
     * @param {mc.CustomCommandRegistry} customCommandRegistry The registry object from the startup event.
     * @param {CustomCommand} command The command definition.
     * @param {string} name The name to register (either primary or an alias).
     * @param {boolean} isRetry Whether this is a retry attempt (e.g. after collision).
     * @private
     */
    private _registerSlashCommand(
        customCommandRegistry: mc.CustomCommandRegistry,
        command: CustomCommand,
        name: string,
        isRetry = false
    ) {
        if (this.registeredSlashCommands.has(name)) {
            return;
        }

        debugLog(`[CommandManager] Attempting to register slash command: ${name}`);

        // Check for vanilla collision before registering
        if (!isRetry && this.vanillaCommands.has(name)) {
            const newName = `x${name}`;
            debugLog(`[CommandManager] Collision detected for '${name}'. Retrying as '${newName}'.`);
            this._registerSlashCommand(customCommandRegistry, command, newName, true);
            return;
        }

        const commandData = this.prepareCommandData(command, name, customCommandRegistry);

        const commandCallback = (origin: mc.CustomCommandOrigin, ...rawArgs: unknown[]) => {
            const executor: CommandExecutor = (origin.sourceEntity as mc.Player) || {
                isConsole: true,
                sendMessage: (msg: string) => errorLog(msg.replace(/§[0-9a-fklmnor]/g, ''))
            };

            // Prepare arguments
            const allParams = command.parameters || [];
            const parsedArgs: Record<string, unknown> = {};
            for (let i = 0; i < allParams.length; i++) {
                if (rawArgs[i] !== undefined) {
                    parsedArgs[allParams[i].name] = rawArgs[i];
                }
            }
            this._executeCommand(executor, command, parsedArgs);
            return undefined;
        };

        try {
            customCommandRegistry.registerCommand(commandData, commandCallback);
            this.registeredSlashCommands.add(name);
            debugLog(`[CommandManager] Successfully registered slash command: ${name}`);
        } catch (e: unknown) {
            const errStr = String(e);
            if (errStr.includes('already in use')) {
                if (!isRetry) {
                    const newName = `x${name}`;
                    errorLog(`[CommandManager] Command alias '${name}' collision. Retrying as '${newName}'.`);
                    this._registerSlashCommand(customCommandRegistry, command, newName, true);
                    return;
                }
            }
            if (e instanceof Error) {
                errorLog(`[CommandManager] Failed to register slash command '${name}':`, e);
            }
        }
    }

    /**
     * Prepares the command data for registration with the Minecraft API.
     * @param {CustomCommand} command The command definition.
     * @param {string} nameOverride The specific name to use for this registration (main name or alias).
     * @param {mc.CustomCommandRegistry} registry The custom command registry for enum registration.
     * @returns {mc.CustomCommand} The formatted command data.
     * @private
     */
    private prepareCommandData(
        command: CustomCommand,
        nameOverride: string,
        registry: mc.CustomCommandRegistry
    ): mc.CustomCommand {
        const slashCommandName = nameOverride || command.slashName || command.name;
        const mandatoryParameters = (command.parameters || [])
            .filter((p) => !p.optional)
            .map((p) => this.formatParameter(p, slashCommandName, registry));
        const optionalParameters = (command.parameters || [])
            .filter((p) => p.optional)
            .map((p) => this.formatParameter(p, slashCommandName, registry));

        return {
            name: `${this.prefix}:${slashCommandName}`,
            description: command.description,
            permissionLevel: this.translatePermissionLevel(command.permissionLevel),
            mandatoryParameters,
            optionalParameters
        };
    }

    /**
     * Formats a parameter for registration with the Minecraft API.
     * @param {CommandParameter} param The parameter definition.
     * @param {string} commandName The name of the command (for unique enum naming).
     * @param {mc.CustomCommandRegistry} registry The registry to register enums with.
     * @returns {mc.CustomCommandParameter} The formatted parameter data.
     * @private
     */
    private formatParameter(
        param: CommandParameter,
        commandName: string,
        registry: mc.CustomCommandRegistry
    ): mc.CustomCommandParameter {
        // --- Enum Handling ---
        if (param.enumOptions && Array.isArray(param.enumOptions) && registry) {
            const safeCmdName = (commandName || 'cmd').replace(/[^a-zA-Z0-9_]/g, '');
            const safeParamName = param.name.replace(/[^a-zA-Z0-9_]/g, '');
            const enumName = `${this.prefix}:${safeCmdName}_${safeParamName}`;

            try {
                registry.registerEnum(enumName, param.enumOptions);
            } catch (e) {
                // Ignore if enum already exists (e.g. alias sharing same params)
                // But log other errors to debug issues
                const errStr = String(e);
                if (!errStr.includes('already exists')) {
                    errorLog(`[CommandManager] Failed to register enum '${enumName}':`, e);
                }
            }

            return {
                name: param.name,
                type: mc.CustomCommandParamType.Enum,
                enumName: enumName
            };
        }

        // --- Standard Types ---
        const paramTypeMap: Record<string, mc.CustomCommandParamType> = {
            player: mc.CustomCommandParamType.PlayerSelector,
            string: mc.CustomCommandParamType.String,
            text: mc.CustomCommandParamType.String, // For greedy strings
            int: mc.CustomCommandParamType.Integer,
            float: mc.CustomCommandParamType.Float,
            boolean: mc.CustomCommandParamType.Boolean,
            block: mc.CustomCommandParamType.BlockType,
            item: mc.CustomCommandParamType.ItemType,
            position: mc.CustomCommandParamType.String, // Reverted to string for safety
            target: mc.CustomCommandParamType.PlayerSelector
        };

        const type = paramTypeMap[param.type.toLowerCase()];

        if (!type) {
            errorLog(
                `[CommandManager] Unknown parameter type '${param.type}' for parameter '${param.name}'. Defaulting to String.`
            );
            return {
                name: param.name,
                type: mc.CustomCommandParamType.String
            };
        }

        return {
            name: param.name,
            type: type
        };
    }

    /**
     * Translates the numeric permission level to the API's enum.
     * @param {number | undefined} level The numeric permission level.
     * @returns {mc.CommandPermissionLevel} The corresponding enum value.
     * @private
     */
    private translatePermissionLevel(_level?: number): mc.CommandPermissionLevel {
        // We will handle all permission checks with our custom rank system.
        // Registering all commands with 'Any' allows our more granular check to be the single source of truth.
        return mc.CommandPermissionLevel.Any;
    }

    // --- Chat Command Management ---

    /**
     * Handles an incoming chat message and schedules it for execution if it's a valid command.
     * @param {mc.ChatSendBeforeEvent} eventData The chat event data.
     * @returns {boolean} `true` if the message was a command, otherwise `false`.
     */
    handleChatCommand(eventData: mc.ChatSendBeforeEvent): boolean {
        const config = getConfig() as Config;
        const { sender: player, message } = eventData;
        if (!message.startsWith(config.commandPrefix)) {
            return false;
        }

        debugLog(`[CommandManager] Intercepted chat command: ${message}`);
        eventData.cancel = true;

        // Using a regex to split by spaces while respecting quoted strings.
        const commandString = message.slice(config.commandPrefix.length).trim();
        const rawArgs = commandString.match(/"[^"]*"|'[^']*'|\S+/g) || [];
        if (rawArgs.length === 0) {
            return true;
        }

        const cleanedArgs = rawArgs.map((arg: string) =>
            (arg.startsWith('"') && arg.endsWith('"')) || (arg.startsWith("'") && arg.endsWith("'"))
                ? arg.slice(1, -1)
                : arg
        );
        let commandName = cleanedArgs.shift()!.toLowerCase();

        // Resolve alias to primary command name
        commandName = this.aliases.get(commandName) || commandName;
        const command = this.commands.get(commandName);

        if (!command) {
            player.sendMessage(`§cUnknown command: ${commandName}`);
            return true;
        }

        const commandSettings = config.commandSettings[command.name] || {};
        if (commandSettings.enabled === false) {
            player.sendMessage('§cThis command is currently disabled.');
            return true;
        }

        // --- Argument Parsing ---
        const parsedArgs: Record<string, unknown> = {};
        const paramDefs = command.parameters || [];
        let currentArgIndex = 0;

        for (const paramDef of paramDefs) {
            if (currentArgIndex >= cleanedArgs.length) {
                if (!paramDef.optional) {
                    const usage = this.getUsageString(command);
                    player.sendMessage(`§cMissing required argument: ${paramDef.name}.\n${usage}`);
                    return true; // Stop execution
                }
                break; // No more args to process
            }

            const rawValue = cleanedArgs[currentArgIndex];

            if (paramDef.type === 'text') {
                // Greedy parameter (consumes the rest)
                parsedArgs[paramDef.name] = cleanedArgs.slice(currentArgIndex).join(' ');
                currentArgIndex = cleanedArgs.length; // Mark all as consumed
                break;
            } else if (paramDef.type === 'int' || paramDef.type === 'float') {
                const num = Number(rawValue);
                parsedArgs[paramDef.name] = isNaN(num) ? undefined : num;
                currentArgIndex++;
            } else if (paramDef.type === 'boolean') {
                parsedArgs[paramDef.name] = rawValue === 'true';
                currentArgIndex++;
            } else if (paramDef.type === 'player' || paramDef.type === 'target') {
                const p = findPlayerByName(rawValue);
                parsedArgs[paramDef.name] = p ? [p] : [];
                currentArgIndex++;
            } else if (paramDef.enumOptions && paramDef.enumOptions.length > 0) {
                if (!paramDef.enumOptions.includes(rawValue)) {
                    player.sendMessage(
                        `§cInvalid option '${rawValue}' for parameter '${paramDef.name}'. Valid options: ${paramDef.enumOptions.join(', ')}`
                    );
                    return true;
                }
                parsedArgs[paramDef.name] = rawValue;
                currentArgIndex++;
            } else {
                parsedArgs[paramDef.name] = rawValue;
                currentArgIndex++;
            }
        }

        // Defer to the centralized execution method
        this._executeCommand(player, command, parsedArgs);

        return true;
    }
}

export const commandManager = new CommandManager();
