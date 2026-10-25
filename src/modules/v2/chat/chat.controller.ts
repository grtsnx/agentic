import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { ChatV2RequestDto, ChatV2ResponseDto } from '@/dto';
import { ChatV2Service } from './chat.service.js';

@ApiTags('Chat')
@Controller({ path: 'chat', version: '2' })
export class ChatV2Controller {
  constructor(private readonly chatService: ChatV2Service) {}

  @Post()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Send a message to the AI agent' })
  @ApiOkResponse({ type: ChatV2ResponseDto })
  @ApiBadRequestResponse({ description: 'The message is invalid.' })
  sendMessage(@Body() request: ChatV2RequestDto): Promise<ChatV2ResponseDto> {
    return this.chatService.sendMessage(request.message);
  }
}
