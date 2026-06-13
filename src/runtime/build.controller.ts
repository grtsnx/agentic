import { Body, Controller, Get, Param, Post, Sse } from '@nestjs/common';
import {
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiProduces,
  ApiTags,
} from '@nestjs/swagger';
import { Observable } from 'rxjs';

import { RuntimeService } from './runtime.service';
import { StartBuildDto } from './dto/start-build.dto';
import { ApproveBuildDto } from './dto/approve-build.dto';
import {
  ApproveBuildResponseDto,
  BuildStatusResponseDto,
  StartBuildResponseDto,
} from './dto/build-response.dto';

/**
 * HTTP surface an external frontend app calls to drive a build.
 *
 *   POST   /builds              → start a build      → { buildId, sessionId }
 *   GET    /builds/:id          → poll status        → { status, ... }
 *   GET    /builds/:id/stream   → live SSE of events  (text/event-stream)
 *   POST   /builds/:id/approve  → continue past the preview gate to deploy
 */
@ApiTags('builds')
@Controller('builds')
export class BuildController {
  constructor(private readonly runtime: RuntimeService) {}

  @Post()
  @ApiOperation({
    summary: 'Start a build',
    description:
      'Opens an Orchestrator session, sends the prompt + attachments, and runs the pipeline in the background. Returns immediately with a build id to stream from.',
  })
  @ApiOkResponse({ type: StartBuildResponseDto })
  start(@Body() body: StartBuildDto) {
    return this.runtime.start(body);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get build status' })
  @ApiParam({ name: 'id', description: 'Build id returned by POST /builds' })
  @ApiOkResponse({ type: BuildStatusResponseDto })
  status(@Param('id') id: string) {
    return this.runtime.getStatus(id);
  }

  @Sse(':id/stream')
  @ApiOperation({
    summary: 'Stream build events (SSE)',
    description:
      'Server-Sent Events stream of orchestrator events. Each frame\'s `data` is JSON: `{ kind, payload }`.',
  })
  @ApiParam({ name: 'id', description: 'Build id returned by POST /builds' })
  @ApiProduces('text/event-stream')
  stream(@Param('id') id: string): Observable<unknown> {
    return this.runtime.stream(id);
  }

  @Post(':id/approve')
  @ApiOperation({
    summary: 'Approve & continue',
    description:
      'Resumes a build paused at the preview gate so deploy + version run. Sends an approval message to the same session.',
  })
  @ApiParam({ name: 'id', description: 'Build id returned by POST /builds' })
  @ApiOkResponse({ type: ApproveBuildResponseDto })
  approve(@Param('id') id: string, @Body() body: ApproveBuildDto) {
    return this.runtime.approve(id, body?.message);
  }
}
