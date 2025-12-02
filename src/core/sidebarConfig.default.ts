export interface SidebarConfig {
    enabled: boolean;
    title: string;
    sidebarLines: string[];
    actionBarEnabled: boolean;
    actionBarInterval: number; // Ticks between updates
    actionBarLines: string[];
    updateInterval: number; // Ticks for data refresh
    maxPlayers: number; // Cosmetic max players
}

export const config: SidebarConfig = {
    enabled: false,
    title: '§l§6Server Name',
    sidebarLines: [],
    actionBarEnabled: true,
    actionBarInterval: 20,
    actionBarLines: [
        '§7--------------------',
        '§l§6Server Name',
        ' §fName: §a{name}',
        ' §fRank: §d{rank}',
        ' §fMoney: §e{money}',
        ' ',
        ' §fKills: §c{kills}',
        ' §fDeaths: §c{deaths}',
        ' §fKDR: §e{kdr}',
        ' ',
        ' §fTPS: §a{tps}',
        ' §fOnline: §b{online}§f/§b{max_players}',
        '§7--------------------',
        '§ewww.yoursite.com'
    ],
    updateInterval: 20,
    maxPlayers: 20
};
