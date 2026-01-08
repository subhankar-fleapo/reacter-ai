import { Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { google } from 'googleapis';
import { CalendarToken } from './entities/calendar-token.entity';
import { CreateEventDto } from './dto/create-event.dto';
import { UpdateEventDto } from './dto/update-event.dto';

@Injectable()
export class CalendarService {
  private oauth2Client;

  constructor(
    @InjectRepository(CalendarToken)
    private calendarTokenRepository: Repository<CalendarToken>,
  ) {
    this.oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      process.env.GOOGLE_REDIRECT_URI,
    );
  }

  async checkConnection(userId: string): Promise<{ isConnected: boolean }> {
    const token = await this.calendarTokenRepository.findOne({
      where: { userId, isConnected: true },
    });
    return { isConnected: !!token };
  }

  generateAuthUrl(): string {
    const scopes = [
      'https://www.googleapis.com/auth/calendar',
      'https://www.googleapis.com/auth/calendar.events',
    ];

    return this.oauth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: scopes,
      prompt: 'consent',
    });
  }

  async saveTokens(userId: string, code: string): Promise<CalendarToken> {
    const { tokens } = await this.oauth2Client.getToken(code);
    
    let calendarToken = await this.calendarTokenRepository.findOne({
      where: { userId },
    });

    if (calendarToken) {
      calendarToken.accessToken = tokens.access_token;
      calendarToken.refreshToken = tokens.refresh_token || calendarToken.refreshToken;
      calendarToken.expiryDate = tokens.expiry_date;
      calendarToken.isConnected = true;
    } else {
      calendarToken = this.calendarTokenRepository.create({
        userId,
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token,
        expiryDate: tokens.expiry_date,
        isConnected: true,
      });
    }

    return this.calendarTokenRepository.save(calendarToken);
  }

  private async getAuthenticatedClient(userId: string) {
    const token = await this.calendarTokenRepository.findOne({
      where: { userId, isConnected: true },
    });

    if (!token) {
      throw new UnauthorizedException('Calendar not connected');
    }

    this.oauth2Client.setCredentials({
      access_token: token.accessToken,
      refresh_token: token.refreshToken,
      expiry_date: token.expiryDate,
    });

    return google.calendar({ version: 'v3', auth: this.oauth2Client });
  }

  async getEvents(userId: string, timeMin?: string, timeMax?: string) {
    const calendar = await this.getAuthenticatedClient(userId);

    const response = await calendar.events.list({
      calendarId: 'primary',
      timeMin: timeMin || new Date().toISOString(),
      timeMax: timeMax,
      maxResults: 100,
      singleEvents: true,
      orderBy: 'startTime',
    });

    return response.data.items;
  }

  async createEvent(userId: string, createEventDto: CreateEventDto) {
    const calendar = await this.getAuthenticatedClient(userId);

    const event = {
      summary: createEventDto.summary,
      description: createEventDto.description,
      location: createEventDto.location,
      start: {
        dateTime: createEventDto.startDateTime,
        timeZone: createEventDto.timeZone || 'UTC',
      },
      end: {
        dateTime: createEventDto.endDateTime,
        timeZone: createEventDto.timeZone || 'UTC',
      },
      attendees: createEventDto.attendees?.map(email => ({ email })),
    };

    const response = await calendar.events.insert({
      calendarId: 'primary',
      requestBody: event,
    });

    return response.data;
  }

  async getEvent(userId: string, eventId: string) {
    const calendar = await this.getAuthenticatedClient(userId);

    const response = await calendar.events.get({
      calendarId: 'primary',
      eventId: eventId,
    });

    return response.data;
  }

  async updateEvent(userId: string, eventId: string, updateEventDto: UpdateEventDto) {
    const calendar = await this.getAuthenticatedClient(userId);

    const existingEvent = await this.getEvent(userId, eventId);

    const updatedEvent = {
      ...existingEvent,
      summary: updateEventDto.summary || existingEvent.summary,
      description: updateEventDto.description || existingEvent.description,
      location: updateEventDto.location || existingEvent.location,
      start: updateEventDto.startDateTime ? {
        dateTime: updateEventDto.startDateTime,
        timeZone: updateEventDto.timeZone || 'UTC',
      } : existingEvent.start,
      end: updateEventDto.endDateTime ? {
        dateTime: updateEventDto.endDateTime,
        timeZone: updateEventDto.timeZone || 'UTC',
      } : existingEvent.end,
      attendees: updateEventDto.attendees?.map(email => ({ email })) || existingEvent.attendees,
    };

    const response = await calendar.events.update({
      calendarId: 'primary',
      eventId: eventId,
      requestBody: updatedEvent,
    });

    return response.data;
  }

  async deleteEvent(userId: string, eventId: string) {
    const calendar = await this.getAuthenticatedClient(userId);

    await calendar.events.delete({
      calendarId: 'primary',
      eventId: eventId,
    });

    return { message: 'Event deleted successfully' };
  }
}