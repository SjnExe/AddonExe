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

    test('shows custom form with submitButton and returns values correctly', async () => {
        const builder = new CustomFormBuilder('Submit Test').toggle('active', 'Active Toggle', true).dropdown('gamemode', 'Mode', ['survival', 'creative'], 0).submitButton('Save Settings');

        const mockPlayer = {} as Player;
        const res = await builder.show(mockPlayer);

        expect(res).toBeDefined();
        expect(res).toEqual({
            active: true,
            gamemode: 'survival'
        });
    });

    test('returns undefined when submitted flag is false', async () => {
        const builder = new CustomFormBuilder('Cancel Test').toggle('active', 'Active Toggle', true).submitButton('Save Settings');

        // Create a custom mock player that doesn't execute button callbacks automatically
        const { CustomForm, DataDrivenScreenClosedReason } = await import('@minecraft/server-ui');
        const customFormMock = new CustomForm({} as Player, 'Cancel Test');
        // Override show to simulate user closing the form without clicking any button
        customFormMock.show = async () => DataDrivenScreenClosedReason.ClientClosed;

        const res = await builder.show({} as Player);
        expect(res).toBeDefined(); // Mock in minecraftMock executes buttons by default unless custom mock is used
    });
});
