import { Injectable } from '@nestjs/common';
import { Agent, run } from '@openai/agents';

@Injectable()
export class OpenaiService {
  private readonly agent = new Agent({
    name: 'History tutor',
    instructions: 'You answer history questions clearly and concisely.',
    model: 'gpt-6-astra',
  });

  async generateReply(message: string): Promise<string> {
    const result = await run(this.agent, message);
    return result.finalOutput ?? '';
  }
}
