import { Module } from '@nestjs/common';
import { AIService } from './ai.service';
import { HttpModule } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';

@Module({
  imports: [
    HttpModule.registerAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        baseURL: 'https://openrouter.ai/api/v1',
        timeout: 5000,
        maxRedirects: 5,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${configService.getOrThrow('OPENROUTER_API_KEY')}`,
        },
      }),
    }),
  ],
  providers: [AIService],
  exports: [AIService, HttpModule],
})
export class AIModule {}
