import { Player } from '@minecraft/server';
import { describe, expect, test } from 'bun:test';
import { ModalFormBuilder } from '../ModalFormBuilder';

describe('ModalFormBuilder', () => {
    test('builds and shows form', async () => {
        const builder = new ModalFormBuilder()
            .title('Test Modal')
            .toggle('isTrue', 'A toggle')
            .slider('amount', 'A slider', 0, 10, 1)
            .dropdown('choice', 'A dropdown', ['a', 'b'])
            .textField('name', 'Name', 'Enter name')
            .submitButton('Submit');

        const mockPlayer = {} as Player;

        const res = await builder.show(mockPlayer);
        expect(res).toBeDefined();
    });
});
