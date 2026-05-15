import { getConfig } from '@core/configManager.js';
import { errorLog } from '@core/logger.js';
import * as mc from '@minecraft/server';

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
 * Plays a sound for a specific player.
 * @param player The player to play the sound for.
 * @param soundId The ID of the sound to play.
 * @param options options for the sound.
 */
export function playSound(player: mc.Player, soundId: string, options: mc.PlayerSoundOptions = {}): void {
    try {
        player.playSound(soundId, options);
    } catch (error: unknown) {
        errorLog(`Failed to play sound "${soundId}" for player ${player.name}: ${String(error)}`);
    }
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
