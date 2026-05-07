/**
 * @fileoverview Manages tracking the last player who damaged another player.
 * This is used to determine the killer when the `damageCause` in the `entityDie`
 * event is unreliable.
 */

interface LastHitInfo {
    attackerId: string;
    timestamp: number;
}

/**
 * A map of player IDs to their last hit information.
 * Key: Victim's Player ID, Value: LastHitInfo
 */
const lastHitData = new Map<string, LastHitInfo>();

/**
 * Records a hit from an attacker to a victim.
 * @param victimId The ID of the player who was hit.
 * @param attackerId The ID of the player who performed the hit.
 */
export function setLastHit(victimId: string, attackerId: string): void {
    lastHitData.set(victimId, {
        attackerId: attackerId,
        timestamp: Date.now()
    });
}

/**
 * Retrieves the last hit information for a given player.
 * @param victimId The ID of the player to get the last hit info for.
 */
export function getLastHit(victimId: string): LastHitInfo | undefined {
    return lastHitData.get(victimId);
}

/**
 * Clears the last hit data for a player. This should be called after a bounty
 * is processed to prevent the data from being used again.
 * @param victimId The ID of the player whose last hit data should be cleared.
 */
export function clearLastHit(victimId: string): void {
    lastHitData.delete(victimId);
}
