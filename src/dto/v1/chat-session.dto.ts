import { ApiProperty } from '@nestjs/swagger';
import { ChatV1RequestDto } from './chat-request.dto.js';

export class ChatSessionMessageDto extends ChatV1RequestDto {}

export class ChatSessionDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ format: 'date-time' })
  createdAt!: string;

  @ApiProperty({ format: 'date-time' })
  expiresAt!: string;

  @ApiProperty({ example: 0 })
  turns!: number;
}
