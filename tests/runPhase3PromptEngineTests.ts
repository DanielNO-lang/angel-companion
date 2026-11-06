/**
 * ANGEL AI PHASE 3 - UNIVERSAL PROMPT INTELLIGENCE AND CAPABILITY EXECUTION ENGINE TEST SUITE
 * Verifies all 15 mandatory test requirements specified in Section 13.
 */

import { promptIntelligenceEngine } from '../src/services/promptIntelligenceEngine';
import { capabilityRegistry } from '../src/services/capabilityRegistry';
import { capabilityRouter } from '../src/services/capabilityRouter';
import { executionPlanEngine } from '../src/services/executionPlanEngine';
import { promptStore } from '../src/services/promptStore';
import { STUDIO_CONFIGS, getStudioConfig } from '../src/services/studioConfigs';
import { permissionsEngine } from '../src/services/permissionsEngine';
import { conversationEngine } from '../src/services/conversationEngine';
import { StudioId } from '../src/types/angel';

async function runPhase3PromptEngineTests() {
  console.log('=== STARTING PHASE 3 PROMPT INTELLIGENCE & CAPABILITY ENGINE TESTS ===\n');
  let passedTests = 0;
  let totalTests = 0;

  function assert(condition: boolean, scenarioNum: number, description: string, detail?: string) {
    totalTests++;
    if (condition) {
      passedTests++;
      console.log(`[PASS] Requirement ${scenarioNum}: ${description}`);
    } else {
      console.error(`[FAIL] Requirement ${scenarioNum}: ${description} - ${detail || 'Assertion failed'}`);
    }
  }

  // 1. Requirement 1: General Conversation accepts an ordinary greeting without Studio selection.
  const res1 = await promptIntelligenceEngine.processPrompt('Hello Angel', { scope: 'general' });
  assert(
    res1.responseMessage.includes('Hello! I am Angel') && res1.parsedIntent.intent === 'greeting',
    1,
    'General Conversation accepts ordinary greeting without forcing Studio selection'
  );

  // 2. Requirement 2: General Conversation accepts a general research question.
  const res2 = await promptIntelligenceEngine.processPrompt('What are the latest findings on quantum computing algorithms?', { scope: 'general' });
  assert(
    res2.parsedIntent.intent === 'research_investigation' && res2.responseMessage.includes('Research Synthesis'),
    2,
    'General Conversation accepts general research question without forced redirection'
  );

  // 3. Requirement 3: General Conversation accepts an image-generation request without forced redirection.
  const res3 = await promptIntelligenceEngine.processPrompt('Generate an image concept and SVG layout for a dark futuristic UI', { scope: 'general' });
  assert(
    res3.parsedIntent.intent === 'creative_media' && res3.responseMessage.includes('Creative Visual Concept'),
    3,
    'General Conversation accepts image/creative request without forced redirection'
  );

  // 4. Requirement 4: General Conversation can recommend a Studio without forcing a handoff.
  assert(
    res2.recommendedStudioId === 'research-studio' && res2.responseMessage.includes('Studio Recommendation'),
    4,
    'General Conversation recommends a Studio while maintaining universal scope without forced handoff'
  );

  // 5. Requirement 5: A Development Studio request receives Development Studio context.
  const devSpec = promptIntelligenceEngine.constructPromptSpec(
    promptIntelligenceEngine.analyzeInput('Refactor TypeScript parser', { scope: 'studio', studioId: 'development-studio' }),
    { scope: 'studio', studioId: 'development-studio' }
  );
  assert(
    devSpec.systemInstruction.includes('Development Mode') && devSpec.studioId === 'development-studio',
    5,
    'Development Studio request receives explicit Development Studio context and constraints'
  );

  // 6. Requirement 6: A Research Studio request receives Research Studio context.
  const researchSpec = promptIntelligenceEngine.constructPromptSpec(
    promptIntelligenceEngine.analyzeInput('Synthesize arXiv literature', { scope: 'studio', studioId: 'research-studio' }),
    { scope: 'studio', studioId: 'research-studio' }
  );
  assert(
    researchSpec.systemInstruction.includes('Research Mode') && researchSpec.studioId === 'research-studio',
    6,
    'Research Studio request receives explicit Research Studio context and citation constraints'
  );

  // 7. Requirement 7: The eight Studios maintain independent configurations.
  const allStudioIds: StudioId[] = [
    'research-studio',
    'development-studio',
    'creative-studio',
    'learning-education-studio',
    'professional-intelligence-studio',
    'personal-life-studio',
    'agent-automation-studio',
    'device-environment-studio',
  ];
  const allUniqueConfigs = allStudioIds.every((sId) => {
    const cfg = getStudioConfig(sId);
    return cfg && cfg.studioId === sId && cfg.systemPromptPrefix.length > 20;
  });
  assert(
    allUniqueConfigs === true && Object.keys(STUDIO_CONFIGS).length === 8,
    7,
    'All eight Studios maintain distinct independent prompt configurations and capability rules'
  );

  // 8. Requirement 8: Missing essential information is identified correctly.
  const missingInfoRes = await promptIntelligenceEngine.processPrompt('Refactor it', { scope: 'general' });
  assert(
    missingInfoRes.parsedIntent.missingEssentialInfo.length > 0 &&
    missingInfoRes.responseMessage.includes('Which programming language or code module'),
    8,
    'Missing essential information is identified correctly and produces smallest necessary clarification question'
  );

  // 9. Requirement 9: Available capabilities are routed to their actual handlers.
  const capExecRes = await capabilityRegistry.executeCapability(
    'cap_code_generator',
    { text: 'TypeScript AST Component' },
    { scope: 'studio', studioId: 'development-studio' }
  );
  assert(
    capExecRes.success === true && capExecRes.outputData.codeSnippet.includes('TypeScript'),
    9,
    'Available capabilities are routed to their operational handlers producing valid results'
  );

  // 10. Requirement 10: Unavailable capabilities are not falsely executed.
  const awaitingCapRes = await capabilityRegistry.executeCapability(
    'cap_device_browser_automation',
    { text: 'Inspect DOM' },
    { scope: 'studio', studioId: 'device-environment-studio' }
  );
  assert(
    awaitingCapRes.success === false &&
    awaitingCapRes.awaitingIntegrationReason?.includes('browser_automation_daemon') === true,
    10,
    'Capabilities awaiting external integration are accurately declared and never falsely reported as locally executed'
  );

  // 11. Requirement 11: Multi-step plans preserve execution order and dependencies.
  const plan = executionPlanEngine.createPlan(
    'Test Refactor Plan',
    'Refactor and Save Component',
    'studio',
    'development-studio',
    [
      { stepId: 'step_1', stepName: 'Synthesize Code', capabilityId: 'cap_code_generator', requiresApproval: false, inputs: {}, dependsOnStepIds: [] },
      { stepId: 'step_2', stepName: 'Persist File', capabilityId: 'cap_workspace_file_ops', requiresApproval: false, inputs: {}, dependsOnStepIds: ['step_1'] },
    ]
  );
  const executedPlan = await executionPlanEngine.executePlan(plan.id, { scope: 'studio', studioId: 'development-studio' });
  assert(
    executedPlan.status === 'completed' &&
    executedPlan.steps[0].status === 'completed' &&
    executedPlan.steps[1].status === 'completed',
    11,
    'Multi-step plans preserve execution order, dependency resolution, and step progress'
  );

  // 12. Requirement 12: Failed steps report genuine errors.
  const failPlan = executionPlanEngine.createPlan(
    'Failing Plan Test',
    'Execute invalid capability',
    'general',
    undefined,
    [{ stepId: 'step_err', stepName: 'Invalid Step', capabilityId: 'invalid_cap_id', requiresApproval: false, inputs: {}, dependsOnStepIds: [] }]
  );
  const failedExec = await executionPlanEngine.executePlan(failPlan.id, { scope: 'general' });
  assert(
    failedExec.status === 'failed' && failedExec.errorSummary?.includes('UNREGISTERED_CAPABILITY') === true,
    12,
    'Failed steps report genuine error logs and set plan status to failed'
  );

  // 13. Requirement 13: User permissions are respected.
  const routerRes = capabilityRouter.route(
    promptIntelligenceEngine.analyzeInput('Capture hardware camera stream', { scope: 'studio', studioId: 'device-environment-studio' }),
    { scope: 'studio', studioId: 'device-environment-studio' }
  );
  assert(
    routerRes.missingPermissions.includes('device_control'),
    13,
    'Capability routing respects user permissions and flags missing device control access'
  );

  // 14. Requirement 14: Conversation context is preserved.
  const genThread = conversationEngine.createThread('general', undefined, 'Phase 3 Context Test');
  await conversationEngine.addMessage(genThread.id, 'What is quantum computing?');
  const aiReply = await conversationEngine.generateAssistantResponse(genThread.id);
  assert(
    genThread.messages.length === 3 && aiReply.content.includes('Research Synthesis'),
    14,
    'Conversation context is preserved across multi-turn prompt intelligence engine calls'
  );

  // 15. Requirement 15: Prompt records and execution history persist using local persistence architecture.
  const savedPrompt = promptStore.savePrompt({
    title: 'Unit Test Prompt Record',
    content: 'Execute unit test prompt analysis',
    scope: 'general',
    intent: 'question_explanation',
    tags: ['test', 'persistence'],
  });
  const retrievedPrompt = promptStore.getPrompt(savedPrompt.id);
  assert(
    retrievedPrompt !== undefined && retrievedPrompt.title === 'Unit Test Prompt Record',
    15,
    'Prompt records and execution history persist using existing local storage architecture'
  );

  // Cleanup Test Data
  conversationEngine.deleteThread(genThread.id);

  console.log(`\n=== TEST SUITE RESULTS: ${passedTests} / ${totalTests} PASSED ===`);
  if (passedTests === totalTests) {
    console.log('ALL PHASE 3 PROMPT INTELLIGENCE SCENARIOS PASSED! ✅\n');
  } else {
    console.error('SOME PHASE 3 PROMPT INTELLIGENCE SCENARIOS FAILED. INSPECT LOGS ABOVE. ❌\n');
  }
}

runPhase3PromptEngineTests().catch((err) => {
  console.error('Phase 3 test execution error:', err);
});
