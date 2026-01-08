import { Actions } from './actions.enum';
import { Tools } from './tools.enum';

export class AIResponseOutput {
  choices: {
    message: {
      content: {
        tool: Tools;

        action: Actions;

        response: string;
      };
    };
  }[];

  usage: {
    prompt_tokens: number;

    completion_tokens: number;

    total_tokens: number;
  };
}
