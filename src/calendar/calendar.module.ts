import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CalendarController } from './calendar.controller';
import { CalendarService } from './calendar.service';
import { UserGoogleTokenEntity } from '../data/entities/user-google-token.entity';

@Module({
  imports: [TypeOrmModule.forFeature([UserGoogleTokenEntity])],
  controllers: [CalendarController],
  providers: [CalendarService],
  exports: [CalendarService],
})
export class CalendarModule {}
