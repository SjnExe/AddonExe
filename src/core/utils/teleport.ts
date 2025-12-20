import { Vector3Utils } from '@minecraft/math';
import * as mc from '@minecraft/server';
import { errorLog } from '../logger.js';
import { playSound } from './sound.js';
import { getCountdownColor } from './ui.js';

/**
 * Starts a teleport warmup timer for a player.
 * @param player The player to teleport.
 * @param durationSeconds The duration of the warmup in seconds.
 * @param onWarmupComplete The function to execute when the warmup completes successfully.
 * @param teleportName A short name for the teleport type (e.g., "home", "spawn") for messages.
 */
export function startTeleportWarmup(
    player: mc.Player,
    durationSeconds: number,
    onWarmupComplete: () => void,
    teleportName = 'teleport'
): void {
    if (durationSeconds <= 0) {
        onWarmupComplete();
        return;
    }

    let remainingSeconds = durationSeconds;
    const initialLocation = { x: player.location.x, y: player.location.y, z: player.location.z };
    const dimensionId = player.dimension.id;
    let intervalId: number | undefined = undefined;
    let hurtListener: ((event: mc.EntityHurtAfterEvent) => void) | undefined = undefined;

    const cleanup = () => {
        if (intervalId !== undefined) {
            mc.system.clearRun(intervalId);
            intervalId = undefined;
        }
        if (hurtListener) {
            try {
                // Defensive check to avoid crashes if the API reference is stale or invalid
                if (mc.world?.afterEvents?.entityHurt?.unsubscribe) {
                    mc.world.afterEvents.entityHurt.unsubscribe(hurtListener);
                }
            } catch {
                // Ignore cleanup errors to prevent cascading crashes
            }
            hurtListener = undefined;
        }
    };

    hurtListener = (event: mc.EntityHurtAfterEvent) => {
        if (event.hurtEntity.id === player.id) {
            player.onScreenDisplay.setActionBar('§cTeleport canceled because you took damage.');
            playSound(player, 'note.bass', { volume: 1, pitch: 0.5 });
            cleanup();
        }
    };

    mc.world.afterEvents.entityHurt.subscribe(hurtListener, { entityTypes: ['minecraft:player'] });

    player.sendMessage(`§aTeleporting to ${teleportName} in ${durationSeconds} seconds. Don't move or take damage!`);

    intervalId = mc.system.runInterval(() => {
        try {
            // It's possible the player was killed or disconnected, which would invalidate the object.
            // A simple property access will throw if the player object is no longer valid.
            const currentLocation = player.location;

            // Check the 3D distance the player has moved.
            const distanceMoved = Vector3Utils.distance(currentLocation, initialLocation);

            if (distanceMoved > 2 || player.dimension.id !== dimensionId) {
                player.onScreenDisplay.setActionBar('§cTeleport canceled because you moved.');
                playSound(player, 'note.bass', { volume: 1, pitch: 0.5 });
                cleanup();
                return;
            }

            remainingSeconds--;

            if (remainingSeconds > 0) {
                const color = getCountdownColor(remainingSeconds);
                player.onScreenDisplay.setActionBar(`${color}Teleporting in ${remainingSeconds}...`);

                // Play ticking sound (rising pitch as time decreases)
                // Pitch starts at 0.5 and goes up to 2.0
                const pitch = 0.5 + 1.5 * (1 - remainingSeconds / durationSeconds);
                playSound(player, 'note.pling', { volume: 0.5, pitch: pitch });
            } else {
                player.onScreenDisplay.setActionBar('§aTeleporting...');
                playSound(player, 'random.levelup', { volume: 0.5, pitch: 1 });
                cleanup();
                onWarmupComplete();
            }
        } catch (error: unknown) {
            errorLog(`[Warmup] Error during warmup interval for ${player.name}: ${String(error)}`);
            cleanup();
        }
    }, 20);
}
