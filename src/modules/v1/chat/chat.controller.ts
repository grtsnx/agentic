import { Body, Controller, Post } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiCreatedResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { ChatV1RequestDto, ChatV1ResponseDto } from '@/dto';
import { ChatV1Service } from './chat.service.js';

@ApiTags('Chat')
@Controller({ path: 'chat', version: '1' })
export class ChatV1Controller {
  constructor(private readonly chatService: ChatV1Service) {}

  @Post()
  @ApiOperation({ summary: 'Send a message to the AI agent' })
  @ApiCreatedResponse({ type: ChatV1ResponseDto })
  @ApiBadRequestResponse({ description: 'The message is invalid.' })
  sendMessage(@Body() request: ChatV1RequestDto): Promise<ChatV1ResponseDto> {
    return this.chatService.sendMessage(request.message);
  }
}
