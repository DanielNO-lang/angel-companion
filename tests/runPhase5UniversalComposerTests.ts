import { universalComposerService, UniversalComposerService } from '../src/services/universalComposerService';
import { conversationEngine } from '../src/services/conversationEngine';
import { workspaceEngine } from '../src/services/workspaceEngine';
import { agentEngine } from '../src/services/agentEngine';
import { APPROVED_EIGHT_STUDIOS } from '../src/services/studiosEngine';
import { ComposerContext, ComposerMode } from '../src/types/composer';
import { storageService } from '../src/services/storageService';

function assert(condition: boolean, testNum: number, name: string, detail?: string) {
  if (condition) {
    console.log(`[PASS] Phase 5A Test ${testNum}: ${name}`);
  } else {
    console.error(`[FAIL] Phase 5A Test ${testNum}: ${name} - ${detail || 'Assertion failed'}`);
    throw new Error(`Phase 5A Test ${testNum} Failed: ${name}`);
  }
}

async function runPhase5UniversalComposerTests() {
  console.log('=== STARTING PHASE 5A UNIVERSAL COMPOSER & INTERACTION ENGINE (20 TESTS) ===');

  // 1. Shared composer initialisation
  const genContext: ComposerContext = { type: 'general', conversationId: 'conv_gen_init' };
  const genKey = universalComposerService.getContextKey(genContext);
  const initialMode = universalComposerService.getMode(genContext);
  assert(
    Boolean(genKey) && genKey === 'general_conv_gen_init' && initialMode === 'Standard Intelligent',
    1,
    'Shared composer initialisation'
  );

  // 2. General Conversation submission
  const genResult = await universalComposerService.submit(
    genContext,
    'How does quantum entanglement relate to information theory?'
  );
  const genThread = conversationEngine.getActiveThread('general');
  const lastGenMsg = [...genThread.messages].reverse().find((m) => m.sender === 'user');
  assert(
    genResult.success === true &&
    genThread.scope === 'general' &&
    lastGenMsg?.content.includes('quantum entanglement') === true,
    2,
    'General Conversation submission preserves universal history without forced studio handoff'
  );

  // 3. Studio Conversation submission
  const studioContext: ComposerContext = { type: 'studio', studioId: 'research-studio' };
  const studioResult = await universalComposerService.submit(
    studioContext,
    'Synthesize 3 literature reviews on graph neural networks.'
  );
  const researchThread = conversationEngine.getActiveThread('studio', 'research-studio');
  assert(
    studioResult.success === true &&
    researchThread.studioId === 'research-studio' &&
    researchThread.scope === 'studio',
    3,
    'Studio Conversation submission'
  );

  // 4. All eight Studio contexts
  let allEightPassed = true;
  for (const studio of APPROVED_EIGHT_STUDIOS) {
    const sCtx: ComposerContext = { type: 'studio', studioId: studio.id };
    const res = await universalComposerService.submit(sCtx, `Test query for ${studio.name}`);
    const sThread = conversationEngine.getActiveThread('studio', studio.id);
    if (!res.success || sThread.studioId !== studio.id) {
      allEightPassed = false;
    }
  }
  assert(
    allEightPassed,
    4,
    'All eight Studio contexts'
  );

  // 5. Workspace instructions
  const wsContext: ComposerContext = { type: 'workspace', projectId: 'proj_default' };
  const wsResult = await universalComposerService.submit(
    wsContext,
    'Ensure all architectural diagrams include the Universal Composer service.'
  );
  const proj = workspaceEngine.getProjects().find((p) => p.id === 'proj_default');
  const instructionFile = proj?.files.find((f) => f.tags?.includes('instruction'));
  assert(
    wsResult.success === true &&
    Boolean(instructionFile) &&
    instructionFile?.content.includes('Universal Composer') === true,
    5,
    'Workspace instructions'
  );

  // 6. Project context preservation
  const fileAttachResult = await universalComposerService.submit(
    wsContext,
    'Adding component blueprint',
    { name: 'Blueprint_Spec.md', size: 120, content: '# Blueprint Spec' }
  );
  const attachedDoc = proj?.files.find((f) => f.name === 'Blueprint_Spec.md');
  assert(
    fileAttachResult.success === true &&
    Boolean(attachedDoc) &&
    attachedDoc?.content === '# Blueprint Spec' &&
    proj?.id === 'proj_default',
    6,
    'Project context preservation'
  );

  // 7. Adaptive Workspace instructions
  const adaptContext: ComposerContext = { type: 'adaptive', projectId: 'code' };
  const adaptResult = await universalComposerService.submit(
    adaptContext,
    'Optimize AST parser for parallel worker execution.'
  );
  assert(
    adaptResult.success === true &&
    adaptResult.summaryText.includes("adaptive preset 'code'"),
    7,
    'Adaptive Workspace instructions'
  );

  // 8. Agent task creation
  const agentContext: ComposerContext = { type: 'agent_task', agentId: 'agent_code' };
  const agentBefore = agentEngine.getAgent('agent_code');
  const countBefore = agentBefore?.executionCount || 0;
  const agentResult = await universalComposerService.submit(
    agentContext,
    'Refactor memory cache indexing for sub-millisecond lookups.'
  );
  const agentAfter = agentEngine.getAgent('agent_code');
  assert(
    agentResult.success === true &&
    agentAfter?.executionCount === countBefore + 1,
    8,
    'Agent task creation'
  );

  // 9. Rejection of invalid agent tasks
  const noAgentContext: ComposerContext = { type: 'agent_task' };
  const noAgentRes = await universalComposerService.submit(noAgentContext, 'Some task text');
  const emptyTaskRes = await universalComposerService.submit(agentContext, '   ');
  assert(
    noAgentRes.success === false &&
    noAgentRes.error?.includes('requires a selected agent ID') === true &&
    emptyTaskRes.success === false &&
    emptyTaskRes.error?.includes('requires a meaningful task description') === true,
    9,
    'Rejection of invalid agent tasks'
  );

  // 10. Correct message routing
  const generalThreadCountBefore = conversationEngine.getThreads('general').length;
  const writingContext: ComposerContext = { type: 'studio', studioId: 'creative-studio' };
  const routingRes = await universalComposerService.submit(writingContext, 'Draft a press release for v2 launch');
  const writingThread = conversationEngine.getActiveThread('studio', 'creative-studio');
  const generalThreadCountAfter = conversationEngine.getThreads('general').length;
  const lastWritingMsg = [...writingThread.messages].reverse().find((m) => m.sender === 'user');
  if (
    !(routingRes.success === true &&
    generalThreadCountAfter === generalThreadCountBefore &&
    lastWritingMsg?.content.includes('Draft a press release') === true &&
    writingThread.scope === 'studio' &&
    writingThread.studioId === 'creative-studio')
  ) {
    console.error('Test 10 Failure Details:', {
      routingResSuccess: routingRes.success,
      genBefore: generalThreadCountBefore,
      genAfter: generalThreadCountAfter,
      lastMsgContent: lastWritingMsg?.content,
      scope: writingThread.scope,
      studioId: writingThread.studioId
    });
  }
  assert(
    routingRes.success === true &&
    generalThreadCountAfter === generalThreadCountBefore &&
    lastWritingMsg?.content.includes('Draft a press release') === true &&
    writingThread.scope === 'studio' &&
    writingThread.studioId === 'creative-studio',
    10,
    'Correct message routing'
  );

  // 11. Mode selection
  const modeContext: ComposerContext = { type: 'general', conversationId: 'conv_mode_select' };
  universalComposerService.setMode(modeContext, 'Deep Research');
  const selectedMode = universalComposerService.getMode(modeContext);
  universalComposerService.setMode(modeContext, 'Code Analysis');
  const selectedMode2 = universalComposerService.getMode(modeContext);
  assert(
    selectedMode === 'Deep Research' && selectedMode2 === 'Code Analysis',
    11,
    'Mode selection'
  );

  // 12. Mode persistence
  const ctxA: ComposerContext = { type: 'studio', studioId: 'learning-education-studio' };
  const ctxB: ComposerContext = { type: 'studio', studioId: 'professional-intelligence-studio' };
  universalComposerService.setMode(ctxA, 'Creative Brainstorm');
  universalComposerService.setMode(ctxB, 'Deep Research');
  const modeA = universalComposerService.getMode(ctxA);
  const modeB = universalComposerService.getMode(ctxB);
  assert(
    modeA === 'Creative Brainstorm' && modeB === 'Deep Research',
    12,
    'Mode persistence'
  );

  // 13. Enter and Shift + Enter behaviour
  // Multiline message inserted via Shift+Enter contains \n and should be submitted intact
  const multilineContext: ComposerContext = { type: 'general', conversationId: 'conv_multiline' };
  const multilineText = 'First line with Shift+Enter\nSecond line with more details\nThird line';
  const multilineResult = await universalComposerService.submit(multilineContext, multilineText);
  const multiThread = conversationEngine.getActiveThread('general');
  const savedMultiMsg = [...multiThread.messages].reverse().find((m) => m.sender === 'user');
  assert(
    multilineResult.success === true &&
    savedMultiMsg?.content === multilineText &&
    savedMultiMsg?.content.includes('\n'),
    13,
    'Enter and Shift + Enter behaviour'
  );

  // 14. Duplicate submission prevention
  const dupContext: ComposerContext = { type: 'general', conversationId: 'conv_dup_prevention' };
  const p1 = universalComposerService.submit(dupContext, 'Parallel submission 1');
  const p2 = universalComposerService.submit(dupContext, 'Parallel submission 2');
  const [res1, res2] = await Promise.all([p1, p2]);
  const oneSucceededOneBlocked =
    (res1.success && !res2.success && res2.error?.includes('already in progress')) ||
    (!res1.success && res2.success && res1.error?.includes('already in progress'));
  assert(
    Boolean(oneSucceededOneBlocked),
    14,
    'Duplicate submission prevention'
  );

  // 15. Independent drafts
  const draftCtx1: ComposerContext = { type: 'general', conversationId: 'conv_draft_1' };
  const draftCtx2: ComposerContext = { type: 'studio', studioId: 'agent-automation-studio' };
  const draftCtx3: ComposerContext = { type: 'workspace', projectId: 'proj_default' };
  universalComposerService.setDraft(draftCtx1, 'Draft for General');
  universalComposerService.setDraft(draftCtx2, 'Draft for Systems Studio');
  universalComposerService.setDraft(draftCtx3, 'Draft for Workspace');
  const d1 = universalComposerService.getDraft(draftCtx1);
  const d2 = universalComposerService.getDraft(draftCtx2);
  const d3 = universalComposerService.getDraft(draftCtx3);
  universalComposerService.clearDraft(draftCtx2);
  assert(
    d1 === 'Draft for General' &&
    d2 === 'Draft for Systems Studio' &&
    d3 === 'Draft for Workspace' &&
    universalComposerService.getDraft(draftCtx2) === '' &&
    universalComposerService.getDraft(draftCtx1) === 'Draft for General',
    15,
    'Independent drafts'
  );

  // 16. Draft persistence after refresh
  const persistCtx: ComposerContext = { type: 'general', conversationId: 'conv_refresh_persist' };
  universalComposerService.setDraft(persistCtx, 'Unsent important research notes');
  // Simulate page reload by creating a fresh UniversalComposerService instance that reads from storageService
  const reloadedService = new UniversalComposerService();
  const loadedDraft = reloadedService.getDraft(persistCtx);
  assert(
    loadedDraft === 'Unsent important research notes',
    16,
    'Draft persistence after refresh'
  );

  // 17. Message persistence
  const allGeneralThreads = conversationEngine.getThreads('general');
  const totalMessages = allGeneralThreads.reduce((sum, t) => sum + t.messages.length, 0);
  assert(
    allGeneralThreads.length > 0 && totalMessages > 0,
    17,
    'Message persistence'
  );

  // 18. Error handling
  const errContext: ComposerContext = { type: 'general', conversationId: 'conv_err_handling' };
  const emptyRes = await universalComposerService.submit(errContext, '    ');
  const agentErrContext: ComposerContext = { type: 'agent_task', agentId: 'non_existent_agent_999' };
  const agentNotFoundRes = await universalComposerService.submit(agentErrContext, 'Valid task description');
  assert(
    emptyRes.success === false &&
    Boolean(emptyRes.error) &&
    agentNotFoundRes.success === false &&
    agentNotFoundRes.error?.includes('not found') === true,
    18,
    'Error handling'
  );

  // 19. Existing conversation compatibility
  const generalThreads = conversationEngine.getThreads('general');
  const studioThreads = conversationEngine.getThreads('studio');
  const allValid =
    generalThreads.every((t) => t.id && Array.isArray(t.messages) && t.scope === 'general') &&
    studioThreads.every((t) => t.id && Array.isArray(t.messages) && t.scope === 'studio');
  assert(
    allValid && generalThreads.length > 0 && studioThreads.length > 0,
    19,
    'Existing conversation compatibility'
  );

  // 20. Preservation of existing composer interactions
  const interactContext: ComposerContext = { type: 'general', conversationId: 'conv_interactions' };
  universalComposerService.setMode(interactContext, 'Code Analysis');
  const interactResult = await universalComposerService.submit(
    interactContext,
    'Voice dictated and attachment combined command',
    { name: 'schema_dump.sql', size: 256, content: 'CREATE TABLE angel_sessions (...);' }
  );
  const interactThread = conversationEngine.getActiveThread('general');
  const lastUserMsg = [...interactThread.messages].reverse().find((m) => m.sender === 'user');
  assert(
    interactResult.success === true &&
    lastUserMsg?.mode === 'Code Analysis' &&
    lastUserMsg?.attachments?.includes('schema_dump.sql') === true &&
    lastUserMsg?.content.includes('Voice dictated') === true,
    20,
    'Preservation of existing composer interactions'
  );

  console.log('=== ALL 20 PHASE 5A UNIVERSAL COMPOSER TESTS PASSED SUCCESSFULLY! ✅ ===');
}

runPhase5UniversalComposerTests().catch((err) => {
  console.error(err);
  process.exit(1);
});
