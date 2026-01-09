import { Injectable, Optional } from '@nestjs/common';
import { EntityManager, EntityTarget, Repository } from 'typeorm';
import { GoogleTokenEntity, UsersEntity } from '../entities';

@Injectable()
export class GoogleTokenRepository extends Repository<GoogleTokenEntity> {
  constructor(
    @Optional() _target: EntityTarget<GoogleTokenEntity>,
    entityManager: EntityManager,
  ) {
    super(GoogleTokenEntity, entityManager);
  }

  findByUserId(userId: string): Promise<GoogleTokenEntity | null> {
    return this.findOne({ where: { user: { id: userId } } });
  }

  async upsertForUser(input: {
    user: UsersEntity;
    email: string;
    accessToken: string;
    refreshToken: string;
    expiresAt: Date;
  }): Promise<GoogleTokenEntity> {
    const existing = await this.findByUserId(input.user.id);
    const record = this.create({
      id: existing?.id,
      user: input.user,
      email: input.email,
      accessToken: input.accessToken,
      refreshToken: input.refreshToken,
      expiresAt: input.expiresAt,
    });
    return this.save(record);
  }
}
