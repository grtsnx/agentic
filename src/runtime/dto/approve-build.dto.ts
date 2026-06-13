import { ApiPropertyOptional } from '@nestjs/swagger';

export class ApproveBuildDto {
  @ApiPropertyOptional({
    description:
      'Optional message sent to the Orchestrator when resuming past the preview gate.',
    example: 'Approved — deploy to production.',
  })
  message?: string;
}
