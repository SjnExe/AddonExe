import { MinecraftEntityTypes } from '@minecraft/vanilla-data';

import * as mc from '@minecraft/server';

import { getConfig } from '@core/configManager.js';
import * as lastHitManager from '@core/lastHitManager.js';
import { debugLog, errorLog } from '@core/logger.js';
import * as playerCache from '@core/playerCache.js';
import { getOrCreatePlayer, incrementPlayerBalance, setPlayerLastDeathLocation } from '@core/playerDataManager.js';
import * as bountyManager from '@features/economy/bountyManager.js';
import * as teamManager from '@features/team/manager.js';
import { saveLastLocation } from '@features/teleport/utils.js';
import { isDefined } from '@lib/guards.js';

export const eventName = 'entityDie';

function handleEntityDie(event: mc.EntityDieAfterEvent) {
    try {
        const { deadEntity } = event;
        if (deadEntity.typeId !== (MinecraftEntityTypes.Player as string)) {
            return;
        }

        const deadPlayer = deadEntity as mc.Player;
        const config = getConfig();

        // Save location for /back
        saveLastLocation(deadPlayer, 'death');

        if (config.playerInfo.enableDeathCoords) {
            getOrCreatePlayer(deadPlayer);
            const deathLocation = {
                x: deadPlayer.location.x,
                y: deadPlayer.location.y,
                z: deadPlayer.location.z,
                dimensionId: deadPlayer.dimension.id
            };
            setPlayerLastDeathLocation(deadPlayer.id, deathLocation);
        }

        const lastHit = lastHitManager.getLastHit(deadPlayer.id);
        if (!lastHit) {
            return;
        }

        lastHitManager.clearLastHit(deadPlayer.id);

        const timeSinceHit = (Date.now() - lastHit.timestamp) / 1000;
        const creditTimeout = config.bounties.bountyCreditTimeoutSeconds;

        if (timeSinceHit > creditTimeout) {
            debugLog(`[BountyClaim] Kill credit for ${deadPlayer.name} expired. Time since last hit: ${timeSinceHit}s`);
            return;
        }

        const killer = playerCache.getPlayerFromCache(lastHit.attackerId);
        if (killer && killer.isValid && killer.id !== deadPlayer.id) {
            const bounty = bountyManager.getBounty(deadPlayer.id);
            if (bounty && bounty.amount > 0) {
                // Check Team
                const killerTeamId = teamManager.getPlayerTeamId(killer.id);
                const victimTeamId = teamManager.getPlayerTeamId(deadPlayer.id);

                if (isDefined(killerTeamId) && isDefined(victimTeamId) && killerTeamId === victimTeamId) {
                    killer.sendMessage('§cYou cannot claim bounties on teammates!');
                    return;
                }

                incrementPlayerBalance(killer.id, bounty.amount);
                bountyManager.removeBounty(deadPlayer.id);

                mc.world.sendMessage(`§a${killer.name} has claimed the bounty of §e$${bounty.amount.toFixed(2)}§a on ${deadPlayer.name}!`);
                debugLog(`[BountyClaim] ${killer.name} claimed bounty on ${deadPlayer.name} for $${bounty.amount}.`);
            }
        }
    } catch (error: unknown) {
        errorLog('[BountyClaim] A fatal error occurred during bounty processing.');
        if (error instanceof Error) {
            errorLog(`[BountyClaim] Error: ${error.message}`);
            errorLog(`[BountyClaim] Stack: ${error.stack}`);
        } else {
            try {
                errorLog(`[BountyClaim] Raw Error: ${JSON.stringify(error)}`);
            } catch {
                errorLog(`[BountyClaim] Could not stringify error object.`);
            }
        }
    }
}

export default handleEntityDie;
