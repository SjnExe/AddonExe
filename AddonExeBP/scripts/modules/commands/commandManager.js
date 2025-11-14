import * as mc from '@minecraft/server';
import { getPlayer } from '../../core/playerDataManager.js';
import { getConfig } from '../../core/configManager.js';
import { errorLog } from '../../core/logger.js';
import { getCooldown } from '../../core/cooldownManager.js';
import { loadCommandPermissions, getCommandPermissions } from '../../core/commandPermissionManager.js';

/**
 * Manages the registration and execution of both slash and chat commands.
 */
class CommandManager {
    constructor() {
        this.commands = new Map();
        this.aliases = new Map();
        this.prefix = 'exe'; // Namespace for all custom commands

        loadCommandPermissions();

        mc.system.beforeEvents.startup.subscribe(({ customCommandRegistry }) => {
            this.commands.forEach(command => {
                if (command.disableSlashCommand) {return;}

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
     * @param {object} commandOptions
     */
    register(commandOptions) {
        const commandName = commandOptions.name.toLowerCase();
        const permissions = getCommandPermissions();
        const permissionOverride = permissions[commandName];
        const permissionLevel = (permissionOverride && permissionOverride.permissionLevel !== undefined)
            ? permissionOverride.permissionLevel
            : commandOptions.permissionLevel;

        const command = { permissionLevel: 0, ...commandOptions, permissionLevel };
        this.commands.set(commandName, command);

        if (command.aliases) {
            for (const alias of command.aliases) {
                this.aliases.set(alias.toLowerCase(), commandName);
            }
        }
    }

    /**
     * The core command execution logic, shared by slash and chat commands.
     * @param {import('@minecraft/server').Player | object} executor The player or a console identifier.
     * @param {object} command The command to execute.
     * @param {object} args The parsed arguments for the command.
     * @private
     */
    _executeCommand(executor, command, args) {
        const isPlayer = !!executor.id; // Check if it's a player or console object

        // --- Console Execution ---
        if (!isPlayer) {
            if (!command.allowConsole) {
                console.warn(`[CommandManager] Command '${command.name}' cannot be run from the console.`); // eslint-disable-line no-console
                return;
            }
            mc.system.run(() => {
                try {
                    command.execute(executor, args);
                } catch (error) {
                    console.error(`[CommandManager] Error executing console command '${command.name}': ${error.stack}`); // eslint-disable-line no-console
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
        if (!pData || pData.permissionLevel > command.permissionLevel) {
            player.sendMessage('§cYou do not have permission to use this command.');
            return;
        }

        // Execute Command
        mc.system.run(() => {
            try {
                command.execute(player, args);
            } catch (error) {
                if (getConfig().debug) {
                    errorLog(`[CommandManager] Error executing command '${command.name}' for player '${player.name}': ${error.stack}`);
                }
                player.sendMessage('§cAn unexpected error occurred while running this command.');
            }
        });
    }

    /**
     * Registers a single slash command or alias.
     * @param {object} customCommandRegistry The registry object from the startup event.
     * @param {object} command The command definition.
     * @param {string} name The name to register (either primary or an alias).
     * @private
     */
    _registerSlashCommand(customCommandRegistry, command, name) {
        const commandData = this.prepareCommandData(command, name);

        const commandCallback = (origin, ...rawArgs) => {
            const executor = origin.sourceEntity || { isConsole: true, sendMessage: (msg) => console.log(msg.replace(/§[0-9a-fklmnor]/g, '')) }; // eslint-disable-line no-console

            // Prepare arguments
            const allParams = (command.parameters || []);
            const parsedArgs = {};
            for (let i = 0; i < allParams.length; i++) {
                if (rawArgs[i] !== undefined) {
                    parsedArgs[allParams[i].name] = rawArgs[i];
                }
            }
            this._executeCommand(executor, command, parsedArgs);
        };

        try {
            customCommandRegistry.registerCommand(commandData, commandCallback);
        } catch (e) {
            if (!e.toString().includes('already in use')) {
                if (getConfig().debug) {
                    errorLog(`[CommandManager] Failed to register slash command '${name}':`, e);
                }
            }
        }
    }

    /**
     * Prepares the command data for registration with the Minecraft API.
     * @param {object} command The command definition.
     * @param {string} nameOverride The specific name to use for this registration (main name or alias).
     * @returns {object} The formatted command data.
     * @private
     */
    prepareCommandData(command, nameOverride) {
        const slashCommandName = nameOverride || command.slashName || command.name;
        const mandatoryParameters = (command.parameters || []).filter(p => !p.optional).map(p => this.formatParameter(p));
        const optionalParameters = (command.parameters || []).filter(p => p.optional).map(p => this.formatParameter(p));

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
     * @param {object} param The parameter definition.
     * @returns {object} The formatted parameter data.
     * @private
     */
    formatParameter(param) {
        const paramTypeMap = {
            'player': mc.CustomCommandParamType.PlayerSelector,
            'string': mc.CustomCommandParamType.String,
            'text': mc.CustomCommandParamType.String, // For greedy strings
            'int': mc.CustomCommandParamType.Integer,
            'float': mc.CustomCommandParamType.Float,
            'boolean': mc.CustomCommandParamType.Boolean,
            'block': mc.CustomCommandParamType.BlockType,
            'item': mc.CustomCommandParamType.ItemType,
            'position': mc.CustomCommandParamType.Position,
            'target': mc.CustomCommandParamType.PlayerSelector
        };

        const type = paramTypeMap[param.type.toLowerCase()];

        if (!type) {
            errorLog(`[CommandManager] Unknown parameter type '${param.type}' for parameter '${param.name}'. Defaulting to String.`);
            return {
                name: param.name,
                type: mc.CustomCommandParamType.String
            };
        }

        const formattedParam = {
            name: param.name,
            type: type
        };

        if (param.enumOptions && Array.isArray(param.enumOptions)) {
            // This is how you define an enum for a string parameter
            formattedParam.enumOptions = param.enumOptions;
        }

        return formattedParam;
    }

    /**
     * Translates the numeric permission level to the API's enum.
     * @param {number} level The numeric permission level.
     * @returns {CommandPermissionLevel} The corresponding enum value.
     * @private
     */
    translatePermissionLevel(level) {
        // We will handle all permission checks with our custom rank system.
        // Registering all commands with 'Any' allows our more granular check to be the single source of truth.
        return mc.CommandPermissionLevel.Any;
    }

    // --- Chat Command Management ---

    /**
     * Handles an incoming chat message and schedules it for execution if it's a valid command.
     * @param {import('@minecraft/server').BeforeChatSendEvent} eventData The chat event data.
     * @returns {boolean} `true` if the message was a command, otherwise `false`.
     */
    handleChatCommand(eventData) {
        const config = getConfig();
        const { sender: player, message } = eventData;
        if (!message.startsWith(config.commandPrefix)) {return false;}

        eventData.cancel = true;

        // Using a regex to split by spaces while respecting quoted strings.
        const commandString = message.slice(config.commandPrefix.length).trim();
        const rawArgs = commandString.match(/"[^"]*"|'[^']*'|\S+/g) || [];
        if (rawArgs.length === 0) {return true;}

        const cleanedArgs = rawArgs.map(arg =>
            (arg.startsWith('"') && arg.endsWith('"')) || (arg.startsWith("'") && arg.endsWith("'"))
                ? arg.slice(1, -1)
                : arg
        );
        let commandName = cleanedArgs.shift().toLowerCase();

        // Resolve alias to primary command name
        commandName = this.aliases.get(commandName) || commandName;
        const command = this.commands.get(commandName);

        if (!command) {
            player.sendMessage(`§cUnknown command: ${commandName}`);
            return true;
        }

        // --- Argument Parsing ---
        const parsedArgs = {};
        const paramDefs = command.parameters || [];
        let currentArgIndex = 0;

        for (const paramDef of paramDefs) {
            if (currentArgIndex >= cleanedArgs.length) {
                if (!paramDef.optional) {
                    player.sendMessage(`§cMissing required argument: ${paramDef.name}.`);
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