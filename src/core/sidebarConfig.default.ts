export interface SidebarConfig {
    enabled: boolean;
    title: string;
    sidebarLines: string[];
    actionBarEnabled: boolean;
    actionBarInterval: number; // Ticks between cycling action bar messages
    actionBarLines: string[];
    updateInterval: number; // Ticks for data refresh
    maxPlayers: number; // Cosmetic max players
}

export const config: SidebarConfig = {
    enabled: true,
    title: '§l§eSIDEBAR',
    sidebarLines: [
        '§7--------------------',
        ' §fServer: §aServerExe',
        ' §fTPS: §a{tps}',
        ' §fOnline: §b{online}§f/§b{max_players}',
        '§7--------------------',
        '§ewww.yoursite.com'
    ],
    actionBarEnabled: true,
    actionBarInterval: 40,
    actionBarLines: [
        '§fName: §a{name} §7| §fRank: §d{rank}',
        '§fMoney: §e{money} §7| §fKills: §c{kills}'
    ],
    updateInterval: 20,
    maxPlayers: 20
};
