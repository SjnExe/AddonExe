import { getConfig, updateMultipleConfig } from '@core/config/configManager.js';
import { hasPermission } from '@core/permissions/permissionEngine.js';
import { showPanel } from '@core/ui/uiManager.js';
import { getHelpfulLinks } from '@features/essentials/helpfulLinksManager.js';
import { isNonEmptyString } from '@lib/guards.js';
import * as mc from '@minecraft/server';
import { ActionFormBuilder } from '@ui/builders/actionFormBuilder.js';
import { CustomFormBuilder } from '@ui/builders/customFormBuilder.js';

export async function showInfoPanel(player: mc.Player): Promise<void> {
  const form = new ActionFormBuilder().title('Info');

  form.button('My Stats', 'textures/ui/FriendsIcon', async () => {
    await showPanel(player, 'profileMainPanel');
  });

  form.button('Server Rules', 'textures/items/book_enchanted', async () => {
    await showServerRulesPanel(player);
  });

  form.button('Helpful Links', 'textures/items/chain', async () => {
    await showHelpfulLinksPanel(player);
  });

  form.addBackButton(async () => {
    await showPanel(player, 'mainPanel');
  });

  await form.show(player);
}

export async function showServerRulesPanel(player: mc.Player): Promise<void> {
  const config = getConfig();
  const rules = config.serverInfo.rules;
  const isAdmin = hasPermission(player, 'ui.panel.admin');

  const form = new ActionFormBuilder().grid(1).title('Server Rules');

  if (rules.length === 0) {
    form.body('No rules have been set by the server administrator.');
  } else {
    const rulesText = rules.join('\n\n');
    form.body(`§l§a--- Server Rules ---\n\n§r${rulesText}`);
  }

  if (isAdmin) {
    form.button('§l§6Manage Rules (Admin)', 'textures/ui/book_edit_default', async () => {
      await showRulesAdminPanel(player, 'profile');
    });
  }

  form.addBackButton(async () => {
    await showPanel(player, 'profileHub');
  });

  await form.show(player);
}

export async function showHelpfulLinksPanel(player: mc.Player): Promise<void> {
  const links = getHelpfulLinks();
  const isAdmin = hasPermission(player, 'ui.panel.admin');

  const form = new ActionFormBuilder().grid(1).title('Helpful Links');

  if (links.length === 0) {
    form.body('No helpful links have been provided.');
  } else {
    const linksText = links.map((link) => `§l${link.title}§r\n§b${link.url}§r`).join('\n\n');
    form.body(linksText);
  }

  if (isAdmin) {
    form.button('§l§6Manage Links (Admin)', 'textures/ui/book_edit_default', async () => {
      await showHelpfulLinksAdminPanel(player, 'profile');
    });
  }

  form.addBackButton(async () => {
    await showPanel(player, 'profileHub');
  });

  await form.show(player);
}

export async function showRulesAndLinksConfigHub(player: mc.Player): Promise<void> {
  const form = new ActionFormBuilder()
    .title('Rules & Links Manager')
    .body('Manage server rules and community links displayed to players:')
    .button('Manage Server Rules', 'textures/items/book_enchanted', async () => {
      await showRulesAdminPanel(player, 'config');
    })
    .button('Manage Helpful Links', 'textures/items/chain', async () => {
      await showHelpfulLinksAdminPanel(player, 'config');
    })
    .button('Edit Server Name & Main Links', 'textures/ui/icon_book_writable', async () => {
      const { showConfigSystemPanel } = await import('@core/ui/panels/configPanel.js');
      await showConfigSystemPanel(player, 'general_server');
    });

  form.addBackButton(async () => {
    const { showConfigCategoryDetailPanel } = await import('@core/ui/panels/configPanel.js');
    await showConfigCategoryDetailPanel(player, 'Server & Network');
  });

  await form.show(player);
}

export async function showRulesAdminPanel(player: mc.Player, returnTo: 'profile' | 'config' = 'config'): Promise<void> {
  const config = getConfig();
  const rules = [...config.serverInfo.rules];

  const form = new ActionFormBuilder()
    .title('Manage Server Rules')
    .body(`Total Rules: ${rules.length}. Select a rule to edit or delete:`)
    .button('§2+ Add New Rule', 'textures/ui/color_plus', async () => {
      const modal = new CustomFormBuilder<{ text: string }>('Add Server Rule')
        .textField('text', 'Rule Text', `§e${rules.length + 1}. §rNew rule...`, '')
        .submitButton('Add Rule');
      const res = await modal.show(player);
      if (res && isNonEmptyString(res.text)) {
        rules.push(res.text.trim());
        updateMultipleConfig({ 'serverInfo.rules': rules });
        player.sendMessage('§aRule added.');
      }
      await showRulesAdminPanel(player, returnTo);
    });

  rules.forEach((ruleText, idx) => {
    const preview = ruleText.length > 36 ? ruleText.slice(0, 36) + '...' : ruleText;
    form.button(`#${idx + 1}: ${preview}`, 'textures/items/book_enchanted', async () => {
      const modal = new CustomFormBuilder<{ text: string; deleteRule: boolean }>(`Edit Rule #${idx + 1}`)
        .textField('text', 'Rule Text', '', ruleText)
        .toggle('deleteRule', '§cDelete this rule', false)
        .submitButton('Save');
      const res = await modal.show(player);
      if (res) {
        if (res.deleteRule) {
          rules.splice(idx, 1);
          updateMultipleConfig({ 'serverInfo.rules': rules });
          player.sendMessage('§aRule deleted.');
        } else if (isNonEmptyString(res.text)) {
          rules[idx] = res.text.trim();
          updateMultipleConfig({ 'serverInfo.rules': rules });
          player.sendMessage('§aRule updated.');
        }
      }
      await showRulesAdminPanel(player, returnTo);
    });
  });

  form.addBackButton(async () => {
    if (returnTo === 'profile') {
      await showServerRulesPanel(player);
    } else {
      await showRulesAndLinksConfigHub(player);
    }
  });

  await form.show(player);
}

export async function showHelpfulLinksAdminPanel(
  player: mc.Player,
  returnTo: 'profile' | 'config' = 'config',
): Promise<void> {
  const config = getConfig();
  const links = config.serverInfo.helpfulLinks.map((l) => ({ ...l }));

  const form = new ActionFormBuilder()
    .title('Manage Helpful Links')
    .body(`Total Links: ${links.length}. Select a link to edit or delete:`)
    .button('§2+ Add New Link', 'textures/ui/color_plus', async () => {
      const modal = new CustomFormBuilder<{ title: string; url: string }>('Add Helpful Link')
        .textField('title', 'Link Title', '§9Discord Server', '')
        .textField('url', 'URL', 'https://discord.gg/...', '')
        .submitButton('Add Link');
      const res = await modal.show(player);
      if (res && isNonEmptyString(res.title) && isNonEmptyString(res.url)) {
        links.push({ title: res.title.trim(), url: res.url.trim() });
        updateMultipleConfig({ 'serverInfo.helpfulLinks': links });
        player.sendMessage('§aHelpful link added.');
      }
      await showHelpfulLinksAdminPanel(player, returnTo);
    });

  links.forEach((link, idx) => {
    form.button(`${link.title}\n§r§7${link.url}`, 'textures/items/chain', async () => {
      const modal = new CustomFormBuilder<{ title: string; url: string; deleteLink: boolean }>(`Edit Link #${idx + 1}`)
        .textField('title', 'Link Title', '', link.title)
        .textField('url', 'URL', '', link.url)
        .toggle('deleteLink', '§cDelete this link', false)
        .submitButton('Save');
      const res = await modal.show(player);
      if (res) {
        if (res.deleteLink) {
          links.splice(idx, 1);
          updateMultipleConfig({ 'serverInfo.helpfulLinks': links });
          player.sendMessage('§aHelpful link deleted.');
        } else if (isNonEmptyString(res.title) && isNonEmptyString(res.url)) {
          links[idx] = { title: res.title.trim(), url: res.url.trim() };
          updateMultipleConfig({ 'serverInfo.helpfulLinks': links });
          player.sendMessage('§aHelpful link updated.');
        }
      }
      await showHelpfulLinksAdminPanel(player, returnTo);
    });
  });

  form.addBackButton(async () => {
    if (returnTo === 'profile') {
      await showHelpfulLinksPanel(player);
    } else {
      await showRulesAndLinksConfigHub(player);
    }
  });

  await form.show(player);
}
