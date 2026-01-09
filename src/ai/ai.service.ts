import { HttpService } from '@nestjs/axios';
import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { Actions, Tools } from './dto';
import { AIResponseDto, AIResponseOutput } from './dto/ai.dto';

const now = new Date().toISOString();

@Injectable()
export class AIService {
  constructor(private readonly httpService: HttpService) {}

  public async generateResponse(input: {
    prompt: string;
    history?: { role: 'user' | 'assistant'; content: string }[];
  }): Promise<AIResponseDto> {
    try {
      const messages: any[] = [
        {
          role: 'system',
          content: `Today is ${now}. Use this as the reference for words like today, tomorrow, yesterday. 
          You are a helpful assistant that manages google calendar.
          If the user wants to perform an action (create, update, delete), you must ensure you have all the necessary details.
          For 'create' and 'update', you NEED 'title', 'startDateTime', and 'endDateTime'.
          If any of these are missing or ambiguous, you MUST NOT return a 'create' or 'update' action.
          Instead, you should return a response asking the user for the missing details.
          The 'response' field should contain the question to the user.
          Do NOT make up dates or times.
          
          If the user's request is not about calendar actions, or if you need more info, just chat with them.
          Set the 'action' to 'create' ONLY when you have ALL details (title, startDateTime, endDateTime).
          `,
        },
        ...(input.history || []),
        {
          role: 'user',
          content: input.prompt,
        },
      ];

      const { data } = await this.httpService.axiosRef.post<AIResponseOutput>(
        '/chat/completions',
        {
          model: 'mistralai/devstral-2512:free',
          stream: false,
          messages,
          response_format: {
            type: 'json_schema',
            json_schema: {
              name: 'schema',
              strict: true,
              schema: {
                type: 'object',
                properties: {
                  title: {
                    type: 'string',
                    description: 'Title of the meeting',
                  },
                  startDateTime: {
                    type: 'string',
                    description:
                      'Start date-time in ISO 8601 format ONLY (YYYY-MM-DDTHH:mm:ss.sss)',
                  },
                  endDateTime: {
                    type: 'string',
                    description:
                      'End date-time in ISO 8601 format ONLY (YYYY-MM-DDTHH:mm:ss.sss)',
                  },
                  tool: {
                    type: 'string',
                    enum: Object.values(Tools),
                    description: 'Tool that has to be used',
                  },
                  action: {
                    type: 'string',
                    enum: Object.values(Actions),
                    description: 'Action to be performed',
                  },
                  response: {
                    type: 'string',
                    description: 'Response from the model',
                  },
                },
                required: ['tool', 'action', 'response'],
                additionalProperties: false,
              },
            },
          },
        },
      );

      const response = data.choices.at(0)?.message?.content;

      if (!response) {
        throw new InternalServerErrorException('Failed to generate response');
      }

      console.log('Token Usage =>', {
        completionTokens: data.usage.completion_tokens,
        promptTokens: data.usage.prompt_tokens,
        totalTokens: data.usage.total_tokens,
      });

      return response;
    } catch (error) {
      console.error(error);
      throw new InternalServerErrorException(error);
    }
  }
}
