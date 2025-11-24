import { getConfig, updateMultipleConfig } from './configManager.js';
import { debugLog } from './logger.js';

/**
 * @typedef {object} HelpfulLink
 * @property {string} title - The display text for the link.
 * @property {string} url - The URL the link points to.
 */

/**
 * Gets the current list of helpful links from the main configuration.
 * @returns {HelpfulLink[]} The array of link objects.
 */
export function getHelpfulLinks() {
    const config = getConfig();
    return config.serverInfo.helpfulLinks || [];
}

/**
 * Saves the entire helpful links array back to the configuration.
 * @param {HelpfulLink[]} links The full array of links to save.
 */
function saveHelpfulLinks(links) {
    updateMultipleConfig({ 'serverInfo.helpfulLinks': links });
    debugLog('[HelpfulLinksManager] Updated helpful links saved to config.');
}

/**
 * Adds a new link to the end of the list and saves.
 * @param {string} title The title of the new link.
 * @param {string} url The URL of the new link.
 */
export function addHelpfulLink(title, url) {
    if (!title || !url) { return; }
    const links = getHelpfulLinks();
    links.push({ title, url });
    saveHelpfulLinks(links);
    debugLog(`[HelpfulLinksManager] Added link: "${title}" (${url})`);
}

/**
 * Updates the link at a specific index and saves.
 * @param {number} index The index of the link to edit.
 * @param {string} newTitle The new title for the link.
 * @param {string} newUrl The new URL for the link.
 */
export function editHelpfulLink(index, newTitle, newUrl) {
    const links = getHelpfulLinks();
    if (index < 0 || index >= links.length || !newTitle || !newUrl) { return; }
    const oldLink = links[index];
    links[index] = { title: newTitle, url: newUrl };
    saveHelpfulLinks(links);
    debugLog(`[HelpfulLinksManager] Edited link at index ${index}: from "${oldLink.title}" to "${newTitle}"`);
}

/**
 * Deletes a link at a specific index and saves.
 * @param {number} index The index of the link to delete.
 */
export function deleteHelpfulLink(index) {
    const links = getHelpfulLinks();
    if (index < 0 || index >= links.length) { return; }
    const deletedLink = links.splice(index, 1);
    saveHelpfulLinks(links);
    debugLog(`[HelpfulLinksManager] Deleted link at index ${index}: "${deletedLink[0].title}"`);
}

/**
 * Moves a link up or down in the list and saves.
 * @param {number} index The index of the link to move.
 * @param {'up' | 'down'} direction The direction to move the link.
 */
export function moveHelpfulLink(index, direction) {
    const links = getHelpfulLinks();
    if (index < 0 || index >= links.length) { return; }

    if (direction === 'up') {
        if (index === 0) { return; } // Can't move up if already at the top
        [links[index - 1], links[index]] = [links[index], links[index - 1]];
        debugLog(`[HelpfulLinksManager] Moved link up at index ${index}`);
    } else if (direction === 'down') {
        if (index === links.length - 1) { return; } // Can't move down if already at the bottom
        [links[index], links[index + 1]] = [links[index + 1], links[index]];
        debugLog(`[HelpfulLinksManager] Moved link down at index ${index}`);
    }

    saveHelpfulLinks(links);
}