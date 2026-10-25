import { ApiProperty } from '@nestjs/swagger';

export class ChatV2ResponseDto {
  @ApiProperty({ example: 'The Roman Republic ended after civil conflict.' })
  message!: string;
}
