import * as mc from '@minecraft/server';
import { teamConfig } from './teamConfig.js';
import { debugLog, errorLog } from './logger.js';
import { getPlayer, getOrCreatePlayer, updatePlayerData, HomeLocation } from './playerDataManager.js';
import { incrementPlayerBalance } from './playerDataManager.js';

const teamPropertyPrefix = 'exe:team.';
const nextTeamIdKey = 'exe:nextTeamId';

interface TeamApplication {
    playerId: string;
    playerName: string;
    timestamp: number;
}

interface TeamData {
    id: number;
    name: string;
    ownerId: string;
    admins: string[];
    members: string[]; // Includes owner and admins
    createdDate: number;
    home: HomeLocation | null;
    applications: TeamApplication[];
    balance: number;
    open: boolean;
}

interface ActionResult {
    success: boolean;
    message?: string;
}

// In-memory cache
const activeTeams = new Map<number, TeamData>();
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
        const allIdsStr = mc.world.getDynamicProperty('exe:allTeamIds');
        let allIds: number[] = [];
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
    } catch (e: unknown) {
        if (e instanceof Error) {
            errorLog(`[TeamManager] Failed to initialize: ${e.stack}`);
        } else {
            errorLog(`[TeamManager] Failed to initialize: ${String(e)}`);
        }
    }
}

function saveTeam(teamId: number) {
    const team = activeTeams.get(teamId);
    if (!team) {return;}
    try {
        mc.world.setDynamicProperty(`${teamPropertyPrefix}${teamId}`, JSON.stringify(team));
    } catch (e: unknown) {
        if (e instanceof Error) {
            errorLog(`[TeamManager] Failed to save team ${teamId}: ${e.stack}`);
        } else {
            errorLog(`[TeamManager] Failed to save team ${teamId}: ${String(e)}`);
        }
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
 * @param player The player creating the team.
 * @param name The name of the team.
 * @returns The result of the operation.
 */
export function createTeam(player: mc.Player, name: string): ActionResult {
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
    const newTeam: TeamData = {
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
 * @param teamId The ID of the team to delete.
 * @returns True if successful, false otherwise.
 */
export function deleteTeam(teamId: number): boolean {
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
    mc.world.setDynamicProperty(`${teamPropertyPrefix}${teamId}`, undefined); // undefined or null deletes property
    saveAllTeamIds();

    return true;
}

export function getTeam(teamId: number): TeamData | undefined {
    return activeTeams.get(teamId);
}

export function getAllTeams(): TeamData[] {
    return Array.from(activeTeams.values());
}

export function getPlayerTeamId(playerId: string): number | null {
    const pData = getPlayer(playerId);
    return pData?.teamId ?? null;
}

export function getTeamByPlayer(playerId: string): TeamData | null {
    const teamId = getPlayerTeamId(playerId);
    return teamId ? activeTeams.get(teamId) || null : null;
}

/**
 * Helper to update player data with team ID.
 * @param playerId The player ID.
 * @param teamId The team ID or null to remove.
 */
export function setPlayerTeam(playerId: string, teamId: number | null) {
    updatePlayerData(playerId, (data) => {
        data.teamId = teamId;
    });
}

// --- Member Management ---

export function kickMember(teamId: number, targetId: string): ActionResult {
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

export function promoteMember(teamId: number, targetId: string): ActionResult {
    const team = activeTeams.get(teamId);
    if (!team) {return { success: false };}
    if (!team.members.includes(targetId)) {return { success: false, message: 'Player not in team.' };}
    if (team.admins.includes(targetId)) {return { success: false, message: 'Player is already admin.' };}

    team.admins.push(targetId);
    saveTeam(teamId);
    return { success: true, message: 'Player promoted to admin.' };
}

export function demoteMember(teamId: number, targetId: string): ActionResult {
    const team = activeTeams.get(teamId);
    if (!team) {return { success: false };}
    team.admins = team.admins.filter(id => id !== targetId);
    saveTeam(teamId);
    return { success: true, message: 'Player demoted.' };
}

export function transferOwnership(teamId: number, newOwnerId: string): ActionResult {
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

export function invitePlayer(teamId: number, targetId: string): ActionResult {
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

export function acceptInvite(player: mc.Player, teamId: number): ActionResult {
    const pData = getOrCreatePlayer(player);
    if (pData.teamId) {return { success: false, message: '§cYou are already in a team.' };}

    const inviteIndex = (pData.pendingInvites || []).findIndex(inv => inv.teamId === teamId);
    if (inviteIndex === -1) {return { success: false, message: '§cInvite not found or expired.' };}

    const team = activeTeams.get(teamId);
    if (!team) {
        // Clean up invalid invite
        updatePlayerData(player.id, d => {
             if (d.pendingInvites) {d.pendingInvites.splice(inviteIndex, 1);}
        });
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

export function denyInvite(playerId: string, teamId: number): ActionResult {
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

export function applyToTeam(player: mc.Player, teamId: number): ActionResult {
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

export function acceptApplication(teamId: number, playerId: string): ActionResult {
    const team = activeTeams.get(teamId);
    if (!team) {return { success: false, message: 'Team error.' };}

    if (team.members.length >= teamConfig.maxMembers) {
        return { success: false, message: '§cTeam is full.' };
    }

    const appIndex = team.applications.findIndex(app => app.playerId === playerId);
    if (appIndex === -1) {return { success: false, message: 'Application not found.' };}

    const pData = getPlayer(playerId);

    // Add member
    team.members.push(playerId);
    team.applications.splice(appIndex, 1);
    saveTeam(teamId);

    // Update player
    setPlayerTeam(playerId, teamId);

    return { success: true, message: `§aAccepted ${pData ? pData.name : 'player'} into the team.` };
}

export function denyApplication(teamId: number, playerId: string): ActionResult {
    const team = activeTeams.get(teamId);
    if (!team) {return { success: false };}

    team.applications = team.applications.filter(app => app.playerId !== playerId);
    saveTeam(teamId);
    return { success: true, message: '§aApplication denied.' };
}

// --- Settings & Home ---

export function setTeamHome(teamId: number, location: mc.Vector3, dimensionId: string): ActionResult {
    const team = activeTeams.get(teamId);
    if (!team) {return { success: false };}
    team.home = { x: location.x, y: location.y, z: location.z, dimensionId };
    saveTeam(teamId);
    return { success: true, message: '§aTeam home set!' };
}

export function deleteTeamHome(teamId: number): ActionResult {
    const team = activeTeams.get(teamId);
    if (!team) {return { success: false };}
    team.home = null;
    saveTeam(teamId);
    return { success: true, message: '§aTeam home deleted!' };
}

export function setTeamOpenStatus(teamId: number, isOpen: boolean): ActionResult {
    const team = activeTeams.get(teamId);
    if (!team) {return { success: false };}
    team.open = !!isOpen;
    saveTeam(teamId);
    return { success: true, message: `§aTeam is now ${isOpen ? 'open' : 'closed'} to requests.` };
}
