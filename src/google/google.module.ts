import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UserGoogleTokenEntity } from '../data/entities/user-google-token.entity';
import { GoogleController } from './google.controller';
import { GoogleService } from './google.service';
import { UsersEntity } from '../data/entities/users.entity';

@Module({
  imports: [TypeOrmModule.forFeature([UserGoogleTokenEntity, UsersEntity])],
  controllers: [GoogleController],
  providers: [GoogleService],
  exports: [GoogleService],
})
export class GoogleModule {}
