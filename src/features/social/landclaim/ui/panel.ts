import {
  claimChunk,
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
} from '@features/social/landclaim/manager.js';
import type { LandClaim } from '@features/social/landclaim/types.js';
import { isDefined, isNonEmptyString } from '@lib/guards.js';
import * as mc from '@minecraft/server';
import { ActionFormBuilder } from '@ui/builders/actionFormBuilder.js';
import { CustomFormBuilder } from '@ui/builders/customFormBuilder.js';
import { showConfirmationDialog } from '@ui/components.js';

export async function showLandClaimPanel(player: mc.Player, context?: Record<string, unknown>): Promise<void> {
  const cx = toChunkCoord(player.location.x);
  const cz = toChunkCoord(player.location.z);
  const dimId = player.dimension.id;
  const currentClaim = getClaimAt(player.location, dimId);
  const myClaims = getClaimsByPlayer(player.id);
  const maxClaims = getMaxClaimsForPlayer(player);

  const statusText = isDefined(currentClaim)
    ? currentClaim.ownerId === player.id
      ? '§aClaimed by you'
      : `§cClaimed by ${currentClaim.ownerName}`
    : '§7Wilderness (Unclaimed)';

  const form = new ActionFormBuilder()
    .title('§l§2Land Claim§r')
    .body(
      `§7Current Chunk: §e[${cx}, ${cz}]\n` +
        `§7Status: ${statusText}\n` +
        `§7Your Claims: §a${myClaims.length}§7/§e${maxClaims}§r`,
    );

  if (!isDefined(currentClaim)) {
    form.button('Claim Current Chunk', 'textures/ui/color_plus', async () => {
      const res = claimChunk(player, cx, cz);
      player.sendMessage(res.message);
      await showLandClaimPanel(player, context);
    });
  } else if (currentClaim.ownerId === player.id) {
    form.button('Unclaim Current Chunk', 'textures/ui/cancel', async () => {
      const res = unclaimChunk(player, cx, cz);
      player.sendMessage(res.message);
      await showLandClaimPanel(player, context);
    });
  }

  form.button('Show Chunk Boundaries', 'textures/ui/magnifyingGlass', async () => {
    showChunkBoundaries(player);
  });

  form.button('My Claims List', 'textures/ui/world_glyph', async () => {
    await showMyClaimsPanel(player, context);
  });

  form.button('Trust Management', 'textures/ui/permissions_member_star', async () => {
    await showTrustManagementPanel(player, context);
  });

  if (isDefined(currentClaim) && currentClaim.ownerId === player.id) {
    form.button('Claim Settings / Flags', 'textures/ui/gear', async () => {
      await showClaimFlagsPanel(player, currentClaim, context);
    });
  }

  if (myClaims.length > 0) {
    form.button('§cUnclaim All Claims', 'textures/ui/cancel', async () => {
      await showConfirmationDialog(player, {
        title: 'Unclaim All Land',
        body: `Are you sure you want to unclaim all ${myClaims.length} of your chunks? This cannot be undone.`,
        onConfirm: async () => {
          const res = unclaimAll(player);
          player.sendMessage(res.message);
          await showLandClaimPanel(player, context);
        },
      });
    });
  }

  await form.show(player);
}

export async function showMyClaimsPanel(player: mc.Player, context?: Record<string, unknown>): Promise<void> {
  const myClaims = getClaimsByPlayer(player.id);
  const maxClaims = getMaxClaimsForPlayer(player);

  const form = new ActionFormBuilder()
    .title('§l§2My Claims§r')
    .body(`§7You own §a${myClaims.length}§7 of §e${maxClaims}§7 maximum chunks:`);

  for (const claim of myClaims) {
    const dimShort = claim.dimension.replace('minecraft:', '');
    form.button(`[${claim.chunkX}, ${claim.chunkZ}] (${dimShort})`, 'textures/ui/world_glyph', async () => {
      await showClaimDetailPanel(player, claim, context);
    });
  }

  form.button('§8« Back', 'textures/ui/arrow_left', async () => {
    await showLandClaimPanel(player, context);
  });

  await form.show(player);
}

export async function showClaimDetailPanel(
  player: mc.Player,
  claim: LandClaim,
  context?: Record<string, unknown>,
): Promise<void> {
  const dimShort = claim.dimension.replace('minecraft:', '');
  const form = new ActionFormBuilder()
    .title(`§lClaim [${claim.chunkX}, ${claim.chunkZ}]§r`)
    .body(
      `§7Dimension: §f${dimShort}\n` +
        `§7Claimed: §f${new Date(claim.claimedAt).toLocaleString()}\n` +
        `§7Trusted Players: §e${claim.trusted.length > 0 ? claim.trusted.join(', ') : 'None'}\n` +
        `§7PvP Allowed: §f${claim.flags.allowPvP ? 'Yes' : 'No'}\n` +
        `§7Explosions: §f${claim.flags.allowExplosions ? 'Yes' : 'No'}\n` +
        `§7Visitor Interact: §f${claim.flags.allowInteract ? 'Yes' : 'No'}\n` +
        `§7Visitor Containers: §f${claim.flags.allowContainers ? 'Yes' : 'No'}`,
    )
    .button('Edit Claim Flags', 'textures/ui/gear', async () => {
      await showClaimFlagsPanel(player, claim, context);
    })
    .button('§cUnclaim Chunk', 'textures/ui/cancel', async () => {
      const res = unclaimChunk(player, claim.chunkX, claim.chunkZ);
      player.sendMessage(res.message);
      await showMyClaimsPanel(player, context);
    })
    .button('§8« Back', 'textures/ui/arrow_left', async () => {
      await showMyClaimsPanel(player, context);
    });

  await form.show(player);
}

export async function showTrustManagementPanel(player: mc.Player, context?: Record<string, unknown>): Promise<void> {
  const myClaims = getClaimsByPlayer(player.id);
  const trustedSet = new Set<string>();
  for (const c of myClaims) {
    for (const t of c.trusted) {
      trustedSet.add(t);
    }
  }

  const form = new ActionFormBuilder()
    .title('§l§2Trust Management§r')
    .body(
      `§7Trusted players can build, break, and interact inside your claims.\nCurrently trusted: §e${trustedSet.size}§7 player(s).`,
    )
    .button('Trust New Player', 'textures/ui/permissions_member_star', async () => {
      await showAddTrustModal(player, context);
    });

  if (trustedSet.size > 0) {
    for (const name of trustedSet) {
      form.button(`Untrust ${name}`, 'textures/ui/permissions_visitor_hand', async () => {
        const res = untrustPlayer(player, name);
        player.sendMessage(res.message);
        await showTrustManagementPanel(player, context);
      });
    }
  }

  form.button('§8« Back', 'textures/ui/arrow_left', async () => {
    await showLandClaimPanel(player, context);
  });

  await form.show(player);
}

async function showAddTrustModal(player: mc.Player, context?: Record<string, unknown>): Promise<void> {
  const form = new CustomFormBuilder<{ targetName: string }>('Trust a Player')
    .textField('targetName', 'Player Name', 'Enter exact player name', '')
    .submitButton('Trust Player');

  const res = await form.show(player);
  if (isDefined(res) && isNonEmptyString(res.targetName)) {
    const actionRes = trustPlayer(player, res.targetName);
    player.sendMessage(actionRes.message);
  }
  await showTrustManagementPanel(player, context);
}

export async function showClaimFlagsPanel(
  player: mc.Player,
  claim: LandClaim,
  context?: Record<string, unknown>,
): Promise<void> {
  const form = new CustomFormBuilder<{
    allowPvP: boolean;
    allowExplosions: boolean;
    allowInteract: boolean;
    allowContainers: boolean;
  }>(`Flags: [${claim.chunkX}, ${claim.chunkZ}]`)
    .toggle('allowPvP', 'Allow PvP inside claim', Boolean(claim.flags.allowPvP))
    .toggle('allowExplosions', 'Allow Explosions inside claim', Boolean(claim.flags.allowExplosions))
    .toggle('allowInteract', 'Allow Visitors to Interact (Doors/Levers)', Boolean(claim.flags.allowInteract))
    .toggle('allowContainers', 'Allow Visitors to Open Containers', Boolean(claim.flags.allowContainers))
    .submitButton('Save Flags');

  const res = await form.show(player);
  if (isDefined(res)) {
    updateClaimFlags(claim.id, {
      allowPvP: res.allowPvP,
      allowExplosions: res.allowExplosions,
      allowInteract: res.allowInteract,
      allowContainers: res.allowContainers,
    });
    player.sendMessage('§aClaim settings successfully updated.');
  }
  await showClaimDetailPanel(player, claim, context);
}
