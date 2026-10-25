import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

class RuntimeTokenUsageDto {
  @ApiProperty({ example: 120 })
  input!: number;

  @ApiProperty({ example: 80 })
  output!: number;

  @ApiProperty({ example: 200 })
  total!: number;

  @ApiProperty({ example: 20 })
  cachedInput!: number;

  @ApiProperty({ example: 10 })
  reasoningOutput!: number;
}

class RuntimeCostDto {
  @ApiProperty({ example: 0.00502 })
  estimatedUsd!: number;

  @ApiProperty({ example: 'USD', enum: ['USD'] })
  currency!: 'USD';

  @ApiProperty({ example: false })
  exact!: false;

  @ApiProperty({ example: true })
  includesToolCosts!: boolean;
}

class RuntimeCallDto {
  @ApiProperty({ example: 'gpt-6-luna' })
  name!: string;

  @ApiProperty({ example: 1 })
  calls!: number;
}

class RoutingUsageDto {
  @ApiProperty({ example: 263 })
  input_tokens!: number;
  @ApiProperty({ example: 0 })
  output_tokens!: number;
}

class RuntimeRoutingDto {
  @ApiProperty({ enum: ['gpt-5-nano', 'gpt-6-luna'], example: 'gpt-6-luna' })
  model!: string;
  @ApiProperty({ enum: ['local', 'clef'], example: 'clef' })
  source!: string;
  @ApiProperty({
    example: 'classified',
    description: 'Classification or a stable local fallback reason.',
  })
  reason!: string;
  @ApiPropertyOptional({ example: 0.94, minimum: 0, maximum: 1 })
  probability?: number;
  @ApiProperty({ example: 120 })
  durationMs!: number;
  @ApiProperty({
    type: Number,
    nullable: true,
    example: 0.000009994,
    description:
      'Classifier list-price estimate from provider usage; excludes free allowances and is separate from generation cost.',
  })
  estimatedCostUsd!: number | null;
  @ApiPropertyOptional({ type: RoutingUsageDto })
  usage?: RoutingUsageDto;
  @ApiPropertyOptional({
    description: 'Provider request reference for usage reconciliation.',
    example: 'example-cf-ray',
  })
  requestId?: string;
}

export class OpenaiRuntimeDto {
  @ApiPropertyOptional({ type: RuntimeRoutingDto })
  routing?: RuntimeRoutingDto;
  @ApiProperty({
    example: 1840,
    description: 'Total agent run time in milliseconds.',
  })
  durationMs!: number;

  @ApiProperty({ type: RuntimeTokenUsageDto })
  tokens!: RuntimeTokenUsageDto;

  @ApiProperty({ type: RuntimeCostDto })
  cost!: RuntimeCostDto;

  @ApiProperty({ type: [RuntimeCallDto] })
  models!: RuntimeCallDto[];

  @ApiProperty({ type: [RuntimeCallDto], example: [] })
  tools!: RuntimeCallDto[];
}
