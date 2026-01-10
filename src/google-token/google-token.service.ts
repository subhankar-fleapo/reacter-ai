import { HttpService } from '@nestjs/axios';
import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { AIService } from 'src/ai/ai.service';
import { AIResponseDto } from 'src/ai/dto/ai.dto';
import {
  GoogleTokenRepository,
  MessageRepository,
  UsersRepository,
} from '../data/repositories';
import { GetGoogleTokenByPhoneDto, UpsertGoogleTokenDto } from './dto';
import { google } from 'googleapis';
import { ConfigService } from '@nestjs/config';
import { GoogleCalendarService } from 'src/google-calendar/google-calendar.service';

@Injectable()
export class GoogleTokenService {
  constructor(
    private readonly jwtService: JwtService,
    private readonly usersRepository: UsersRepository,
    private readonly googleTokenRepository: GoogleTokenRepository,
    private readonly messageRepository: MessageRepository,
    private readonly aiService: AIService,
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
    private readonly googleCalendarService: GoogleCalendarService,
  ) {}

  async getForUser(authHeader: string) {
    const user = await this.resolveUserFromAuth(authHeader);
    const record = await this.googleTokenRepository.findByUserId(user.id);
    return record ?? { exists: false };
  }

  async verifyUser(phone: string) {
    const trimmedPhone = phone?.trim();
    if (!trimmedPhone) {
      return {
        valid: false,
        googleConnected: false,
      };
    }

    const user = await this.usersRepository.findOne({
      where: { phone: trimmedPhone },
    });

    if (!user) {
      return {
        valid: false,
        googleConnected: false,
      };
    }

    const googleToken = await this.googleTokenRepository.findByUserId(user.id);

    return {
      valid: true,
      googleConnected: !!googleToken,
    };
  }

  async getForPhone(phone: string, phoneDto: GetGoogleTokenByPhoneDto) {
    try {
      const trimmedPhone = phone?.trim();
      if (!trimmedPhone) {
        throw new BadRequestException('phone is required');
      }
      const user = await this.usersRepository.findOne({
        where: { phone: trimmedPhone },
      });
      if (!user) {
        return {
          success: false,
          phone,
          message:
            'You are not registered with us. Please register here: https://reacterai.lovable.app/',
        };
      }

      const history = await this.messageRepository.getLastMessages(user.id, 10);

      const formattedHistory = history
        .map((msg) => {
          let content = msg.response;
          try {
            if (content) {
              const parsed = JSON.parse(content);
              if (parsed && parsed.response) {
                content = parsed.response;
              }
            }
          } catch {
            // ignore error, use original content
          }

          return [
            { role: 'user', content: msg.prompt },
            content ? { role: 'assistant', content: content } : null,
          ];
        })
        .flat()
        .filter((msg) => msg !== null)
        .reverse() as {
        role: 'user' | 'assistant';
        content: string;
      }[];

      const response = await this.aiService.generateResponse({
        prompt: phoneDto.message,
        history: formattedHistory,
      });

      await this.messageRepository.createMessage({
        prompt: phoneDto.message,
        response:
          typeof response === 'string' ? response : JSON.stringify(response),
        userId: user.id,
      });

      let parsedResponse: any = response;
      try {
        if (typeof response === 'string') {
          parsedResponse = JSON.parse(response);
        }
      } catch (e) {
        // If it's not JSON, it might be a plain text response (fallback)
        console.error('Failed to parse response', e);
        return {
          message: response as unknown as string,
          success: true,
          phone,
        };
      }

      if (!parsedResponse) {
        return {
          message: 'Something went wrong. Please try again.',
          success: false,
          phone,
        };
      }

      // If the AI just wants to chat or asks for info (action might be 'create' but missing fields)
      // Check for required fields for actions
      const { action } = parsedResponse;

      if (action === 'create' || action === 'update') {
        // delete all messages
        await this.messageRepository.deleteMessages(user.id);

        if (action === 'create') {
          await this.createGoogleEvent(parsedResponse, user.id);
          return {
            message: parsedResponse.response || 'Event created successfully',
            success: true,
            phone,
          };
        } else {
          await this.updateGoogleEvent(
            user.id,
            parsedResponse.eventId,
            parsedResponse,
          );
          return {
            message: parsedResponse.response || 'Event updated successfully',
            success: true,
            phone,
          };
        }
      } else if (action === 'delete') {
        await this.deleteGoogleEvent(user.id, parsedResponse.eventId);
        return {
          message: parsedResponse.response || 'Event deleted successfully',
          success: true,
          phone,
        };
      } else {
        // Fallback for other actions or just chat
        return {
          message: parsedResponse.response,
          success: true,
          phone,
        };
      }
    } catch (error) {
      console.error(error);
      return {
        message: 'Something went wrong. Please try again.',
        success: false,
        phone,
      };
    }
  }

  async upsertForUser(authHeader: string, dto: UpsertGoogleTokenDto) {
    const user = await this.resolveUserFromAuth(authHeader);
    const { email, accessToken, refreshToken, expiresAt } =
      this.validatePayload(dto);
    const saved = await this.googleTokenRepository.upsertForUser({
      user,
      email,
      accessToken,
      refreshToken,
      expiresAt,
    });
    return saved;
  }

  private async resolveUserFromAuth(authHeader: string) {
    const token = this.extractBearer(authHeader);
    let payload: { sub?: string };
    try {
      payload = this.jwtService.verify(token);
    } catch {
      throw new UnauthorizedException('Invalid access token');
    }
    if (!payload?.sub) {
      throw new UnauthorizedException('Invalid access token');
    }
    const user = await this.usersRepository.findOne({
      where: { id: payload.sub },
    });
    if (!user) {
      throw new UnauthorizedException('User not found');
    }
    return user;
  }

  private extractBearer(header: string) {
    if (!header) {
      throw new UnauthorizedException('Missing Authorization header');
    }
    const [scheme, token] = header.split(' ');
    if (!token || scheme?.toLowerCase() !== 'bearer') {
      throw new UnauthorizedException('Invalid Authorization header');
    }
    return token;
  }

  private validatePayload(dto: UpsertGoogleTokenDto) {
    const email = dto.email?.trim();
    const accessToken = dto.accessToken?.trim();
    const refreshToken = dto.refreshToken?.trim();
    const expiresAt = dto.expiresAt?.trim();

    if (!email || !accessToken || !refreshToken || !expiresAt) {
      throw new BadRequestException(
        'email, accessToken, refreshToken, expiresAt are required',
      );
    }

    const expiresDate = new Date(expiresAt);
    if (Number.isNaN(expiresDate.getTime())) {
      throw new BadRequestException('expiresAt must be a valid date');
    }

    return { email, accessToken, refreshToken, expiresAt: expiresDate };
  }

  public async createGoogleEvent(dto: AIResponseDto, userId: string) {
    const { calendar, calendarId } =
      await this.getAuthenticatedCalendarClient(userId);

    await this.googleCalendarService.createEvent(calendar, calendarId, dto);
  }

  public async updateGoogleEvent(
    userId: string,
    eventId: string,
    dto: AIResponseDto,
  ) {
    const { calendar, calendarId } =
      await this.getAuthenticatedCalendarClient(userId);
    await this.googleCalendarService.updateEvent(
      calendar,
      calendarId,
      eventId,
      dto,
    );
  }

  public async deleteGoogleEvent(userId: string, eventId: string) {
    const { calendar, calendarId } =
      await this.getAuthenticatedCalendarClient(userId);

    //list all google cal events
    const events = await calendar.events.list({
      calendarId,
      maxResults: 10,
      singleEvents: true,
      orderBy: 'startTime',
    });

    console.log(events.data.items);

    await this.googleCalendarService.deleteEvent(calendar, calendarId, eventId);
  }

  private async getAuthenticatedCalendarClient(userId: string) {
    const user = await this.googleTokenRepository.findByUserId(userId);

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    const oauth2Client = new google.auth.OAuth2(
      this.configService.get('GOOGLE_CLIENT_ID'),
      this.configService.get('GOOGLE_CLIENT_SECRET'),
      'http://localhost:8080/google/callback',
    );

    oauth2Client.setCredentials({
      access_token: user.accessToken,
      refresh_token: user.refreshToken,
      expiry_date: user.expiresAt.getTime(),
    });

    if (new Date(user.expiresAt).getTime() < Date.now()) {
      const { credentials } = await oauth2Client.refreshAccessToken();

      if (credentials.access_token) {
        user.accessToken = credentials.access_token;
      }
      if (credentials.refresh_token) {
        user.refreshToken = credentials.refresh_token;
      }
      if (credentials.expiry_date) {
        user.expiresAt = new Date(credentials.expiry_date);
      }

      await this.googleTokenRepository.save(user);
    }

    const calendar = google.calendar({ version: 'v3', auth: oauth2Client });

    const calendarList = await calendar.calendarList.list();

    const calendars = calendarList.data.items;

    const writableCalendars = calendars!.find(
      (cal) => cal.summary === 'Reacter Bookings',
    );

    let writableCalId = '';

    if (!writableCalendars) {
      const newWritableCal = await calendar.calendars.insert({
        requestBody: {
          summary: 'Reacters Bookings',
          timeZone: 'Asia/Kolkata',
          description: 'Calendar for events created via reacters platform',
        },
      });
      writableCalId = newWritableCal.data.id || '';
    } else {
      writableCalId = writableCalendars.id!;
    }

    if (!writableCalId) {
      throw new InternalServerErrorException('Calendar not found');
    }

    return { calendar, calendarId: writableCalId };
  }
}
