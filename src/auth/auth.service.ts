import {
  BadRequestException,
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { randomBytes, scrypt as _scrypt, timingSafeEqual } from 'crypto';
import { promisify } from 'util';
import { UsersRepository } from '../data/repositories';
import { LoginDto, SignupDto } from './dto/auth.dto';
import { UsersEntity } from '../data/entities';
import { JwtService } from '@nestjs/jwt';

const scrypt = promisify(_scrypt);

@Injectable()
export class AuthService {
  constructor(
    private readonly usersRepository: UsersRepository,
    private readonly jwtService: JwtService,
  ) {}

  async signup(dto: SignupDto) {
    const { phone, password } = this.validateCredentials(dto);

    const existingUser = await this.usersRepository.findByPhone(phone);
    if (existingUser) {
      throw new ConflictException('Phone already registered');
    }

    const hashedPassword = await this.hashPassword(password);
    const user = await this.usersRepository.createUser({
      phone,
      password: hashedPassword,
    });

    const safeUser = this.sanitizeUser(user);
    return {
      user: safeUser,
      accessToken: this.signToken(user),
    };
  }

  async login(dto: LoginDto) {
    const { phone, password } = this.validateCredentials(dto);

    const user = await this.usersRepository.findByPhone(phone);
    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const passwordMatches = await this.verifyPassword(password, user.password);
    if (!passwordMatches) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const safeUser = this.sanitizeUser(user);
    return {
      user: safeUser,
      accessToken: this.signToken(user),
    };
  }

  private validateCredentials(dto: { phone: string; password: string }) {
    const phone = dto.phone?.trim();
    const password = dto.password?.trim();

    if (!phone || !password) {
      throw new BadRequestException('Phone and password are required');
    }

    return { phone, password };
  }

  private async hashPassword(password: string): Promise<string> {
    const salt = randomBytes(16).toString('hex');
    const derivedKey = (await scrypt(password, salt, 32)) as Buffer;
    return `${salt}:${derivedKey.toString('hex')}`;
  }

  private async verifyPassword(
    password: string,
    storedValue: string,
  ): Promise<boolean> {
    const [salt, storedHash] = storedValue.split(':');
    if (!salt || !storedHash) {
      return false;
    }

    const derivedKey = (await scrypt(password, salt, 32)) as Buffer;
    const storedBuffer = Buffer.from(storedHash, 'hex');

    if (derivedKey.length !== storedBuffer.length) {
      return false;
    }

    return timingSafeEqual(derivedKey, storedBuffer);
  }

  private sanitizeUser(user: UsersEntity) {
    const safeUser = { ...user };
    delete (safeUser as Partial<UsersEntity>).password;
    return safeUser;
  }

  private signToken(user: UsersEntity) {
    return this.jwtService.sign({
      sub: user.id,
      phone: user.phone,
    });
  }
}
