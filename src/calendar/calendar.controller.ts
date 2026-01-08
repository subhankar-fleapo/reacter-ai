import { Controller, Get, Post, Put, Delete, Body, Param, Query, Headers } from '@nestjs/common';
import { CalendarService } from './calendar.service';
import { CreateEventDto } from './dto/create-event.dto';
import { UpdateEventDto } from './dto/update-event.dto';

@Controller('calendar')
export class CalendarController {
  constructor(private readonly calendarService: CalendarService) {}

  @Get('check-connection')
  async checkConnection(@Headers('user-id') userId: string) {
    return this.calendarService.checkConnection(userId);
  }

  @Get('auth-url')
  getAuthUrl() {
    const url = this.calendarService.generateAuthUrl();
    return { authUrl: url };
  }

  @Post('callback')
  async handleCallback(
    @Body('code') code: string,
    @Body('userId') userId: string,
  ) {
    const token = await this.calendarService.saveTokens(userId, code);
    return { message: 'Calendar connected successfully', token };
  }

  @Get('events')
  async getEvents(
    @Headers('user-id') userId: string,
    @Query('timeMin') timeMin?: string,
    @Query('timeMax') timeMax?: string,
  ) {
    return this.calendarService.getEvents(userId, timeMin, timeMax);
  }

  @Post('events')
  async createEvent(
    @Headers('user-id') userId: string,
    @Body() createEventDto: CreateEventDto,
  ) {
    return this.calendarService.createEvent(userId, createEventDto);
  }

  @Get('events/:eventId')
  async getEvent(
    @Headers('user-id') userId: string,
    @Param('eventId') eventId: string,
  ) {
    return this.calendarService.getEvent(userId, eventId);
  }

  @Put('events/:eventId')
  async updateEvent(
    @Headers('user-id') userId: string,
    @Param('eventId') eventId: string,
    @Body() updateEventDto: UpdateEventDto,
  ) {
    return this.calendarService.updateEvent(userId, eventId, updateEventDto);
  }

  @Delete('events/:eventId')
  async deleteEvent(
    @Headers('user-id') userId: string,
    @Param('eventId') eventId: string,
  ) {
    return this.calendarService.deleteEvent(userId, eventId);
  }
}