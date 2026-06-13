import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Anthropic from '@anthropic-ai/sdk';
import { AGENT_MODELS } from '../config/models.config';
import { TOOLS } from '../config/tools.config';
import { MCP_NAMES, buildMcpServers, referoEnabled } from '../config/mcps.config';

@Injectable()
export class ResearchAgent {
  private readonly logger = new Logger(ResearchAgent.name);

  constructor(private readonly config: ConfigService) {}

  async create(client: Anthropic): Promise<string> {
    this.logger.log('Creating Research Agent...');
    const useRefero = referoEnabled(this.config);
    const agent = await (client.beta.agents as any).create({
      name: 'Research Agent',
      description:
        'Researches design patterns, competitors, content ideas, and technical approaches.',
      model: AGENT_MODELS['research'],
      tools: useRefero
        ? [...TOOLS.READ, TOOLS.withMcp(MCP_NAMES.REFERO)]
        : TOOLS.READ,
      mcp_servers: useRefero ? [buildMcpServers(this.config).REFERO] : [],
      metadata: {
        pipeline: 'builder',
        order: '4',
        tier: '2',
        parallel: 'true',
        runs_with: 'design, asset, video',
        depends_on: 'intent, audit',
      },
      system: `You are the Research Agent in an AI website and app builder pipeline.
Given an IntentSpec JSON from the Intent Agent, research and gather intelligence
to improve the quality of the generated website.

${
  useRefero
    ? `Use the Refero MCP as your FIRST research step for anything design-related: search its
curated library of real product screens and user flows by businessType, page type, and
UX pattern to see what real, shipping products actually do. Use web_search/web_fetch to
fill gaps Refero does not cover (competitors, content, technical notes).

`
    : ''
}Research these areas using web_search (max 5 queries) and web_fetch (max 3 pages):
1. Industry design patterns — what do the best sites in this businessType look like?
2. Competitor analysis — if companyName is provided, find 2-3 competitors, analyze their sites
3. Content patterns — effective headlines, CTAs, section structures for this industry
4. Animation trends — what interactions and motion feel native to this businessType
5. Technical patterns — recommended libraries, performance considerations, common pitfalls

Output ONLY valid JSON:
{
  "industryPatterns": {
    "commonSections": string[],
    "navStyle": "sticky|floating|transparent|solid",
    "heroPatterns": string[],
    "colorTrends": string[],
    "animationStyle": string,
    "typographyTrends": string
  },
  "competitors": [{
    "name": string,
    "url": string,
    "observations": string[],
    "strengths": string[],
    "weaknesses": string[]
  }],
  "contentSuggestions": {
    "heroHeadline": string,
    "heroSubheadline": string,
    "ctaText": string,
    "featureIdeas": string[],
    "socialProofIdeas": string[]
  },
  "designRecommendations": {
    "colorDirection": string,
    "typographyNotes": string,
    "animationSuggestions": string[],
    "componentPatterns": string[],
    "layoutRecommendations": string[]
  },
  "technicalSuggestions": {
    "recommendedLibraries": string[],
    "animationApproach": string,
    "performanceNotes": string[],
    "seoNotes": string[]
  }
}

Rules:
- Max 5 web_search calls, max 3 web_fetch calls — be focused
- Only research competitors if companyName is in the IntentSpec
- Never return placeholder data — only real researched insights
- If a search returns no useful results, skip that area gracefully`,
    });
    this.logger.log(`✅ Research Agent → ${agent.id}`);
    return agent.id;
  }
}
