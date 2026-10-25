import { Test } from '@nestjs/testing';
import { OpenaiService } from '@/lib';
import { ChatV1Service } from '@/modules';

describe('ChatV1Service', () => {
  it('delegates a normalized message to OpenAI', async () => {
    const output = {
      status: 'completed',
      message: 'Version 1 response',
      summary: 'A short summary.',
      keyPoints: ['First point'],
      suggestedActions: [],
      followUpQuestions: ['What next?'],
    };
    const generateReply = vi.fn().mockResolvedValue(output);
    const module = await Test.createTestingModule({
      providers: [
        ChatV1Service,
        { provide: OpenaiService, useValue: { generateReply } },
      ],
    }).compile();

    await expect(
      module.get(ChatV1Service).sendMessage('  Ask this  '),
    ).resolves.toEqual(output);
    expect(generateReply).toHaveBeenCalledWith('Ask this');
  });
});
