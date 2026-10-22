export type StepStatus = 'pending' | 'in_progress' | 'completed'
export type Step = { content: string; status: StepStatus }
// `taskIds` is set while the plan comes from TaskCreate/TaskUpdate, one id per step.
export type Plan = { steps: Step[]; taskIds: string[] | null }

declare module 'claude-code' {
  interface PluginState {
    'plan-progress': { plan: Plan; isOpen: boolean }
  }
}
