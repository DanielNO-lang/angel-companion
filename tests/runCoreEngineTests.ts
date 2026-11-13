/**
 * ANGEL AI CORE APPLICATION ENGINE - AUTOMATED UNIT TEST SUITE
 * Executes rigorous verification tests for state initialization, event bus dispatch,
 * deduplication, service boundaries, local storage persistence, and error recovery.
 */

import { centralStore } from '../src/services/centralStore';
import { eventBus, AngelEvent } from '../src/services/AngelEventBus';
import { errorHandler, AngelAppError } from '../src/services/ErrorHandlerService';
import {
  ConversationService,
  MessageService,
  TaskService,
  ProjectService,
  FileService,
  AgentService,
  PermissionService,
  SearchService,
  SettingsService,
} from '../src/services/services';
import { storageService, STORAGE_KEYS } from '../src/services/storageService';

async function runCoreEngineTests() {
  console.log('=== STARTING ANGEL CORE APPLICATION ENGINE TEST SUITE ===\n');
  let passedTests = 0;
  let totalTests = 0;

  function assert(condition: boolean, testName: string, detail?: string) {
    totalTests++;
    if (condition) {
      passedTests++;
      console.log(`[PASS] Test ${totalTests}: ${testName}`);
    } else {
      console.error(`[FAIL] Test ${totalTests}: ${testName} - ${detail || 'Assertion failed'}`);
    }
  }

  // 1. Test Application Initialization & Central Store State
  const initialState = centralStore.getState();
  assert(
    typeof initialState.userSession === 'object' && initialState.userSession.isAuthenticated === false,
    'Central Store Initialization (Unauthenticated Default)',
    'User session should not fabricate a signed-in user on boot'
  );
  assert(
    initialState.conversations.length > 0,
    'Initial Conversation Threads Loaded',
    'No default threads in central store'
  );

  // 2. Test Event Bus Dispatch & Subscriber Callback
  let eventReceived = false;
  let receivedPayload: any = null;
  const unsubscribe = eventBus.subscribe('task:started', (evt: AngelEvent) => {
    eventReceived = true;
    receivedPayload = evt.payload;
  });

  eventBus.publish('task:started', { taskId: 'test_task_1', title: 'Automated Unit Test Task' });
  assert(
    eventReceived && receivedPayload?.taskId === 'test_task_1',
    'Event Bus Publish & Subscribe',
    'Subscriber did not receive task:started event'
  );
  unsubscribe();

  // 3. Test Event Deduplication Logic
  let duplicateCount = 0;
  const unsubDup = eventBus.subscribe('notification:generated', () => {
    duplicateCount++;
  });

  const fixedNonce = 'unique_nonce_12345';
  eventBus.publish('notification:generated', { message: 'Test Notif' }, fixedNonce);
  eventBus.publish('notification:generated', { message: 'Test Notif' }, fixedNonce); // Should be suppressed
  assert(
    duplicateCount === 1,
    'Event Bus Duplicate Suppression',
    `Expected 1 event dispatch, got ${duplicateCount}`
  );
  unsubDup();

  // 4. Test ConversationService & MessageService Operations
  const newThread = ConversationService.createThread('general', undefined, 'Unit Test Architecture Thread');
  assert(
    newThread.id.startsWith('conv_'),
    'ConversationService Create Thread',
    'Failed to generate unique thread ID'
  );

  const userMsg = await MessageService.sendMessage(newThread.id, 'What is the system architecture?');
  assert(
    userMsg.content === 'What is the system architecture?',
    'MessageService Send Message',
    'Message content mismatch'
  );

  const renamed = ConversationService.renameThread(newThread.id, 'Renamed Architecture Thread');
  assert(renamed === true, 'ConversationService Rename Thread');

  // 5. Test Task Lifecycle Transitions Across 7 Statuses
  const newTask = TaskService.createTask('Test AST Refactoring Task', 'Development', 'user', 'Refactoring test');
  assert(newTask.status === 'running', 'TaskService Initial Status Running');

  TaskService.updateStatus(newTask.id, 'waiting_approval');
  assert(
    TaskService.getTasks('waiting_approval').some((t) => t.id === newTask.id),
    'Task Lifecycle Transition to Waiting Approval'
  );

  const approved = TaskService.approveTask(newTask.id);
  assert(approved === true, 'Task Approval Granted');

  TaskService.updateStatus(newTask.id, 'completed');
  assert(
    TaskService.getTasks('completed').some((t) => t.id === newTask.id),
    'Task Lifecycle Transition to Completed'
  );

  // 6. Test FileService & Workspace Auto-Save Persistence
  const projects = ProjectService.getProjects();
  const targetProj = projects[0];
  const newFile = FileService.addFile(targetProj.id, 'UnitTestDoc.md', '# Unit Test Document\nInitial content.', 'document');
  assert(newFile !== null && newFile.name === 'UnitTestDoc.md', 'FileService Create File');

  if (newFile) {
    const updated = FileService.updateFile(newFile.id, '# Unit Test Document\nUpdated content auto-saved.');
    assert(updated === true, 'FileService Auto-Save Update');

    // Test SearchService across files and tasks
    const searchResults = SearchService.queryAll('Unit Test');
    assert(
      searchResults.files.some((f) => f.id === newFile.id),
      'SearchService Unified Cross-Module Query'
    );

    FileService.deleteFile(newFile.id);
  }

  // 7. Test Local Persistence & Recovery
  const backupJSON = storageService.exportBackupJSON();
  assert(backupJSON.includes('angel_conversations_v1'), 'StorageService Export Backup JSON');

  const loadedConv = storageService.load<any>(STORAGE_KEYS.conversations, null);
  assert(loadedConv !== null, 'StorageService Load Persistence Data');

  // Test Corrupt Data Recovery
  const corruptLoad = storageService.load<string>('non_existent_corrupt_key', 'fallback_recovered');
  assert(corruptLoad === 'fallback_recovered', 'StorageService Corrupt/Missing Data Recovery');

  // 8. Test ErrorHandlerService Centralized Reporting
  const errorLog = errorHandler.handleError(
    new AngelAppError('ERR_VALIDATION', 'Unit test validation constraint failed'),
    'UnitTestSuite'
  );
  assert(
    errorLog.code === 'ERR_VALIDATION' && errorLog.recovered === true,
    'ErrorHandlerService Centralized Logging & Recovery'
  );

  // Cleanup Test Thread
  ConversationService.deleteThread(newThread.id);

  console.log(`\n=== TEST SUITE RESULTS: ${passedTests} / ${totalTests} PASSED ===`);
  if (passedTests === totalTests) {
    console.log('ALL CORE APPLICATION ENGINE TESTS PASSED SUCCESSFULLY! ✅\\n');
  } else {
    console.error('SOME ENGINE TESTS FAILED. INSPECT LOGS ABOVE. ❌\\n');
    process.exitCode = 1;
  }
}

runCoreEngineTests().catch((err) => {
  console.error('Test execution error:', err);
  process.exitCode = 1;
});
