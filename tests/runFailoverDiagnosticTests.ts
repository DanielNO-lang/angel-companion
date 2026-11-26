import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_GEMINI_MODEL,
  EMERGENCY_GEMINI_MODEL,
  MODEL_FALLBACK_STRATEGY,
  SECONDARY_GEMINI_MODEL,
  normalizeServerModelOverride,
  resolveStrictFallbackChain,
} from '../src/services/geminiModelService';
import { runForced503FailoverDiagnostic } from '../src/services/geminiFailoverDiagnostic';
import { handleChatRequest, resetBackendCachesForTesting } from '../server/geminiBackend';

test('Gemini model strategy strictly enforces primary gemini-3.8-flash and secondary gemini-3.1-flash-lite', () => {
  assert.equal(DEFAULT_GEMINI_MODEL, 'gemini-3.8-flash');
  assert.equal(SECONDARY_GEMINI_MODEL, 'gemini-3.1-flash-lite');
  assert.equal(EMERGENCY_GEMINI_MODEL, 'gemini-3.1-flash-lite');
  assert.deepEqual([...MODEL_FALLBACK_STRATEGY], ['gemini-3.8-flash', 'gemini-3.1-flash-lite']);

  assert.equal(normalizeServerModelOverride(''), 'gemini-3.8-flash');
  assert.equal(normalizeServerModelOverride('gemini-4-hydrogen'), 'gemini-3.8-flash');
  assert.equal(normalizeServerModelOverride('models/gemini-4-hydrogen'), 'gemini-3.8-flash');
  assert.equal(normalizeServerModelOverride('Gemini 4 Hydrogen'), 'gemini-3.8-flash');
  assert.deepEqual(resolveStrictFallbackChain('gemini-4-hydrogen'), [
    'gemini-3.8-flash',
    'gemini-3.1-flash-lite',
  ]);
});

test('Forced-503 diagnostic utility forces 503 on gemini-3.8-flash and verifies automatic emergency failover to gemini-3.1-flash-lite', async () => {
  resetBackendCachesForTesting();

  const report = await runForced503FailoverDiagnostic({
    backendHandleChat: handleChatRequest,
  });

  assert.equal(report.passed, true, `Failover diagnostic steps failed: ${JSON.stringify(report.steps)}`);
  assert.deepEqual([...report.strategy], ['gemini-3.8-flash', 'gemini-3.1-flash-lite']);
  assert.equal(report.steps.length, 3);

  const serviceStep = report.steps.find((s) => s.name === 'gemini_model_service_forced_503_failover');
  assert.ok(serviceStep);
  assert.equal(serviceStep.passed, true);
  assert.equal(serviceStep.requestedModel, 'gemini-3.8-flash');
  assert.equal(serviceStep.actualModel, 'gemini-3.1-flash-lite');
  assert.equal(serviceStep.fallbackActivated, true);
  assert.ok(serviceStep.attemptedModels.includes('gemini-3.8-flash'));
  assert.ok(serviceStep.attemptedModels.includes('gemini-3.1-flash-lite'));
  assert.equal(serviceStep.attemptedModels.includes('gemini-4-hydrogen'), false);

  const backendStep = report.steps.find((s) => s.name === 'end_to_end_backend_forced_503_failover');
  assert.ok(backendStep);
  assert.equal(backendStep.passed, true);
  assert.equal(backendStep.requestedModel, 'gemini-3.8-flash');
  assert.equal(backendStep.actualModel, 'gemini-3.1-flash-lite');
  assert.equal(backendStep.fallbackActivated, true);
  assert.ok(backendStep.fallbackReason?.includes('503'));
  assert.equal(backendStep.attemptedModels[0], 'gemini-3.8-flash');
  assert.equal(backendStep.attemptedModels[backendStep.attemptedModels.length - 1], 'gemini-3.1-flash-lite');
  assert.equal(backendStep.attemptedModels.includes('gemini-4-hydrogen'), false);
});
