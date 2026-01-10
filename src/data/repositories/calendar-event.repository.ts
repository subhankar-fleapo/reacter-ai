import { Injectable, Optional } from '@nestjs/common';
import { EntityManager, EntityTarget, Repository } from 'typeorm';
import { CalendarEventEntity } from '../entities';

@Injectable()
export class CalendarEventRepository extends Repository<CalendarEventEntity> {
  constructor(
    @Optional() _target: EntityTarget<CalendarEventEntity>,
    entityManager: EntityManager,
  ) {
    super(CalendarEventEntity, entityManager);
  }

  public async createEvent(input: {
    userId: string;
    googleEventId: string;
    title: string;
    description: string | null;
    startDateTime: Date;
    endDateTime: Date;
    calendarId: string;
  }): Promise<CalendarEventEntity> {
    const event = this.create({
      userId: input.userId,
      googleEventId: input.googleEventId,
      title: input.title,
      description: input.description,
      startDateTime: input.startDateTime,
      endDateTime: input.endDateTime,
      calendarId: input.calendarId,
    });

    return this.save(event);
  }

  public async findByGoogleEventId(
    googleEventId: string,
  ): Promise<CalendarEventEntity | null> {
    return this.findOne({
      where: { googleEventId },
    });
  }

  public async findByUserId(userId: string): Promise<CalendarEventEntity[]> {
    return this.find({
      where: { userId },
      order: { startDateTime: 'ASC' },
    });
  }

  public async searchByTitle(
    userId: string,
    searchQuery: string,
  ): Promise<CalendarEventEntity[]> {
    return this.createQueryBuilder('event')
      .where('event.user_id = :userId', { userId })
      .andWhere('event.title ILIKE :searchQuery', {
        searchQuery: `%${searchQuery}%`,
      })
      .andWhere('event.deleted_at IS NULL')
      .orderBy('event.start_date_time', 'DESC')
      .getMany();
  }

  public async updateEvent(
    id: string,
    input: {
      title?: string;
      description?: string | null;
      startDateTime?: Date;
      endDateTime?: Date;
    },
  ): Promise<CalendarEventEntity> {
    await this.update(id, input);
    return this.findOneByOrFail({ id });
  }

  public async deleteEvent(id: string): Promise<void> {
    await this.softDelete({ id });
  }
}
