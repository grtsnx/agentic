import { ApiProperty } from '@nestjs/swagger';

export class ChatV1ResponseDto {
  @ApiProperty({ example: 'The Roman Republic ended after civil conflict.' })
  message!: string;
}
