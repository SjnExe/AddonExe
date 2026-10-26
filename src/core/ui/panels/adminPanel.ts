import * as mc from '@minecraft/server';

import { showHubPanel } from './mainPanel.js';

export {
  showFloatingTextActionPanel,
  showFloatingTextCreatePanel,
  showFloatingTextEditPanel,
  showFloatingTextListPanel,
  showPlaceholdersPanel,
} from '@features/essentials/floatingText/ui/panel.js';

export async function showStaffDashboardPanel(player: mc.Player): Promise<void> {
  await showHubPanel(player, 'staff', 'Staff Dashboard', 'Select a staff management module:');
}

export async function showStaffModerationHub(player: mc.Player): Promise<void> {
  await showHubPanel(
    player,
    'staff_moderation',
    'Moderation Center',
    'Manage player reports, punishments & anti-cheat:',
  );
}

export async function showStaffPlayerHub(player: mc.Player): Promise<void> {
  await showHubPanel(
    player,
    'staff_player',
    'Player Management',
    'Inspect active players, manage ranks & player data:',
  );
}

export async function showStaffWorldHub(player: mc.Player): Promise<void> {
  await showHubPanel(
    player,
    'staff_world',
    'World & Essentials',
    'Manage floating text holograms and world protection zones:',
  );
}

export async function showStaffConfigHub(player: mc.Player): Promise<void> {
  await showHubPanel(player, 'staff_config', 'Addon Configuration', 'Configure addon systems and feature toggles:');
}
