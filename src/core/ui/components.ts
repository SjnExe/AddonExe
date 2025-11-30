import * as mc from '@minecraft/server';
import { MessageFormData } from '@minecraft/server-ui';

export interface ConfirmationDialogOptions {
    title: string;
    body: string;
    onConfirm: () => void | Promise<void>;
    onCancel?: () => void | Promise<void>;
    confirmButtonText?: string;
    cancelButtonText?: string;
}

/**
 * Shows a confirmation dialog to the player.
 * @param {mc.Player} player The player to show the dialog to.
 * @param {ConfirmationDialogOptions} options
 */
export async function showConfirmationDialog(
    player: mc.Player,
    {
        title,
        body,
        onConfirm,
        onCancel,
        confirmButtonText = '§aConfirm',
        cancelButtonText = '§cCancel'
    }: ConfirmationDialogOptions
) {
    const form = new MessageFormData().title(title).body(body).button1(confirmButtonText).button2(cancelButtonText);

    try {
        const { canceled, selection } = await form.show(player);
        if (canceled) {
            if (onCancel) {
                await onCancel();
            }
            return;
        }

        if (selection === 0) {
            // button1 was pressed
            await onConfirm();
        } else {
            // button2 was pressed
            if (onCancel) {
                await onCancel();
            }
        }
    } catch (e) {
        // Log error if needed, but components shouldn't crash the addon
    }
}
