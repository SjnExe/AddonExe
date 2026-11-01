import * as mc from '@minecraft/server';
import { MessageFormBuilder } from '@ui/builders/messageFormBuilder.js';

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
 *
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
    cancelButtonText = '§cCancel',
  }: ConfirmationDialogOptions,
) {
  const form = new MessageFormBuilder()
    .title(title)
    .body(body)
    .button1(confirmButtonText, onConfirm)
    .button2(cancelButtonText, onCancel);

  try {
    const { canceled } = await form.show(player, { wait: true });
    if (canceled && onCancel) {
      await onCancel();
    }
  } catch {
    // Log error if needed, but components shouldn't crash the addon
  }
}
