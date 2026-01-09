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
import { authenticate } from '@google-cloud/local-auth';
import path from 'path';
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
  ) { }

  async getForUser(authHeader: string) {
    const user = await this.resolveUserFromAuth(authHeader);
    const record = await this.googleTokenRepository.findByUserId(user.id);
    return record ?? { exists: false };
  }

  async getForPhone(phone: string, phoneDto: GetGoogleTokenByPhoneDto) {
    const trimmedPhone = phone?.trim();
    if (!trimmedPhone) {
      throw new BadRequestException('phone is required');
    }
    const user = await this.usersRepository.findOne({
      where: { phone: trimmedPhone },
    });
    if (!user) {
      return { exists: false };
    }

    await this.messageRepository.createMessage({
      prompt: phoneDto.message,
      response: null,
      userId: user.id,
    });

    const response = await this.aiService.generateResponse({
      prompt: phoneDto.message,
    });

    console.log(response);


    const parsedResponse = JSON.parse(response as any);

    if (parsedResponse.action === 'create') {
      await this.createGoogleEvent(parsedResponse, user.id);
    } else if (parsedResponse.action === 'update') {
      await this.updateGoogleEvent(user.id, parsedResponse.eventId, parsedResponse);
    } else if (parsedResponse.action === 'delete') {
      await this.deleteGoogleEvent(user.id, parsedResponse.eventId);
    }

    const record = await this.googleTokenRepository.findByUserId(user.id);
    return record
      ? { exists: true, message: phoneDto.message }
      : { exists: false, message: phoneDto.message };
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
    const { calendar, calendarId } = await this.getAuthenticatedCalendarClient(
      userId,
    );

    await this.googleCalendarService.createEvent(calendar, calendarId, dto);
  }

  public async updateGoogleEvent(
    userId: string,
    eventId: string,
    dto: AIResponseDto,
  ) {
    const { calendar, calendarId } = await this.getAuthenticatedCalendarClient(
      userId,
    );
    await this.googleCalendarService.updateEvent(
      calendar,
      calendarId,
      eventId,
      dto,
    );
  }

  public async deleteGoogleEvent(userId: string, eventId: string) {
    const { calendar, calendarId } = await this.getAuthenticatedCalendarClient(
      userId,
    );

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

    const writableCal = calendars!.find(
      (cal) => cal.summary === 'Reacter Calendar 4',
    );

    if (!writableCal?.id) {
      throw new InternalServerErrorException('Calendar not found');
    }

    return { calendar, calendarId: writableCal.id };
  }

  public async oauth2callback(code: string, state: string) { }
}
