export const config = {
    enabled: true,
    globalInfo: {
        enabled: true,
        opacity: 'medium',
        title: '§l§6{server_name}',
        updateInterval: 20,
        maxPlayers: 20,
        sidebarLines: ['§7----------------', '§f Players: §a{online}§7/§a{max_online}', '§f TPS: §a{tps}', '§f Time: §b{time}', '§f Date: §7{date}', '§7----------------']
    },
    hud: {
        enabled: true,
        updateInterval: 20,
        actionBarLines: ['§g Money: {money}', '§7|', '§cK: {kills} §7/ §4D: {deaths} §7(§b{kdr}§7)', '§7|', '§e Rank: {rank}']
    }
};
