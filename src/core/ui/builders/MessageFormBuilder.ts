import * as utils from '@core/utils.js';
import { isDefined } from '@lib/guards.js';
import * as mc from '@minecraft/server';
import { MessageFormData } from '@minecraft/server-ui';

type MessageFormCallback = () => void | Promise<void>;

export class MessageFormBuilder {
    private formTitle: string = '';
    private formBody: string = '';
    private button1Text: string = 'Button 1';
    private button1Action?: MessageFormCallback;
    private button2Text: string = 'Button 2';
    private button2Action?: MessageFormCallback;

    title(title: string): this {
        this.formTitle = title;
        return this;
    }

    body(body: string): this {
        this.formBody = body;
        return this;
    }

    button1(text: string, action: MessageFormCallback): this {
        this.button1Text = text;
        this.button1Action = action;
        return this;
    }

    button2(text: string, action: MessageFormCallback): this {
        this.button2Text = text;
        this.button2Action = action;
        return this;
    }

    async show(player: mc.Player): Promise<void> {
        const form = new MessageFormData();
        form.title(this.formTitle);
        form.body(this.formBody);
        form.button1(this.button1Text);
        form.button2(this.button2Text);

        const response = await utils.uiWait(player, form) as import('@minecraft/server-ui').MessageFormResponse;

        if (!isDefined(response) || response.canceled || response.selection === undefined) {
            return;
        }

        if (response.selection === 0 && isDefined(this.button1Action)) {
            await this.button1Action();
        } else if (response.selection === 1 && isDefined(this.button2Action)) {
            await this.button2Action();
        }
    }
}
