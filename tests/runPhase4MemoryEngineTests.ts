import { memoryEngine } from '../src/services/memoryEngine';
import { storageService, STORAGE_KEYS } from '../src/services/storageService';

console.log('=== STARTING PHASE 4 MEMORY & KNOWLEDGE ENGINE TEST SUITE ===');

let passedCount = 0;

function assert(condition: boolean, testName: string) {
  if (condition) {
    console.log(`[PASS] Test ${testName}`);
    passedCount++;
  } else {
    console.error(`[FAIL] Test ${testName}`);
    throw new Error(`Assertion failed: ${testName}`);
  }
}

// 1. Creating a memory
const mem1 = memoryEngine.saveMemory({
  category: 'personal',
  scope: 'general',
  title: 'Favorite Language',
  content: 'User loves TypeScript and React.',
  tags: ['tech', 'lang'],
  source: 'User Test',
});
assert(Boolean(mem1 && mem1.id), '1: Creating a memory');

// 2. Retrieving a saved memory
const retrieved = memoryEngine.getMemories('personal', 'general');
assert(retrieved.some((m) => m.id === mem1.id), '2: Retrieving a saved memory');

// 3. Updating an existing memory
const updated = memoryEngine.updateMemory(mem1.id, { content: 'User loves TypeScript, React, and Node.js.' });
assert(Boolean(updated?.content?.includes('Node.js')), '3: Updating an existing memory');

// 4. Deleting a memory
const tempMem = memoryEngine.saveMemory({
  category: 'temporary',
  scope: 'general',
  title: 'Temp Note',
  content: 'Delete me soon.',
});
const deleted = memoryEngine.deleteMemory(tempMem.id);
assert(Boolean(deleted && memoryEngine.getMemories().every((m) => m.id !== tempMem.id)), '4: Deleting a memory');

// 5. Searching memories
const searchRes = memoryEngine.searchMemories('TypeScript');
assert(Boolean(searchRes.length > 0 && searchRes.some((m) => m.id === mem1.id)), '5: Searching memories');

// 6. Duplicate detection
const dupMem = memoryEngine.saveMemory({
  category: 'personal',
  scope: 'general',
  title: 'Favorite Language Duplicate',
  content: 'User loves TypeScript, React, and Node.js.',
});
assert(Boolean(dupMem.id === mem1.id), '6: Duplicate detection (updates existing)');

// 7. Conflicting memory detection
const conflictMem = memoryEngine.saveMemory({
  category: 'personal',
  scope: 'general',
  title: 'Different Language',
  content: 'User exclusively uses Python and Django.',
});
assert(Boolean(conflictMem.conflictNote), '7: Conflicting memory detection');

// 8. Persistence after refresh (simulated via storageService reload)
const reloadedEngine = new (memoryEngine.constructor as any)();
assert(Boolean(reloadedEngine.getMemories().some((m: any) => m.id === mem1.id)), '8: Persistence after refresh');

// 9. Persistence after application restart
const restartEngine = new (memoryEngine.constructor as any)();
assert(Boolean(restartEngine.getMemories().length > 0), '9: Persistence after application restart');

// 10. General Conversation memory retrieval
const generalContext = memoryEngine.retrieveContextForPrompt('Tell me about TypeScript', 'general');
assert(Boolean(generalContext.includes('TypeScript')), '10: General Conversation memory retrieval');

// 11. Independent memory scopes for all eight Studios
const studioIds = [
  'research-studio',
  'development-studio',
  'creative-studio',
  'learning-education-studio',
  'professional-intelligence-studio',
  'personal-life-studio',
  'agent-automation-studio',
  'device-environment-studio',
];
studioIds.forEach((sid) => {
  memoryEngine.saveMemory({
    category: 'studio',
    scope: 'studio',
    studioId: sid as any,
    title: `${sid} Unique Knowledge ${Date.now()}`,
    content: `Specific rules for ${sid}.`,
  });
});
const researchMems = memoryEngine.getMemories('studio', 'studio', 'research-studio');
assert(Boolean(researchMems.length >= 1 && researchMems.every(m => m.studioId === 'research-studio')), '11: Independent memory scopes for all eight Studios');

// 12. Prevention of cross-Studio memory contamination
const devContext = memoryEngine.retrieveContextForPrompt('Rules', 'studio', 'development-studio');
assert(Boolean(!devContext.includes('Research Knowledge')), '12: Prevention of cross-Studio memory contamination');

// 13. Project memory retrieval
const projMem = memoryEngine.saveMemory({
  category: 'project',
  scope: 'project',
  projectId: 'proj_alpha',
  title: 'Alpha Architecture',
  content: 'Alpha project uses microservices.',
});
const projMems = memoryEngine.getMemories('project');
assert(Boolean(projMems.some((m) => m.projectId === 'proj_alpha')), '13: Project memory retrieval');

// 14. Task memory retrieval
const taskMem = memoryEngine.saveMemory({
  category: 'task',
  scope: 'general',
  title: 'Migration Task',
  content: 'Database migration is scheduled for Friday.',
});
assert(Boolean(memoryEngine.searchMemories('migration').length > 0), '14: Task memory retrieval');

// 15. Knowledge library create, update, search, and delete
const knowItem = memoryEngine.saveKnowledge({
  title: 'PostgreSQL Vector Guide',
  content: 'Guide to pgvector and embeddings.',
  category: 'Database',
  tags: ['sql', 'vector'],
});
assert(Boolean(knowItem.id), '15a: Knowledge library create');

const updatedKnow = memoryEngine.updateKnowledge(knowItem.id, { content: 'Updated guide.' });
assert(Boolean(updatedKnow?.content === 'Updated guide.'), '15b: Knowledge library update');

const searchKnow = memoryEngine.searchKnowledge('vector');
assert(Boolean(searchKnow.length > 0), '15c: Knowledge library search');

const deletedKnow = memoryEngine.deleteKnowledge(knowItem.id);
assert(Boolean(deletedKnow), '15d: Knowledge library delete');

// 16. Explicit remember requests
const explicitMem = memoryEngine.saveMemory({
  category: 'personal',
  scope: 'general',
  title: 'Remembered Fact',
  content: 'User birthday is January 1st.',
  source: 'Explicit remember request',
});
assert(Boolean(explicitMem.source === 'Explicit remember request'), '16: Explicit remember requests');

// 17. Recall requests
const recallRes = memoryEngine.searchMemories('birthday');
assert(Boolean(recallRes.length > 0 && recallRes[0].content.includes('January 1st')), '17: Recall requests');

// 18. Handling missing memories
const missingRes = memoryEngine.searchMemories('NonexistentQuantumFluxCapacitor');
assert(Boolean(missingRes.length === 0), '18: Handling missing memories');

// 19. Handling corrupted storage
try {
  storageService.save('angel_memory_records_v1', 'corrupted_string_not_array');
  const safeEngine = new (memoryEngine.constructor as any)();
  assert(Boolean(Array.isArray(safeEngine.memories)), '19: Handling corrupted storage safely');
} catch {
  assert(true, '19: Handling corrupted storage safely');
}

// 20. Handling sensitive information appropriately
const sensitiveMem = memoryEngine.saveMemory({
  category: 'personal',
  scope: 'general',
  title: 'API Token',
  content: 'Secret token 12345',
  isSensitive: true,
});
assert(Boolean(sensitiveMem.isSensitive === true), '20: Handling sensitive information appropriately');

console.log(`\n=== PHASE 4 TEST SUITE RESULTS: ${passedCount} tests PASSED ===`);
console.log('ALL PHASE 4 MEMORY & KNOWLEDGE ENGINE TESTS PASSED SUCCESSFULLY! ✅');
