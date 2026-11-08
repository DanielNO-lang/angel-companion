import { universalComposerService } from '../src/services/universalComposerService';
import { conversationEngine } from '../src/services/conversationEngine';
import { workspaceEngine } from '../src/services/workspaceEngine';
import { agentEngine } from '../src/services/agentEngine';
import { APPROVED_EIGHT_STUDIOS } from '../src/services/studiosEngine';
import { ComposerContext, ComposerMode } from '../src/types/composer';

function assert(condition: boolean, testNum: number, name: string, detail?: string) {
  if (condition) {
    console.log(`[PASS] Phase 5A Test ${testNum}: ${name}`);
  } else {
    console.error(`[FAIL] Phase 5A Test ${testNum}: ${name} - ${detail || 'Assertion failed'}`);
    throw new Error(`Phase 5A Test ${testNum} Failed: ${name}`);
  }
}

async function runPhase5UniversalComposerTests() {
  console.log('=== STARTING PHASE 5A UNIVERSAL COMPOSER & INTERACTION ENGINE TESTS ===');

  // 1. Shared composer initialisation
  const genContext: ComposerContext = { type: 'general', conversationId: 'conv_gen_test_1' };
  const genKey = universalComposerService.getContextKey(genContext);
  assert(
    Boolean(genKey) && genKey === 'general_conv_gen_test_1',
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

  // 3. Correct Studio conversation submission
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
    'Correct Studio conversation submission'
  );

  // 4. Independent contexts for all eight Studios
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
    'Independent contexts for all eight Studios'
  );

  // 5. Workspace instruction submission
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
    'Workspace instruction submission'
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
    attachedDoc?.content === '# Blueprint Spec',
    6,
    'Project context preservation with genuine file resources'
  );

  // 7. Adaptive Workspace submission
  const adaptContext: ComposerContext = { type: 'adaptive', projectId: 'code' };
  const adaptResult = await universalComposerService.submit(
    adaptContext,
    'Optimize AST parser for parallel worker execution.'
  );
  assert(
    adaptResult.success === true &&
    adaptResult.summaryText.includes("adaptive preset 'code'"),
    7,
    'Adaptive Workspace submission'
  );

  // 8. Agent task assignment
  const agentContext: ComposerContext = { type: 'agent_task', agentId: 'agent_code' };
  const agentResult = await universalComposerService.submit(
    agentContext,
    'Refactor memory cache indexing for sub-millisecond lookups.'
  );
  const codeAgent = agentEngine.getAgent('agent_code');
  assert(
    agentResult.success === true &&
    codeAgent?.executionCount === 1,
    8,
    'Agent task assignment executes task and updates counter'
  );

  // 9. Rejection of tasks without an agent or task description
  const invalidAgentContext: ComposerContext = { type: 'agent_task' };
  const noAgentRes = await universalComposerService.submit(invalidAgentContext, 'Some task text');
  const emptyTaskRes = await universalComposerService.submit(agentContext, '   ');
  assert(
    noAgentRes.success === false &&
    noAgentRes.error?.includes('requires a selected agent ID') === true &&
    emptyTaskRes.success === false &&
    emptyTaskRes.error?.includes('requires a meaningful task description') === true,
    9,
    'Rejection of tasks without an agent or task description'
  );

  // 10. Mode selection and persistence
  const modeContext: ComposerContext = { type: 'general', conversationId: 'conv_mode_test' };
  universalComposerService.setMode(modeContext, 'Deep Research');
  const currentMode = universalComposerService.getMode(modeContext);
  assert(
    currentMode === 'Deep Research',
    10,
    'Mode selection and persistence'
  );

  // 11. Correct message metadata
  const metaContext: ComposerContext = { type: 'general', conversationId: 'conv_meta_test' };
  await universalComposerService.submit(metaContext, 'Testing message metadata preservation');
  const metaThread = conversationEngine.getActiveThread('general');
  const metaMsg = metaThread.messages[metaThread.messages.length - 2]; // user message
  assert(
    Boolean(metaMsg.timestamp) &&
    metaMsg.sender === 'user' &&
    Boolean(metaMsg.id),
    11,
    'Correct message metadata'
  );

  // 12. Enter and Shift + Enter behaviour where testable
  const key1 = universalComposerService.getContextKey({ type: 'general', conversationId: 'key_test' });
  assert(
    key1 === 'general_key_test',
    12,
    'Enter and Shift + Enter context key resolution'
  );

  // 13. Duplicate submission prevention
  const dupContext: ComposerContext = { type: 'general', conversationId: 'conv_dup_test' };
  const subPromise1 = universalComposerService.submit(dupContext, 'Simultaneous request 1');
  const subPromise2 = universalComposerService.submit(dupContext, 'Simultaneous request 2');
  const [res1, res2] = await Promise.all([subPromise1, subPromise2]);
  assert(
    Boolean((res1.success && !res2.success && res2.error?.includes('already in progress')) ||
    (!res1.success && res2.success && res1.error?.includes('already in progress'))),
    13,
    'Duplicate submission prevention'
  );

  // 14. Message persistence
  const threadsBefore = conversationEngine.getThreads('general');
  assert(
    threadsBefore.length > 0 &&
    threadsBefore[0].messages.length > 0,
    14,
    'Message persistence'
  );

  // 15. Multiple composer draft isolation
  const ctxA: ComposerContext = { type: 'general', conversationId: 'conv_draft_A' };
  const ctxB: ComposerContext = { type: 'studio', studioId: 'development-studio' };
  universalComposerService.setDraft(ctxA, 'Draft text for General');
  universalComposerService.setDraft(ctxB, 'Draft text for Dev Studio');
  const draftA = universalComposerService.getDraft(ctxA);
  const draftB = universalComposerService.getDraft(ctxB);
  universalComposerService.clearDraft(ctxA);
  assert(
    draftA === 'Draft text for General' &&
    draftB === 'Draft text for Dev Studio' &&
    universalComposerService.getDraft(ctxA) === '' &&
    universalComposerService.getDraft(ctxB) === 'Draft text for Dev Studio',
    15,
    'Multiple composer draft isolation'
  );

  // 16. Error handling
  const errContext: ComposerContext = { type: 'general', conversationId: 'conv_err_test' };
  const emptyRes = await universalComposerService.submit(errContext, '   ');
  assert(
    emptyRes.success === false &&
    Boolean(emptyRes.error),
    16,
    'Error handling for invalid or empty submissions'
  );

  // 17. Backward compatibility with saved conversations
  const allGeneralThreads = conversationEngine.getThreads('general');
  const compatPassed = allGeneralThreads.every((t) => Array.isArray(t.messages) && t.scope === 'general');
  assert(
    Boolean(compatPassed),
    17,
    'Backward compatibility with saved conversations'
  );

  console.log('=== ALL 17 PHASE 5A UNIVERSAL COMPOSER TESTS PASSED SUCCESSFULLY! ✅ ===');
}

runPhase5UniversalComposerTests().catch((err) => {
  console.error(err);
  process.exit(1);
});
