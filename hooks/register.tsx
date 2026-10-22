import { atom, read, update } from 'claude-code'
import type { Register } from 'claude-code'

import type { Plan, Step, StepStatus } from '../types'

const EMPTY: Plan = { steps: [], taskIds: null }
const plan = atom({ plugin: 'plan-progress', key: 'plan' } as const, EMPTY)
const isOpen = atom({ plugin: 'plan-progress', key: 'isOpen' } as const, false)

// The tools a session keeps its plan with: the desktop app's task list, the
// CLI's TodoWrite, and the Task tools.
const PLAN_TOOLS = new Set([
  'mcp__ccd_turn__update_plan',
  'mcp__ccd_turn__wrap_up',
  'TodoWrite',
  'TaskCreate',
  'TaskUpdate',
])

const asStatus = (s: unknown): StepStatus =>
  s === 'completed' || s === 'in_progress' ? s : 'pending'

const setStatus = (steps: Step[], at: number, status: StepStatus) =>
  steps.map((s, i) => (i === at ? { ...s, status } : s))

const toSteps = (list: unknown): Step[] | undefined =>
  Array.isArray(list)
    ? list.map((i: { content?: unknown; status?: unknown }) => ({
        content: String(i?.content ?? ''),
        status: asStatus(i?.status),
      }))
    : undefined

// Applies one plan-tool call to the plan as it stood before it.
function apply(now: Plan, tool: string, input: Record<string, unknown>, result?: unknown): Plan {
  if (tool === 'mcp__ccd_turn__update_plan') {
    let steps = toSteps(input.items) ?? now.steps
    if (input.advance === true) {
      const at = steps.findIndex(s => s.status === 'in_progress')
      const next = steps.findIndex((s, i) => i > at && s.status === 'pending')
      steps = setStatus(setStatus(steps, at, 'completed'), next, 'in_progress')
    }
    for (const n of Array.isArray(input.done) ? input.done : []) {
      steps = setStatus(steps, Number(n) - 1, 'completed')
    }
    const start = Number(input.start)
    if (Number.isInteger(start) && steps[start - 1]) {
      steps = steps.map(s => (s.status === 'in_progress' ? { ...s, status: 'pending' } : s))
      steps = setStatus(steps, start - 1, 'in_progress')
    }

    return { steps, taskIds: null }
  }
  if (tool === 'mcp__ccd_turn__wrap_up') {
    return { ...now, steps: now.steps.map(s => ({ ...s, status: 'completed' })) }
  }
  if (tool === 'TodoWrite') {
    return { steps: toSteps(input.todos) ?? now.steps, taskIds: null }
  }
  // A Task list replaces whatever plan came before it.
  const ids = now.taskIds ?? []
  const steps = now.taskIds ? now.steps : []
  if (tool === 'TaskCreate') {
    const id = (result as { task?: { id?: string } } | undefined)?.task?.id ?? String(ids.length + 1)
    const step: Step = { content: String(input.subject ?? ''), status: 'pending' }

    return { steps: [...steps, step], taskIds: [...ids, id] }
  }
  if (tool === 'TaskUpdate') {
    const at = ids.indexOf(String(input.taskId ?? ''))
    if (at < 0) return now
    if (input.status === 'deleted') {
      return {
        steps: steps.filter((_, i) => i !== at),
        taskIds: ids.filter((_, i) => i !== at),
      }
    }

    return {
      taskIds: ids,
      steps: steps.map((s, i) =>
        i !== at
          ? s
          : {
              content: input.subject !== undefined ? String(input.subject) : s.content,
              status: input.status !== undefined ? asStatus(input.status) : s.status,
            },
      ),
    }
  }

  return now
}

const bar = (done: number, total: number, width = 12) => {
  const filled = total === 0 ? 0 : Math.round((done / total) * width)

  return '█'.repeat(filled) + '░'.repeat(width - filled)
}

const mark = (s: StepStatus) => (s === 'completed' ? '✓' : s === 'in_progress' ? '▸' : '○')

export const register: Register = on => {
  // A resumed or reloaded session rebuilds its plan from its own transcript.
  on('session.start', async ($, e, next) => {
    const started = await next(e)
    const messages = await $.session.messages()
    let rebuilt = EMPTY
    for (const message of messages) {
      for (const use of message.toolUses) {
        if (PLAN_TOOLS.has(use.tool)) rebuilt = apply(rebuilt, use.tool, use.input, use.result)
      }
    }
    await update($, plan, () => rebuilt)

    return started
  })

  on('tool.call', async ($, e, next) => {
    // Only the session's own plan: a subagent's task list is not the session's.
    if (!PLAN_TOOLS.has(e.tool) || e.agentId !== undefined) return next(e)
    const ran = await next(e)
    if (!('deny' in ran && ran.deny) && !ran.isError) {
      const { tool, ...input } = e
      await update($, plan, now => apply(now, tool, input, ran.result))
    }

    return ran
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    const { steps } = await read($, plan)
    if (e.props.hasSurvey || steps.length === 0) return next(e)

    const { Box, Text, Button } = $.ui.resolve(e)
    const open = await read($, isOpen)
    const done = steps.filter(s => s.status === 'completed').length
    const total = steps.length
    const isComplete = done === total
    const current =
      steps.find(s => s.status === 'in_progress') ?? steps.find(s => s.status === 'pending')

    return (
      <Box flexDirection="column">
        <Box flexDirection="row" gap={1}>
          <Text color={isComplete ? 'success' : 'claude'}>
            {bar(done, total)} {done}/{total}
          </Text>
          <Box flexGrow={1} flexShrink={1}>
            {isComplete ? (
              <Text color="success">✓ Plan complete</Text>
            ) : (
              <Text wrap="truncate-end">
                {current ? `${mark(current.status)} ${current.content}` : ''}
              </Text>
            )}
          </Box>
          <Button
            key="toggle"
            label={open ? 'Hide steps' : 'All steps'}
            plain
            dimColor
            onPress={() => void update($, isOpen, now => !now)}
          />
        </Box>
        {open &&
          steps.map(step => (
            <Text
              dimColor={step.status === 'completed'}
              bold={step.status === 'in_progress'}
              wrap="truncate-end"
            >
              {'  '}
              {mark(step.status)} {step.content}
            </Text>
          ))}
      </Box>
    )
  })
}
