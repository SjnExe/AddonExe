import { hasPermission } from '@core/permissionEngine.js';
import * as utils from '@core/utils.js';
import { isDefined } from '@lib/guards.js';
import * as mc from '@minecraft/server';
import { ActionFormData } from '@minecraft/server-ui';

type ActionFormCallback = () => void | Promise<void>;

interface ActionFormButton {
    text: string;
    iconPath?: string;
    action: ActionFormCallback;
    permission?: string;
    requiresFeature?: boolean; // If false, button shows as disabled
}

export class ActionFormBuilder {
    private formTitle: string = '';
    private formBody: string = '';
    private readonly buttons: ActionFormButton[] = [];
    private backAction?: ActionFormCallback;

    title(title: string): this {
        this.formTitle = title;
        return this;
    }

    body(body: string): this {
        this.formBody = body;
        return this;
    }

    button(text: string, iconPath: string | undefined, action: ActionFormCallback, permission?: string, requiresFeature: boolean = true): this {
        this.buttons.push({ text, iconPath, action, permission, requiresFeature });
        return this;
    }

    addBackButton(action: ActionFormCallback): this {
        this.backAction = action;
        return this;
    }

    async show(player: mc.Player): Promise<void> {
        const form = new ActionFormData();
        form.title(this.formTitle);
        if (this.formBody) {
            form.body(this.formBody);
        }

        const visibleButtons: ActionFormButton[] = [];

        if (isDefined(this.backAction)) {
            const backBtn: ActionFormButton = {
                text: '< Back',
                iconPath: 'textures/gui/controls/left.png',
                action: this.backAction
            };
            visibleButtons.push(backBtn);
            form.button(backBtn.text, backBtn.iconPath);
        }

        for (const btn of this.buttons) {
            if (btn.permission && !hasPermission(player, btn.permission)) {
                continue; // Hide if no permission
            }

            visibleButtons.push(btn);
            let btnText = btn.text;
            if (!btn.requiresFeature) {
                btnText += '\n§4[Disabled]';
            }
            form.button(btnText, btn.iconPath);
        }

        const response = await utils.uiWait(player, form) as import('@minecraft/server-ui').ActionFormResponse;

        if (!isDefined(response) || response.canceled || response.selection === undefined) {
            // Cancelled, if back action exists, maybe call it? usually cancel means close entirely.
            // But legacy behavior sometimes goes back on cancel if a parent is present.
            // For now, builders will treat cancel as cancel (return).
            return;
        }

        const selectedBtn = visibleButtons[response.selection];
        if (isDefined(selectedBtn)) {
            if (!selectedBtn.requiresFeature && selectedBtn.text !== '< Back') {
                player.sendMessage('§cThis feature is currently disabled.');
                // Re-open form
                return this.show(player);
            }
            await selectedBtn.action();
        }
    }
}
