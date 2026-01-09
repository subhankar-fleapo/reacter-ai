import {
  BadRequestException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import {
  UsersRepository,
  GoogleTokenRepository,
  MessageRepository,
} from '../data/repositories';
import {
  GetGoogleTokenByPhoneDto,
  UpsertGoogleTokenDto,
} from './google-token.dto';

@Injectable()
export class GoogleTokenService {
  constructor(
    private readonly jwtService: JwtService,
    private readonly usersRepository: UsersRepository,
    private readonly googleTokenRepository: GoogleTokenRepository,
    private readonly messageRepository: MessageRepository,
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
}
