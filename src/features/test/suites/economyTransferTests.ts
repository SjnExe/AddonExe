import { getBalance, getOrCreatePlayer, setPlayerBalance, transfer } from '@core/playerDataManager.js';
import * as mc from '@minecraft/server';
import { addTest, assert } from '../testRunner.js';

const SUITE_NAME = 'economy_transfer';

function getOnlinePlayer(): mc.Player | undefined {
    const players = mc.world.getAllPlayers();
    return players.length > 0 ? players[0] : undefined;
}

export function registerEconomyTransferTests() {
    addTest(SUITE_NAME, 'Economy transfer rejects zero, negative, and excessive amounts safely without mutating balance', () => {
        const player = getOnlinePlayer();
        if (!player) {
            return;
        }

        getOrCreatePlayer(player);
        const pId = player.id;
        const originalBalance = getBalance(pId) ?? 0;

        try {
            setPlayerBalance(pId, 500);

            const resultZero = transfer(pId, 'dummy_offline_target', 0);
            assert.equal(resultZero.success, false, 'Transfer should fail for 0 amount');

            const resultNeg = transfer(pId, 'dummy_offline_target', -50);
            assert.equal(resultNeg.success, false, 'Transfer should fail for negative amount');

            const resultInsufficient = transfer(pId, 'dummy_offline_target', 10_000);
            assert.equal(resultInsufficient.success, false, 'Transfer should fail when amount exceeds balance');

            assert.equal(getBalance(pId), 500, 'Player balance should remain unchanged after failed transfers');
        } finally {
            setPlayerBalance(pId, originalBalance);
        }
    });
}
