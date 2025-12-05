import * as mc from '@minecraft/server';
import { ActionFormResponse, ModalFormData, ModalFormResponse } from '@minecraft/server-ui';

import * as helpfulLinksManager from '../../helpfulLinksManager.js';
import { getPlayer } from '../../playerDataManager.js';
import * as rulesManager from '../../rulesManager.js';
import { showPanel } from '../../uiManager.js';
import * as utils from '../../utils.js';
import { showConfirmationDialog } from '../components.js';
import { UIContext } from '../panelRegistry.js';
import { getPaginatedItems, itemsPerPage } from '../uiUtils.js';

export async function handleMiscPanel(
    player: mc.Player,
    panelId: string,
    response: ActionFormResponse | ModalFormResponse,
    context: UIContext
) {
    const selection = (response as ActionFormResponse).selection;
    const canceled = response.canceled;
    const formValues = (response as ModalFormResponse).formValues;
    const pData = getPlayer(player.id);

    if (!pData) return;

    if (panelId === 'rulesManagementPanel') {
        const page = context.page || 1;
        const rules = rulesManager.getRules();

        // Back button
        if (selection === 0) {
            return showPanel(player, 'infoPanel', context);
        }

        let offset = 1;
        if (pData.permissionLevel <= 1) {
            // "Add Rule" button
            if (selection === 1) {
                return showPanel(player, 'addRulePanel', context);
            }
            offset++;
        }

        const paginatedRules = getPaginatedItems(rules, page);
        if (typeof selection !== 'number') return;
        const selectionIndex = selection - offset;

        // Handle rule selection
        if (selectionIndex < paginatedRules.length) {
            const ruleIndex = (page - 1) * itemsPerPage + selectionIndex;
            return showPanel(player, 'ruleActionPanel', { ...context, ruleIndex });
        }

        // Handle pagination
        let buttonIndex = selectionIndex - paginatedRules.length;
        const totalPages = Math.ceil(rules.length / itemsPerPage);
        const hasPrev = page > 1;
        const hasNext = page < totalPages;

        if (rules.length > itemsPerPage) {
            if (hasPrev && buttonIndex === 0) {
                return showPanel(player, panelId, { ...context, page: page - 1 });
            }
            if (hasPrev) {
                buttonIndex--;
            }

            if (hasNext && buttonIndex === 0) {
                return showPanel(player, panelId, { ...context, page: page + 1 });
            }
            if (hasNext) {
                buttonIndex--;
            }
        }
        return;
    }

    if (panelId === 'addRulePanel') {
        if (canceled) {
            return showPanel(player, 'rulesManagementPanel', context);
        }
        if (!formValues) return;

        const [newRuleText] = formValues as string[];
        if (newRuleText) {
            rulesManager.addRule(newRuleText);
            player.sendMessage('§2Rule added successfully.');
        }
        return showPanel(player, 'rulesManagementPanel', context);
    }

    if (panelId === 'ruleActionPanel') {
        const { ruleIndex } = context;

        if (typeof selection !== 'number') return;
        switch (selection) {
            case 0: {
                // Edit Text
                const rules = rulesManager.getRules();
                const currentText = rules[ruleIndex];
                const editForm = new ModalFormData()
                    .title('Edit Rule Text')
                    .textField('Rule text', 'Enter the new text', { defaultValue: currentText });

                const editResponse = await utils.uiWait(player, editForm);
                if (editResponse.canceled) {
                    return showPanel(player, 'ruleActionPanel', context);
                }

                const values = (editResponse as ModalFormResponse).formValues;
                if (!values) return;

                const [newText] = values as string[];
                if (newText) {
                    rulesManager.editRule(ruleIndex, newText);
                    player.sendMessage('§2Rule updated successfully.');
                }
                return showPanel(player, 'rulesManagementPanel', context);
            }
            case 1: // Move Up
                rulesManager.moveRule(ruleIndex, 'up');
                return showPanel(player, 'rulesManagementPanel', context);
            case 2: // Move Down
                rulesManager.moveRule(ruleIndex, 'down');
                return showPanel(player, 'rulesManagementPanel', context);
            case 3: {
                // Delete Rule
                await showConfirmationDialog(player, {
                    title: '§4Confirm Deletion',
                    body: 'Are you sure you want to delete this rule?',
                    confirmButtonText: '§4Yes, Delete',
                    cancelButtonText: '§2No, Cancel',
                    onConfirm: () => {
                        rulesManager.deleteRule(ruleIndex);
                        player.sendMessage('§2Rule deleted successfully.');
                        return showPanel(player, 'rulesManagementPanel', context);
                    },
                    onCancel: () => {
                        return showPanel(player, 'rulesManagementPanel', context);
                    }
                });
                return;
            }
            case 4: // Back
                return showPanel(player, 'rulesManagementPanel', context);
        }
        return;
    }

    if (panelId === 'helpfulLinksManagementPanel') {
        const page = context.page || 1;
        const links = helpfulLinksManager.getHelpfulLinks();

        // Back button
        if (selection === 0) {
            return showPanel(player, 'infoPanel', context);
        }

        let offset = 1;
        if (pData.permissionLevel <= 1) {
            // Add Link button
            if (selection === 1) {
                return showPanel(player, 'addHelpfulLinkPanel', context);
            }
            offset++;
        }

        const paginatedLinks = getPaginatedItems(links, page);
        if (typeof selection !== 'number') return;
        const selectionIndex = selection - offset;

        // Handle link selection
        if (selectionIndex < paginatedLinks.length) {
            const linkIndex = (page - 1) * itemsPerPage + selectionIndex;
            return showPanel(player, 'helpfulLinkActionPanel', { ...context, linkIndex });
        }

        // Handle pagination
        let buttonIndex = selectionIndex - paginatedLinks.length;
        const totalPages = Math.ceil(links.length / itemsPerPage);
        const hasPrev = page > 1;
        const hasNext = page < totalPages;

        if (links.length > itemsPerPage) {
            if (hasPrev && buttonIndex === 0) {
                return showPanel(player, panelId, { ...context, page: page - 1 });
            }
            if (hasPrev) {
                buttonIndex--;
            }

            if (hasNext && buttonIndex === 0) {
                return showPanel(player, panelId, { ...context, page: page + 1 });
            }
            if (hasNext) {
                buttonIndex--;
            }
        }
        return;
    }

    if (panelId === 'addHelpfulLinkPanel') {
        if (canceled) {
            return showPanel(player, 'helpfulLinksManagementPanel', context);
        }
        if (!formValues) return;

        const [title, url] = formValues as string[];
        if (title && url) {
            helpfulLinksManager.addHelpfulLink(title, url);
            player.sendMessage('§2Link added successfully.');
        }
        return showPanel(player, 'helpfulLinksManagementPanel', context);
    }

    if (panelId === 'helpfulLinkActionPanel') {
        const { linkIndex } = context;
        if (typeof selection !== 'number') return;
        switch (selection) {
            case 0: {
                // Edit
                const links = helpfulLinksManager.getHelpfulLinks();
                const currentLink = links[linkIndex];
                const editForm = new ModalFormData()
                    .title('Edit Link')
                    .textField('Link Title', 'Enter the new title', { defaultValue: currentLink.title })
                    .textField('Link URL', 'Enter the new URL', { defaultValue: currentLink.url });
                const editResponse = await utils.uiWait(player, editForm);
                if (editResponse.canceled) {
                    return showPanel(player, 'helpfulLinkActionPanel', context);
                }
                const values = (editResponse as ModalFormResponse).formValues;
                if (!values) return;

                const [newTitle, newUrl] = values as string[];
                if (newTitle && newUrl) {
                    helpfulLinksManager.editHelpfulLink(linkIndex, newTitle, newUrl);
                    player.sendMessage('§2Link updated successfully.');
                }
                return showPanel(player, 'helpfulLinksManagementPanel', context);
            }
            case 1: // Move Up
                helpfulLinksManager.moveHelpfulLink(linkIndex, 'up');
                return showPanel(player, 'helpfulLinksManagementPanel', context);
            case 2: // Move Down
                helpfulLinksManager.moveHelpfulLink(linkIndex, 'down');
                return showPanel(player, 'helpfulLinksManagementPanel', context);
            case 3: {
                // Delete Link
                await showConfirmationDialog(player, {
                    title: '§4Confirm Deletion',
                    body: 'Are you sure you want to delete this link?',
                    confirmButtonText: '§4Yes, Delete',
                    cancelButtonText: '§2No, Cancel',
                    onConfirm: () => {
                        helpfulLinksManager.deleteHelpfulLink(linkIndex);
                        player.sendMessage('§2Link deleted successfully.');
                        return showPanel(player, 'helpfulLinksManagementPanel', context);
                    },
                    onCancel: () => {
                        return showPanel(player, 'helpfulLinksManagementPanel', context);
                    }
                });
                return;
            }
            case 4: // Back
                return showPanel(player, 'helpfulLinksManagementPanel', context);
        }
        return;
    }
}
