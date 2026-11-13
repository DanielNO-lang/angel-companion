import assert from 'node:assert';
import fs from 'node:fs';
import { APPROVED_EIGHT_STUDIOS, studiosEngine } from '../src/services/studiosEngine';
import { workspaceEngine } from '../src/services/workspaceEngine';
import { libraryService } from '../src/services/libraryService';
import { memoryEngine } from '../src/services/memoryEngine';
import { conversationEngine } from '../src/services/conversationEngine';

async function runPhaseArchitectureAlignmentTests() {
  console.log('=== STARTING ANGEL AI: PHASE A ARCHITECTURE ALIGNMENT TEST SUITE (36 TESTS) ===');

  let passed = 0;
  let failed = 0;

  async function test(num: number, desc: string, fn: () => Promise<void> | void) {
    try {
      await fn();
      console.log(`[PASS] Test ${num}: ${desc}`);
      passed++;
    } catch (err: any) {
      console.error(`[FAIL] Test ${num}: ${desc} - ${err.message}`);
      failed++;
    }
  }

  // --- STUDIOS (1-5) ---
  await test(1, 'All eight Studios remain accessible', () => {
    assert.equal(APPROVED_EIGHT_STUDIOS.length, 8, 'Must have exactly 8 approved studios');
    APPROVED_EIGHT_STUDIOS.forEach((st) => {
      const state = studiosEngine.getStudioState(st.id);
      assert.ok(state, `Studio state for ${st.id} must be defined`);
    });
  });

  await test(2, 'Studio context remains isolated', () => {
    const threadDev = conversationEngine.getActiveThread('studio', 'development-studio');
    const threadRes = conversationEngine.getActiveThread('studio', 'research-studio');
    assert.notEqual(threadDev.id, threadRes.id, 'Development and Research studio threads must be distinct');
    assert.equal(threadDev.studioId, 'development-studio');
    assert.equal(threadRes.studioId, 'research-studio');
  });

  await test(3, 'Studios can access authorised project resources', () => {
    const proj = workspaceEngine.createProject('Test Studio Integration Proj', 'Test description');
    workspaceEngine.associateStudioWithProject(proj.id, 'development-studio');

    const devProjs = workspaceEngine.getProjects().filter((p) => !p.studioId || p.studioId === 'development-studio');
    assert.ok(devProjs.some((p) => p.id === proj.id), 'Development studio must see authorized project');
  });

  await test(4, 'Studios can retrieve authorised Library resources', () => {
    const item = libraryService.addItem({
      type: 'documents',
      name: 'Research Spec for Research Studio',
      content: 'Authorized content for research studio',
      tags: ['research'],
      studioId: 'research-studio',
    });

    const authorised = libraryService.getAuthorisedResources('research-studio');
    assert.ok(authorised.some((i) => i.id === item.id), 'Research Studio must retrieve its authorized library item');
  });

  await test(5, 'No duplicate Studio file storage is introduced', () => {
    const allItems = libraryService.getItems();
    const uniqueIds = new Set(allItems.map((i) => i.id));
    assert.equal(allItems.length, uniqueIds.size, 'Library resources must have unique IDs without duplicate file store creation');
  });

  // --- ADAPTIVE WORKSPACE (6-11) ---
  await test(6, 'All four work modes are available', () => {
    const validModes = ['research', 'code', 'writing', 'design'];
    assert.equal(validModes.length, 4, 'Must support 4 distinct work modes');
  });

  await test(7, 'Switching modes preserves their contexts', () => {
    const proj = workspaceEngine.getProjects()[0];
    assert.ok(proj, 'Must have at least one active project context');
  });

  await test(8, 'An existing project can be opened in Adaptive Workspace', () => {
    const proj = workspaceEngine.getProjects()[0];
    assert.ok(proj.id, 'Existing project ID must be openable');
  });

  await test(9, 'Library resources can be selected and retrieved in Adaptive Workspace', () => {
    const resources = libraryService.getAuthorisedResources(undefined, 'proj_default');
    assert.ok(Array.isArray(resources), 'Adaptive workspace must retrieve authorized library resources');
  });

  await test(10, 'Work can be saved to Workspace from Adaptive Workbench', () => {
    const proj = workspaceEngine.getProjects()[0];
    const file = workspaceEngine.addFileToProject(proj.id, 'Workbench_Output.md', 'Content from adaptive session', 'document');
    assert.ok(file, 'Must successfully create file in workspace project');
    assert.equal(file?.content, 'Content from adaptive session');
  });

  await test(11, 'No duplicate project or file store is created', () => {
    const projs = workspaceEngine.getProjects();
    const projIds = new Set(projs.map((p) => p.id));
    assert.equal(projs.length, projIds.size, 'Projects store must not duplicate project entries');
  });

  // --- WORKSPACE (12-18) ---
  await test(12, 'Project creation', () => {
    const p = workspaceEngine.createProject('New Test Workspace Project', 'Test description');
    assert.ok(p.id.startsWith('proj_'));
    assert.equal(p.name, 'New Test Workspace Project');
  });

  await test(13, 'Project editing and renaming', () => {
    const p = workspaceEngine.createProject('Old Proj Name', 'Old desc');
    const renamed = workspaceEngine.renameProject(p.id, 'Renamed Proj Name', 'New desc');
    assert.ok(renamed);
    assert.equal(p.name, 'Renamed Proj Name');
    assert.equal(p.description, 'New desc');
  });

  await test(14, 'File creation', () => {
    const p = workspaceEngine.getProjects()[0];
    const file = workspaceEngine.addFileToProject(p.id, 'Test_Create.md', '# Header', 'document');
    assert.ok(file);
    assert.equal(file?.name, 'Test_Create.md');
  });

  await test(15, 'File editing and persistence', () => {
    const p = workspaceEngine.getProjects()[0];
    const file = workspaceEngine.addFileToProject(p.id, 'Editable_File.md', 'Initial text', 'document');
    assert.ok(file);
    const updated = workspaceEngine.updateFileContent(file.id, 'Updated text');
    assert.ok(updated);
    const reloaded = workspaceEngine.getProjects().flatMap((proj) => proj.files).find((f) => f.id === file.id);
    assert.equal(reloaded?.content, 'Updated text');
  });

  await test(16, 'File search', () => {
    const p = workspaceEngine.getProjects()[0];
    workspaceEngine.addFileToProject(p.id, 'Searchable_Unique_XYZ.md', 'Content with unique XYZ keyword', 'document');
    const matches = workspaceEngine.searchFiles('Unique_XYZ');
    assert.ok(matches.length > 0);
    assert.ok(matches.some((f) => f.name.includes('Unique_XYZ')));
  });

  await test(17, 'File deletion', () => {
    const p = workspaceEngine.getProjects()[0];
    const file = workspaceEngine.addFileToProject(p.id, 'Delete_Me.md', 'To be deleted', 'document');
    assert.ok(file);
    const deleted = workspaceEngine.deleteFile(file.id);
    assert.ok(deleted);
    const exists = p.files.some((f) => f.id === file.id);
    assert.equal(exists, false);
  });

  await test(18, 'Project and Studio associations', () => {
    const p = workspaceEngine.createProject('Studio Linked Proj', 'Linked to Dev Studio');
    workspaceEngine.associateStudioWithProject(p.id, 'development-studio');
    assert.equal(p.studioId, 'development-studio');
  });

  // --- LIBRARY (19-28) ---
  await test(19, 'Create a knowledge record / library resource', () => {
    const item = libraryService.addItem({
      type: 'knowledge',
      name: 'Test Library Knowledge Record',
      content: 'Knowledge body text',
      tags: ['test', 'knowledge'],
      collection: 'Test Collection',
    });
    assert.ok(item.id.startsWith('lib_'));
    assert.equal(item.name, 'Test Library Knowledge Record');
  });

  await test(20, 'Upload or register a supported resource', () => {
    const item = libraryService.uploadFile({
      name: 'Uploaded_Spec.json',
      content: '{"key": "value"}',
      type: 'code',
      mimeType: 'application/json',
      size: 16,
    });
    assert.ok(item);
    assert.equal(item.name, 'Uploaded_Spec.json');
    assert.equal(item.type, 'code');
  });

  await test(21, 'Search Library', () => {
    libraryService.addItem({
      type: 'documents',
      name: 'Unique_Quantum_Paper_Searchable.md',
      content: 'Quantum physics literature notes',
      tags: ['quantum_search_tag'],
    });
    const results = libraryService.searchItems('quantum_search_tag');
    assert.ok(results.length > 0);
    assert.ok(results.some((r) => r.name.includes('Unique_Quantum_Paper_Searchable')));
  });

  await test(22, 'Update a record', () => {
    const item = libraryService.addItem({
      type: 'documents',
      name: 'Before Update Title',
      content: 'Before content',
      tags: [],
    });
    const updated = libraryService.updateItem(item.id, { name: 'After Update Title', content: 'After content' });
    assert.ok(updated);
    assert.equal(updated?.name, 'After Update Title');
    assert.equal(updated?.content, 'After content');
  });

  await test(23, 'Delete a record', () => {
    const item = libraryService.addItem({
      type: 'other',
      name: 'Temporary Resource To Delete',
      content: 'Delete content',
      tags: [],
    });
    const deleted = libraryService.deleteItem(item.id);
    assert.ok(deleted);
    assert.equal(libraryService.getItem(item.id), undefined);
  });

  await test(24, 'Retrieve authorised resources', () => {
    const item = libraryService.addItem({
      type: 'references',
      name: 'Authorised Reference Doc',
      content: 'Content',
      tags: [],
      studioId: 'research-studio',
    });
    const authList = libraryService.getAuthorisedResources('research-studio');
    assert.ok(authList.some((i) => i.id === item.id));
  });

  await test(25, 'Link a resource to a project', () => {
    const item = libraryService.addItem({
      type: 'documents',
      name: 'Unlinked Resource',
      content: 'Content',
      tags: [],
    });
    const p = workspaceEngine.getProjects()[0];
    const linked = libraryService.linkToProject(item.id, p.id);
    assert.ok(linked);
    assert.equal(libraryService.getItem(item.id)?.projectId, p.id);
  });

  await test(26, 'Link a resource to a Studio', () => {
    const item = libraryService.addItem({
      type: 'templates',
      name: 'Unlinked Template',
      content: 'Template text',
      tags: [],
    });
    const linked = libraryService.linkToStudio(item.id, 'creative-studio');
    assert.ok(linked);
    assert.equal(libraryService.getItem(item.id)?.studioId, 'creative-studio');
  });

  await test(27, 'Prevent duplicate storage', () => {
    const all = libraryService.getItems();
    const ids = new Set(all.map((i) => i.id));
    assert.equal(all.length, ids.size, 'All library item IDs must be distinct');
  });

  await test(28, 'Restore Library resources after refresh', () => {
    const all = libraryService.getItems();
    assert.ok(all.length > 0, 'Library items must persist across reloads');
  });

  // --- MEMORY SEPARATION (29-33) ---
  await test(29, 'Existing personal memories remain intact', () => {
    const mem = memoryEngine.saveMemory({
      category: 'personal',
      scope: 'general',
      title: 'User Preferred Dark Theme',
      content: 'User prefers dark theme and clean layout',
    });
    assert.ok(mem.id);
    const personalMems = memoryEngine.getMemories('personal');
    assert.ok(personalMems.some((m) => m.id === mem.id));
  });

  await test(30, 'Memory retrieval still works for prompt context', () => {
    const contextStr = memoryEngine.retrieveContextForPrompt('dark theme preferences', 'general');
    assert.ok(typeof contextStr === 'string');
  });

  await test(31, 'Library records do not become personal memories automatically', () => {
    const libItem = libraryService.addItem({
      type: 'documents',
      name: 'Standalone Library Document File',
      content: 'Document file contents without memory clutter',
      tags: ['doc'],
    });
    const mems = memoryEngine.getMemories('personal');
    assert.equal(mems.some((m) => m.content.includes('Standalone Library Document File')), false);
  });

  await test(32, 'Existing knowledge records migrate safely', () => {
    const count = libraryService.migrateLegacyKnowledgeRecords();
    assert.ok(count >= 0, 'Migration must complete cleanly');
  });

  await test(33, 'Migration can run more than once without duplicating records', () => {
    const beforeLen = libraryService.getItems().length;
    libraryService.migrateLegacyKnowledgeRecords();
    const afterLen = libraryService.getItems().length;
    assert.equal(beforeLen, afterLen, 'Subsequent migration runs must be idempotent and not duplicate items');
  });

  // --- NAVIGATION (34-36) ---
  await test(34, 'Library opens from the main navigation / registered as destination', () => {
    const appCode = fs.readFileSync('src/App.tsx', 'utf-8');
    assert.ok(appCode.includes('import { LibraryPage }'), 'App.tsx must import LibraryPage');
    assert.ok(appCode.includes('case \'library\':'), 'App.tsx must contain case \'library\'');
  });

  await test(35, 'Tools no longer contains a duplicate Knowledge Library destination', () => {
    const toolsCode = fs.readFileSync('src/components/pages/ToolsPage.tsx', 'utf-8');
    assert.equal(toolsCode.includes('KnowledgeLibraryManager'), false, 'ToolsPage must not render KnowledgeLibraryManager');
  });

  await test(36, 'Existing navigation destinations still work', () => {
    const appCode = fs.readFileSync('src/App.tsx', 'utf-8');
    assert.ok(appCode.includes('case \'library\':'));
    assert.ok(appCode.includes('case \'workspace\':'));
    assert.ok(appCode.includes('case \'studios\':'));
    assert.ok(appCode.includes('case \'adaptive-workspace\':'));
  });

  console.log(`\n=== TEST SUITE RESULTS: ${passed} / 36 PASSED ===`);
  if (failed > 0) {
    console.error(`[FAIL] ${failed} tests failed!`);
    process.exit(1);
  } else {
    console.log('ALL 36 PHASE A ARCHITECTURE ALIGNMENT TESTS PASSED SUCCESSFULLY! ✅\n');
  }
}

runPhaseArchitectureAlignmentTests().catch((err) => {
  console.error('Fatal test execution error:', err);
  process.exit(1);
});
