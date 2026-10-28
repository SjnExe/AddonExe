import { getConfig } from '@core/config/configManager.js';
import { incrementPlayerBalance } from '@core/data/playerDataManager.js';
import { StorageManager } from '@core/data/storageManager.js';
import { isFeatureActive } from '@core/services/featureManager.js';
import { formatCurrency } from '@core/utils/economy.js';
import { debugLog } from '@core/utils/logger.js';
import { clearTrackedInterval, setTrackedInterval } from '@core/utils/timerManager.js';
import { isDefined } from '@lib/guards.js';
import * as mc from '@minecraft/server';

export interface VoteOption {
  id: number;
  text: string;
  count: number;
}

export interface ActiveVote {
  id: string;
  creatorName: string;
  question: string;
  options: VoteOption[];
  votedPlayerIds: string[];
  startTime: number;
  durationSeconds: number;
  status: 'active' | 'ended';
}

const storage = new StorageManager('exe:voting');
let currentVote: ActiveVote | undefined;
let voteIntervalId: number | undefined;

export function initializeVoting() {
  currentVote = storage.load<ActiveVote>();
  if (currentVote && currentVote.status === 'active') {
    debugLog('[Voting] Loaded active vote.');
    checkVoteExpiry();
  }

  if (isDefined(voteIntervalId)) {
    clearTrackedInterval(voteIntervalId);
  }
  voteIntervalId = setTrackedInterval(() => {
    checkVoteExpiry();
  }, 200); // 10 seconds
}

function saveVote() {
  storage.save(currentVote);
}

function checkVoteExpiry() {
  if (!currentVote || currentVote.status !== 'active') {
    return;
  }

  if (currentVote.durationSeconds > 0) {
    const expiry = currentVote.startTime + currentVote.durationSeconds * 1000;
    if (Date.now() >= expiry) {
      endVote();
    }
  }
}

export function createVote(creator: mc.Player, question: string, options: string[], durationSeconds: number = 0) {
  const voteOptions: VoteOption[] = options.map((text, index) => ({
    id: index,
    text: text.trim(),
    count: 0,
  }));

  currentVote = {
    id: Date.now().toString(),
    creatorName: creator.name,
    question,
    options: voteOptions,
    votedPlayerIds: [],
    startTime: Date.now(),
    durationSeconds,
    status: 'active',
  };

  saveVote();

  mc.world.sendMessage(`§a§lNew Vote Started!§r\n§e${question}\n§7Type §f/vote§7 to participate.`);
}

export function castVote(player: mc.Player, optionId: number): { success: boolean; message: string } {
  if (!currentVote || currentVote.status !== 'active') {
    return { success: false, message: '§cNo active vote.' };
  }

  if (currentVote.votedPlayerIds.includes(player.id)) {
    return { success: false, message: '§cYou have already voted.' };
  }

  const option = currentVote.options.find((o) => o.id === optionId);
  if (!option) {
    return { success: false, message: '§cInvalid option.' };
  }

  option.count++;
  currentVote.votedPlayerIds.push(player.id);
  saveVote();

  let rewardSuffix = '';
  try {
    const cfg = getConfig();
    const rewardAmount = Number(cfg.voting?.rewardMoney ?? 0);
    if (rewardAmount > 0 && isFeatureActive('eco')) {
      incrementPlayerBalance(player.id, rewardAmount);
      rewardSuffix = ` §6(+${formatCurrency(rewardAmount)} Vote Reward!)`;
    }
  } catch {
    // Ignore if config manager is not initialized in unit test
  }

  return { success: true, message: `§aYou voted for: §e${option.text}${rewardSuffix}` };
}

export function endVote() {
  if (!currentVote || currentVote.status !== 'active') {
    return;
  }

  currentVote.status = 'ended';
  saveVote();

  let results = `§a§lVote Ended!§r\n§e${currentVote.question}\n§fResults:\n`;

  // Sort options by count descending
  const sortedOptions = [...currentVote.options].toSorted((a, b) => b.count - a.count);

  const totalVotes = currentVote.votedPlayerIds.length;

  for (const opt of sortedOptions) {
    const percent = totalVotes > 0 ? ((opt.count / totalVotes) * 100).toFixed(1) : '0.0';
    results += `§7- §f${opt.text}: §a${opt.count} §7(${percent}%)\n`;
  }

  mc.world.sendMessage(results);
}

export function getActiveVote(): ActiveVote | undefined {
  if (currentVote && currentVote.status === 'active') {
    return currentVote;
  }
  return undefined;
}

export function getLastVote(): ActiveVote | undefined {
  return currentVote;
}
