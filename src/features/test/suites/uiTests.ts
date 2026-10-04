import { ActionFormBuilder } from '@core/ui/builders/ActionFormBuilder.js';
import { CustomFormBuilder } from '@core/ui/builders/CustomFormBuilder.js';
import { MessageFormBuilder } from '@core/ui/builders/MessageFormBuilder.js';
import { addTest, assert } from '../testRunner.js';

export function registerUiTests(): void {
    addTest('ui', 'ActionFormBuilder creates forms with title, body, and grid buttons', () => {
        const builder = new ActionFormBuilder()
            .grid(3)
            .title('Server Menu')
            .body('Select an option')
            .button('Home', 'textures/ui/magnifyingGlass', () => {})
            .button('Shop', 'textures/ui/color_plus', () => {});

        assert.ok(builder, 'ActionFormBuilder instance should be created');
    });

    addTest('ui', 'CustomFormBuilder creates form with inputs', () => {
        const builder = new CustomFormBuilder('Test Custom Form').textField('name', 'Player Name', 'e.g. Steve').toggle('enabled', 'Enable Feature', true).slider('amount', 'Count', 1, 100, 1, 10);

        assert.ok(builder, 'CustomFormBuilder instance should be created');
    });

    addTest('ui', 'MessageFormBuilder creates confirmation form with buttons', () => {
        const builder = new MessageFormBuilder()
            .title('Confirm Action')
            .body('Are you sure you want to proceed?')
            .button1('Yes, proceed', () => {})
            .button2('Cancel', () => {});

        assert.ok(builder, 'MessageFormBuilder instance should be created');
    });
}
