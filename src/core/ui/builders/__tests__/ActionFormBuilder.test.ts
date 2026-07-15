import { Player } from '@minecraft/server';
import { describe, expect, test } from 'bun:test';
import { ActionFormBuilder } from '../ActionFormBuilder';

describe('ActionFormBuilder', () => {
    test('builds and shows form', async () => {
        const builder = new ActionFormBuilder().title('Test').body('Body').button('Btn 1').button('Btn 2');

        const mockPlayer = {} as Player;

        // Form response will be mocked by mincraftMock.ts
        // We'll just verify no crash
        const res = await builder.show(mockPlayer);
        expect(res).toBeDefined();
    });
});
