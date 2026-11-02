import { CommandExecutor, CustomCommand } from '@commands/commandManager.js';
import { getAllPlayersFromCache } from '@core/data/playerCache.js';
import { clearTrackedInterval, setTrackedInterval } from '@core/utils/timerManager.js';
import { setActionBarOverride } from '@features/sidebar/manager.js';
import { isDefined, isNonEmptyString } from '@lib/guards.js';
import * as mc from '@minecraft/server';

let activeCountdownTaskId: number | undefined;

export function isCountdownActive(): boolean {
  return isDefined(activeCountdownTaskId);
}

export function cancelActiveCountdown(initiatorName?: string): boolean {
  if (!isDefined(activeCountdownTaskId)) {
    return false;
  }
  clearTrackedInterval(activeCountdownTaskId);
  activeCountdownTaskId = undefined;

  const cancelNotice = isNonEmptyString(initiatorName)
    ? `§c[Countdown] Cancelled by ${initiatorName}.`
    : '§c[Countdown] Cancelled.';
  mc.world.sendMessage(cancelNotice);
  return true;
}

export function startCountdown(seconds: number, customMessage?: string, initiatorName?: string): boolean {
  if (isDefined(activeCountdownTaskId)) {
    return false;
  }

  let remaining = Math.max(1, Math.min(60, Math.floor(seconds)));
  const cleanMessage = isNonEmptyString(customMessage) ? customMessage.trim() : undefined;
  const initiatorSuffix = isNonEmptyString(initiatorName) ? ` by ${initiatorName}` : '';
  const startNotice = isNonEmptyString(cleanMessage)
    ? `§e[Countdown] §6${remaining}s §7countdown started${initiatorSuffix}: §f"${cleanMessage}"`
    : `§e[Countdown] §6${remaining}s §7countdown started${initiatorSuffix}!`;
  mc.world.sendMessage(startNotice);

  activeCountdownTaskId = setTrackedInterval(() => {
    const players = getAllPlayersFromCache();

    if (remaining <= 0) {
      if (isDefined(activeCountdownTaskId)) {
        clearTrackedInterval(activeCountdownTaskId);
        activeCountdownTaskId = undefined;
      }

      const finalTitle = cleanMessage ? `§a§l${cleanMessage.toUpperCase()}` : '§a§lGO!';
      for (const player of players) {
        if (!player.isValid) {
          continue;
        }
        player.onScreenDisplay.setTitle(finalTitle, {
          subtitle: '',
          stayDuration: 40,
          fadeInDuration: 0,
          fadeOutDuration: 10,
        });
        setActionBarOverride(player, finalTitle, 2500);
        player.playSound('random.levelup', { volume: 0.8, pitch: 1.2 });
      }
      return;
    }

    let color = '§a§l';
    if (remaining <= 3) {
      color = '§c§l';
    } else if (remaining <= 5) {
      color = '§e§l';
    }

    const titleText = `${color}${remaining}`;
    const subtitleText = cleanMessage ?? '';

    for (const player of players) {
      if (!player.isValid) {
        continue;
      }
      player.onScreenDisplay.setTitle(titleText, {
        subtitle: subtitleText,
        stayDuration: 20,
        fadeInDuration: 0,
        fadeOutDuration: 5,
      });
      setActionBarOverride(
        player,
        `§e[Countdown] ${color}${remaining}s${cleanMessage ? ` §7- §f${cleanMessage}` : ''}`,
        1200,
      );

      if (remaining <= 3) {
        player.playSound('note.bass', { volume: 0.8, pitch: 1.5 });
      } else {
        player.playSound('random.click', { volume: 0.5, pitch: 1.0 });
      }
    }

    remaining--;
  }, 20);

  return true;
}

const countdownCommand: CustomCommand = {
  name: 'countdown',
  aliases: ['cd'],
  description: 'Starts a visual and audible server-wide countdown (or /countdown cancel).',
  category: 'Essentials',
  permissionNode: 'cmd.countdown.admin',
  allowConsole: true,
  parameters: [
    { name: 'secondsOrAction', type: 'string', description: 'Duration in seconds (1-60) or "cancel"' },
    { name: 'message', type: 'text', optional: true, description: 'Optional announcement or title message' },
  ],
  execute: (executor: CommandExecutor, args: Record<string, unknown>) => {
    const rawAction = String(args.secondsOrAction ?? '')
      .trim()
      .toLowerCase();
    const message = typeof args.message === 'string' ? args.message : undefined;
    const senderName = executor instanceof mc.Player ? executor.name : 'Console';

    if (rawAction === 'cancel' || rawAction === 'stop') {
      const cancelled = cancelActiveCountdown(senderName);
      if (!cancelled) {
        executor.sendMessage('§cNo countdown is currently in progress.');
      }
      return;
    }

    const parsedSeconds = Number.parseInt(rawAction, 10);
    if (Number.isNaN(parsedSeconds) || parsedSeconds < 1 || parsedSeconds > 60) {
      executor.sendMessage('§cUsage: /countdown <1-60|cancel> [message]');
      return;
    }

    if (isCountdownActive()) {
      executor.sendMessage('§cA countdown is already in progress. Use /countdown cancel to abort it.');
      return;
    }

    startCountdown(parsedSeconds, message, senderName);
  },
};

export default countdownCommand;
