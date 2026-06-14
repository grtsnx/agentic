import { ApiPropertyOptional } from '@nestjs/swagger';
import { BuildAttachmentDto } from './start-build.dto';

export class ApproveBuildDto {
  @ApiPropertyOptional({
    description:
      'Optional message sent to the Orchestrator when resuming past the preview gate.',
    example: 'Approved — deploy to production.',
  })
  message?: string;

  @ApiPropertyOptional({
    type: [BuildAttachmentDto],
    description:
      'Optional images/files attached to a follow-up message — honored end-to-end by the agents.',
  })
  attachments?: BuildAttachmentDto[];
}
