import { Actions } from './actions.enum';
import { Tools } from './tools.enum';

export class AIResponseDto {
  title: string;

  startDateTime: string;

  endDateTime: string;

  tool: Tools;

  action: Actions;

  response: string;
}

export class AIResponseOutput {
  choices: {
    message: {
      content: AIResponseDto;
    };
  }[];

  usage: {
    prompt_tokens: number;

    completion_tokens: number;

    total_tokens: number;
  };
}
