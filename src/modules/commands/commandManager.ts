import * as mc from '@minecraft/server';
import { errorLog } from '../../core/logger.js';
import { getCooldown } from '../../core/cooldownManager.js';
import { getPlayer } from '../../core/playerDataManager.js';
import { getConfig } from '../../core/configManager.js';


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
}

/**
 * Represents the entity executing a command, which can be a player or the console.
 */
export type CommandExecutor = mc.Player | {
    isConsole: true;
    sendMessage: (message: string) => void;
};

/**
 * Represents the structure for defining a custom command.
 */
export interface CustomCommand {
    /** The primary name of the command. */
    name:string;
    /** A brief description of what the command does. */
    description: string;
    /** The required permission level to execute the command. Defaults to 0 (Owner). */
    permissionLevel?: number;
    /** An array of alternative names for the command. */
    aliases?: string[];
    /** An array of parameters the command accepts. */
    parameters?: CommandParameter[];
    /** The function to execute when the command is run. */
    execute: (executor: CommandExecutor, args: Record<string, any>) => void;
    /** Whether the command can be run from the server console. Defaults to false. */
    allowConsole?: boolean;
    /** Whether the command has a cooldown. */
    hasCooldown?: boolean;
    /** A unique identifier for the command's cooldown. Defaults to the command name. */
    cooldownId?: string;
    /** If true, the command will not be registered as a slash command. */
    disableSlashCommand?: boolean;
    /** A list of aliases that should not be registered as slash commands. */
    disabledSlashAliases?: string[];
    /** An alternative name to use for the slash command registration. */
    slashName?: string;
}

/**
 * Manages the registration and execution of both slash and chat commands.
 */
class CommandManager {
    public commands: Map<string, CustomCommand> = new Map();
    private aliases: Map<string, string> = new Map();
    private readonly prefix = 'exe'; // Namespace for all custom commands

    constructor() {
        mc.system.beforeEvents.startup.subscribe(({ customCommandRegistry }: any) => {
            this.commands.forEach(command => {
                if (command.disableSlashCommand) { return; }

                // Register the primary command name
                this._registerSlashCommand(customCommandRegistry, command, command.slashName || command.name);

                // Register all aliases as separate slash commands
                if (command.aliases) {
                    command.aliases.forEach(alias => {
                        if (command.disabledSlashAliases && command.disabledSlashAliases.includes(alias)) {
                            return; // Skip slash command registration for this alias
                        }
                        this._registerSlashCommand(customCommandRegistry, command, alias);
                    });
                }
            });
        });
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
     * The core command execution logic, shared by slash and chat commands.
     * @param {CommandExecutor} executor The player or a console identifier.
     * @param {CustomCommand} command The command to execute.
     * @param {Record<string, any>} args The parsed arguments for the command.
     * @private
     */
    private _executeCommand(executor: CommandExecutor, command: CustomCommand, args: Record<string, any>) {
        const config = getConfig();
        // @ts-expect-error - This property is dynamically added and will be typed later.
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
                // eslint-disable-next-line no-console
                console.warn(`[CommandManager] Command '${command.name}' cannot be run from the console.`);
                return;
            }
            mc.system.run(() => {
                try {
                    command.execute(executor, args);
                } catch (error: any) {
                    // eslint-disable-next-line no-console
                    console.error(`[CommandManager] Error executing console command '${command.name}': ${error.stack}`);
                }
            });
            return;
        }

        // --- Player Execution ---
        const player = executor as mc.Player;

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
        const requiredPermissionLevel = commandSettings.permissionLevel !== undefined
            ? commandSettings.permissionLevel
            : command.permissionLevel;

        if (!pData || pData.permissionLevel > requiredPermissionLevel!) {
            player.sendMessage('§cYou do not have permission to use this command.');
            return;
        }

        // Execute Command
        mc.system.run(() => {
            try {
                command.execute(player, args);
            } catch (error: any) {
                errorLog(`[CommandManager] Error executing command '${command.name}' for player '${player.name}': ${error.stack}`);
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
        const parts = params.map(p => {
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
     * @param {any} customCommandRegistry The registry object from the startup event.
     * @param {CustomCommand} command The command definition.
     * @param {string} name The name to register (either primary or an alias).
     * @private
     */
    private _registerSlashCommand(customCommandRegistry: any, command: CustomCommand, name: string) {
        const commandData = this.prepareCommandData(command, name, customCommandRegistry);

        const commandCallback = (origin: any, ...rawArgs: any[]) => {
            const executor: CommandExecutor = origin.sourceEntity || { isConsole: true, sendMessage: (msg: string) => console.log(msg.replace(/§[0-9a-fklmnor]/g, '')) };

            // Prepare arguments
            const allParams = (command.parameters || []);
            const parsedArgs: Record<string, any> = {};
            for (let i = 0; i < allParams.length; i++) {
                if (rawArgs[i] !== undefined) {
                    parsedArgs[allParams[i].name] = rawArgs[i];
                }
            }
            this._executeCommand(executor, command, parsedArgs);
        };

        try {
            customCommandRegistry.registerCommand(commandData, commandCallback);
        } catch (e: any) {
            if (!e.toString().includes('already in use')) {
                errorLog(`[CommandManager] Failed to register slash command '${name}':`, e);
            }
        }
    }

    /**
     * Prepares the command data for registration with the Minecraft API.
     * @param {CustomCommand} command The command definition.
     * @param {string} nameOverride The specific name to use for this registration (main name or alias).
     * @param {object} registry The custom command registry for enum registration.
     * @returns {object} The formatted command data.
     * @private
     */
    private prepareCommandData(command: CustomCommand, nameOverride: string, registry: any) {
        const slashCommandName = nameOverride || command.slashName || command.name;
        const mandatoryParameters = (command.parameters || [])
            .filter(p => !p.optional)
            .map(p => this.formatParameter(p, slashCommandName, registry));
        const optionalParameters = (command.parameters || [])
            .filter(p => p.optional)
            .map(p => this.formatParameter(p, slashCommandName, registry));

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
     * @param {any} registry The registry to register enums with.
     * @returns {any} The formatted parameter data.
     * @private
     */
    private formatParameter(param: CommandParameter, commandName: string, registry: any) {
        // --- Enum Handling ---
        if (param.enumOptions && Array.isArray(param.enumOptions) && registry) {
            const safeCmdName = (commandName || 'cmd').replace(/[^a-zA-Z0-9_]/g, '');
            const safeParamName = param.name.replace(/[^a-zA-Z0-9_]/g, '');
            const enumName = `${this.prefix}_${safeCmdName}_${safeParamName}`;

            try {
                registry.registerEnum(enumName, param.enumOptions);
            } catch {
                // Ignore if enum already exists (e.g. alias sharing same params)
            }

            return {
                name: param.name,
                type: mc.CustomCommandParamType.Enum,
                enumName: enumName
            };
        }

        // --- Standard Types ---
        const paramTypeMap = {
            'player': mc.CustomCommandParamType.PlayerSelector,
            'string': mc.CustomCommandParamType.String,
            'text': mc.CustomCommandParamType.String, // For greedy strings
            'int': mc.CustomCommandParamType.Integer,
            'float': mc.CustomCommandParamType.Float,
            'boolean': mc.CustomCommandParamType.Boolean,
            'block': mc.CustomCommandParamType.BlockType,
            'item': mc.CustomCommandParamType.ItemType,
            'position': mc.CustomCommandParamType.String, // Reverted to string for safety
            'target': mc.CustomCommandParamType.PlayerSelector
        };

        // @ts-expect-error - The type mapping is correct, but TypeScript can't infer it.
        const type = paramTypeMap[param.type.toLowerCase()];

        if (!type) {
            errorLog(`[CommandManager] Unknown parameter type '${param.type}' for parameter '${param.name}'. Defaulting to String.`);
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
    private translatePermissionLevel(level?: number): mc.CommandPermissionLevel {
        // We will handle all permission checks with our custom rank system.
        // Registering all commands with 'Any' allows our more granular check to be the single source of truth.
        return mc.CommandPermissionLevel.Any;
    }

    // --- Chat Command Management ---

    /**
     * Handles an incoming chat message and schedules it for execution if it's a valid command.
     * @param {any} eventData The chat event data.
     * @returns {boolean} `true` if the message was a command, otherwise `false`.
     */
    handleChatCommand(eventData: any): boolean {
        const config = getConfig();
        const { sender: player, message } = eventData;
        if (!message.startsWith(config.commandPrefix)) { return false; }

        eventData.cancel = true;

        // Using a regex to split by spaces while respecting quoted strings.
        const commandString = message.slice(config.commandPrefix.length).trim();
        const rawArgs = commandString.match(/"[^"]*"|'[^']*'|\S+/g) || [];
        if (rawArgs.length === 0) { return true; }

        const cleanedArgs = rawArgs.map((arg: any) =>
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

        // @ts-expect-error - This property is dynamically added and will be typed later.
        const commandSettings = config.commandSettings[command.name] || {};
        if (commandSettings.enabled === false) {
            player.sendMessage('§cThis command is currently disabled.');
            return true;
        }

        // --- Argument Parsing ---
        const parsedArgs: Record<string, any> = {};
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

            if (paramDef.type === 'text') { // Greedy parameter (consumes the rest)
                parsedArgs[paramDef.name] = cleanedArgs.slice(currentArgIndex).join(' ');
                currentArgIndex = cleanedArgs.length; // Mark all as consumed
                break;
            } else {
                parsedArgs[paramDef.name] = cleanedArgs[currentArgIndex];
                currentArgIndex++;
            }
        }

        // Defer to the centralized execution method
        this._executeCommand(player, command, parsedArgs);

        return true;
    }
}

export const commandManager = new CommandManager();
