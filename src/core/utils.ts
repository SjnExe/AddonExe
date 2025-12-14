import { Vector3Utils } from '@minecraft/math';
import * as mc from '@minecraft/server';
import {
    ActionFormData,
    ActionFormResponse,
    FormCancelationReason,
    MessageFormData,
    MessageFormResponse,
    ModalFormData,
    ModalFormResponse
} from '@minecraft/server-ui';

import { getConfig } from './configManager.js';
import { getEconomyConfig } from './configurations.js';
import { errorLog } from './logger.js';

/**
 * Parses a duration string (e.g., "10m", "2h", "7d") and returns the duration in milliseconds.
 * @param durationString The duration string to parse.
 * @returns The duration in milliseconds, or 0 if the format is invalid.
 */
export function parseDuration(durationString: string): number {
    const durationRegex = /^(\d+)([smhdw])$/;
    const match = durationString.toLowerCase().match(durationRegex);

    if (!match) {
        return 0;
    }

    const value = parseInt(match[1], 10);
    const unit = match[2];
    let multiplier = 0;

    switch (unit) {
        case 's':
            multiplier = 1000;
            break;
        case 'm':
            multiplier = 1000 * 60;
            break;
        case 'h':
            multiplier = 1000 * 60 * 60;
            break;
        case 'd':
            multiplier = 1000 * 60 * 60 * 24;
            break;
        case 'w':
            multiplier = 1000 * 60 * 60 * 24 * 7;
            break;
    }

    return value * multiplier;
}

/**
 * Formats a duration in milliseconds into a human-readable string (e.g., "1d 2h 30m").
 * @param ms The duration in milliseconds.
 * @returns The formatted string.
 */
export function formatDuration(ms: number): string {
    const seconds = Math.floor(ms / 1000);
    const d = Math.floor(seconds / (3600 * 24));
    const h = Math.floor((seconds % (3600 * 24)) / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);

    const parts = [];
    if (d > 0) parts.push(`${d}d`);
    if (h > 0) parts.push(`${h}h`);
    if (m > 0) parts.push(`${m}m`);
    if (s > 0) parts.push(`${s}s`);

    if (parts.length === 0) return '0s';

    return parts.join(' ');
}

/**
 * Formats a duration in seconds into a human-readable string.
 * Wrapper around formatDuration.
 * @param seconds The duration in seconds.
 * @returns The formatted string.
 */
export function formatTime(seconds: number): string {
    return formatDuration(seconds * 1000);
}

/**
 * Plays a sound for a specific player.
 * @param player The player to play the sound for.
 * @param soundId The ID of the sound to play.
 * @param options options for the sound.
 */
export function playSound(player: mc.Player, soundId: string, options: mc.PlayerSoundOptions = {}): void {
    try {
        player.playSound(soundId, options);
    } catch (e: unknown) {
        errorLog(`Failed to play sound "${soundId}" for player ${player.name}: ${String(e)}`);
    }
}

/**
 * Forces the chat window to close by briefly toggling input permissions.
 * This is a known workaround for Bedrock UI behavior.
 */
async function forceCloseChat(player: mc.Player): Promise<void> {
    try {
        if (!player.isValid) return;

        // Toggle permissions to force close UI/Chat
        player.dimension.runCommand(`inputpermission set "${player.name}" camera disabled`);
        player.dimension.runCommand(`inputpermission set "${player.name}" movement disabled`);

        // Small delay to let client process the state change
        await new Promise((resolve) => mc.system.runTimeout(() => resolve(undefined), 2));

        if (player.isValid) {
            player.dimension.runCommand(`inputpermission set "${player.name}" camera enabled`);
            player.dimension.runCommand(`inputpermission set "${player.name}" movement enabled`);
        }
    } catch {
        // Ignore errors (e.g. cheats not enabled, or permissions issue)
    }
}

/**
 * Shows a form to a player, handling the 'UserBusy' case by sending a one-time message and then retrying.
 * @param player The player to show the form to.
 * @param form The form to show.
 * @returns A promise that resolves with the form response, or undefined if it times out or is cancelled for other reasons.
 */
export async function uiWait(
    player: mc.Player,
    form: ActionFormData | ModalFormData | MessageFormData
): Promise<ActionFormResponse | ModalFormResponse | MessageFormResponse> {
    const firstAttempt = await form.show(player);
    if (firstAttempt.cancelationReason !== FormCancelationReason.UserBusy) {
        return firstAttempt;
    }

    // Attempt to force close chat if busy
    await forceCloseChat(player);

    const secondAttempt = await form.show(player);
    if (secondAttempt.cancelationReason !== FormCancelationReason.UserBusy) {
        return secondAttempt;
    }

    // If still busy, send the message and start retrying loop.
    player.sendMessage('§eOpening UI... please close chat to view.§r');

    const startTick = mc.system.currentTick;
    while (mc.system.currentTick - startTick < 1200) {
        // 1 minute timeout
        const subsequentAttempt = await form.show(player);
        if (subsequentAttempt.cancelationReason !== FormCancelationReason.UserBusy) {
            return subsequentAttempt;
        }

        // Add a delay to prevent tight loop and allow the client to process the close chat action
        await new Promise<void>((resolve) => mc.system.runTimeout(resolve, 10));
    }

    return { canceled: true, cancelationReason: FormCancelationReason.UserClosed } as ActionFormResponse; // Timeout
}

interface SoundEventConfig {
    soundEvents?: {
        [key: string]: {
            enabled: boolean;
            soundId: string;
            volume: number;
            pitch: number;
        };
    };
}

/**
 * Plays a configured sound for a player if it's enabled in the config.
 * @param player The player to play the sound for.
 * @param soundEventKey The key of the sound event in the config.
 */
export function playSoundFromConfig(player: mc.Player, soundEventKey: string): void {
    try {
        const config = getConfig() as SoundEventConfig;
        const soundEvent = config.soundEvents?.[soundEventKey];
        if (soundEvent && soundEvent.enabled) {
            player.playSound(soundEvent.soundId, {
                volume: soundEvent.volume,
                pitch: soundEvent.pitch
            });
        }
    } catch (error: unknown) {
        errorLog(`Failed to play sound from config for key "${soundEventKey}": ${String(error)}`);
    }
}

/**
 * Determines the color for the countdown timer based on remaining seconds.
 * @param secondsRemaining
 * @returns The Minecraft color code.
 */
function getCountdownColor(secondsRemaining: number): string {
    if (secondsRemaining <= 1) {
        return '§4';
    } // Dark Red
    if (secondsRemaining <= 3) {
        return '§c';
    } // Red
    if (secondsRemaining <= 5) {
        return '§6';
    } // Gold
    if (secondsRemaining <= 10) {
        return '§e';
    } // Yellow
    return '§a'; // Green
}

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
    let intervalId: number | null = null;
    let hurtListener: ((event: mc.EntityHurtAfterEvent) => void) | null = null;

    const cleanup = () => {
        if (intervalId !== null) {
            mc.system.clearRun(intervalId);
            intervalId = null;
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
            hurtListener = null;
        }
    };

    hurtListener = (event: mc.EntityHurtAfterEvent) => {
        if (event.hurtEntity.id === player.id) {
            player.onScreenDisplay.setActionBar('§cTeleport canceled because you took damage.');
            playSound(player, 'note.bass', { volume: 1.0, pitch: 0.5 });
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
                playSound(player, 'note.bass', { volume: 1.0, pitch: 0.5 });
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
                playSound(player, 'random.levelup', { volume: 0.5, pitch: 1.0 });
                cleanup();
                onWarmupComplete();
            }
        } catch (e: unknown) {
            errorLog(`[Warmup] Error during warmup interval for ${player.name}: ${String(e)}`);
            cleanup();
        }
    }, 20);
}

/**
 * Formats a string by replacing placeholders with values from a context object.
 * @param template The string template with placeholders like {key}.
 * @param context An object containing the values to substitute.
 * @returns The formatted string.
 */
export function formatString(template: string, context: Record<string, string | number | boolean>): string {
    if (!template) {
        return '';
    }
    // Replace \n with actual newlines first
    let message = template.replace(/\\n/g, '\n');

    // Replace placeholders
    for (const key in context) {
        if (Object.prototype.hasOwnProperty.call(context, key)) {
            const placeholder = new RegExp(`{${key}}`, 'g');
            message = message.replace(placeholder, String(context[key]));
        }
    }
    return message;
}

export function formatCooldown(seconds: number): string {
    if (seconds <= 0) {
        return 'Ready';
    }

    const d = Math.floor(seconds / (3600 * 24));
    const h = Math.floor((seconds % (3600 * 24)) / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);

    let result = '';
    if (d > 0) {
        result += `${d}d `;
    }
    if (h > 0) {
        result += `${h}h `;
    }
    if (m > 0) {
        result += `${m}m `;
    }
    if (s > 0) {
        result += `${s}s`;
    }

    return result.trim();
}

/**
 * Generates a clean, human-readable display name from an item's type ID.
 * Example: 'minecraft:diamond_sword' becomes 'Diamond Sword'.
 * @param typeId The item's type ID.
 * @returns A formatted display name.
 */
export function generateDisplayName(typeId: string): string {
    if (!typeId) {
        return 'Unknown Item';
    }

    // Remove the namespace (e.g., 'minecraft:')
    const nameWithoutNamespace = typeId.includes(':') ? typeId.split(':')[1] : typeId;

    // Replace underscores with spaces and capitalize each word
    const formattedName = nameWithoutNamespace
        .split('_')
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');

    return formattedName;
}

/**
 * Resolves an icon path from an item ID.
 * Uses heuristics to guess the path based on whether it's a block or item.
 * @param typeId The item ID (e.g. 'minecraft:diamond').
 * @returns The resolved icon path.
 */
export function resolveIcon(typeId: string): string {
    if (!typeId) {
        return 'textures/ui/help_question_mark';
    }

    const id = typeId.replace('minecraft:', '');

    // Handle spawn eggs
    if (id.endsWith('_spawn_egg')) {
        const entityName = id.replace('_spawn_egg', '');
        return `textures/items/spawn_eggs/spawn_egg_${entityName}`;
    }

    // Check if it's a block to guess the folder
    if (mc.BlockTypes.get(typeId)) {
        return `textures/blocks/${id}`;
    }

    // Default to item folder
    return `textures/items/${id}`;
}

/**
 * Formats a location object into a human-readable string.
 * @param location The location object.
 * @returns A formatted string (e.g., "X: 10.50, Y: 64.00, Z: -12.25 in Overworld").
 */
export function formatLocation(location: { x: number; y: number; z: number; dimensionId?: string }): string {
    if (!location) {
        return 'an unknown location';
    }
    const x = location.x.toFixed(2);
    const y = location.y.toFixed(2);
    const z = location.z.toFixed(2);
    const dimensionName = (location.dimensionId || 'Unknown')
        .replace('minecraft:', '')
        .replace('_', ' ')
        .replace(/\b\w/g, (l) => l.toUpperCase());
    return `X: ${x}, Y: ${y}, Z: ${z} in ${dimensionName}`;
}

interface EconomyConfig {
    currencySymbol?: string;
}

/**
 * Formats a number as a currency string, using the symbol from the config.
 * Supports short forms like k, M, B, T.
 * @param amount The amount to format.
 * @returns The formatted currency string (e.g., "$105k").
 */
export function formatCurrency(amount: number): string {
    const economyConfig = getEconomyConfig() as EconomyConfig;
    const symbol = economyConfig.currencySymbol || '$';
    const isNegative = amount < 0;
    const absAmount = Math.abs(amount);
    let formattedAmount = '';

    const suffixes = [
        { value: 1e24, symbol: 'S' },
        { value: 1e21, symbol: 's' },
        { value: 1e18, symbol: 'Q' },
        { value: 1e15, symbol: 'q' },
        { value: 1e12, symbol: 'T' },
        { value: 1e9, symbol: 'B' },
        { value: 1e6, symbol: 'M' },
        { value: 1e3, symbol: 'k' }
    ];

    const suffix = suffixes.find((s) => absAmount >= s.value);

    if (suffix) {
        // Use at most 2 decimal places for large numbers, but remove trailing zeros/decimal if whole
        formattedAmount =
            (absAmount / suffix.value)
                .toFixed(2)
                .replace(/\.00$/, '')
                .replace(/(\.\d)0$/, '$1') + suffix.symbol;
    } else {
        formattedAmount = absAmount.toFixed(2);
    }

    return `${isNegative ? '-' : ''}${symbol}${formattedAmount}`;
}

/**
 * Parses a currency string (e.g., "1.5k", "2M", "500") into a number.
 * Supports k, m, b, t suffixes (case insensitive).
 * Also accepts numbers directly.
 * Returns NaN if the format is invalid.
 * @param input The input string or number to parse.
 * @returns The parsed number or NaN.
 */
export function parseCurrency(input: string | number): number {
    if (typeof input === 'number') {
        return input;
    }
    if (!input) return NaN;

    const normalized = input.trim().toLowerCase();
    const regex = /^([\d.]+)([kmbt]?)$/;
    const match = normalized.match(regex);

    if (!match) {
        return NaN;
    }

    const value = parseFloat(match[1]);
    const suffix = match[2];

    if (isNaN(value)) {
        return NaN;
    }

    let multiplier = 1;
    switch (suffix) {
        case 'k':
            multiplier = 1000;
            break;
        case 'm':
            multiplier = 1000000;
            break;
        case 'b':
            multiplier = 1000000000;
            break;
        case 't':
            multiplier = 1000000000000;
            break;
    }

    return value * multiplier;
}
