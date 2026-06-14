import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Anthropic from '@anthropic-ai/sdk';
import * as fs from 'fs';
import * as path from 'path';

import { VaultService } from './vault/vault.service';
import { EnvironmentService } from './environment/environment.service';
import { MemoryStoreService } from './memory/memory-store.service';
import { enableIdempotentAgents } from './lib/idempotent-agents';
import { upsertEnvVars } from './lib/env-file';
import { IntentAgent } from './agents/intent.agent';
import { ConversationAgent } from './agents/conversation.agent';
import { AuditAgent } from './agents/audit.agent';
import { ResearchAgent } from './agents/research.agent';
import { DesignAgent } from './agents/design.agent';
import { AnimationAgent } from './agents/animation.agent';
import { AssetAgent } from './agents/asset.agent';
import { VideoAgent } from './agents/video.agent';
import { SchemaAgent } from './agents/schema.agent';
import { CmsAgent } from './agents/cms.agent';
import { EmailAgent } from './agents/email.agent';
import { PaymentsAgent } from './agents/payments.agent';
import { I18nAgent } from './agents/i18n.agent';
import { CodewriterAgent } from './agents/codewriter.agent';
import { QasAgent } from './agents/qas.agent';
import { SecurityAgent } from './agents/security.agent';
import { AccessibilityAgent } from './agents/accessibility.agent';
import { PerformanceAgent } from './agents/performance.agent';
import { RundevAgent } from './agents/rundev.agent';
import { AutofixAgent } from './agents/autofix.agent';
import { TestingAgent } from './agents/testing.agent';
import { PreviewAgent } from './agents/preview.agent';
import { DeployAgent } from './agents/deploy.agent';
import { VersionAgent } from './agents/version.agent';
import { CustomMcpAgent } from './agents/custommcp.agent';
import { KnowledgeBaseAgent } from './agents/knowledgebase.agent';
import { OrchestratorAgent } from './agents/orchestrator.agent';

export interface PipelineConfig {
  vaultId: string;
  environmentId: string;
  memoryStoreId: string;
  agentIds: Record<string, string>;
}

@Injectable()
export class PipelineService {
  private readonly logger = new Logger(PipelineService.name);

  constructor(
    private readonly config: ConfigService,
    private readonly vaultService: VaultService,
    private readonly environmentService: EnvironmentService,
    private readonly memoryStoreService: MemoryStoreService,
    private readonly intentAgent: IntentAgent,
    private readonly conversationAgent: ConversationAgent,
    private readonly auditAgent: AuditAgent,
    private readonly researchAgent: ResearchAgent,
    private readonly designAgent: DesignAgent,
    private readonly animationAgent: AnimationAgent,
    private readonly assetAgent: AssetAgent,
    private readonly videoAgent: VideoAgent,
    private readonly schemaAgent: SchemaAgent,
    private readonly cmsAgent: CmsAgent,
    private readonly emailAgent: EmailAgent,
    private readonly paymentsAgent: PaymentsAgent,
    private readonly i18nAgent: I18nAgent,
    private readonly codewriterAgent: CodewriterAgent,
    private readonly qasAgent: QasAgent,
    private readonly securityAgent: SecurityAgent,
    private readonly accessibilityAgent: AccessibilityAgent,
    private readonly performanceAgent: PerformanceAgent,
    private readonly rundevAgent: RundevAgent,
    private readonly autofixAgent: AutofixAgent,
    private readonly testingAgent: TestingAgent,
    private readonly previewAgent: PreviewAgent,
    private readonly deployAgent: DeployAgent,
    private readonly versionAgent: VersionAgent,
    private readonly customMcpAgent: CustomMcpAgent,
    private readonly knowledgeBaseAgent: KnowledgeBaseAgent,
    private readonly orchestratorAgent: OrchestratorAgent,
  ) {}

  async setup(): Promise<PipelineConfig> {
    this.logger.log('═══════════════════════════════════════');
    this.logger.log('  JAX AI Builder — Pipeline Setup');
    this.logger.log('═══════════════════════════════════════');

    const client = new Anthropic({
      apiKey: this.config.getOrThrow('ANTHROPIC_API_KEY'),
    });

    // Make agent provisioning idempotent: re-running updates existing agents
    // (matched by name) instead of creating duplicates on the account.
    enableIdempotentAgents(client);

    // ── Step 1: Vault ──────────────────────────────────────
    this.logger.log('\n📦 Step 1/4: Vault');
    const vaultId = await this.vaultService.getOrCreate(client);
    await this.vaultService.addCredentials(client, vaultId);

    // ── Step 2: Environment ────────────────────────────────
    this.logger.log('\n🌍 Step 2/4: Environment');
    const environmentId = await this.environmentService.getOrCreate(client);

    // ── Step 2b: Memory store (persona + cross-session memory) ──
    // Anthropic auto-mounts an attached memory store and adds a note to each
    // agent's system prompt, so persona/preferences are surfaced without any
    // hand-rolled injection. The runtime app attaches this store to every
    // session via resources[]; here we just provision it and share its ID.
    this.logger.log('\n🧠 Step 2b: Memory store');
    const memoryStoreId = await this.memoryStoreService.getOrCreate(client);

    // Persist the vault + environment + memory IDs back to .env so they are
    // created exactly once and automatically reused on every subsequent run.
    const { written, path: envPath } = upsertEnvVars({
      ANTHROPIC_VAULT_ID: vaultId,
      ANTHROPIC_ENVIRONMENT_ID: environmentId,
      ANTHROPIC_MEMORY_STORE_ID: memoryStoreId,
    });
    if (written.length) {
      this.logger.log(`   📝 Saved ${written.join(' + ')} to ${envPath}`);
    } else {
      this.logger.log(
        '   📝 .env already has vault + environment + memory IDs',
      );
    }

    // ── Step 3: Agents (in dependency order) ──────────────
    this.logger.log('\n🤖 Step 3/4: Agents');
    const agentIds: Record<string, string> = {};

    // SEQUENTIAL — Tier 1 gates
    this.logger.log('\n  [Sequential] Tier 1 gates...');
    agentIds['intent'] = await this.intentAgent.create(client);
    agentIds['conversation'] = await this.conversationAgent.create(client);
    agentIds['audit'] = await this.auditAgent.create(client);

    // PARALLEL — Research, Design, Asset, Video
    this.logger.log('\n  [Parallel] Research + Design + Asset + Video...');
    const [researchId, designId, assetId, videoId] = await Promise.all([
      this.researchAgent.create(client),
      this.designAgent.create(client),
      this.assetAgent.create(client),
      this.videoAgent.create(client),
    ]);
    agentIds['research'] = researchId;
    agentIds['design'] = designId;
    agentIds['asset'] = assetId;
    agentIds['video'] = videoId;

    // SEQUENTIAL — Animation (needs DesignSpec)
    this.logger.log('\n  [Sequential] Animation (needs Design)...');
    agentIds['animation'] = await this.animationAgent.create(client);

    // PARALLEL — Schema, CMS, Email, Payments, i18n
    this.logger.log('\n  [Parallel] Schema + CMS + Email + Payments + i18n...');
    const [schemaId, cmsId, emailId, paymentsId, i18nId] = await Promise.all([
      this.schemaAgent.create(client),
      this.cmsAgent.create(client),
      this.emailAgent.create(client),
      this.paymentsAgent.create(client),
      this.i18nAgent.create(client),
    ]);
    agentIds['schema'] = schemaId;
    agentIds['cms'] = cmsId;
    agentIds['email'] = emailId;
    agentIds['payments'] = paymentsId;
    agentIds['i18n'] = i18nId;

    // SEQUENTIAL — CodeWriter (needs everything above)
    this.logger.log(
      '\n  [Sequential] CodeWriter (needs all parallel agents)...',
    );
    agentIds['codewriter'] = await this.codewriterAgent.create(client);

    // PARALLEL — QAS, Security, Accessibility, Performance
    this.logger.log(
      '\n  [Parallel] QAS + Security + Accessibility + Performance...',
    );
    const [qasId, securityId, accessibilityId, performanceId] =
      await Promise.all([
        this.qasAgent.create(client),
        this.securityAgent.create(client),
        this.accessibilityAgent.create(client),
        this.performanceAgent.create(client),
      ]);
    agentIds['qas'] = qasId;
    agentIds['security'] = securityId;
    agentIds['accessibility'] = accessibilityId;
    agentIds['performance'] = performanceId;

    // SEQUENTIAL — RunDev, AutoFix, Testing, Preview, Deploy, Version
    this.logger.log(
      '\n  [Sequential] RunDev → AutoFix → Testing → Preview → Deploy → Version...',
    );
    agentIds['rundev'] = await this.rundevAgent.create(client);
    agentIds['autofix'] = await this.autofixAgent.create(client);
    agentIds['testing'] = await this.testingAgent.create(client);
    agentIds['preview'] = await this.previewAgent.create(client);
    agentIds['deploy'] = await this.deployAgent.create(client);
    agentIds['version'] = await this.versionAgent.create(client);

    // BACKGROUND — CustomMCP, KnowledgeBase
    this.logger.log('\n  [Background] CustomMCP + KnowledgeBase...');
    const [customMcpId, knowledgeBaseId] = await Promise.all([
      this.customMcpAgent.create(client),
      this.knowledgeBaseAgent.create(client),
    ]);
    agentIds['custommcp'] = customMcpId;
    agentIds['knowledgebase'] = knowledgeBaseId;

    // ORCHESTRATOR — must be last, needs all IDs
    this.logger.log('\n  [Last] Orchestrator (wires all 26 agents)...');
    agentIds['orchestrator'] = await this.orchestratorAgent.create(
      client,
      agentIds,
    );

    // ── Step 4: Save config ────────────────────────────────
    this.logger.log('\n💾 Step 4/4: Saving agents.config.json');
    const outputConfig: PipelineConfig = {
      vaultId,
      environmentId,
      memoryStoreId,
      agentIds,
    };
    const outputPath = path.join(__dirname, 'output', 'agents.config.json');
    fs.mkdirSync(path.dirname(outputPath), { recursive: true });
    fs.writeFileSync(outputPath, JSON.stringify(outputConfig, null, 2));

    // ── Summary ────────────────────────────────────────────
    this.logger.log('\n═══════════════════════════════════════');
    this.logger.log('  ✅ Pipeline setup complete!');
    this.logger.log(`  Vault:       ${vaultId}`);
    this.logger.log(`  Environment: ${environmentId}`);
    this.logger.log(`  Memory:      ${memoryStoreId || '(skipped)'}`);
    this.logger.log(`  Agents:      ${Object.keys(agentIds).length}`);
    this.logger.log(`  Config:      ${outputPath}`);
    this.logger.log('═══════════════════════════════════════\n');

    return outputConfig;
  }
}
