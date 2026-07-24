import * as mc from '@minecraft/server';

import { getConfig } from '@core/configManager.js';
import { debugLog, errorLog, infoLog } from '@core/logger.js';
import { hasPermission } from '@core/permissionEngine.js';
import { getPlayer } from '@core/playerDataManager.js';
import { isDefined, isNonEmptyString } from '@lib/guards.js';

// --- Type Definitions ---

export { CustomCommandParamType } from '@minecraft/server';

/**
 * Represents a parameter for a custom command.
 */
export interface CommandParameter {
    /** The name of the parameter. */
    name: string;
    /** The data type of the parameter. */
    type: 'player' | 'string' | 'text' | 'int' | 'float' | 'boolean' | 'block' | 'item' | 'position' | 'target' | mc.CustomCommandParamType;
    /** Whether the parameter is optional. */
    optional?: boolean;
    /** A list of possible values for an enum parameter, or a function that returns them. */
    enumOptions?: string[] | (() => string[]);
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
          sendMessage: (message: string | mc.RawMessage) => void;
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
    permissionNode: string;
    /** An array of alternative names for the command. */
    aliases?: string[];
    /** An array of parameters the command accepts. */
    parameters?: CommandParameter[];
    /** The function to execute when the command is run. */
    execute: (executor: CommandExecutor, args: Record<string, unknown>) => void | Promise<void>;
    /** Whether the command can be run from the server console. Defaults to false. */
    allowConsole?: boolean;
    /** If true, the command will not be registered as a slash command. */
    disableSlashCommand?: boolean;
    /** A list of aliases that should not be registered as slash commands. */
    disabledSlashAliases?: string[];
    /** An alternative name to use for the slash command registration. */
    slashName?: string;
    /** Whether to hide the command from the help menu. */
    hidden?: boolean;
}

/**
 * Manages the registration and execution of both slash and chat commands.
 */
class CommandManager {
    public commands: Map<string, CustomCommand> = new Map();
    public aliases: Map<string, string> = new Map();
    private readonly registeredSlashCommands = new Set<string>();
    private readonly prefix = 'exe'; // Namespace for all custom commands
    private readonly vanillaCommands = new Set([
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
        mc.system.beforeEvents.startup.subscribe(({ customCommandRegistry }: { customCommandRegistry: mc.CustomCommandRegistry }) => {
            infoLog('[CommandManager] Startup event received. Registering slash commands...');
            for (const command of this.commands.values()) {
                if (command.disableSlashCommand === true) {
                    continue;
                }

                // Register the primary command name
                this._registerSlashCommand(customCommandRegistry, command, command.slashName ?? command.name);

                // Register all aliases as separate slash commands
                if (isDefined(command.aliases)) {
                    for (const alias of command.aliases) {
                        if (isDefined(command.disabledSlashAliases) && command.disabledSlashAliases.includes(alias)) {
                            continue; // Skip slash command registration for this alias
                        }
                        this._registerSlashCommand(customCommandRegistry, command, alias);
                    }
                }
            }
        });
    }

    /**
     * Registers a new command.
     * @param {CustomCommand} commandOptions
     */
    register(commandOptions: CustomCommand) {
        const command: CustomCommand = { ...commandOptions };
        this.commands.set(command.name.toLowerCase(), command);

        if (isDefined(command.aliases)) {
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
        return [...this.commands.values()];
    }

    /**
     * The core command execution logic, shared by slash and chat commands.
     * @param {CommandExecutor} executor The player or a console identifier.
     * @param {CustomCommand} command The command to execute.
     * @param {Record<string, unknown>} args The parsed arguments for the command.
     * @private
     */
    private _executeCommand(executor: CommandExecutor, command: CustomCommand, args: Record<string, unknown>) {
        let config: unknown;
        try {
            config = getConfig();
        } catch {
            // Config not loaded
        }

        if (!isDefined(config)) {
            if ('sendMessage' in executor) {
                executor.sendMessage('§cServer is starting up. Please wait...');
            }
            return;
        }

        const isPlayer = 'id' in executor;

        if (isPlayer) {
            this._executePlayerCommand(executor, command, args);
        } else {
            this._executeConsoleCommand(executor, command, args);
        }
    }

    private _executeConsoleCommand(executor: { isConsole: true; sendMessage: (message: string | mc.RawMessage) => void }, command: CustomCommand, args: Record<string, unknown>) {
        if (command.allowConsole !== true) {
            executor.sendMessage(`[CommandManager] Command '${command.name}' cannot be run from the console.`);
            return;
        }
        mc.system.run(() => {
            try {
                const result = command.execute(executor, args);
                if (result instanceof Promise) {
                    void result.catch((error: unknown) => {
                        const stack = error instanceof Error ? error.stack : String(error);
                        executor.sendMessage(`[CommandManager] Error executing async console command '${command.name}': ${stack}`);
                    });
                }
            } catch (error: unknown) {
                const stack = error instanceof Error ? error.stack : String(error);
                executor.sendMessage(`[CommandManager] Error executing console command '${command.name}': ${stack}`);
            }
        });
    }

    private _executePlayerCommand(player: mc.Player, command: CustomCommand, args: Record<string, unknown>) {
        // Permission Check
        if (!hasPermission(player, command.permissionNode)) {
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
                        errorLog(`[CommandManager] Error executing async command '${command.name}' for player '${player.name}': ${stack}`);
                        player.sendMessage('§cAn unexpected error occurred while running this command.');
                    });
                }
            } catch (error: unknown) {
                const stack = error instanceof Error ? error.stack : String(error);
                errorLog(`[CommandManager] Error executing command '${command.name}' for player '${player.name}': ${stack}`);
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
        const params = command.parameters ?? [];
        const parts = params.map((p) => {
            if (p.optional === true) {
                return `[${p.name}]`;
            } else {
                const options = typeof p.enumOptions === 'function' ? p.enumOptions() : p.enumOptions;
                if (isDefined(options) && options.length <= 4) {
                    return `<${options.join('|')}>`;
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
    private _registerSlashCommand(customCommandRegistry: mc.CustomCommandRegistry, command: CustomCommand, name: string, isRetry = false) {
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
            const sourceEntity = origin.sourceEntity;
            const executor: CommandExecutor =
                sourceEntity instanceof mc.Player
                    ? sourceEntity
                    : {
                          isConsole: true,
                          sendMessage: (msg: string | mc.RawMessage) => {
                              if (typeof msg === 'string') {
                                  errorLog(msg.replaceAll(/§[0-9a-fklmnor]/g, ''));
                              } else {
                                  errorLog(JSON.stringify(msg));
                              }
                          }
                      };

            // Prepare arguments
            const allParams = command.parameters ?? [];
            const parsedArgs: Record<string, unknown> = {};
            for (const [i, param] of allParams.entries()) {
                if (isDefined(rawArgs[i]) && isDefined(param)) {
                    let value = rawArgs[i];
                    // Filter vanished players for slash commands
                    if (
                        (param.type === 'player' || param.type === 'target') &&
                        Array.isArray(value) &&
                        'id' in executor // Only filter if executor is a player
                    ) {
                        const executorData = getPlayer(executor.id);
                        // Level 2 (Mod) and below can see vanished players
                        if (isDefined(executorData) && !hasPermission(executor, 'group.mod')) {
                            value = (value as mc.Player[]).filter((target) => {
                                const targetData = getPlayer(target.id);
                                return !(isDefined(targetData) && targetData.isVanished);
                            });
                        }
                    }
                    parsedArgs[param.name] = value;
                }
            }
            this._executeCommand(executor, command, parsedArgs);

            return undefined;
        };

        try {
            customCommandRegistry.registerCommand(commandData, commandCallback);
            this.registeredSlashCommands.add(name);
            debugLog(`[CommandManager] Successfully registered slash command: ${name}`);
        } catch (error: unknown) {
            const errStr = String(error);
            if (errStr.includes('already in use') && !isRetry) {
                const newName = `x${name}`;
                errorLog(`[CommandManager] Command alias '${name}' collision. Retrying as '${newName}'.`);
                this._registerSlashCommand(customCommandRegistry, command, newName, true);
                return;
            }
            if (error instanceof Error) {
                errorLog(`[CommandManager] Failed to register slash command '${name}':`, error);
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
    private prepareCommandData(command: CustomCommand, nameOverride: string, registry: mc.CustomCommandRegistry): mc.CustomCommand {
        const slashCommandName = isNonEmptyString(nameOverride) ? nameOverride : (command.slashName ?? command.name);
        const mandatoryParameters = (command.parameters ?? []).filter((p) => p.optional !== true).map((p) => this.formatParameter(p, slashCommandName, registry));
        const optionalParameters = (command.parameters ?? []).filter((p) => p.optional === true).map((p) => this.formatParameter(p, slashCommandName, registry));

        return {
            name: `${this.prefix}:${slashCommandName}`,
            description: command.description,
            permissionLevel: mc.CommandPermissionLevel.Any,
            mandatoryParameters,
            optionalParameters
        };
    }

    /**
     * Formats a parameter for registration with the Minecraft API.
     * @param {CommandParameter} param The parameter definition.
     * @param {string} commandName The name of the command (for unique enum naming).
     * @param {mc.CustomCommandRegistry} registry The custom command registry for enum registration.
     * @returns {mc.CustomCommandParameter} The formatted parameter data.
     * @private
     */
    private formatParameter(param: CommandParameter, commandName: string, registry: mc.CustomCommandRegistry): mc.CustomCommandParameter {
        // --- Enum Handling ---
        if (isDefined(param.enumOptions) && isDefined(registry)) {
            const options = typeof param.enumOptions === 'function' ? param.enumOptions() : param.enumOptions;

            if (Array.isArray(options) && options.length > 0) {
                const safeCmdName = (isNonEmptyString(commandName) ? commandName : 'cmd').replaceAll(/\W/g, '');
                const safeParamName = param.name.replaceAll(/\W/g, '');
                const enumName = `${this.prefix}:${safeCmdName}_${safeParamName}`;

                try {
                    registry.registerEnum(enumName, options);
                } catch (error: unknown) {
                    // Ignore if enum already exists (e.g. alias sharing same params)
                    // But log other errors to debug issues
                    const errStr = String(error);
                    if (!errStr.includes('already exists')) {
                        errorLog(`[CommandManager] Failed to register enum '${enumName}': ${errStr}`);
                    }
                }

                return {
                    name: param.name,
                    type: mc.CustomCommandParamType.Enum,
                    enumName: enumName
                };
            }
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

        const type = typeof param.type === 'string' ? paramTypeMap[param.type.toLowerCase()] : (param.type as mc.CustomCommandParamType);

        if (!isDefined(type)) {
            errorLog(`[CommandManager] Unknown parameter type '${String(param.type)}' for parameter '${param.name}'. Defaulting to String.`);
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
}

export const commandManager = new CommandManager();
