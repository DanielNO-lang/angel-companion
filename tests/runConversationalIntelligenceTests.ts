import assert from 'node:assert/strict';
import { conversationEngine } from '../src/services/conversationEngine';
import { conversationalIntelligence } from '../src/services/conversationalIntelligence';
import { extractIntelligentTitle, DEFAULT_GEMINI_MODEL } from '../src/services/geminiModelService';
import { capabilityRegistry } from '../src/services/capabilityRegistry';
import { handleChatRequest, handleModelStatusRequest, resetBackendCachesForTesting } from '../server/geminiBackend';

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

  // 1. Honest unauthenticated block in ConversationEngine
  await test('Scenario 1: ConversationEngine refuses unauthenticated generation cleanly without fake prose', async () => {
    conversationEngine.setAccessToken(null, null);
    const thread = conversationEngine.createThread('general', undefined, 'Test Unauth');
    await conversationEngine.addMessage(thread.id, 'Hi', 'user');
    const reply = await conversationEngine.generateAssistantResponse(thread.id);

    assert.equal(reply.status, 'failed');
    assert.ok(reply.content.includes('Sign in'), 'Should require sign-in transparently');
    conversationEngine.deleteThread(thread.id);
  });

  // 2. System instruction construction adapts cleanly for general, studio, and Think mode
  await test('Scenario 2: ConversationalIntelligence builds environment-aware & Think instructions', () => {
    const generalInst = conversationalIntelligence.buildSystemInstruction({ scope: 'general' });
    assert.ok(generalInst.includes('Angel'));
    assert.ok(!generalInst.includes('Think Mode is active'));

    const studioThinkInst = conversationalIntelligence.buildSystemInstruction({
      scope: 'studio',
      studioId: 'development-studio',
      mode: 'Think',
    });
    assert.ok(studioThinkInst.includes('development-studio'));
    assert.ok(studioThinkInst.includes('Think Mode is active'));
  });

  // 3. Verified backend chat path handles real conversation history & Think mode (via mocked provider)
  await test('Scenario 3: Authenticated /api/chat passes multi-turn history and Think config to Gemini', async () => {
    resetBackendCachesForTesting();
    let capturedParams: any = null;
    const res = await handleChatRequest(
      {
        method: 'POST',
        authorizationHeader: 'Bearer valid_tok',
        body: {
          mode: 'Think',
          messages: [
            { role: 'user', content: 'I want to build a photography portfolio site' },
            { role: 'assistant', content: 'Great — what layout style do you prefer?' },
            { role: 'user', content: 'Minimal grid with lightbox' },
          ],
        },
      },
      {
        env: {
          SUPABASE_URL: 'https://proj.supabase.co',
          SUPABASE_PUBLISHABLE_KEY: 'pub_key',
          GEMINI_API_KEY: 'server_secret',
        },
        fetchImpl: async (url) => {
          if (String(url).includes('/auth/v1/user')) {
            return new Response(JSON.stringify({ id: 'user_1', email: 'u@test.com' }), { status: 200 });
          }
          return new Response(JSON.stringify([{ allowed: true, reset_at: new Date(Date.now() + 60000).toISOString() }]), { status: 200 });
        },
        createGeminiClient: () => ({
          models: {
            generateContent: async (params) => {
              capturedParams = params;
              return { text: 'A minimal masonry or uniform 3-column CSS Grid works cleanly with a keyboard-accessible lightbox.' };
            },
          },
        }),
      }
    );

    assert.equal(res.statusCode, 200);
    assert.equal(res.body.success, true);
    assert.equal(res.body.modelUsed, DEFAULT_GEMINI_MODEL);
    assert.equal(res.body.appliedMode, 'Think');
    assert.equal(res.body.thinkingLevel, 'HIGH');
    assert.ok(Array.isArray(capturedParams?.contents) && capturedParams.contents.length === 3);
  });

  // 4. Model status endpoint reports credentials_missing honestly without GEMINI_API_KEY
  await test('Scenario 4: Model status reports credentials_missing when server key is absent', async () => {
    resetBackendCachesForTesting();
    const res = await handleModelStatusRequest(
      { method: 'GET', forceRefresh: true },
      { env: {} }
    );
    assert.equal(res.statusCode, 200);
    assert.equal(res.body.state, 'credentials_missing');
    assert.equal(res.body.connected, false);
    assert.equal(res.body.model, DEFAULT_GEMINI_MODEL);
  });

  // 5. Intelligent title generation is concise (2-4 words) and never truncated with "..."
  await test('Scenario 5: Conversation titles are concise and never truncated with ellipsis', async () => {
    const thread = conversationEngine.createThread('general', undefined, 'General Conversation');
    await conversationEngine.addMessage(thread.id, 'I want to build a website for my photography portfolio', 'user');

    assert.ok(!thread.title.includes('...'));
    assert.ok(thread.title.includes('Photography'));

    const greetingTitle = extractIntelligentTitle('Hi');
    assert.equal(greetingTitle, 'General Conversation');
    conversationEngine.deleteThread(thread.id);
  });

  // 6. Custom user-renamed title preservation
  await test('Scenario 6: Custom user-renamed title is never overwritten', async () => {
    const thread = conversationEngine.createThread('general', undefined, 'My Custom Project Title');
    conversationEngine.renameThread(thread.id, 'My Custom Project Title');
    assert.equal(thread.isCustomTitle, true);

    await conversationEngine.addMessage(thread.id, 'What is the capital of France?', 'user');
    assert.equal(thread.title, 'My Custom Project Title');
    conversationEngine.deleteThread(thread.id);
  });

  // 7. General & Studio context isolation + capability registry integrity
  await test('Scenario 7: General and Studio threads maintain strict isolation and capability registry intact', () => {
    const genThread = conversationEngine.getActiveThread('general');
    const studioThread = conversationEngine.getActiveThread('studio', 'research-studio');
    assert.notEqual(genThread.id, studioThread.id);
    assert.equal(genThread.scope, 'general');
    assert.equal(studioThread.scope, 'studio');
    assert.equal(studioThread.studioId, 'research-studio');

    const caps = capabilityRegistry.getAllCapabilities();
    assert.ok(caps.length >= 8);
    assert.ok(caps.some((c) => c.id === 'cap_code_generator'));
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
