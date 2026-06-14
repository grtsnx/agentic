import { ApiProperty } from '@nestjs/swagger';
import type { BuildStatus } from '../runtime.service';

export class StartBuildResponseDto {
  @ApiProperty({
    description: 'Opaque build id used for streaming + approval.',
  })
  buildId: string;

  @ApiProperty({ description: 'Underlying Anthropic session id.' })
  sessionId: string;
}

export class BuildStatusResponseDto {
  @ApiProperty()
  buildId: string;

  @ApiProperty()
  sessionId: string;

  @ApiProperty({
    enum: ['running', 'awaiting_input', 'completed', 'error'],
    description:
      'running = streaming; awaiting_input = turn ended (preview pause or done); error = failed.',
  })
  status: BuildStatus;

  @ApiProperty({ description: 'Epoch ms when the build started.' })
  createdAt: number;
}

export class ApproveBuildResponseDto {
  @ApiProperty()
  buildId: string;

  @ApiProperty({ enum: ['running', 'awaiting_input', 'completed', 'error'] })
  status: BuildStatus;
}
