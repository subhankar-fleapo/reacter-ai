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

  public findByPhone(phone: string): Promise<UsersEntity | null> {
    return this.findOne({ where: { phone } });
  }

  public async createUser(input: {
    phone: string;
    password: string;
  }): Promise<UsersEntity> {
    const user = this.create({
      phone: input.phone,
      password: input.password,
    });

    return this.save(user);
  }
}
