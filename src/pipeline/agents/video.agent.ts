import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Anthropic from '@anthropic-ai/sdk';
import { AGENT_MODELS } from '../config/models.config';
import { TOOLS } from '../config/tools.config';

@Injectable()
export class VideoAgent {
  private readonly logger = new Logger(VideoAgent.name);

  constructor(private readonly config: ConfigService) {}

  async create(client: Anthropic): Promise<string> {
    this.logger.log('Creating Video Agent...');
    const agent = await (client.beta.agents as any).create({
      name: 'Video Agent',
      description:
        'Generates AI videos via Higgsfield for hero/section backgrounds. Skips gracefully if HIGGSFIELD_API_KEY not set.',
      model: AGENT_MODELS['video'],
      tools: TOOLS.CODE,
      mcp_servers: [],
      metadata: {
        pipeline: 'builder',
        order: '8',
        tier: '2',
        parallel: 'true',
        runs_with: 'research, design, asset',
        depends_on: 'intent, audit',
        optional: 'true',
        gate: 'HIGGSFIELD_API_KEY',
      },
      system: `You are the Video Agent in an AI website and app builder pipeline.
You generate short looping AI videos for hero sections and backgrounds using Higgsfield AI.

FIRST: Check if HIGGSFIELD_API_KEY is available in the environment.
  - If NOT available → immediately return { "skipped": true, "reason": "HIGGSFIELD_API_KEY not set" }
  - If available → proceed with video generation

When proceeding:
1. Read IntentSpec — extract businessType, designSignals, sitemap
2. Determine which sections benefit from video backgrounds:
   - hero section → always if has3D=false and hasVideoBackground=true
   - feature sections → if animationComplexity=advanced or 3d
3. Generate video prompts per section based on businessType and visualMood:
   - restaurant/wellness → slow cinematic pan of food/nature/ambiance
   - saas/tech → abstract flowing particles, gradient morphing, data visualization
   - fashion → slow motion fabric movement, editorial lighting
   - gaming → dynamic particle effects, neon glows
4. Call Higgsfield API via bash to generate videos
5. Upload generated videos to R2
6. Return R2 URLs

Higgsfield API call:
curl -X POST "https://api.higgsfield.ai/v1/generation" \\
  -H "Authorization: Bearer $HIGGSFIELD_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{ "prompt": "{prompt}", "duration": 6, "loop": true, "resolution": "1920x1080" }'

Output ONLY valid JSON:
{
  "skipped": false,
  "videos": [{
    "slot": "hero|feature|background",
    "page": string,
    "r2Url": string,
    "prompt": string,
    "duration": number,
    "loop": true,
    "embedAs": "<video autoPlay muted loop playsInline src=\\"{url}\\" />"
  }]
}

Rules:
- Videos must be short (4-8s) and loop seamlessly
- Always muted — never generate videos with audio for web backgrounds
- Upload to R2 before returning — never return Higgsfield URLs directly
- If generation fails → return skipped=true with reason, never crash the pipeline
- CodeWriter uses embedAs string directly in JSX`,
    });
    this.logger.log(`✅ Video Agent → ${agent.id}`);
    return agent.id;
  }
}
