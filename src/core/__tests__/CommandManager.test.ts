import * as mc from '@minecraft/server';
import { vi } from 'vitest';

// Mocks
const mockGetConfig = vi.fn();
const mockGetPlayer = vi.fn();
const mockGetCooldown = vi.fn();
const mockSetCooldownCustom = vi.fn();
const mockFindVisiblePlayerByName = vi.fn();

vi.mock('../configManager.js', () => ({
    getConfig: mockGetConfig
}));

vi.mock('../cooldownManager.js', () => ({
    getCooldown: mockGetCooldown,
    setCooldownCustom: mockSetCooldownCustom
}));

vi.mock('../playerDataManager.js', () => ({
    getPlayer: mockGetPlayer,
    findVisiblePlayerByName: mockFindVisiblePlayerByName
}));

vi.mock('../logger.js', () => ({
    debugLog: vi.fn(),
    errorLog: vi.fn(),
    infoLog: vi.fn()
}));

vi.mock('../permissionEngine.js', () => ({
    hasPermission: vi.fn().mockReturnValue(true)
}));

const { commandManager } = await import('@commands/commandManager.js');

describe('CommandManager', () => {
    // Explicitly cast to unknown then Player to avoid type mismatches if strict compliance is enforced,
    // or just assume the mock matches the Player interface locally.
    const player = new (mc.Player as unknown as new (id: string, name: string) => mc.Player)('p1', 'TestPlayer');
    // Ensure the mock function is properly typed or cast if needed
    (player.sendMessage as unknown as any).mockImplementation(() => {});

    beforeEach(() => {
        vi.clearAllMocks();
        commandManager.commands.clear();
        commandManager.aliases.clear();

        mockGetConfig.mockReturnValue({
            commandPrefix: '!'
        });
        mockGetPlayer.mockReturnValue({ permission: 'ui.panel.member' });
        mockGetCooldown.mockReturnValue(0);
    });

    it('should prevent execution of excessively long commands', () => {
        const longMessage = '!' + 'a'.repeat(2000);
        // Using Partial<mc.ChatSendBeforeEvent> to avoid full event mocking
        const event = {
            sender: player,
            message: longMessage,
            cancel: false
        } as unknown as mc.ChatSendBeforeEvent;
        const result = commandManager.handleChatCommand(event);
        expect(result).toBe(false);
    });

    it('should validate integer parameters', () => {
        const cmd = {
            name: 'testint',
            description: '',
            parameters: [{ name: 'val', type: 'int' }],
            execute: vi.fn()
        };
        // Cast cmd to CustomCommand if available, or unknown -> any if we can't import the type easily
        // But better to use explicit CustomCommand type if possible.
        commandManager.register(cmd as unknown as any);

        const event = {
            sender: player,
            message: '!testint invalid',
            cancel: false
        } as unknown as mc.ChatSendBeforeEvent;
        const result = commandManager.handleChatCommand(event);

        expect(result).toBe(true); // Handled (intercepted)
        expect(player.sendMessage).toHaveBeenCalledWith(expect.stringContaining('Invalid number'));
        expect(cmd.execute).not.toHaveBeenCalled();
    });

    it('should execute if params valid', () => {
        const execute = vi.fn();
        const cmd = {
            name: 'testint',
            description: '',
            permissionNode: 'cmd.testint',
            parameters: [{ name: 'val', type: 'int' }],
            execute
        };
        commandManager.register(cmd as unknown as any);

        const event = {
            sender: player,
            message: '!testint 123',
            cancel: false
        } as unknown as mc.ChatSendBeforeEvent;
        commandManager.handleChatCommand(event);

        expect(execute).toHaveBeenCalledWith(player, { val: 123 });
    });
});
