import { Injectable } from '@nestjs/common';
import { App } from '@slack/bolt';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class SlackService {
  private app: App;

  constructor(private readonly configService: ConfigService) {
    this.app = new App({
      token: this.configService.get('SLACK_BOT_TOKEN'),
      signingSecret: this.configService.get('SLACK_SIGNING_SECRET'),
    });
  }

  async generateResponse(): Promise<string> {
    return 'hello';
  }

  async sendMessage(channel: string, text: string) {
    await this.app.client.chat.postMessage({
      channel,
      text,
    });
  }
}
