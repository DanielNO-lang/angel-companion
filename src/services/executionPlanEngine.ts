import {
  ExecutionPlan,
  ExecutionPlanStep,
  ExecutionPlanStatus,
  PromptContext,
} from '../types/promptEngine';
import { capabilityRegistry } from './capabilityRegistry';
import { activityEngine } from './activityEngine';
import { eventBus } from './AngelEventBus';
import { storageService, STORAGE_KEYS } from './storageService';

export class ExecutionPlanEngine {
  private activePlans: Map<string, ExecutionPlan> = new Map();

  constructor() {
    this.loadPersistedPlans();
  }

  public createPlan(
    title: string,
    objective: string,
    scope: 'general' | 'studio',
    studioId: any,
    steps: Array<{
      stepId: string;
      stepName: string;
      capabilityId: string;
      requiresApproval: boolean;
      inputs: Record<string, any>;
      dependsOnStepIds: string[];
    }>
  ): ExecutionPlan {
    const planId = `plan_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const planSteps: ExecutionPlanStep[] = steps.map((s) => ({
      id: s.stepId,
      name: s.stepName,
      capabilityId: s.capabilityId,
      status: 'pending',
      dependencies: s.dependsOnStepIds || [],
      requiresApproval: s.requiresApproval,
    }));

    const plan: ExecutionPlan = {
      id: planId,
      title,
      objective,
      scope,
      studioId,
      status: 'pending',
      steps: planSteps,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    this.activePlans.set(planId, plan);
    this.persistPlans();

    // Register with Activities system
    activityEngine.createTask(
      `Plan: ${title}`,
      scope === 'studio' ? (studioId || 'Studio Task') : 'General Task',
      'angel_self',
      `Objective: ${objective}`
    );

    eventBus.publish('task:started', { planId, title, scope });
    return plan;
  }

  public async executePlan(planId: string, context: PromptContext): Promise<ExecutionPlan> {
    const plan = this.activePlans.get(planId);
    if (!plan) throw new Error(`Execution plan '${planId}' not found.`);

    if (plan.status === 'paused' || plan.status === 'completed') {
      return plan;
    }

    plan.status = 'running';
    plan.updatedAt = new Date().toISOString();
    this.persistPlans();

    for (const step of plan.steps) {
      if (step.status === 'completed' || step.status === 'skipped') continue;

      // Check step dependencies
      const dependenciesMet = step.dependencies.every((depId) => {
        const depStep = plan.steps.find((s) => s.id === depId);
        return depStep && depStep.status === 'completed';
      });

      if (!dependenciesMet) {
        step.status = 'pending';
        continue;
      }

      // Check approval checkpoint
      if (step.requiresApproval) {
        plan.status = 'waiting_approval';
        step.status = 'pending';
        this.persistPlans();
        eventBus.publish('approval:requested', { planId, stepId: step.id, stepName: step.name });
        return plan;
      }

      // Execute Step
      step.status = 'running';
      this.persistPlans();

      const result = await capabilityRegistry.executeCapability(
        step.capabilityId,
        { text: plan.objective },
        context
      );

      if (result.success) {
        step.status = 'completed';
        step.result = result;
      } else {
        step.status = 'failed';
        step.error = result.error || result.summaryText;
        plan.status = 'failed';
        plan.errorSummary = `Step '${step.name}' failed: ${step.error}`;
        plan.updatedAt = new Date().toISOString();
        this.persistPlans();

        eventBus.publish('task:failed', { planId, errorMsg: plan.errorSummary });
        return plan;
      }
    }

    // Check if all steps completed
    const allCompleted = plan.steps.every((s) => s.status === 'completed' || s.status === 'skipped');
    if (allCompleted) {
      plan.status = 'completed';
      plan.updatedAt = new Date().toISOString();
      this.persistPlans();
      eventBus.publish('task:completed', { planId });
    }

    return plan;
  }

  public approveStepAndContinue(planId: string, stepId: string, context: PromptContext): Promise<ExecutionPlan> {
    const plan = this.activePlans.get(planId);
    if (!plan) throw new Error(`Execution plan '${planId}' not found.`);

    const step = plan.steps.find((s) => s.id === stepId);
    if (step) {
      step.requiresApproval = false; // Approval granted
    }

    return this.executePlan(planId, context);
  }

  public pausePlan(planId: string): boolean {
    const plan = this.activePlans.get(planId);
    if (!plan) return false;
    plan.status = 'paused';
    plan.updatedAt = new Date().toISOString();
    this.persistPlans();
    return true;
  }

  public resumePlan(planId: string, context: PromptContext): Promise<ExecutionPlan> {
    const plan = this.activePlans.get(planId);
    if (!plan) throw new Error(`Execution plan '${planId}' not found.`);
    plan.status = 'running';
    return this.executePlan(planId, context);
  }

  public cancelPlan(planId: string): boolean {
    const plan = this.activePlans.get(planId);
    if (!plan) return false;
    plan.status = 'failed';
    plan.errorSummary = 'Plan cancelled by user.';
    plan.updatedAt = new Date().toISOString();
    this.persistPlans();
    return true;
  }

  public getPlan(planId: string): ExecutionPlan | undefined {
    return this.activePlans.get(planId);
  }

  public getAllPlans(): ExecutionPlan[] {
    return Array.from(this.activePlans.values());
  }

  private persistPlans(): void {
    const arrayData = Array.from(this.activePlans.values());
    storageService.save(STORAGE_KEYS.activities + '_plans_v1', arrayData);
  }

  private loadPersistedPlans(): void {
    const loaded = storageService.load<ExecutionPlan[]>(STORAGE_KEYS.activities + '_plans_v1', []);
    if (Array.isArray(loaded)) {
      loaded.forEach((p) => this.activePlans.set(p.id, p));
    }
  }
}

export const executionPlanEngine = new ExecutionPlanEngine();
