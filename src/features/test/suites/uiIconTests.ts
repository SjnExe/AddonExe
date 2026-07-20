import { usedIcons } from 'virtual:icon-index';
import { addTest, assert } from '../testRunner.js';

const SUITE_NAME = 'ui_icons';

// Uses a virtual list of icons generated during build time to check if they are formatted correctly (usually path starts with textures/ and has no leading/trailing slashes). We can't actually check if they exist on the filesystem during gameplay in bedrock add-ons, but we can ensure they are well-formed strings.
export function registerUiIconTests() {
    addTest(SUITE_NAME, 'UI Icon paths are well-formed', () => {
        const iconPaths = usedIcons;
        assert.ok(iconPaths.length > 0, 'No icons were found in the codebase. Build script might be misconfigured.');

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
