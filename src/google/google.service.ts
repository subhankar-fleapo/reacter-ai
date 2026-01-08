import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { google } from 'googleapis';
import { UserGoogleTokenEntity } from '../data/entities/user-google-token.entity';
import { UsersEntity } from '../data/entities/users.entity';

@Injectable()
export class GoogleService {
  private oauth2Client;

  constructor(
    @InjectRepository(UserGoogleTokenEntity)
    private userGoogleTokenRepository: Repository<UserGoogleTokenEntity>,
    @InjectRepository(UsersEntity)
    private usersRepository: Repository<UsersEntity>,
  ) {
    this.oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      process.env.GOOGLE_REDIRECT_URI,
    );
  }

  async checkConnection(userId: string): Promise<{ isConnected: boolean }> {
    const token = await this.userGoogleTokenRepository.findOne({
      where: { userId },
    });
    return { isConnected: !!token };
  }

  generateAuthUrl(): string {
    const scopes = [
      'https://www.googleapis.com/auth/calendar',
      'https://www.googleapis.com/auth/calendar.events',
      'https://www.googleapis.com/auth/userinfo.email',
    ];

    return this.oauth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: scopes,
      prompt: 'consent',
    });
  }

  async saveTokens(
    userId: string | undefined,
    code: string,
  ): Promise<UserGoogleTokenEntity> {
    const { tokens } = await this.oauth2Client.getToken(code);

    this.oauth2Client.setCredentials(tokens);
    const oauth2 = google.oauth2({
      auth: this.oauth2Client,
      version: 'v2',
    });
    const { data: userInfo } = await oauth2.userinfo.get();
    const email = userInfo.email;

    if (!email) {
      throw new BadRequestException('Email not found in Google account');
    }

    if (!userId) {
      const user = await this.usersRepository.findOne({ where: { email } });
      if (user) {
        userId = user.id;
      } else {
        const newUser = this.usersRepository.create({ email });
        const savedUser = await this.usersRepository.save(newUser);
        userId = savedUser.id;
      }
    }

    let userGoogleToken = await this.userGoogleTokenRepository.findOne({
      where: { userId },
    });

    if (userGoogleToken) {
      userGoogleToken.accessToken = tokens.access_token;
      userGoogleToken.refreshToken =
        tokens.refresh_token || userGoogleToken.refreshToken;
      userGoogleToken.expiresAt = tokens.expiry_date;
      userGoogleToken.email = email;
    } else {
      userGoogleToken = this.userGoogleTokenRepository.create({
        userId,
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token,
        expiresAt: tokens.expiry_date,
        email,
      });
    }

    return this.userGoogleTokenRepository.save(userGoogleToken);
  }
}
