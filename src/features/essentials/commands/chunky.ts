import { CommandExecutor, CustomCommand } from '@commands/commandManager.js';
import {
  cancelChunkyJob,
  getChunkyStatus,
  pauseChunkyJob,
  resumeChunkyJob,
  startChunkyJob,
} from '@features/essentials/chunky/manager.js';
import { getEffectiveBorderForDimension } from '@features/essentials/worldBorder/manager.js';
import * as mc from '@minecraft/server';
import { MinecraftDimensionTypes } from '@minecraft/vanilla-data';

function resolveDimensionId(raw?: string, fallback?: string): string {
  if (!raw) {
    return fallback ?? MinecraftDimensionTypes.Overworld;
  }
  const norm = raw.toLowerCase();
  if (norm === 'nether' || norm === 'the_nether' || norm === MinecraftDimensionTypes.Nether) {
    return MinecraftDimensionTypes.Nether;
  }
  if (norm === 'end' || norm === 'the_end' || norm === MinecraftDimensionTypes.TheEnd) {
    return MinecraftDimensionTypes.TheEnd;
  }
  return MinecraftDimensionTypes.Overworld;
}

const chunkyCommand: CustomCommand = {
  name: 'chunky',
  description: 'Pre-generates world chunks in a spiral with adaptive TPS throttling.',
  category: 'Essentials',
  permissionNode: 'cmd.chunky.admin',
  allowConsole: true,
  parameters: [
    { name: 'action', type: 'string' },
    { name: 'radius', type: 'int', optional: true },
    { name: 'centerX', type: 'int', optional: true },
    { name: 'centerZ', type: 'int', optional: true },
    { name: 'dimension', type: 'string', optional: true },
  ],
  execute: (
    executor: CommandExecutor,
    args: { action?: string; radius?: number; centerX?: number; centerZ?: number; dimension?: string },
  ) => {
    const action = (args.action ?? 'status').toLowerCase();

    if (action === 'worldborder') {
      const border = getEffectiveBorderForDimension(MinecraftDimensionTypes.Overworld);
      if (!border.enabled) {
        executor.sendMessage('§cOverworld border is not enabled. Use §e/chunky start <radius>§c instead.');
        return;
      }
      if (border.radius < 16 || border.radius > 4096) {
        executor.sendMessage(
          `§cOverworld border radius (${border.radius}) is outside Chunky's supported range (16..4096).`,
        );
        return;
      }
      const res = startChunkyJob(MinecraftDimensionTypes.Overworld, border.centerX, border.centerZ, border.radius);
      executor.sendMessage(res.message);
      return;
    }

    if (action === 'start') {
      const radius = Number(args.radius ?? 512);
      const fallbackDim = executor instanceof mc.Player ? executor.dimension.id : MinecraftDimensionTypes.Overworld;
      const dimId = resolveDimensionId(args.dimension, fallbackDim);
      const cx =
        args.centerX !== undefined ? Number(args.centerX) : executor instanceof mc.Player ? executor.location.x : 0;
      const cz =
        args.centerZ !== undefined ? Number(args.centerZ) : executor instanceof mc.Player ? executor.location.z : 0;
      const res = startChunkyJob(dimId, cx, cz, radius);
      executor.sendMessage(res.message);
      return;
    }

    if (action === 'pause') {
      executor.sendMessage(pauseChunkyJob().message);
      return;
    }

    if (action === 'resume') {
      executor.sendMessage(resumeChunkyJob().message);
      return;
    }

    if (action === 'cancel' || action === 'stop') {
      executor.sendMessage(cancelChunkyJob().message);
      return;
    }

    const st = getChunkyStatus();
    if (!st) {
      executor.sendMessage('§7[Chunky] No active pre-generation job. Usage: /chunky start [radiusBlocks]');
      return;
    }
    const pct = st.totalChunks > 0 ? ((st.stepIndex / st.totalChunks) * 100).toFixed(1) : '0.0';
    executor.sendMessage(
      `§e[Chunky] §fState: ${st.paused ? '§ePAUSED' : '§aRUNNING'} §8| §fProgress: §b${st.stepIndex}/${st.totalChunks} (${pct}%)`,
    );
  },
};

export default chunkyCommand;
