import { clearTrackedInterval, setTrackedInterval } from '@core/timerManager.js';
import * as mc from '@minecraft/server';

/**
 * Manager for handling script-driven visual and atmospheric effects.
 * This includes screen titles, actionbar messages, particles, and sounds.
 */
export class AtmosphereManager {
    /**
     * Show a title and subtitle on the player's screen.
     */
    public static showTitle(player: mc.Player, title: string, subtitle?: string, fadeInDuration = 20, stayDuration = 60, fadeOutDuration = 20): void {
        const titleDisplayOptions: mc.TitleDisplayOptions = {
            fadeInDuration,
            stayDuration,
            fadeOutDuration,
            subtitle
        };
        player.onScreenDisplay.setTitle(title, titleDisplayOptions);
    }

    /**
     * Show a message in the action bar (above hotbar).
     */
    public static showActionBar(player: mc.Player, message: string): void {
        player.onScreenDisplay.setActionBar(message);
    }

    /**
     * Spawn a particle effect at a specific location.
     */
    public static spawnParticle(dimension: mc.Dimension, particleId: string, location: mc.Vector3, variables?: mc.MolangVariableMap): void {
        dimension.spawnParticle(particleId, location, variables);
    }

    /**
     * Play a sound for a specific player.
     */
    public static playSoundForPlayer(player: mc.Player, soundId: string, options?: mc.PlayerSoundOptions): void {
        player.playSound(soundId, options);
    }

    /**
     * Play a sound at a specific location in a dimension for all nearby players.
     */
    public static playSoundAtLocation(dimension: mc.Dimension, soundId: string, location: mc.Vector3, options?: mc.WorldSoundOptions): void {
        dimension.playSound(soundId, location, options);
    }

    /**
     * Create a simple "cinematic" sweep by triggering a sequence of particles and sounds
     * over a duration using the ticking system. This relies on the system.runTimeout wrapper.
     */
    public static playCinematicEffect(player: mc.Player, particleId: string, soundId: string, durationTicks: number = 60): void {
        const startLocation = player.location;
        const dimension = player.dimension;

        let ticksElapsed = 0;

        // Example: play a sound at start
        this.playSoundForPlayer(player, soundId, { volume: 1.0, pitch: 1.0 });

        const intervalId = setTrackedInterval(() => {
            if (ticksElapsed >= durationTicks || !player.isValid) {
                clearTrackedInterval(intervalId);
                return;
            }

            // Spawn particles in a circle around the player
            const radius = 2;
            const angle = (ticksElapsed / durationTicks) * Math.PI * 2 * 3; // 3 full rotations

            const particleLoc = {
                x: startLocation.x + Math.cos(angle) * radius,
                y: startLocation.y + (ticksElapsed / durationTicks) * 2, // Rise up
                z: startLocation.z + Math.sin(angle) * radius
            };

            this.spawnParticle(dimension, particleId, particleLoc);
            ticksElapsed += 2; // Run every 2 ticks
        }, 2);
    }
}
