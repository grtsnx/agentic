import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { PipelineService } from './pipeline.service';
import { VaultService } from './vault/vault.service';
import { EnvironmentService } from './environment/environment.service';
import { MemoryStoreService } from './memory/memory-store.service';

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

@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true })],
  providers: [
    PipelineService,
    VaultService,
    EnvironmentService,
    MemoryStoreService,
    IntentAgent,
    ConversationAgent,
    AuditAgent,
    ResearchAgent,
    DesignAgent,
    AnimationAgent,
    AssetAgent,
    VideoAgent,
    SchemaAgent,
    CmsAgent,
    EmailAgent,
    PaymentsAgent,
    I18nAgent,
    CodewriterAgent,
    QasAgent,
    SecurityAgent,
    AccessibilityAgent,
    PerformanceAgent,
    RundevAgent,
    AutofixAgent,
    TestingAgent,
    PreviewAgent,
    DeployAgent,
    VersionAgent,
    CustomMcpAgent,
    KnowledgeBaseAgent,
    OrchestratorAgent,
  ],
  exports: [PipelineService],
})
export class PipelineModule {}
