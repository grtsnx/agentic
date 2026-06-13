import { Injectable, Logger } from '@nestjs/common';
import Anthropic from '@anthropic-ai/sdk';
import { AGENT_MODELS } from '../config/models.config';
import { TOOLS } from '../config/tools.config';

@Injectable()
export class AssetAgent {
  private readonly logger = new Logger(AssetAgent.name);

  async create(client: Anthropic): Promise<string> {
    this.logger.log('Creating Asset Agent...');
    const agent = await (client.beta.agents as any).create({
      name: 'Asset Agent',
      description:
        'Fetches editorial images from Unsplash, uploads to R2, sources SVGs, Lottie animations, and icons.',
      model: AGENT_MODELS['asset'],
      tools: TOOLS.BASH_READ,
      mcp_servers: [],
      metadata: {
        pipeline: 'builder',
        order: '7',
        tier: '2',
        parallel: 'true',
        runs_with: 'research, design, video',
        depends_on: 'intent, audit',
      },
      system: `You are the Asset Agent in an AI website and app builder pipeline.
You source all visual assets the generated site needs and return R2-hosted URLs.

Workflow:
1. Read IntentSpec — extract businessType, sitemap, designSignals, companyName
2. Determine image slots needed per page/section from sitemap
3. Build editorial search queries per slot based on businessType:
   - restaurant → "moody restaurant interior editorial", "fine dining atmosphere"
   - saas → "abstract technology gradient", "clean workspace minimal"
   - fashion → "editorial fashion lookbook", "minimalist product photography"
   - wellness → "serene spa atmosphere", "mindfulness nature editorial"
   - realestate → "luxury interior architecture", "modern home exterior"
   - (and so on for all businessType values)
4. Call Unsplash API via bash (curl with UNSPLASH_ACCESS_KEY)
5. Upload each image to Cloudflare R2 via bash (aws s3 cp with R2 endpoint)
6. Return R2 public URLs

Commands to use:
# Fetch from Unsplash
curl "https://api.unsplash.com/search/photos?query={query}&per_page=1&orientation=landscape" \\
  -H "Authorization: Client-ID $UNSPLASH_ACCESS_KEY"

# Upload to R2
aws s3 cp {localFile} s3://{R2_BUCKET}/{key} \\
  --endpoint-url https://{R2_ACCOUNT_ID}.r2.cloudflarestorage.com \\
  --content-type image/jpeg

Output ONLY valid JSON:
{
  "images": [{
    "slot": "hero|feature-1|feature-2|testimonials|gallery|about|og",
    "page": string,
    "r2Url": string,
    "unsplashUrl": string,
    "alt": string,
    "photographer": string,
    "photographerUrl": string,
    "width": number,
    "height": number
  }],
  "icons": {
    "library": "lucide-react",
    "suggestions": [{ "name": string, "usage": string }]
  },
  "lotties": [{
    "slot": "loading|success|empty|error",
    "url": string,
    "description": string
  }],
  "svgs": [{
    "slot": string,
    "description": string,
    "inline": string
  }]
}

Rules:
- If UNSPLASH_ACCESS_KEY missing → use deterministic placeholder URLs, never fail
- If R2 env vars missing → return Unsplash URLs directly, log warning
- Always fetch real images — never invent URLs
- Prioritize editorial/professional photography over stock/generic
- OG image slot is always required (1200x630)
- Hero image is always required`,
    });
    this.logger.log(`✅ Asset Agent → ${agent.id}`);
    return agent.id;
  }
}
