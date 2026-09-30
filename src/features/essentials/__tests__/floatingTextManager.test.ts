import { MinecraftDimensionTypes } from '@minecraft/vanilla-data';
import { beforeEach, describe, expect, it, mock } from 'bun:test';

import * as floatingTextManager from '../floatingTextManager.js';

describe('floatingTextManager', () => {
    beforeEach(() => {
        floatingTextManager.cleanup();
    });

    it('should create and retrieve floating texts', () => {
        const mockPlayer = {
            sendMessage: mock(() => {}),
            location: { x: 10, y: 20, z: 30 },
            dimension: { id: MinecraftDimensionTypes.Overworld }
        } as any;

        const result = floatingTextManager.createText(mockPlayer, 'test_1', 'Hello World');
        expect(result).toBe(true);

        const textConfig = floatingTextManager.getTextById('test_1');
        expect(textConfig).toBeDefined();
        expect(textConfig?.text).toBe('Hello World');
        expect(textConfig?.dimension).toBe(MinecraftDimensionTypes.Overworld);

        const allTexts = floatingTextManager.getAllTexts();
        expect(allTexts.length).toBe(1);
        expect(allTexts[0].id).toBe('test_1');
    });

    it('should delete existing floating text', () => {
        const mockPlayer = {
            sendMessage: mock(() => {}),
            location: { x: 0, y: 0, z: 0 },
            dimension: { id: MinecraftDimensionTypes.Overworld }
        } as any;

        floatingTextManager.createText(mockPlayer, 'test_del', 'To Be Deleted');
        expect(floatingTextManager.getTextById('test_del')).toBeDefined();

        floatingTextManager.deleteText(mockPlayer, 'test_del');
        expect(floatingTextManager.getTextById('test_del')).toBeUndefined();
    });
});
