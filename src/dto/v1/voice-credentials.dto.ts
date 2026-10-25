import { ApiProperty } from '@nestjs/swagger';

export class VoiceCredentialsDto {
  @ApiProperty({ example: 'wss://agentic.livekit.cloud' })
  serverUrl!: string;

  @ApiProperty({
    description: 'Short-lived, room-scoped LiveKit participant token.',
    example: 'eyJhbGciOiJIUzI1NiJ9...',
  })
  participantToken!: string;
}
