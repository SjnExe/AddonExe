import { MinecraftEntityTypes } from '@minecraft/vanilla-data';

import { errorLog } from '@core/logger.js';
import { playSound } from '@core/utils/sound.js';
import { getCountdownColor } from '@core/utils/ui.js';
import { setActionBarOverride } from '@features/sidebar/manager.js';
import { isDefined, isNumber } from '@lib/guards.js';
import { Vector3Utils } from '@minecraft/math';
import * as mc from '@minecraft/server';

export function startTeleportWarmup(player: mc.Player, durationSeconds: number, onWarmupComplete: () => void, teleportName = 'teleport', onCancel?: () => void): void {
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
        if (isNumber(intervalId)) {
            mc.system.clearRun(intervalId);
            intervalId = undefined;
        }
        if (isDefined(hurtListener)) {
            try {
                if (isDefined(mc.world) && isDefined(mc.world.afterEvents) && isDefined(mc.world.afterEvents.entityHurt) && typeof mc.world.afterEvents.entityHurt.unsubscribe === 'function') {
                    mc.world.afterEvents.entityHurt.unsubscribe(hurtListener);
                }
            } catch {
                // Ignore cleanup errors
            }
            hurtListener = undefined;
        }
    };

    const cancel = () => {
        cleanup();
        if (isDefined(onCancel)) onCancel();
    };

    hurtListener = (event: mc.EntityHurtAfterEvent) => {
        if (event.hurtEntity.id === player.id) {
            setActionBarOverride(player, '§cTeleport canceled because you took damage.', 3000);
            playSound(player, 'note.bass', { volume: 1, pitch: 0.5 });
            cancel();
        }
    };

    mc.world.afterEvents.entityHurt.subscribe(hurtListener, { entityTypes: [MinecraftEntityTypes.Player] });

    player.sendMessage(`§aTeleporting to ${teleportName} in ${durationSeconds} seconds. Don't move or take damage!`);

    intervalId = mc.system.runInterval(() => {
        try {
            if (!player.isValid) {
                cancel();
                return;
            }
            const currentLocation = player.location;
            const distanceMoved = Vector3Utils.distance(currentLocation, initialLocation);

            if (distanceMoved > 2 || player.dimension.id !== dimensionId) {
                setActionBarOverride(player, '§cTeleport canceled because you moved.', 3000);
                playSound(player, 'note.bass', { volume: 1, pitch: 0.5 });
                cancel();
                return;
            }

            remainingSeconds--;

            if (remainingSeconds > 0) {
                const color = getCountdownColor(remainingSeconds);
                setActionBarOverride(player, `${color}Teleporting in ${remainingSeconds}...`, 1100);

                const pitch = 0.5 + 1.5 * (1 - remainingSeconds / durationSeconds);
                playSound(player, 'note.pling', { volume: 0.5, pitch: pitch });
            } else {
                setActionBarOverride(player, '§aTeleporting...', 2000);
                playSound(player, 'random.levelup', { volume: 0.5, pitch: 1 });
                cleanup();
                onWarmupComplete();
            }
        } catch (error: unknown) {
            errorLog(`[Warmup] Error during warmup interval for ${player.name}: ${String(error)}`);
            cancel();
        }
    }, 20);
}
