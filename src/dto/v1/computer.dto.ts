import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsIn,
  IsString,
  MinLength,
  MaxLength,
  IsOptional,
  Matches,
} from 'class-validator';
export class ComputerConnectDto {
  @ApiProperty({
    description:
      'Local owner key from COMPUTER_ACCESS_TOKEN. Never send it in a chat message.',
  })
  @IsString()
  @MinLength(32)
  @MaxLength(256)
  accessToken!: string;
  @ApiProperty({ enum: ['browser', 'desktop'] })
  @IsIn(['browser', 'desktop'])
  target!: 'browser' | 'desktop';
}
export class ComputerObserveDto {
  @ApiPropertyOptional({ example: 'com.apple.TextEdit' })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  @Matches(/^[a-zA-Z0-9-]+(?:\.[a-zA-Z0-9-]+)+$/)
  app?: string;
}
