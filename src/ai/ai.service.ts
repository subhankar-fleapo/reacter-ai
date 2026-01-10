import { HttpService } from '@nestjs/axios';
import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { Actions, Tools } from './dto';
import { AIResponseDto, AIResponseOutput } from './dto/ai.dto';

@Injectable()
export class AIService {
  constructor(private readonly httpService: HttpService) {}

  public async generateResponse(input: {
    prompt: string;
    history?: { role: 'user' | 'assistant'; content: string }[];
  }): Promise<AIResponseDto> {
    const now = new Date().toISOString();
    try {
      const messages: any[] = [
        {
          role: 'system',
          content: `Today is ${now}. Use this as the reference for words like today, tomorrow, yesterday. 
          You are a helpful assistant that manages google calendar.
          If the user wants to perform an action (create, update, delete), you must ensure you have all the necessary details.
          For 'create' and 'update', you NEED 'title', 'startDateTime', and 'endDateTime'.
          
          CRITICAL:
          - Ensure 'startDateTime' is BEFORE 'endDateTime'.
          - Ensure BOTH 'startDateTime' and 'endDateTime' are in the FUTURE. 
          - If the start or end time is in the past, set 'action' to 'chat' and prompt for a future time.
          - If the times are invalid (end before start), set 'action' to 'chat' and ask for correction.

          If any of these are missing, ambiguous, or invalid, you MUST NOT return a 'create' or 'update' action.
          Instead, you should return a response asking the user for the missing details or correction.
          The 'response' field should contain the question to the user.
          Do NOT make up dates or times.
          
          If the user's request is not about calendar actions, or if you need more info, just chat with them.
          Set the 'action' to 'create' ONLY when you have ALL VALID details (title, startDateTime, endDateTime).
          
          RESPONSE STYLE:
- Be polite and respectful
- Use natural language phrasing.
- Instead of "provide start time", ask "What time will [Title] start?"
- Instead of "end time", ask "How long will [Title] last?"
- ALWAYS include the event title in the question if available.
- Keep responses short max 20 words
- Never mention "start time" or "end time" as technical terms to the user
- ASK ONLY ONE QUESTION AT A TIME. 
- Order of asking if missing: 1. Title, 2. Date, 3. Start Time, 4. Duration.
- NEVER ask for "start and end time" together.
- NEVER ask for "date and time" together.
- Do NOT explain anything

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
          model: 'openai/gpt-5.2',
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
                  },
                  action: {
                    type: 'string',
                    enum: Object.values(Actions),
                  },
                  response: {
                    type: 'string',
                  },
                },
                required: [
                  'title',
                  'startDateTime',
                  'endDateTime',
                  'tool',
                  'action',
                  'response',
                ],
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
