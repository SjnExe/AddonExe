import { CommandExecutor } from '@commands/commandManager.js';
import { getConfig } from '@core/configManager.js';
import { getAllPlayersFromCache } from '@core/playerCache.js';
import * as mc from '@minecraft/server';

let restartTaskId: number | undefined;

export function startRestart(initiator?: CommandExecutor | mc.Entity) {
    if (restartTaskId !== undefined) {
        if (initiator && (initiator as mc.Player).sendMessage) {
            (initiator as mc.Player).sendMessage('§cRestart is already in progress.');
        }
        return;
    }

    const config = getConfig();
    let secondsRemaining = config.restart.countdownSeconds;
    const subtitle = config.restart.subtitle;
    const kickMessage = config.restart.kickMessage;

    mc.world.sendMessage(`§eServer restart initiated. Restarting in ${secondsRemaining} seconds...`);

    restartTaskId = mc.system.runInterval(() => {
        const players = getAllPlayersFromCache();

        if (secondsRemaining <= 0) {
            mc.system.clearRun(restartTaskId!);
            restartTaskId = undefined;

            for (const player of players) {
                // Actually kick them using commands if possible
                try {
                    player.runCommand(`kick "${player.name}" ${kickMessage}`);
                } catch {
                    // Ignore
                }
            }
            return;
        }

        // Show titles
        for (const player of players) {
            let color = '§a';
            if (secondsRemaining <= 10) color = '§c';
            else if (secondsRemaining <= 30) color = '§e';

            player.onScreenDisplay.setTitle(`${color}${secondsRemaining}`);
            if (subtitle) {
                player.onScreenDisplay.updateSubtitle(subtitle);
            }

            // Play a tick sound for countdown
            if (secondsRemaining <= 5) {
                player.playSound('note.bass', { volume: 1.0, pitch: 1.5 });
            } else if (secondsRemaining % 5 === 0) {
                player.playSound('random.click', { volume: 0.5, pitch: 1.0 });
            }
        }

        secondsRemaining--;
    }, 20); // 20 ticks = 1 second
}

export function cancelRestart(initiator?: CommandExecutor | mc.Entity) {
    if (restartTaskId === undefined) {
        if (initiator && (initiator as mc.Player).sendMessage) {
            (initiator as mc.Player).sendMessage('§cNo restart is currently in progress.');
        }
        return;
    }

    mc.system.clearRun(restartTaskId);
    restartTaskId = undefined;

    mc.world.sendMessage('§aServer restart has been cancelled.');
}
