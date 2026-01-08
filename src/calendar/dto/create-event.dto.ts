export class CreateEventDto {
  summary: string;
  description?: string;
  location?: string;
  startDateTime: string;
  endDateTime: string;
  timeZone?: string;
  attendees?: string[];
}