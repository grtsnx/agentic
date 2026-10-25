import { ApiProperty } from '@nestjs/swagger';
import { OpenaiRuntimeDto } from '../common/openai-runtime.dto.js';

export class ChatSourceDto {
  @ApiProperty({ example: 'OpenAI web search guide' })
  title!: string;

  @ApiProperty({
    example: 'https://developers.openai.com/api/docs/guides/tools-web-search',
  })
  url!: string;

  @ApiProperty({ example: 'developers.openai.com' })
  domain!: string;
}

export class ChatV1ResponseDto {
  @ApiProperty({
    enum: ['completed', 'needs_input', 'refused'],
    example: 'completed',
  })
  status!: 'completed' | 'needs_input' | 'refused';

  @ApiProperty({ example: 'The Roman Republic ended after civil conflict.' })
  message!: string;

  @ApiProperty({
    example: 'Rome changed from a republic into an empire.',
  })
  summary!: string;

  @ApiProperty({
    example: ['Political violence weakened republican institutions.'],
    type: [String],
  })
  keyPoints!: string[];

  @ApiProperty({ example: [], type: [String] })
  suggestedActions!: string[];

  @ApiProperty({
    example: ['Would you like a timeline of the civil wars?'],
    type: [String],
  })
  followUpQuestions!: string[];

  @ApiProperty({ type: [ChatSourceDto] })
  sources!: ChatSourceDto[];

  @ApiProperty({ type: OpenaiRuntimeDto })
  runtime!: OpenaiRuntimeDto;
}
