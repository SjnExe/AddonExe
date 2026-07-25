import { CustomCommand } from '@commands/commandManager.js';
import * as mc from '@minecraft/server';
import { ActionFormBuilder } from '@ui/builders/ActionFormBuilder.js';

const command: CustomCommand = {
    name: 'newui',
    description: 'Test custom resource pack UI textures and flow.',
    category: 'Administration',
    permissionNode: 'cmd.newui.admin',
    allowConsole: false,
    parameters: [{ name: 'testOption', type: 'string', optional: true, description: 'Pass "1" or other options to test different layouts.' }],
    execute: (executor, args) => {
        const player = executor as mc.Player;
        const testOption = args.testOption as string | undefined;

        void showNewUiTest(player, testOption);
    }
};

async function showNewUiTest(player: mc.Player, testOption?: string) {
    const form = new ActionFormBuilder();

    if (testOption === '1') {
        form.title('§l§9Custom UI Test 1');
        form.body('This is testing the integration of Resource Pack textures.\nImagine this is a highly customized interactive dialogue.');
        form.button('§aAccept', 'textures/ui/confirm');
        form.button('§cDecline', 'textures/ui/cancel');
    } else {
        form.title('§l§6Advanced UI Panel');
        form.body('Testing vanilla textures mapped onto ActionFormData.');

        // Use generic Vanilla UI textures
        form.button('Player Info', 'textures/ui/FriendsIcon');
        form.button('Settings', 'textures/ui/settings_glyph_color_2x');
        form.button('Quests', 'textures/ui/icon_recipe_item');
        form.button('Teleportation', 'textures/blocks/beacon');
        form.button('Store', 'textures/items/emerald');
    }

    form.addBackButton(() => {
        player.sendMessage('Exited custom UI test.');
    });

    await form.show(player);
}

export default command;
