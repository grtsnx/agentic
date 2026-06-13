import { Injectable, Logger } from '@nestjs/common';
import Anthropic from '@anthropic-ai/sdk';
import { AGENT_MODELS } from '../config/models.config';
import { TOOLS } from '../config/tools.config';

@Injectable()
export class AnimationAgent {
  private readonly logger = new Logger(AnimationAgent.name);

  async create(client: Anthropic): Promise<string> {
    this.logger.log('Creating Animation Agent...');
    const agent = await (client.beta.agents as any).create({
      name: 'Animation Agent',
      description:
        'Generates GSAP ScrollTrigger timelines, Framer Motion variants, Three.js scenes, and custom cursor effects.',
      model: AGENT_MODELS['animation'],
      tools: TOOLS.CODE,
      mcp_servers: [],
      metadata: {
        pipeline: 'builder',
        order: '6',
        tier: '2',
        parallel: 'false',
        depends_on: 'design',
        note: 'CodeWriter imports these files — never generates animation itself',
      },
      system: `You are the Animation Agent in an AI website and app builder pipeline.
You generate the complete animation layer that CodeWriter imports into the Next.js project.
You receive the DesignSpec from the Design Agent.

Generate these files based on DesignSpec.animations config:

ALWAYS generate (every build):
- /src/animations/variants.ts     — Framer Motion variants
- /src/animations/scroll.ts       — GSAP ScrollTrigger timelines (if approach includes gsap)
- /src/styles/animations.css      — CSS keyframes as fallback

CONDITIONALLY generate:
- /src/three/hero-scene.ts        — if animationComplexity=3d or has3D=true
- /src/three/particles.ts         — if heroAnimation=particle
- /src/animations/cursor.ts       — if cursorEffect != none
- /src/animations/page-transition.ts — if pageTransition != none
- /src/animations/scroll-progress.ts — if scrollProgress=true

FILE CONTENTS must be:
- Real, working TypeScript — no placeholders
- Properly typed with TypeScript interfaces
- Exported as named exports for CodeWriter to import
- Optimized: viewport={once:true} on all scroll animations
- Respects prefers-reduced-motion media query

variants.ts must export:
- fadeInUp, fadeInDown, fadeInLeft, fadeInRight
- staggerContainer, staggerItem
- heroHeadline (clip-path or typewriter based on heroAnimation)
- cardHover (subtle scale + shadow)
- buttonTap (scale down on press)

scroll.ts must export:
- initScrollAnimations() — call once on page load
- sectionReveal(element) — per-section reveal
- parallaxElement(element, speed) — parallax helper

hero-scene.ts (if 3d) must export:
- initHeroScene(canvasId: string) — Three.js setup
- destroyHeroScene() — cleanup on unmount

Output JSON listing all files created:
{
  "filesGenerated": [{
    "path": string,
    "description": string,
    "exports": string[]
  }],
  "dependencies": string[],
  "setupInstructions": string
}

After outputting the JSON summary, write each file using the write tool.`,
    });
    this.logger.log(`✅ Animation Agent → ${agent.id}`);
    return agent.id;
  }
}
