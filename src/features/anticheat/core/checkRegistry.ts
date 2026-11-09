import { errorLog } from '@core/utils/logger.js';
import { AntiCheatCheck } from '@features/anticheat/core/check.js';
import { clearPlayerGrace } from '@features/anticheat/core/graceManager.js';
import { clearPlayerAlertThrottles } from '@features/anticheat/flagManager.js';

/** Central registry managing lifecycle, registration, and state cleanup of anti-cheat checks. */
export class CheckRegistry {
  private readonly checks = new Map<string, AntiCheatCheck>();

  /**
   * Registers a new anti-cheat check into the active framework.
   *
   * @param check The check instance implementing the AntiCheatCheck interface.
   */
  registerCheck(check: AntiCheatCheck): void {
    this.checks.set(check.id, check);
  }

  /**
   * Retrieves a registered check by its identifier.
   *
   * @param id The programmatic identifier of the check.
   * @returns The check instance if registered, otherwise undefined.
   */
  getCheck(id: string): AntiCheatCheck | undefined {
    return this.checks.get(id);
  }

  /**
   * Retrieves an array of all registered anti-cheat checks.
   *
   * @returns Array of registered checks.
   */
  getAllChecks(): AntiCheatCheck[] {
    return Array.from(this.checks.values());
  }

  /** Starts all registered anti-cheat checks. */
  startAll(): void {
    for (const check of this.checks.values()) {
      try {
        check.start();
      } catch (error) {
        errorLog(`[AntiCheat:Registry] Failed to start check '${check.id}':`, error);
      }
    }
  }

  /** Stops all registered anti-cheat checks. */
  stopAll(): void {
    for (const check of this.checks.values()) {
      try {
        check.stop();
      } catch (error) {
        errorLog(`[AntiCheat:Registry] Failed to stop check '${check.id}':`, error);
      }
    }
  }

  /**
   * Cleans up transient tracking states across all registered checks for a specific player.
   *
   * @param playerId The unique ID of the departing player.
   */
  clearPlayer(playerId: string): void {
    for (const check of this.checks.values()) {
      try {
        check.clearPlayer(playerId);
      } catch (error) {
        errorLog(`[AntiCheat:Registry] Failed to clear player '${playerId}' for check '${check.id}':`, error);
      }
    }
  }

  /** Resets internal states across all registered checks for unit test isolation. */
  resetAll(): void {
    for (const check of this.checks.values()) {
      try {
        check.reset();
      } catch (error) {
        errorLog(`[AntiCheat:Registry] Failed to reset check '${check.id}':`, error);
      }
    }
  }

  /** Unregisters all checks from the registry. */
  unregisterAll(): void {
    this.checks.clear();
  }
}

/** Singleton instance of the check registry. */
export const checkRegistry = new CheckRegistry();

/**
 * Clears all cached anti-cheat states and grace windows across all checks for a player upon leaving.
 *
 * @param playerId The unique identifier of the player leaving the world.
 */
export function clearPlayerAntiCheatState(playerId: string): void {
  checkRegistry.clearPlayer(playerId);
  clearPlayerGrace(playerId);
  clearPlayerAlertThrottles(playerId);
}
