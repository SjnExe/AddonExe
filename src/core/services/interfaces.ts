import { HomeLocation } from '@core/playerDataManager.js';
import * as mc from '@minecraft/server';

export interface ChatLog {
    timestamp: number;
    playerName: string;
    message: string;
    rank?: string;
}

export interface LeaderboardEntry {
    name: string;
    balance: number;
    id: string; // From economy/leaderboardManager.ts typically
}

export interface TeamApplication {
    playerId: string;
    playerName: string;
    timestamp: number;
}

export interface TeamData {
    id: number;
    name: string;
    ownerId: string;
    admins: string[];
    members: string[]; // Includes owner and admins
    createdDate: number;
    home: HomeLocation | undefined;
    applications: TeamApplication[];
    balance: number;
    open: boolean;
}

export interface SocialService {
    isFriend(playerId1: string, playerId2: string): boolean;
}

export interface EconomyService {
    getLeaderboard(): LeaderboardEntry[];
}

export interface TeamService {
    getTeamByPlayer(playerId: string): TeamData | undefined;
}

export interface AnticheatService {
    addPunishmentLog(playerName: string, type: 'mute' | 'ban', reason: string, adminName: string, duration: string): void;
    showChatFilter(player: mc.Player): Promise<void>;
}

export interface ModerationService {
    getAvailableDates(): string[];
    getChatLogs(date?: string): ChatLog[];
}

export interface TeleportService {
    saveLastLocation(player: mc.Player, reason?: 'death' | 'teleport'): void;
    findSafeLocation(dimension: mc.Dimension, location: mc.Vector3): mc.Vector3 | undefined;
}

export interface SidebarService {
    forceUpdate(): void;
    resolveGlobalPlaceholders(text: string, player?: mc.Player): string;
    setActionBarOverride(player: mc.Player, message: string, durationMs?: number): void;
}
