import * as mc from '@minecraft/server';

import { CommandExecutor } from '@commands/commandManager.js';

import { getConfig } from '../configManager.js';
import { warnLog } from '../logger.js';
import { startRestart } from '../restartManager.js';

export function handleScriptEventReceive(event: mc.ScriptEventCommandMessageAfterEvent) {
    const { id, sourceEntity } = event;

    // Handle script unload event
    if (id === 'minecraft:script_unload') {
        // Script unload is handled by a subscription in main.js for now,
        // as it requires access to cleanupAddon which is local to main.js.
        // We might refactor this later.
        return;
    }

    const config = getConfig(); // Config should be loaded by the time this event fires for custom events.
    if (!config) {
        return;
    }

    switch (id) {
        case 'exe:restart': {
            if (sourceEntity instanceof mc.Player) {
                startRestart(sourceEntity);
            } else if (!sourceEntity) {
                // If no source entity, assume console/server
                startRestart({
                    sendMessage: (msg: string) => warnLog(msg),
                    name: 'Console',
                    isConsole: true
                } as CommandExecutor);
            }
            break;
        }
    }
}
