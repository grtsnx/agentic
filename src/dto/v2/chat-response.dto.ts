import { ApiProperty } from '@nestjs/swagger';
import { OpenaiRuntimeDto } from '../common/openai-runtime.dto.js';

export class ChatV2ResponseDto {
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

  @ApiProperty({ type: OpenaiRuntimeDto })
  runtime!: OpenaiRuntimeDto;
}
