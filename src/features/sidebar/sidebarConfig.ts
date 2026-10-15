export const config = {
    enabled: false,
    globalInfo: {
        enabled: true,
        opacity: 'medium',
        title: '§l§6{server_name}',
        updateInterval: 20,
        maxPlayers: 20,
        sidebarLines: ['§7----------------', '§fPlayers: §a{online}§7/§a{max_online}', '§fTPS: §a{tps}', '§fTime: §b{time}', '§fDate: §7{date}', '§7----------------']
    },
    hud: {
        enabled: true,
        updateInterval: 20,
        actionBarLines: ['§gMoney: {money}', '§7|', '§cK: {kills} §7/ §4D: {deaths} §7(§b{kdr}§7)', '§7|', '§eRank: {rank}']
    }
};
