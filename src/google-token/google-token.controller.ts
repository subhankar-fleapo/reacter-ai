import { Body, Controller, Get, Headers, Post, Query } from '@nestjs/common';
import { GoogleTokenService } from './google-token.service';
import {
  GetGoogleTokenByPhoneDto,
  UpsertGoogleTokenDto,
} from './google-token.dto';

@Controller('google-token')
export class GoogleTokenController {
  constructor(private readonly service: GoogleTokenService) {}

  @Get()
  getMine(@Headers('authorization') authorization: string) {
    return this.service.getForUser(authorization);
  }

  @Post('by-phone')
  getByPhone(
    @Query('phone') phone: string,
    @Body() phoneDto: GetGoogleTokenByPhoneDto,
  ) {
    return this.service.getForPhone(phone, phoneDto);
  }

  @Post()
  saveMine(
    @Headers('authorization') authorization: string,
    @Body() dto: UpsertGoogleTokenDto,
  ) {
    return this.service.upsertForUser(authorization, dto);
  }
}
