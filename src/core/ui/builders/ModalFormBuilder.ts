import * as utils from '@core/utils.js';
import { isDefined } from '@lib/guards.js';
import * as mc from '@minecraft/server';
import { ModalFormData } from '@minecraft/server-ui';

type ModalFormCallback<T> = (result: T) => void | Promise<void>;

type ModalFieldType = 'dropdown' | 'slider' | 'textField' | 'toggle';

interface ModalFieldBase {
    id: string;
    label: string;
    type: ModalFieldType;
}

interface DropdownField extends ModalFieldBase {
    type: 'dropdown';
    options: string[];
    defaultValueIndex?: number;
}

interface SliderField extends ModalFieldBase {
    type: 'slider';
    minimumValue: number;
    maximumValue: number;
    valueStep: number;
    defaultValue?: number;
}

interface TextField extends ModalFieldBase {
    type: 'textField';
    placeholderText: string;
    defaultValue?: string;
}

interface ToggleField extends ModalFieldBase {
    type: 'toggle';
    defaultValue?: boolean;
}

type ModalField = DropdownField | SliderField | TextField | ToggleField;

export class ModalFormBuilder<T extends Record<string, unknown>> {
    private formTitle: string = '';
    private readonly fields: ModalField[] = [];

    title(title: string): this {
        this.formTitle = title;
        return this;
    }

    dropdown(id: keyof T & string, label: string, options: string[], defaultValueIndex?: number): this {
        this.fields.push({ id, label, type: 'dropdown', options, defaultValueIndex });
        return this;
    }

    slider(id: keyof T & string, label: string, minimumValue: number, maximumValue: number, valueStep: number, defaultValue?: number): this {
        this.fields.push({ id, label, type: 'slider', minimumValue, maximumValue, valueStep, defaultValue });
        return this;
    }

    textField(id: keyof T & string, label: string, placeholderText: string, defaultValue?: string): this {
        this.fields.push({ id, label, type: 'textField', placeholderText, defaultValue });
        return this;
    }

    toggle(id: keyof T & string, label: string, defaultValue?: boolean): this {
        this.fields.push({ id, label, type: 'toggle', defaultValue });
        return this;
    }

    async show(player: mc.Player, onCallback: ModalFormCallback<T>): Promise<void> {
        const form = new ModalFormData();
        form.title(this.formTitle);

        for (const field of this.fields) {
            switch (field.type) {
                case 'dropdown':
                    form.dropdown(field.label, field.options, { defaultValueIndex: field.defaultValueIndex });
                    break;
                case 'slider':
                    form.slider(field.label, field.minimumValue, field.maximumValue, { valueStep: field.valueStep, defaultValue: field.defaultValue });
                    break;
                case 'textField':
                    form.textField(field.label, field.placeholderText, { defaultValue: field.defaultValue });
                    break;
                case 'toggle':
                    form.toggle(field.label, { defaultValue: field.defaultValue });
                    break;
            }
        }

        const response = await utils.uiWait(player, form) as import('@minecraft/server-ui').ModalFormResponse;

        if (!isDefined(response) || response.canceled || !isDefined(response.formValues)) {
            return; // Cancelled
        }

        const result: Record<string, unknown> = {};
        for (let i = 0; i < this.fields.length; i++) {
            const field = this.fields[i];
            if (isDefined(field)) {
                result[field.id] = response.formValues[i];
            }
        }

        await onCallback(result as unknown as T);
    }
}
