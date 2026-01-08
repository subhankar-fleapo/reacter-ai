import { Injectable, Optional } from '@nestjs/common';
import { EntityManager, EntityTarget, Repository } from 'typeorm';
import { UsersEntity } from '../entities';

@Injectable()
export class UsersRepository extends Repository<UsersEntity> {
  constructor(
    @Optional() _target: EntityTarget<UsersEntity>,
    entityManager: EntityManager,
  ) {
    super(UsersEntity, entityManager);
  }

  public getUserById(input: { id: string }): Promise<UsersEntity> {
    return this.findOneByOrFail({ id: input.id });
  }
}
