import { Type } from '@sinclair/typebox';
import type { Static } from '@sinclair/typebox';
import type { FastifyInstance } from 'fastify';
import type { PrismaClient } from '@prisma/client';
import type { Env } from '../../config/env.js';
import { assertSameSiteMutation, requireSessionUser } from './session.js';

const Color = Type.Union([Type.Null(), Type.String({ pattern: '^#[0-9a-fA-F]{6}$' })]);
export const AvatarBody = Type.Object({
  version: Type.Literal(1),
  hairColor: Color, eyeColor: Color, shirtColor: Color, pantsColor: Color, shoeColor: Color,
}, { additionalProperties: false });

export function registerAvatarRoutes(app: FastifyInstance, db: PrismaClient, config: Env): void {
  app.get('/api/auth/avatar', async (request) => {
    const user = await requireSessionUser(request, db);
    const preferences = await db.userPreference.findUnique({ where: { userId: user.id } });
    return { avatarConfig: preferences?.avatarConfig ?? null };
  });
  app.patch('/api/auth/avatar', {
    config: { rateLimit: { max: 60, timeWindow: '1 minute' } },
    onRequest: request => assertSameSiteMutation(request, config),
    schema: { body: AvatarBody },
  }, async (request) => {
    const user = await requireSessionUser(request, db);
    const avatarConfig = request.body as Static<typeof AvatarBody>;
    const preferences = await db.userPreference.upsert({
      where: { userId: user.id },
      create: { userId: user.id, avatarConfig },
      update: { avatarConfig },
    });
    return { avatarConfig: preferences.avatarConfig };
  });
}
