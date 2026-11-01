import { getSidebarConfig, saveSidebarConfig } from '@core/config/configurations.js';
import {
  getSidebarLayout,
  getSidebarVisible,
  setSidebarLayout,
  setSidebarVisible,
} from '@core/data/playerDataManager.js';
import type { SidebarLayoutMode } from '@features/sidebar/config.js';
import { applySidebarPreset, forceUpdate, sidebarPresets } from '@features/sidebar/manager.js';
import { isDefined, isNonEmptyString } from '@lib/guards.js';
import * as mc from '@minecraft/server';
import { ActionFormBuilder } from '@ui/builders/actionFormBuilder.js';
import { CustomFormBuilder } from '@ui/builders/customFormBuilder.js';

const layoutLabels: Record<SidebarLayoutMode, string> = {
  right: 'Top-Right Sidebar Card (Recommended)',
  left: 'Top-Left Corner Card (Mobile Touch Friendly)',
  bottom: 'Bottom Compact HUD Bar',
  dual: 'Scoreboard + Bottom HUD Bar',
};

const layoutKeys: SidebarLayoutMode[] = ['right', 'left', 'bottom', 'dual'];

export async function showSidebarAdminPanel(player: mc.Player): Promise<void> {
  const config = getSidebarConfig();
  const isEnabled = config.enabled === true;
  const currentLayout: SidebarLayoutMode = config.defaultLayout ?? 'right';

  const form = new ActionFormBuilder()
    .title('Sidebar & HUD Manager')
    .body(
      [
        `§7Status: ${isEnabled ? '§aEnabled' : '§cDisabled'}`,
        `§7Default Layout: §b${layoutLabels[currentLayout]}`,
        `§7Sidebar Lines: §f${config.globalInfo.sidebarLines.length} §8| §7Bottom Bar Items: §f${config.hud.actionBarLines.length}`,
      ].join('\n'),
    )
    .button(
      isEnabled ? '§l§2Sidebar & HUD: ON\n§r§7Tap to disable' : '§l§4Sidebar & HUD: OFF\n§r§7Tap to enable',
      isEnabled ? 'textures/ui/realms_green_check' : 'textures/ui/cancel',
      async () => {
        config.enabled = !isEnabled;
        saveSidebarConfig(config);
        forceUpdate();
        player.sendMessage(`§aSidebar & HUD module ${config.enabled ? 'enabled' : 'disabled'}.`);
        await showSidebarAdminPanel(player);
      },
    )
    .button('§l§bLayout & Timing\n§r§7Position & intervals', 'textures/ui/icon_setting', async () => {
      await showSidebarLayoutSettingsModal(player);
    })
    .button('§l§6Theme Presets\n§r§7Apply card templates', 'textures/ui/refresh_light', async () => {
      await showSidebarPresetsPanel(player);
    })
    .button(
      `§l§fSidebar Lines (${config.globalInfo.sidebarLines.length})\n§r§7Edit card text lines`,
      'textures/items/book_writable',
      async () => {
        await showLineEditorPanel(player, 'sidebar');
      },
    )
    .button(
      `§l§fBottom Bar (${config.hud.actionBarLines.length})\n§r§7Edit actionbar items`,
      'textures/ui/book_edit_default',
      async () => {
        await showLineEditorPanel(player, 'hud');
      },
    )
    .button('§l§ePlaceholders\n§r§7View supported tags', 'textures/ui/icon_sign', async () => {
      await showSidebarPlaceholdersGuide(player);
    });

  form.addBackButton(async () => {
    const { showConfigCategoryDetailPanel } = await import('@core/ui/panels/configPanel.js');
    await showConfigCategoryDetailPanel(player, 'Visuals & UI');
  });

  await form.show(player);
}

async function showSidebarLayoutSettingsModal(player: mc.Player): Promise<void> {
  const config = getSidebarConfig();
  const currentLayout: SidebarLayoutMode = config.defaultLayout ?? 'right';
  const layoutIdx = Math.max(0, layoutKeys.indexOf(currentLayout));

  const modal = new CustomFormBuilder<{
    layoutLabel: string;
    title: string;
    maxPlayers: string;
    sidebarInterval: string;
    hudInterval: string;
    showAlertBanner: boolean;
    legacyScoreboard: boolean;
  }>('Layout & Timing Settings')
    .dropdown(
      'layoutLabel',
      'Default Server Layout Mode',
      layoutKeys.map((k) => layoutLabels[k]),
      layoutIdx,
    )
    .textField('title', 'Scoreboard Title (for Dual/Scoreboard mode)', '§l§b{server_name}', config.globalInfo.title)
    .textField('maxPlayers', 'Max Players ({max_online})', '20', String(config.globalInfo.maxPlayers))
    .textField(
      'sidebarInterval',
      'Sidebar Refresh Interval (ticks, 20 = 1s)',
      '20',
      String(config.globalInfo.updateInterval),
    )
    .textField('hudInterval', 'HUD Refresh Interval (ticks, 20 = 1s)', '20', String(config.hud.updateInterval))
    .toggle(
      'showAlertBanner',
      'Show Alerts Inside Sidebar Card (No HUD Disappearance)',
      config.showAlertBannerInSidebar !== false,
    )
    .toggle('legacyScoreboard', 'Force Global Scoreboard Objective Always On', Boolean(config.globalInfo.enabled))
    .submitButton('Save Settings');

  const res = await modal.show(player);
  if (!res) {
    await showSidebarAdminPanel(player);
    return;
  }

  const selectedIdx = layoutKeys.findIndex((k) => layoutLabels[k] === res.layoutLabel);
  config.defaultLayout = selectedIdx >= 0 ? layoutKeys[selectedIdx]! : 'right';
  if (isNonEmptyString(res.title.trim())) {
    config.globalInfo.title = res.title.trim();
  }

  const maxP = Number.parseInt(res.maxPlayers, 10);
  if (!Number.isNaN(maxP) && maxP > 0) {
    config.globalInfo.maxPlayers = maxP;
  }

  const sbInt = Number.parseInt(res.sidebarInterval, 10);
  if (!Number.isNaN(sbInt) && sbInt >= 1) {
    config.globalInfo.updateInterval = sbInt;
  }

  const hudInt = Number.parseInt(res.hudInterval, 10);
  if (!Number.isNaN(hudInt) && hudInt >= 1) {
    config.hud.updateInterval = hudInt;
  }

  config.showAlertBannerInSidebar = res.showAlertBanner;
  config.globalInfo.enabled = res.legacyScoreboard;

  saveSidebarConfig(config);
  forceUpdate();
  player.sendMessage('§aSidebar layout and timing settings saved.');
  await showSidebarAdminPanel(player);
}

async function showSidebarPresetsPanel(player: mc.Player): Promise<void> {
  const form = new ActionFormBuilder()
    .title('Sidebar Theme Presets')
    .body('Select a preset to apply pre-configured lines to both the Sidebar Card and Bottom HUD Bar:');

  for (const preset of Object.values(sidebarPresets)) {
    form.button(`§l§b${preset.name}\n§r§7${preset.description}`, 'textures/items/book_writable', async () => {
      applySidebarPreset(preset.id);
      player.sendMessage(`§aApplied '${preset.name}' sidebar preset!`);
      await showSidebarAdminPanel(player);
    });
  }

  form.addBackButton(async () => {
    await showSidebarAdminPanel(player);
  });

  await form.show(player);
}

async function showLineEditorPanel(player: mc.Player, target: 'sidebar' | 'hud'): Promise<void> {
  const config = getSidebarConfig();
  const lines = target === 'sidebar' ? config.globalInfo.sidebarLines : config.hud.actionBarLines;
  const title = target === 'sidebar' ? 'Sidebar Card Lines' : 'Bottom HUD Bar Elements';

  const form = new ActionFormBuilder()
    .title(title)
    .body('Select a line to edit, reorder, or delete:')
    .button('§2+ Add New Line', 'textures/ui/color_plus', async () => {
      const modal = new CustomFormBuilder<{ text: string }>(`Add to ${title}`)
        .textField('text', 'Line Text (Supports color codes & placeholders)', '§7Balance: §a{money}', '')
        .submitButton('Add Line');
      const res = await modal.show(player);
      if (res && isNonEmptyString(res.text)) {
        lines.push(res.text);
        saveSidebarConfig(config);
        forceUpdate();
        player.sendMessage('§aLine added.');
      }
      await showLineEditorPanel(player, target);
    });

  lines.forEach((lineText, idx) => {
    form.button(`#${idx + 1}: §r${lineText}`, 'textures/ui/book_edit_default', async () => {
      await showEditSingleLineModal(player, target, idx);
    });
  });

  form.addBackButton(async () => {
    await showSidebarAdminPanel(player);
  });

  await form.show(player);
}

async function showEditSingleLineModal(player: mc.Player, target: 'sidebar' | 'hud', index: number): Promise<void> {
  const config = getSidebarConfig();
  const lines = target === 'sidebar' ? config.globalInfo.sidebarLines : config.hud.actionBarLines;
  const currentText = lines[index];

  if (!isDefined(currentText)) {
    await showLineEditorPanel(player, target);
    return;
  }

  const actions = ['Save Text', 'Move Up', 'Move Down', 'Delete Line'];
  const modal = new CustomFormBuilder<{ text: string; action: string }>(`Edit Line #${index + 1}`)
    .textField('text', 'Line Content', '', currentText)
    .dropdown('action', 'Action', actions, 0)
    .submitButton('Apply');

  const res = await modal.show(player);
  if (!res) {
    await showLineEditorPanel(player, target);
    return;
  }

  if (res.action === 'Delete Line') {
    lines.splice(index, 1);
    player.sendMessage('§aLine deleted.');
  } else if (res.action === 'Move Up' && index > 0) {
    lines[index] = lines[index - 1]!;
    lines[index - 1] = res.text;
    player.sendMessage('§aMoved line up.');
  } else if (res.action === 'Move Down' && index < lines.length - 1) {
    lines[index] = lines[index + 1]!;
    lines[index + 1] = res.text;
    player.sendMessage('§aMoved line down.');
  } else {
    lines[index] = res.text;
    player.sendMessage('§aLine updated.');
  }

  saveSidebarConfig(config);
  forceUpdate();
  await showLineEditorPanel(player, target);
}

export async function showSidebarPlaceholdersGuide(player: mc.Player): Promise<void> {
  const form = new ActionFormBuilder()
    .grid(1)
    .title('Sidebar & HUD Placeholders')
    .body(
      [
        '§l§bServer Placeholders:§r',
        '§e{server_name}§r - Server display name',
        '§e{online}§r / §e{max_online}§r - Online & max players',
        '§e{tps}§r / §e{tps_colored}§r - Server TPS (plain or color-coded)',
        '§e{time}§r / §e{date}§r - Server time & UTC date',
        '§e{top_money_1}§r - Top leaderboard player (supports 1, 2, 3...)',
        '',
        '§l§aPlayer Economy & Social Placeholders:§r',
        '§e{name}§r - Player name',
        '§e{rank}§r / §e{rank_prefix}§r - Player rank name or formatted prefix',
        '§e{money}§r - Player wallet balance\n' + '§e{bank}§r / §e{fd}§r - Player bank savings & locked fixed deposits',
        '§e{bounty}§r - Active bounty on player',
        '§e{team}§r / §e{team_balance}§r - Player team name & team bank balance',
        '§e{homes}§r / §e{max_homes}§r - Current & maximum homes',
        '§e{friends_online}§r - Number of online friends',
        '§e{playtime}§r - Total time played on server',
        '',
        '§l§cCombat & World Placeholders:§r',
        '§e{kills}§r / §e{deaths}§r / §e{kdr}§r / §e{streak}§r - Combat statistics',
        '§e{combat}§r - Live PvP combat timer status',
        '§e{health}§r / §e{max_health}§r / §e{xp_level}§r / §e{gamemode}§r - Live player vitals',
        '§e{pos}§r or §e{coords}§r - Formatted coordinates (X, Y, Z)\n' +
          '§e{xyz}§r - Slash/space coordinates (X / Y / Z)\n' +
          '§e{x}§r, §e{y}§r, §e{z}§r - Individual coordinate axes (e.g. Y: {y})',
        '§e{dimension}§r - Current dimension (Overworld, Nether, The End)',
      ].join('\n'),
    );

  form.addBackButton(async () => {
    await showSidebarAdminPanel(player);
  });

  await form.show(player);
}

export async function showPlayerSidebarSettingsPanel(player: mc.Player): Promise<void> {
  const visible = getSidebarVisible(player.id);
  const currentLayout = getSidebarLayout(player.id);

  const layoutNames: Record<string, string> = {
    default: 'Server Default',
    right: 'Top-Right Sidebar Card',
    left: 'Top-Left Corner Card (Touch Friendly)',
    bottom: 'Bottom Compact Bar',
  };

  const form = new ActionFormBuilder()
    .title('Personal HUD & Sidebar')
    .body(
      [
        `§7Visibility: ${visible ? '§aShown' : '§cHidden'}`,
        `§7Position Layout: §b${layoutNames[currentLayout] ?? 'Server Default'}`,
        '',
        '§7Choose where your personal stats HUD is rendered on screen:',
      ].join('\n'),
    )
    .button(
      visible ? '§cHide Personal HUD' : '§2Show Personal HUD',
      visible ? 'textures/ui/cancel' : 'textures/ui/realms_green_check',
      async () => {
        const next = !visible;
        setSidebarVisible(player.id, next);
        if (!next) {
          player.onScreenDisplay.setActionBar('');
        } else {
          forceUpdate();
        }
        player.sendMessage(next ? '§aPersonal HUD enabled.' : '§cPersonal HUD hidden.');
        await showPlayerSidebarSettingsPanel(player);
      },
    )
    .button('§l§bTop-Right Card\n§r§7Standard sidebar card', 'textures/items/book_writable', async () => {
      setSidebarLayout(player.id, 'right');
      setSidebarVisible(player.id, true);
      forceUpdate();
      player.sendMessage('§aHUD layout set to Top-Right Sidebar Card.');
      await showPlayerSidebarSettingsPanel(player);
    })
    .button('§l§bTop-Left Card\n§r§7Mobile touch friendly', 'textures/items/book_writable', async () => {
      setSidebarLayout(player.id, 'left');
      setSidebarVisible(player.id, true);
      forceUpdate();
      player.sendMessage('§aHUD layout set to Top-Left Corner Card.');
      await showPlayerSidebarSettingsPanel(player);
    })
    .button('§l§bBottom Bar\n§r§7Compact actionbar pill', 'textures/items/book_writable', async () => {
      setSidebarLayout(player.id, 'bottom');
      setSidebarVisible(player.id, true);
      forceUpdate();
      player.sendMessage('§aHUD layout set to Bottom Compact Bar.');
      await showPlayerSidebarSettingsPanel(player);
    })
    .button('§l§eServer Default\n§r§7Reset position layout', 'textures/ui/refresh_light', async () => {
      setSidebarLayout(player.id, 'default');
      forceUpdate();
      player.sendMessage('§aHUD layout reset to Server Default.');
      await showPlayerSidebarSettingsPanel(player);
    });

  form.addBackButton(async () => {
    const { showProfileHub } = await import('@core/ui/panels/mainPanel.js');
    await showProfileHub(player);
  });

  await form.show(player);
}
