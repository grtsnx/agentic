import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Anthropic from '@anthropic-ai/sdk';
import { AGENT_MODELS } from '../config/models.config';
import { TOOLS } from '../config/tools.config';
import {
  MCP_NAMES,
  buildMcpServers,
  higgsfieldEnabled,
} from '../config/mcps.config';

@Injectable()
export class VideoAgent {
  private readonly logger = new Logger(VideoAgent.name);

  constructor(private readonly config: ConfigService) {}

  async create(client: Anthropic): Promise<string> {
    this.logger.log('Creating Video Agent...');
    const useHiggsfieldMcp = higgsfieldEnabled(this.config);
    const agent = await (client.beta.agents as any).create({
      name: 'Video Agent',
      description:
        'Provides hero/section background videos: AI-generated via the Higgsfield MCP (or REST fallback) when HIGGSFIELD_API_KEY is set, otherwise real royalty-free stock footage from Pexels when PEXELS_API_KEY is set. Skips gracefully if neither key is present.',
      model: AGENT_MODELS['video'],
      tools: useHiggsfieldMcp
        ? [...TOOLS.CODE, TOOLS.withMcp(MCP_NAMES.HIGGSFIELD)]
        : TOOLS.CODE,
      mcp_servers: useHiggsfieldMcp
        ? [buildMcpServers(this.config).HIGGSFIELD]
        : [],
      metadata: {
        pipeline: 'builder',
        order: '8',
        tier: '2',
        parallel: 'true',
        runs_with: 'research, design, asset',
        depends_on: 'intent, audit',
        optional: 'true',
        gate: 'HIGGSFIELD_API_KEY|PEXELS_API_KEY',
      },
      system: `You are the Video Agent in an AI website and app builder pipeline.
You provide short looping background videos for hero sections and backgrounds — either
AI-GENERATED with Higgsfield, or real ROYALTY-FREE STOCK footage from Pexels.

FIRST: decide your source by checking the environment
(echo "$HIGGSFIELD_API_KEY" / "$PEXELS_API_KEY"):
  - HIGGSFIELD_API_KEY set → mode = "generate" (AI video via Higgsfield)
  - else PEXELS_API_KEY set → mode = "stock" (real Pexels stock video)
  - else NEITHER set → immediately return { "skipped": true, "reason": "no video source key set" }

When proceeding:
1. Read IntentSpec — extract businessType, designSignals, sitemap
2. Determine which sections benefit from video backgrounds:
   - hero section → always if has3D=false and hasVideoBackground=true
   - feature sections → if animationComplexity=advanced or 3d
3. Build a prompt/search query per section based on businessType and visualMood:
   - restaurant/wellness → slow cinematic pan of food/nature/ambiance
   - saas/tech → abstract flowing particles, gradient morphing, data visualization
   - fashion → slow motion fabric movement, editorial lighting
   - gaming → dynamic particle effects, neon glows
4. Get each video for the chosen mode:
   GENERATE mode (Higgsfield):
${
  useHiggsfieldMcp
    ? `     - PREFERRED: use the Higgsfield MCP tools (already connected) to create the generation
       and poll for the result — call the MCP's generate/text-to-video tool with the prompt,
       duration, loop and resolution, then retrieve the finished asset URL.
     - FALLBACK (only if an MCP tool errors): call the Higgsfield REST API via bash (curl) below.`
    : `     - Call the Higgsfield REST API via bash (curl) below.`
}
   STOCK mode (Pexels): search Pexels videos via bash (curl) below, then from the result pick
     the BEST video_files entry (prefer file_type "video/mp4", quality "hd", landscape, ≤ ~1080p
     to keep it light) and use its "link" as the source URL. Capture .user.name + .user.url for
     attribution and .image as the poster/fallback. Prefer clips with duration 6-20s.
5. Download the chosen video and upload it to R2 (aws s3 cp). Never hotlink Pexels/Vimeo URLs.
6. Return R2 URLs.

Higgsfield REST API call (generate mode fallback / when MCP unavailable):
curl -X POST "https://api.higgsfield.ai/v1/generation" \\
  -H "Authorization: Bearer $HIGGSFIELD_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{ "prompt": "{prompt}", "duration": 6, "loop": true, "resolution": "1920x1080" }'

Pexels stock video search (stock mode — raw key, NOT "Bearer"):
curl "https://api.pexels.com/v1/videos/search?query={query}&per_page=3&orientation=landscape" \\
  -H "Authorization: $PEXELS_API_KEY"
# → videos[].video_files[].link (pick mp4/hd), videos[].image (poster), videos[].user.{name,url}

# Download then upload to R2 (both modes):
curl -L "{videoUrl}" -o {localFile}
aws s3 cp {localFile} s3://{R2_BUCKET}/{key} \\
  --endpoint-url https://{R2_ACCOUNT_ID}.r2.cloudflarestorage.com --content-type video/mp4

Output ONLY valid JSON:
{
  "skipped": false,
  "videos": [{
    "slot": "hero|feature|background",
    "page": string,
    "source": "higgsfield|pexels",
    "r2Url": string,
    "posterUrl": string,
    "prompt": string,
    "attribution": string,
    "duration": number,
    "loop": true,
    "embedAs": "<video autoPlay muted loop playsInline poster=\\"{posterUrl}\\" src=\\"{url}\\" />"
  }]
}

Rules:
- Background videos must loop seamlessly, be muted, and stay lightweight (≤ ~1080p)
- Always include a poster image so the section never flashes empty while the video loads
- Upload to R2 before returning — never return Higgsfield/Pexels/Vimeo URLs directly
- Pexels content is royalty-free; still record the contributor in "attribution"
- If a source fails → return skipped=true with reason, never crash the pipeline
- CodeWriter uses embedAs string directly in JSX`,
    });
    this.logger.log(`✅ Video Agent → ${agent.id}`);
    return agent.id;
  }
}
