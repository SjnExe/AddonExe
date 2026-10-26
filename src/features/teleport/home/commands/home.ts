import { CommandExecutor, CustomCommand } from '@commands/commandManager.js';
import { getConfig } from '@core/config/configManager.js';
import { errorLog } from '@core/utils/logger.js';
import { sendMessage } from '@core/utils/messaging.js';
import * as homesManager from '@features/teleport/home/manager.js';
import { executeTeleport } from '@features/teleport/utils.js';
import { isDefined, isNonEmptyString } from '@lib/guards.js';
import * as mc from '@minecraft/server';
import { ActionFormBuilder } from '@ui/builders/actionFormBuilder.js';

interface HomeCommandArgs {
  homeName?: string;
}

const homeCommand: CustomCommand = {
  name: 'home',
  description: 'Teleports you to one of your set homes.',
  category: 'Transportation',
  permissionNode: 'cmd.home.member',
  parameters: [{ name: 'homeName', type: 'string', optional: true }],
  execute: async (executor: CommandExecutor, args: HomeCommandArgs) => {
    if (!(executor instanceof mc.Player)) {
      return;
    }
    const config = getConfig();
    // Check global feature toggle first
    if (!config.homes.enabled) {
      sendMessage('§cThe Homes system is currently disabled globally.', executor);
      return;
    }

    const teleportToHome = (homeName: string) => {
      const homeLocation = homesManager.getHome(executor, homeName);
      if (!isDefined(homeLocation)) {
        sendMessage(`§cHome '${homeName}' not found.`, executor);
        return;
      }

      executeTeleport({
        executor,
        location: homeLocation,
        destinationName: homeName,
        teleportType: 'home',
        warmupSeconds: config.homes.teleportWarmupSeconds,
        cooldownSeconds: config.homes.cooldownSeconds,
        cooldownKey: 'homes',
      });
    };

    const homeNameArg = args.homeName;
    if (isNonEmptyString(homeNameArg)) {
      teleportToHome(homeNameArg);
      return;
    }

    const homeList = homesManager.listHomes(executor);

    if (homeList.length === 0) {
      sendMessage('§cYou have no homes set. Use §e/sethome <name>§c to create one.', executor);
      return;
    }

    const firstHome = homeList[0];
    if (homeList.length === 1 && isNonEmptyString(firstHome)) {
      teleportToHome(firstHome);
      return;
    }

    const form = new ActionFormBuilder().title('Teleport to Home').body('Select a home to teleport to:');

    for (const homeName of homeList) {
      form.button(homeName, 'textures/ui/icon_recipe_item', () => {
        teleportToHome(homeName);
      });
    }

    try {
      await form.show(executor, { wait: true });
    } catch (error: unknown) {
      errorLog(`[/home UI] ${String(error)}`);
    }
  },
};

const homesCommand: CustomCommand = {
  name: 'homes',
  description: 'Lists all of your set homes.',
  category: 'Transportation',
  aliases: ['homelist'],
  permissionNode: 'cmd.homes.member',
  execute: (executor: CommandExecutor) => {
    if (!(executor instanceof mc.Player)) {
      return;
    }
    const config = getConfig();
    if (!config.homes.enabled) {
      sendMessage('§cThe Homes system is currently disabled globally.', executor);
      return;
    }

    const homeList = homesManager.listHomes(executor);
    const homeCount = homeList.length;
    const maxHomes = config.homes.maxHomes;

    if (homeCount === 0) {
      sendMessage(`§aYou have no homes set. Use §e/sethome <name>§a to set one. (${homeCount}/${maxHomes})`, executor);
    } else {
      sendMessage(`§aYour homes (${homeCount}/${maxHomes}): §e${homeList.join(', ')}`, executor);
    }
  },
};

const delHomeCommand: CustomCommand = {
  name: 'delhome',
  aliases: ['remhome', 'deletehome', 'rmhome', '-home'],
  description: 'Deletes one of your set homes. Leave name blank to choose from a list.',
  category: 'Transportation',
  permissionNode: 'cmd.delhome.member',
  parameters: [{ name: 'homeName', type: 'string', optional: true }],
  execute: async (executor: CommandExecutor, args: HomeCommandArgs) => {
    if (!(executor instanceof mc.Player)) {
      return;
    }
    const config = getConfig();
    if (!config.homes.enabled) {
      sendMessage('§cThe Homes system is currently disabled globally.', executor);
      return;
    }

    const deleteHomeByName = (homeName: string) => {
      const result = homesManager.deleteHome(executor, homeName);
      sendMessage(result.success ? `§a${result.message}` : `§c${result.message}`, executor);
    };

    const homeNameArg = args.homeName;
    if (isNonEmptyString(homeNameArg)) {
      deleteHomeByName(homeNameArg);
      return;
    }

    const homeList = homesManager.listHomes(executor);

    if (homeList.length === 0) {
      sendMessage('§cYou have no homes to delete.', executor);
      return;
    }

    const firstHome = homeList[0];
    if (homeList.length === 1 && isNonEmptyString(firstHome)) {
      deleteHomeByName(firstHome);
      return;
    }

    const form = new ActionFormBuilder().title('Delete a Home').body('Select a home to delete:');

    for (const homeName of homeList) {
      form.button(homeName, 'textures/ui/trash', () => {
        deleteHomeByName(homeName);
      });
    }

    try {
      await form.show(executor, { wait: true });
    } catch (error: unknown) {
      errorLog(`[/delhome UI] ${String(error)}`);
    }
  },
};

const setHomeCommand: CustomCommand = {
  name: 'sethome',
  aliases: ['addhome', '+home'],
  description: 'Sets a home at your current location.',
  category: 'Transportation',
  permissionNode: 'cmd.sethome.member',
  parameters: [{ name: 'homeName', type: 'string', optional: true }],
  execute: (executor: CommandExecutor, args: HomeCommandArgs) => {
    if (!(executor instanceof mc.Player)) {
      return;
    }
    const config = getConfig();
    if (!config.homes.enabled) {
      sendMessage('§cThe Homes system is currently disabled globally.', executor);
      return;
    }

    let homeNameToSet;
    const homeNameArg = args.homeName;

    if (isNonEmptyString(homeNameArg)) {
      homeNameToSet = homeNameArg;
    } else {
      const existingHomes = new Set(homesManager.listHomes(executor).map((h: string) => h.toLowerCase()));
      const baseName = 'home';
      homeNameToSet = baseName;

      let i = 2;
      while (existingHomes.has(homeNameToSet)) {
        homeNameToSet = `${baseName}${i}`;
        i++;
      }
    }

    const result = homesManager.setHome(executor, homeNameToSet);
    sendMessage(result.success ? `§a${result.message}` : `§c${result.message}`, executor);
  },
};

export default [homeCommand, homesCommand, delHomeCommand, setHomeCommand];
