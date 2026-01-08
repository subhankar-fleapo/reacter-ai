import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity('calendar_tokens')
export class CalendarToken {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  userId: string;

  @Column({ type: 'text' })
  accessToken: string;

  @Column({ type: 'text' })
  refreshToken: string;

  @Column({ type: 'bigint' })
  expiryDate: number;

  @Column({ default: true })
  isConnected: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}