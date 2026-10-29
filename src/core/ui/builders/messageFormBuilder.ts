import { escapeBedrockPercent } from '@core/utils/formatting.js';
import { uiWait } from '@core/utils/ui.js';
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
    this.form.title(escapeBedrockPercent(titleText));
    return this;
  }

  public body(bodyText: string): this {
    this.form.body(escapeBedrockPercent(bodyText));
    return this;
  }

  public button1(text: string, onClick?: () => void | Promise<void>): this {
    this.form.button1(escapeBedrockPercent(text));
    this.button1Callback = onClick;
    return this;
  }

  public button2(text: string, onClick?: () => void | Promise<void>): this {
    this.form.button2(escapeBedrockPercent(text));
    this.button2Callback = onClick;
    return this;
  }

  public async show(player: Player, _options?: { wait?: boolean }): Promise<MessageFormResponse> {
    const response = (await uiWait(player, this.form)) as MessageFormResponse;

    if (response.canceled) {
      return response;
    }

    if (response.selection === 0 && this.button1Callback) {
      await this.button1Callback();
    } else if (response.selection === 1 && this.button2Callback) {
      await this.button2Callback();
    }

    return response;
  }
}
