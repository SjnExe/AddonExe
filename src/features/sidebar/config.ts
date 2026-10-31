export type SidebarLayoutMode = 'right' | 'left' | 'bottom' | 'dual';

export const config = {
  enabled: true,
  defaultLayout: 'right' as SidebarLayoutMode,
  themePreset: 'modernDark',
  showAlertBannerInSidebar: true,
  globalInfo: {
    enabled: false,
    opacity: 'medium',
    title: '§l§b{server_name}',
    updateInterval: 20,
    maxPlayers: 20,
    sidebarLines: [
      '§l§b{server_name} §r§8({online}/{max_online})',
      '§7Player: §f{name} §8[§e{rank}§8]',
      '§7Balance: §a{money} §8| §7Team: §d{team}',
      '§7Combat: §c{kills}K §7/ §4{deaths}D §8(§b{kdr}§8)',
      '§7TPS: {tps_colored}',
    ],
  },
  hud: {
    enabled: true,
    updateInterval: 20,
    actionBarLines: ['§a{money}', '§8|', '§cK: {kills} §7/ §4D: {deaths} §8(§b{kdr}§8)', '§8|', '§e{rank}'],
  },
  announcements: {
    enabled: true,
    intervalSeconds: 15,
    messages: [
      '§bType §e/panel§b to open the server menu',
      '§aVote daily using §e/vote§a for rewards',
      '§dNeed help? Join our Discord via §e/links',
    ],
  },
};

export default config;
