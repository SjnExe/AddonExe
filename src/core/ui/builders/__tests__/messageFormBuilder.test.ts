import { describe, expect, test } from 'bun:test';

import { Player } from '@minecraft/server';
import { MessageFormBuilder } from '@ui/builders/messageFormBuilder.js';

describe('MessageFormBuilder', () => {
  test('builds and shows form', async () => {
    const builder = new MessageFormBuilder().title('Test Msg').body('Body').button1('Btn 1').button2('Btn 2');

    const mockPlayer = {} as Player;

    let btn1Clicked = false;
    let btn2Clicked = false;
    builder.button1('Btn 1', () => {
      btn1Clicked = true;
    });
    builder.button2('Btn 2', () => {
      btn2Clicked = true;
    });
    const res = await builder.show(mockPlayer);
    expect(res).toBeDefined();
    expect(btn1Clicked).toBe(true);
    expect(btn2Clicked).toBe(false);
  });
});
