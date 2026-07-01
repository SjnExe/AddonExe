# Checklist of Missing Features from Old Addon

This document lists all the features, files, and assets that were present in `OldAntiCheatsBP` and `OldAntiCheatsRP` but are missing from the new `AddonExeBP` and `AddonExeRP`.

## Behavior Pack (`OldAntiCheatsBP`)

### 1. Core Systems

The entire automated punishment, action handling, and logging systems are missing.

#### 1.1. `automodManager.js`

This file was responsible for the tiered punishment system. It would automatically warn, kick, or ban players based on the number of flags they accumulated.

```javascript
// OldAntiCheatsBP/scripts/core/automodManager.js
const secondsPerMinute = 60;
const minutesPerHour = 60;
const hoursPerDay = 24;
const defaultAutomodTempbanDurationMs = 300000;
const defaultAutomodMuteDurationMs = 600000;
/**
 * @param {number | Infinity} ms - The duration in milliseconds, or Infinity for permanent.
 * @returns {string} A formatted duration string (e.g., '5m', '1h', 'Permanent').
 */
function formatDuration(ms) {
    if (ms === Infinity) {
        return 'Permanent';
    }
    if (typeof ms !== 'number' || ms <= 0) {
        return '0s';
    }

    let totalSeconds = Math.floor(ms / 1000);

    const days = Math.floor(totalSeconds / (hoursPerDay * minutesPerHour * secondsPerMinute));
    totalSeconds %= hoursPerDay * minutesPerHour * secondsPerMinute;

    const hours = Math.floor(totalSeconds / (minutesPerHour * secondsPerMinute));
    totalSeconds %= minutesPerHour * secondsPerMinute;

    const minutes = Math.floor(totalSeconds / secondsPerMinute);
    const seconds = totalSeconds % secondsPerMinute;

    const parts = [];
    if (days > 0) {
        parts.push(`${days}d`);
    }
    if (hours > 0) {
        parts.push(`${hours}h`);
    }
    if (minutes > 0) {
        parts.push(`${minutes}m`);
    }
    if (seconds > 0 || parts.length === 0) {
        parts.push(`${seconds}s`);
    }
    return parts.join(' ');
}
/**
 * @param {string | undefined} template - The message template.
 * @param {object} context - An object containing key-value pairs for placeholders.
 * @returns {string} The formatted message.
 */
function formatAutomodMessage(template, context) {
    if (!template || typeof template !== 'string' || !context || typeof context !== 'object') {
        return template || '';
    }
    let message = template;
    for (const key in context) {
        if (Object.prototype.hasOwnProperty.call(context, key)) {
            const placeholder = `{${key}}`;
            const escapedPlaceholder = placeholder.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            const regex = new RegExp(escapedPlaceholder, 'g');
            // Using a replacer function ensures the replacement is treated as a literal string,
            // preventing issues with special replacement patterns like `$&`.
            message = message.replace(regex, () => String(context[key]));
        }
    }
    return message;
}
function _resetCheckFlags(pData, checkType, flagData, dependencies) {
    const { playerUtils } = dependencies;
    if (flagData) {
        pData.flags.totalFlags = Math.max(0, (pData.flags.totalFlags || 0) - flagData.count);
        flagData.count = 0;
    }
    pData.automodState[checkType] = { lastActionThreshold: 0, lastActionTimestamp: 0, lastActionedFlagCount: 0 };
    pData.isDirtyForSave = true;
    playerUtils?.debugLog(`[AutoModManager] Reset flags for ${checkType} on ${pData.playerNameTag}.`, pData.playerNameTag, dependencies);
}

/**
 * @param {import('@minecraft/server').Player} player
 * @param {import('../types.js').PlayerAntiCheatData} pData
 * @param {string} actionType
 * @param {import('../types.js').AutoModActionParameters & { flagThresholdInternal?: number }} parameters
 * @param {string} checkType
 * @param {import('../types.js').Dependencies} dependencies
 * @param {import('../types.js').ViolationDetails} [violationDetails]
 * @returns {boolean} True if the action was processed, false otherwise.
 */
function _executeAutomodAction(player, pData, actionType, parameters, checkType, dependencies, violationDetails) {
    const { playerUtils, logManager, config: globalConfig, playerDataManager } = dependencies;

    if (!player.isValid()) {
        playerUtils?.debugLog(`[AutoModManager] Aborted action '${actionType}' for ${pData.playerNameTag} because player became invalid.`, 'SystemWarn', dependencies);
        return false;
    }

    const flagThresholdForRule = parameters.flagThresholdInternal || 0;
    playerUtils?.debugLog(`[AutoModManager] Dispatching action '${actionType}' for ${player?.nameTag} due to ${checkType}. Rule Params: ${JSON.stringify(parameters)}`, player?.nameTag, dependencies);
    let actionProcessed = false;
    let logDetails = '';
    let durationForLog = null;
    let finalTeleportDesc = 'N/A';
    let removedItemCount = 0;
    const flagCount = pData.flags[checkType]?.count || 0;
    const baseMessageContext = {
        playerName: player?.nameTag,
        actionType,
        checkType,
        flagCount,
        flagThreshold: flagThresholdForRule,
        duration: 'N/A',
        itemTypeId: parameters.itemToRemoveTypeId || 'N/A',
        itemQuantity: 0,
        teleportCoordinates: 'N/A'
    };
    const messageTemplate = parameters.messageTemplate || 'AutoMod Default: {actionType} for {checkType} on {playerName} (Flags: {flagCount}/{flagThreshold}).';
    const adminMessageTemplate =
        parameters.adminMessageTemplate ||
        'AutoMod Action: {actionType} on §e{playerName}§r for §b{checkType}§r (Flags: §a{flagCount}/{flagThreshold}§r). Rule Threshold: §a{flagThreshold}§r. Duration: §b{duration}§r. Item: §a{itemTypeId}x{itemQuantity}§r. Coords: §a{teleportCoordinates}§r.';
    switch (actionType) {
        case 'warn': {
            const messageWarn = formatAutomodMessage(messageTemplate, baseMessageContext);
            playerUtils?.warnPlayer(player, messageWarn, dependencies);
            logDetails = `Warned player. Check: ${checkType}. Message: '${messageWarn}'`;
            actionProcessed = true;
            break;
        }
        case 'kick': {
            const kickReason = formatAutomodMessage(messageTemplate, baseMessageContext);
            try {
                player?.kick(kickReason);
                logDetails = `Kicked player. Check: ${checkType}. Reason: '${kickReason}'`;
                actionProcessed = true;
                playerUtils?.playSoundForEvent(player, 'automodActionTaken', dependencies);
            } catch (e) {
                playerUtils?.debugLog(`[AutoModManager CRITICAL] Error kicking player ${player?.nameTag}: ${e.stack || e}`, player?.nameTag, dependencies);
                logDetails = `Failed to kick player ${player?.nameTag}. Check: ${checkType}. Reason: '${kickReason}'. Error: ${e.message}`;
                logManager?.addLog(
                    {
                        actionType: 'errorAutomodKick',
                        adminName: 'AutoMod',
                        targetName: player?.nameTag,
                        reason: kickReason,
                        details: `Error: ${e.message}`,
                        checkType
                    },
                    dependencies
                );
            }
            break;
        }
        case 'tempBan': {
            const durationStringTempBan = parameters?.duration || '5m';
            let parsedDurationMsTempBan = playerUtils?.parseDuration(durationStringTempBan);
            if (parsedDurationMsTempBan === null || (parsedDurationMsTempBan <= 0 && parsedDurationMsTempBan !== Infinity)) {
                playerUtils?.debugLog(`[AutoModManager] Invalid duration string '${durationStringTempBan}' for tempBan on ${player?.nameTag}. Defaulting to 5m.`, player?.nameTag, dependencies);
                parsedDurationMsTempBan = defaultAutomodTempbanDurationMs;
            }
            const friendlyDurationTempBan = formatDuration(parsedDurationMsTempBan);
            const banReasonForStorageTemp = `AutoMod ${checkType} - ${actionType} (${friendlyDurationTempBan})`;
            const banSuccessTemp = playerDataManager?.addBan(player, parsedDurationMsTempBan, banReasonForStorageTemp, 'AutoMod', true, checkType, dependencies);
            if (banSuccessTemp) {
                durationForLog = parsedDurationMsTempBan;
                baseMessageContext.duration = friendlyDurationTempBan;
                const tempBanContext = { ...baseMessageContext, duration: friendlyDurationTempBan };
                const kickMsgTempBan = formatAutomodMessage(messageTemplate, tempBanContext);
                try {
                    player?.kick(kickMsgTempBan);
                    logDetails = `Temp banned player for ${friendlyDurationTempBan}. Check: ${checkType}. Kick Reason: '${kickMsgTempBan}'. Stored Reason: ${banReasonForStorageTemp}`;
                    playerUtils?.playSoundForEvent(player, 'automodActionTaken', dependencies);
                } catch (e) {
                    playerUtils?.debugLog(`[AutoModManager CRITICAL] Error kicking player ${player?.nameTag} after tempBan: ${e.stack || e}`, player?.nameTag, dependencies);
                    logDetails = `Temp banned player (kick failed). Duration: ${friendlyDurationTempBan}, Check: ${checkType}. Stored Reason: ${banReasonForStorageTemp}. Error: ${e.message}`;
                    logManager?.addLog(
                        {
                            actionType: 'errorAutomodKick',
                            adminName: 'AutoMod',
                            targetName: player?.nameTag,
                            reason: kickMsgTempBan,
                            details: `Error: ${e.message}`,
                            checkType
                        },
                        dependencies
                    );
                    playerUtils?.playSoundForEvent(player, 'automodActionTaken', dependencies);
                }
                actionProcessed = true;
            } else {
                playerUtils?.debugLog(`[AutoModManager CRITICAL] Failed to apply tempBan to ${player?.nameTag} via playerDataManager.addBan.`, player?.nameTag, dependencies);
                logDetails = `Failed to apply tempBan. Check: ${checkType}. Reason: ${banReasonForStorageTemp}`;
                logManager?.addLog(
                    {
                        actionType: 'errorAutomodAddBan',
                        adminName: 'AutoMod',
                        targetName: player?.nameTag,
                        reason: banReasonForStorageTemp,
                        details: `Duration: ${parsedDurationMsTempBan}ms`,
                        checkType
                    },
                    dependencies
                );
            }
            break;
        }
        case 'permBan': {
            const permBanContext = { ...baseMessageContext, duration: 'Permanent' };
            const kickMsgPermBan = formatAutomodMessage(messageTemplate, permBanContext);
            const permBanReasonForStorage = `AutoMod ${checkType} - ${actionType} (Permanent)`;
            const banSuccessPerm = playerDataManager?.addBan(player, Infinity, permBanReasonForStorage, 'AutoMod', true, checkType, dependencies);
            if (banSuccessPerm) {
                durationForLog = Infinity;
                baseMessageContext.duration = 'Permanent';
                try {
                    player?.kick(kickMsgPermBan);
                    logDetails = `Permanently banned player. Check: ${checkType}. Kick Reason: '${kickMsgPermBan}'. Stored Reason: ${permBanReasonForStorage}`;
                    playerUtils?.playSoundForEvent(player, 'automodActionTaken', dependencies);
                } catch (e) {
                    playerUtils?.debugLog(`[AutoModManager CRITICAL] Error kicking player ${player?.nameTag} after permBan: ${e.stack || e}`, player?.nameTag, dependencies);
                    logDetails = `Permanently banned player (kick failed). Check: ${checkType}. Stored Reason: ${permBanReasonForStorage}. Error: ${e.message}`;
                    logManager?.addLog(
                        {
                            actionType: 'errorAutomodKick',
                            adminName: 'AutoMod',
                            targetName: player?.nameTag,
                            reason: kickMsgPermBan,
                            details: `Error: ${e.message}`,
                            checkType
                        },
                        dependencies
                    );
                    playerUtils?.playSoundForEvent(player, 'automodActionTaken', dependencies);
                }
                actionProcessed = true;
            } else {
                playerUtils?.debugLog(`[AutoModManager CRITICAL] Failed to apply permBan to ${player?.nameTag} via playerDataManager.addBan.`, player?.nameTag, dependencies);
                logDetails = `Failed to apply permBan. Check: ${checkType}. Reason: ${permBanReasonForStorage}`;
                logManager?.addLog(
                    {
                        actionType: 'errorAutomodAddBan',
                        adminName: 'AutoMod',
                        targetName: player?.nameTag,
                        reason: permBanReasonForStorage,
                        details: 'Duration: Infinity',
                        checkType
                    },
                    dependencies
                );
            }
            break;
        }
        case 'mute': {
            const durationStringMute = parameters?.duration || '10m';
            let parsedDurationMsMute = playerUtils?.parseDuration(durationStringMute);
            if (parsedDurationMsMute === null || (parsedDurationMsMute <= 0 && parsedDurationMsMute !== Infinity)) {
                playerUtils?.debugLog(`[AutoModManager] Invalid duration string '${durationStringMute}' for mute on ${player?.nameTag}. Defaulting to 10m.`, player?.nameTag, dependencies);
                parsedDurationMsMute = defaultAutomodMuteDurationMs;
            }
            const friendlyDurationMute = formatDuration(parsedDurationMsMute);
            const muteReasonForStorage = `AutoMod ${checkType} - ${actionType} (${friendlyDurationMute})`;
            const muteSuccess = playerDataManager?.addMute(player, parsedDurationMsMute, muteReasonForStorage, 'AutoMod', true, checkType, dependencies);
            if (muteSuccess) {
                durationForLog = parsedDurationMsMute;
                baseMessageContext.duration = friendlyDurationMute;
                const muteContext = { ...baseMessageContext, duration: friendlyDurationMute };
                const muteNotificationToPlayer = formatAutomodMessage(messageTemplate, muteContext);
                playerUtils?.warnPlayer(player, muteNotificationToPlayer, dependencies);
                logDetails = `Muted player for ${friendlyDurationMute}. Check: ${checkType}. Reason: ${muteReasonForStorage}. Notification: '${muteNotificationToPlayer}'`;
                actionProcessed = true;
                playerUtils?.playSoundForEvent(player, 'automodActionTaken', dependencies);
            } else {
                playerUtils?.debugLog(`[AutoModManager CRITICAL] Failed to apply mute to ${player?.nameTag} via playerDataManager.addMute.`, player?.nameTag, dependencies);
                logDetails = `Failed to apply mute. Duration: ${durationStringMute}, Check: ${checkType}. Reason: ${muteReasonForStorage}`;
                logManager?.addLog(
                    {
                        actionType: 'errorAutomodAddMute',
                        adminName: 'AutoMod',
                        targetName: player?.nameTag,
                        reason: muteReasonForStorage,
                        details: `Duration: ${parsedDurationMsMute}ms`,
                        checkType
                    },
                    dependencies
                );
            }
            break;
        }
        case 'freezePlayer': {
            const freezeMessage = formatAutomodMessage(messageTemplate, baseMessageContext);
            playerUtils?.warnPlayer(player, freezeMessage, dependencies);
            logDetails = `Player ${player?.nameTag} 'frozen' by AutoMod for ${checkType}. Message: '${freezeMessage}'. (Note: Actual freeze mechanics depend on separate implementation and 'frozenPlayerTag' from config.js).`;
            actionProcessed = true;
            playerUtils?.debugLog(`[AutoModManager] 'freezePlayer' action for ${player?.nameTag} (check: ${checkType}). Player notified.`, player?.nameTag, dependencies);
            if (globalConfig.frozenPlayerTag) {
                player?.addTag(globalConfig.frozenPlayerTag);
            }
            break;
        }
        case 'removeIllegalItem': {
            const itemTypeIdToRemove = parameters?.itemToRemoveTypeId;
            if (!itemTypeIdToRemove) {
                playerUtils?.debugLog(`[AutoModManager] itemToRemoveTypeId not provided for removeIllegalItem on ${player?.nameTag}.`, player?.nameTag, dependencies);
                logDetails = 'itemToRemoveTypeId missing in parameters for removeIllegalItem.';
                actionProcessed = false;
                break;
            }
            try {
                const inventory = player?.getComponent('minecraft:inventory');
                if (!inventory?.container) {
                    playerUtils?.debugLog(`[AutoModManager] Could not get inventory for ${player?.nameTag} for removeIllegalItem.`, player?.nameTag, dependencies);
                    logDetails = 'Failed to get player inventory for removeIllegalItem.';
                    actionProcessed = false;
                    break;
                }
                const container = inventory.container;
                for (let i = 0; i < container.size; i++) {
                    const itemStack = container.getItem(i);
                    if (itemStack?.typeId === itemTypeIdToRemove) {
                        removedItemCount += itemStack.amount;
                        container.setItem(i, undefined);
                    }
                }
                baseMessageContext.itemQuantity = removedItemCount;
                if (removedItemCount > 0) {
                    const removalMessage = formatAutomodMessage(messageTemplate, baseMessageContext);
                    playerUtils?.warnPlayer(player, removalMessage, dependencies);
                    logDetails = `Removed ${removedItemCount}x ${itemTypeIdToRemove} from ${player?.nameTag} (Check: ${checkType}). Message: '${removalMessage}'`;
                } else {
                    logDetails = `No items of type ${itemTypeIdToRemove} found to remove from ${player?.nameTag} (Check: ${checkType}).`;
                }
                actionProcessed = true;
            } catch (e) {
                playerUtils?.debugLog(`[AutoModManager CRITICAL] Error during removeIllegalItem for ${player?.nameTag} (${itemTypeIdToRemove}): ${e.stack || e}`, player?.nameTag, dependencies);
                logDetails = `Error removing item ${itemTypeIdToRemove} from ${player?.nameTag}: ${e.message}`;
                logManager?.addLog(
                    {
                        actionType: 'errorAutomodRemoveItem',
                        adminName: 'AutoMod',
                        targetName: player?.nameTag,
                        reason: `Item: ${itemTypeIdToRemove}`,
                        details: `Error: ${e.message}`,
                        checkType
                    },
                    dependencies
                );
            }
            break;
        }
        case 'teleportSafe': {
            const { world } = dependencies;
            const targetCoordinatesParam = parameters?.coordinates;
            if (!targetCoordinatesParam || typeof targetCoordinatesParam.y !== 'number') {
                playerUtils?.debugLog(`[AutoModManager] Invalid or missing coordinates for teleportSafe on ${player?.nameTag}. Y-coordinate is mandatory.`, player?.nameTag, dependencies);
                logDetails = `Invalid coordinates for teleportSafe. Y-coordinate missing. Check: ${checkType}`;
                actionProcessed = false;
                break;
            }

            let targetDimension = player.dimension;
            const targetDimensionId = targetCoordinatesParam.dimensionId;
            if (targetDimensionId && typeof targetDimensionId === 'string') {
                try {
                    targetDimension = world.getDimension(targetDimensionId);
                } catch (e) {
                    playerUtils?.debugLog(
                        `[AutoModManager] Invalid dimensionId '${targetDimensionId}' specified for teleportSafe. Defaulting to player's current dimension. Error: ${e.message}`,
                        player?.nameTag,
                        dependencies
                    );
                }
            }

            const targetX = targetCoordinatesParam.x ?? player.location.x;
            const targetZ = targetCoordinatesParam.z ?? player.location.z;
            const targetY = targetCoordinatesParam.y;
            const teleportTargetDesc = `X:${targetX.toFixed(1)}, Y:${targetY.toFixed(1)}, Z:${targetZ.toFixed(1)} in ${targetDimension.id}`;
            finalTeleportDesc = teleportTargetDesc;
            const teleportLocation = { x: targetX, y: targetY, z: targetZ };
            try {
                const safeLocation = targetDimension?.findClosestSafeLocation(teleportLocation, {
                    maxHeightDifference: 5,
                    searchDistance: 5
                });
                const locationToTeleport = safeLocation || teleportLocation;
                if (safeLocation) {
                    finalTeleportDesc = `X:${safeLocation.x.toFixed(1)}, Y:${safeLocation.y.toFixed(1)}, Z:${safeLocation.z.toFixed(1)} (near requested ${teleportTargetDesc})`;
                }
                baseMessageContext.teleportCoordinates = finalTeleportDesc;
                const teleportMessage = formatAutomodMessage(messageTemplate, baseMessageContext);
                player?.teleport(locationToTeleport, { dimension: targetDimension });
                playerUtils?.warnPlayer(player, teleportMessage, dependencies);
                logDetails = `Teleported player ${player?.nameTag} to ${finalTeleportDesc}. Check: ${checkType}. Message: '${teleportMessage}'`;
                actionProcessed = true;
            } catch (e) {
                playerUtils?.debugLog(`[AutoModManager CRITICAL] Error teleporting player ${player?.nameTag} for teleportSafe: ${e.stack || e}`, player?.nameTag, dependencies);
                playerUtils?.warnPlayer(player, `Failed to teleport: ${e.message}`, dependencies);
                logDetails = `Failed to teleport player ${player?.nameTag} to ${teleportTargetDesc}. Check: ${checkType}. Error: ${e.message}`;
                logManager?.addLog(
                    {
                        actionType: 'errorAutomodTeleport',
                        adminName: 'AutoMod',
                        targetName: player?.nameTag,
                        reason: `Target: ${teleportTargetDesc}`,
                        details: `Error: ${e.message}`,
                        checkType
                    },
                    dependencies
                );
            }
            break;
        }
        case 'flagOnly': {
            const flagOnlyMessage = formatAutomodMessage(messageTemplate, baseMessageContext);
            logDetails = `flagOnly rule processed for ${player?.nameTag}, check: ${checkType}. Log Message: '${flagOnlyMessage}'`;
            actionProcessed = true;
            break;
        }
    }
    const finalReasonForLog = `automod.${checkType}.${actionType}`;
    if (actionProcessed) {
        logManager?.addLog(
            {
                actionType: `automod${actionType.charAt(0).toUpperCase() + actionType.slice(1)}Taken`,
                adminName: 'AutoMod',
                targetName: player?.nameTag,
                targetId: player?.id,
                duration: durationForLog,
                reason: finalReasonForLog,
                details: logDetails,
                checkType,
                actionParams: { ...parameters, flagCount, ...violationDetails }
            },
            dependencies
        );
        const adminContext = { ...baseMessageContext };
        const finalAdminMessage = formatAutomodMessage(adminMessageTemplate, adminContext);
        if (globalConfig.notifyOnAutoModAction !== false) {
            playerUtils?.notifyAdmins(finalAdminMessage, dependencies, player, pData);
        }
    } else {
        const criticalActions = ['warn', 'kick', 'tempBan', 'permBan', 'mute', 'removeIllegalItem', 'teleportSafe'];
        if (criticalActions.includes(actionType)) {
            playerUtils?.debugLog(
                `[AutoModManager CRITICAL] Action '${actionType}' for ${player?.nameTag} (check: ${checkType}) was not processed successfully. Details: ${logDetails}`,
                player?.nameTag,
                dependencies
            );
            logManager?.addLog(
                {
                    actionType: `errorAutomod${actionType.charAt(0).toUpperCase() + actionType.slice(1)}Processing`,
                    adminName: 'AutoMod',
                    targetName: player?.nameTag,
                    targetId: player?.id,
                    details: logDetails,
                    checkType,
                    actionParams: parameters
                },
                dependencies
            );
        }
    }
    return actionProcessed;
}

/**
 * @param {import('@minecraft/server').Player} player
 * @param {import('../types.js').PlayerAntiCheatData} pData
 * @param {string} checkType
 * @param {import('../types.js').Dependencies} dependencies
 * @param {import('../types.js').ViolationDetails} [violationDetails]
 */
export async function processAutoModActions(player, pData, checkType, dependencies, violationDetails) {
    const { config: globalConfig, playerUtils, automodConfig: moduleAutomodConfig } = dependencies;
    if (!globalConfig?.automod?.enabled) {
        return;
    }

    if (!player.isValid()) {
        playerUtils?.debugLog(`[AutoModManager] Aborted processAutoModActions for ${pData.playerNameTag} because player became invalid.`, 'SystemWarn', dependencies);
        return;
    }

    const ruleSet = moduleAutomodConfig?.automodRuleSets?.find((rs) => rs.checkType === checkType);
    if (!ruleSet || !ruleSet.enabled) {
        return;
    }

    const rulesForCheck = ruleSet.tiers?.slice().sort((a, b) => b.flagThreshold - a.flagThreshold) || [];
    if (rulesForCheck.length === 0) {
        return;
    }

    const flagData = pData?.flags?.[checkType];
    const currentFlags = flagData?.count || 0;
    if (currentFlags === 0) {
        return;
    }

    pData.automodState ??= {};
    pData.automodState[checkType] ??= { lastActionThreshold: 0, lastActionTimestamp: 0, lastActionedFlagCount: 0 };
    const checkState = pData.automodState[checkType];

    // Find the highest-tier rule the player currently qualifies for.
    const applicableRule = rulesForCheck.find((rule) => currentFlags >= rule.flagThreshold);

    if (!applicableRule || applicableRule.flagThreshold <= checkState.lastActionThreshold) {
        playerUtils?.debugLog(
            `[AutoModManager] No new action needed for ${player?.nameTag} for ${checkType}. Current flags: ${currentFlags}, Last action threshold: ${checkState.lastActionThreshold}.`,
            player?.nameTag,
            dependencies
        );
        return;
    }

    if (applicableRule.flagThreshold < checkState.lastActionThreshold) {
        playerUtils?.debugLog(
            `[AutoModManager] Player ${player?.nameTag} qualifies for a lower-tier rule (${applicableRule.flagThreshold}) for ${checkType} after a likely flag reset. Last action was at ${checkState.lastActionThreshold}. Proceeding.`,
            player?.nameTag,
            dependencies
        );
    }

    playerUtils?.debugLog(
        `[AutoModManager] ${player?.nameTag} (flags: ${currentFlags} for ${checkType}) meets threshold ${applicableRule.flagThreshold}. Intended action: ${applicableRule.actionType}`,
        player?.nameTag,
        dependencies
    );
    if (applicableRule.parameters) {
        playerUtils?.debugLog(`[AutoModManager] Action parameters: ${JSON.stringify(applicableRule.parameters)}`, player?.nameTag, dependencies);
    }

    const finalParameters = {
        ...(applicableRule.parameters || {}),
        flagThresholdInternal: applicableRule.flagThreshold
    };
    const actionSuccess = await _executeAutomodAction(player, pData, applicableRule.actionType, finalParameters, checkType, dependencies, violationDetails);

    if (actionSuccess) {
        checkState.lastActionThreshold = applicableRule.flagThreshold;
        checkState.lastActionedFlagCount = currentFlags;
        checkState.lastActionTimestamp = Date.now();
        pData.isDirtyForSave = true;

        if (applicableRule.resetFlagsAfterAction) {
            playerUtils?.debugLog(
                `[AutoModManager] Resetting flags for ${checkType} on ${player?.nameTag} as per rule (Threshold: ${applicableRule.flagThreshold}, Action: ${applicableRule.actionType}).`,
                player?.nameTag,
                dependencies
            );
            _resetCheckFlags(pData, checkType, flagData, dependencies);
        }
    }

    if (ruleSet.resetFlagsAfterSeconds && ruleSet.resetFlagsAfterSeconds > 0) {
        const lastFlagTime = flagData?.lastDetectionTime || 0;
        const now = Date.now();
        if (lastFlagTime > 0 && now - lastFlagTime > ruleSet.resetFlagsAfterSeconds * 1000) {
            if (checkState.lastActionTimestamp <= lastFlagTime || flagData.count === 0) {
                playerUtils?.debugLog(
                    `[AutoModManager] Globally resetting flags for ${checkType} on ${player?.nameTag} due to inactivity (resetAfterSeconds: ${ruleSet.resetFlagsAfterSeconds}).`,
                    player?.nameTag,
                    dependencies
                );
                _resetCheckFlags(pData, checkType, flagData, dependencies);
            }
        }
    }
}
```

#### 1.2. `actionManager.js`

This file handled the immediate consequences of a cheat detection, such as flagging the player, logging the event, and notifying admins. It was the entry point for the `automodManager`.

```javascript
// OldAntiCheatsBP/scripts/core/actionManager.js
const decimalPlacesForViolationDetails = 3;
/**
 * @param {import('../types.js').ViolationDetails | undefined} violationDetails - An object containing details of the violation.
 * @returns {string} A comma-separated string of key-value pairs, or 'N/A'.
 */
function formatViolationDetails(violationDetails) {
    if (!violationDetails || typeof violationDetails !== 'object' || Object.keys(violationDetails).length === 0) {
        return 'N/A';
    }
    return Object.entries(violationDetails)
        .map(([key, value]) => {
            if (typeof value === 'number' && !Number.isInteger(value)) {
                return `${key}: ${value.toFixed(decimalPlacesForViolationDetails)}`;
            }
            return `${key}: ${String(value)}`;
        })
        .join(', ');
}

/**
 * @param {string | undefined} template
 * @param {string} playerName
 * @param {string} checkType
 * @param {import('../types.js').ViolationDetails | undefined} violationDetails
 * @returns {string} The formatted message.
 */
function formatActionMessage(template, playerName, checkType, violationDetails) {
    if (!template) {
        return '';
    }

    const detailsString = formatViolationDetails(violationDetails);

    const replacements = {
        playerName,
        checkType,
        detailsString,
        ...violationDetails
    };

    const performReplacement = (text) => {
        if (typeof text !== 'string') return text;
        return text.replace(/{(\w+)}/g, (placeholder, placeholderKey) => {
            const replacementValue = replacements[placeholderKey];
            if (replacementValue !== undefined) {
                if (typeof replacementValue === 'number' && !Number.isInteger(replacementValue)) {
                    return replacementValue.toFixed(decimalPlacesForViolationDetails);
                }
                return String(replacementValue);
            }
            return placeholder;
        });
    };

    const deepFormat = (data) => {
        if (typeof data === 'string') {
            return performReplacement(data);
        }
        if (Array.isArray(data)) {
            return data.map((item) => deepFormat(item));
        }
        if (typeof data === 'object' && data !== null) {
            const newObj = {};
            for (const key in data) {
                if (Object.prototype.hasOwnProperty.call(data, key)) {
                    newObj[key] = deepFormat(data[key]);
                }
            }
            return newObj;
        }
        return data; // Return numbers, booleans, null, etc. as is
    };

    return deepFormat(template);
}

/**
 * @param {import('@minecraft/server').Player | null} player
 * @param {import('../types.js').ActionProfileEntry} profile
 * @param {string} flagReasonMessage
 * @param {string} checkType
 * @param {import('../types.js').Dependencies} dependencies
 * @param {import('../types.js').ViolationDetails | undefined} [violationDetails]
 * @returns {Promise<void>}
 */
async function _handleFlagging(player, profile, flagReasonMessage, checkType, dependencies, violationDetails) {
    if (!player || !profile.flag) {
        if (!player && profile.flag) {
            dependencies.playerUtils?.debugLog(`[ActionManager] Skipping flagging for checkType '${checkType}' (player is null).`, null, dependencies);
        }
        return;
    }

    const flagType = profile.flag.type || checkType;
    const increment = typeof profile.flag.increment === 'number' ? profile.flag.increment : 1;

    await dependencies.playerDataManager?.addFlag(player, flagType, dependencies, violationDetails, increment);

    dependencies.playerUtils?.debugLog(`[ActionManager] Dispatched flag action for ${player.nameTag} for ${flagType} (x${increment}). Reason: '${flagReasonMessage}'`, player.nameTag, dependencies);
}

function _handleLogging(player, profile, flagReasonMessage, checkType, violationDetails, dependencies) {
    if (!profile.log) return;

    const { logManager } = dependencies;
    const playerNameForLog = player?.nameTag ?? 'System';
    const logActionType = profile.log.actionType || `detected${checkType.charAt(0).toUpperCase() + checkType.slice(1)}`;
    let logDetailsString = profile.log.detailsPrefix || '';
    if (profile.log.includeViolationDetails !== false) {
        logDetailsString += formatViolationDetails(violationDetails);
    }

    logManager?.addLog(
        {
            adminName: 'System',
            actionType: logActionType,
            targetName: playerNameForLog,
            targetId: player?.id,
            details: logDetailsString.trim() || 'N/A',
            reason: flagReasonMessage,
            checkType,
            location: player?.location,
            dimensionId: player?.dimension?.id
        },
        dependencies
    );
}

function _handleAdminNotifications(player, profile, checkType, violationDetails, dependencies) {
    if (!player || !profile.notifyAdmins?.message) {
        return;
    }
    if (!player.isValid()) {
        return;
    }

    const { playerUtils, playerDataManager } = dependencies;
    const notifyMsg = formatActionMessage(profile.notifyAdmins.message, player.nameTag, checkType, violationDetails);
    const pData = playerDataManager?.getPlayerData(player.id);

    playerUtils?.notifyAdmins(notifyMsg, dependencies, player, pData);
}

function _handleViolationDetailsStorage(player, checkType, violationDetails, dependencies) {
    if (!player || !violationDetails || Object.keys(violationDetails).length === 0) {
        if (!player && violationDetails && Object.keys(violationDetails).length > 0) {
            dependencies.playerUtils?.debugLog(`[ActionManager] Skipping violation details storage for '${checkType}' (player is null).`, null, dependencies);
        }
        return;
    }

    if (!player.isValid()) {
        dependencies.playerUtils?.debugLog(`[ActionManager] Player became invalid before storing violation details. Skipping for check '${checkType}'.`, null, dependencies);
        return;
    }

    const { playerDataManager, playerUtils } = dependencies;
    const currentPData = playerDataManager?.getPlayerData(player.id);
    if (currentPData) {
        currentPData.lastViolationDetailsMap ??= {};
        const detailsToStore = {
            timestamp: Date.now(),
            details: formatViolationDetails(violationDetails),
            ...(violationDetails.itemTypeId && { itemTypeId: violationDetails.itemTypeId }),
            ...(typeof violationDetails.quantityFound === 'number' && { quantityFound: violationDetails.quantityFound })
        };
        currentPData.lastViolationDetailsMap[checkType] = detailsToStore;
        currentPData.isDirtyForSave = true;
        playerUtils?.debugLog(
            `[ActionManager] Stored violation details for check '${checkType}' for ${currentPData.playerNameTag}: ${JSON.stringify(detailsToStore)}`,
            currentPData.playerNameTag,
            dependencies
        );
    } else {
        playerUtils?.debugLog(`[ActionManager] Could not store violation details for '${checkType}' (pData not found for player).`, null, dependencies);
    }
}

export async function executeCheckAction(player, checkType, violationDetails, dependencies) {
    const { playerUtils, checkActionProfiles } = dependencies;
    const playerNameForLog = player?.name ?? 'System';

    const profile = checkActionProfiles[checkType];
    if (!profile) {
        playerUtils?.debugLog(`[ActionManager] No action profile for checkType: '${checkType}'.`, null, dependencies);
        return;
    }

    const baseReasonTemplate = profile.flag?.reason || `Triggered ${checkType}`;
    const flagReasonMessage = formatActionMessage(baseReasonTemplate, playerNameForLog, checkType, violationDetails);

    await _handleFlagging(player, profile, flagReasonMessage, checkType, dependencies, violationDetails);

    // After any await, the player object might have become invalid. Check before proceeding.
    if (player && !player.isValid()) {
        playerUtils?.debugLog(`[ActionManager] Player ${playerNameForLog} became invalid after flagging. Aborting further actions for check '${checkType}'.`, null, dependencies);
        return;
    }

    _handleLogging(player, profile, flagReasonMessage, checkType, violationDetails, dependencies);
    _handleAdminNotifications(player, profile, checkType, violationDetails, dependencies);
    _handleViolationDetailsStorage(player, checkType, violationDetails, dependencies);

    // Deprecated Punishment System (2024-07-29): The punishment logic has been centralized in automodManager.
    // The old system of defining `punishment` and `minVlbeforePunishment` directly in the `config.js` `checks` object
    // is now obsolete. All automated actions should be configured in `automodConfig.js`.
    // This ensures a single, consistent, and tiered response system.
}
```

#### 1.3. Other Missing Core Scripts

The following core script files are also missing, indicating a significant loss of functionality:

- `automodConfig.js`
- `chatProcessor.js`
- `commandManager.js`
- `configMigration.js`
- `configValidator.js`
- `dependencies.js`
- `dynamicCommandLoader.js`
- `eventHandlers.js`
- `initializationManager.js`
- `kits.js`
- `logManager.js`
- `offlineBanList.js`
- `startupLogger.js`
- `textDatabase.js`

### 2. Cheat Detections

The vast majority of cheat detection scripts have been removed. The `OldAntiCheatsBP/scripts/modules/detections/` directory contained over 40 detection files, while the new addon has only one.

#### 2.1. Example: `flyCheck.js`

This script detected players who were flying or hovering without legitimate means (e.g., creative mode, elytra).

```javascript
// OldAntiCheatsBP/scripts/modules/detections/movement/flyCheck.js
/**
 * @typedef {import('../../types.js').PlayerAntiCheatData} PlayerAntiCheatData
 * @typedef {import('../../types.js').Dependencies} Dependencies
 */

/**
 * Checks for fly-related hacks by analyzing player's vertical movement, airborne state,
 * and active effects (expected to be pre-processed into `pData`).
 *
 * It bypasses checks if the player is legitimately flying (Creative/Spectator mode) or gliding with elytra.
 * Assumes `pData` contains fields like `jumpBoostAmplifier`, `hasSlowFalling`, `hasLevitation`,
 * `lastUsedElytraTick`, `lastTookDamageTick`, which should be updated by `updateTransientPlayerData`
 * or relevant event handlers.
 * @async
 * @param {import('@minecraft/server').Player} player - The player instance to check.
 * @param {PlayerAntiCheatData} pData - Player-specific anti-cheat data.
 * @param {Dependencies} dependencies - Object containing shared dependencies.
 * @returns {Promise<void>}
 */
export async function checkFly(player, pData, dependencies) {
    const { config, playerUtils, actionManager, currentTick } = dependencies;
    const playerName = player?.name ?? 'UnknownPlayer';

    if (!config?.enableFlyCheck && !config?.enableHighYVelocityCheck) {
        return;
    }
    if (!pData) {
        playerUtils?.debugLog(`[FlyCheck] Skipping for ${playerName}: pData is null.`, playerName, dependencies);
        return;
    }

    const watchedPlayerName = pData.isWatched ? playerName : null;

    if (player.isGliding) {
        pData.lastUsedElytraTick = currentTick;
        pData.isDirtyForSave = true;
        playerUtils?.debugLog(`[FlyCheck] ${playerName} is gliding. Standard fly checks bypassed.`, watchedPlayerName, dependencies);
        return;
    }
    if (player.isFlying) {
        playerUtils?.debugLog(`[FlyCheck] ${playerName} is legitimately flying (isFlying=true). Standard fly checks bypassed.`, watchedPlayerName, dependencies);
        return;
    }

    if (config?.enableHighYVelocityCheck && !pData.hasLevitation) {
        const currentYVelocity = pData.transient.lastVelocity?.y ?? 0;
        const jumpBoostAmplifierValue = pData.jumpBoostAmplifier ?? 0;
        const jumpBoostBonus = jumpBoostAmplifierValue * (config?.jumpBoostYVelocityBonus ?? 0.2);
        const baseYVelocityPositive = config?.maxYVelocityPositive ?? 0.42;
        const effectiveMaxYVelocity = baseYVelocityPositive + jumpBoostBonus;

        if (pData.isWatched) {
            playerUtils?.debugLog(
                `[FlyCheck][Y-Velo] ${playerName}: CurrentYVelo: ${currentYVelocity.toFixed(3)}, BaseMax: ${baseYVelocityPositive.toFixed(3)}, JumpBoostLvl: ${jumpBoostAmplifierValue}, JumpBoostBonus: ${jumpBoostBonus.toFixed(3)}, EffectiveMax: ${effectiveMaxYVelocity.toFixed(3)}`,
                watchedPlayerName,
                dependencies
            );
        }

        const ticksSinceLastDamage = currentTick - (pData.lastTookDamageTick ?? -Infinity);
        const ticksSinceLastElytra = currentTick - (pData.lastUsedElytraTick ?? -Infinity);
        const ticksSinceLastOnSlime = currentTick - (pData.lastOnSlimeBlockTick ?? -Infinity);
        const ticksSinceLastLaunch = currentTick - (pData.transient?.lastLaunchTick ?? -Infinity);
        const graceTicks = config?.yVelocityGraceTicks ?? 10;

        const underGraceCondition =
            ticksSinceLastDamage <= graceTicks ||
            ticksSinceLastElytra <= graceTicks ||
            ticksSinceLastOnSlime <= graceTicks ||
            ticksSinceLastLaunch <= graceTicks ||
            player.isClimbing ||
            (pData.hasSlowFalling && currentYVelocity < 0);

        if (underGraceCondition && pData.isWatched) {
            const graceReasons = [];
            if (ticksSinceLastDamage <= graceTicks) {
                graceReasons.push(`recent damage (${ticksSinceLastDamage}t)`);
            }
            if (ticksSinceLastElytra <= graceTicks) {
                graceReasons.push(`recent elytra (${ticksSinceLastElytra}t)`);
            }
            if (ticksSinceLastOnSlime <= graceTicks) {
                graceReasons.push(`recent slime block (${ticksSinceLastOnSlime}t)`);
            }
            if (ticksSinceLastLaunch <= graceTicks) {
                graceReasons.push(`recent launch item (${ticksSinceLastLaunch}t)`);
            }
            if (player.isClimbing) {
                graceReasons.push('climbing');
            }
            if (pData.hasSlowFalling && currentYVelocity < 0) {
                graceReasons.push('slow falling downwards');
            }
            playerUtils?.debugLog(`[FlyCheck][Y-Velo] ${playerName}: Y-velocity check grace due to: ${graceReasons.join(', ')}.`, watchedPlayerName, dependencies);
        }

        if (currentYVelocity > effectiveMaxYVelocity && !underGraceCondition) {
            const violationDetails = {
                yVelocity: currentYVelocity.toFixed(3),
                effectiveMaxYVelocity: effectiveMaxYVelocity.toFixed(3),
                jumpBoostLevel: (pData.jumpBoostAmplifier ?? 0).toString(),
                onGround: player.isOnGround.toString(),
                gracePeriodActive: underGraceCondition.toString(),
                ticksSinceDamage: ticksSinceLastDamage > graceTicks ? 'N/A' : ticksSinceLastDamage.toString(),
                ticksSinceElytra: ticksSinceLastElytra > graceTicks ? 'N/A' : ticksSinceLastElytra.toString(),
                isClimbing: player.isClimbing.toString(),
                hasSlowFalling: (pData.hasSlowFalling ?? false).toString(),
                hasLevitation: (pData.hasLevitation ?? false).toString()
            };
            const highYVelocityActionProfileKey = config?.highYVelocityActionProfileName ?? 'movementHighYVelocity';
            await actionManager?.executeCheckAction(player, highYVelocityActionProfileKey, violationDetails, dependencies);
            playerUtils?.debugLog(`[FlyCheck][Y-Velo] Flagged ${playerName}. Velo: ${currentYVelocity.toFixed(3)}, Max: ${effectiveMaxYVelocity.toFixed(3)}`, watchedPlayerName, dependencies);
        }
    }

    if (!config?.enableFlyCheck) {
        return;
    }

    if (pData.hasLevitation && (pData.transient.lastVelocity?.y ?? 0) > 0) {
        playerUtils?.debugLog(`[FlyCheck] ${playerName} allowing upward movement due to levitation. VSpeed: ${(pData.transient.lastVelocity?.y ?? 0).toFixed(2)}`, watchedPlayerName, dependencies);
        return;
    }
    if (pData.hasSlowFalling && (pData.transient.lastVelocity?.y ?? 0) < 0) {
        playerUtils?.debugLog(
            `[FlyCheck] ${playerName} noting slow descent due to Slow Falling. VSpeed: ${(pData.transient.lastVelocity?.y ?? 0).toFixed(2)}. Hover/Sustained checks might still apply if not actually falling significantly.`,
            watchedPlayerName,
            dependencies
        );
        // Don't return yet, as hovering with slow fall might still be an issue if not losing altitude.
    }

    const verticalSpeed = pData.transient.lastVelocity?.y ?? 0;
    if (pData.isWatched) {
        playerUtils?.debugLog(
            `[FlyCheck] Processing Sustained/Hover for ${playerName}. VSpeed=${verticalSpeed.toFixed(3)}, OffGroundTicks=${pData.transient.ticksSinceLastOnGround}, FallDist=${pData.fallDistance?.toFixed(2)}`,
            watchedPlayerName,
            dependencies
        );
    }

    const sustainedThreshold = config?.flySustainedVerticalSpeedThreshold ?? 0.45;
    const sustainedTicks = config?.flySustainedOffGroundTicksThreshold ?? 10;

    if (!player.isOnGround && verticalSpeed > sustainedThreshold && !player.isClimbing && !pData.hasLevitation && !player.isInWater) {
        if (pData.transient.ticksSinceLastOnGround > sustainedTicks) {
            const violationDetails = {
                type: 'sustainedVertical',
                verticalSpeed: verticalSpeed.toFixed(3),
                offGroundTicks: (pData.transient.ticksSinceLastOnGround ?? 0).toString(),
                isClimbing: player.isClimbing.toString(),
                isInWater: player.isInWater.toString(),
                hasLevitation: (pData.hasLevitation ?? false).toString()
            };
            const sustainedFlyActionProfileKey = config?.sustainedFlyActionProfileName ?? 'movementSustainedFly';
            await actionManager?.executeCheckAction(player, sustainedFlyActionProfileKey, violationDetails, dependencies);
            playerUtils?.debugLog(
                `[FlyCheck][Sustained] Flagged ${playerName}. VSpeed: ${verticalSpeed.toFixed(3)}, OffGround: ${pData.transient.ticksSinceLastOnGround}t`,
                watchedPlayerName,
                dependencies
            );
        }
    }

    const hoverVSpeedThreshold = config?.flyHoverVerticalSpeedThreshold ?? 0.08;
    let hoverOffGroundTicks = config?.flyHoverOffGroundTicksThreshold ?? 20;
    let hoverMaxFallDist = config?.flyHoverMaxFallDistanceThreshold ?? 1.0;

    if (pData.hasSlowFalling) {
        hoverMaxFallDist *= 1.5;
        // Players with slow falling can hover very easily. We apply a stricter (lower) tick count to catch this.
        hoverOffGroundTicks = config?.flyHoverOffGroundTicksSlowFalling ?? Math.floor(hoverOffGroundTicks / 2);
    }

    // Check for hover/low-gravity movement
    const isHoverCandidate =
        !player.isOnGround &&
        Math.abs(verticalSpeed) < hoverVSpeedThreshold &&
        (pData.transient.ticksSinceLastOnGround ?? 0) > hoverOffGroundTicks &&
        (pData.fallDistance ?? 0) < hoverMaxFallDist &&
        !player.isClimbing &&
        !player.isInWater &&
        !pData.hasLevitation &&
        !(pData.hasSlowFalling && verticalSpeed < (config.flyHoverSlowFallingMinVSpeed ?? -0.01));

    if (isHoverCandidate) {
        // The original height check was flawed as it didn't account for players walking off ledges.
        // The isHoverCandidate conditions (especially ticksSinceLastOnGround) are robust enough to
        // prevent false positives from normal jumping, making the height check redundant and buggy.
        const violationDetails = {
            type: 'flyHover',
            verticalSpeed: verticalSpeed.toFixed(3),
            offGroundTicks: (pData.transient.ticksSinceLastOnGround ?? 0).toString(),
            fallDistance: (pData.fallDistance ?? 0).toFixed(2),
            isClimbing: player.isClimbing.toString(),
            isInWater: player.isInWater.toString(),
            hasLevitation: (pData.hasLevitation ?? false).toString(),
            hasSlowFalling: (pData.hasSlowFalling ?? false).toString()
        };
        const hoverFlyActionProfileKey = config?.hoverFlyActionProfileName ?? 'movementFlyHover';
        await actionManager?.executeCheckAction(player, hoverFlyActionProfileKey, violationDetails, dependencies);
        playerUtils?.debugLog(
            `[FlyCheck][Hover] Flagged ${playerName}. VSpeed: ${verticalSpeed.toFixed(3)}, OffGround: ${pData.transient.ticksSinceLastOnGround}t, FallDist: ${pData.fallDistance?.toFixed(2)}`,
            watchedPlayerName,
            dependencies
        );
    }
}
```

### 3. Functions

The old addon used an `.mcfunction` file for initialization.

#### 3.1. `ac.mcfunction`

This file was likely called on world load to initialize the script events.

```mcfunction
# OldAntiCheatsBP/functions/ac.mcfunction
scriptevent ac:init
```

## Resource Pack (`OldAntiCheatsRP`)

### 1. UI Files

The entire user interface for the anti-cheat system is missing.

#### 1.1. `anticheat_panel.json`

This file defined the main anti-cheat panel UI.

```json
// OldAntiCheatsRP/ui/anticheat_panel.json
{
    "namespace": "anticheat_panel",
    "main_panel": {
        "type": "panel",
        "size": ["100%", "100%"],
        "controls": [
            {
                "button@common.button": {
                    "size": [100, 20],
                    "offset": [0, 0],
                    "$pressed_button_name": "button_1",
                    "bindings": [
                        {
                            "binding_type": "view",
                            "source_property_name": "(not @is_hover)",
                            "target_property_name": "#visible"
                        }
                    ]
                }
            },
            {
                "hover_button@common.button": {
                    "size": [100, 20],
                    "offset": [0, 0],
                    "$pressed_button_name": "button_1",
                    "bindings": [
                        {
                            "binding_type": "view",
                            "source_property_name": "@is_hover",
                            "target_property_name": "#visible"
                        }
                    ],
                    "anim_type": "color_cycle",
                    "initial_color": [0.8, 0.8, 0.8],
                    "final_color": [1, 1, 1],
                    "duration": 0.5,
                    "easing": "linear"
                }
            }
        ]
    }
}
```

#### 1.2. `anticheat_section.json`

This file defined the anti-cheat settings section in the world settings UI.

```json
// OldAntiCheatsRP/ui/settings_sections/anticheat_section.json
{
    "anticheat_section": {
        "type": "panel",
        "size": ["100%", "100%cm"],
        "controls": [
            {
                "title@world_section.level_seed_selector": {
                    "type": "label",
                    "text": "AntiCheats Settings",
                    "color": [0.6, 0.6, 0.6],
                    "anchor_from": "top_left",
                    "anchor_to": "top_left",
                    "offset": [0, 0]
                }
            }
        ]
    }
}
```

### 2. Font Files

The custom font used in the old UI is missing.

- `font/Roboto-Regular.ttf`
- `font/glyph_size.json`

---

# Addon Development Checklist

This file tracks features that have been discussed but not yet implemented. This can be used to maintain context between development sessions.

## 3. Dimension Lockdown Commands

- [ ] **`!endlock` command:** Create a command for admins to prevent players from entering the End dimension.
- [ ] **`!netherlock` command:** Create a command for admins to prevent players from entering the Nether dimension.
- [ ] **Mechanism:** This will likely involve checking a player's location when they change dimensions and teleporting them back if the corresponding lockdown is active.

## 5. Missing Player Management Panel Features

- [ ] **View Detailed Flags:** Add a button to show a player's specific anti-cheat violation counts.
- [ ] **Reset Player Flags:** Add a button to reset a player's flags to zero.
- [ ] **Toggle Watch:** Add a button to add/remove a player from a "watch list" for easier monitoring.

## 6. Other Missing Commands

- [ ] `inspect`: A text-based command to get detailed player information.
- [ ] `myflags`: A command for players to check their own flag count.
- [ ] `listranks`: A command to list all configured ranks.
- [ ] `listwatched`: A command to list all players on the watch list.
- [ ] `purgeflags`: A command to wipe a player's flag data.
- [ ] `worldborder`: A command/system to manage the world border.
