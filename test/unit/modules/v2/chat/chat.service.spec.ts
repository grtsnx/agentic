import { Test } from '@nestjs/testing';
import { OpenaiService } from '@/lib';
import { ChatV2Service } from '@/modules';

describe('ChatV2Service', () => {
  it('delegates a normalized message to OpenAI independently of v1', async () => {
    const output = {
      status: 'completed',
      message: 'Version 2 response',
      summary: 'A short summary.',
      keyPoints: ['First point'],
      suggestedActions: [],
      followUpQuestions: ['What next?'],
    };
    const generateReply = vi.fn().mockResolvedValue(output);
    const module = await Test.createTestingModule({
      providers: [
        ChatV2Service,
        { provide: OpenaiService, useValue: { generateReply } },
      ],
    }).compile();

    await expect(
      module.get(ChatV2Service).sendMessage('  Ask this  '),
    ).resolves.toEqual(output);
    expect(generateReply).toHaveBeenCalledWith('Ask this');
  });
});
