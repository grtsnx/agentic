import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import type {
  BuildAttachment,
  StartBuildInput,
} from '../runtime.service';

export class BuildAttachmentDto implements BuildAttachment {
  @ApiProperty({
    enum: ['image', 'document'],
    description: "'image' for logos/screenshots/photos, 'document' for PDFs/brand kits.",
  })
  type: 'image' | 'document';

  @ApiPropertyOptional({
    description: 'Public URL to fetch (preferred over base64).',
    example: 'https://example.com/logo.png',
  })
  url?: string;

  @ApiPropertyOptional({
    description: 'Inline base64-encoded bytes (use when you have no public URL).',
  })
  base64?: string;

  @ApiPropertyOptional({
    description: 'MIME type for base64 content.',
    example: 'image/png',
  })
  mediaType?: string;
}

export class StartBuildDto implements StartBuildInput {
  @ApiProperty({
    description: 'The natural-language build request.',
    example: 'Build a landing page for my artisan bakery — warm and rustic.',
  })
  prompt: string;

  @ApiPropertyOptional({
    type: [BuildAttachmentDto],
    description: 'Images/logos/brand kits the user attached — honored end-to-end by the agents.',
  })
  attachments?: BuildAttachmentDto[];
}
