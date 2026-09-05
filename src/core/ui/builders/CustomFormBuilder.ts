import { uiWait } from '@core/utils/ui.js';
import { Player } from '@minecraft/server';
import { ModalFormData, ModalFormResponse, ObservableBoolean, ObservableNumber, ObservableString } from '@minecraft/server-ui';

interface DropdownMeta {
    type: 'dropdown';
    options: string[];
    observable: ObservableNumber;
}

interface ToggleMeta {
    type: 'toggle';
    observable: ObservableBoolean;
}

interface SliderMeta {
    type: 'slider';
    observable: ObservableNumber;
    min: number;
    max: number;
    step: number;
}

interface TextFieldMeta {
    type: 'textField';
    observable: ObservableString;
}

type ValueMeta = DropdownMeta | ToggleMeta | SliderMeta | TextFieldMeta;

interface ControlItem {
    type: 'toggle' | 'slider' | 'dropdown' | 'textField' | 'header' | 'label' | 'divider' | 'spacer' | 'button';
    key?: string;
    label?: string;
    meta?: ValueMeta;
    onClick?: () => void;
}

export class CustomFormBuilder<T extends Record<string, unknown> = Record<string, unknown>> {
    private titleText: string;
    private readonly controls: ControlItem[] = [];
    private submitText?: string;

    constructor(titleText = '') {
        this.titleText = titleText;
    }

    public title(titleText: string): this {
        this.titleText = titleText;
        return this;
    }

    public toggle<K extends string>(key: K, label: string, defaultValue = false): CustomFormBuilder<T & Record<K, boolean>> {
        const observable = new ObservableBoolean(defaultValue, { clientWritable: true });
        this.controls.push({
            type: 'toggle',
            key,
            label,
            meta: { type: 'toggle', observable }
        });
        return this as unknown as CustomFormBuilder<T & Record<K, boolean>>;
    }

    public slider<K extends string>(key: K, label: string, minimumValue: number, maximumValue: number, valueStep = 1, defaultValue?: number): CustomFormBuilder<T & Record<K, number>> {
        const min = Math.min(minimumValue, maximumValue);
        const max = Math.max(minimumValue, maximumValue);
        const initialVal = defaultValue !== undefined ? defaultValue : min;
        const observable = new ObservableNumber(initialVal, { clientWritable: true });
        this.controls.push({
            type: 'slider',
            key,
            label,
            meta: { type: 'slider', observable, min, max, step: valueStep }
        });
        return this as unknown as CustomFormBuilder<T & Record<K, number>>;
    }

    public dropdown<K extends string>(key: K, label: string, options: string[], defaultValueIndex = 0): CustomFormBuilder<T & Record<K, string>> {
        const observable = new ObservableNumber(defaultValueIndex, { clientWritable: true });
        this.controls.push({
            type: 'dropdown',
            key,
            label,
            meta: { type: 'dropdown', options, observable }
        });
        return this as unknown as CustomFormBuilder<T & Record<K, string>>;
    }

    public textField<K extends string>(key: K, label: string, _placeholderText = '', defaultValue = ''): CustomFormBuilder<T & Record<K, string>> {
        const observable = new ObservableString(defaultValue, { clientWritable: true });
        this.controls.push({
            type: 'textField',
            key,
            label,
            meta: { type: 'textField', observable }
        });
        return this as unknown as CustomFormBuilder<T & Record<K, string>>;
    }

    public header(text: string): this {
        this.controls.push({ type: 'header', label: text });
        return this;
    }

    public label(text: string): this {
        this.controls.push({ type: 'label', label: text });
        return this;
    }

    public divider(): this {
        this.controls.push({ type: 'divider' });
        return this;
    }

    public spacer(): this {
        this.controls.push({ type: 'spacer' });
        return this;
    }

    public button(label: string, onClick: () => void): this {
        this.controls.push({ type: 'button', label, onClick });
        return this;
    }

    public submitButton(text: string): this {
        this.submitText = text;
        return this;
    }

    public getValues(): T {
        const result: Record<string, unknown> = {};
        for (const ctrl of this.controls) {
            if (!ctrl.key || !ctrl.meta) {
                continue;
            }
            if (ctrl.meta.type === 'toggle') {
                result[ctrl.key] = ctrl.meta.observable.getData();
            } else if (ctrl.meta.type === 'slider') {
                result[ctrl.key] = ctrl.meta.observable.getData();
            } else if (ctrl.meta.type === 'textField') {
                result[ctrl.key] = ctrl.meta.observable.getData();
            } else if (ctrl.meta.type === 'dropdown') {
                const idx = ctrl.meta.observable.getData();
                result[ctrl.key] = ctrl.meta.options[idx] ?? ctrl.meta.options[0] ?? '';
            }
        }
        return result as T;
    }

    public async show(player: Player): Promise<T | undefined> {
        const form = new ModalFormData();
        if (this.titleText) {
            form.title(this.titleText);
        }

        const valueControls: ControlItem[] = [];

        for (const ctrl of this.controls) {
            if (ctrl.type === 'toggle' && ctrl.meta?.type === 'toggle') {
                const initialVal = ctrl.meta.observable.getData();
                form.toggle(ctrl.label ?? '', initialVal as never);
                valueControls.push(ctrl);
            } else if (ctrl.type === 'slider' && ctrl.meta?.type === 'slider') {
                const initialVal = ctrl.meta.observable.getData();
                form.slider(ctrl.label ?? '', ctrl.meta.min, ctrl.meta.max, { valueStep: ctrl.meta.step, defaultValue: initialVal } as never);
                valueControls.push(ctrl);
            } else if (ctrl.type === 'dropdown' && ctrl.meta?.type === 'dropdown') {
                const initialIdx = ctrl.meta.observable.getData();
                form.dropdown(ctrl.label ?? '', ctrl.meta.options, initialIdx as never);
                valueControls.push(ctrl);
            } else if (ctrl.type === 'textField' && ctrl.meta?.type === 'textField') {
                const initialVal = ctrl.meta.observable.getData();
                form.textField(ctrl.label ?? '', '', initialVal as never);
                valueControls.push(ctrl);
            } else if (ctrl.type === 'header') {
                form.header(ctrl.label ?? '');
            } else if (ctrl.type === 'label') {
                form.label(ctrl.label ?? '');
            } else if (ctrl.type === 'divider') {
                form.divider();
            }
        }

        if (this.submitText) {
            form.submitButton(this.submitText);
        }

        const res = (await uiWait(player, form)) as ModalFormResponse | undefined;

        if (!res || res.canceled || !('formValues' in res) || !res.formValues) {
            return undefined;
        }

        const result: Record<string, unknown> = {};
        const formValues = res.formValues;

        for (let i = 0; i < valueControls.length; i++) {
            const ctrl = valueControls[i];
            if (!ctrl || !ctrl.key || !ctrl.meta) {
                continue;
            }
            const val = formValues[i];

            if (ctrl.meta.type === 'toggle') {
                const boolVal = typeof val === 'boolean' ? val : Boolean(val);
                ctrl.meta.observable.setData(boolVal);
                result[ctrl.key] = boolVal;
            } else if (ctrl.meta.type === 'slider') {
                const numVal = typeof val === 'number' ? val : Number(val);
                ctrl.meta.observable.setData(numVal);
                result[ctrl.key] = numVal;
            } else if (ctrl.meta.type === 'textField') {
                const strVal = typeof val === 'string' ? val : String(val ?? '');
                ctrl.meta.observable.setData(strVal);
                result[ctrl.key] = strVal;
            } else if (ctrl.meta.type === 'dropdown') {
                const idx = typeof val === 'number' ? val : 0;
                ctrl.meta.observable.setData(idx);
                const selectedOpt = ctrl.meta.options[idx] ?? ctrl.meta.options[0] ?? '';
                result[ctrl.key] = selectedOpt;
            }
        }

        return result as T;
    }
}
