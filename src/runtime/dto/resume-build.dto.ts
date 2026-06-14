import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ResumeBuildDto {
  @ApiProperty({
    description:
      'The durable Anthropic session id to re-bind to (from a persisted chat).',
  })
  sessionId: string;

  @ApiPropertyOptional({
    description:
      'The build id the client last held — reused when still free so references line up.',
  })
  buildId?: string;
}
