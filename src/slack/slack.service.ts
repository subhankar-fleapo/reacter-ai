import { Injectable } from '@nestjs/common';

@Injectable()
export class SlackService {
  constructor() {}

  async generateResponse(): Promise<string> {
    return 'hello';
  }
}
