/**
 * Spawn protection lifecycle module.
 *
 * PvP, hostile damage, and environmental damage protections are now dynamically evaluated on-demand via
 * handleBeforeEntityHurt in protectionEvents.ts using the modern Script API (cancellable entityHurt before events),
 * avoiding background polling intervals and eliminating the need for legacy player.json entity modifications.
 */

export function initializeSpawnProtection(): void {
  // Spawn and zone protection flags are dynamically evaluated in real-time
  // via handleBeforeEntityHurt without requiring background tick loops.
}

export function cleanupSpawnProtection(): void {
  // No persistent background intervals or state to clear
}
