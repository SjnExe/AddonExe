import { getLandClaimConfig } from '@core/config/configurations.js';
import { getBalance } from '@core/data/playerDataManager.js';
import { formatCurrency } from '@core/utils/economy.js';
import {
  claimChunk,
  claimRadius,
  getClaimAt,
  getClaimsByPlayer,
  getMaxClaimsForPlayer,
  showChunkBoundaries,
  toChunkCoord,
  trustPlayer,
  unclaimAll,
  unclaimChunk,
  untrustPlayer,
  updateClaimFlags,
} from '@features/essentials/protection/landclaim/manager.js';
import type { LandClaim } from '@features/essentials/protection/landclaim/types.js';
import { isDefined, isNonEmptyString } from '@lib/guards.js';
import * as mc from '@minecraft/server';
import { ActionFormBuilder } from '@ui/builders/actionFormBuilder.js';
import { CustomFormBuilder } from '@ui/builders/customFormBuilder.js';
import { showConfirmationDialog } from '@ui/components.js';

/**
 * Displays the main Land Claim dashboard form to a player.
 *
 * @param player The player viewing the panel.
 * @param context Optional caller context for breadcrumb navigation.
 */
export async function showLandClaimPanel(player: mc.Player, context?: Record<string, unknown>): Promise<void> {
  if (!player.isValid) {
    return;
  }

  const cx = toChunkCoord(player.location.x);
  const cz = toChunkCoord(player.location.z);
  const dimId = player.dimension.id;
  const currentClaim = getClaimAt(player.location, dimId);
  const myClaims = getClaimsByPlayer(player.id);
  const maxClaims = getMaxClaimsForPlayer(player);
  const config = getLandClaimConfig();
  const chunkCost = Number(config.claimCost) || 0;
  const balance = getBalance(player.id) ?? 0;

  const statusText = isDefined(currentClaim)
    ? currentClaim.ownerId === player.id
      ? '§aClaimed by you'
      : `§cClaimed by ${currentClaim.ownerName}`
    : '§7Wilderness (Unclaimed)';

  const costDisplay = chunkCost > 0 ? formatCurrency(chunkCost) : 'Free';

  const form = new ActionFormBuilder()
    .title('§l§2Land Claim§r')
    .body(
      `§7Current Chunk: §e[${cx}, ${cz}] §7(16x16 blocks)\n` +
        `§7Status: ${statusText}\n` +
        `§7Your Claims: §a${myClaims.length}§7/§e${maxClaims} chunks§r\n` +
        `§7Price per Chunk: §e${costDisplay} §7| Balance: §a${formatCurrency(balance)}§r`,
    );

  if (!isDefined(currentClaim)) {
    const claimBtnText = chunkCost > 0 ? `Claim Current Chunk (${costDisplay})` : 'Claim Current Chunk (Free)';
    form.button(claimBtnText, 'textures/ui/color_plus', async () => {
      if (!player.isValid) {
        return;
      }
      const res = claimChunk(player, cx, cz);
      player.sendMessage(res.message);
      await showLandClaimPanel(player, context);
    });
  } else if (currentClaim.ownerId === player.id) {
    form.button('Unclaim Current Chunk', 'textures/ui/cancel', async () => {
      if (!player.isValid) {
        return;
      }
      const res = unclaimChunk(player, cx, cz);
      player.sendMessage(res.message);
      await showLandClaimPanel(player, context);
    });
  }

  // Show 3x3 area claim option if current chunk is unclaimed or already owned by the player
  if (!isDefined(currentClaim) || currentClaim.ownerId === player.id) {
    const radiusCostEstimate = chunkCost > 0 ? ` (up to ${formatCurrency(chunkCost * 9)})` : ' (Free)';
    form.button(`Claim 3x3 Area${radiusCostEstimate}`, 'textures/ui/icon_recipe_nature', async () => {
      if (!player.isValid) {
        return;
      }
      await showConfirmationDialog(player, {
        title: 'Claim 3x3 Chunk Area',
        body:
          `This will attempt to claim up to 9 chunks centered on your current position.\n\n` +
          `• Cost: ${costDisplay} per chunk\n` +
          `• Your Balance: ${formatCurrency(balance)}\n` +
          `• Claim Limit: ${myClaims.length}/${maxClaims} chunks\n\n` +
          `Any chunks already claimed by other players or in protected zones will be safely skipped.`,
        onConfirm: async () => {
          if (!player.isValid) {
            return;
          }
          const res = claimRadius(player, 1);
          player.sendMessage(res.message);
          await showLandClaimPanel(player, context);
        },
      });
    });
  }

  form.button('Show Chunk Boundaries', 'textures/ui/magnifyingGlass', async () => {
    if (!player.isValid) {
      return;
    }
    showChunkBoundaries(player);
  });

  form.button('My Claims List', 'textures/ui/world_glyph', async () => {
    if (!player.isValid) {
      return;
    }
    await showMyClaimsPanel(player, context);
  });

  form.button('Trust Management', 'textures/ui/permissions_member_star', async () => {
    if (!player.isValid) {
      return;
    }
    await showTrustManagementPanel(player, context);
  });

  if (isDefined(currentClaim) && currentClaim.ownerId === player.id) {
    form.button('Claim Settings / Flags', 'textures/ui/gear', async () => {
      if (!player.isValid) {
        return;
      }
      await showClaimFlagsPanel(player, currentClaim, context);
    });
  }

  if (myClaims.length > 0) {
    form.button('§cUnclaim All Claims', 'textures/ui/cancel', async () => {
      if (!player.isValid) {
        return;
      }
      await showConfirmationDialog(player, {
        title: 'Unclaim All Land',
        body: `Are you sure you want to unclaim all ${myClaims.length} of your chunks? This cannot be undone.`,
        onConfirm: async () => {
          if (!player.isValid) {
            return;
          }
          const res = unclaimAll(player);
          player.sendMessage(res.message);
          await showLandClaimPanel(player, context);
        },
      });
    });
  }

  await form.show(player);
}

/**
 * Displays a list of all claims owned by the player with navigation buttons.
 *
 * @param player The player viewing their claims.
 * @param context Optional caller context for breadcrumb navigation.
 */
export async function showMyClaimsPanel(player: mc.Player, context?: Record<string, unknown>): Promise<void> {
  if (!player.isValid) {
    return;
  }

  const myClaims = getClaimsByPlayer(player.id);
  const maxClaims = getMaxClaimsForPlayer(player);

  const form = new ActionFormBuilder()
    .title('§l§2My Claims§r')
    .body(`§7You own §a${myClaims.length}§7 of §e${maxClaims}§7 maximum chunks:`);

  for (const claim of myClaims) {
    const dimShort = claim.dimension.replace('minecraft:', '');
    form.button(`[${claim.chunkX}, ${claim.chunkZ}] (${dimShort})`, 'textures/ui/world_glyph', async () => {
      if (!player.isValid) {
        return;
      }
      await showClaimDetailPanel(player, claim, context);
    });
  }

  form.button('§8« Back', 'textures/ui/arrow_left', async () => {
    if (!player.isValid) {
      return;
    }
    await showLandClaimPanel(player, context);
  });

  await form.show(player);
}

/**
 * Displays details for a single claim, including coordinates, dimension, flags, and management buttons.
 *
 * @param player The player viewing the claim.
 * @param claim The claim record.
 * @param context Optional caller context for breadcrumb navigation.
 */
export async function showClaimDetailPanel(
  player: mc.Player,
  claim: LandClaim,
  context?: Record<string, unknown>,
): Promise<void> {
  if (!player.isValid) {
    return;
  }

  const dimShort = claim.dimension.replace('minecraft:', '');
  const form = new ActionFormBuilder()
    .title(`§lClaim [${claim.chunkX}, ${claim.chunkZ}]§r`)
    .body(
      `§7Dimension: §f${dimShort}\n` +
        `§7Claimed: §f${new Date(claim.claimedAt).toLocaleString()}\n` +
        `§7Trusted Players: §e${claim.trusted.length > 0 ? claim.trusted.map((t) => t.name).join(', ') : 'None'}\n` +
        `§7PvP Allowed: §f${claim.flags.allowPvP ? 'Yes' : 'No'}\n` +
        `§7Explosions: §f${claim.flags.allowExplosions ? 'Yes' : 'No'}\n` +
        `§7Visitor Interact: §f${claim.flags.allowInteract ? 'Yes' : 'No'}\n` +
        `§7Visitor Containers: §f${claim.flags.allowContainers ? 'Yes' : 'No'}`,
    )
    .button('Edit Claim Flags', 'textures/ui/gear', async () => {
      if (!player.isValid) {
        return;
      }
      await showClaimFlagsPanel(player, claim, context);
    })
    .button('§cUnclaim Chunk', 'textures/ui/cancel', async () => {
      if (!player.isValid) {
        return;
      }
      const res = unclaimChunk(player, claim.chunkX, claim.chunkZ, claim.dimension);
      player.sendMessage(res.message);
      await showMyClaimsPanel(player, context);
    })
    .button('§8« Back', 'textures/ui/arrow_left', async () => {
      if (!player.isValid) {
        return;
      }
      await showMyClaimsPanel(player, context);
    });

  await form.show(player);
}

/**
 * Displays the trust management menu showing all currently trusted players with untrust actions.
 *
 * @param player The claim owner.
 * @param context Optional caller context for breadcrumb navigation.
 */
export async function showTrustManagementPanel(player: mc.Player, context?: Record<string, unknown>): Promise<void> {
  if (!player.isValid) {
    return;
  }

  const myClaims = getClaimsByPlayer(player.id);
  const trustedMap = new Map<string, string>(); // id -> display name
  for (const c of myClaims) {
    for (const t of c.trusted) {
      trustedMap.set(t.id, t.name);
    }
  }

  const form = new ActionFormBuilder()
    .title('§l§2Trust Management§r')
    .body(
      `§7Trusted players can build, break, and interact inside your claims.\nCurrently trusted: §e${trustedMap.size}§7 specific player(s).\n\n` +
        `§7Tip: You can also enable §aTrust All Friends§7 and §aTrust All Team Members§7 in Claim Flags.`,
    )
    .button('Trust New Player', 'textures/ui/permissions_member_star', async () => {
      if (!player.isValid) {
        return;
      }
      await showAddTrustModal(player, context);
    });

  if (trustedMap.size > 0) {
    for (const [id, name] of trustedMap.entries()) {
      form.button(`Untrust ${name}`, 'textures/ui/permissions_visitor_hand', async () => {
        if (!player.isValid) {
          return;
        }
        const res = untrustPlayer(player, id);
        player.sendMessage(res.message);
        await showTrustManagementPanel(player, context);
      });
    }
  }

  form.button('§8« Back', 'textures/ui/arrow_left', async () => {
    if (!player.isValid) {
      return;
    }
    await showLandClaimPanel(player, context);
  });

  await form.show(player);
}

/**
 * Opens a modal dialog prompting the player for a gamertag to add to their trusted list.
 *
 * @param player The claim owner.
 * @param context Optional caller context for breadcrumb navigation.
 */
async function showAddTrustModal(player: mc.Player, context?: Record<string, unknown>): Promise<void> {
  if (!player.isValid) {
    return;
  }

  const form = new CustomFormBuilder<{ targetName: string }>('Trust a Player')
    .textField('targetName', 'Player Name', 'Enter exact player name', '')
    .submitButton('Trust Player');

  const res = await form.show(player);
  if (!player.isValid) {
    return;
  }
  if (isDefined(res) && isNonEmptyString(res.targetName)) {
    const actionRes = trustPlayer(player, res.targetName);
    player.sendMessage(actionRes.message);
  }
  await showTrustManagementPanel(player, context);
}

/**
 * Opens a modal dialog allowing the claim owner to configure PvP, explosion, interact, and container flags.
 *
 * @param player The claim owner.
 * @param claim The claim being modified.
 * @param context Optional caller context for breadcrumb navigation.
 */
export async function showClaimFlagsPanel(
  player: mc.Player,
  claim: LandClaim,
  context?: Record<string, unknown>,
): Promise<void> {
  if (!player.isValid) {
    return;
  }

  const form = new CustomFormBuilder<{
    trustTeam: boolean;
    trustFriends: boolean;
    allowPvP: boolean;
    allowExplosions: boolean;
    allowInteract: boolean;
    allowContainers: boolean;
  }>(`Flags: [${claim.chunkX}, ${claim.chunkZ}]`)
    .toggle('trustTeam', 'Trust All Team Members (build/break)', Boolean(claim.flags.trustTeam))
    .toggle('trustFriends', 'Trust All Friends (build/break)', Boolean(claim.flags.trustFriends))
    .toggle('allowPvP', 'Allow PvP inside claim', Boolean(claim.flags.allowPvP))
    .toggle('allowExplosions', 'Allow Explosions inside claim', Boolean(claim.flags.allowExplosions))
    .toggle('allowInteract', 'Allow Visitors to Interact (Doors/Levers)', Boolean(claim.flags.allowInteract))
    .toggle('allowContainers', 'Allow Visitors to Open Containers', Boolean(claim.flags.allowContainers))
    .submitButton('Save Flags');

  const res = await form.show(player);
  if (!player.isValid) {
    return;
  }
  if (isDefined(res)) {
    const success = updateClaimFlags(player, claim.id, {
      trustTeam: res.trustTeam,
      trustFriends: res.trustFriends,
      allowPvP: res.allowPvP,
      allowExplosions: res.allowExplosions,
      allowInteract: res.allowInteract,
      allowContainers: res.allowContainers,
    });
    if (success) {
      player.sendMessage('§aClaim settings successfully updated.');
    } else {
      player.sendMessage('§cYou are not authorized to modify flags for this claim.');
    }
  }
  await showClaimDetailPanel(player, claim, context);
}
