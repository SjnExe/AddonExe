import { Player } from '@minecraft/server';
import { CustomForm, DataDrivenScreenClosedReason, ObservableBoolean, ObservableNumber, ObservableString } from '@minecraft/server-ui';

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
        const form = new CustomForm(player, this.titleText);
        let wasSubmitted = false;

        for (const ctrl of this.controls) {
            if (ctrl.type === 'toggle' && ctrl.meta?.type === 'toggle') {
                form.toggle(ctrl.label ?? '', ctrl.meta.observable);
            } else if (ctrl.type === 'slider' && ctrl.meta?.type === 'slider') {
                form.slider(ctrl.label ?? '', ctrl.meta.observable, ctrl.meta.min, ctrl.meta.max, { step: ctrl.meta.step });
            } else if (ctrl.type === 'dropdown' && ctrl.meta?.type === 'dropdown') {
                const items = ctrl.meta.options.map((opt, i) => ({ label: opt, value: i }));
                form.dropdown(ctrl.label ?? '', ctrl.meta.observable, items);
            } else if (ctrl.type === 'textField' && ctrl.meta?.type === 'textField') {
                form.textField(ctrl.label ?? '', ctrl.meta.observable);
            } else if (ctrl.type === 'header') {
                form.header(ctrl.label ?? '');
            } else if (ctrl.type === 'label') {
                form.label(ctrl.label ?? '');
            } else if (ctrl.type === 'divider') {
                form.divider();
            } else if (ctrl.type === 'spacer') {
                form.spacer();
            } else if (ctrl.type === 'button' && ctrl.onClick) {
                const userOnClick = ctrl.onClick;
                form.button(ctrl.label ?? '', () => {
                    wasSubmitted = true;
                    userOnClick();
                });
            }
        }

        if (this.submitText) {
            form.button(this.submitText, () => {
                wasSubmitted = true;
            });
        }

        form.closeButton();

        const closeReason = await form.show();

        if (closeReason === DataDrivenScreenClosedReason.UserBusy) {
            return undefined;
        }

        if (this.submitText && !wasSubmitted) {
            return undefined;
        }

        return this.getValues();
    }
}
