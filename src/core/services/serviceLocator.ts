import type * as mc from '@minecraft/server';

export interface ServiceMap {
  'anticheat.logs': {
    addPunishmentLog: (playerName: string, type: string, reason: string, adminName: string, duration?: string) => void;
    showChatFilter: (player: mc.Player) => Promise<void>;
  };
  'economy.leaderboard': {
    getLeaderboard: () => { playerId: string; name: string; balance: number }[];
  };
  'moderation.chatLogs': {
    getAvailableDates: () => string[];
    getChatLogs: (date?: string) => { timestamp: number; playerName: string; message: string; rank?: string }[];
  };
  'sidebar.manager': {
    forceUpdate: () => void;
  };
  'sidebar.utils': {
    resolveGlobalPlaceholders: (text: string, player?: mc.Player) => string;
  };
  'social.friends': {
    isFriend: (playerId1: string, playerId2: string) => boolean;
  };
  'team.manager': {
    getTeamByPlayer: (playerId: string) => { id: number; name: string; balance?: number } | undefined;
  };
  'teleport.utils': {
    saveLastLocation: (player: mc.Player, reason?: 'death' | 'teleport') => void;
    findSafeLocation: (dimension: mc.Dimension, location: mc.Vector3) => mc.Vector3 | undefined;
    teleportPlayerWithTransition?: (player: mc.Player, location: mc.Vector3, options?: mc.TeleportOptions) => void;
  };
}

export type ServiceName = keyof ServiceMap | (string & {});

class ServiceLocator {
  private readonly services = new Map<string, unknown>();

  registerService<K extends keyof ServiceMap>(name: K, service: ServiceMap[K]): void;
  registerService<T>(name: string, service: T): void;
  registerService(name: string, service: unknown): void {
    this.services.set(name, service);
  }

  getService<K extends keyof ServiceMap>(name: K): ServiceMap[K] | undefined;
  getService<T>(name: string): T | undefined;
  getService(name: string): unknown {
    return this.services.get(name);
  }

  hasService(name: ServiceName): boolean {
    return this.services.has(name);
  }

  clearServices(): void {
    this.services.clear();
  }
}

export const serviceLocator = new ServiceLocator();
