import { uiWait } from '@core/utils/ui.js';
import { Player } from '@minecraft/server';
import { ModalFormData, ModalFormResponse } from '@minecraft/server-ui';

interface DropdownMeta {
  type: 'dropdown';
  options: string[];
  defaultValueIndex: number;
}

interface ToggleMeta {
  type: 'toggle';
  defaultValue: boolean;
}

interface SliderMeta {
  type: 'slider';
  min: number;
  max: number;
  step: number;
  defaultValue: number;
}

interface TextFieldMeta {
  type: 'textField';
  placeholderText: string;
  defaultValue: string;
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
  private readonly currentValues: Record<string, unknown> = {};

  constructor(titleText = '') {
    this.titleText = titleText;
  }

  public title(titleText: string): this {
    this.titleText = titleText;
    return this;
  }

  public toggle<K extends string>(
    key: K,
    label: string,
    defaultValue = false,
    _onChange?: (val: boolean) => void,
  ): CustomFormBuilder<T & Record<K, boolean>> {
    this.currentValues[key] = defaultValue;
    this.controls.push({
      type: 'toggle',
      key,
      label,
      meta: { type: 'toggle', defaultValue },
    });
    return this as unknown as CustomFormBuilder<T & Record<K, boolean>>;
  }

  public slider<K extends string>(
    key: K,
    label: string,
    minimumValue: number,
    maximumValue: number,
    valueStep = 1,
    defaultValue?: number,
  ): CustomFormBuilder<T & Record<K, number>> {
    const min = Math.min(minimumValue, maximumValue);
    const max = Math.max(minimumValue, maximumValue);
    const initialVal = defaultValue !== undefined ? defaultValue : min;
    this.currentValues[key] = initialVal;
    this.controls.push({
      type: 'slider',
      key,
      label,
      meta: { type: 'slider', min, max, step: valueStep, defaultValue: initialVal },
    });
    return this as unknown as CustomFormBuilder<T & Record<K, number>>;
  }

  public dropdown<K extends string>(
    key: K,
    label: string,
    options: string[],
    defaultValueIndex = 0,
  ): CustomFormBuilder<T & Record<K, string>> {
    const safeIndex = Math.max(0, Math.min(defaultValueIndex, Math.max(0, options.length - 1)));
    this.currentValues[key] = options[safeIndex] ?? options[0] ?? '';
    this.controls.push({
      type: 'dropdown',
      key,
      label,
      meta: { type: 'dropdown', options, defaultValueIndex: safeIndex },
    });
    return this as unknown as CustomFormBuilder<T & Record<K, string>>;
  }

  public textField<K extends string>(
    key: K,
    label: string,
    placeholderText = '',
    defaultValue = '',
  ): CustomFormBuilder<T & Record<K, string>> {
    this.currentValues[key] = defaultValue;
    this.controls.push({
      type: 'textField',
      key,
      label,
      meta: { type: 'textField', placeholderText, defaultValue },
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
    return { ...this.currentValues } as T;
  }

  public async show(player: Player): Promise<T | undefined> {
    const form = new ModalFormData().title(this.titleText);
    const valueControlOrder: ControlItem[] = [];
    const buttonCallbacks: (() => void)[] = [];

    for (const ctrl of this.controls) {
      if (ctrl.type === 'toggle' && ctrl.meta?.type === 'toggle') {
        form.toggle(ctrl.label ?? '', { defaultValue: ctrl.meta.defaultValue });
        valueControlOrder.push(ctrl);
      } else if (ctrl.type === 'slider' && ctrl.meta?.type === 'slider') {
        form.slider(ctrl.label ?? '', ctrl.meta.min, ctrl.meta.max, {
          valueStep: ctrl.meta.step,
          defaultValue: ctrl.meta.defaultValue,
        });
        valueControlOrder.push(ctrl);
      } else if (ctrl.type === 'dropdown' && ctrl.meta?.type === 'dropdown') {
        form.dropdown(ctrl.label ?? '', ctrl.meta.options, { defaultValueIndex: ctrl.meta.defaultValueIndex });
        valueControlOrder.push(ctrl);
      } else if (ctrl.type === 'textField' && ctrl.meta?.type === 'textField') {
        form.textField(ctrl.label ?? '', ctrl.meta.placeholderText, { defaultValue: ctrl.meta.defaultValue });
        valueControlOrder.push(ctrl);
      } else if (ctrl.type === 'header') {
        if (typeof (form as unknown as { header?: (t: string) => void }).header === 'function') {
          (form as unknown as { header: (t: string) => void }).header(ctrl.label ?? '');
          valueControlOrder.push(ctrl);
        }
      } else if (ctrl.type === 'label') {
        if (typeof (form as unknown as { label?: (t: string) => void }).label === 'function') {
          (form as unknown as { label: (t: string) => void }).label(ctrl.label ?? '');
          valueControlOrder.push(ctrl);
        }
      } else if (ctrl.type === 'divider') {
        if (typeof (form as unknown as { divider?: () => void }).divider === 'function') {
          (form as unknown as { divider: () => void }).divider();
          valueControlOrder.push(ctrl);
        }
      } else if (ctrl.type === 'button' && ctrl.onClick) {
        buttonCallbacks.push(ctrl.onClick);
        if (!this.submitText) {
          this.submitText = ctrl.label;
        }
      }
    }

    if (this.submitText && typeof form.submitButton === 'function') {
      form.submitButton(this.submitText);
    }

    const response = (await uiWait(player, form)) as ModalFormResponse;
    if (response.canceled || !response.formValues) {
      return undefined;
    }

    const rawValues = response.formValues;
    let valIdx = 0;

    for (const ctrl of valueControlOrder) {
      const rawVal = rawValues[valIdx];
      valIdx++;

      if (!ctrl.key || !ctrl.meta) {
        continue;
      }

      if (ctrl.meta.type === 'toggle') {
        this.currentValues[ctrl.key] = Boolean(rawVal);
      } else if (ctrl.meta.type === 'slider') {
        this.currentValues[ctrl.key] = typeof rawVal === 'number' ? rawVal : ctrl.meta.defaultValue;
      } else if (ctrl.meta.type === 'textField') {
        this.currentValues[ctrl.key] = typeof rawVal === 'string' ? rawVal : String(rawVal ?? '');
      } else if (ctrl.meta.type === 'dropdown') {
        const idx = typeof rawVal === 'number' ? rawVal : ctrl.meta.defaultValueIndex;
        this.currentValues[ctrl.key] = ctrl.meta.options[idx] ?? ctrl.meta.options[0] ?? '';
      }
    }

    for (const cb of buttonCallbacks) {
      cb();
    }

    return this.getValues();
  }
}
