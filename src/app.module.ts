import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { DatabaseModule } from './data/database.module';
import { ConfigModule } from '@nestjs/config';
import { AIModule } from './ai/ai.module';
import { AuthModule } from './auth/auth.module';
import { GoogleTokenModule } from './google-token/google-token.module';

@Module({
  imports: [
    AIModule,
    AuthModule,
    GoogleTokenModule,
    DatabaseModule,
    ConfigModule.forRoot({ isGlobal: true }),
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
