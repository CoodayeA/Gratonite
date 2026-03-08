import { db } from '../db/index';
import { autoRoleRules } from '../db/schema/auto-roles';
import { guildMembers } from '../db/schema/guilds';
import { memberRoles } from '../db/schema/roles';
import { messages } from '../db/schema/messages';
import { eq, and, sql, count } from 'drizzle-orm';

export function startAutoRolesJob() {
  setInterval(async () => {
    try {
      const rules = await db.select().from(autoRoleRules)
        .where(eq(autoRoleRules.enabled, true));

      // Group rules by guild
      const rulesByGuild = new Map<string, typeof rules>();
      for (const rule of rules) {
        const existing = rulesByGuild.get(rule.guildId) || [];
        existing.push(rule);
        rulesByGuild.set(rule.guildId, existing);
      }

      for (const [guildId, guildRules] of rulesByGuild) {
        try {
          const members = await db.select({
            userId: guildMembers.userId,
            joinedAt: guildMembers.joinedAt,
          }).from(guildMembers)
            .where(eq(guildMembers.guildId, guildId));

          for (const member of members) {
            for (const rule of guildRules) {
              try {
                let qualifies = false;

                if (rule.triggerType === 'days_in_server' && member.joinedAt) {
                  const daysSinceJoin = Math.floor(
                    (Date.now() - new Date(member.joinedAt).getTime()) / (1000 * 60 * 60 * 24)
                  );
                  qualifies = daysSinceJoin >= rule.triggerValue;
                } else if (rule.triggerType === 'message_count') {
                  const [result] = await db.select({ cnt: count() })
                    .from(messages)
                    .where(eq(messages.authorId, member.userId));
                  qualifies = (result?.cnt ?? 0) >= rule.triggerValue;
                } else if (rule.triggerType === 'level') {
                  // Level is approximated from message count (1 level per 10 messages)
                  const [result] = await db.select({ cnt: count() })
                    .from(messages)
                    .where(eq(messages.authorId, member.userId));
                  const level = Math.floor((result?.cnt ?? 0) / 10);
                  qualifies = level >= rule.triggerValue;
                }

                if (qualifies) {
                  // Check if already has role
                  const [existing] = await db.select().from(memberRoles)
                    .where(and(
                      eq(memberRoles.userId, member.userId),
                      eq(memberRoles.roleId, rule.roleId),
                    ))
                    .limit(1);

                  if (!existing) {
                    await db.insert(memberRoles).values({
                      userId: member.userId,
                      roleId: rule.roleId,
                      guildId,
                    }).onConflictDoNothing();
                  }
                }
              } catch (err) {
                console.error('[autoRoles] Error checking rule for member:', err);
              }
            }
          }
        } catch (err) {
          console.error('[autoRoles] Error processing guild:', err);
        }
      }
    } catch (err) {
      console.error('[autoRoles] Job error:', err);
    }
  }, 5 * 60_000); // Every 5 minutes
}
