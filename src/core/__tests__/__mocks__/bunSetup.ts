import { mock } from 'bun:test';
mock.module('@minecraft/server', () => import('./minecraftMock.ts'));
mock.module('@minecraft/server-ui', () => import('./minecraftMock.ts'));
