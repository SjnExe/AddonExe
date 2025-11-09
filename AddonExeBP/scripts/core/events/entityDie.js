import * as mc from '@minecraft/server';
import { getOrCreatePlayer, setPlayerLastDeathLocation, incrementPlayerBalance } from '../playerDataManager.js';
import * as lastHitManager from '../lastHitManager.js';
import * as playerCache from '../playerCache.js';
import * as bountyManager from '../bountyManager.js';
import { getConfig } from '../configManager.js';
import { debugLog } from '../logger.js';
import { errorLog } from '../logger.js';

export const eventName = 'entityDie';

function handleEntityDie(event) {
    const { deadEntity } = event;
    if (deadEntity.typeId !== 'minecraft:player') {
        return;
    }

    const deadPlayer = deadEntity;
    const config = getConfig();

    if (config.playerInfo.enableDeathCoords) {
        const pData = getOrCreatePlayer(deadPlayer);
        if (pData) {
            const deathLocation = {
                x: deadPlayer.location.x,
                y: deadPlayer.location.y,
                z: deadPlayer.location.z,
                dimensionId: deadPlayer.dimension.id
            };
            setPlayerLastDeathLocation(deadPlayer.id, deathLocation);
        }
    }

    try {
        const lastHit = lastHitManager.getLastHit(deadPlayer.id);
        if (!lastHit) {
            return;
        }

        lastHitManager.clearLastHit(deadPlayer.id);

        const timeSinceHit = (Date.now() - lastHit.timestamp) / 1000;
        const creditTimeout = config.bounties?.bountyCreditTimeoutSeconds ?? 15;

        if (timeSinceHit > creditTimeout) {
            debugLog(`[BountyClaim] Kill credit for ${deadPlayer.name} expired. Time since last hit: ${timeSinceHit}s`);
            return;
        }

        const killer = playerCache.getPlayerFromCache(lastHit.attackerId);
        if (killer && killer.isValid && killer.id !== deadPlayer.id) {
            const bounty = bountyManager.getBounty(deadPlayer.id);
            if (bounty && bounty.amount > 0) {
                incrementPlayerBalance(killer.id, bounty.amount);
                bountyManager.removeBounty(deadPlayer.id);

                mc.world.sendMessage(`§a${killer.name} has claimed the bounty of §e$${bounty.amount.toFixed(2)}§a on ${deadPlayer.name}!`);
                debugLog(`[BountyClaim] ${killer.name} claimed bounty on ${deadPlayer.name} for $${bounty.amount}.`);
            }
        }
    } catch (e) {
        errorLog('[BountyClaim] A fatal error occurred during bounty processing.');
        try {
            errorLog(`[BountyClaim] Raw Error: ${JSON.stringify(e, Object.getOwnPropertyNames(e))}`);
        } catch {
            errorLog(`[BountyClaim] Could not stringify error object. Message: ${e?.message}`);
        }
        errorLog(`[BountyClaim] Error Stack: ${e?.stack}`);
    }
}

export default handleEntityDie;