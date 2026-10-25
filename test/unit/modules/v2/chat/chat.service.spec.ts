import { Test } from '@nestjs/testing';
import { OpenaiService } from '@/lib';
import { ChatV2Service } from '@/modules';

describe('ChatV2Service', () => {
  it('delegates a normalized message to OpenAI independently of v1', async () => {
    const generateReply = vi.fn().mockResolvedValue('Version 2 response');
    const module = await Test.createTestingModule({
      providers: [
        ChatV2Service,
        { provide: OpenaiService, useValue: { generateReply } },
      ],
    }).compile();

    await expect(
      module.get(ChatV2Service).sendMessage('  Ask this  '),
    ).resolves.toEqual({ message: 'Version 2 response' });
    expect(generateReply).toHaveBeenCalledWith('Ask this');
  });
});
