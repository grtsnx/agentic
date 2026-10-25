import { Injectable } from '@nestjs/common';
import type { ChatV2ResponseDto } from '@/dto';
import { OpenaiService } from '@/lib';

@Injectable()
export class ChatV2Service {
  constructor(private readonly openaiService: OpenaiService) {}

  async sendMessage(message: string): Promise<ChatV2ResponseDto> {
    return this.openaiService.generateReply(message.trim());
  }
}
