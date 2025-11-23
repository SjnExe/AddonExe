import * as mc from '@minecraft/server';
import { teamConfig } from './teamConfig.js';
import { debugLog, errorLog } from './logger.js';
import { getPlayer, getOrCreatePlayer, updatePlayerData } from './playerDataManager.js';
import { incrementPlayerBalance } from './playerDataManager.js';

const teamPropertyPrefix = 'exe:team.';
const nextTeamIdKey = 'exe:nextTeamId';

/**
 * @typedef {object} TeamData
 * @property {number} id
 * @property {string} name
 * @property {string} ownerId - Player ID of the owner
 * @property {string[]} admins - Array of Player IDs
 * @property {string[]} members - Array of Player IDs (includes owner and admins)
 * @property {number} createdDate
 * @property {import('./playerDataManager.js').HomeLocation | null} home
 * @property {object[]} applications - Pending join requests FROM players TO team
 * @property {number} balance - Optional team bank balance (future proofing)
 */

// In-memory cache
/** @type {Map<number, TeamData>} */
const activeTeams = new Map();
let nextTeamId = 1;

/**
 * Initializes the team manager, loading all teams into cache.
 */
export function initialize() {
    try {
        // Load next ID
        const savedNextId = mc.world.getDynamicProperty(nextTeamIdKey);
        if (typeof savedNextId === 'number') {
            nextTeamId = savedNextId;
        }

        // Load all teams
        // Since we don't have a list of all team IDs, and dynamic properties don't support getting all keys by prefix efficiently in API < 1.10 (approx),
        // we might need a master list or iterate.
        // However, `getDynamicPropertyIds` exists in newer versions. Let's check API capabilities or use a master list if needed.
        // For now, assuming we can iterate or we track active IDs.
        // If getDynamicPropertyIds is not available, we must maintain a list of active IDs.
        // Let's use a safe approach: "exe:allTeamIds" property storing an array of IDs.

        const allIdsStr = mc.world.getDynamicProperty('exe:allTeamIds');
        let allIds = [];
        if (typeof allIdsStr === 'string') {
            allIds = JSON.parse(allIdsStr);
        }

        let loadedCount = 0;
        for (const id of allIds) {
            const teamDataStr = mc.world.getDynamicProperty(`${teamPropertyPrefix}${id}`);
            if (teamDataStr && typeof teamDataStr === 'string') {
                activeTeams.set(id, JSON.parse(teamDataStr));
                loadedCount++;
            }
        }
        debugLog(`[TeamManager] Loaded ${loadedCount} teams.`);
    } catch (e) {
        errorLog(`[TeamManager] Failed to initialize: ${e.stack}`);
    }
}

function saveTeam(teamId) {
    const team = activeTeams.get(teamId);
    if (!team) {return;}
    try {
        mc.world.setDynamicProperty(`${teamPropertyPrefix}${teamId}`, JSON.stringify(team));
    } catch (e) {
        errorLog(`[TeamManager] Failed to save team ${teamId}: ${e.stack}`);
    }
}

function saveAllTeamIds() {
    const ids = Array.from(activeTeams.keys());
    mc.world.setDynamicProperty('exe:allTeamIds', JSON.stringify(ids));
}

function saveNextTeamId() {
    mc.world.setDynamicProperty(nextTeamIdKey, nextTeamId);
}

/**
 * Creates a new team.
 * @param {import('@minecraft/server').Player} player
 * @param {string} name
 * @returns {{success: boolean, message: string}}
 */
export function createTeam(player, name) {
    if (!teamConfig.enabled) {return { success: false, message: '§cTeam system is disabled.' };}

    // Validation
    if (name.length < teamConfig.nameMinLength || name.length > teamConfig.nameMaxLength) {
        return { success: false, message: `§cName must be between ${teamConfig.nameMinLength} and ${teamConfig.nameMaxLength} characters.` };
    }

    const nameRegex = /^[0-9a-zA-Z §&+-]+$/;
    if (!nameRegex.test(name)) {
        return { success: false, message: '§cName contains invalid characters. Allowed: A-Z, 0-9, space, §, &, +, -' };
    }

    // Check for obfuscated formatting codes
    if (name.includes('§k') || name.includes('&k')) {
        return { success: false, message: '§cTeam names cannot contain obfuscated (magic) text.' };
    }

    const lowerName = name.toLowerCase();
    if (teamConfig.nameBlacklist.some(blacklisted => lowerName.includes(blacklisted))) {
        return { success: false, message: '§cName contains forbidden words.' };
    }

    // Check if name exists (case-insensitive)
    for (const team of activeTeams.values()) {
        if (team.name.toLowerCase() === lowerName) {
            return { success: false, message: '§cTeam name already taken.' };
        }
    }

    const pData = getOrCreatePlayer(player);
    if (pData.teamId) {
        return { success: false, message: '§cYou are already in a team.' };
    }
    if (pData.balance < teamConfig.creationCost) {
        return { success: false, message: `§cInsufficient funds. Cost: ${teamConfig.creationCost}` };
    }

    // Deduct money
    incrementPlayerBalance(player.id, -teamConfig.creationCost);

    const newTeamId = nextTeamId++;
    const newTeam = {
        id: newTeamId,
        name: name, // Display name with colors
        ownerId: player.id,
        admins: [],
        members: [player.id],
        createdDate: Date.now(),
        home: null,
        applications: [],
        balance: 0,
        open: true
    };

    activeTeams.set(newTeamId, newTeam);
    saveTeam(newTeamId);
    saveAllTeamIds();
    saveNextTeamId();

    // Update player data
    setPlayerTeam(player.id, newTeamId);

    return { success: true, message: `§aTeam '${name}§a' created successfully!` };
}

/**
 * Deletes a team.
 * @param {number} teamId
 * @returns {boolean}
 */
export function deleteTeam(teamId) {
    const team = activeTeams.get(teamId);
    if (!team) {return false;}

    // Remove all members
    for (const memberId of team.members) {
        setPlayerTeam(memberId, null);
        const p = mc.world.getAllPlayers().find(pl => pl.id === memberId);
        if (p) {
            p.sendMessage('§cYour team has been deleted by the owner.');
        }
    }

    activeTeams.delete(teamId);
    // Clean up storage
    mc.world.setDynamicProperty(`${teamPropertyPrefix}${teamId}`, null); // Delete property
    saveAllTeamIds();

    return true;
}

export function getTeam(teamId) {
    return activeTeams.get(teamId);
}

export function getAllTeams() {
    return Array.from(activeTeams.values());
}

export function getPlayerTeamId(playerId) {
    const pData = getPlayer(playerId);
    return pData?.teamId ?? null;
}

export function getTeamByPlayer(playerId) {
    const teamId = getPlayerTeamId(playerId);
    return teamId ? activeTeams.get(teamId) : null;
}

/**
 * Helper to update player data with team ID.
 */
export function setPlayerTeam(playerId, teamId) {
    updatePlayerData(playerId, (data) => {
        data.teamId = teamId;
        // Clear invites/requests relevant to old/new state if needed?
        // Usually good to clear pending invites TO this player from other teams
        // but keeping them is also fine, they just fail if accepted.
    });
}

// --- Member Management ---

export function kickMember(teamId, targetId) {
    const team = activeTeams.get(teamId);
    if (!team) {return { success: false, message: 'Team not found.' };}

    if (targetId === team.ownerId) {
        return { success: false, message: 'Cannot kick the owner.' };
    }

    team.members = team.members.filter(id => id !== targetId);
    team.admins = team.admins.filter(id => id !== targetId);

    setPlayerTeam(targetId, null);
    saveTeam(teamId);

    return { success: true, message: 'Player kicked.' };
}

export function promoteMember(teamId, targetId) {
    const team = activeTeams.get(teamId);
    if (!team) {return { success: false };}
    if (!team.members.includes(targetId)) {return { success: false, message: 'Player not in team.' };}
    if (team.admins.includes(targetId)) {return { success: false, message: 'Player is already admin.' };}

    team.admins.push(targetId);
    saveTeam(teamId);
    return { success: true, message: 'Player promoted to admin.' };
}

export function demoteMember(teamId, targetId) {
    const team = activeTeams.get(teamId);
    if (!team) {return { success: false };}
    team.admins = team.admins.filter(id => id !== targetId);
    saveTeam(teamId);
    return { success: true, message: 'Player demoted.' };
}

export function transferOwnership(teamId, newOwnerId) {
    const team = activeTeams.get(teamId);
    if (!team) {return { success: false };}
    if (!team.members.includes(newOwnerId)) {return { success: false, message: 'Player not in team.' };}

    team.ownerId = newOwnerId;
    // Ensure new owner is not in admin list (redundant)
    team.admins = team.admins.filter(id => id !== newOwnerId);
    // Old owner becomes admin? Or just member. Let's make them member.
    saveTeam(teamId);
    return { success: true, message: 'Ownership transferred.' };
}

// --- Invite System (Team -> Player) ---
// Stored in PlayerData.pendingInvites

export function invitePlayer(teamId, targetId) {
    const team = activeTeams.get(teamId);
    if (!team) {return { success: false };}

    if (team.members.length >= teamConfig.maxMembers) {
        return { success: false, message: '§cTeam is full.' };
    }

    let success = false;
    let msg = '';

    updatePlayerData(targetId, (data) => {
        if (data.teamId) {
            msg = '§cPlayer is already in a team.';
            return;
        }
        if (!data.pendingInvites) {data.pendingInvites = [];}

        // Clean expired
        const now = Date.now();
        data.pendingInvites = data.pendingInvites.filter(inv => now - inv.timestamp < teamConfig.requestExpirySeconds * 1000);

        if (data.pendingInvites.length >= teamConfig.maxPlayerInvites) {
            msg = '§cPlayer has too many pending invites.';
            return;
        }
        if (data.pendingInvites.some(inv => inv.teamId === teamId)) {
            msg = '§cPlayer already has an invite from this team.';
            return;
        }

        data.pendingInvites.push({
            teamId: teamId,
            teamName: team.name,
            timestamp: now
        });
        success = true;
        msg = '§aInvite sent successfully.';
    });

    return { success, message: msg };
}

export function acceptInvite(player, teamId) {
    const pData = getOrCreatePlayer(player);
    if (pData.teamId) {return { success: false, message: '§cYou are already in a team.' };}

    const inviteIndex = (pData.pendingInvites || []).findIndex(inv => inv.teamId === teamId);
    if (inviteIndex === -1) {return { success: false, message: '§cInvite not found or expired.' };}

    const team = activeTeams.get(teamId);
    if (!team) {
        // Clean up invalid invite
        updatePlayerData(player.id, d => d.pendingInvites.splice(inviteIndex, 1));
        return { success: false, message: '§cTeam no longer exists.' };
    }

    if (team.members.length >= teamConfig.maxMembers) {
        return { success: false, message: '§cTeam is full.' };
    }

    // Add to team
    team.members.push(player.id);
    saveTeam(teamId);

    // Update player
    updatePlayerData(player.id, d => {
        d.teamId = teamId;
        d.pendingInvites = []; // Clear all invites on join
    });

    return { success: true, message: `§aYou joined ${team.name}§a!` };
}

export function denyInvite(playerId, teamId) {
    let found = false;
    updatePlayerData(playerId, d => {
        if (!d.pendingInvites) {return;}
        const initialLength = d.pendingInvites.length;
        d.pendingInvites = d.pendingInvites.filter(inv => inv.teamId !== teamId);
        if (d.pendingInvites.length < initialLength) {found = true;}
    });
    return { success: found, message: found ? '§aInvite denied.' : '§cInvite not found.' };
}

// --- Application System (Player -> Team) ---
// Stored in TeamData.applications

export function applyToTeam(player, teamId) {
    const team = activeTeams.get(teamId);
    if (!team) {return { success: false, message: '§cTeam not found.' };}

    const pData = getOrCreatePlayer(player);
    if (pData.teamId) {return { success: false, message: '§cYou are already in a team.' };}

    // Check if team accepts requests
    if (team.open === false) {
        return { success: false, message: '§cThis team is not accepting new join requests.' };
    }

    // Check existing application
    if (team.applications.some(app => app.playerId === player.id)) {
        return { success: false, message: '§cYou have already applied to this team.' };
    }

    // Clean expired
    const now = Date.now();
    team.applications = team.applications.filter(app => now - app.timestamp < teamConfig.requestExpirySeconds * 1000);

    if (team.applications.length >= teamConfig.maxApplications) {
        return { success: false, message: '§cTeam has too many pending applications.' };
    }

    team.applications.push({
        playerId: player.id,
        playerName: player.name,
        timestamp: now
    });
    saveTeam(teamId);

    return { success: true, message: '§aApplication sent successfully.' };
}

export function acceptApplication(teamId, playerId) {
    const team = activeTeams.get(teamId);
    if (!team) {return { success: false, message: 'Team error.' };}

    if (team.members.length >= teamConfig.maxMembers) {
        return { success: false, message: '§cTeam is full.' };
    }

    const appIndex = team.applications.findIndex(app => app.playerId === playerId);
    if (appIndex === -1) {return { success: false, message: 'Application not found.' };}

    // Check if player joined another team
    const pData = getPlayer(playerId); // Might need loadPlayerData if offline
    // If player is offline, we can still add them if we load data
    // TODO: Add robust offline handling if needed. For now, assume cached or loadable.

    // Add member
    team.members.push(playerId);
    team.applications.splice(appIndex, 1);
    saveTeam(teamId);

    // Update player
    setPlayerTeam(playerId, teamId);

    return { success: true, message: `§aAccepted ${pData ? pData.name : 'player'} into the team.` };
}

export function denyApplication(teamId, playerId) {
    const team = activeTeams.get(teamId);
    if (!team) {return { success: false };}

    team.applications = team.applications.filter(app => app.playerId !== playerId);
    saveTeam(teamId);
    return { success: true, message: '§aApplication denied.' };
}

// --- Settings & Home ---

export function setTeamHome(teamId, location, dimensionId) {
    const team = activeTeams.get(teamId);
    if (!team) {return { success: false };}
    team.home = { x: location.x, y: location.y, z: location.z, dimensionId };
    saveTeam(teamId);
    return { success: true, message: '§aTeam home set!' };
}

export function deleteTeamHome(teamId) {
    const team = activeTeams.get(teamId);
    if (!team) {return { success: false };}
    team.home = null;
    saveTeam(teamId);
    return { success: true, message: '§aTeam home deleted!' };
}

export function setTeamOpenStatus(teamId, isOpen) {
    const team = activeTeams.get(teamId);
    if (!team) {return { success: false };}
    team.open = !!isOpen;
    saveTeam(teamId);
    return { success: true, message: `§aTeam is now ${isOpen ? 'open' : 'closed'} to requests.` };
}
