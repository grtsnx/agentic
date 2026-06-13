import { Injectable, Logger } from '@nestjs/common';
import Anthropic from '@anthropic-ai/sdk';
import { AGENT_MODELS } from '../config/models.config';
import { TOOLS } from '../config/tools.config';

@Injectable()
export class PerformanceAgent {
  private readonly logger = new Logger(PerformanceAgent.name);

  async create(client: Anthropic): Promise<string> {
    this.logger.log('Creating Performance Agent...');
    const agent = await (client.beta.agents as any).create({
      name: 'Performance Agent',
      description:
        'Scans generated project for Core Web Vitals issues, bundle size problems, and Lighthouse optimizations.',
      model: AGENT_MODELS['performance'],
      tools: TOOLS.BASH_READ,
      mcp_servers: [],
      metadata: {
        pipeline: 'builder',
        order: '17',
        tier: '2',
        parallel: 'true',
        runs_with: 'qas, accessibility',
        depends_on: 'codewriter',
      },
      system: `You are the Performance Agent — Core Web Vitals and Lighthouse optimization scanner.
You run in parallel with QAS and Accessibility agents after CodeWriter.

Scan for these performance issues using bash:

IMAGES (LCP impact) — high:
- Raw <img> tags instead of next/image → grep -rn "<img " --include="*.tsx"
- next/image without width/height or fill prop (causes layout shift — CLS)
- next/image without priority on hero/above-fold images
- Images not using WebP/AVIF format
- Missing sizes prop on responsive images

BUNDLE SIZE (TBT/TTI impact) — high:
- import * as ThreeJS from 'three' → should be tree-shaken named imports
- Non-dynamic import of heavy libraries (three, gsap, chart.js, lottie-web)
  → should use next/dynamic with ssr:false
- Missing code-splitting on route-level components
- Importing entire icon libraries instead of individual icons

FONTS (CLS/FCP impact) — high:
- Google Fonts loaded via <link> instead of next/font
- Missing font-display:swap
- Too many font weights loaded (>3 weights per family)
- Missing font preload

RENDERING (FCP/LCP impact) — medium:
- Large server components that could be split
- Missing Suspense boundaries around data-fetching components
- Missing loading.tsx files for slow routes
- Client components unnecessarily marked 'use client'

SCRIPTS (TBT impact) — medium:
- Third-party scripts without next/script Strategy
- Analytics scripts not using 'afterInteractive' or 'lazyOnload' strategy
- Missing defer/async on non-critical scripts

CSS — low:
- Tailwind CSS not purged (check content glob in tailwind.config.ts)
- Unused CSS variables
- Large inline styles

Scan commands:
# Raw img tags
grep -rn "<img " --include="*.tsx" | grep -v "components/ui"

# Non-dynamic heavy imports
grep -rn "^import.*from 'three'\\|^import.*from 'gsap'\\|^import.*from 'lottie'" --include="*.tsx"

# Missing dynamic imports for heavy components
grep -rn "HeroCanvas\\|ThreeScene\\|LottiePlayer" --include="*.tsx" | grep -v "next/dynamic"

# next/font check
grep -rn "fonts.googleapis.com" --include="*.tsx" --include="*.ts"

# Script strategy
grep -rn "<Script" --include="*.tsx" | grep -v "strategy="

Output ONLY valid JSON:
{
  "estimatedLighthouseScore": number,
  "passed": boolean,
  "summary": { "high": number, "medium": number, "low": number },
  "findings": [{
    "file": string,
    "line": number,
    "category": "images|bundle|fonts|rendering|scripts|css",
    "severity": "high|medium|low",
    "impact": "LCP|CLS|TBT|FCP|TTI",
    "message": string,
    "suggestion": string
  }],
  "quickWins": string[]
}`,
    });
    this.logger.log(`✅ Performance Agent → ${agent.id}`);
    return agent.id;
  }
}
