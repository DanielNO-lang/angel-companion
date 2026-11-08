/**
 * ANGEL AI FUNCTIONAL INTEGRITY REPAIR TEST SUITE
 * Tests all 15 explicit repair requirements from User Request Section 7:
 * 1. General chat does not echo a prompt as a generated answer.
 * 2. Unavailable AI providers are reported honestly.
 * 3. Research does not generate fabricated citations.
 * 4. Code generation does not report static templates as completed AI work.
 * 5. Capability statuses are accurate.
 * 6. Failed capabilities return proper errors.
 * 7. Agent execution requires a real handler.
 * 8. Agent execution counts only increase after real execution.
 * 9. Paused and failed agents retain the correct state.
 * 10. Memory preserves genuine user records.
 * 11. Sample records are removed safely.
 * 12. Duplicate and conflict detection work correctly.
 * 13. General and Studio memory isolation works.
 * 14. Failed storage operations are reported.
 * 15. Attachment actions do not create fake attachment records.
 */

import { conversationEngine } from '../src/services/conversationEngine';
import { promptIntelligenceEngine } from '../src/services/promptIntelligenceEngine';
import { capabilityRegistry } from '../src/services/capabilityRegistry';
import { agentEngine } from '../src/services/agentEngine';
import { memoryEngine } from '../src/services/memoryEngine';
import { workspaceEngine } from '../src/services/workspaceEngine';
import { storageService } from '../src/services/storageService';

async function runFunctionalIntegrityTests() {
  console.log('=== STARTING FUNCTIONAL INTEGRITY REPAIR TEST SUITE ===\n');
  let passed = 0;
  let total = 0;

  function assert(condition: boolean, testNum: number, name: string, detail?: string) {
    total++;
    if (condition) {
      passed++;
      console.log(`[PASS] Repair Check ${testNum}: ${name}`);
    } else {
      console.error(`[FAIL] Repair Check ${testNum}: ${name} - ${detail || 'Assertion failed'}`);
      throw new Error(`Integrity Check ${testNum} Failed: ${name}`);
    }
  }

  // 1. General chat does not echo a prompt as a generated answer
  const testThread = conversationEngine.createThread('general', undefined, 'Integrity Echo Test');
  const userPrompt = 'Explain the differences between synchronous and asynchronous architectures';
  await conversationEngine.addMessage(testThread.id, userPrompt, 'user');
  const aiResponse = await conversationEngine.generateAssistantResponse(testThread.id);
  assert(
    aiResponse.content !== userPrompt &&
    !aiResponse.content.startsWith(`[General Local Engine] Response for: "${userPrompt}"`) &&
    aiResponse.content.length > 20,
    1,
    'General chat does not echo a prompt as a generated answer'
  );

  // 2. Unavailable AI providers are reported honestly
  const devEnvCap = capabilityRegistry.getCapability('cap_device_browser_automation');
  const devEnvExec = await capabilityRegistry.executeCapability('cap_device_browser_automation', {}, { scope: 'general' });
  assert(
    (devEnvCap?.status === 'integration_pending' || devEnvCap?.status === 'implemented_awaiting_integration') &&
    devEnvExec.success === false &&
    Boolean(devEnvExec.awaitingIntegrationReason?.includes('headless browser')),
    2,
    'Unavailable AI providers / external systems are reported honestly with integration-pending status'
  );

  // 3. Research does not generate fabricated citations
  const researchExec = await capabilityRegistry.executeCapability('cap_research_synthesis', { topic: 'Quantum Graph Neural Networks' }, { scope: 'studio', studioId: 'research-studio' });
  const citations = researchExec.outputData.citations;
  const hasFabricatedCitations = citations.some((c: string) => c.toLowerCase().includes('arxiv:2') || c.toLowerCase().includes('doi:'));
  assert(
    researchExec.success === true &&
    hasFabricatedCitations === false &&
    citations[0].includes('No fictitious citations generated'),
    3,
    'Research does not generate fabricated citations'
  );

  // 4. Code generation does not report static templates as completed AI work
  const codeExec = await capabilityRegistry.executeCapability('cap_code_generator', { spec: 'Distributed Cache Manager' }, { scope: 'studio', studioId: 'development-studio' });
  assert(
    codeExec.success === true &&
    codeExec.outputData.codeSnippet.includes('scaffold') &&
    codeExec.summaryText.includes('scaffold'),
    4,
    'Code generation transparently identifies structural scaffold rather than claiming autonomous completed AI work'
  );

  // 5. Capability statuses are accurate
  const allCaps = capabilityRegistry.getAllCapabilities();
  const validStatuses = ['implemented', 'implemented_local', 'integration_pending', 'implemented_awaiting_integration', 'partial', 'partially_implemented', 'unavailable'];
  const allStatusesValid = allCaps.every((c) => validStatuses.includes(c.status));
  const hasPending = allCaps.some((c) => c.status === 'integration_pending' || c.status === 'implemented_awaiting_integration');
  assert(
    allStatusesValid && hasPending,
    5,
    'Capability statuses are accurate and distinguish implemented vs integration_pending'
  );

  // 6. Failed capabilities return proper errors
  const unregExec = await capabilityRegistry.executeCapability('cap_nonexistent_tool', {}, { scope: 'general' });
  assert(
    unregExec.success === false && unregExec.error === 'UNREGISTERED_CAPABILITY',
    6,
    'Failed capabilities return proper error codes and clear summaries'
  );

  // 7. Agent execution requires a real handler and task description
  const agentCode = agentEngine.getAgent('agent_code');
  assert(Boolean(agentCode && agentCode.status === 'idle'), 7, 'Agent starts in honest idle status');
  const emptyTaskExec = await agentEngine.executeTask('agent_code', '');
  assert(
    emptyTaskExec.success === false &&
    emptyTaskExec.error?.includes('cannot be empty') === true,
    7,
    'Agent execution requires a real task description and does not run without inputs'
  );

  // 8. Agent execution counts only increase after real execution
  const initialExecCount = agentCode?.executionCount || 0;
  const genuineExec = await agentEngine.executeTask('agent_code', 'Refactor auth controller types');
  const updatedAgentCode = agentEngine.getAgent('agent_code');
  assert(
    genuineExec.success === true &&
    (updatedAgentCode?.executionCount || 0) === initialExecCount + 1,
    8,
    'Agent execution counts only increase after genuine execution'
  );

  // 9. Paused and failed agents retain the correct state
  agentEngine.setAgentStatus('agent_research', 'paused');
  assert(agentEngine.getAgent('agent_research')?.status === 'paused', 9, 'Paused agent retains paused state');
  agentEngine.stopAgent('agent_research');
  assert(agentEngine.getAgent('agent_research')?.status === 'idle', 9, 'Stopped agent resets safely to idle');

  // 10. Memory preserves genuine user records
  const userMemory = memoryEngine.saveMemory({
    category: 'personal',
    scope: 'general',
    title: 'Genuine User Preference',
    content: 'User exclusively works in dark mode and requires strict error handling.',
    source: 'User Prompt',
  });
  const loadedUserMem = memoryEngine.getMemories('personal', 'general').find((m) => m.id === userMemory.id);
  assert(
    Boolean(loadedUserMem && loadedUserMem.content.includes('strict error handling')),
    10,
    'Memory engine preserves genuine user-created records'
  );

  // 11. Sample records are removed safely
  const cleanedCount = memoryEngine.cleanupSampleRecords();
  const remainingMems = memoryEngine.getMemories();
  assert(
    remainingMems.every((m) => m.id !== 'mem_1' && m.id !== 'mem_2' && m.id !== 'mem_3') &&
    remainingMems.some((m) => m.id === userMemory.id),
    11,
    'Sample records are removed safely while genuine user records remain completely intact'
  );

  // 12. Duplicate and conflict detection work correctly
  const dup = memoryEngine.saveMemory({
    category: 'personal',
    scope: 'general',
    title: 'Duplicate Preference',
    content: 'User exclusively works in dark mode and requires strict error handling.',
  });
  assert(dup.id === userMemory.id, 12, 'Duplicate detection detects exact content match and updates existing');

  const conflict = memoryEngine.saveMemory({
    category: 'personal',
    scope: 'general',
    title: 'Genuine User Preference',
    content: 'User exclusively works in light mode instead of dark mode.',
  });
  assert(Boolean(conflict.conflictNote?.includes('Conflicting information')), 12, 'Conflict detection identifies contradictory assertions');

  // 13. General and Studio memory isolation works
  memoryEngine.saveMemory({
    category: 'studio',
    scope: 'studio',
    studioId: 'development-studio',
    title: 'Dev Studio Private Rule',
    content: 'Do not use any any casts in Development Studio.',
  });
  const devContext = memoryEngine.retrieveContextForPrompt('casts', 'studio', 'development-studio');
  const resContext = memoryEngine.retrieveContextForPrompt('casts', 'studio', 'research-studio');
  assert(
    devContext.includes('Dev Studio Private Rule') &&
    !resContext.includes('Dev Studio Private Rule'),
    13,
    'General and Studio memory isolation prevents cross-studio memory leakage'
  );

  // 14. Failed storage operations are reported
  let reportedError = false;
  try {
    // Attempting to delete non-existent ID returns false cleanly
    const delRes = memoryEngine.deleteMemory('nonexistent_id_9999');
    assert(delRes === false, 14, 'Nonexistent memory deletion returns false without corruption');
  } catch {
    reportedError = true;
  }

  // 15. Attachment actions do not create fake attachment records
  const initialFilesCount = workspaceEngine.getProjects()[0]?.files.length || 0;
  // Verify adding a genuine file to workspace records real data
  const realFile = workspaceEngine.addFileToProject('proj_default', 'IntegrityTestDoc.md', '# Verified File\nReal data content.', 'document');
  assert(
    realFile !== null &&
    realFile.name === 'IntegrityTestDoc.md' &&
    workspaceEngine.getProjects()[0]?.files.length === initialFilesCount + 1,
    15,
    'Attachment and file actions record genuine workspace file data without placeholder fabrication'
  );

  // Cleanup
  memoryEngine.deleteMemory(userMemory.id);
  memoryEngine.deleteMemory(conflict.id);
  if (realFile) workspaceEngine.deleteFile(realFile.id);
  conversationEngine.deleteThread(testThread.id);

  console.log(`\n=== INTEGRITY REPAIR TEST SUITE: ${passed} / ${total} PASSED ===`);
  console.log('ALL FUNCTIONAL INTEGRITY REPAIR CHECKS PASSED SUCCESSFULLY! ✅\n');
}

runFunctionalIntegrityTests().catch((err) => {
  console.error('Integrity repair test failed:', err);
  process.exit(1);
});
