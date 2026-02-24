import { Router } from 'express';
import type { AppContext } from '../../lib/context.js';
import { requireAuth } from '../../middleware/auth.js';
import { createVoiceService } from './voice.service.js';
import { createGuildsService } from '../guilds/guilds.service.js';
import { createChannelsService } from '../channels/channels.service.js';
import { dmRecipients, dmChannels, channels } from '@gratonite/db';
import { and, eq } from 'drizzle-orm';
import {
  joinVoiceSchema,
  updateVoiceStateSchema,
  modifyMemberVoiceStateSchema,
  createStageInstanceSchema,
  updateStageInstanceSchema,
  createSoundboardSoundSchema,
  updateSoundboardSoundSchema,
  startScreenShareSchema,
} from './voice.schemas.js';
import { GatewayIntents, emitRoomWithIntent } from '../../lib/gateway-intents.js';
import { hasPermission, PermissionFlags } from '@gratonite/types';

export function voiceRouter(ctx: AppContext): Router {
  const router = Router();
  const voiceService = createVoiceService(ctx);
  const guildsService = createGuildsService(ctx);
  const channelsService = createChannelsService(ctx);
  const auth = requireAuth(ctx);

  // ── Join voice channel ──────────────────────────────────────────────────

  router.post('/voice/join', auth, async (req, res) => {
    const parsed = joinVoiceSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ code: 'VALIDATION_ERROR', errors: parsed.error.flatten().fieldErrors });
    }

    const userId = req.user!.userId;
    let channel = await channelsService.getChannel(parsed.data.channelId);
    if (!channel) {
      const [dmChannel] = await ctx.db
        .select()
        .from(dmChannels)
        .where(eq(dmChannels.id, parsed.data.channelId))
        .limit(1);
      if (dmChannel) {
        await ctx.db
          .insert(channels)
          .values({
            id: dmChannel.id,
            type: dmChannel.type === 'group_dm' ? 'GROUP_DM' : 'DM',
            name: dmChannel.name ?? null,
          })
          .onConflictDoNothing();
        channel = await channelsService.getChannel(parsed.data.channelId);
      }
    }
    if (!channel) return res.status(404).json({ code: 'NOT_FOUND', message: 'Channel not found' });

    const isGuildVoice = channel.type === 'GUILD_VOICE' || channel.type === 'GUILD_STAGE_VOICE';
    const isDmVoice = channel.type === 'DM' || channel.type === 'GROUP_DM';
    if (!isGuildVoice && !isDmVoice) {
      return res.status(400).json({ code: 'INVALID_CHANNEL_TYPE', message: 'Not a voice channel' });
    }

    // Must be a guild member for guild voice
    if (channel.guildId) {
      const isMember = await guildsService.isMember(channel.guildId, userId);
      if (!isMember) return res.status(403).json({ code: 'FORBIDDEN' });
      const canConnect = await channelsService.canConnectToVoiceChannel(channel.id, userId);
      if (!canConnect) return res.status(403).json({ code: 'FORBIDDEN' });
    }

    // Must be a DM recipient for DM calls
    if (!channel.guildId && isDmVoice) {
      const [recipient] = await ctx.db
        .select({ userId: dmRecipients.userId })
        .from(dmRecipients)
        .innerJoin(dmChannels, eq(dmChannels.id, dmRecipients.channelId))
        .where(and(eq(dmRecipients.channelId, channel.id), eq(dmRecipients.userId, userId)))
        .limit(1);
      if (!recipient) return res.status(403).json({ code: 'FORBIDDEN' });
    }

    const { token, voiceState } = await voiceService.joinChannel(
      userId,
      req.user!.username,
      parsed.data.channelId,
      channel.guildId,
      `session_${userId}`,
      parsed.data,
    );

    // Broadcast voice state to guild
    if (channel.guildId) {
      await emitRoomWithIntent(
        ctx.io,
        `guild:${channel.guildId}`,
        GatewayIntents.GUILD_VOICE_STATES,
        'VOICE_STATE_UPDATE',
        voiceState as any,
      );
    }

    res.json({
      token,
      voiceState,
      endpoint: ctx.env.LIVEKIT_URL,
    });
  });

  // ── Leave voice channel ─────────────────────────────────────────────────

  router.post('/voice/leave', auth, async (req, res) => {
    const userId = req.user!.userId;
    const disconnectedState = await voiceService.leaveChannel(userId);

    if (!disconnectedState) {
      return res.status(400).json({ code: 'NOT_IN_VOICE', message: 'Not in a voice channel' });
    }

    if (disconnectedState.guildId) {
      await emitRoomWithIntent(
        ctx.io,
        `guild:${disconnectedState.guildId}`,
        GatewayIntents.GUILD_VOICE_STATES,
        'VOICE_STATE_UPDATE',
        disconnectedState as any,
      );
    }

    res.status(204).send();
  });

  // ── Update own voice state ──────────────────────────────────────────────

  router.patch('/voice/state', auth, async (req, res) => {
    const parsed = updateVoiceStateSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ code: 'VALIDATION_ERROR', errors: parsed.error.flatten().fieldErrors });
    }

    const updated = await voiceService.updateVoiceState(req.user!.userId, parsed.data);
    if (!updated) return res.status(404).json({ code: 'NOT_IN_VOICE', message: 'Not in a voice channel' });

    if (updated.guildId) {
      await emitRoomWithIntent(
        ctx.io,
        `guild:${updated.guildId}`,
        GatewayIntents.GUILD_VOICE_STATES,
        'VOICE_STATE_UPDATE',
        updated as any,
      );
    }

    res.json(updated);
  });

  // ── Get guild voice states ──────────────────────────────────────────────

  router.get('/guilds/:guildId/voice-states', auth, async (req, res) => {
    const { guildId } = req.params;
    const isMember = await guildsService.isMember(guildId, req.user!.userId);
    if (!isMember) return res.status(403).json({ code: 'FORBIDDEN' });

    const states = await voiceService.getGuildVoiceStates(guildId);
    res.json(states);
  });

  // ── Get channel voice states ────────────────────────────────────────────

  router.get('/channels/:channelId/voice-states', auth, async (req, res) => {
    const channel = await channelsService.getChannel(req.params.channelId);
    if (!channel) return res.status(404).json({ code: 'NOT_FOUND' });

    if (channel.guildId) {
      const isMember = await guildsService.isMember(channel.guildId, req.user!.userId);
      if (!isMember) return res.status(403).json({ code: 'FORBIDDEN' });
      const canConnect = await channelsService.canConnectToVoiceChannel(channel.id, req.user!.userId);
      if (!canConnect) return res.status(403).json({ code: 'FORBIDDEN' });
    }

    const states = await voiceService.getChannelVoiceStates(req.params.channelId);
    res.json(states);
  });

  // ── Modify member voice state (mod action) ──────────────────────────────

  router.patch('/guilds/:guildId/voice-states/:userId', auth, async (req, res) => {
    const { guildId, userId: targetUserId } = req.params;

    const perms = await guildsService.getMemberPermissions(guildId, req.user!.userId);
    if (!hasPermission(perms, PermissionFlags.MUTE_MEMBERS) &&
        !hasPermission(perms, PermissionFlags.DEAFEN_MEMBERS) &&
        !hasPermission(perms, PermissionFlags.MOVE_MEMBERS)) {
      return res.status(403).json({ code: 'MISSING_PERMISSIONS' });
    }

    const parsed = modifyMemberVoiceStateSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ code: 'VALIDATION_ERROR', errors: parsed.error.flatten().fieldErrors });
    }

    const result = await voiceService.modifyMemberVoiceState(targetUserId, parsed.data);
    if (!result) return res.status(404).json({ code: 'NOT_IN_VOICE' });

    await emitRoomWithIntent(
      ctx.io,
      `guild:${guildId}`,
      GatewayIntents.GUILD_VOICE_STATES,
      'VOICE_STATE_UPDATE',
      result as any,
    );

    res.json(result);
  });

  // ── Screen share ────────────────────────────────────────────────────────

  router.post('/voice/screen-share/start', auth, async (req, res) => {
    const parsed = startScreenShareSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ code: 'VALIDATION_ERROR', errors: parsed.error.flatten().fieldErrors });
    }

    const state = await voiceService.getVoiceState(req.user!.userId);
    if (!state) return res.status(400).json({ code: 'NOT_IN_VOICE', message: 'Not in a voice channel' });

    const session = await voiceService.startScreenShare(
      req.user!.userId,
      state.channelId,
      parsed.data,
    );

    if (state.guildId) {
      await emitRoomWithIntent(
        ctx.io,
        `guild:${state.guildId}`,
        GatewayIntents.GUILD_VOICE_STATES,
        'SCREEN_SHARE_START',
        session as any,
      );
      await emitRoomWithIntent(
        ctx.io,
        `guild:${state.guildId}`,
        GatewayIntents.GUILD_VOICE_STATES,
        'VOICE_STATE_UPDATE',
        {
          ...state,
          selfStream: true,
        } as any,
      );
    }

    res.json(session);
  });

  router.post('/voice/screen-share/stop', auth, async (req, res) => {
    const state = await voiceService.getVoiceState(req.user!.userId);
    if (!state) return res.status(400).json({ code: 'NOT_IN_VOICE' });

    await voiceService.stopScreenShare(req.user!.userId, state.channelId);

    if (state.guildId) {
      await emitRoomWithIntent(
        ctx.io,
        `guild:${state.guildId}`,
        GatewayIntents.GUILD_VOICE_STATES,
        'SCREEN_SHARE_STOP',
        {
          userId: req.user!.userId,
          channelId: state.channelId,
        } as any,
      );
      await emitRoomWithIntent(
        ctx.io,
        `guild:${state.guildId}`,
        GatewayIntents.GUILD_VOICE_STATES,
        'VOICE_STATE_UPDATE',
        {
          ...state,
          selfStream: false,
        } as any,
      );
    }

    res.status(204).send();
  });

  // ── Stage instances ─────────────────────────────────────────────────────

  router.post('/guilds/:guildId/stage-instances', auth, async (req, res) => {
    const { guildId } = req.params;
    const perms = await guildsService.getMemberPermissions(guildId, req.user!.userId);
    if (!hasPermission(perms, PermissionFlags.MANAGE_CHANNELS)) {
      return res.status(403).json({ code: 'MISSING_PERMISSIONS' });
    }

    const parsed = createStageInstanceSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ code: 'VALIDATION_ERROR', errors: parsed.error.flatten().fieldErrors });
    }

    const stage = await voiceService.createStageInstance(guildId, parsed.data);

    await emitRoomWithIntent(
      ctx.io,
      `guild:${guildId}`,
      GatewayIntents.GUILD_VOICE_STATES,
      'STAGE_INSTANCE_CREATE',
      stage as any,
    );

    res.status(201).json(stage);
  });

  router.get('/guilds/:guildId/stage-instances', auth, async (req, res) => {
    const { guildId } = req.params;
    const isMember = await guildsService.isMember(guildId, req.user!.userId);
    if (!isMember) return res.status(403).json({ code: 'FORBIDDEN' });

    const stages = await voiceService.getGuildStageInstances(guildId);
    res.json(stages);
  });

  router.patch('/stage-instances/:stageId', auth, async (req, res) => {
    const parsed = updateStageInstanceSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ code: 'VALIDATION_ERROR', errors: parsed.error.flatten().fieldErrors });
    }

    const updated = await voiceService.updateStageInstance(req.params.stageId, parsed.data);
    if (!updated) return res.status(404).json({ code: 'NOT_FOUND' });

    await emitRoomWithIntent(
      ctx.io,
      `guild:${updated.guildId}`,
      GatewayIntents.GUILD_VOICE_STATES,
      'STAGE_INSTANCE_UPDATE',
      updated as any,
    );

    res.json(updated);
  });

  router.delete('/stage-instances/:stageId', auth, async (req, res) => {
    const stage = await voiceService.getStageInstanceById(req.params.stageId);
    if (!stage) return res.status(404).json({ code: 'NOT_FOUND' });

    const perms = await guildsService.getMemberPermissions(stage.guildId, req.user!.userId);
    if (!hasPermission(perms, PermissionFlags.MANAGE_CHANNELS)) {
      return res.status(403).json({ code: 'MISSING_PERMISSIONS' });
    }

    await voiceService.deleteStageInstance(req.params.stageId);

    await emitRoomWithIntent(
      ctx.io,
      `guild:${stage.guildId}`,
      GatewayIntents.GUILD_VOICE_STATES,
      'STAGE_INSTANCE_DELETE',
      {
        id: stage.id,
        guildId: stage.guildId,
        channelId: stage.channelId,
      } as any,
    );

    res.status(204).send();
  });

  // Request to speak (stage channel)
  router.put('/stage-instances/:stageId/request-to-speak', auth, async (req, res) => {
    const updated = await voiceService.requestToSpeak(req.user!.userId);
    if (!updated) return res.status(404).json({ code: 'NOT_IN_VOICE' });

    if (updated.guildId) {
      await emitRoomWithIntent(
        ctx.io,
        `guild:${updated.guildId}`,
        GatewayIntents.GUILD_VOICE_STATES,
        'VOICE_STATE_UPDATE',
        updated as any,
      );
    }

    res.status(204).send();
  });

  // Approve speaker
  router.put('/stage-instances/:stageId/speakers/:userId', auth, async (req, res) => {
    const state = await voiceService.getVoiceState(req.params.userId);
    if (!state || !state.guildId) return res.status(404).json({ code: 'NOT_FOUND' });

    const perms = await guildsService.getMemberPermissions(state.guildId, req.user!.userId);
    if (!hasPermission(perms, PermissionFlags.MUTE_MEMBERS)) {
      return res.status(403).json({ code: 'MISSING_PERMISSIONS' });
    }

    const updated = await voiceService.approveSpeaker(req.params.userId);
    if (!updated) return res.status(404).json({ code: 'NOT_IN_VOICE' });

    await emitRoomWithIntent(
      ctx.io,
      `guild:${state.guildId}`,
      GatewayIntents.GUILD_VOICE_STATES,
      'VOICE_STATE_UPDATE',
      updated as any,
    );

    res.status(204).send();
  });

  // Revoke speaker
  router.delete('/stage-instances/:stageId/speakers/:userId', auth, async (req, res) => {
    const state = await voiceService.getVoiceState(req.params.userId);
    if (!state || !state.guildId) return res.status(404).json({ code: 'NOT_FOUND' });

    const perms = await guildsService.getMemberPermissions(state.guildId, req.user!.userId);
    if (!hasPermission(perms, PermissionFlags.MUTE_MEMBERS)) {
      return res.status(403).json({ code: 'MISSING_PERMISSIONS' });
    }

    const updated = await voiceService.revokeSpeaker(req.params.userId);
    if (!updated) return res.status(404).json({ code: 'NOT_IN_VOICE' });

    await emitRoomWithIntent(
      ctx.io,
      `guild:${state.guildId}`,
      GatewayIntents.GUILD_VOICE_STATES,
      'VOICE_STATE_UPDATE',
      updated as any,
    );

    res.status(204).send();
  });

  // ── Soundboard ──────────────────────────────────────────────────────────

  router.get('/guilds/:guildId/soundboard', auth, async (req, res) => {
    const { guildId } = req.params;
    const isMember = await guildsService.isMember(guildId, req.user!.userId);
    if (!isMember) return res.status(403).json({ code: 'FORBIDDEN' });

    const sounds = await voiceService.getGuildSounds(guildId);
    res.json(sounds);
  });

  router.post('/guilds/:guildId/soundboard', auth, async (req, res) => {
    const { guildId } = req.params;
    const isMember = await guildsService.isMember(guildId, req.user!.userId);
    if (!isMember) return res.status(403).json({ code: 'FORBIDDEN' });

    const parsed = createSoundboardSoundSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ code: 'VALIDATION_ERROR', errors: parsed.error.flatten().fieldErrors });
    }

    const sound = await voiceService.createSound(guildId, req.user!.userId, parsed.data);
    res.status(201).json(sound);
  });

  router.patch('/guilds/:guildId/soundboard/:soundId', auth, async (req, res) => {
    const sound = await voiceService.getSound(req.params.soundId);
    if (!sound || sound.guildId !== req.params.guildId) {
      return res.status(404).json({ code: 'NOT_FOUND' });
    }

    // Only uploader or guild owner can update
    const guild = await guildsService.getGuild(req.params.guildId);
    if (sound.uploaderId !== req.user!.userId && guild?.ownerId !== req.user!.userId) {
      return res.status(403).json({ code: 'FORBIDDEN' });
    }

    const parsed = updateSoundboardSoundSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ code: 'VALIDATION_ERROR', errors: parsed.error.flatten().fieldErrors });
    }

    const updated = await voiceService.updateSound(req.params.soundId, parsed.data);
    res.json(updated);
  });

  router.delete('/guilds/:guildId/soundboard/:soundId', auth, async (req, res) => {
    const sound = await voiceService.getSound(req.params.soundId);
    if (!sound || sound.guildId !== req.params.guildId) {
      return res.status(404).json({ code: 'NOT_FOUND' });
    }

    const guild = await guildsService.getGuild(req.params.guildId);
    if (sound.uploaderId !== req.user!.userId && guild?.ownerId !== req.user!.userId) {
      return res.status(403).json({ code: 'FORBIDDEN' });
    }

    await voiceService.deleteSound(req.params.soundId);
    res.status(204).send();
  });

  // Play soundboard sound in voice channel
  router.post('/guilds/:guildId/soundboard/:soundId/play', auth, async (req, res) => {
    const { guildId, soundId } = req.params;
    const userId = req.user!.userId;

    // Must be in a voice channel in this guild
    const state = await voiceService.getVoiceState(userId);
    if (!state || state.guildId !== guildId) {
      return res.status(400).json({ code: 'NOT_IN_VOICE', message: 'Not in a voice channel in this guild' });
    }

    const sound = await voiceService.getSound(soundId);
    if (!sound || sound.guildId !== guildId || !sound.available) {
      return res.status(404).json({ code: 'NOT_FOUND' });
    }

    await emitRoomWithIntent(
      ctx.io,
      `guild:${guildId}`,
      GatewayIntents.GUILD_VOICE_STATES,
      'SOUNDBOARD_PLAY',
      {
        guildId,
        channelId: state.channelId,
        soundId,
        userId,
        volume: sound.volume,
      } as any,
    );

    res.status(204).send();
  });

  return router;
}
