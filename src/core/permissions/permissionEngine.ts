import { CommandExecutor } from '@commands/commandManager.js';
import * as configManager from '@core/config/configManager.js';
import * as configurations from '@core/config/configurations.js';
import { getAllPlayersFromCache } from '@core/data/playerCache.js';
import * as playerDataManager from '@core/data/playerDataManager.js';
import * as rankManager from '@core/permissions/rankManager.js';
import { RankDefinition } from '@features/ranks/config.js';
import { isDefined, isNonEmptyString } from '@lib/guards.js';
import * as mc from '@minecraft/server';

interface CompiledWildcard {
  pattern: string;
  segments: string[];
  allowed: boolean;
  isUniversalStar: boolean;
}

interface PlayerPermissionCacheEntry {
  map: Record<string, boolean>;
  wildcards: CompiledWildcard[];
  tick: number;
  resolvedCache: Map<string, boolean>;
}

const rankCache = new Map<string, Record<string, boolean>>();
const playerMapCache = new Map<string, PlayerPermissionCacheEntry>();

const groupAliases: Record<string, string> = {
  member: 'default',
  moderator: 'mod',
};

const rankIdAliases: Record<string, string> = {
  mod: 'moderator',
  yt: 'media',
  youtuber: 'media',
};

const protectedSystemRankIds = new Set(['owner', 'admin', 'member']);

export function resolveRankIdAlias(inputRankId: string): string {
  const clean = inputRankId.trim().toLowerCase();
  if (isDefined(rankManager.getRankById(clean))) {
    return clean;
  }
  return rankIdAliases[clean] ?? clean;
}

export function isProtectedSystemRank(rankId: string): boolean {
  return protectedSystemRankIds.has(rankId.toLowerCase());
}

export function calculateRankMap(rank: RankDefinition): Record<string, boolean> {
  const map: Record<string, boolean> = Object.create(null) as Record<string, boolean>;
  const permGroups = configurations.getRanksConfig().permissionGroups;

  for (const rawGroup of rank.groups) {
    const groupKey = rawGroup.trim();
    const groupNodes = permGroups[groupKey] ?? permGroups[groupAliases[groupKey] ?? ''];
    if (isDefined(groupNodes)) {
      for (const node of groupNodes) {
        map[node] = true;
      }
    }
  }

  for (const node of rank.allow) {
    map[node] = true;
  }

  for (const node of rank.deny) {
    map[node] = false;
  }

  return map;
}

export function invalidatePlayerPermissionCache(playerId: string): void {
  playerMapCache.delete(playerId);
}

export function invalidateRankCache(rankId: string): void {
  rankCache.delete(rankId);
  for (const player of getAllPlayersFromCache()) {
    const pData = playerDataManager.getPlayer(player.id);
    if (pData && pData.ranks.includes(rankId)) {
      playerMapCache.delete(player.id);
    }
  }
}

export function invalidateAllRankCaches(): void {
  rankCache.clear();
  playerMapCache.clear();
}

function getRankMap(rankId: string): Record<string, boolean> {
  const existing = rankCache.get(rankId);
  if (isDefined(existing)) {
    return existing;
  }

  const rank = rankManager.getRankById(rankId);
  if (!isDefined(rank)) {
    return Object.create(null) as Record<string, boolean>;
  }

  const map = calculateRankMap(rank);
  rankCache.set(rankId, map);
  return map;
}

export function getPlayerRanks(player: mc.Player): RankDefinition[] {
  const pData = playerDataManager.getPlayer(player.id);

  let rankIds = pData?.ranks;
  if (!rankIds || rankIds.length === 0) {
    const defaultRankId = configManager.getConfig().playerDefaults.rankId;
    rankIds = isNonEmptyString(defaultRankId) ? [defaultRankId] : ['member'];
  }

  const ranks = rankIds.reduce<RankDefinition[]>((acc, id) => {
    const rank = rankManager.getRankById(id);
    if (isDefined(rank)) {
      acc.push(rank);
    }
    return acc;
  }, []);

  const allRanks = rankManager.getAllRanks();
  for (const rank of allRanks) {
    if (!ranks.includes(rank) && evaluateRankConditions(player, rank, ranks.length)) {
      ranks.push(rank);
    }
  }

  if (ranks.length === 0) {
    const defaultRank = rankManager.getRankById(configManager.getConfig().playerDefaults.rankId);
    if (isDefined(defaultRank)) {
      ranks.push(defaultRank);
    }
  }

  return ranks.toSorted((a, b) => a.priority - b.priority);
}

function evaluateRankConditions(player: mc.Player, rank: RankDefinition, assignedRankCount: number): boolean {
  if (rank.conditions.length === 0) {
    return false;
  }

  for (const condition of rank.conditions) {
    if (condition.type === 'hasTag') {
      if (!player.hasTag(condition.value as string)) {
        return false;
      }
    } else if (condition.type === 'default') {
      if (assignedRankCount > 0) {
        return false;
      }
    }
  }
  return true;
}

export function calculatePlayerMap(player: mc.Player): PlayerPermissionCacheEntry {
  const currentTick = mc.system.currentTick;
  const cached = playerMapCache.get(player.id);

  if (isDefined(cached) && currentTick - cached.tick < 20) {
    return cached;
  }

  const ranks = getPlayerRanks(player);
  const reversedRanks = [...ranks].reverse();

  const playerMap: Record<string, boolean> = Object.create(null) as Record<string, boolean>;
  for (const rank of reversedRanks) {
    const rankMap = getRankMap(rank.id);
    Object.assign(playerMap, rankMap);
  }

  const wildcards: CompiledWildcard[] = [];
  for (const [pattern, patternAllowed] of Object.entries(playerMap)) {
    if (pattern.includes('*')) {
      wildcards.push({
        pattern,
        segments: pattern.split('.'),
        allowed: patternAllowed,
        isUniversalStar: pattern === '*' || pattern === '**',
      });
    }
  }

  const resolvedCache = new Map<string, boolean>();
  const entry: PlayerPermissionCacheEntry = { map: playerMap, wildcards, tick: currentTick, resolvedCache };
  playerMapCache.set(player.id, entry);
  return entry;
}

function getShortNodeCandidate(node: string, nSegs: string[]): string | undefined {
  if (nSegs.length === 3 && (nSegs[0] === 'cmd' || nSegs[0] === 'ui')) {
    return `${nSegs[0]}.${nSegs[1]}`;
  }
  if (node === 'cmd.gamemode.builder' || node === 'cmd.gmc.builder' || node === 'cmd.gms.builder') {
    return 'cmd.gamemode.admin';
  }
  return undefined;
}

export function hasPermission(player: mc.Player, node: string): boolean {
  const ranks = getPlayerRanks(player);

  if (ranks.some((r) => r.id === 'owner' || r.allow?.includes('*'))) {
    return true;
  }

  if (ranks.some((r) => r.id === 'admin')) {
    const adminCorePermissions = [
      'cmd.ban.admin',
      'cmd.unban.admin',
      'cmd.tp.admin',
      'cmd.warp.admin',
      'cmd.setbalance.admin',
      'cmd.rank.admin',
      'cmd.gamemode.admin',
      'cmd.gamemode.builder',
      'cmd.gmc.builder',
      'cmd.gms.builder',
      'ui.panel.admin',
      'ui.panel.mod',
      'group.admin',
      'group.mod',
    ];
    if (adminCorePermissions.includes(node)) {
      return true;
    }
  }

  const { map: playerMap, wildcards, resolvedCache } = calculatePlayerMap(player);

  if (playerMap[node] !== undefined) {
    return playerMap[node];
  }

  const cachedResolution = resolvedCache.get(node);
  if (cachedResolution !== undefined) {
    return cachedResolution;
  }

  const nSegs = node.split('.');
  const shortCandidate = getShortNodeCandidate(node, nSegs);
  if (isDefined(shortCandidate) && playerMap[shortCandidate] === false) {
    resolvedCache.set(node, false);
    return false;
  }

  if (
    (node === 'cmd.gamemode.builder' || node === 'cmd.gmc.builder' || node === 'cmd.gms.builder') &&
    (playerMap['cmd.gamemode.admin'] === true || playerMap['**.admin'] === true)
  ) {
    resolvedCache.set(node, true);
    return true;
  }

  let hasMatch = isDefined(shortCandidate) && playerMap[shortCandidate] === true;
  let allowed = hasMatch;
  const shortSegs = isDefined(shortCandidate) ? shortCandidate.split('.') : undefined;

  for (const wc of wildcards) {
    if (wc.isUniversalStar) {
      if (!wc.allowed) {
        resolvedCache.set(node, false);
        return false;
      }
      hasMatch = true;
      allowed = true;
      continue;
    }

    const matchesFull = matchPermissionSegments(wc.segments, nSegs, 0, 0);
    const matchesShort =
      !matchesFull && isDefined(shortSegs) ? matchPermissionSegments(wc.segments, shortSegs, 0, 0) : false;

    if (matchesFull || matchesShort) {
      if (!wc.allowed) {
        resolvedCache.set(node, false);
        return false;
      }
      hasMatch = true;
      allowed = true;
    }
  }

  const finalResult = hasMatch ? allowed : false;
  resolvedCache.set(node, finalResult);
  return finalResult;
}

function matchPermissionSegments(pSegs: string[], nSegs: string[], pIdx: number, nIdx: number): boolean {
  if (pIdx === pSegs.length && nIdx === nSegs.length) {
    return true;
  }
  if (pIdx === pSegs.length) {
    return false;
  }

  const pSeg = pSegs[pIdx];

  if (pSeg === '**') {
    if (matchPermissionSegments(pSegs, nSegs, pIdx + 1, nIdx)) {
      return true;
    }
    if (nIdx < nSegs.length && matchPermissionSegments(pSegs, nSegs, pIdx, nIdx + 1)) {
      return true;
    }
    return false;
  }
  if (pSeg === '*') {
    if (nIdx < nSegs.length && matchPermissionSegments(pSegs, nSegs, pIdx + 1, nIdx + 1)) {
      return true;
    }
    return false;
  }
  if (nIdx < nSegs.length && pSeg === nSegs[nIdx]) {
    return matchPermissionSegments(pSegs, nSegs, pIdx + 1, nIdx + 1);
  }
  return false;
}

export function canGrantPermissions(editor: mc.Player, nodes: string[]): boolean {
  for (const node of nodes) {
    if (!hasPermission(editor, node)) {
      return false;
    }
  }
  return true;
}

export function isOwner(executor: mc.Player | CommandExecutor): boolean {
  if (!(executor instanceof mc.Player)) {
    return true;
  }
  if (typeof executor.hasTag === 'function' && executor.hasTag('owner')) {
    return true;
  }
  const ranks = getPlayerRanks(executor);
  return ranks.some((r) => r.id === 'owner' || r.allow.includes('*'));
}

export function isAdmin(executor: mc.Player | CommandExecutor): boolean {
  if (isOwner(executor)) {
    return true;
  }
  if (!(executor instanceof mc.Player)) {
    return true;
  }
  return (
    hasPermission(executor, 'group.admin') ||
    hasPermission(executor, 'ui.panel.admin') ||
    hasPermission(executor, 'cmd.rank.admin')
  );
}

export function isRestrictedOwnerNode(node: string): boolean {
  const clean = node.trim().toLowerCase();
  return (
    clean === '*' ||
    clean === '**' ||
    clean === 'owner' ||
    clean === '**.owner' ||
    clean === '*.owner' ||
    clean === 'group.owner' ||
    clean === 'ui.panel.owner' ||
    clean.endsWith('.owner')
  );
}

export function isRestrictedAdminNode(node: string): boolean {
  if (isRestrictedOwnerNode(node)) {
    return true;
  }
  const clean = node.trim().toLowerCase();
  return (
    clean === 'admin' ||
    clean === '**.admin' ||
    clean === '*.admin' ||
    clean === 'group.admin' ||
    clean === 'ui.panel.admin' ||
    clean === 'cmd.rank.admin' ||
    clean === 'cmd.rank' ||
    clean.endsWith('.admin')
  );
}

export function isRestrictedPermissionGroup(groupName: string): boolean {
  const clean = groupName.trim().toLowerCase();
  if (clean === 'owner' || clean === 'admin') {
    return true;
  }
  const groupNodes = configurations.getRanksConfig().permissionGroups[groupName.trim()];
  if (!isDefined(groupNodes)) {
    return false;
  }
  return groupNodes.some((n) => isRestrictedOwnerNode(n) || isRestrictedAdminNode(n));
}

export function canEditRankDefinition(
  editor: mc.Player | CommandExecutor,
  targetRankId: string,
): { allowed: boolean; reason?: string } {
  if (isOwner(editor)) {
    return { allowed: true };
  }
  if (!isAdmin(editor)) {
    return { allowed: false, reason: '§cYou do not have permission to edit ranks.' };
  }
  const cleanId = targetRankId.trim().toLowerCase();
  if (cleanId === 'owner' || cleanId === 'admin') {
    return { allowed: false, reason: '§cOnly the Server Owner can edit the Owner or Admin rank.' };
  }
  const targetRank = rankManager.getRankById(targetRankId);
  const adminRank = rankManager.getRankById('admin');
  const minAllowedPriority = (adminRank?.priority ?? 10) + 1;
  if (isDefined(targetRank) && targetRank.priority < minAllowedPriority) {
    return { allowed: false, reason: '§cAdmins cannot edit ranks with Admin or higher priority.' };
  }
  return { allowed: true };
}

export function canDeleteRankDefinition(
  editor: mc.Player | CommandExecutor,
  targetRankId: string,
): { allowed: boolean; reason?: string } {
  const targetRank = rankManager.getRankById(targetRankId);
  if (isProtectedSystemRank(targetRankId) || targetRank?.locked === true) {
    return { allowed: false, reason: '§cCannot delete a locked core system rank.' };
  }
  return canEditRankDefinition(editor, targetRankId);
}

export function canAssignRankToPlayer(
  editor: mc.Player | CommandExecutor,
  targetPlayerId: string,
  rankId: string,
): { allowed: boolean; reason?: string } {
  const cleanRankId = rankId.trim().toLowerCase();

  if (cleanRankId === 'owner') {
    if (editor instanceof mc.Player) {
      return {
        allowed: false,
        reason: '§cThe Owner rank can only be granted via /function owner (or server console).',
      };
    }
    return { allowed: true };
  }

  if (cleanRankId === 'admin' && !isOwner(editor)) {
    return { allowed: false, reason: '§cOnly the Server Owner can grant or revoke the Admin rank.' };
  }

  if (!isAdmin(editor)) {
    return { allowed: false, reason: '§cYou do not have permission to manage player ranks.' };
  }

  if (editor instanceof mc.Player && !isOwner(editor)) {
    if (editor.id !== targetPlayerId && !rankManager.canTarget(editor, targetPlayerId)) {
      return {
        allowed: false,
        reason: '§cYou cannot modify the ranks of a player with the same or higher rank than you.',
      };
    }
    const editorRank = rankManager.getPlayerRank(editor);
    const targetRankDef = rankManager.getRankById(cleanRankId);
    if (isDefined(targetRankDef) && targetRankDef.priority <= editorRank.priority) {
      return {
        allowed: false,
        reason: '§cYou cannot grant or revoke a rank with equal or higher priority than your own.',
      };
    }
  }

  return { allowed: true };
}

export function validateRankDefinitionEdits(
  editor: mc.Player,
  draft: { id: string; priority: number; groups: string[]; allow: string[]; deny: string[] },
  existingRankId?: string,
): { valid: boolean; error?: string } {
  const targetId = existingRankId ?? draft.id;
  const editCheck = canEditRankDefinition(editor, targetId);
  if (!editCheck.allowed) {
    return { valid: false, error: editCheck.reason };
  }

  const cleanNewId = draft.id.trim().toLowerCase();
  if (!isOwner(editor) && (cleanNewId === 'owner' || cleanNewId === 'admin')) {
    return { valid: false, error: '§cOnly the Server Owner can create or modify the Owner or Admin rank.' };
  }

  if (existingRankId !== 'owner' && draft.priority <= 0) {
    return { valid: false, error: '§cPriority 0 is reserved for the Server Owner rank. Use priority 1 or higher.' };
  }

  if (!isOwner(editor)) {
    const adminRank = rankManager.getRankById('admin');
    const minPriority = (adminRank?.priority ?? 10) + 1;
    if (draft.priority < minPriority) {
      return { valid: false, error: `§cAdmins must set rank priority to ${minPriority} or higher (below Admin).` };
    }

    for (const group of draft.groups) {
      if (isRestrictedPermissionGroup(group)) {
        return {
          valid: false,
          error: `§cSecurity Error: Only the Server Owner can assign the '${group}' permission group.`,
        };
      }
    }

    for (const node of [...draft.allow, ...draft.deny]) {
      if (isRestrictedOwnerNode(node) || isRestrictedAdminNode(node) || !hasPermission(editor, node)) {
        return {
          valid: false,
          error: `§cSecurity Error: Only the Server Owner can assign restricted permission node '${node}'.`,
        };
      }
    }
  }

  return { valid: true };
}

export function validatePermissionGroupEdits(
  editor: mc.Player,
  groupName: string,
  nodes: string[],
): { valid: boolean; error?: string } {
  const cleanGroup = groupName.trim().toLowerCase();
  if (!isOwner(editor)) {
    if (cleanGroup === 'owner' || cleanGroup === 'admin') {
      return {
        valid: false,
        error: `§cSecurity Error: Only the Server Owner can modify the '${groupName}' permission group.`,
      };
    }
    for (const node of nodes) {
      if (isRestrictedOwnerNode(node) || isRestrictedAdminNode(node) || !hasPermission(editor, node)) {
        return {
          valid: false,
          error: `§cSecurity Error: Only the Server Owner can assign restricted permission node '${node}' to a group.`,
        };
      }
    }
  }
  return { valid: true };
}
