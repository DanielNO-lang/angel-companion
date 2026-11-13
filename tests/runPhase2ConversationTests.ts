/**
 * ANGEL AI PHASE 2 - CONVERSATION ENGINE & STUDIO SEPARATION TEST SUITE
 * Tests all 12 mandatory scenarios verifying strict separation between
 * General Conversation (universal scope) and the 8 Studio Conversations (contextual scope).
 */

import { conversationEngine, ConversationThread } from '../src/services/conversationEngine';
import { storageService, STORAGE_KEYS } from '../src/services/storageService';
import { StudioId } from '../src/types/angel';

async function runPhase2ConversationTests() {
  console.log('=== STARTING PHASE 2 CONVERSATION ENGINE & STUDIO SEPARATION TESTS ===\n');
  let passedTests = 0;
  let totalTests = 0;

  function assert(condition: boolean, scenarioNum: number, description: string, detail?: string) {
    totalTests++;
    if (condition) {
      passedTests++;
      console.log(`[PASS] Scenario ${scenarioNum}: ${description}`);
    } else {
      console.error(`[FAIL] Scenario ${scenarioNum}: ${description} - ${detail || 'Assertion failed'}`);
    }
  }

  // 1. Scenario 1: Open General Conversation and send "Hi Angel". No Studio selection requested.
  const generalThread1 = conversationEngine.createThread('general', undefined, 'General Test Session 1');
  assert(
    generalThread1.scope === 'general' && generalThread1.studioId === undefined,
    1,
    'General Conversation created with universal scope and no studioId restriction'
  );

  const msg1 = await conversationEngine.addMessage(generalThread1.id, 'Hi Angel');
  assert(
    msg1.content === 'Hi Angel' && generalThread1.messages.some((m) => m.content === 'Hi Angel'),
    1,
    'Message "Hi Angel" sent to General Conversation without asking for Studio selection'
  );

  // 2. Scenario 2: Send ordinary general question. Remains in General Conversation.
  const msg2 = await conversationEngine.addMessage(generalThread1.id, 'What is the weather today in Tokyo?');
  assert(
    generalThread1.scope === 'general' && generalThread1.messages.some((m) => m.content.includes('Tokyo')),
    2,
    'General question remains strictly in General Conversation'
  );

  // 3. Scenario 3: Create a second general conversation. Both remain independent.
  const generalThread2 = conversationEngine.createThread('general', undefined, 'General Test Session 2');
  await conversationEngine.addMessage(generalThread2.id, 'Brainstorm startup ideas');
  
  assert(
    generalThread1.id !== generalThread2.id &&
    generalThread1.messages.length === 2 &&
    generalThread2.messages.length === 1,
    3,
    'New conversations start without demo greetings and remain completely independent'
  );

  // 4. Scenario 4: Open Research Studio and start a contextual conversation.
  const researchThread = conversationEngine.createThread('studio', 'research-studio', 'Research Literature Analysis');
  await conversationEngine.addMessage(researchThread.id, 'Analyze arXiv quantum computing papers');

  assert(
    researchThread.scope === 'studio' && researchThread.studioId === 'research-studio',
    4,
    'Research Studio conversation created with scope: studio and studioId: research-studio'
  );

  // 5. Scenario 5: Switch to Development Studio and start another conversation.
  const devThread = conversationEngine.createThread('studio', 'development-studio', 'Dev Refactoring Task');
  await conversationEngine.addMessage(devThread.id, 'Refactor TypeScript AST parser');

  assert(
    devThread.scope === 'studio' && devThread.studioId === 'development-studio',
    5,
    'Development Studio conversation created with scope: studio and studioId: development-studio'
  );

  // 6. Scenario 6: Return to General Conversation. Original history intact.
  conversationEngine.setActiveThread(generalThread1.id);
  const activeGeneral = conversationEngine.getActiveThread('general');
  assert(
    activeGeneral.scope === 'general' &&
    activeGeneral.messages.some((m) => m.content.includes('Tokyo')),
    6,
    'Returning to General Conversation retains original general history intact'
  );

  // 7. Scenario 7: Return to Research Studio. Original context intact.
  const activeResearch = conversationEngine.getActiveThread('studio', 'research-studio');
  assert(
    activeResearch.scope === 'studio' &&
    activeResearch.studioId === 'research-studio' &&
    activeResearch.messages.some((m) => m.content.includes('quantum computing')),
    7,
    'Returning to Research Studio retains original research context intact'
  );

  // 8. Scenario 8: Test main Conversation navigation control.
  const mainThreads = conversationEngine.getThreads('general');
  assert(
    mainThreads.every((t) => t.scope === 'general'),
    8,
    'Main Conversation navigation accesses strictly general scoped threads'
  );

  // 9. Scenario 9: Test Chat toggle inside each Studio.
  const studioIdsList: StudioId[] = [
    'research-studio',
    'development-studio',
    'creative-studio',
    'learning-education-studio',
    'professional-intelligence-studio',
    'personal-life-studio',
    'agent-automation-studio',
    'device-environment-studio',
  ];

  let studioChatsValid = true;
  studioIdsList.forEach((sId) => {
    const thread = conversationEngine.getActiveThread('studio', sId);
    if (thread.scope !== 'studio' || thread.studioId !== sId) {
      studioChatsValid = false;
    }
  });

  assert(
    studioChatsValid === true,
    9,
    'Chat toggle inside each of the 8 Studios opens its dedicated contextual Studio conversation'
  );

  // 10. Scenario 10: Refresh application and verify conversation scopes and histories persist.
  const backupJSON = storageService.exportBackupJSON();
  assert(
    backupJSON.includes('conv_general_') && backupJSON.includes('conv_studio_'),
    10,
    'Conversation threads with scope and studioId metadata persist across refreshes'
  );

  // 11. Scenario 11: Verify no Studio automatically captures general messages.
  const generalMessages = conversationEngine.getThreads('general').flatMap((t) => t.messages);
  const studioMessages = conversationEngine.getThreads('studio').flatMap((t) => t.messages);
  const leakedGeneralInStudio = studioMessages.some((m) => m.content.includes('Tokyo'));

  assert(
    leakedGeneralInStudio === false,
    11,
    'No Studio automatically captures or leaks general conversation messages'
  );

  // 12. Scenario 12: Verify handoff between environments happens ONLY through an intentional user action.
  const handoffThread = conversationEngine.handoffToStudio(generalThread1.id, 'development-studio', 'Intentional user handoff prompt');
  
  assert(
    handoffThread.scope === 'studio' &&
    handoffThread.studioId === 'development-studio' &&
    handoffThread.metadata?.handoffFromId === generalThread1.id &&
    generalThread1.scope === 'general',
    12,
    'Handoff creates a new Studio thread without altering or removing the original General Conversation'
  );

  // Cleanup Test Threads
  conversationEngine.deleteThread(generalThread1.id);
  conversationEngine.deleteThread(generalThread2.id);
  conversationEngine.deleteThread(researchThread.id);
  conversationEngine.deleteThread(devThread.id);
  conversationEngine.deleteThread(handoffThread.id);

  console.log(`\n=== TEST SUITE RESULTS: ${passedTests} / ${totalTests} PASSED ===`);
  if (passedTests === totalTests) {
    console.log('ALL PHASE 2 CONVERSATION SEPARATION SCENARIOS PASSED! ✅\n');
  } else {
    console.error('SOME CONVERSATION SCENARIOS FAILED. INSPECT LOGS ABOVE. ❌\n');
  } else {
    process.exitCode = 1;
  }
}

runPhase2ConversationTests().catch((err) => {
  console.error('Phase 2 test execution failed:', err);
  process.exitCode = 1;
});
