import { ApiProperty } from '@nestjs/swagger';

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
  @ApiProperty({ example: 'gpt-6-astra' })
  name!: string;

  @ApiProperty({ example: 1 })
  calls!: number;
}

export class OpenaiRuntimeDto {
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
