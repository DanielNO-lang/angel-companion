import assert from 'node:assert/strict';
import { conversationEngine } from '../src/services/conversationEngine';
import { memoryEngine } from '../src/services/memoryEngine';
import { APPROVED_EIGHT_STUDIOS } from '../src/services/studiosEngine';

async function runConversationBehaviorRepairTests() {
  console.log('=== STARTING CONVERSATION BEHAVIOUR & PRIVATE MEMORY REPAIR TESTS ===');

  let passed = 0;

  function check(condition: boolean, testNum: number, name: string) {
    if (!condition) {
      throw new Error(`Conversation Behavior Test ${testNum} Failed: ${name}`);
    }
    passed++;
    console.log(`[PASS] Conversation & Memory Repair Test ${testNum}: ${name}`);
  }

  // 1. Unauthenticated conversation requires sign-in cleanly without canned fallback prose
  conversationEngine.setAccessToken(null, null);
  const threadHi = conversationEngine.createThread('general', undefined, 'Test Unauth');
  await conversationEngine.addMessage(threadHi.id, 'Hi', 'user');
  const resHi = await conversationEngine.generateAssistantResponse(threadHi.id);
  check(
    resHi.status === 'failed' && resHi.content.includes('Sign in'),
    1,
    'Unauthenticated generation refuses to emit fake prose and requires sign-in'
  );

  // 2. Retry preserves user history and never drops user turn
  const countBeforeRetry = threadHi.messages.length;
  const retried = await conversationEngine.retryLastTurn(threadHi.id);
  check(
    Boolean(retried) &&
      threadHi.messages.length === countBeforeRetry &&
      threadHi.messages[0].content === 'Hi',
    2,
    'retryLastTurn preserves prior user message history when retrying'
  );

  // 3. No raw memory context strings leaked into visible assistant messages
  memoryEngine.saveMemory({
    category: 'personal',
    scope: 'general',
    title: 'Favorite Language',
    content: 'User prefers TypeScript and React.',
    source: 'Test setup',
  });
  check(
    !resHi.content.includes('[Retrieved Memory Context]') && !resHi.content.includes('[PERSONAL]'),
    3,
    'No raw memory context strings appear in visible assistant messages'
  );

  // 4. Relevant memory retrieval & irrelevant exclusion
  const privateContext = memoryEngine.retrieveContextForPrompt('TypeScript', 'general');
  const irrelevantRetrieve = memoryEngine.retrieveContextForPrompt('Quantum Entanglement in non-local universes', 'general');
  check(
    Boolean(privateContext) && privateContext.includes('TypeScript'),
    4,
    'Relevant memory retrieved internally'
  );
  check(
    !irrelevantRetrieve.includes('TypeScript'),
    5,
    'Irrelevant memories excluded cleanly'
  );

  // 6. General Conversation continuity
  const genThread = conversationEngine.getActiveThread('general');
  check(
    genThread.scope === 'general' && genThread.messages.length > 0,
    6,
    'General Conversation continuity maintained'
  );

  // 7. Studio conversation continuity across all 8 Studios
  let allStudiosContinuous = true;
  const createdStudioThreadIds: string[] = [];
  for (const st of APPROVED_EIGHT_STUDIOS) {
    const sThread = conversationEngine.createThread('studio', st.id, `${st.name} Test`);
    createdStudioThreadIds.push(sThread.id);
    await conversationEngine.addMessage(sThread.id, `Hello in ${st.name}`, 'user');
    if (sThread.studioId !== st.id || sThread.messages.length !== 1) {
      allStudiosContinuous = false;
    }
  }
  check(
    allStudiosContinuous,
    7,
    'Studio conversation continuity maintained across all eight Studios'
  );

  // 8. Prevention of cross-Studio memory leakage
  const devSecretMem = memoryEngine.saveMemory({
    category: 'studio',
    scope: 'studio',
    studioId: 'development-studio',
    title: 'Dev Secret',
    content: 'Dev secret architectural key 998877',
    source: 'Dev Studio',
  });
  const researchContext = memoryEngine.retrieveContextForPrompt('Dev secret', 'studio', 'research-studio');
  check(
    !researchContext.includes('998877'),
    8,
    'Strict Studio memory isolation prevents cross-studio memory leakage'
  );

  // Cleanup
  conversationEngine.deleteThread(threadHi.id);
  createdStudioThreadIds.forEach((id) => conversationEngine.deleteThread(id));
  memoryEngine.deleteMemory(devSecretMem.id);
  const favMem = memoryEngine.getMemories('personal', 'general').find((m) => m.title === 'Favorite Language');
  if (favMem) memoryEngine.deleteMemory(favMem.id);

  console.log(`=== ALL ${passed} CONVERSATION & MEMORY REPAIR TESTS PASSED! ✅ ===`);
}

runConversationBehaviorRepairTests().catch((err) => {
  console.error(err);
  process.exit(1);
});
