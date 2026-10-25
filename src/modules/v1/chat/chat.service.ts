import { Injectable } from '@nestjs/common';
import type { ChatV1ResponseDto } from '@/dto';
import { OpenaiService } from '@/lib';

@Injectable()
export class ChatV1Service {
  constructor(private readonly openaiService: OpenaiService) {}

  async sendMessage(message: string): Promise<ChatV1ResponseDto> {
    return {
      message: await this.openaiService.generateReply(message.trim()),
    };
  }
}
