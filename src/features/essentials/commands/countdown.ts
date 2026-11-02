import { CommandExecutor, CustomCommand } from '@commands/commandManager.js';
import { getAllPlayersFromCache } from '@core/data/playerCache.js';
import { clearTrackedTimeout, setTrackedTimeout } from '@core/utils/timerManager.js';
import { setActionBarOverride } from '@features/sidebar/manager.js';
import { isDefined, isNonEmptyString } from '@lib/guards.js';
import * as mc from '@minecraft/server';

let activeCountdownTaskId: number | undefined;

/**
 * Checks whether a server-wide countdown is currently active.
 *
 * @returns True if a countdown task is currently scheduled, false otherwise.
 */
export function isCountdownActive(): boolean {
  return isDefined(activeCountdownTaskId);
}

/**
 * Cancels any currently active server-wide countdown and broadcasts a cancellation notice.
 *
 * @param initiatorName Optional name of the user or administrator who aborted the countdown.
 * @returns True if an active countdown was cancelled, false if none was running.
 */
export function cancelActiveCountdown(initiatorName?: string): boolean {
  if (!isDefined(activeCountdownTaskId)) {
    return false;
  }
  clearTrackedTimeout(activeCountdownTaskId);
  activeCountdownTaskId = undefined;

  const cancelNotice = isNonEmptyString(initiatorName)
    ? `§c[Countdown] Cancelled by ${initiatorName}.`
    : '§c[Countdown] Cancelled.';
  mc.world.sendMessage(cancelNotice);
  return true;
}

/**
 * Renders a single countdown tick display to all active players and schedules subsequent steps.
 *
 * @param remaining The remaining seconds in the countdown sequence.
 * @param cleanMessage Optional custom subtitle or final title banner message.
 */
function renderCountdownStep(remaining: number, cleanMessage?: string): void {
  const players = getAllPlayersFromCache();

  if (remaining <= 0) {
    activeCountdownTaskId = undefined;

    const finalTitle = isNonEmptyString(cleanMessage) ? `§a§l${cleanMessage.toUpperCase()}` : '§a§lGO!';
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
      `§e[Countdown] ${color}${remaining}s${isNonEmptyString(cleanMessage) ? ` §7- §f${cleanMessage}` : ''}`,
      1200,
    );

    if (remaining <= 3) {
      player.playSound('note.bass', { volume: 0.8, pitch: 1.5 });
    } else {
      player.playSound('random.click', { volume: 0.5, pitch: 1.0 });
    }
  }

  activeCountdownTaskId = setTrackedTimeout(() => {
    renderCountdownStep(remaining - 1, cleanMessage);
  }, 20);
}

/**
 * Starts a visual and audible server-wide countdown rendered simultaneously to all players.
 *
 * @param seconds Duration in seconds for the countdown (clamped between 1 and 60).
 * @param customMessage Optional custom announcement message or final title override.
 * @param initiatorName Optional name of the player or console administrator who started the countdown.
 * @returns True if the countdown started successfully, false if one is already active.
 */
export function startCountdown(seconds: number, customMessage?: string, initiatorName?: string): boolean {
  if (isDefined(activeCountdownTaskId)) {
    return false;
  }

  const remaining = Math.max(1, Math.min(60, Math.floor(seconds)));
  const cleanMessage = isNonEmptyString(customMessage) ? customMessage.trim() : undefined;
  const initiatorSuffix = isNonEmptyString(initiatorName) ? ` by ${initiatorName}` : '';
  const startNotice = isNonEmptyString(cleanMessage)
    ? `§e[Countdown] §6${remaining}s §7countdown started${initiatorSuffix}: §f"${cleanMessage}"`
    : `§e[Countdown] §6${remaining}s §7countdown started${initiatorSuffix}!`;
  mc.world.sendMessage(startNotice);

  renderCountdownStep(remaining, cleanMessage);
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
    {
      name: 'message',
      type: 'text',
      optional: true,
      description: 'Optional announcement or title message (quote multiword messages, e.g. "Get Ready")',
    },
  ],
  /**
   * Executes the /countdown command to start or cancel server-wide countdowns.
   *
   * @param executor The player or server console executing the command.
   * @param args Command arguments containing the duration or cancel action, and optional message.
   */
  execute: (executor: CommandExecutor, args: Record<string, unknown>) => {
    if (executor instanceof mc.Player && !executor.isValid) {
      return;
    }

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

    if (!/^\d+$/.test(rawAction)) {
      executor.sendMessage('§cUsage: /countdown <1-60|cancel> [message]');
      return;
    }

    const parsedSeconds = Number.parseInt(rawAction, 10);
    if (parsedSeconds < 1 || parsedSeconds > 60) {
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
