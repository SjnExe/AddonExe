import { getConfig, initializeConfigManager } from '@core/config/configManager.js';
import { dataManager, loadPersistentData } from '@core/data/dataManager.js';
import { initializeMigration } from '@core/data/migrationManager.js';
import { getAllPlayersFromCache } from '@core/data/playerCache.js';
import { cleanupPlayerDataManager } from '@core/data/playerDataManager.js';
import { cleanupEventManager, initializeEventManager } from '@core/events/eventManager.js';
import * as rankManager from '@core/permissions/rankManager.js';
import { escapeBedrockPercent, reinitializeOnlinePlayers } from '@core/utils/index.js';
import { errorLog, infoLog, setLogLevel } from '@core/utils/logger.js';
import { cleanupTimers } from '@core/utils/timerManager.js';
import { cleanupLeaderboardManager } from '@features/economy/leaderboard.js';
import { cleanup as cleanupFloatingText } from '@features/essentials/floatingText/manager.js';
import { cleanupSpawnProtection } from '@features/essentials/protection/spawnProtection.js';
import * as sidebarManager from '@features/sidebar/manager.js';
import { isNonEmptyString } from '@lib/guards.js';
import * as mc from '@minecraft/server';
import { loadCommands } from 'virtual:command-index';

const addonVersion = typeof __VERSION__ !== 'undefined' ? __VERSION__ : '0.0.1'; // Current Addon Version

// Load Commands immediately to register slash commands during startup
loadCommands();

/** Initializes the addon. This function should be called once at startup. */
let percentPatchApplied = false;
function installBedrockPercentChatPatch(): void {
  if (percentPatchApplied || 'mockImplementation' in mc.world.sendMessage) {
    return;
  }
  percentPatchApplied = true;
  try {
    const origPlayerSend = mc.Player.prototype.sendMessage;
    if (typeof origPlayerSend === 'function') {
      mc.Player.prototype.sendMessage = function (message: Parameters<typeof origPlayerSend>[0]) {
        const safeMsg = typeof message === 'string' ? escapeBedrockPercent(message) : message;
        return origPlayerSend.call(this, safeMsg);
      };
    }
    const origWorldSend = mc.world.sendMessage.bind(mc.world);
    if (typeof origWorldSend === 'function') {
      mc.world.sendMessage = (message: Parameters<typeof origWorldSend>[0]) => {
        const safeMsg = typeof message === 'string' ? escapeBedrockPercent(message) : message;
        return origWorldSend(safeMsg);
      };
    }
  } catch {
    // Ignore if prototype is frozen in mock runtime
  }
}

export async function initializeAddon() {
  installBedrockPercentChatPatch();
  infoLog('[AddonExe] Initializing...');

  // Version Check & Migration Flag
  const newVersionStr = addonVersion;
  const lastVersionStr =
    (mc.world.getDynamicProperty('exe:version') as string | undefined) ??
    (mc.world.getDynamicProperty('exe:lastVersion') as string | undefined);

  let isMigration = true;
  if (isNonEmptyString(lastVersionStr)) {
    // Trigger migration if the version string changes at all (Major, Minor, or Patch)
    isMigration = lastVersionStr !== newVersionStr;
  }

  const { initializePlayerCache } = await import('@core/data/playerCache.js');
  initializePlayerCache();

  await initializeConfigManager(isMigration);

  const config = getConfig();
  setLogLevel(config.logLevel);

  dataManager.initializeDataManager();
  loadPersistentData();
  await initializeMigration(newVersionStr);
  initializeManagers();

  const { featureRegistry } = await import('@core/services/featureRegistry.js');

  for (const feature of featureRegistry) {
    try {
      const module = await feature.load();
      if (module.initialize) {
        await module.initialize(isMigration, feature.subfeatures);
      }
    } catch (error) {
      errorLog(`[FeatureRegistry] Failed to initialize feature '${feature.id}': ${String(error)}`);
    }
  }

  initializeEventManager();

  reinitializeOnlinePlayers();

  infoLog('[AddonExe] Addon initialized successfully.');
}

function initializeManagers() {
  rankManager.initialize();
}

/** Updates all player ranks. This is useful when ranks are changed via commands. */
export function updateAllPlayerRanks() {
  const config = getConfig();
  for (const player of getAllPlayersFromCache()) {
    rankManager.updatePlayerNameTag(player, config);
  }
}

function cleanupAddon() {
  infoLog('[AddonExe] SCRIPT_UNLOAD detected. Cleaning up timers and events...');
  cleanupSpawnProtection();
  cleanupFloatingText();
  cleanupPlayerDataManager();
  sidebarManager.cleanup();
  cleanupLeaderboardManager();
  cleanupEventManager();
  cleanupTimers();
  infoLog('[AddonExe] Cleanup complete. The script will now unload.');
}

mc.system.runTimeout(() => {
  void (async () => {
    try {
      await initializeAddon();
    } catch (error: unknown) {
      errorLog('[AddonExe] A critical error occurred during addon initialization:');
      if (error instanceof Error) {
        errorLog(`Message: ${error.message}`);
        if (error.stack !== undefined) {
          errorLog(`Stack: ${error.stack}`);
        }
      } else {
        errorLog(`Error: ${String(error)}`);
      }
      mc.world.sendMessage(
        '§l§c[AddonExe] A critical error occurred during startup. Please check the content log for details.',
      );
    }
  })();
}, 0);

mc.system.beforeEvents.shutdown.subscribe(() => {
  cleanupAddon();
});
