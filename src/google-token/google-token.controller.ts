import { Body, Controller, Get, Headers, Post, Query } from '@nestjs/common';
import { GetGoogleTokenByPhoneDto, UpsertGoogleTokenDto } from './dto';
import { GoogleTokenService } from './google-token.service';

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

  @Get('verify-user')
  verifyUser(@Query('phone') phone: string) {
    return this.service.verifyUser(phone);
  }

  @Post()
  saveMine(
    @Headers('authorization') authorization: string,
    @Body() dto: UpsertGoogleTokenDto,
  ) {
    return this.service.upsertForUser(authorization, dto);
  }
}
