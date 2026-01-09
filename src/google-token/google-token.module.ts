import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { AIModule } from 'src/ai/ai.module';
import { DatabaseModule } from '../data/database.module';
import { GoogleTokenController } from './google-token.controller';
import { GoogleTokenService } from './google-token.service';
import { HttpModule } from '@nestjs/axios';

@Module({
  imports: [
    AIModule,
    DatabaseModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        secret: configService.getOrThrow('JWT_SECRET'),
        signOptions: {
          expiresIn: configService.get('JWT_EXPIRES_IN') ?? '1h',
        },
      }),
    }),
  ],
  controllers: [GoogleTokenController],
  providers: [GoogleTokenService],
})
export class GoogleTokenModule {}
