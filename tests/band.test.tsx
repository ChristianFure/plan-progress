import { expect, test } from 'claude-code/testing'

const BAND = {
  plugin: 'plan-progress',
  component: 'AbovePrompt',
  props: {
    hasSurvey: false,
    isWorking: true,
    maxRows: 12,
    bodyColumns: 80,
    scroll: { offset: 0, bodyRows: 12 },
  },
} as const

test('the band follows the plan as the session works through it', async ($, on) => {
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  on('session.messages', () => ({ value: [] }))
  on('tool.call', () => ({ result: {} }))

  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  await $.tool.call({
    tool: 'mcp__ccd_turn__update_plan',
    items: [
      { content: 'Read auth code', status: 'in_progress' },
      { content: 'Patch token refresh', status: 'pending' },
      { content: 'Run tests', status: 'pending' },
    ],
  })
  await $.tool.call({ tool: 'mcp__ccd_turn__update_plan', advance: true })

  for (const surface of ['terminal', 'desktop', 'vscode', 'mobile'] as const) {
    const ui = await $.ui.mount({ ...BAND, surface })
    expect((await ui.find({ type: 'Text', text: /1\/3/ }))?.text).toMatch(/█+░+ 1\/3/)
    expect((await ui.find({ type: 'Text', text: /Patch/ }))?.text).toBe('▸ Patch token refresh')
    await ui.press({ key: 'toggle' })
    expect((await ui.find({ type: 'Text', text: /Run tests/ }))?.text).toMatch(/○ Run tests/)
    await ui.press({ key: 'toggle' })
    await ui.unmount()
  }

  await $.tool.call({ tool: 'mcp__ccd_turn__wrap_up', recap: 'done' })
  const ui = await $.ui.mount({ ...BAND, surface: 'desktop' })
  expect(await ui.find({ type: 'Text', text: /Plan complete/ })).toBeDefined()
  await ui.unmount()
})

test('a resumed session rebuilds its plan from the transcript', async ($, on) => {
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  on('session.messages', () => ({
    value: [
      {
        role: 'assistant',
        text: '',
        toolUses: [
          {
            tool_use_id: 't1',
            tool: 'TodoWrite',
            input: {
              todos: [
                { content: 'Outline', status: 'completed', activeForm: '' },
                { content: 'Draft', status: 'in_progress', activeForm: '' },
              ],
            },
          },
        ],
      },
    ],
  }))

  await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })
  const ui = await $.ui.mount({ ...BAND, surface: 'terminal' })
  expect((await ui.find({ type: 'Text', text: /1\/2/ }))).toBeDefined()
  expect((await ui.find({ type: 'Text', text: /Draft/ }))?.text).toBe('▸ Draft')
  await ui.unmount()
})
