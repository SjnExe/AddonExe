/* eslint-disable @typescript-eslint/no-unsafe-call */
import * as mc from '@minecraft/server';

import { errorLog } from '@core/logger.js';
import { updateAllPlayerRanks } from '@core/main.js';
import { sendMessage } from '@core/messaging.js';
import { findVisiblePlayerByName } from '@core/playerDataManager.js';
import { getPlayer } from '@core/playerDataManager.js';
import * as rankManager from '@core/rankManager.js';
import { rankDefinitions } from '@core/ranksConfig.default.js';
import { playSound } from '@core/utils.js';

import type { CustomCommand } from '@commands/commandManager.js';
import type { RankCondition, RankDefinition } from '@core/ranksConfig.default.js';

interface RankCommandArgs {
    action?: string;
    target?: string;
    rankId?: string;
}

// Use default ranks for static registration to ensure safety during startup.
// Custom ranks added via config will still work in execution but won't be suggested in the enum.
const validRankIds = rankDefinitions.map((r: RankDefinition) => r.id);

const command: CustomCommand = {
    name: 'rank',
    description: 'Manages player ranks. Lists all ranks if no arguments are given.',
    category: 'Administration',
    permissionLevel: 1, // Admin and above
    allowConsole: true,
    parameters: [
        {
            name: 'action',
            type: 'string',
            optional: true,
            enumOptions: ['set', 'remove', 'list']
        },
        { name: 'target', type: 'string', description: 'The name of the target player.', optional: true },
        {
            name: 'rankId',
            type: 'string',
            description: 'The ID of the rank to set.',
            optional: true,
            enumOptions: validRankIds
        }
    ],
    execute: (executor, args: RankCommandArgs) => {
        const { action, target: targetName, rankId } = args;

        const usageMessage = '§cUsage: /rank <set|remove> <targetName> <rankId>\n§cUsage: /rank list (or /rank)';

        if (action === undefined || action.toLowerCase() === 'list') {
            let message = '§a--- Available Ranks (Most to Least Powerful) ---\n';
            const sortedRanks = rankManager.getAllRanks().toSorted((a, b) => a.permissionLevel - b.permissionLevel);
            for (const rank of sortedRanks) {
                message += `§e${rank.name}§r (ID: §b${rank.id}§r, Perms: §6${rank.permissionLevel}§r)\n`;
            }
            executor.sendMessage(message.trim());
            return;
        }

        const sendExecutorMessage = (message: string) => {
            if (executor instanceof mc.Player) {
                sendMessage(message, executor);
            } else {
                executor.sendMessage(message);
            }
        };

        const actionLC = action.toLowerCase();
        if (actionLC !== 'set' && actionLC !== 'remove') {
            sendExecutorMessage(usageMessage);
            return;
        }

        if (targetName === undefined || rankId === undefined) {
            sendExecutorMessage(usageMessage);
            return;
        }

        // Fallback for console or if not found via visibility check but we want to be permissive for admins?
        // Actually, findVisiblePlayerByName handles permission logic.
        // If console, we can't use findVisiblePlayerByName directly as it requires an observer.
        // Let's implement a simple lookup for console.

        let finalTarget: mc.Player | undefined;
        if (executor instanceof mc.Player) {
             finalTarget = findVisiblePlayerByName(targetName, executor);
        } else {
             finalTarget = mc.world.getAllPlayers().find(p => p.name.toLowerCase() === targetName.toLowerCase());
        }

        if (!finalTarget) {
            sendExecutorMessage(`§cPlayer "${targetName}" not found.`);
            return;
        }

        const rankIdLC = rankId.toLowerCase();
        if (rankIdLC === 'owner' || rankIdLC === 'member') {
            sendExecutorMessage(`§cThe '${rankId}' rank cannot be managed with this command.`);
            sendExecutorMessage('§cOwner is set in the config, and Member is the default fallback rank.');
            if (executor instanceof mc.Player) playSound(executor, 'note.bass');
            return;
        }

        const rankDef = rankManager.getRankById(rankIdLC);
        if (!rankDef) {
            sendExecutorMessage(`§cRank ID '${rankId}' not found in configuration.`);
            if (executor instanceof mc.Player) playSound(executor, 'note.bass');
            return;
        }

        const tagCondition = rankDef.conditions.find(
            (c: RankCondition) => c.type === 'hasTag' && typeof c.value === 'string'
        );
        if (!tagCondition || typeof tagCondition.value !== 'string') {
            sendExecutorMessage(`§cThe rank '${rankId}' is not configured to be assigned by a tag.`);
            if (executor instanceof mc.Player) playSound(executor, 'note.bass');
            return;
        }
        const rankTag = tagCondition.value;

        // --- Permission Checks ---
        if (executor instanceof mc.Player) {
            const executorData = getPlayer(executor.id);
            const targetData = getPlayer(finalTarget.id);

            if (!executorData || !targetData) {
                sendExecutorMessage('§cCould not retrieve player data for permission check.');
                playSound(executor, 'note.bass');
                return;
            }

            const isSelfRank = executor.id === finalTarget.id;

            if (!isSelfRank && executorData.permissionLevel >= targetData.permissionLevel) {
                sendExecutorMessage('§cYou cannot change the rank of a player with the same or higher rank than you.');
                playSound(executor, 'note.bass');
                return;
            }

            if (actionLC === 'set' && executorData.permissionLevel >= rankDef.permissionLevel) {
                sendExecutorMessage(
                    `§cYou cannot set a player's rank to '${rankDef.name}' as it is the same or higher rank than your own.`
                );
                playSound(executor, 'note.bass');
                return;
            }
        }

        try {
            if (actionLC === 'set') {
                finalTarget.addTag(rankTag);
                sendExecutorMessage(
                    `§aSuccessfully set ${finalTarget.name}'s rank to ${rankDef.name} by adding tag '${rankTag}'.`
                );
            } else {
                finalTarget.removeTag(rankTag);
                sendExecutorMessage(
                    `§aSuccessfully removed the ${rankDef.name} rank from ${finalTarget.name} by removing tag '${rankTag}'.`
                );
            }
            updateAllPlayerRanks();
            if (executor instanceof mc.Player) {
                playSound(executor, 'random.orb');
            }
        } catch (error: unknown) {
            sendExecutorMessage('§cFailed to update rank tag.');
            if (error instanceof Error) {
                errorLog(`[/rank] Error: ${error.stack}`);
            }
        }
    }
};

export default command;
