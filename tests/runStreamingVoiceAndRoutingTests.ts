import test from 'node:test';
import assert from 'node:assert/strict';
import { conversationEngine } from '../src/services/conversationEngine';
import { universalComposerService } from '../src/services/universalComposerService';
import { universalAttachmentService } from '../src/services/universalAttachmentService';
import { activityEngine } from '../src/services/activityEngine';
import { geminiModelService } from '../src/services/geminiModelService';
import { fileProcessingEngine } from '../src/services/fileProcessingEngine';
import { voiceConversationService } from '../src/services/voiceConversationService';
import { voiceEngine } from '../src/services/voiceEngine';

test('Home SimpleComposerBar context createNewThread creates a fresh thread instead of appending to prior thread', async () => {
  const originalFetch = globalThis.fetch;
  const originalWindow = (globalThis as any).window;
  (globalThis as any).window = { location: { origin: 'http://localhost:3000' } };

  globalThis.fetch = (async (input: RequestInfo | URL) => {
    const url = typeof input === 'string' ? input : input.toString();
    if (url.includes('/api/chat')) {
      return new Response(
        JSON.stringify({ success: true, reply: 'Fresh thread reply', actualModel: 'gemini-3.1-flash-lite' }),
        { status: 200, headers: { 'content-type': 'application/json' } }
      );
    }
    return new Response(JSON.stringify({ success: true, title: 'Fresh Thread' }), { status: 200 });
  }) as typeof fetch;

  try {
    conversationEngine.setAccessToken('tok_home', 'user_home_1');
    const first = await universalComposerService.submit(
      { type: 'general', createNewThread: true },
      'First prompt from Home'
    );
    const second = await universalComposerService.submit(
      { type: 'general', createNewThread: true },
      'Second prompt from Home'
    );

    assert.equal(first.success, true);
    assert.equal(second.success, true);
    assert.ok(first.threadId && second.threadId);
    assert.notEqual(first.threadId, second.threadId);

    const active = conversationEngine.getActiveThread('general');
    assert.equal(active.id, second.threadId);
    conversationEngine.deleteThread(first.threadId!);
    conversationEngine.deleteThread(second.threadId!);
  } finally {
    conversationEngine.setAccessToken(null, null);
    globalThis.fetch = originalFetch;
    if (originalWindow === undefined) delete (globalThis as any).window;
    else (globalThis as any).window = originalWindow;
  }
});

test('geminiModelService.generateChatStream parses SSE stage, incremental delta chunks, and final done telemetry', async () => {
  const originalFetch = globalThis.fetch;
  const originalWindow = (globalThis as any).window;
  (globalThis as any).window = { location: { origin: 'http://localhost:3000' } };

  const stages: string[] = [];
  const deltas: string[] = [];

  globalThis.fetch = (async () => {
    const encoder = new TextEncoder();
    const ssePayload = [
      'data: {"type":"stage","stage":"Researching","label":"Researching sources"}\n\n',
      'data: {"type":"delta","text":"Hello "}\n\n',
      'data: {"type":"delta","text":"stream!"}\n\n',
      'data: {"type":"done","success":true,"reply":"Hello stream!","actualModel":"gemini-3.8-flash","requestedModel":"gemini-3.8-flash","fallbackActivated":false,"thinkingLevel":"HIGH","appliedMode":"Deep Research"}\n\n',
    ].join('');

    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(encoder.encode(ssePayload));
        controller.close();
      },
    });

    return new Response(stream, {
      status: 200,
      headers: { 'content-type': 'text/event-stream' },
    });
  }) as typeof fetch;

  try {
    const result = await geminiModelService.generateChatStream(
      [],
      'Test stream',
      'Deep Research',
      undefined,
      'tok_stream',
      undefined,
      {
        onStage: (evt) => stages.push(evt.stage),
        onDelta: (delta) => deltas.push(delta),
      }
    );

    assert.equal(result.success, true);
    assert.equal(result.text, 'Hello stream!');
    assert.deepEqual(stages, ['Researching']);
    assert.deepEqual(deltas, ['Hello ', 'stream!']);
    assert.equal(result.actualModel, 'gemini-3.8-flash');
  } finally {
    globalThis.fetch = originalFetch;
    if (originalWindow === undefined) delete (globalThis as any).window;
    else (globalThis as any).window = originalWindow;
  }
});

test('activityEngine starts empty without fabricated demo records and notifies subscribers on live task creation', () => {
  const initial = activityEngine.getTasks();
  for (const legacyId of ['act_1', 'act_2', 'act_3', 'act_4', 'act_5']) {
    assert.equal(
      initial.some((t) => t.id === legacyId),
      false,
      `Hardcoded legacy demo task ${legacyId} must not exist`
    );
  }

  let notifiedCount = 0;
  const unsub = activityEngine.subscribe(() => {
    notifiedCount += 1;
  });
  const task = activityEngine.createTask('Real test activity', 'Research', 'user', undefined, 'running');
  unsub();

  assert.ok(notifiedCount >= 1);
  assert.equal(activityEngine.getTasks().find((t) => t.id === task.id)?.title, 'Real test activity');
  activityEngine.deleteTask(task.id);
});

test('universalAttachmentService.stageSnapshotDataUrl stages captured PNG, notifies subscribers, and audio/mpeg routes inline', async () => {
  const ctx = { type: 'general' as const, conversationId: 'snap_test_conv' };
  const tinyPngBase64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
  let subFired = 0;
  const unsub = universalAttachmentService.subscribe(() => {
    subFired += 1;
  });

  const snapResult = await universalAttachmentService.stageSnapshotDataUrl(
    ctx,
    `data:image/png;base64,${tinyPngBase64}`,
    'screen_capture'
  );
  unsub();

  assert.equal(snapResult.success, true);
  assert.ok(snapResult.attachment);
  assert.equal(snapResult.attachment?.mimeType, 'image/png');
  assert.ok(subFired >= 1);

  const payloads = await universalAttachmentService.buildChatPayloads([snapResult.attachment!]);
  assert.equal(payloads.length, 1);
  assert.equal(payloads[0].inlineDataBase64, tinyPngBase64);

  universalAttachmentService.clearStagedAttachments(ctx);

  assert.equal(fileProcessingEngine.isMultimodalInlineMime('audio/mpeg'), true);
  assert.equal(fileProcessingEngine.isMultimodalInlineMime('audio/ogg'), true);
});

test('voiceConversationService reports unsupported error gracefully when recognition unavailable and ends cleanly', () => {
  const origIsSupported = voiceEngine.isRecognitionSupported.bind(voiceEngine);
  (voiceEngine as any).isRecognitionSupported = () => false;

  const orbStates: string[] = [];
  try {
    const started = voiceConversationService.startSession({
      context: { type: 'general', conversationId: 'voice_sess_1' },
      onOrbStateChange: (s) => orbStates.push(s),
    });
    assert.equal(started, false);
    const snap = voiceConversationService.getSnapshot();
    assert.equal(snap.active, true);
    assert.equal(snap.phase, 'error');
    assert.ok(snap.error);

    voiceConversationService.endSession();
    const endedSnap = voiceConversationService.getSnapshot();
    assert.equal(endedSnap.active, false);
    assert.equal(endedSnap.phase, 'idle');
    assert.ok(orbStates.includes('idle'));
  } finally {
    (voiceEngine as any).isRecognitionSupported = origIsSupported;
  }
});
