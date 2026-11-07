import { hasPermission } from '@core/permissions/permissionEngine.js';
import * as mc from '@minecraft/server';
import {
  ActionFormData,
  ActionFormResponse,
  FormCancelationReason,
  MessageFormData,
  MessageFormResponse,
  ModalFormData,
  ModalFormResponse,
} from '@minecraft/server-ui';

function isPlayerInvalid(player: mc.Player): boolean {
  try {
    return (player as { isValid?: boolean }).isValid === false;
  } catch {
    return true;
  }
}

const activeUiSessionVersion = new Map<string, number>();
const lastFormActionTick = new Map<string, number>();
let uiSessionCounter = 0;

/**
 * Safely records the tick at which a player interacted with a form, guarding against resurrecting state for departed
 * players.
 *
 * @param player The player instance.
 * @param fallbackTick Fallback tick value if mc.system.currentTick is unavailable.
 */
function recordFormAction(player: mc.Player, fallbackTick: number | undefined): void {
  if (fallbackTick === undefined || isPlayerInvalid(player)) {
    return;
  }
  lastFormActionTick.set(player.id, typeof mc.system?.currentTick === 'number' ? mc.system.currentTick : fallbackTick);
}

/** Options configuring form presentation behavior in uiWait. */
export interface UiWaitOptions {
  /**
   * Set to true when this form is immediately succeeding another form dismissal or button action. Yields 1 tick prior
   * to the initial presentation so the Bedrock client finishes its modal exit transition, avoiding guaranteed UserBusy
   * collisions and wasted IPC/packet roundtrips.
   */
  chained?: boolean;
  /** Optional legacy flag preserved for backward compatibility. */
  wait?: boolean;
  /**
   * Optional active UI session version token. If provided, uiWait will verify that this session version remains current
   * for the player before presentation and before each retry attempt. If superseded by a newer session, uiWait
   * immediately cancels and avoids displaying the obsolete form.
   */
  sessionVersion?: number;
}

/**
 * Yields execution for a specified number of Bedrock server ticks.
 *
 * @param ticks Number of ticks to wait (defaults to 1).
 * @returns A promise that resolves after the specified ticks.
 */
export function sleepTicks(ticks = 1): Promise<void> {
  const safeTicks = Math.max(1, ticks);
  return new Promise<void>((resolve) => {
    if (typeof mc.system?.runTimeout === 'function') {
      mc.system.runTimeout(resolve, safeTicks);
    } else {
      Promise.resolve().then(resolve);
    }
  });
}

/**
 * Yields execution to the next Bedrock server tick.
 *
 * @returns A promise that resolves on the next tick.
 */
export function nextTick(): Promise<void> {
  return sleepTicks(1);
}

/**
 * Begins a new exclusive UI session for the player and returns the new session version token. Any previously running
 * board/form loops for this player observing an older token will terminate.
 *
 * @param playerId The player's unique identifier.
 * @returns The new active session version.
 */
export function beginUiSession(playerId: string): number {
  const version = ++uiSessionCounter;
  activeUiSessionVersion.set(playerId, version);
  return version;
}

/**
 * Checks whether the specified UI session version is still current for the player.
 *
 * @param playerId The player's unique identifier.
 * @param version The session version token to validate.
 * @returns True if the session is still active; false if superseded or cleared.
 */
export function isUiSessionActive(playerId: string, version: number): boolean {
  return activeUiSessionVersion.get(playerId) === version;
}

/**
 * Explicitly terminates the player's active UI session version.
 *
 * @param playerId The player's unique identifier.
 */
export function endUiSession(playerId: string): void {
  activeUiSessionVersion.delete(playerId);
}

/**
 * Clears any active UI session state and timestamps for the player.
 *
 * @param playerId The player's unique identifier.
 */
export function clearPlayerUiSession(playerId: string): void {
  activeUiSessionVersion.delete(playerId);
  lastFormActionTick.delete(playerId);
}

/**
 * Returns an appropriate icon based on the player's permission level.
 *
 * @param player The player to evaluate.
 * @returns The path to the texture icon.
 */
export function getPlayerIcon(player: mc.Player): string {
  if (hasPermission(player, 'group.mod')) {
    return 'textures/ui/permissions_op_crown';
  }
  return 'textures/ui/permissions_member_star.png';
}

/**
 * Shows a form to a player, automatically handling modal transition delays and retrying with 1-tick polling if the
 * client is momentarily UserBusy (e.g. during slash-command chat close animations or multiplayer board refreshes).
 *
 * @param player The player to display the form to.
 * @param form The action, modal, or message form data to display.
 * @param options Optional configuration controlling presentation timing.
 * @returns A promise resolving to the client form response.
 */
export async function uiWait(
  player: mc.Player,
  form: ActionFormData | ModalFormData | MessageFormData,
  options?: UiWaitOptions,
): Promise<ActionFormResponse | ModalFormResponse | MessageFormResponse> {
  const isStale = () =>
    isPlayerInvalid(player) ||
    (options?.sessionVersion !== undefined && !isUiSessionActive(player.id, options.sessionVersion));

  if (isStale()) {
    return { canceled: true, cancelationReason: FormCancelationReason.UserClosed } satisfies ActionFormResponse;
  }

  const currentTick = typeof mc.system?.currentTick === 'number' ? mc.system.currentTick : undefined;
  const isChained =
    options?.chained === true || (currentTick !== undefined && lastFormActionTick.get(player.id) === currentTick);

  if (isChained) {
    await nextTick();
    if (isStale()) {
      return { canceled: true, cancelationReason: FormCancelationReason.UserClosed } satisfies ActionFormResponse;
    }
  }

  let attempt = await form.show(player);
  if (attempt.cancelationReason !== FormCancelationReason.UserBusy) {
    recordFormAction(player, currentTick);
    return attempt;
  }

  if (typeof mc.system?.runTimeout !== 'function') {
    recordFormAction(player, currentTick);
    return attempt;
  }

  for (let retry = 0; retry < 100; retry++) {
    if (isStale()) {
      break;
    }

    const delay = retry < 15 ? 1 : 5;
    await sleepTicks(delay);

    if (isStale()) {
      break;
    }

    attempt = await form.show(player);
    if (attempt.cancelationReason !== FormCancelationReason.UserBusy) {
      recordFormAction(player, currentTick);
      return attempt;
    }

    if (retry === 15) {
      player.sendMessage('§eOpening UI... please close chat or inventory to view.§r');
    }
  }

  recordFormAction(player, currentTick);

  return { canceled: true, cancelationReason: FormCancelationReason.UserClosed } satisfies ActionFormResponse;
}

/**
 * Determines the color for the countdown timer based on remaining seconds.
 *
 * @param secondsRemaining
 * @returns The Minecraft color code.
 */
export function getCountdownColor(secondsRemaining: number): string {
  if (secondsRemaining <= 1) {
    return '§4';
  } // Dark Red
  if (secondsRemaining <= 3) {
    return '§c';
  } // Red
  if (secondsRemaining <= 5) {
    return '§6';
  } // Gold
  if (secondsRemaining <= 10) {
    return '§e';
  } // Yellow
  return '§a'; // Green
}

/** Plays the click sound for UI interactions. This is a standard feedback sound for the addon. */
export function playClickSound(player: mc.Player): void {
  if (!isPlayerInvalid(player)) {
    player.playSound('random.click', { pitch: 1, volume: 1 });
  }
}
