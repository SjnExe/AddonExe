import { describe, expect, test } from 'bun:test';

import { Player } from '@minecraft/server';
import { MessageFormBuilder } from '@ui/builders/messageFormBuilder.js';

describe('MessageFormBuilder', () => {
  test('builds and shows form', async () => {
    const builder = new MessageFormBuilder().title('Test Msg').body('Body').button1('Btn 1').button2('Btn 2');

    const mockPlayer = {} as Player;

    const res = await builder.show(mockPlayer);
    expect(res).toBeDefined();
  });
});
