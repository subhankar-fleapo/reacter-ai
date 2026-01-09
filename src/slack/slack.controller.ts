import {
  Controller,
  Get,
  InternalServerErrorException,
  Query,
  Req,
  Res,
} from '@nestjs/common';
import { SlackService } from './slack.service';
import { ConfigService } from '@nestjs/config';
import { Response, Request } from 'express';

@Controller('/slack')
export class SlackController {
  constructor(
    private readonly configService: ConfigService,
    private readonly service: SlackService,
  ) {}

  @Get('/authorize')
  authorize(@Res() res: Response) {
    const scopes = 'users.profile:write';
    const url = `https://slack.com/oauth/v2/authorize?client_id=${this.configService.getOrThrow('SLACK_CLIENT_ID')}&user_scope=${encodeURIComponent(scopes)}&redirect_uri=${encodeURIComponent(this.configService.getOrThrow('SLACK_REDIRECT_URI'))}`;
    return res.redirect(url);
  }

  @Get('/authorize/callback')
  async callback(@Req() req: Request, @Query('code') code: string) {
    console.log(1, req.query, code);

    try {
      const data = await fetch('https://slack.com/api/oauth.v2.access', {
        method: 'POST',
        body: new URLSearchParams({
          code,
          grant_type: 'authorization_code',
          client_id: this.configService.getOrThrow('SLACK_CLIENT_ID'),
          client_secret: this.configService.getOrThrow('SLACK_CLIENT_SECRET'),
          redirect_uri: this.configService.getOrThrow('SLACK_REDIRECT_URI'),
        }),
      });

      const res = await data.json();

      const accessToken = res.authed_user.access_token;

      return accessToken;
    } catch (error) {
      console.log(error);
      throw new InternalServerErrorException(error);
    }
  }

  @Get('/profile')
  async profile() {
    return this.service.sendMessage(
      '#test-integration',
      'Event Created Successfully!',
    );
  }
}
