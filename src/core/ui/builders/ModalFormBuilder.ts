import { Player } from '@minecraft/server';
import { ModalFormData } from '@minecraft/server-ui';

interface DropdownData {
    type: 'dropdown';
    options: string[];
}

interface OtherData {
    type: 'other';
}

export class ModalFormBuilder<T extends Record<string, unknown> = Record<string, unknown>> {
    private readonly form: ModalFormData;
    private readonly keyMap: { key: string; meta: DropdownData | OtherData }[];

    constructor() {
        this.form = new ModalFormData();
        this.keyMap = [];
    }

    public title(titleText: string): this {
        this.form.title(titleText);
        return this;
    }

    public toggle<K extends string>(key: K, label: string, defaultValue?: boolean): ModalFormBuilder<T & Record<K, boolean>> {
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore
        if (defaultValue !== undefined) {
            // eslint-disable-next-line @typescript-eslint/ban-ts-comment
            // @ts-ignore
            this.form.toggle(label, { defaultValue });
        } else {
            this.form.toggle(label);
        }
        this.keyMap.push({ key, meta: { type: 'other' } });
        return this as unknown as ModalFormBuilder<T & Record<K, boolean>>;
    }

    public slider<K extends string>(key: K, label: string, minimumValue: number, maximumValue: number, valueStep: number, defaultValue?: number): ModalFormBuilder<T & Record<K, number>> {
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore
        const options: { valueStep: number; defaultValue?: number } = { valueStep };
        if (defaultValue !== undefined) {
            options.defaultValue = defaultValue;
        }
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore
        this.form.slider(label, Math.min(minimumValue, maximumValue), Math.max(minimumValue, maximumValue), options);
        this.keyMap.push({ key, meta: { type: 'other' } });
        return this as unknown as ModalFormBuilder<T & Record<K, number>>;
    }

    public dropdown<K extends string>(key: K, label: string, options: string[], defaultValueIndex?: number): ModalFormBuilder<T & Record<K, string>> {
        if (defaultValueIndex !== undefined) {
            // eslint-disable-next-line @typescript-eslint/ban-ts-comment
            // @ts-ignore
            this.form.dropdown(label, options, { defaultValueIndex });
        } else {
            this.form.dropdown(label, options);
        }
        this.keyMap.push({ key, meta: { type: 'dropdown', options } });
        return this as unknown as ModalFormBuilder<T & Record<K, string>>;
    }

    public textField<K extends string>(key: K, label: string, placeholderText: string, defaultValue?: string): ModalFormBuilder<T & Record<K, string>> {
        if (defaultValue !== undefined) {
            // eslint-disable-next-line @typescript-eslint/ban-ts-comment
            // @ts-ignore
            this.form.textField(label, placeholderText, { defaultValue });
        } else {
            this.form.textField(label, placeholderText);
        }
        this.keyMap.push({ key, meta: { type: 'other' } });
        return this as unknown as ModalFormBuilder<T & Record<K, string>>;
    }

    public submitButton(text: string): this {
        this.form.submitButton(text);
        return this;
    }

    public async show(player: Player): Promise<T | undefined> {
        const response = await this.form.show(player);
        if (response.canceled) {
            return undefined;
        }

        const result: Record<string, unknown> = {};
        response.formValues?.forEach((val: unknown, i: number) => {
            const mapInfo = this.keyMap[i];
            if (mapInfo) {
                if (mapInfo.meta.type === 'dropdown' && typeof val === 'number') {
                    result[mapInfo.key] = mapInfo.meta.options[val];
                } else {
                    result[mapInfo.key] = val;
                }
            }
        });

        return result as T;
    }
}
