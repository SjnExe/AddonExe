import { isDefined, isNonEmptyString } from '@lib/guards.js';
import { getConfig, updateMultipleConfig } from '@core/configManager.js';
import { debugLog } from '@core/logger.js';

export interface HelpfulLink {
    title: string;
    url: string;
}

/**
 * Gets the current list of helpful links from the main configuration.
 * @returns The array of link objects.
 */
export function getHelpfulLinks(): HelpfulLink[] {
    const config = getConfig();
    return (isDefined(config.serverInfo) ? config.serverInfo.helpfulLinks : undefined) ?? [];
}

/**
 * Saves the entire helpful links array back to the configuration.
 * @param links The full array of links to save.
 */
function saveHelpfulLinks(links: HelpfulLink[]) {
    updateMultipleConfig({ 'serverInfo.helpfulLinks': links });
    debugLog('[HelpfulLinksManager] Updated helpful links saved to config.');
}

/**
 * Adds a new link to the end of the list and saves.
 * @param title The title of the new link.
 * @param url The URL of the new link.
 */
export function addHelpfulLink(title: string, url: string) {
    if (!isNonEmptyString(title) || !isNonEmptyString(url)) {
        return;
    }
    const links = getHelpfulLinks();
    links.push({ title, url });
    saveHelpfulLinks(links);
    debugLog(`[HelpfulLinksManager] Added link: "${title}" (${url})`);
}

/**
 * Updates the link at a specific index and saves.
 * @param index The index of the link to edit.
 * @param newTitle The new title for the link.
 * @param newUrl The new URL for the link.
 */
export function editHelpfulLink(index: number, newTitle: string, newUrl: string) {
    const links = getHelpfulLinks();
    if (index < 0 || index >= links.length || !isNonEmptyString(newTitle) || !isNonEmptyString(newUrl)) {
        return;
    }
    const oldLink = links[index];
    if (!isDefined(oldLink)) {
        return;
    }
    links[index] = { title: newTitle, url: newUrl };
    saveHelpfulLinks(links);
    debugLog(`[HelpfulLinksManager] Edited link at index ${index}: from "${oldLink.title}" to "${newTitle}"`);
}

/**
 * Deletes a link at a specific index and saves.
 * @param index The index of the link to delete.
 */
export function deleteHelpfulLink(index: number) {
    const links = getHelpfulLinks();
    if (index < 0 || index >= links.length) {
        return;
    }
    const deletedLink = links.splice(index, 1);
    const link = deletedLink[0];
    if (!isDefined(link)) {
        return;
    }
    saveHelpfulLinks(links);
    debugLog(`[HelpfulLinksManager] Deleted link at index ${index}: "${link.title}"`);
}

/**
 * Moves a link up or down in the list and saves.
 * @param index The index of the link to move.
 * @param direction The direction to move the link.
 */
export function moveHelpfulLink(index: number, direction: 'up' | 'down') {
    const links = getHelpfulLinks();
    if (index < 0 || index >= links.length) {
        return;
    }

    if (direction === 'up') {
        if (index === 0) {
            return;
        } // Can't move up if already at the top
        const prev = links[index - 1];
        const curr = links[index];
        if (isDefined(prev) && isDefined(curr)) {
            links[index - 1] = curr;
            links[index] = prev;
            debugLog(`[HelpfulLinksManager] Moved link up at index ${index}`);
        }
    } else {
        if (index === links.length - 1) {
            return;
        } // Can't move down if already at the bottom
        const next = links[index + 1];
        const curr = links[index];
        if (isDefined(next) && isDefined(curr)) {
            links[index + 1] = curr;
            links[index] = next;
            debugLog(`[HelpfulLinksManager] Moved link down at index ${index}`);
        }
    }

    saveHelpfulLinks(links);
}
