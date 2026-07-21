import { getOrCreatePlayer, incrementPlayerBalance, transfer } from '@core/playerDataManager.js';
import * as mc from '@minecraft/server';
import { addTest, assert } from '../testRunner.js';

const SUITE_NAME = 'economy_transfer';

// Helper to find a real player during tests
function getOnlinePlayer(): mc.Player | undefined {
    const players = mc.world.getAllPlayers();
    return players.length > 0 ? players[0] : undefined;
}

export function registerEconomyTransferTests() {
    addTest(SUITE_NAME, 'Economy transfer fails for zero/negative amounts', () => {
        const player = getOnlinePlayer();
        if (!player) {
            // Test skipped if no players are online
            return;
        }

        getOrCreatePlayer(player);
        const pId = player.id;
        incrementPlayerBalance(pId, 100);

        // Attempting to transfer to oneself is actually allowed by transfer(), but we are testing 0 and negative amounts.
        const resultZero = transfer(pId, 'dummyId', 0);
        assert.equal(resultZero.success, false, 'Transfer should fail for 0 amount');

        const resultNeg = transfer(pId, 'dummyId', -50);
        assert.equal(resultNeg.success, false, 'Transfer should fail for negative amount');
    });
}
