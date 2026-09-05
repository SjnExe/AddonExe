import { Player } from '@minecraft/server';
import { CustomFormBuilder } from './CustomFormBuilder.js';

export class ModalFormBuilder<T extends Record<string, unknown> = Record<string, unknown>> {
    private readonly builder: CustomFormBuilder<T>;

    constructor() {
        this.builder = new CustomFormBuilder<T>();
    }

    public title(titleText: string): this {
        this.builder.title(titleText);
        return this;
    }

    public toggle<K extends string>(key: K, label: string, defaultValue?: boolean): ModalFormBuilder<T & Record<K, boolean>> {
        this.builder.toggle(key, label, defaultValue ?? false);
        return this as unknown as ModalFormBuilder<T & Record<K, boolean>>;
    }

    public slider<K extends string>(key: K, label: string, minimumValue: number, maximumValue: number, valueStep: number, defaultValue?: number): ModalFormBuilder<T & Record<K, number>> {
        this.builder.slider(key, label, minimumValue, maximumValue, valueStep, defaultValue);
        return this as unknown as ModalFormBuilder<T & Record<K, number>>;
    }

    public dropdown<K extends string>(key: K, label: string, options: string[], defaultValueIndex?: number): ModalFormBuilder<T & Record<K, string>> {
        this.builder.dropdown(key, label, options, defaultValueIndex ?? 0);
        return this as unknown as ModalFormBuilder<T & Record<K, string>>;
    }

    public textField<K extends string>(key: K, label: string, placeholderText: string, defaultValue?: string): ModalFormBuilder<T & Record<K, string>> {
        this.builder.textField(key, label, placeholderText, defaultValue ?? '');
        return this as unknown as ModalFormBuilder<T & Record<K, string>>;
    }

    public header(text: string): this {
        this.builder.header(text);
        return this;
    }

    public label(text: string): this {
        this.builder.label(text);
        return this;
    }

    public divider(): this {
        this.builder.divider();
        return this;
    }

    public spacer(): this {
        this.builder.spacer();
        return this;
    }

    public submitButton(text: string): this {
        this.builder.submitButton(text);
        return this;
    }

    public async show(player: Player): Promise<T | undefined> {
        return this.builder.show(player);
    }
}
