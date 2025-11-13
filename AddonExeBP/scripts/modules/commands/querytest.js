import * as mc from '@minecraft/server';
import { ActionFormData } from '@minecraft/server-ui';
import { admin, command } from '../../config/commands.js';
import { debugLog } from '../../core/logger.js';
import { uiWait } from '../../core/utils.js';

command.register({
    name: 'querytest',
    description: 'Runs a diagnostic test for entity queries after UI interactions.',
    permissionLevel: admin,
    category: 'utility'
}, async (player, args) => {
    const testId = 'ft_querytest';
    const location = player.location;
    const dimension = player.dimension;
    const query = { type: 'addonexe:floating_text', tags: [testId] };

    debugLog(`[QueryTest] Starting test for player ${player.name}...`);

    // --- Step 1: Clean up any old test entities ---
    try {
        dimension.runCommand(`kill @e[type=addonexe:floating_text,tag="${testId}"]`);
        debugLog('[QueryTest] Cleaned up any previous test entities.');
    } catch (e) {
        // Ignore if no entities were found
    }

    // --- Step 2: Spawn a new test entity ---
    mc.system.run(async () => {
        try {
            const spawnedEntity = dimension.spawnEntity('addonexe:floating_text', { x: location.x, y: location.y + 2, z: location.z });
            spawnedEntity.nameTag = 'Query Test Entity';
            spawnedEntity.addTag(testId);
            debugLog(`[QueryTest] Spawned test entity with tag '${testId}'.`);

            // --- Step 3: Immediate query after spawn ---
            await new Promise(resolve => mc.system.runTimeout(resolve, 1));
            const immediateEntity = dimension.getEntities(query)[Symbol.iterator]().next().value;
            debugLog(`[QueryTest] Immediate query result (1 tick after spawn): ${immediateEntity ? 'SUCCESS' : 'FAILURE'}`);

            // --- Step 4: Show a UI form ---
            debugLog('[QueryTest] Showing UI form...');
            const form = new ActionFormData()
                .title('Query Test')
                .body('Close this form to continue the test.')
                .button('Close');

            await uiWait(player, form);
            debugLog('[QueryTest] UI form closed. Starting post-UI query loop...');

            // --- Step 5: Post-UI query loop ---
            let foundInLoop = false;
            for (let i = 0; i < 20; i++) {
                await new Promise(resolve => mc.system.runTimeout(resolve, 2)); // Wait 2 ticks
                const entityInLoop = dimension.getEntities(query)[Symbol.iterator]().next().value;
                const found = entityInLoop && entityInLoop.isValid();
                debugLog(`[QueryTest] Post-UI query attempt #${i + 1}: ${found ? 'SUCCESS' : 'FAILURE'}`);
                if (found && !foundInLoop) {
                    foundInLoop = true;
                }
            }
            if(foundInLoop) {
                debugLog('[QueryTest] Entity was successfully re-acquired after UI closed.');
            } else {
                debugLog('[QueryTest] FAILED to re-acquire entity after UI closed.');
            }

            // --- Step 6: Final cleanup ---
            dimension.runCommand(`kill @e[type=addonexe:floating_text,tag="${testId}"]`);
            debugLog('[QueryTest] Test complete. Cleaned up test entity.');
            player.sendMessage("§aQuery test complete. Please check the logs.");

        } catch (e) {
            debugLog(`[QueryTest] An error occurred during the test: ${e.stack}`);
            player.sendMessage("§cAn error occurred during the test. Please check the logs.");
        }
    });
});