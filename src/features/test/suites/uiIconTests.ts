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
            'textures/ui/icon_recipe_item',
            'textures/items/diamond_sword',
            'textures/ui/WarningGlyph',
            'textures/items/emerald',
            'textures/ui/inventory_icon',
            'textures/ui/permissions_member_star.png',
            'textures/ui/Scaffolding',
            'textures/blocks/diamond_ore',
            'textures/items/book_writable',
            'textures/ui/icon_recipe_nature',
            'textures/gui/controls/left.png',
            'textures/items/iron_sword',
            'textures/ui/skull_face',
            'textures/items/clock_item',
            'textures/ui/arrow_left.png',
            'textures/ui/arrow_right.png',
            'textures/ui/profile_glyph_color',
            'textures/items/chain.png',
            'textures/ui/cancel.png',
            'textures/ui/mute_on.png',
            'textures/ui/mute_off.png',
            'textures/ui/hammer_l.png',
            'textures/ui/icon_rank.png',
            'textures/ui/inventory_icon.png',
            'textures/ui/icon_map.png',
            'textures/ui/color_plus',
            'textures/items/netherite_sword',
            'textures/ui/icon_rank',
            'textures/ui/text_color_paintbrush',
            'textures/ui/settings_glyph_color_2x',
            'textures/ui/icon_sign',
            'textures/ui/edit',
            'textures/ui/icon_map',
            'textures/ui/refresh_light',
            'textures/ui/cancel',
            'textures/ui/trash',
            'textures/ui/warning_alert',
            'textures/ui/repeat',
            'textures/ui/refresh',
            'textures/ui/arrow_up',
            'textures/ui/arrow_down',
            'textures/blocks/beacon',
            'textures/ui/chat_send',
            'textures/ui/folder_glyph',
            'textures/ui/realms_green_check',
            'textures/ui/multiplayer',
            'textures/ui/plus',
            'textures/ui/invite_base',
            'textures/ui/info_icon',
            'textures/ui/icon_setting',
            'textures/items/item_frame',
            'textures/ui/portal',
            'textures/ui/magnifyingGlass',
            'textures/ui/user_icon'
        ];

        for (const iconPath of iconPaths) {
            assert.ok(typeof iconPath === 'string' && iconPath.trim() !== '', `Icon path is not a valid string: ${iconPath}`);
            assert.ok(iconPath.startsWith('textures/'), `Icon path does not start with 'textures/': ${iconPath}`);
        }
    });

    addTest(SUITE_NAME, 'UI Icon path invalid detection', () => {
        const invalidIconPaths = ['invalid_textures/gui/controls/left', 'textures_items/gold_ingot', 'gui/controls/left', ''];

        for (const iconPath of invalidIconPaths) {
            let threwError = false;
            try {
                assert.ok(typeof iconPath === 'string' && iconPath.trim() !== '', `Icon path is not a valid string: ${iconPath}`);
                assert.ok(iconPath.startsWith('textures/'), `Icon path does not start with 'textures/': ${iconPath}`);
            } catch {
                threwError = true;
            }
            assert.ok(threwError, `Expected test to fail for invalid icon path: ${iconPath}`);
        }
    });
}
