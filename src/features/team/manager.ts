import { isFeatureActive } from '@core/featureManager.js';
import * as mc from '@minecraft/server';

import { getTeamConfig } from '@core/configurations.js';
import { debugLog, errorLog } from '@core/logger.js';
import { getPlayerFromCache } from '@core/playerCache.js';
import { getOrCreatePlayer, getPlayer, incrementPlayerBalance, updatePlayerData } from '@core/playerDataManager.js';
import { serviceLocator } from '@core/services/serviceLocator.js';
import { startTeleportWarmup } from '@core/teleportLogic.js';
import { TeamData } from '@features/team/types.js';

import { isDefined, isNonEmptyString } from '@lib/guards.js';

interface TeleportUtilsService {
    saveLastLocation: (player: mc.Player, reason?: 'death' | 'teleport') => void;
}

const teamPropertyPrefix = 'exe:team.';
const nextTeamIdKey = 'exe:nextTeamId';

// Re-export types for backward compatibility if needed, but prefer importing from teamTypes.ts
export type { TeamApplication, TeamData } from '@features/team/types.js';

interface ActionResult {
    success: boolean;
    message?: string;
}

// In-memory cache
const activeTeam = new Map<number, TeamData>();
let nextTeamId = 1;

function* loadTeamJob(allIds: number[]) {
    let loadedCount = 0;
    for (const [i, id] of allIds.entries()) {
        try {
            const teamDataStr = mc.world.getDynamicProperty(`${teamPropertyPrefix}${id}`);
            if (isNonEmptyString(teamDataStr)) {
                const team = JSON.parse(teamDataStr) as TeamData;
                activeTeam.set(id, team);
                loadedCount++;
            }
        } catch (error) {
            errorLog(`[TeamManager] Error loading team ${id}: ${String(error)}`);
        }
        // Yield every 20 team to prevent lag
        if (i % 20 === 0) yield;
    }
    debugLog(`[TeamManager] Loaded ${loadedCount} team.`);
}

/**
 * Initializes the team manager, loading all team into cache.
 */
export function initialize() {
    try {
        // Load next ID
        const savedNextId = mc.world.getDynamicProperty(nextTeamIdKey);
        if (typeof savedNextId === 'number') {
            nextTeamId = savedNextId;
        }

        // Load all team
        const allIdsStr = mc.world.getDynamicProperty('exe:allTeamIds');
        let allIds: number[] = [];
        if (typeof allIdsStr === 'string') {
            allIds = JSON.parse(allIdsStr) as number[];
        }

        // Safety: Ensure nextTeamId is greater than any existing ID to prevent collisions
        if (allIds.length > 0) {
            const maxId = Math.max(...allIds);
            if (nextTeamId <= maxId) {
                nextTeamId = maxId + 1;
                saveNextTeamId();
            }
        }

        // Run loading job
        mc.system.runJob(loadTeamJob(allIds));
    } catch (error: unknown) {
        if (error instanceof Error) {
            errorLog(`[TeamManager] Failed to initialize: ${error.stack}`);
        } else {
            errorLog(`[TeamManager] Failed to initialize: ${String(error)}`);
        }
    }
}

function saveTeam(teamId: number) {
    const team = activeTeam.get(teamId);
    if (!isDefined(team)) {
        return;
    }
    try {
        mc.world.setDynamicProperty(`${teamPropertyPrefix}${teamId}`, JSON.stringify(team));
    } catch (error: unknown) {
        if (error instanceof Error) {
            errorLog(`[TeamManager] Failed to save team ${teamId}: ${error.stack}`);
        } else {
            errorLog(`[TeamManager] Failed to save team ${teamId}: ${String(error)}`);
        }
    }
}

function saveAllTeamIds() {
    const ids = [...activeTeam.keys()];
    mc.world.setDynamicProperty('exe:allTeamIds', JSON.stringify(ids));
}

function saveNextTeamId() {
    mc.world.setDynamicProperty(nextTeamIdKey, nextTeamId);
}

function processTeamCreationCost(playerId: string, balance: number, cost: number): { success: boolean; message?: string; charged: boolean } {
    let economyEnabled = false;
    try {
        // @ts-ignore (ignoring unused var)
        economyEnabled = isFeatureActive('eco');
    } catch {
        // Fallback
    }

    if (economyEnabled && cost > 0) {
        if (balance < cost) {
            return { success: false, message: `§cInsufficient funds. Cost: ${cost}`, charged: false };
        }
        // Deduct money first
        incrementPlayerBalance(playerId, -cost);
        return { success: true, charged: true };
    }

    return { success: true, charged: false };
}

function validateTeamName(name: string): ActionResult | null {
    const teamConfig = getTeamConfig();
    if (name.length < teamConfig.nameMinLength || name.length > teamConfig.nameMaxLength) {
        return {
            success: false,
            message: `§cName must be between ${teamConfig.nameMinLength} and ${teamConfig.nameMaxLength} characters.`
        };
    }

    const nameRegex = /^[0-9a-zA-Z §&+-]+$/;
    if (!nameRegex.test(name)) {
        return { success: false, message: '§cName contains invalid characters. Allowed: A-Z, 0-9, space, §, &, +, -' };
    }

    if (name.includes('§k') || name.includes('&k')) {
        return { success: false, message: '§cTeam names cannot contain obfuscated (magic) text.' };
    }

    const lowerName = name.toLowerCase();
    if (teamConfig.nameBlacklist.some((blacklisted) => lowerName.includes(blacklisted))) {
        return { success: false, message: '§cName contains forbidden words.' };
    }

    for (const team of activeTeam.values()) {
        if (team.name.toLowerCase() === lowerName) {
            return { success: false, message: '§cTeam name already taken.' };
        }
    }

    return null;
}

/**
 * Creates a new team.
 * @param player The player creating the team.
 * @param name The name of the team.
 * @returns The result of the operation.
 */
export function createTeam(player: mc.Player, name: string): ActionResult {
    const teamConfig = getTeamConfig();
    if (!teamConfig.enabled) {
        return { success: false, message: '§cTeam system is disabled.' };
    }

    const validationResult = validateTeamName(name);
    if (validationResult) {
        return validationResult;
    }

    const pData = getOrCreatePlayer(player);
    if (isDefined(pData.teamId)) {
        return { success: false, message: '§cYou are already in a team.' };
    }

    const costResult = processTeamCreationCost(player.id, pData.balance, teamConfig.creationCost);
    if (!costResult.success) {
        return { success: false, message: costResult.message };
    }

    let newTeamId = nextTeamId++;
    const newTeam: TeamData = {
        id: newTeamId,
        name: name, // Display name with colors
        ownerId: player.id,
        admins: [],
        members: [player.id],
        createdDate: Date.now(),
        home: undefined,
        applications: [],
        balance: 0,
        open: true
    };

    // Ensure ID uniqueness (Race Condition Fix)
    while (activeTeam.has(newTeamId)) {
        let maxId = 0;
        for (const id of activeTeam.keys()) {
            if (id > maxId) maxId = id;
        }
        newTeamId = maxId + 1;
        newTeam.id = newTeamId;
        nextTeamId = newTeamId + 1;
    }

    // Transaction safety
    try {
        activeTeam.set(newTeamId, newTeam);
        saveTeam(newTeamId);
        saveAllTeamIds();
        saveNextTeamId();
        // Update player data last
        setPlayerTeam(player.id, newTeamId);
    } catch (error) {
        // Rollback
        if (costResult.charged) {
            incrementPlayerBalance(player.id, teamConfig.creationCost);
        }
        activeTeam.delete(newTeamId);
        errorLog(`[TeamManager] Failed to create team, rolled back. Error: ${String(error)}`);
        return { success: false, message: '§cFailed to create team due to storage error. Funds refunded.' };
    }

    return { success: true, message: `§aTeam '${name}§a' created successfully!` };
}

/**
 * Deletes a team.
 * @param teamId The ID of the team to delete.
 * @returns True if successful, false otherwise.
 */
export function deleteTeam(teamId: number): boolean {
    const team = activeTeam.get(teamId);
    if (!isDefined(team)) {
        return false;
    }

    const teamConfig = getTeamConfig();
    const cost = teamConfig.creationCost;
    let economyEnabled = false;
    try {
        // @ts-ignore (ignoring unused var)
        economyEnabled = isFeatureActive('eco');
    } catch {
        // Fallback
    }

    if (economyEnabled && cost > 0 && isDefined(team.ownerId)) {
        // Refund if applicable
        incrementPlayerBalance(team.ownerId, cost);
    }

    // Remove all members
    for (const memberId of team.members) {
        setPlayerTeam(memberId, undefined);
        // Optimization: Use cached lookup
        const p = getPlayerFromCache(memberId);
        if (isDefined(p)) {
            p.sendMessage('§cYour team has been deleted by the owner.');
        }
    }

    activeTeam.delete(teamId);
    // Clean up storage
    mc.world.setDynamicProperty(`${teamPropertyPrefix}${teamId}`);
    saveAllTeamIds();

    return true;
}

export function getTeam(teamId: number): TeamData | undefined {
    return activeTeam.get(teamId);
}

export function getAllTeam(): TeamData[] {
    return [...activeTeam.values()];
}

export function getPlayerTeamId(playerId: string): number | undefined {
    const pData = getPlayer(playerId);
    return pData?.teamId ?? undefined;
}

export function getTeamByPlayer(playerId: string): TeamData | undefined {
    const teamId = getPlayerTeamId(playerId);
    return isDefined(teamId) ? activeTeam.get(teamId) : undefined;
}

/**
 * Helper to update player data with team ID.
 * @param playerId The player ID.
 * @param teamId The team ID or undefined to remove.
 */
export function setPlayerTeam(playerId: string, teamId: number | undefined) {
    updatePlayerData(playerId, (data) => {
        data.teamId = teamId;
    });
}

// --- Member Management ---

export function kickMember(teamId: number, targetId: string): ActionResult {
    const team = activeTeam.get(teamId);
    if (!isDefined(team)) {
        return { success: false, message: 'Team not found.' };
    }

    if (targetId === team.ownerId) {
        return { success: false, message: 'Cannot kick the owner.' };
    }

    team.members = team.members.filter((id) => id !== targetId);
    team.admins = team.admins.filter((id) => id !== targetId);

    setPlayerTeam(targetId, undefined);
    saveTeam(teamId);

    return { success: true, message: 'Player kicked.' };
}

export function promoteMember(teamId: number, targetId: string): ActionResult {
    const team = activeTeam.get(teamId);
    if (!isDefined(team)) {
        return { success: false };
    }
    if (!team.members.includes(targetId)) {
        return { success: false, message: 'Player not in team.' };
    }
    if (team.admins.includes(targetId)) {
        return { success: false, message: 'Player is already admin.' };
    }

    team.admins.push(targetId);
    saveTeam(teamId);
    return { success: true, message: 'Player promoted to admin.' };
}

export function demoteMember(teamId: number, targetId: string): ActionResult {
    const team = activeTeam.get(teamId);
    if (!isDefined(team)) {
        return { success: false };
    }
    team.admins = team.admins.filter((id) => id !== targetId);
    saveTeam(teamId);
    return { success: true, message: 'Player demoted.' };
}

export function transferOwnership(teamId: number, newOwnerId: string): ActionResult {
    const team = activeTeam.get(teamId);
    if (!isDefined(team)) {
        return { success: false };
    }
    if (!team.members.includes(newOwnerId)) {
        return { success: false, message: 'Player not in team.' };
    }

    team.ownerId = newOwnerId;
    // Ensure new owner is not in admin list (redundant)
    team.admins = team.admins.filter((id) => id !== newOwnerId);
    // Old owner becomes admin? Or just member. Let's make them member.
    saveTeam(teamId);
    return { success: true, message: 'Ownership transferred.' };
}

// --- Invite System (Team -> Player) ---
// Stored in PlayerData.pendingInvites

export function invitePlayer(teamId: number, targetId: string): ActionResult {
    const team = activeTeam.get(teamId);
    if (!isDefined(team)) {
        return { success: false };
    }

    const teamConfig = getTeamConfig();
    if (team.members.length >= teamConfig.maxMembers) {
        return { success: false, message: '§cTeam is full.' };
    }

    let success = false;
    let msg = '';

    updatePlayerData(targetId, (data) => {
        if (isDefined(data.teamId)) {
            msg = '§cPlayer is already in a team.';
            return;
        }
        if (!isDefined(data.pendingInvites)) {
            data.pendingInvites = [];
        }

        // Clean expired
        const now = Date.now();
        data.pendingInvites = data.pendingInvites.filter((inv) => now - inv.timestamp < teamConfig.requestExpirySeconds * 1000);

        if (data.pendingInvites.length >= teamConfig.maxPlayerInvites) {
            msg = '§cPlayer has too many pending invites.';
            return;
        }
        if (data.pendingInvites.some((inv) => inv.teamId === teamId)) {
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

        // Notify target if online using cache
        const targetPlayer = getPlayerFromCache(targetId);
        if (isDefined(targetPlayer)) {
            targetPlayer.sendMessage(`§aYou have been invited to join team §e${team.name}§a.\nType §e/team join§a or use the menu to accept.`);
        }
    });

    return { success, message: msg };
}

export function acceptInvite(player: mc.Player, teamId: number): ActionResult {
    const pData = getOrCreatePlayer(player);
    if (isDefined(pData.teamId)) {
        return { success: false, message: '§cYou are already in a team.' };
    }

    const inviteIndex = pData.pendingInvites.findIndex((inv) => inv.teamId === teamId);
    if (inviteIndex === -1) {
        return { success: false, message: '§cInvite not found or expired.' };
    }

    const team = activeTeam.get(teamId);
    if (!isDefined(team)) {
        // Clean up invalid invite
        updatePlayerData(player.id, (d) => {
            if (isDefined(d.pendingInvites)) {
                d.pendingInvites.splice(inviteIndex, 1);
            }
        });
        return { success: false, message: '§cTeam no longer exists.' };
    }

    const teamConfig = getTeamConfig();
    if (team.members.length >= teamConfig.maxMembers) {
        return { success: false, message: '§cTeam is full.' };
    }

    // Add to team
    team.members.push(player.id);
    saveTeam(teamId);

    // Update player
    updatePlayerData(player.id, (d) => {
        d.teamId = teamId;
        d.pendingInvites = []; // Clear all invites on join
    });

    return { success: true, message: `§aYou joined ${team.name}§a!` };
}

export function denyInvite(playerId: string, teamId: number): ActionResult {
    let found = false;
    updatePlayerData(playerId, (d) => {
        if (!isDefined(d.pendingInvites)) {
            return;
        }
        const initialLength = d.pendingInvites.length;
        d.pendingInvites = d.pendingInvites.filter((inv) => inv.teamId !== teamId);
        if (d.pendingInvites.length < initialLength) {
            found = true;
        }
    });

    return { success: found, message: found ? '§aInvite denied.' : '§cInvite not found.' };
}

// --- Application System (Player -> Team) ---
// Stored in TeamData.applications

export function applyToTeam(player: mc.Player, teamId: number): ActionResult {
    const team = activeTeam.get(teamId);
    if (!isDefined(team)) {
        return { success: false, message: '§cTeam not found.' };
    }

    const teamConfig = getTeamConfig();
    const pData = getOrCreatePlayer(player);
    if (isDefined(pData.teamId)) {
        return { success: false, message: '§cYou are already in a team.' };
    }

    // Check if team accepts requests
    if (team.open === false) {
        return { success: false, message: '§cThis team is not accepting new join requests.' };
    }

    // Check existing application
    if (team.applications.some((app) => app.playerId === player.id)) {
        return { success: false, message: '§cYou have already applied to this team.' };
    }

    // Clean expired
    const now = Date.now();
    team.applications = team.applications.filter((app) => now - app.timestamp < teamConfig.requestExpirySeconds * 1000);

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
    const team = activeTeam.get(teamId);
    if (!isDefined(team)) {
        return { success: false, message: 'Team error.' };
    }

    const teamConfig = getTeamConfig();
    if (team.members.length >= teamConfig.maxMembers) {
        return { success: false, message: '§cTeam is full.' };
    }

    const appIndex = team.applications.findIndex((app) => app.playerId === playerId);
    if (appIndex === -1) {
        return { success: false, message: 'Application not found.' };
    }

    const pData = getPlayer(playerId);

    // Add member
    team.members.push(playerId);
    team.applications.splice(appIndex, 1);
    saveTeam(teamId);

    // Update player
    setPlayerTeam(playerId, teamId);

    return { success: true, message: `§aAccepted ${isDefined(pData) ? pData.name : 'player'} into the team.` };
}

export function denyApplication(teamId: number, playerId: string): ActionResult {
    const team = activeTeam.get(teamId);
    if (!isDefined(team)) {
        return { success: false };
    }

    team.applications = team.applications.filter((app) => app.playerId !== playerId);
    saveTeam(teamId);
    return { success: true, message: '§aApplication denied.' };
}

// --- Settings & Home ---

export function setTeamHome(teamId: number, location: mc.Vector3, dimensionId: string): ActionResult {
    const team = activeTeam.get(teamId);
    if (!isDefined(team)) {
        return { success: false };
    }
    team.home = { x: location.x, y: location.y, z: location.z, dimensionId };
    saveTeam(teamId);
    return { success: true, message: '§aTeam home set!' };
}

export function deleteTeamHome(teamId: number): ActionResult {
    const team = activeTeam.get(teamId);
    if (!isDefined(team)) {
        return { success: false };
    }
    team.home = undefined;
    saveTeam(teamId);
    return { success: true, message: '§aTeam home deleted!' };
}

export function setTeamOpenStatus(teamId: number, isOpen: boolean): ActionResult {
    const team = activeTeam.get(teamId);
    if (!isDefined(team)) {
        return { success: false };
    }
    team.open = !!isOpen;
    saveTeam(teamId);
    return { success: true, message: `§aTeam is now ${isOpen ? 'open' : 'closed'} to requests.` };
}

export function leaveTeam(player: mc.Player): ActionResult {
    const team = getTeamByPlayer(player.id);
    if (!isDefined(team)) return { success: false, message: 'You are not in a team.' };
    if (team.ownerId === player.id) {
        return { success: false, message: 'Owner cannot leave. Delete team or transfer ownership.' };
    }
    return kickMember(team.id, player.id);
}

export function updateTeamSetting(teamId: number, setting: string, value: boolean): ActionResult {
    if (setting === 'open') {
        return setTeamOpenStatus(teamId, !!value);
    }
    return { success: false, message: 'Unknown setting.' };
}

export function depositToTeam(player: mc.Player, amount: number): ActionResult {
    if (Number.isNaN(amount) || amount <= 0) {
        return { success: false, message: '§cInvalid amount.' };
    }

    const team = getTeamByPlayer(player.id);
    if (!isDefined(team)) {
        return { success: false, message: '§cYou are not in a team.' };
    }

    const pData = getPlayer(player.id);
    if (!isDefined(pData) || pData.balance < amount) {
        return { success: false, message: '§cInsufficient funds.' };
    }

    incrementPlayerBalance(player.id, -amount);
    team.balance += amount;
    saveTeam(team.id);

    return { success: true, message: `§aDeposited $${amount} to the team.` };
}

export function teleportToTeamHome(player: mc.Player): void {
    const team = getTeamByPlayer(player.id);
    if (!isDefined(team) || !isDefined(team.home)) {
        player.sendMessage('§cNo team home set.');
        return;
    }

    const { x, y, z, dimensionId } = team.home;
    const teamConfig = getTeamConfig();
    const warmup = teamConfig.teleportWarmupSeconds;

    startTeleportWarmup(
        player,
        warmup,
        () => {
            try {
                const dim = mc.world.getDimension(dimensionId);
                const teleportUtils = serviceLocator.getService<TeleportUtilsService>('teleport.utils');
                if (teleportUtils) {
                    teleportUtils.saveLastLocation(player);
                }
                player.teleport({ x, y, z }, { dimension: dim });
                player.sendMessage('§aTeleported to team home!');
            } catch {
                player.sendMessage('§cTeleport failed: Dimension not loaded or invalid.');
            }
        },
        'Team Home'
    );
}
