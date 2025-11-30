import * as GameTest from '@minecraft/server-gametest';

import { incrementBounty, setBounty, getBounty } from '../core/bountyManager.js';
import { incrementPlayerBalance, getOrCreatePlayer, setPlayerBalance } from '../core/playerDataManager.js';

GameTest.register('AddonExe', 'BountyLogic', (test) => {
    // We can't easily spawn a SimulatedPlayer and expect it to have persisted data or valid session
    // unless the entire addon stack handles it.
    // Instead, we verify the MANAGERS logic in isolation using the test context if possible,
    // OR we rely on the fact that managers work with any object that looks like a Player.

    // However, GameTests run in the actual world.
    // Let's spawn a simulated player.
    const simPlayer = test.spawnSimulatedPlayer({ x: 0, y: 2, z: 0 }, 'BountyTester');

    test.runAfterDelay(20, () => {
        // Ensure player data exists
        getOrCreatePlayer(simPlayer);

        // Reset state
        setPlayerBalance(simPlayer.id, 1000);
        setBounty(simPlayer.id, 0); // Clear bounty

        // 1. Place Bounty Logic
        const startBalance = getOrCreatePlayer(simPlayer).balance;
        const bountyAmount = 100;

        // Simulate "Place Bounty"
        incrementPlayerBalance(simPlayer.id, -bountyAmount);
        setBounty(simPlayer.id, bountyAmount);

        const afterPlaceBalance = getOrCreatePlayer(simPlayer).balance;
        const activeBounty = getBounty(simPlayer.id);

        test.assert(
            afterPlaceBalance === 900,
            `Balance did not decrease correctly. Start: ${startBalance}, End: ${afterPlaceBalance}`
        );
        test.assert(
            activeBounty !== undefined && activeBounty.amount === 100,
            `Bounty not set correctly. Expected 100, got ${activeBounty?.amount}`
        );

        // 2. Pay Off Logic (Remove Bounty partial)
        const payOffAmount = 30;

        // Simulate "Remove Bounty" (Pay off)
        incrementPlayerBalance(simPlayer.id, -payOffAmount);
        incrementBounty(simPlayer.id, -payOffAmount);

        const afterPayBalance = getOrCreatePlayer(simPlayer).balance;
        const reducedBounty = getBounty(simPlayer.id);

        test.assert(
            afterPayBalance === 870,
            `Balance did not decrease on pay-off. Expected 870, got ${afterPayBalance}`
        );
        test.assert(
            reducedBounty !== undefined && reducedBounty.amount === 70,
            `Bounty not reduced correctly. Expected 70, got ${reducedBounty?.amount}`
        );

        test.succeed();
    });
})
.tag(GameTest.Tags.suiteDefault);
