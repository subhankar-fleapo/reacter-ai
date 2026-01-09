import { Injectable, Optional } from '@nestjs/common';
import { EntityManager, EntityTarget, Repository } from 'typeorm';
import { MessageEntity } from '../entities';

@Injectable()
export class MessageRepository extends Repository<MessageEntity> {
  constructor(
    @Optional() _target: EntityTarget<MessageEntity>,
    entityManager: EntityManager,
  ) {
    super(MessageEntity, entityManager);
  }

  public async createMessage(input: {
    prompt: string;
    response: string | null;
    userId: string;
  }): Promise<MessageEntity> {
    const message = this.create({
      prompt: input.prompt,
      response: input.response,
      userId: input.userId,
    });

    return this.save(message);
  }

  public async getLastMessages(
    userId: string,
    limit: number,
  ): Promise<MessageEntity[]> {
    return this.find({
      where: { userId },
      order: { createdAt: 'DESC' },
      take: limit,
    });
  }

  public async deleteMessages(userId: string): Promise<void> {
    await this.softDelete({ userId });
  }
}
