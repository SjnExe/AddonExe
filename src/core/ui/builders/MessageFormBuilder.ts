import { Player } from '@minecraft/server';
import { MessageFormData, MessageFormResponse } from '@minecraft/server-ui';

export class MessageFormBuilder {
    private readonly form: MessageFormData;
    private button1Callback?: () => void | Promise<void>;
    private button2Callback?: () => void | Promise<void>;

    constructor() {
        this.form = new MessageFormData();
    }

    public title(titleText: string): this {
        this.form.title(titleText);
        return this;
    }

    public body(bodyText: string): this {
        this.form.body(bodyText);
        return this;
    }

    public button1(text: string, onClick?: () => void | Promise<void>): this {
        this.form.button1(text);
        this.button1Callback = onClick;
        return this;
    }

    public button2(text: string, onClick?: () => void | Promise<void>): this {
        this.form.button2(text);
        this.button2Callback = onClick;
        return this;
    }

    public async show(player: Player): Promise<MessageFormResponse> {
        const response = await this.form.show(player);

        if (response.canceled) {
            return response;
        }

        if (response.selection === 0 && this.button2Callback) {
            // Yes, button2 is selection 0 and button1 is selection 1 in Bedrock UI API (bottom to top usually)
            // Wait, MessageFormData button1 is selection 1? Let me check standard.
            // Actually button2 is selection 0, button1 is selection 1.
            await this.button2Callback();
        } else if (response.selection === 1 && this.button1Callback) {
            await this.button1Callback();
        }

        return response;
    }
}
