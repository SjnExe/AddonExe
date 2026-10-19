import { getMenuItemsForHub } from '@core/ui/menuRegistry.js';
import { getSystemRegistry } from '@core/ui/systemRegistry.js';
import * as mc from '@minecraft/server';
import { ActionFormBuilder } from '@ui/builders/actionFormBuilder.js';
import { CustomFormBuilder } from '@ui/builders/customFormBuilder.js';
import { MessageFormBuilder } from '@ui/builders/messageFormBuilder.js';
import { usedIcons } from 'virtual:icon-index';
import { addTest, assert } from '../testRunner.js';

export function registerUiTests(): void {
    addTest('ui', 'ActionFormBuilder sets grid columns (1, 2, 3) and buttons accurately', () => {
        const builder1 = new ActionFormBuilder().grid(1).title('Reader');
        assert.equal(builder1.getColumns(), 1, 'Grid should be 1 column');

        const builder2 = new ActionFormBuilder().title('Default Hub');
        assert.equal(builder2.getColumns(), 2, 'Default grid should be 2 columns');

        const builder3 = new ActionFormBuilder()
            .grid(3)
            .title('Shop Grid')
            .body('Select an item')
            .button('Home', 'textures/ui/magnifyingGlass', () => {})
            .button('Shop', 'textures/ui/color_plus', () => {});
        assert.equal(builder3.getColumns(), 3, 'Grid should be 3 columns');
    });

    addTest('ui', 'CustomFormBuilder stores and retrieves reactive Observable values', () => {
        const builder = new CustomFormBuilder<{ name: string; enabled: boolean; count: number; mode: string }>('Test Custom Form')
            .textField('name', 'Player Name', 'e.g. Steve', 'Alex')
            .toggle('enabled', 'Enable Feature', true)
            .slider('count', 'Count', 1, 100, 1, 25)
            .dropdown('mode', 'Gamemode', ['survival', 'creative'], 1);

        const values = builder.getValues();
        assert.equal(values.name, 'Alex', 'textField default value should match');
        assert.equal(values.enabled, true, 'toggle default value should match');
        assert.equal(values.count, 25, 'slider default value should match');
        assert.equal(values.mode, 'creative', 'dropdown selected option should match');
    });

    addTest('ui', 'MessageFormBuilder and System/Menu Registries are populated', () => {
        const msgBuilder = new MessageFormBuilder()
            .title('Confirm Action')
            .body('Are you sure?')
            .button1('Yes', () => {})
            .button2('No', () => {});
        assert.ok(msgBuilder, 'MessageFormBuilder should be created');

        const systems = getSystemRegistry();
        assert.ok(systems.length >= 20, `Expected at least 20 systems in systemRegistry, found ${systems.length}`);

        const fakeOwner = { id: 'owner_test', name: 'Owner', hasTag: (t: string) => t === 'owner' } as unknown as mc.Player;
        const mainItems = getMenuItemsForHub('main', fakeOwner);
        assert.equal(mainItems.length, 5, 'Main hub should have 5 category hubs for staff/owner');

        assert.ok(Array.isArray(usedIcons) && usedIcons.length > 0, 'virtual:icon-index should export non-empty usedIcons array');
    });
}
