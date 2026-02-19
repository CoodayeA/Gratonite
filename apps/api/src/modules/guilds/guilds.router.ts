import { Router } from 'express';
import type { AppContext } from '../../lib/context.js';
import { requireAuth } from '../../middleware/auth.js';
import { createGuildsService } from './guilds.service.js';
import { createGuildSchema, updateGuildSchema, createRoleSchema, updateRoleSchema } from './guilds.schemas.js';

export function guildsRouter(ctx: AppContext): Router {
  const router = Router();
  const guildsService = createGuildsService(ctx);
  const auth = requireAuth(ctx);

  // ── Guild CRUD ─────────────────────────────────────────────────────────

  // Create guild
  router.post('/', auth, async (req, res) => {
    const parsed = createGuildSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ code: 'VALIDATION_ERROR', errors: parsed.error.flatten().fieldErrors });
    }

    const result = await guildsService.createGuild(req.user!.userId, parsed.data);
    const guild = await guildsService.getGuild(result.guildId);

    ctx.io.to(`user:${req.user!.userId}`).emit('GUILD_CREATE', guild as any);

    res.status(201).json(guild);
  });

  // Get current user's guilds
  router.get('/@me', auth, async (req, res) => {
    const userGuilds = await guildsService.getUserGuilds(req.user!.userId);
    res.json(userGuilds);
  });

  // Get guild by ID
  router.get('/:guildId', auth, async (req, res) => {
    const guildId = req.params.guildId;
    if (!await guildsService.isMember(guildId, req.user!.userId)) {
      return res.status(403).json({ code: 'NOT_A_MEMBER', message: 'You are not a member of this server' });
    }

    const guild = await guildsService.getGuild(guildId);
    if (!guild) return res.status(404).json({ code: 'NOT_FOUND' });

    res.json(guild);
  });

  // Update guild
  router.patch('/:guildId', auth, async (req, res) => {
    const guildId = req.params.guildId;
    const guild = await guildsService.getGuild(guildId);
    if (!guild) return res.status(404).json({ code: 'NOT_FOUND' });

    // Only owner can update guild settings
    if (guild.ownerId !== req.user!.userId) {
      return res.status(403).json({ code: 'FORBIDDEN', message: 'Only the server owner can modify settings' });
    }

    const parsed = updateGuildSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ code: 'VALIDATION_ERROR', errors: parsed.error.flatten().fieldErrors });
    }

    const updated = await guildsService.updateGuild(guildId, parsed.data);
    if (updated) {
      ctx.io.to(`guild:${guildId}`).emit('GUILD_UPDATE', updated as any);
    }

    res.json(updated);
  });

  // Delete guild
  router.delete('/:guildId', auth, async (req, res) => {
    const guildId = req.params.guildId;
    const guild = await guildsService.getGuild(guildId);
    if (!guild) return res.status(404).json({ code: 'NOT_FOUND' });

    if (guild.ownerId !== req.user!.userId) {
      return res.status(403).json({ code: 'FORBIDDEN', message: 'Only the server owner can delete the server' });
    }

    await guildsService.deleteGuild(guildId);
    ctx.io.to(`guild:${guildId}`).emit('GUILD_DELETE', { id: String(guildId) });

    res.status(204).send();
  });

  // ── Members ──────────────────────────────────────────────────────────────

  // List members
  router.get('/:guildId/members', auth, async (req, res) => {
    const guildId = req.params.guildId;
    if (!await guildsService.isMember(guildId, req.user!.userId)) {
      return res.status(403).json({ code: 'NOT_A_MEMBER' });
    }

    const limit = Math.min(Number(req.query.limit) || 100, 1000);
    const after = req.query.after ? req.query.after as string : undefined;
    const members = await guildsService.getMembers(guildId, limit, after);
    res.json(members);
  });

  // Get specific member
  router.get('/:guildId/members/:userId', auth, async (req, res) => {
    const guildId = req.params.guildId;
    if (!await guildsService.isMember(guildId, req.user!.userId)) {
      return res.status(403).json({ code: 'NOT_A_MEMBER' });
    }

    const member = await guildsService.getMember(guildId, req.params.userId);
    if (!member) return res.status(404).json({ code: 'NOT_FOUND' });

    res.json(member);
  });

  // Leave guild
  router.delete('/:guildId/members/@me', auth, async (req, res) => {
    const guildId = req.params.guildId;
    const userId = req.user!.userId;
    const guild = await guildsService.getGuild(guildId);
    if (!guild) return res.status(404).json({ code: 'NOT_FOUND' });

    if (guild.ownerId === userId) {
      return res.status(400).json({ code: 'OWNER_CANNOT_LEAVE', message: 'Transfer ownership before leaving' });
    }

    await guildsService.removeMember(guildId, userId);
    ctx.io.to(`guild:${guildId}`).emit('GUILD_MEMBER_REMOVE', { userId: String(userId), guildId: String(guildId) });

    res.status(204).send();
  });

  // Kick member
  router.delete('/:guildId/members/:userId', auth, async (req, res) => {
    const guildId = req.params.guildId;
    const targetId = req.params.userId;
    const guild = await guildsService.getGuild(guildId);
    if (!guild) return res.status(404).json({ code: 'NOT_FOUND' });

    // TODO: Check KICK_MEMBERS permission instead of just owner check
    if (guild.ownerId !== req.user!.userId) {
      return res.status(403).json({ code: 'FORBIDDEN' });
    }

    if (targetId === guild.ownerId) {
      return res.status(400).json({ code: 'CANNOT_KICK_OWNER' });
    }

    await guildsService.removeMember(guildId, targetId);
    ctx.io.to(`guild:${guildId}`).emit('GUILD_MEMBER_REMOVE', { userId: String(targetId), guildId: String(guildId) });

    res.status(204).send();
  });

  // ── Roles ────────────────────────────────────────────────────────────────

  // List roles
  router.get('/:guildId/roles', auth, async (req, res) => {
    const guildId = req.params.guildId;
    if (!await guildsService.isMember(guildId, req.user!.userId)) {
      return res.status(403).json({ code: 'NOT_A_MEMBER' });
    }

    const roles = await guildsService.getRoles(guildId);
    res.json(roles);
  });

  // Create role
  router.post('/:guildId/roles', auth, async (req, res) => {
    const guildId = req.params.guildId;
    const guild = await guildsService.getGuild(guildId);
    if (!guild) return res.status(404).json({ code: 'NOT_FOUND' });

    // TODO: Check MANAGE_ROLES permission
    if (guild.ownerId !== req.user!.userId) {
      return res.status(403).json({ code: 'FORBIDDEN' });
    }

    const parsed = createRoleSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ code: 'VALIDATION_ERROR', errors: parsed.error.flatten().fieldErrors });
    }

    const role = await guildsService.createRole(guildId, parsed.data);
    ctx.io.to(`guild:${guildId}`).emit('GUILD_ROLE_CREATE', { guildId: String(guildId), role });

    res.status(201).json(role);
  });

  // Update role
  router.patch('/:guildId/roles/:roleId', auth, async (req, res) => {
    const guildId = req.params.guildId;
    const guild = await guildsService.getGuild(guildId);
    if (!guild) return res.status(404).json({ code: 'NOT_FOUND' });

    if (guild.ownerId !== req.user!.userId) {
      return res.status(403).json({ code: 'FORBIDDEN' });
    }

    const parsed = updateRoleSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ code: 'VALIDATION_ERROR', errors: parsed.error.flatten().fieldErrors });
    }

    const role = await guildsService.updateRole(req.params.roleId, parsed.data);
    if (!role) return res.status(404).json({ code: 'NOT_FOUND' });

    ctx.io.to(`guild:${guildId}`).emit('GUILD_ROLE_UPDATE', { guildId: String(guildId), role });

    res.json(role);
  });

  // Delete role
  router.delete('/:guildId/roles/:roleId', auth, async (req, res) => {
    const guildId = req.params.guildId;
    const guild = await guildsService.getGuild(guildId);
    if (!guild) return res.status(404).json({ code: 'NOT_FOUND' });

    if (guild.ownerId !== req.user!.userId) {
      return res.status(403).json({ code: 'FORBIDDEN' });
    }

    await guildsService.deleteRole(req.params.roleId);
    ctx.io.to(`guild:${guildId}`).emit('GUILD_ROLE_DELETE', { guildId: String(guildId), roleId: req.params.roleId });

    res.status(204).send();
  });

  // Assign role to member
  router.put('/:guildId/members/:userId/roles/:roleId', auth, async (req, res) => {
    const guildId = req.params.guildId;
    const guild = await guildsService.getGuild(guildId);
    if (!guild) return res.status(404).json({ code: 'NOT_FOUND' });

    if (guild.ownerId !== req.user!.userId) {
      return res.status(403).json({ code: 'FORBIDDEN' });
    }

    await guildsService.assignRole(guildId, req.params.userId, req.params.roleId);
    res.status(204).send();
  });

  // Remove role from member
  router.delete('/:guildId/members/:userId/roles/:roleId', auth, async (req, res) => {
    const guildId = req.params.guildId;
    const guild = await guildsService.getGuild(guildId);
    if (!guild) return res.status(404).json({ code: 'NOT_FOUND' });

    if (guild.ownerId !== req.user!.userId) {
      return res.status(403).json({ code: 'FORBIDDEN' });
    }

    await guildsService.removeRole(guildId, req.params.userId, req.params.roleId);
    res.status(204).send();
  });

  // ── Bans ─────────────────────────────────────────────────────────────────

  // List bans
  router.get('/:guildId/bans', auth, async (req, res) => {
    const guildId = req.params.guildId;
    const guild = await guildsService.getGuild(guildId);
    if (!guild) return res.status(404).json({ code: 'NOT_FOUND' });

    if (guild.ownerId !== req.user!.userId) {
      return res.status(403).json({ code: 'FORBIDDEN' });
    }

    const banList = await guildsService.getBans(guildId);
    res.json(banList);
  });

  // Ban member
  router.put('/:guildId/bans/:userId', auth, async (req, res) => {
    const guildId = req.params.guildId;
    const targetId = req.params.userId;
    const guild = await guildsService.getGuild(guildId);
    if (!guild) return res.status(404).json({ code: 'NOT_FOUND' });

    if (guild.ownerId !== req.user!.userId) {
      return res.status(403).json({ code: 'FORBIDDEN' });
    }

    if (targetId === guild.ownerId) {
      return res.status(400).json({ code: 'CANNOT_BAN_OWNER' });
    }

    await guildsService.banMember(guildId, targetId, req.user!.userId, req.body?.reason);
    ctx.io.to(`guild:${guildId}`).emit('GUILD_BAN_ADD', { guildId: String(guildId), userId: String(targetId) });

    res.status(204).send();
  });

  // Unban member
  router.delete('/:guildId/bans/:userId', auth, async (req, res) => {
    const guildId = req.params.guildId;
    const guild = await guildsService.getGuild(guildId);
    if (!guild) return res.status(404).json({ code: 'NOT_FOUND' });

    if (guild.ownerId !== req.user!.userId) {
      return res.status(403).json({ code: 'FORBIDDEN' });
    }

    await guildsService.unbanMember(guildId, req.params.userId);
    ctx.io.to(`guild:${guildId}`).emit('GUILD_BAN_REMOVE', { guildId: String(guildId), userId: req.params.userId });

    res.status(204).send();
  });

  return router;
}
