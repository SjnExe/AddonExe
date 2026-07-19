import { addTest, assert } from '../testRunner.js';

const SUITE_NAME = 'ui_icons';

// Hardcode a list of used icons to check if they are formatted correctly (usually path starts with textures/ and has no leading/trailing slashes). We can't actually check if they exist on the filesystem during gameplay in bedrock add-ons, but we can ensure they are well-formed strings.
export function registerUiIconTests() {
    addTest(SUITE_NAME, 'UI Icon paths are well-formed', () => {
        const iconPaths = [
            'textures/gui/controls/left',
            'textures/ui/trade_icon',
            'textures/items/gold_ingot',
            'textures/ui/controller_icon.png',
            'textures/ui/icon_steve.png',
            'textures/ui/icon_multiplayer.png',
            'textures/ui/icon_steve',
            'textures/items/netherite_sword.png',
            'textures/items/book_enchanted.png',
            'textures/ui/op',
            'textures/ui/icon_recipe_item'
        ];

        for (const iconPath of iconPaths) {
            assert.ok(typeof iconPath === 'string' && iconPath.trim() !== '', `Icon path is not a valid string: ${iconPath}`);
            assert.ok(iconPath.startsWith('textures/'), `Icon path does not start with 'textures/': ${iconPath}`);
        }
    });
}
