import {
  Body,
  Controller,
  Delete,
  HttpCode,
  HttpStatus,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Post,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import {
  ChatSessionDto,
  ChatSessionMessageDto,
  ChatV1RequestDto,
  ChatV1ResponseDto,
} from '@/dto';
import { ChatSessionService } from './chat-session.service.js';
import { ChatV1Service } from './chat.service.js';

@ApiTags('Chat')
@Controller({ path: 'chat', version: '1' })
export class ChatV1Controller {
  constructor(
    private readonly chatService: ChatV1Service,
    private readonly sessions: ChatSessionService,
  ) {}

  @Post()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Send a message to the AI agent' })
  @ApiOkResponse({ type: ChatV1ResponseDto })
  @ApiBadRequestResponse({ description: 'The message is invalid.' })
  sendMessage(@Body() request: ChatV1RequestDto): Promise<ChatV1ResponseDto> {
    return this.chatService.sendMessage(request.message);
  }

  @Post('sessions')
  @ApiOperation({ summary: 'Create an expiring in-memory chat session' })
  createSession(): ChatSessionDto {
    return this.sessions.create();
  }

  @Post('sessions/:id/messages')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Continue an in-memory chat session' })
  @ApiOkResponse({ type: ChatV1ResponseDto })
  continueSession(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() request: ChatSessionMessageDto,
  ): Promise<ChatV1ResponseDto> {
    return this.sessions.send(id, request.message);
  }

  @Delete('sessions/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete an in-memory chat session' })
  deleteSession(@Param('id', new ParseUUIDPipe()) id: string): void {
    if (!this.sessions.delete(id)) {
      throw new NotFoundException('Chat session not found.');
    }
  }
}
