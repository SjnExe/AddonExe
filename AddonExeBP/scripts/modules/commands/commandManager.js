import { system } from '@minecraft/server';
import {
    CommandPermissionLevel,
    CustomCommandParamType
} from '@minecraft/server';
import { getPlayer } from '../../core/playerDataManager.js';
import { getConfig } from '../../core/configManager.js';
import { errorLog } from '../../core/errorLogger.js';
import { getCooldown } from '../../core/cooldownManager.js';

/**
 * Manages the registration and execution of both slash and chat commands.
 */
class CommandManager {
    constructor() {
        this.commands = [];
        this.aliases = new Map();
        this.prefix = 'exe'; // Namespace for all custom commands

        system.beforeEvents.startup.subscribe(({ customCommandRegistry }) => {
            this.commands.forEach(command => {
                if (command.disableSlashCommand) {return;}

                // Register the primary command name
                this.registerSlashCommand(customCommandRegistry, command, command.slashName || command.name);

                // Register all aliases as separate slash commands
                if (command.aliases) {
                    command.aliases.forEach(alias => {
                        if (command.disabledSlashAliases && command.disabledSlashAliases.includes(alias)) {
                            return; // Skip slash command registration for this alias
                        }
                        this.registerSlashCommand(customCommandRegistry, command, alias);
                    });
                }
            });
        });
    }

    // --- General Command Management ---

    /**
     * Registers a new command.
     * @param {object} commandOptions
     */
    register(commandOptions) {
        const command = { permissionLevel: 0, ...commandOptions };
        this.commands.push(command);

        if (command.aliases) {
            for (const alias of command.aliases) {
                this.aliases.set(alias.toLowerCase(), command.name);
            }
        }
    }

    // --- Slash Command Management ---

    /**
     * Registers a single slash command or alias.
     * @param {object} customCommandRegistry The registry object from the startup event.
     * @param {object} command The command definition.
     * @param {string} name The name to register (either primary or an alias).
     * @private
     */
    registerSlashCommand(customCommandRegistry, command, name) {
        const commandData = this.prepareCommandData(command, name);

        const commandCallback = (origin, ...args) => {
            const player = origin.sourceEntity;

            // Prepare arguments regardless of executor
            const mandatoryParams = command.parameters?.filter(p => !p.optional) || [];
            const optionalParams = command.parameters?.filter(p => p.optional) || [];
            const allParams = [...mandatoryParams, ...optionalParams];
            const parsedArgs = {};
            for (let i = 0; i < allParams.length; i++) {
                if (args[i] !== undefined) {
                    parsedArgs[allParams[i].name] = args[i];
                }
            }

            if (!player) {
                // Console execution
                if (!command.allowConsole) {
                    // Using console.warn is appropriate for server-side messages.
                    console.warn(`[CommandManager] Command '${name}' cannot be run from the console.`); // eslint-disable-line no-console
                    return;
                }
                // Bypassing permission check for console
                system.run(() => {
                    try {
                        // Pass a special identifier for the console executor
                        command.execute({ isConsole: true, sendMessage: (msg) => console.log(msg.replace(/§[0-9a-fklmnor]/g, '')) }, parsedArgs); // eslint-disable-line no-console
                    } catch (error) {
                        console.error(`[CommandManager] Error executing console command '${name}': ${error.stack}`); // eslint-disable-line no-console
                    }
                });
                return;
            }

            // Player execution
            if (command.hasCooldown) {
                const cooldownId = command.cooldownId || command.name;
                const remainingCooldown = getCooldown(player.id, cooldownId);
                if (remainingCooldown > 0) {
                    player.sendMessage(`§cYou must wait ${remainingCooldown} more second(s) to use this command.`);
                    return;
                }
            }

            const pData = getPlayer(player.id);
            if (!pData || pData.permissionLevel > command.permissionLevel) {
                player.sendMessage('§cYou do not have permission to use this command.');
                return;
            }

            system.run(() => {
                try {
                    command.execute(player, parsedArgs);
                } catch (error) {
                    if (getConfig().debug) {
                        errorLog(`[CommandManager] Error executing slash command '${name}': ${error.stack}`);
                    }
                    player.sendMessage('§cAn unexpected error occurred while running this command.');
                }
            });
        };

        try {
            customCommandRegistry.registerCommand(commandData, commandCallback);
        } catch (e) {
            // We expect an error if an alias conflicts with a vanilla command, which is fine.
            if (e.toString().includes('already in use')) {
                // Do nothing, this is expected for some aliases.
            } else {
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
            'player': CustomCommandParamType.PlayerSelector,
            'string': CustomCommandParamType.String,
            'text': CustomCommandParamType.String, // For greedy strings
            'int': CustomCommandParamType.Integer,
            'float': CustomCommandParamType.Float,
            'boolean': CustomCommandParamType.Boolean,
            'block': CustomCommandParamType.BlockType,
            'item': CustomCommandParamType.ItemType,
            'position': CustomCommandParamType.Position,
            'target': CustomCommandParamType.PlayerSelector
        };

        const type = paramTypeMap[param.type.toLowerCase()];

        if (!type) {
            errorLog(`[CommandManager] Unknown parameter type '${param.type}' for parameter '${param.name}'. Defaulting to String.`);
            return {
                name: param.name,
                type: CustomCommandParamType.String
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
        return CommandPermissionLevel.Any;
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

        const commandString = message.slice(config.commandPrefix.length).trim();
        // Regex to split by spaces, but keep quoted text (single or double) together.
        const rawArgs = commandString.match(/"[^"]*"|'[^']*'|\S+/g) || [];
        if (rawArgs.length === 0) {return true;}

        const cleanedArgs = rawArgs.map(arg => (arg.startsWith('"') && arg.endsWith('"')) || (arg.startsWith("'") && arg.endsWith("'")) ? arg.slice(1, -1) : arg);
        let commandName = cleanedArgs.shift().toLowerCase();

        if (this.aliases.has(commandName)) {
            commandName = this.aliases.get(commandName);
        }
        const command = this.commands.find(c => c.name === commandName);

        if (!command) {
            player.sendMessage(`§cUnknown command: ${commandName}`);
            return true;
        }

        if (command.hasCooldown) {
            const cooldownId = command.cooldownId || command.name;
            const remainingCooldown = getCooldown(player.id, cooldownId);
            if (remainingCooldown > 0) {
                player.sendMessage(`§cYou must wait ${remainingCooldown} more second(s) to use this command.`);
                return true;
            }
        }

        const pData = getPlayer(player.id);
        if (!pData || pData.permissionLevel > command.permissionLevel) {
            player.sendMessage('§cYou do not have permission to use this command.');
            return true;
        }

        const parsedArgs = {};
        const paramDefs = command.parameters || [];
        let currentArgIndex = 0;

        for (let i = 0; i < paramDefs.length; i++) {
            const paramDef = paramDefs[i];

            if (currentArgIndex >= cleanedArgs.length) {
                if (!paramDef.optional) {
                    player.sendMessage(`§cMissing required argument: ${paramDef.name}.`);
                    return true;
                }
                break; // No more args to process
            }

            if (paramDef.type === 'text') { // Greedy parameter
                parsedArgs[paramDef.name] = cleanedArgs.slice(currentArgIndex).join(' ');
                currentArgIndex = cleanedArgs.length; // Consume rest
                break;
            } else {
                parsedArgs[paramDef.name] = cleanedArgs[currentArgIndex];
                currentArgIndex++;
            }
        }

        system.run(() => {
            try {
                command.execute(player, parsedArgs);
            } catch (error) {
                if (getConfig().debug) {
                    errorLog(`[CommandManager] Error executing chat command '${command.name}': ${error.stack}`);
                }
                player.sendMessage('§cAn unexpected error occurred while running this command.');
            }
        });

        return true;
    }
}

export const commandManager = new CommandManager();
