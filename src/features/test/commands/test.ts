import { CommandExecutor, CustomCommand, commandManager } from '@commands/commandManager.js';
import { sendMessage } from '@core/messaging.js';
import { runTests } from '../testRunner.js';
import { registerAllSuites } from '../suites/index.js';

// Pre-register all suites
registerAllSuites();

const testCommand: CustomCommand = {
    name: 'test',
    description: 'Runs tests on in-game APIs and systems.',
    category: 'Development',
    permissionNode: 'cmd.test',
    parameters: [
        {
            name: 'context',
            type: 'string',
            optional: true
        }
    ],
    execute: async (executor: CommandExecutor, args: Record<string, unknown>) => {
        const contextArg = args['context'];
        const context = typeof contextArg === 'string' ? contextArg.toLowerCase() : undefined;

        sendMessage(`§a[TestRunner] Starting tests${context ? ` for context: ${context}` : ' (All Suites)'}... Check console for results.`, executor);

        try {
            const results = await runTests(context);

            if (results.failed > 0) {
                sendMessage(`§c[TestRunner] Tests finished with ${results.failed} failures. See console for details.`, executor);
            } else {
                sendMessage(`§a[TestRunner] All ${results.passed} tests passed successfully!`, executor);
            }
        } catch (error) {
            sendMessage(`§c[TestRunner] An unexpected error occurred while running tests. See console.`, executor);
            console.error(error);
        }
    }
};

commandManager.register(testCommand);
