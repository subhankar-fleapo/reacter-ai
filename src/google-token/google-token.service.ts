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
  ) {}

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

    await this.createGoogleEvent(response, user.id);

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
    const user = await this.googleTokenRepository.findByUserId(userId);

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    // console.log({user})

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

    const jsonDto = JSON.parse(dto as any);

    oauth2Client.setCredentials({
      access_token: user.accessToken,
      refresh_token: user.refreshToken,
      expiry_date: user.expiresAt.getTime(),
    });

    if (new Date(user.expiresAt).getTime() < Date.now()) {
      const { credentials } = await oauth2Client.refreshAccessToken();

      //TODO: save the new tokes to the user
    }

    const calendar = google.calendar({ version: 'v3', auth: oauth2Client });

    const calendarList = await calendar.calendarList.list();

    const calendars = calendarList.data.items;

    const writableCal = calendars!.find(
      (cal) => cal.summary === 'Reacter Calendar 4',
    );

    await calendar.events.insert({
      calendarId: writableCal!.id!,
      requestBody: {
        summary: jsonDto.title,
        description: 'test desc',
        start: {
          dateTime: new Date(jsonDto.startDateTime).toISOString(),
          timeZone: 'Asia/Kolkata',
        },
        end: {
          dateTime: new Date(jsonDto.endDateTime).toISOString(),
          timeZone: 'Asia/Kolkata',
        },
      },
    });
  }

  public async oauth2callback(code: string, state: string) {}
}
