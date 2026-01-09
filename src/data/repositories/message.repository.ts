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
}
