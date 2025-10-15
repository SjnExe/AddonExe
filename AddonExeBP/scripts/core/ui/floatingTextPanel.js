import { ActionFormData, ModalFormData } from '@minecraft/server-ui';
import { floatingTextManager } from '../floatingTextManager.js';
import { registerPanel, openPanel } from './panelRegistry.js';

registerPanel('floatingTextList', (player) => {
    const form = new ActionFormData()
        .title('Floating Text Management')
        .body('Select a floating text to edit or create a new one.');

    const texts = floatingTextManager.getAllTexts();
    texts.forEach(text => {
        form.button(text.id, () => openPanel(player, 'floatingTextEdit', { id: text.id }));
    });

    form.button('§2+ Create New', () => openPanel(player, 'floatingTextCreate'));

    return form;
});

registerPanel('floatingTextEdit', (player, { id }) => {
    const text = floatingTextManager.getTextById(id);
    if (!text) {
        player.sendMessage("§cThat floating text doesn't exist anymore.");
        return;
    }

    const form = new ModalFormData()
        .title(`Edit: ${id}`)
        .textField('Text Content', 'Enter the text to display', text.text)
        .toggle('Is Dynamic (use placeholders)', text.isDynamic)
        .slider('Update Interval (seconds)', 1, 60, 1, text.updateInterval / 20)
        .toggle('Enable Expiration Timer', !!text.expiresAt)
        .textField('Expiration (minutes from now)', 'e.g., 60 for 1 hour', text.expiresAt ? String((text.expiresAt - Date.now()) / 60000) : '0');

    form.submitButton('§aSave Changes');
    form.button('§cDelete This Text', () => {
        floatingTextManager.deleteText(player, id);
        openPanel(player, 'floatingTextList');
    });


    form.show(player).then(response => {
        if (response.canceled) return;
        const [textContent, isDynamic, updateInterval, useExpiration, expirationMinutes] = response.formValues;

        const updatedConfig = {
            text: textContent,
            isDynamic: isDynamic,
            updateInterval: updateInterval * 20,
            expiresAt: useExpiration ? Date.now() + expirationMinutes * 60000 : null
        };

        floatingTextManager.updateText(id, updatedConfig);
        player.sendMessage(`§aSuccessfully updated floating text: ${id}`);
        openPanel(player, 'floatingTextList');
    });
});


registerPanel('floatingTextCreate', (player) => {
    const form = new ModalFormData()
        .title('Create New Floating Text')
        .textField('Unique ID', 'e.g., "welcome_message"')
        .textField('Text Content', 'Enter the text, use {placeholders} for dynamic text');

    form.show(player).then(response => {
        if (response.canceled) return openPanel(player, 'floatingTextList');
        const [id, text] = response.formValues;

        if (!id) {
            player.sendMessage('§cID cannot be empty.');
            openPanel(player, 'floatingTextCreate');
            return;
        }

        floatingTextManager.createText(player, id, text);
        openPanel(player, 'floatingTextList');
    });
});