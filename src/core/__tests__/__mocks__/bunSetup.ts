import { mock } from 'bun:test';

// Global Minecraft Engine API Mocks
mock.module('@minecraft/server', () => import('./minecraftMock.ts'));
mock.module('@minecraft/server-ui', () => import('./minecraftMock.ts'));

mock.module('@minecraft/common', () => ({
    EngineError: class EngineError extends Error {},
    InvalidArgumentError: class InvalidArgumentError extends Error {},
    ArgumentOutOfBoundsError: class ArgumentOutOfBoundsError extends Error {},
    InvalidArgumentErrorType: { Duplicate: 'Duplicate', Empty: 'Empty', InvalidType: 'InvalidType', Unknown: 'Unknown', Unspecified: 'Unspecified', UnsupportedValue: 'UnsupportedValue' }
}));
