/**
 * @fileoverview Manages tracking the last player who damaged another player.
 * This is used to determine the killer when the `damageCause` in the `entityDie`
 * event is unreliable.
 */

/**
 * @typedef {object} LastHitInfo
 * @property {string} attackerId - The ID of the player who was the attacker.
 * @property {number} timestamp - The timestamp of when the hit occurred (in milliseconds).
 */

/**
 * A map of player IDs to their last hit information.
 * Key: Victim's Player ID, Value: LastHitInfo
 * @type {Map<string, LastHitInfo>}
 */
const lastHitData = new Map();

/**
 * Records a hit from an attacker to a victim.
 * @param {string} victimId The ID of the player who was hit.
 * @param {string} attackerId The ID of the player who performed the hit.
 */
export function setLastHit(victimId, attackerId) {
    lastHitData.set(victimId, {
        attackerId: attackerId,
        timestamp: Date.now()
    });
}

/**
 * Retrieves the last hit information for a given player.
 * @param {string} victimId The ID of the player to get the last hit info for.
 * @returns {LastHitInfo | undefined}
 */
export function getLastHit(victimId) {
    return lastHitData.get(victimId);
}

/**
 * Clears the last hit data for a player. This should be called after a bounty
 * is processed to prevent the data from being used again.
 * @param {string} victimId The ID of the player whose last hit data should be cleared.
 */
export function clearLastHit(victimId) {
    lastHitData.delete(victimId);
}
