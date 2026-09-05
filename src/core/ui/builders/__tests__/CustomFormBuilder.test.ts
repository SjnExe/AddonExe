import { Player } from '@minecraft/server';
import { describe, expect, test } from 'bun:test';
import { CustomFormBuilder } from '../CustomFormBuilder';

describe('CustomFormBuilder', () => {
    test('builds and retrieves reactive initial values', () => {
        const builder = new CustomFormBuilder('Test Custom Form')
            .toggle('isTrue', 'A toggle', true)
            .slider('amount', 'A slider', 0, 100, 5, 25)
            .dropdown('choice', 'A dropdown', ['Option A', 'Option B', 'Option C'], 1)
            .textField('name', 'Name Field', 'Enter name', 'Default Text')
            .header('Section Header')
            .label('Section Label')
            .divider()
            .spacer()
            .submitButton('Submit');

        const values = builder.getValues();
        expect(values).toEqual({
            isTrue: true,
            amount: 25,
            choice: 'Option B',
            name: 'Default Text'
        });
    });

    test('shows custom form and returns values', async () => {
        const builder = new CustomFormBuilder('Show Test').toggle('active', 'Active Toggle', false).textField('query', 'Query', 'Search', 'Hello');

        const mockPlayer = {} as Player;
        const res = await builder.show(mockPlayer);

        expect(res).toBeDefined();
        expect(res).toEqual({
            active: false,
            query: 'Hello'
        });
    });
});
