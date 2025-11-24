import { MessageFormData } from '@minecraft/server-ui';

/**
 * Shows a confirmation dialog to the player.
 * @param {import('@minecraft/server').Player} player The player to show the dialog to.
 * @param {object} options
 * @param {string} options.title The title of the confirmation dialog.
 * @param {string} options.body The body text of the confirmation dialog.
 * @param {() => void} options.onConfirm A callback function to execute when the user confirms.
 * @param {() => void} [options.onCancel] A callback function to execute when the user cancels.
 * @param {string} [options.confirmButtonText='§aConfirm'] Text for the confirm button.
 * @param {string} [options.cancelButtonText='§cCancel'] Text for the cancel button.
 */
export function showConfirmationDialog(player, { title, body, onConfirm, onCancel, confirmButtonText = '§aConfirm', cancelButtonText = '§cCancel' }) {
    const form = new MessageFormData()
        .title(title)
        .body(body)
        .button1(confirmButtonText)
        .button2(cancelButtonText);

    form.show(player).then(({ canceled, selection }) => {
        if (canceled) {
            if (onCancel) {onCancel();}
            return;
        }

        // selection is 1 for button1, 0 for button2 on Bedrock, but docs say 0 and 1.
        // Let's check the result of show. The promise returns an object with a `selection` property.
        // The first button added (button1) corresponds to selection value 0.
        // The second button added (button2) corresponds to selection value 1.
        // The documentation seems to be conflicting in different places, but `selection: 0` for `button1` is the common understanding.
        // Let's stick to the official API docs: button1 is selection 0.
        // Wait, the docs say `MessageFormResponse.selection` is the index of the button pressed.
        // So button1 is 0, button2 is 1.
        // However, I recall from experience that button1 is `true` and button2 is `false` in the `formValues` of ModalFormData.
        // For MessageFormData, the `selection` property is the index.
        // Let's re-read the docs.
        // `MessageFormResponse.selection`: `number` - Index of the button that was pushed.
        // So `button1` is `0`, `button2` is `1`.
        // My previous implementation was wrong.

        if (selection === 0) { // button1 was pressed
            onConfirm();
        } else { // button2 was pressed
            if (onCancel) {onCancel();}
        }
    });
}