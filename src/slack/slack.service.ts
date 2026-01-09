import { Injectable } from '@nestjs/common';

@Injectable()
export class SlackService {
  constructor() {}

  async generateResponse(input: { prompt: string }): Promise<string> {
    return 'hello';
  }
}
