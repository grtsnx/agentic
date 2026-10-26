import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsString, MaxLength, IsOptional } from 'class-validator';
export class ComputerConnectDto {
  @ApiProperty({ enum: ['browser', 'desktop'] })
  @IsIn(['browser', 'desktop'])
  target!: 'browser' | 'desktop';
}
export class ComputerObserveDto {
  @ApiPropertyOptional({ example: 'com.apple.TextEdit' })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  app?: string;
}
