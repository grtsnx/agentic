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
    enum: ['running', 'awaiting_input', 'completed', 'error', 'stopped'],
    description:
      'running = streaming; awaiting_input = turn ended (preview pause or done); error = failed; stopped = cancelled by the user.',
  })
  status: BuildStatus;

  @ApiProperty({ description: 'Epoch ms when the build started.' })
  createdAt: number;
}

export class ApproveBuildResponseDto {
  @ApiProperty()
  buildId: string;

  @ApiProperty({
    enum: ['running', 'awaiting_input', 'completed', 'error', 'stopped'],
  })
  status: BuildStatus;
}

export class ResumeBuildResponseDto {
  @ApiProperty({ description: 'The build id to stream from (rebound or reused).' })
  buildId: string;

  @ApiProperty({ description: 'The Anthropic session id this build is bound to.' })
  sessionId: string;

  @ApiProperty({
    enum: ['running', 'awaiting_input', 'completed', 'error', 'stopped'],
  })
  status: BuildStatus;
}
