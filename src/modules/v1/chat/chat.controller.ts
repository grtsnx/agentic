import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiOkResponse,
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
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Send a message to the AI agent' })
  @ApiOkResponse({ type: ChatV1ResponseDto })
  @ApiBadRequestResponse({ description: 'The message is invalid.' })
  sendMessage(@Body() request: ChatV1RequestDto): Promise<ChatV1ResponseDto> {
    return this.chatService.sendMessage(request.message);
  }
}
