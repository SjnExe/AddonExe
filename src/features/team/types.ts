import { HomeLocation } from '@core/playerDataManager.js';

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
