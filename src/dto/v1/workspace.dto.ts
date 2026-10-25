import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsIn, MinLength, MaxLength, IsArray, ArrayMaxSize, IsUUID, IsOptional } from 'class-validator';
import { ChatV1RequestDto } from './chat-request.dto.js';

export class WorkspaceSearchDto {
  @ApiProperty({example:'launch budget'}) @IsString() @MinLength(1) @MaxLength(500) query!: string;
  @ApiProperty({type:[String],example:[]}) @IsArray() @ArrayMaxSize(5) @IsUUID('all',{each:true}) fileIds!: string[];
}
export class WorkspaceDecisionDto {
  @ApiProperty({enum:['approve','deny','cancel']}) @IsIn(['approve','deny','cancel']) decision!: 'approve'|'deny'|'cancel';
}
export class WorkspaceCodeDto {
  @ApiProperty({example:'console.log(2 + 2)'}) @IsString() @MinLength(1) @MaxLength(16_000) code!: string;
}
export class WorkspaceTaskDto {
  @ApiProperty({example:'Compare the uploaded requirements and review the proposed solution.'}) @IsString() @MinLength(1) @MaxLength(4_000) task!: string;
}
export class WorkspaceSocketDto extends ChatV1RequestDto {
  @ApiPropertyOptional() @IsOptional() @IsUUID() workspaceId?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MinLength(43) @MaxLength(43) workspaceToken?: string;
}
