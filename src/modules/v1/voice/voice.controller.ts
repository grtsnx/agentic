import { Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { VoiceCredentialsDto } from '@/dto';
import { VoiceService } from './voice.service.js';

@ApiTags('Voice')
@Controller({ path: 'voice', version: '1' })
export class VoiceController {
  constructor(private readonly voiceService: VoiceService) {}

  @Post('token')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @ApiOperation({ summary: 'Create a short-lived LiveKit voice session' })
  @ApiOkResponse({ type: VoiceCredentialsDto })
  createToken(): Promise<VoiceCredentialsDto> {
    return this.voiceService.createCredentials();
  }
}
