import { Controller, Get, Headers, Query } from '@nestjs/common';
import { GoogleService } from './google.service';

@Controller('google')
export class GoogleController {
  constructor(private readonly googleService: GoogleService) {}

  @Get('check-connection')
  async checkConnection(@Headers('user-id') userId: string) {
    return this.googleService.checkConnection(userId);
  }

  @Get('auth-url')
  getAuthUrl() {
    const url = this.googleService.generateAuthUrl();
    return { authUrl: url };
  }

  @Get('callback')
  async handleCallback(
    @Query('code') code: string,
    @Query('userId') userId: string,
  ) {
    const token = await this.googleService.saveTokens(userId, code);
    return { message: 'Google account connected successfully', token };
  }
}
