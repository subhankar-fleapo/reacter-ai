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
  CalendarEventRepository,
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
    private readonly calendarEventRepository: CalendarEventRepository,
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

      const history = await this.messageRepository.getLastMessages(user.id);

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

      console.log(parsedResponse);

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
          // Use title or original message as search query
          const searchQuery =
            parsedResponse.title || phoneDto.message || parsedResponse.eventId;
          const updateResult = await this.updateGoogleEvent(
            user.id,
            searchQuery,
            parsedResponse,
          );
          if (!updateResult.success) {
            return {
              message: updateResult.message || 'Provided event not found',
              success: false,
              phone,
            };
          }
          return {
            message: parsedResponse.response || 'Event updated successfully',
            success: true,
            phone,
          };
        }
      } else if (action === 'delete') {
        // Use title or original message as search query
        const searchQuery =
          parsedResponse.title || phoneDto.message || parsedResponse.eventId;
        const deleteResult = await this.deleteGoogleEvent(user.id, searchQuery);
        if (!deleteResult.success) {
          return {
            message: deleteResult.message || 'Provided event not found',
            success: false,
            phone,
          };
        }
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

    // Get user's timezone offset
    const user = await this.usersRepository.findOne({ where: { id: userId } });
    const timezone = this.getTimezoneFromOffset(
      user?.timezoneOffset || '+05:30',
    );

    const googleEvent = await this.googleCalendarService.createEvent(
      calendar,
      calendarId,
      dto,
      timezone,
    );

    // Save event to database for future reference
    await this.calendarEventRepository.createEvent({
      userId,
      googleEventId: googleEvent.data.id!,
      title: dto.title,
      description: (dto as any).description || null,
      startDateTime: new Date(dto.startDateTime),
      endDateTime: new Date(dto.endDateTime),
      calendarId,
    });
  }

  public async updateGoogleEvent(
    userId: string,
    searchQuery: string,
    dto: AIResponseDto,
  ): Promise<{ success: boolean; message?: string }> {
    // Find event in database by search query
    const dbEvents = await this.calendarEventRepository.searchByTitle(
      userId,
      searchQuery,
    );

    if (dbEvents.length === 0) {
      return { success: false, message: 'Provided event not found' };
    }

    // Use the first matching event (most recent)
    const dbEvent = dbEvents[0];
    if (!dbEvent) {
      return { success: false, message: 'Provided event not found' };
    }

    const googleEventId = dbEvent.googleEventId;

    const { calendar, calendarId } =
      await this.getAuthenticatedCalendarClient(userId);

    // Get user's timezone offset
    const user = await this.usersRepository.findOne({ where: { id: userId } });
    const timezone = this.getTimezoneFromOffset(
      user?.timezoneOffset || '+05:30',
    );

    // Update in Google Calendar
    await this.googleCalendarService.updateEvent(
      calendar,
      calendarId,
      googleEventId,
      dto,
      timezone,
    );

    // Update in database
    await this.calendarEventRepository.updateEvent(dbEvent.id, {
      title: dto.title || dbEvent.title,
      description: (dto as any).description || dbEvent.description,
      startDateTime: dto.startDateTime
        ? new Date(dto.startDateTime)
        : dbEvent.startDateTime,
      endDateTime: dto.endDateTime
        ? new Date(dto.endDateTime)
        : dbEvent.endDateTime,
    });

    return { success: true };
  }

  public async deleteGoogleEvent(
    userId: string,
    searchQuery: string,
  ): Promise<{ success: boolean; message?: string }> {
    // Find event in database by search query
    const dbEvents = await this.calendarEventRepository.searchByTitle(
      userId,
      searchQuery,
    );

    if (dbEvents.length === 0) {
      return { success: false, message: 'Provided event not found' };
    }

    // Use the first matching event (most recent)
    const dbEvent = dbEvents[0];
    if (!dbEvent) {
      return { success: false, message: 'Provided event not found' };
    }

    const googleEventId = dbEvent.googleEventId;

    const { calendar, calendarId } =
      await this.getAuthenticatedCalendarClient(userId);

    // Delete from Google Calendar
    await this.googleCalendarService.deleteEvent(
      calendar,
      calendarId,
      googleEventId,
    );

    // Soft delete in database
    await this.calendarEventRepository.deleteEvent(dbEvent.id);

    return { success: true };
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

  private getTimezoneFromOffset(offset: string): string {
    // If it's already an IANA timezone (contains '/'), return as is
    if (offset.includes('/')) {
      return offset;
    }

    // Common timezone offset to IANA mapping
    const offsetToTimezone: Record<string, string> = {
      '-12:00': 'Etc/GMT+12',
      '-11:00': 'Pacific/Pago_Pago',
      '-10:00': 'Pacific/Honolulu',
      '-09:30': 'Pacific/Marquesas',
      '-09:00': 'America/Anchorage',
      '-08:00': 'America/Los_Angeles',
      '-07:00': 'America/Denver',
      '-06:00': 'America/Chicago',
      '-05:00': 'America/New_York',
      '-04:00': 'America/Halifax',
      '-03:30': 'America/St_Johns',
      '-03:00': 'America/Sao_Paulo',
      '-02:00': 'Etc/GMT+2',
      '-01:00': 'Atlantic/Azores',
      '+00:00': 'UTC',
      '+01:00': 'Europe/Paris',
      '+02:00': 'Europe/Athens',
      '+03:00': 'Europe/Moscow',
      '+03:30': 'Asia/Tehran',
      '+04:00': 'Asia/Dubai',
      '+04:30': 'Asia/Kabul',
      '+05:00': 'Asia/Karachi',
      '+05:30': 'Asia/Kolkata',
      '+05:45': 'Asia/Kathmandu',
      '+06:00': 'Asia/Dhaka',
      '+06:30': 'Asia/Yangon',
      '+07:00': 'Asia/Bangkok',
      '+08:00': 'Asia/Shanghai',
      '+08:45': 'Australia/Eucla',
      '+09:00': 'Asia/Tokyo',
      '+09:30': 'Australia/Adelaide',
      '+10:00': 'Australia/Sydney',
      '+10:30': 'Australia/Lord_Howe',
      '+11:00': 'Pacific/Guadalcanal',
      '+12:00': 'Pacific/Auckland',
      '+12:45': 'Pacific/Chatham',
      '+13:00': 'Pacific/Tongatapu',
      '+14:00': 'Pacific/Kiritimati',
    };

    // Try to find exact match
    if (offsetToTimezone[offset]) {
      return offsetToTimezone[offset];
    }

    // If no match, default to Asia/Kolkata
    return 'Asia/Kolkata';
  }
}
