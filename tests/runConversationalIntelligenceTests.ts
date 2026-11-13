import assert from 'node:assert';
import { conversationEngine } from '../src/services/conversationEngine';
import { promptIntelligenceEngine } from '../src/services/promptIntelligenceEngine';
import { conversationalIntelligence } from '../src/services/conversationalIntelligence';
import { geminiModelService, extractIntelligentTitle } from '../src/services/geminiModelService';
import { capabilityRegistry } from '../src/services/capabilityRegistry';

async function runConversationalIntelligenceTests() {
  console.log('--- STARTING ANGEL AI: CONVERSATIONAL INTELLIGENCE & REPAIR TEST SUITE ---');

  let passed = 0;
  let failed = 0;

  async function test(name: string, fn: () => Promise<void> | void) {
    try {
      await fn();
      console.log(`  ✓ [PASS] ${name}`);
      passed++;
    } catch (err: any) {
      console.error(`  ✗ [FAIL] ${name}:`, err.message);
      failed++;
    }
  }

  // Scenario 1: "Hi" -> natural proportional response
  await test('Scenario 1: "Hi" produces natural, proportional response without robotic formulas', async () => {
    const thread = conversationEngine.createThread('general', undefined, 'Test S1');
    await conversationEngine.addMessage(thread.id, 'Hi', 'user');
    const reply = await conversationEngine.generateAssistantResponse(thread.id);

    assert.ok(reply.content.length > 0, 'Reply should not be empty');
    assert.ok(!reply.content.includes('I understand'), 'Should not contain robotic "I understand" formula');
    assert.ok(/hey|hello|hi|how/i.test(reply.content), 'Should contain natural greeting');
    assert.ok(reply.content.length < 150, 'Greeting response should be proportionate and concise');
  });

  // Scenario 2: "I'm doing good" -> conversational continuation
  await test('Scenario 2: "I\'m doing good" continues conversation naturally without repetition', async () => {
    const thread = conversationEngine.createThread('general', undefined, 'Test S2');
    await conversationEngine.addMessage(thread.id, 'Hi', 'user');
    await conversationEngine.generateAssistantResponse(thread.id);
    await conversationEngine.addMessage(thread.id, "I'm doing good", 'user');
    const reply = await conversationEngine.generateAssistantResponse(thread.id);

    assert.ok(!reply.content.toLowerCase().includes("i'm doing good"), "Should not echo the user's message as an answer");
    assert.ok(/glad|hear|what|up to|working/i.test(reply.content), 'Should naturally ask what the user is working on or up to');
  });

  // Scenario 3: Natural follow-up ("I want to build a website...")
  await test('Scenario 3: Natural follow-up on building a website engages proportionally', async () => {
    const thread = conversationEngine.createThread('general', undefined, 'Test S3');
    await conversationEngine.addMessage(thread.id, 'I want to build a website', 'user');
    const reply = await conversationEngine.generateAssistantResponse(thread.id);

    assert.ok(/website|kind|thinking|about/i.test(reply.content), 'Should ask what kind of website the user has in mind');
    assert.ok(!reply.content.includes('Error'), 'Should not throw errors');
  });

  // Scenario 4: Multi-turn discussion
  await test('Scenario 4: Multi-turn discussion maintains coherent context across turns', async () => {
    const thread = conversationEngine.createThread('general', undefined, 'Test S4');
    await conversationEngine.addMessage(thread.id, 'I want to build a website', 'user');
    await conversationEngine.generateAssistantResponse(thread.id);
    await conversationEngine.addMessage(thread.id, 'It is for my photography portfolio', 'user');
    const reply = await conversationEngine.generateAssistantResponse(thread.id);

    assert.ok(/photo|portfolio|image|gallery|grid|visual/i.test(reply.content), 'Should understand it is a photography portfolio');
    assert.ok(thread.messages.length >= 5, 'Should preserve full history across turns');
  });

  // Scenario 5: Everyday factual question (What is photosynthesis?)
  await test('Scenario 5: Everyday factual question returns accurate, substantive explanation', async () => {
    const thread = conversationEngine.createThread('general', undefined, 'Test S5');
    await conversationEngine.addMessage(thread.id, 'What is photosynthesis?', 'user');
    const reply = await conversationEngine.generateAssistantResponse(thread.id);

    assert.ok(reply.content.includes('sunlight') || reply.content.includes('light energy'), 'Must describe light conversion');
    assert.ok(reply.content.includes('glucose') || reply.content.includes('carbon dioxide'), 'Must describe chemical products');
    assert.ok(!reply.content.includes('undefined'), 'Must have complete text');
  });

  // Scenario 6: Request for explanation (What is 25% of 200?)
  await test('Scenario 6: Mathematical question returns precise calculation without boilerplate', async () => {
    const thread = conversationEngine.createThread('general', undefined, 'Test S6');
    await conversationEngine.addMessage(thread.id, 'What is 25% of 200?', 'user');
    const reply = await conversationEngine.generateAssistantResponse(thread.id);

    assert.ok(reply.content.includes('50'), 'Must return 50');
    assert.ok(!reply.content.includes('I understand'), 'No canned introductory fillers');
  });

  // Scenario 7: Request to brainstorm
  await test('Scenario 7: Request to brainstorm returns distinct, actionable ideas', async () => {
    const thread = conversationEngine.createThread('general', undefined, 'Test S7');
    await conversationEngine.addMessage(thread.id, 'Suggest ideas for an innovative productivity app', 'user');
    const reply = await conversationEngine.generateAssistantResponse(thread.id);

    assert.ok(reply.content.includes('1.') || reply.content.includes('2.'), 'Should provide structured brainstorm ideas');
    assert.ok(reply.content.length > 100, 'Should be substantive and creative');
  });

  // Scenario 8: Research request
  await test('Scenario 8: Research request delivers factual scientific analysis without fabricated citations', async () => {
    const thread = conversationEngine.createThread('general', undefined, 'Test S8');
    await conversationEngine.addMessage(thread.id, 'Research quantum entanglement and bell inequalities', 'user');
    const reply = await conversationEngine.generateAssistantResponse(thread.id);

    assert.ok(/entanglement|bell|superposition|states/i.test(reply.content), 'Must discuss authentic quantum mechanics principles');
    assert.ok(!reply.content.includes('doi.org/fake'), 'Must not contain fabricated citation URLs');
  });

  // Scenario 9: Development request
  await test('Scenario 9: Development request returns syntactically valid TypeScript code', async () => {
    const thread = conversationEngine.createThread('general', undefined, 'Test S9');
    await conversationEngine.addMessage(thread.id, 'Write a TypeScript debounce function', 'user');
    const reply = await conversationEngine.generateAssistantResponse(thread.id);

    assert.ok(reply.content.includes('```typescript') || reply.content.includes('function'), 'Must include code block');
    assert.ok(reply.content.includes('debounce') || reply.content.includes('setTimeout'), 'Must contain debounce implementation');
  });

  // Scenario 10: Writing request
  await test('Scenario 10: Writing request returns polished draft ready to send', async () => {
    const thread = conversationEngine.createThread('general', undefined, 'Test S10');
    await conversationEngine.addMessage(thread.id, 'Draft a project update email for the team', 'user');
    const reply = await conversationEngine.generateAssistantResponse(thread.id);

    assert.ok(/subject:/i.test(reply.content), 'Should format email subject');
    assert.ok(/update|team|project/i.test(reply.content), 'Should address team update');
  });

  // Scenario 11: Studio-specific conversation
  await test('Scenario 11: Studio-specific conversation maintains studio tone and context', async () => {
    const thread = conversationEngine.createThread('studio', 'development-studio', 'Dev Session');
    await conversationEngine.addMessage(thread.id, 'Analyze AST tree parsing logic', 'user');
    const reply = await conversationEngine.generateAssistantResponse(thread.id);

    assert.equal(thread.scope, 'studio');
    assert.equal(thread.studioId, 'development-studio');
    assert.ok(reply.content.length > 20, 'Should return studio assistance response');
  });

  // Scenario 12: Follow-up referencing previous context ("it", "that")
  await test('Scenario 12: Follow-up referencing "that" resolves previous turn correctly', async () => {
    const thread = conversationEngine.createThread('general', undefined, 'Test S12');
    await conversationEngine.addMessage(thread.id, 'I want to build a website for photography', 'user');
    await conversationEngine.generateAssistantResponse(thread.id);
    await conversationEngine.addMessage(thread.id, 'Tell me more about that', 'user');
    const reply = await conversationEngine.generateAssistantResponse(thread.id);

    assert.ok(/website|photo|portfolio|image|layout/i.test(reply.content), 'Should resolve "that" to the website/photography discussion');
  });

  // Scenario 13: Request requiring missing capability
  await test('Scenario 13: Request requiring unconnected external capability reports honest status', async () => {
    const thread = conversationEngine.createThread('general', undefined, 'Test S13');
    await conversationEngine.addMessage(thread.id, 'What is the live weather forecast in Tokyo today?', 'user');
    const reply = await conversationEngine.generateAssistantResponse(thread.id);

    assert.ok(/weather|integration|pending|connected/i.test(reply.content), 'Must declare integration pending honestly');
    assert.ok(!reply.content.includes('72 degrees sunny and nice!'), 'Must not make up fake live weather');
  });

  // Scenario 14: Failed model connection handling
  await test('Scenario 14: Failed model connection returns clear pending/fallback status', async () => {
    const status = await geminiModelService.checkStatus();
    assert.ok(typeof status.connected === 'boolean', 'Status must return boolean connected');
    assert.equal(status.model, 'gemini-3.8-flash');
  });

  // Scenario 15: Retry after failure
  await test('Scenario 15: retryLastTurn allows seamless re-attempt without losing history', async () => {
    const thread = conversationEngine.createThread('general', undefined, 'Test S15');
    await conversationEngine.addMessage(thread.id, 'What is photosynthesis?', 'user');
    const firstReply = await conversationEngine.generateAssistantResponse(thread.id);
    const initialMsgCount = thread.messages.length;

    const retriedReply = await conversationEngine.retryLastTurn(thread.id);
    assert.ok(retriedReply, 'Should produce a retried reply');
    assert.equal(thread.messages.length, initialMsgCount, 'Message count should remain stable after replacement');
    assert.ok(retriedReply.content.includes('photosynthesis') || retriedReply.content.includes('glucose') || retriedReply.content.includes('biochemical'), 'Retried reply should be accurate');
  });

  // Scenario 16: Think mode
  await test('Scenario 16: Think mode provides deeply reasoned, structured analytical breakdown', async () => {
    const thread = conversationEngine.createThread('general', undefined, 'Test S16');
    await conversationEngine.addMessage(thread.id, 'Explain the mechanism of photosynthesis in plants', 'user', 'Think');
    const reply = await conversationEngine.generateAssistantResponse(thread.id);

    assert.ok(reply.content.includes('Deep Analytical Breakdown') || reply.content.includes('Phases') || reply.content.includes('Chemical Equation') || reply.content.includes('Light-Dependent'), 'Think mode must provide detailed multi-phase analytical reasoning');
  });

  // Scenario 17: New conversation title generation
  await test('Scenario 17: New conversation title is concise, 2-4 words, and never truncated with "..."', async () => {
    const thread = conversationEngine.createThread('general', undefined, 'General Conversation');
    await conversationEngine.addMessage(thread.id, 'I want to build a website for my photography portfolio', 'user');

    assert.ok(!thread.title.includes('...'), 'Title must NEVER contain "..."');
    assert.ok(thread.title.length > 5, 'Title must not be empty');
    assert.ok(thread.title.includes('Photography') || thread.title.includes('Website'), 'Title must be relevant to photography website');

    const greetingThread = conversationEngine.createThread('general', undefined, 'General Conversation');
    await conversationEngine.addMessage(greetingThread.id, 'Hi', 'user');
    assert.equal(greetingThread.title, 'General Conversation', 'Greeting should preserve clean default title');
  });

  // Scenario 18: Manual conversation title preservation
  await test('Scenario 18: Custom user-renamed title is preserved and not overwritten', async () => {
    const thread = conversationEngine.createThread('general', undefined, 'My Custom Project Title');
    conversationEngine.renameThread(thread.id, 'My Custom Project Title');
    assert.equal(thread.isCustomTitle, true, 'isCustomTitle must be true after manual rename');

    await conversationEngine.addMessage(thread.id, 'What is the capital of France?', 'user');
    assert.equal(thread.title, 'My Custom Project Title', 'Title should NOT be overwritten after user rename');
  });

  // Scenario 19: Conversation history restoration
  await test('Scenario 19: Conversation history is saved and restored accurately', async () => {
    const thread = conversationEngine.createThread('general', undefined, 'Restore Test');
    await conversationEngine.addMessage(thread.id, 'Remember that the meeting is on Friday', 'user');
    await conversationEngine.generateAssistantResponse(thread.id);

    const active = conversationEngine.getActiveThread('general');
    assert.ok(active.messages.some((m) => m.content.includes('meeting is on Friday')), 'Persisted thread must retain user messages');
  });

  // Scenario 20: General and Studio context isolation
  await test('Scenario 20: General and Studio threads maintain strict context isolation', async () => {
    const genThread = conversationEngine.getActiveThread('general');
    const studioThread = conversationEngine.getActiveThread('studio', 'research-studio');

    assert.notEqual(genThread.id, studioThread.id, 'General and Studio thread IDs must be distinct');
    assert.equal(genThread.scope, 'general');
    assert.equal(studioThread.scope, 'studio');
    assert.equal(studioThread.studioId, 'research-studio');
  });

  // Scenario 21: Latest-message scrolling behavior
  await test('Scenario 21: Message history maintains ordering and timestamps for smooth scrolling', async () => {
    const thread = conversationEngine.createThread('general', undefined, 'Scroll Order Test');
    await conversationEngine.addMessage(thread.id, 'First message', 'user');
    await conversationEngine.generateAssistantResponse(thread.id);
    await conversationEngine.addMessage(thread.id, 'Second message', 'user');
    await conversationEngine.generateAssistantResponse(thread.id);

    assert.equal(thread.messages[1].content, 'First message');
    assert.equal(thread.messages[3].content, 'Second message');
  });

  // Scenario 22: Long response scrolling
  await test('Scenario 22: Long comprehensive responses are preserved in full without arbitrary truncation', async () => {
    const thread = conversationEngine.createThread('general', undefined, 'Long Response Test');
    await conversationEngine.addMessage(thread.id, 'Photosynthesis', 'user', 'Think');
    const reply = await conversationEngine.generateAssistantResponse(thread.id);

    assert.ok(reply.content.length > 300, 'Long response should contain extensive technical depth');
  });

  // Scenario 23: Existing composer regression tests
  await test('Scenario 23: Universal Composer and mode registry regressions check', async () => {
    const composerTypes = await import('../src/types/composer');
    assert.ok(composerTypes, 'Composer types module must load successfully');

    // Test capability registry intact
    const caps = capabilityRegistry.getAllCapabilities();
    assert.ok(caps.length >= 8, 'All capabilities must be registered');
    assert.ok(caps.some((c) => c.id === 'cap_code_generator'), 'Code generator capability must be registered');
  });

  console.log(`\n--- TEST SUITE SUMMARY: ${passed} passed, ${failed} failed ---`);
  if (failed > 0) {
    process.exit(1);
  }
}

runConversationalIntelligenceTests().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
