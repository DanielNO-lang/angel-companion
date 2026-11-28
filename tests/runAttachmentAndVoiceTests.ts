import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import JSZip from 'jszip';

import { VoiceEngine } from '../src/services/voiceEngine';
import { appendDictationText } from '../src/utils/dictationFormatter';
import { UniversalComposerService } from '../src/services/universalComposerService';
import { UniversalAttachmentService, universalAttachmentService } from '../src/services/universalAttachmentService';
import { conversationEngine } from '../src/services/conversationEngine';
import { fileProcessingEngine, MAX_FILE_SIZE_BYTES } from '../src/services/fileProcessingEngine';
import { fileStorageService } from '../src/services/fileStorageService';
import { companionData } from '../src/services/companionData';
import { libraryService } from '../src/services/libraryService';
import { geminiModelService } from '../src/services/geminiModelService';
import { ComposerContext } from '../src/types/composer';
import {
  DEFAULT_GEMINI_MODEL,
  handleChatRequest,
  resetBackendCachesForTesting,
  validateChatPayload,
  type BackendDependencies,
} from '../server/geminiBackend';

function createSupabaseTestFetch(verifiedUserId = 'user_alpha_111'): {
  fetchFn: typeof fetch;
  uploadedPaths: string[];
  deletedPaths: string[];
  storedObjects: Map<string, { bytes: Uint8Array; contentType: string }>;
} {
  const uploadedPaths: string[] = [];
  const deletedPaths: string[] = [];
  const storedObjects = new Map<string, { bytes: Uint8Array; contentType: string }>();

  const fetchFn = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : input.toString();
    const method = (init?.method || 'GET').toUpperCase();

    if (url.includes('/auth/v1/user')) {
      const authHeader = (init?.headers as Record<string, string>)?.authorization || '';
      const uid = authHeader.includes('user_beta_token') ? 'user_beta_222' : verifiedUserId;
      return new Response(JSON.stringify({ id: uid, email: `${uid}@example.com` }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    }

    if (url.includes('/rest/v1/rpc/consume_companion_rate_limit')) {
      return new Response(
        JSON.stringify([{ allowed: true, remaining: 29, reset_at: new Date(Date.now() + 60000).toISOString() }]),
        { status: 200, headers: { 'content-type': 'application/json' } }
      );
    }

    if (url.includes('token=short_lived_120s')) {
      // Handle signed download URL GET
      const pathMatch = url.match(/companion-private\/([^?]+)/);
      const objectPath = pathMatch ? decodeURIComponent(pathMatch[1]) : '';
      const stored = storedObjects.get(objectPath);
      if (!stored) {
        return new Response('Not found', { status: 404 });
      }
      return new Response(Buffer.from(stored.bytes), {
        status: 200,
        headers: { 'content-type': stored.contentType },
      });
    }

    if (url.includes('/storage/v1/object/sign/companion-private/')) {
      const objectPath = decodeURIComponent(
        url.split('/storage/v1/object/sign/companion-private/')[1].split('?')[0]
      );
      return new Response(
        JSON.stringify({ signedURL: `/storage/v1/object/sign/companion-private/${objectPath}?token=short_lived_120s` }),
        { status: 200, headers: { 'content-type': 'application/json' } }
      );
    }

    if (url.includes('/storage/v1/object/companion-private/') && method === 'POST') {
      const objectPath = decodeURIComponent(
        url.split('/storage/v1/object/companion-private/')[1].split('?')[0]
      );
      uploadedPaths.push(objectPath);
      const raw = init?.body;
      let bytes = new Uint8Array(0);
      if (raw instanceof Blob) {
        bytes = new Uint8Array(await raw.arrayBuffer());
      } else if (raw instanceof ArrayBuffer) {
        bytes = new Uint8Array(raw);
      } else if (typeof raw === 'string') {
        bytes = new TextEncoder().encode(raw);
      }
      storedObjects.set(objectPath, {
        bytes,
        contentType: (init?.headers as Record<string, string>)?.['content-type'] || 'application/octet-stream',
      });
      return new Response(JSON.stringify({ Key: `companion-private/${objectPath}` }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    }

    if (url.includes('/storage/v1/object/companion-private') && method === 'DELETE') {
      const parsed = typeof init?.body === 'string' ? JSON.parse(init.body) : {};
      const prefixes = Array.isArray(parsed?.prefixes) ? parsed.prefixes : [];
      for (const p of prefixes) {
        if (typeof p === 'string') {
          deletedPaths.push(p);
          storedObjects.delete(p);
        }
      }
      return new Response(JSON.stringify({ message: 'Deleted' }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({}), { status: 200 });
  }) as typeof fetch;

  return { fetchFn, uploadedPaths, deletedPaths, storedObjects };
}

test('Dictation formatting converts spoken punctuation and paragraph commands into editable text', () => {
  assert.equal(
    appendDictationText('', 'hello full stop new paragraph bullet point first item comma second item'),
    'Hello.\\n\\n• First item, second item'
  );
  assert.equal(
    appendDictationText('Good morning', 'new line next paragraph numbered list item one comma item two'),
    'Good morning\\n\\n1. Item one, item two'
  );
  assert.equal(appendDictationText('Can you help', 'question mark'), 'Can you help?');
  assert.equal(
    appendDictationText('He said', 'open quote hello close quote full stop'),
    'He said “Hello”.'
  );
});

test('VoiceEngine supports dynamic SpeechRecognition, transcript updates, stop, and permission error handling', () => {
  const originalWindow = (globalThis as any).window;
  const events: Array<{ type: string; value?: unknown }> = [];
  let createdCount = 0;

  class MockSpeechRecognition {
    continuous = false;
    interimResults = false;
    lang = '';
    onresult: ((event: any) => void) | null = null;
    onerror: ((event: any) => void) | null = null;
    onend: (() => void) | null = null;

    constructor() {
      createdCount += 1;
    }

    start() {
      events.push({ type: 'start', value: createdCount });
      setTimeout(() => {
        if (this.onresult) {
          this.onresult({
            resultIndex: 0,
            results: [
              Object.assign([{ transcript: 'Summarize the attached' }], { isFinal: true }),
              Object.assign([{ transcript: 'quarterly report' }], { isFinal: false }),
            ],
          });
        }
      }, 0);
    }

    stop() {
      events.push({ type: 'stop' });
      if (this.onend) this.onend();
    }
  }

  (globalThis as any).window = { SpeechRecognition: MockSpeechRecognition };

  try {
    const engine = VoiceEngine.getInstance();
    assert.equal(engine.isRecognitionSupported(), true);

    const transcripts: string[] = [];
    const errors: string[] = [];
    let endedCount = 0;

    const started = engine.startListening(
      {
        onTranscript: (t) => transcripts.push(t),
        onError: (err) => errors.push(err),
        onEnd: () => {
          endedCount += 1;
        },
      },
      'Hello Angel'
    );
    assert.equal(started, true);
    assert.equal(engine.getIsListening(), true);

    // Simulate recognition result synchronously for assertion clarity
    const activeRec = (engine as any).recognition;
    activeRec.onresult({
      resultIndex: 0,
      results: [
        Object.assign([{ transcript: 'check quarterly' }], { isFinal: true }),
        Object.assign([{ transcript: 'revenue' }], { isFinal: false }),
      ],
    });

    assert.equal(transcripts.at(-1), 'Hello Angel check quarterly revenue');

    // Simulate permission error
    activeRec.onerror({ error: 'not-allowed' });
    assert.equal(errors.length, 1);
    assert.match(errors[0], /Microphone access was denied/i);
    assert.equal(engine.getIsListening(), false);

    // Restart should dynamically instantiate a fresh recognition object cleanly
    const restarted = engine.startListening({
      onTranscript: () => {},
      onError: () => {},
      onEnd: () => {
        endedCount += 1;
      },
    });
    assert.equal(restarted, true);
    assert.ok(createdCount >= 2);

    engine.stopListening();
    assert.equal(engine.getIsListening(), false);
    assert.ok(endedCount >= 1);
  } finally {
    VoiceEngine.getInstance().stopListening();
    if (originalWindow === undefined) {
      delete (globalThis as any).window;
    } else {
      (globalThis as any).window = originalWindow;
    }
  }
});

test('UniversalComposerService prevents premature attachment commits, preserves drafts on 503 failure, retries without duplicating user turn, and rejects browser direct-SDK calls', async () => {
  const originalFetch = globalThis.fetch;
  const originalWindow = (globalThis as any).window;
  const composer = new UniversalComposerService();

  try {
    // 1. Browser direct-SDK safety guard (no direct GoogleGenAI calls in browser even if forceDirectSdk/apiKeyOverride passed)
    (globalThis as any).window = { location: { origin: 'https://angel-companion.netlify.app' } };
    let apiChatCalledInBrowser = false;
    const resFromBrowserGuard = await geminiModelService.generateChatResponse(
      [{ content: 'Earlier', sender: 'user', id: 'u1', timestamp: '' }],
      'Hi',
      'Standard Intelligent',
      undefined,
      'browser_jwt_token',
      {
        forceDirectSdk: true,
        apiKeyOverride: 'AIzaFakeBrowserShouldNotBeUsedDirectly',
        fetchImpl: (async (input: RequestInfo | URL) => {
          const u = typeof input === 'string' ? input : input.toString();
          if (u.includes('/api/chat')) apiChatCalledInBrowser = true;
          return new Response(
            JSON.stringify({ success: true, reply: 'Routed through /api/chat safely.', modelUsed: DEFAULT_GEMINI_MODEL }),
            { status: 200, headers: { 'content-type': 'application/json' } }
          );
        }) as typeof fetch,
      }
    );
    assert.equal(apiChatCalledInBrowser, true, 'Browser must route to /api/chat instead of direct SDK');
    assert.equal(resFromBrowserGuard.text, 'Routed through /api/chat safely.');

    // 2. Stage attachment, then trigger validation failure (unsafe URL) -> attachment must stay staged!
    conversationEngine.setAccessToken('test_retry_token', 'test_user_retry');
    const retryThread = conversationEngine.createThread('general', undefined, 'Retry Flow Test');
    const ctx: ComposerContext = { type: 'general', conversationId: retryThread.id };
    const staged = await universalAttachmentService.stageAttachment(ctx, {
      name: 'notes.txt',
      size: 32,
      content: 'Important safety notes',
    });
    assert.equal(staged.success, true);

    const unsafeRes = await composer.submit(ctx, 'Check javascript:alert(1)');
    assert.equal(unsafeRes.success, false);
    assert.equal(universalAttachmentService.getStagedAttachments(ctx).length, 1);

    // Clear staged so we test clean prompt draft + retry
    await universalAttachmentService.removeStagedAttachment(ctx, staged.attachment!.id);

    // 3. Submit fails with upstream 503 -> draft preserved, success === false, assistant failed
    let chatCalls = 0;
    globalThis.fetch = (async (input: RequestInfo | URL) => {
      const url = typeof input === 'string' ? input : input.toString();
      if (url.includes('/api/chat')) {
        chatCalls += 1;
        if (chatCalls === 1) {
          return new Response(
            JSON.stringify({ success: false, error: 'Upstream 503 temporarily busy', code: 'MODEL_UNAVAILABLE' }),
            { status: 503, headers: { 'content-type': 'application/json' } }
          );
        }
        return new Response(
          JSON.stringify({ success: true, reply: 'Recovered reply after retry.', modelUsed: DEFAULT_GEMINI_MODEL }),
          { status: 200, headers: { 'content-type': 'application/json' } }
        );
      }
      return new Response(JSON.stringify({}), { status: 200 });
    }) as typeof fetch;

    const draftText = 'Explain black hole entropy clearly';
    composer.setDraft(ctx, draftText);
    const firstAttempt = await composer.submit(ctx, draftText);
    assert.equal(firstAttempt.success, false);
    assert.equal(composer.getDraft(ctx), draftText, 'Draft must remain intact after failed generation');

    const threadAfterFail = conversationEngine.getThreads().find((t) => t.id === firstAttempt.threadId);
    assert.ok(threadAfterFail);
    assert.equal(threadAfterFail!.messages.filter((m) => m.sender === 'user').length, 1);
    assert.equal(threadAfterFail!.messages.at(-1)?.status, 'failed');

    // 4. Retry exact same text -> reuses existing failed turn WITHOUT duplicating user message, then clears draft
    const retryAttempt = await composer.submit(ctx, draftText);
    assert.equal(retryAttempt.success, true);
    assert.equal(composer.getDraft(ctx), '');
    const threadAfterRetry = conversationEngine.getThreads().find((t) => t.id === retryAttempt.threadId);
    assert.ok(threadAfterRetry);
    assert.equal(threadAfterRetry!.messages.filter((m) => m.sender === 'user').length, 1);
    assert.equal(threadAfterRetry!.messages.at(-1)?.status, 'completed');
    assert.equal(threadAfterRetry!.messages.at(-1)?.content, 'Recovered reply after retry.');
  } finally {
    globalThis.fetch = originalFetch;
    conversationEngine.setAccessToken(null);
    if (originalWindow === undefined) {
      delete (globalThis as any).window;
    } else {
      (globalThis as any).window = originalWindow;
    }
  }
});

test('fileProcessingEngine enforces 20MB limit, extracts XLSX & PPTX via JSZip, and reports multimodal vs unsupported truthfully', async () => {
  assert.equal(MAX_FILE_SIZE_BYTES, 20 * 1024 * 1024);

  const tooBigValidation = fileProcessingEngine.validateFile('large.pdf', 21 * 1024 * 1024);
  assert.equal(tooBigValidation.valid, false);
  assert.match(tooBigValidation.error || '', /20MB/);

  const ps1Validation = fileProcessingEngine.validateFile('deploy.ps1', 128);
  assert.equal(ps1Validation.valid, false);

  // Build real XLSX zip in memory
  const xlsxZip = new JSZip();
  xlsxZip.file(
    'xl/sharedStrings.xml',
    '<sst><si><t>Quarter</t></si><si><t>Revenue</t></si><si><t>Q4</t></si></sst>'
  );
  xlsxZip.file(
    'xl/worksheets/sheet1.xml',
    '<worksheet><sheetData><row><c t="s"><v>0</v></c><c t="s"><v>1</v></c></row><row><c t="s"><v>2</v></c><c><v>125000</v></c></row></sheetData></worksheet>'
  );
  const xlsxBuf = await xlsxZip.generateAsync({ type: 'arraybuffer' });
  const xlsxResult = await fileProcessingEngine.processFile('financials.xlsx', xlsxBuf);
  assert.equal(xlsxResult.status, 'processed');
  assert.equal(xlsxResult.analysisMode, 'extracted_text');
  assert.match(xlsxResult.extractedText || '', /Quarter \| Revenue/);
  assert.match(xlsxResult.extractedText || '', /Q4 \| 125000/);

  // Build real PPTX zip in memory
  const pptxZip = new JSZip();
  pptxZip.file('ppt/slides/slide1.xml', '<p:sld><a:t>Mission Brief</a:t><a:t>Orbital Telemetry</a:t></p:sld>');
  pptxZip.file('ppt/slides/slide2.xml', '<p:sld><a:t>Launch Confirmed</a:t></p:sld>');
  const pptxBuf = await pptxZip.generateAsync({ type: 'arraybuffer' });
  const pptxResult = await fileProcessingEngine.processFile('deck.pptx', pptxBuf);
  assert.equal(pptxResult.status, 'processed');
  assert.equal(pptxResult.analysisMode, 'extracted_text');
  assert.match(pptxResult.extractedText || '', /Slide 1: Mission Brief Orbital Telemetry/);
  assert.match(pptxResult.extractedText || '', /Slide 2: Launch Confirmed/);

  // PNG & Unsupported format
  const pngResult = await fileProcessingEngine.processFile('chart.png', new Uint8Array([137, 80, 78, 71]).buffer);
  assert.equal(pngResult.status, 'ready');
  assert.equal(pngResult.analysisMode, 'multimodal_inline');

  const xlsResult = await fileProcessingEngine.processFile('old_sheet.xls', 'legacy');
  assert.equal(xlsResult.status, 'ready');
  assert.equal(xlsResult.analysisMode, 'unsupported');
});

test('server/geminiBackend forwards untrusted extractedText and multimodal inlineData parts to Gemini while enforcing attachment limits, owner checks, and zero secret/base64 logging', async () => {
  resetBackendCachesForTesting();
  let capturedGenerateParams: Record<string, unknown> | null = null;
  const capturedLogs: string[] = [];
  const origConsoleInfo = console.info;
  console.info = (...args: unknown[]) => {
    capturedLogs.push(args.map((a) => String(a)).join(' '));
  };

  try {
    const pngBase64 = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]).toString('base64');
    const deps: BackendDependencies = {
      env: {
        GEMINI_API_KEY: 'test-key-secret',
        SUPABASE_URL: 'https://example.supabase.co',
        SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_test',
      },
      fetchImpl: createSupabaseTestFetch('user_alpha_111').fetchFn,
      sleep: async () => {},
      createGeminiClient: () => ({
        models: {
          generateContent: async (params: Record<string, unknown>) => {
            capturedGenerateParams = params;
            return { text: 'I analyzed the PNG diagram and CSV revenue metrics.' };
          },
        },
      }),
    };

    const validRes = await handleChatRequest(
      {
        method: 'POST',
        authorizationHeader: 'Bearer user_alpha_token',
        body: {
          messages: [{ role: 'user', content: 'Analyze these two files.' }],
          attachments: [
            {
              id: 'att_csv',
              name: 'metrics.csv',
              mimeType: 'text/csv',
              sizeBytes: 34,
              storagePath: 'user_alpha_111/conv_1/att_csv/metrics.csv',
              extractedText: 'quarter,revenue\nQ4,125000',
            },
            {
              id: 'att_png',
              name: 'diagram.png',
              mimeType: 'image/png',
              sizeBytes: 8,
              storagePath: 'user_alpha_111/conv_1/att_png/diagram.png',
              inlineDataBase64: pngBase64,
            },
          ],
        },
      },
      deps
    );

    assert.equal(validRes.statusCode, 200);
    assert.equal(validRes.body.success, true);

    const contents = (capturedGenerateParams as any)?.contents as Array<{
      role: string;
      parts: Array<Record<string, any>>;
    }>;
    assert.ok(Array.isArray(contents) && contents.length === 1);
    const parts = contents[0].parts;
    assert.equal(parts[0].text, 'Analyze these two files.');
    assert.match(parts[1].text, /\[ATTACHED_FILE_DATA filename="metrics\.csv".*untrusted_reference="true"\]/);
    assert.match(parts[1].text, /quarter,revenue/);
    assert.deepEqual(parts[2], {
      inlineData: {
        mimeType: 'image/png',
        data: pngBase64,
      },
    });

    // Verify no attachment base64 or extracted text leaked into logs
    const joinedLogs = capturedLogs.join('\n');
    assert.equal(joinedLogs.includes(pngBase64), false);
    assert.equal(joinedLogs.includes('quarter,revenue'), false);

    // Reject cross-user storagePath (403)
    const crossUserRes = validateChatPayload(
      {
        messages: [{ role: 'user', content: 'Read stolen path' }],
        attachments: [
          {
            name: 'secret.txt',
            mimeType: 'text/plain',
            sizeBytes: 12,
            storagePath: 'user_victim_999/conv_x/att_x/secret.txt',
          },
        ],
      },
      'user_alpha_111'
    );
    assert.equal(crossUserRes.valid, false);
    assert.equal(crossUserRes.statusCode, 403);

    // Reject traversal storagePath (403)
    const traversalRes = validateChatPayload(
      {
        messages: [{ role: 'user', content: 'Traverse' }],
        attachments: [
          {
            name: 'secret.txt',
            mimeType: 'text/plain',
            sizeBytes: 12,
            storagePath: 'user_alpha_111/../user_victim/secret.txt',
          },
        ],
      },
      'user_alpha_111'
    );
    assert.equal(traversalRes.valid, false);
    assert.equal(traversalRes.statusCode, 403);

    // Reject MIME mismatch, executable, malformed base64, and >5 attachments
    assert.equal(
      validateChatPayload({
        messages: [{ role: 'user', content: 'Hi' }],
        attachments: [{ name: 'photo.png', mimeType: 'application/pdf', sizeBytes: 100 }],
      }).valid,
      false
    );
    assert.equal(
      validateChatPayload({
        messages: [{ role: 'user', content: 'Hi' }],
        attachments: [{ name: 'script.ps1', mimeType: 'text/plain', sizeBytes: 100 }],
      }).valid,
      false
    );
    assert.equal(
      validateChatPayload({
        messages: [{ role: 'user', content: 'Hi' }],
        attachments: [{ name: 'img.png', mimeType: 'image/png', sizeBytes: 10, inlineDataBase64: 'not_base64!!!' }],
      }).valid,
      false
    );
    assert.equal(
      validateChatPayload({
        messages: [{ role: 'user', content: 'Hi' }],
        attachments: Array.from({ length: 6 }, (_, i) => ({
          name: `file${i}.txt`,
          mimeType: 'text/plain',
          sizeBytes: 5,
        })),
      }).valid,
      false
    );
  } finally {
    console.info = origConsoleInfo;
  }
});

test('universalAttachmentService stores files under <userId>/<convId>/<attId>/<name>, retrieves cross-device bytes via signed URL, isolates users, and deletes cleanly', async () => {
  const originalFetch = globalThis.fetch;
  const origEnvUrl = process.env.VITE_SUPABASE_URL;
  const origEnvKey = process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
  process.env.VITE_SUPABASE_URL = 'https://example.supabase.co';
  process.env.VITE_SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_test';

  const mock = createSupabaseTestFetch('user_alpha_111');
  globalThis.fetch = mock.fetchFn;

  try {
    const svc = new UniversalAttachmentService();
    svc.setAuthContext('token_alpha', 'user_alpha_111');

    const ctx: ComposerContext = { type: 'general', conversationId: 'conv_cloud_att' };
    const pngBytes = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]).buffer;
    const staged = await svc.stageAttachment(ctx, {
      name: 'blueprint.png',
      size: 8,
      content: pngBytes,
    });

    assert.equal(staged.success, true);
    assert.equal(staged.attachment?.cloudStatus, 'synced');
    assert.match(staged.attachment?.storagePath || '', /^user_alpha_111\/conv_cloud_att\/rec_/);
    assert.equal(mock.uploadedPaths.length, 1);

    // Ensure no raw base64/binary fields were stored on attachment metadata
    const serialized = JSON.stringify(staged.attachment);
    assert.equal(serialized.includes('inlineDataBase64'), false);
    assert.equal(serialized.includes('rawBytes'), false);

    // Simulate cross-device fetch: delete local cached bytes while keeping metadata, then buildChatPayloads
    await fileStorageService.deleteFile(staged.attachment!.storageRef);
    const payloads = await svc.buildChatPayloads([staged.attachment!]);
    assert.equal(payloads.length, 1);
    assert.equal(payloads[0].inlineDataBase64, Buffer.from(pngBytes).toString('base64'));

    // Signed URL download check + user isolation check
    const downloadInfo = await svc.getAttachmentDownloadUrl(staged.attachment!);
    assert.match(downloadInfo.url || '', /token=short_lived_120s/);
    await assert.rejects(
      () => companionData.getPrivateSignedUrl('token_beta', staged.attachment!.storagePath!, 120, 'user_beta_222'),
      /Unauthorized private storage path access blocked/
    );

    // Deletion deletes private storage object too
    const deleted = await svc.deleteAttachment(staged.attachment!.id);
    assert.equal(deleted, true);
    assert.equal(mock.deletedPaths.length, 1);
  } finally {
    globalThis.fetch = originalFetch;
    if (origEnvUrl === undefined) delete process.env.VITE_SUPABASE_URL;
    else process.env.VITE_SUPABASE_URL = origEnvUrl;
    if (origEnvKey === undefined) delete process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
    else process.env.VITE_SUPABASE_PUBLISHABLE_KEY = origEnvKey;
  }
});

test('libraryService reports sync failures to companionData cloudSyncHealth and lockfile/CI parity checks pass', async () => {
  const originalFetch = globalThis.fetch;
  const origEnvUrl = process.env.VITE_SUPABASE_URL;
  const origEnvKey = process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
  process.env.VITE_SUPABASE_URL = 'https://example.supabase.co';
  process.env.VITE_SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_test';

  globalThis.fetch = (async () => {
    return new Response(
      JSON.stringify({ code: 'PGRST205', message: 'Could not find the table public.companion_library_items' }),
      { status: 404, headers: { 'content-type': 'application/json' } }
    );
  }) as typeof fetch;

  try {
    libraryService.setAuthContext('token_lib_err', 'user_lib_err');
    await new Promise((r) => setTimeout(r, 25));
    const health = companionData.getCloudSyncHealth();
    assert.equal(health.status, 'missing_tables');
    assert.ok(health.missingTables.includes('companion_library_items'));
  } finally {
    libraryService.setAuthContext(null);
    globalThis.fetch = originalFetch;
    if (origEnvUrl === undefined) delete process.env.VITE_SUPABASE_URL;
    else process.env.VITE_SUPABASE_URL = origEnvUrl;
    if (origEnvKey === undefined) delete process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
    else process.env.VITE_SUPABASE_PUBLISHABLE_KEY = origEnvKey;
  }

  // Verify lockfile & CI consistency
  const root = process.cwd();
  assert.equal(fs.existsSync(path.join(root, 'package-lock.json')), true, 'package-lock.json must exist');
  assert.equal(fs.existsSync(path.join(root, 'bun.lock')), false, 'stale bun.lock should be removed');

  const ciWorkflow = fs.readFileSync(path.join(root, '.github/workflows/production.yml'), 'utf8');
  assert.match(ciWorkflow, /npm ci/);
  assert.match(ciWorkflow, /esbuild netlify\/functions\/chat\.ts/);

  const deployDocs = fs.readFileSync(path.join(root, 'DEPLOYMENT.md'), 'utf8');
  assert.match(deployDocs, /\/auth\/preview-callback/);
});
