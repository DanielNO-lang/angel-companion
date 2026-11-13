import JSZip from 'jszip';
import { universalAttachmentService, UniversalAttachmentService } from '../src/services/universalAttachmentService';
import { fileProcessingEngine } from '../src/services/fileProcessingEngine';
import { fileStorageService } from '../src/services/fileStorageService';
import { linkPreviewService } from '../src/services/linkPreviewService';
import { universalComposerService } from '../src/services/universalComposerService';
import { conversationEngine } from '../src/services/conversationEngine';
import { workspaceEngine } from '../src/services/workspaceEngine';
import { agentEngine } from '../src/services/agentEngine';
import { APPROVED_EIGHT_STUDIOS } from '../src/services/studiosEngine';
import { ComposerContext } from '../src/types/composer';

function assert(condition: boolean, testNum: number, name: string, detail?: string) {
  if (condition) {
    console.log(`[PASS] Phase 5B Test ${testNum}: ${name}`);
  } else {
    console.error(`[FAIL] Phase 5B Test ${testNum}: ${name} - ${detail || 'Assertion failed'}`);
    throw new Error(`Phase 5B Test ${testNum} Failed: ${name}`);
  }
}

async function runPhase5BAttachmentTests() {
  console.log('=== STARTING PHASE 5B: UNIVERSAL ATTACHMENT, FILE HANDLING & LINK PREVIEW TESTS (28 TESTS) ===');

  const testCtx: ComposerContext = { type: 'general', conversationId: 'conv_5b_test_main' };

  // 1. Single-file selection
  const stageRes1 = await universalAttachmentService.stageAttachment(testCtx, {
    name: 'architecture_notes.txt',
    size: 45,
    content: 'Angel AI universal attachment architecture notes',
  });
  assert(
    stageRes1.success === true &&
    Boolean(stageRes1.attachment?.id) &&
    stageRes1.attachment?.name === 'architecture_notes.txt' &&
    stageRes1.attachment?.category === 'document' &&
    stageRes1.attachment?.status === 'processed',
    1,
    'Single-file selection'
  );

  // 2. Multiple-file selection
  const stageRes2 = await universalAttachmentService.stageAttachment(testCtx, {
    name: 'metrics.csv',
    size: 60,
    content: 'metric,value\nlatency,12ms\naccuracy,99.4%',
  });
  const stagedList = universalAttachmentService.getStagedAttachments(testCtx);
  assert(
    stageRes2.success === true &&
    stagedList.length === 2 &&
    stagedList.some((a) => a.name === 'metrics.csv'),
    2,
    'Multiple-file selection'
  );

  // 3. Unsupported file rejection
  const exeRes = await universalAttachmentService.stageAttachment(testCtx, {
    name: 'trojan_payload.exe',
    size: 1024,
    content: 'MZ90...',
  });
  const shRes = await universalAttachmentService.stageAttachment(testCtx, {
    name: 'bad_script.sh',
    size: 200,
    content: '#!/bin/bash\nrm -rf /',
  });
  assert(
    exeRes.success === false &&
    exeRes.error?.includes('rejected for security') === true &&
    shRes.success === false,
    3,
    'Unsupported file rejection'
  );

  // 4. Oversized file rejection
  const bigRes = await universalAttachmentService.stageAttachment(testCtx, {
    name: 'huge_archive.zip',
    size: 30 * 1024 * 1024, // 30MB (>25MB limit)
    content: 'large_data',
  });
  assert(
    bigRes.success === false &&
    bigRes.error?.includes('exceeds maximum allowed limit') === true,
    4,
    'Oversized file rejection'
  );

  // 5. Attachment removal
  const attIdToRemove = stageRes2.attachment!.id;
  const removed = await universalAttachmentService.removeStagedAttachment(testCtx, attIdToRemove);
  const remainingStaged = universalAttachmentService.getStagedAttachments(testCtx);
  assert(
    removed === true &&
    remainingStaged.length === 1 &&
    remainingStaged[0].id === stageRes1.attachment!.id,
    5,
    'Attachment removal'
  );

  // 6. Attachment persistence after refresh
  universalAttachmentService.clearStagedAttachments(testCtx);
  const persistRes = await universalAttachmentService.stageAttachment(testCtx, {
    name: 'persistent_document.md',
    size: 50,
    content: '# Important Persistent Data',
  });
  // Simulate page reload by creating a fresh service instance reading from storage
  const reloadedAttachmentService = new UniversalAttachmentService();
  const loadedAtt = reloadedAttachmentService.getAttachment(persistRes.attachment!.id);
  assert(
    Boolean(loadedAtt) &&
    loadedAtt?.name === 'persistent_document.md' &&
    loadedAtt?.size === 50,
    6,
    'Attachment persistence after refresh'
  );

  // 7. Workspace attachment compatibility
  const wsCtx: ComposerContext = { type: 'workspace', projectId: 'proj_default' };
  await universalAttachmentService.stageAttachment(wsCtx, {
    name: 'Service_Blueprint.md',
    size: 120,
    content: '# Blueprint Specification Content',
  });
  const wsSubmitRes = await universalComposerService.submit(wsCtx, 'Adding service blueprint file');
  const projFiles = workspaceEngine.getProjects().find((p) => p.id === 'proj_default')?.files || [];
  const addedWsFile = projFiles.find((f) => f.name === 'Service_Blueprint.md');
  assert(
    wsSubmitRes.success === true &&
    Boolean(addedWsFile) &&
    addedWsFile?.content.includes('Blueprint Specification Content') === true,
    7,
    'Workspace attachment compatibility'
  );

  // 8. General Conversation attachments
  const genCtx: ComposerContext = { type: 'general', conversationId: 'conv_gen_att_test' };
  await universalAttachmentService.stageAttachment(genCtx, {
    name: 'General_Inquiry.txt',
    size: 40,
    content: 'General inquiry question text',
  });
  const genSubmitRes = await universalComposerService.submit(genCtx, 'Please inspect this inquiry file');
  const genThread = conversationEngine.getActiveThread('general');
  const lastGenUserMsg = [...genThread.messages].reverse().find((m) => m.sender === 'user');
  assert(
    genSubmitRes.success === true &&
    lastGenUserMsg?.attachments?.includes('General_Inquiry.txt') === true &&
    lastGenUserMsg?.attachmentDetails?.[0]?.name === 'General_Inquiry.txt' &&
    genThread.scope === 'general',
    8,
    'General Conversation attachments'
  );

  // 9. All eight Studio attachment contexts
  let allStudiosPassed = true;
  for (const studio of APPROVED_EIGHT_STUDIOS) {
    const sCtx: ComposerContext = { type: 'studio', studioId: studio.id };
    await universalAttachmentService.stageAttachment(sCtx, {
      name: `${studio.id}_dataset.csv`,
      size: 55,
      content: 'col1,col2\nval1,val2',
    });
    const sRes = await universalComposerService.submit(sCtx, `Process data for ${studio.name}`);
    const sThread = conversationEngine.getActiveThread('studio', studio.id);
    const lastMsg = [...sThread.messages].reverse().find((m) => m.sender === 'user');
    if (!sRes.success || !lastMsg?.attachments?.includes(`${studio.id}_dataset.csv`)) {
      allStudiosPassed = false;
    }
  }
  assert(allStudiosPassed, 9, 'All eight Studio attachment contexts');

  // 10. Agent task attachments
  const agentCtx: ComposerContext = { type: 'agent_task', agentId: 'agent_code' };
  await universalAttachmentService.stageAttachment(agentCtx, {
    name: 'patch_spec.json',
    size: 45,
    content: '{"fix": "memory_leak", "version": 2}',
  });
  const agentRes = await universalComposerService.submit(agentCtx, 'Apply architectural patch');
  const codeAgent = agentEngine.getAgent('agent_code');
  assert(
    agentRes.success === true &&
    Boolean(codeAgent) &&
    agentRes.attachments?.some((a) => a.name === 'patch_spec.json') === true,
    10,
    'Agent task attachments'
  );

  // 11. Learning material attachments
  const learnCtx: ComposerContext = { type: 'learning', learningSubject: 'Quantum Mechanics' };
  await universalAttachmentService.stageAttachment(learnCtx, {
    name: 'Lecture1_Notes.txt',
    size: 65,
    content: 'Lecture notes on wave-particle duality and Heisenberg uncertainty principle',
  });
  const learnRes = await universalComposerService.submit(learnCtx, 'Summarize key points');
  const learnThread = conversationEngine.getThreads('studio').find((t) => t.title.includes('Quantum Mechanics'));
  const lastLearnUserMsg = learnThread ? [...learnThread.messages].reverse().find((m) => m.sender === 'user') : null;
  assert(
    learnRes.success === true &&
    Boolean(lastLearnUserMsg) &&
    lastLearnUserMsg?.attachments?.includes('Lecture1_Notes.txt') === true,
    11,
    'Learning material attachments'
  );

  // 12. TXT extraction
  const txtParsed = await fileProcessingEngine.processFile(
    'sample.txt',
    'Line one\nLine two\nLine three\nFinal line'
  );
  assert(
    txtParsed.status === 'processed' &&
    txtParsed.category === 'document' &&
    txtParsed.extractedText?.includes('Final line') === true &&
    txtParsed.metadata?.lineCount === 4,
    12,
    'TXT extraction'
  );

  // 13. CSV extraction
  const csvParsed = await fileProcessingEngine.processFile(
    'grades.csv',
    'Student,Math,Physics\nAlice,98,95\nBob,88,92\nCharlie,91,89'
  );
  assert(
    csvParsed.status === 'processed' &&
    csvParsed.category === 'spreadsheet' &&
    csvParsed.metadata?.rowCount === 3 &&
    csvParsed.metadata?.columnCount === 3 &&
    csvParsed.summary?.includes('3 rows, 3 columns') === true,
    13,
    'CSV extraction'
  );

  // 14. PDF extraction where supported
  const fakePdf = `%PDF-1.4\n1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n3 0 obj\n<< /Type /Page >>\nendobj\nstream\nBT\n(Quantum entanglement observed) Tj\nET\nendstream\n%%EOF`;
  const pdfParsed = await fileProcessingEngine.processFile('research.pdf', fakePdf);
  assert(
    pdfParsed.status === 'processed' &&
    pdfParsed.category === 'document' &&
    pdfParsed.extractedText?.includes('Quantum entanglement observed') === true &&
    pdfParsed.metadata?.pages === 1,
    14,
    'PDF extraction where supported'
  );

  // 15. DOCX extraction where supported
  const testDocxZip = new JSZip();
  testDocxZip.file(
    'word/document.xml',
    '<?xml version="1.0" encoding="UTF-8"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:t>Angel AI DOCX Extraction Success</w:t></w:r></w:p></w:body></w:document>'
  );
  const docxBuffer = await testDocxZip.generateAsync({ type: 'arraybuffer' });
  const docxParsed = await fileProcessingEngine.processFile('specification.docx', docxBuffer);
  assert(
    docxParsed.status === 'processed' &&
    docxParsed.category === 'document' &&
    docxParsed.extractedText?.includes('Angel AI DOCX Extraction Success') === true &&
    docxParsed.metadata?.wordCount === 5,
    15,
    'DOCX extraction where supported'
  );

  // 16. Unsupported document reporting
  const legacyDocParsed = await fileProcessingEngine.processFile('legacy.doc', 'binary_ole_content');
  assert(
    legacyDocParsed.status === 'ready' &&
    legacyDocParsed.category === 'document' &&
    legacyDocParsed.summary?.includes('Legacy Binary DOC format preserved safely') === true,
    16,
    'Unsupported document reporting'
  );

  // 17. URL detection
  const textWithSingleUrl = 'Check the reference at https://developer.mozilla.org/en-US/docs/Web for details.';
  const detectedSingle = linkPreviewService.detectUrls(textWithSingleUrl);
  assert(
    detectedSingle.validUrls.length === 1 &&
    detectedSingle.validUrls[0] === 'https://developer.mozilla.org/en-US/docs/Web',
    17,
    'URL detection'
  );

  // 18. Multiple URL detection
  const textWithMultipleUrls = 'Compare https://github.com/facebook/react and https://vitejs.dev/guide/ side by side.';
  const detectedMulti = linkPreviewService.detectUrls(textWithMultipleUrls);
  assert(
    detectedMulti.validUrls.length === 2 &&
    detectedMulti.validUrls.includes('https://github.com/facebook/react') &&
    detectedMulti.validUrls.includes('https://vitejs.dev/guide/'),
    18,
    'Multiple URL detection'
  );

  // 19. Unsafe URL rejection
  const unsafeText = 'Visit javascript:alert(document.cookie) or file:///etc/passwd immediately.';
  const detectedUnsafe = linkPreviewService.detectUrls(unsafeText);
  const unsafeCtx: ComposerContext = { type: 'general', conversationId: 'conv_unsafe_test' };
  const unsafeSubmitRes = await universalComposerService.submit(unsafeCtx, unsafeText);
  assert(
    detectedUnsafe.unsafeUrls.length >= 1 &&
    unsafeSubmitRes.success === false &&
    unsafeSubmitRes.error?.includes('Unsafe URL scheme detected') === true,
    19,
    'Unsafe URL rejection'
  );

  // 20. Link metadata retrieval
  const sampleHtml = `
    <!DOCTYPE html>
    <html>
      <head>
        <title>Angel AI - Unified Intelligence System</title>
        <meta property="og:title" content="Angel AI - Unified Intelligence System" />
        <meta property="og:description" content="Personal AI companion with 8 Studios and Three.js cosmic canvas." />
        <meta property="og:site_name" content="Angel AI Network" />
        <meta property="og:image" content="https://angel.ai/assets/preview.png" />
      </head>
      <body><h1>Angel AI</h1></body>
    </html>
  `;
  const metaParsed = linkPreviewService.parseHtmlMetadata(sampleHtml, 'https://angel.ai', 'angel.ai');
  assert(
    metaParsed.status === 'loaded' &&
    metaParsed.title === 'Angel AI - Unified Intelligence System' &&
    metaParsed.description?.includes('Personal AI companion') === true &&
    metaParsed.siteName === 'Angel AI Network' &&
    metaParsed.image === 'https://angel.ai/assets/preview.png',
    20,
    'Link metadata retrieval'
  );

  // 21. CORS failure fallback
  const corsFallback = await linkPreviewService.getPreview('https://restricted-private-intranet.corp/page');
  assert(
    corsFallback.status === 'fallback' &&
    corsFallback.domain === 'restricted-private-intranet.corp' &&
    Boolean(corsFallback.favicon) &&
    corsFallback.error?.includes('fallback') === true,
    21,
    'CORS failure fallback'
  );

  // 22. Missing preview image fallback
  const htmlNoImage = `
    <html>
      <head>
        <title>Text Only Portal</title>
        <meta name="description" content="A site with no og:image specified." />
      </head>
    </html>
  `;
  const parsedNoImage = linkPreviewService.parseHtmlMetadata(htmlNoImage, 'https://textonly.org', 'textonly.org');
  assert(
    parsedNoImage.status === 'loaded' &&
    parsedNoImage.title === 'Text Only Portal' &&
    parsedNoImage.image === undefined &&
    Boolean(parsedNoImage.favicon),
    22,
    'Missing preview image fallback'
  );

  // 23. Message history attachment restoration
  const restoredGenThread = conversationEngine.getActiveThread('general');
  const restoredMsg = restoredGenThread.messages.find((m) => m.attachments?.includes('General_Inquiry.txt'));
  assert(
    Boolean(restoredMsg) &&
    restoredMsg?.attachmentDetails?.[0]?.name === 'General_Inquiry.txt' &&
    restoredMsg?.attachmentDetails?.[0]?.status === 'processed',
    23,
    'Message history attachment restoration'
  );

  // 24. Deleted attachment handling
  const tempAtt = await universalAttachmentService.stageAttachment(testCtx, {
    name: 'to_be_deleted.txt',
    size: 25,
    content: 'Temporary deletion test',
  });
  const tempId = tempAtt.attachment!.id;
  const deletedOk = await universalAttachmentService.deleteAttachment(tempId);
  const lookUpAfterDelete = universalAttachmentService.getAttachment(tempId);
  assert(
    deletedOk === true &&
    lookUpAfterDelete === undefined,
    24,
    'Deleted attachment handling'
  );

  // 25. Storage quota error handling
  fileStorageService.setSimulatedQuotaLimit(100); // 100 bytes limit
  const quotaErrRes = await fileStorageService.saveFile('quota_test_key', 'A'.repeat(500));
  fileStorageService.setSimulatedQuotaLimit(50 * 1024 * 1024); // restore standard 50MB quota
  assert(
    quotaErrRes.success === false &&
    quotaErrRes.error?.includes('quota exceeded') === true,
    25,
    'Storage quota error handling'
  );

  // 26. Context isolation
  const isoCtx1: ComposerContext = { type: 'studio', studioId: 'research-studio' };
  const isoCtx2: ComposerContext = { type: 'studio', studioId: 'development-studio' };
  await universalAttachmentService.stageAttachment(isoCtx1, {
    name: 'research_isolated.txt',
    size: 30,
    content: 'Only for research studio',
  });
  await universalAttachmentService.stageAttachment(isoCtx2, {
    name: 'dev_isolated.txt',
    size: 30,
    content: 'Only for dev studio',
  });
  const researchAtts = universalAttachmentService.getAttachmentsForContext(isoCtx1);
  const devAtts = universalAttachmentService.getAttachmentsForContext(isoCtx2);
  assert(
    researchAtts.some((a) => a.name === 'research_isolated.txt') &&
    !researchAtts.some((a) => a.name === 'dev_isolated.txt') &&
    devAtts.some((a) => a.name === 'dev_isolated.txt') &&
    !devAtts.some((a) => a.name === 'research_isolated.txt'),
    26,
    'Context isolation'
  );

  // 27. Duplicate attachment prevention
  const dupCtx: ComposerContext = { type: 'general', conversationId: 'conv_dup_att' };
  const dup1 = await universalAttachmentService.stageAttachment(dupCtx, {
    name: 'unique_spec.pdf',
    size: 500,
    content: '%PDF-1.4 mock content',
  });
  const dup2 = await universalAttachmentService.stageAttachment(dupCtx, {
    name: 'unique_spec.pdf',
    size: 500,
    content: '%PDF-1.4 mock content',
  });
  assert(
    dup1.success === true &&
    dup2.success === false &&
    dup2.error?.includes('already staged in this context') === true,
    27,
    'Duplicate attachment prevention'
  );

  // 28. Existing Phase 5A regression tests
  // Verify mode selection, mode persistence, and submit handling work seamlessly
  const regCtx: ComposerContext = { type: 'general', conversationId: 'conv_reg_5a' };
  universalComposerService.setMode(regCtx, 'Deep Research');
  const regMode = universalComposerService.getMode(regCtx);
  const regSub = await universalComposerService.submit(regCtx, 'Regression verification query');
  assert(
    regMode === 'Deep Research' &&
    regSub.success === true,
    28,
    'Existing Phase 5A regression tests'
  );

  console.log('=== ALL 28 PHASE 5B ATTACHMENT & LINK PREVIEW TESTS PASSED SUCCESSFULLY! ✅ ===');
}

runPhase5BAttachmentTests().catch((err) => {
  console.error(err);
  process.exit(1);
});
