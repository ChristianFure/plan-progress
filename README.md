# plan-progress

A Claude Code mod that keeps the session's current plan in a band right above the prompt box, so you can always see how far the agent is through what it's doing:

```
████████░░░░ 2/3   ▸ Patch token refresh                All steps
```

- Updates live as the agent creates and checks off steps: the desktop app's task list, `TodoWrite`, and the `TaskCreate` / `TaskUpdate` tools.
- **All steps** expands the full checklist (`✓` done, `▸` current, `○` pending).
- Rebuilds the plan from the transcript when a session starts or resumes.
- Ignores subagents' own task lists; stays hidden until there is a plan.

## Install

At the prompt of a terminal session:

```
/plugin install plan-progress --marketplace christianfure/plan-progress
```

Answer `y` to add the marketplace, then pick a scope (user scope loads it in every session, desktop Code tab sessions included).

From a shell:

```bash
claude plugin install plan-progress --marketplace christianfure/plan-progress
```

In the desktop app, where `/plugin` does not run: click **+** next to the prompt box, then **Plugins**, **Add marketplace** with `christianfure/plan-progress`, then **Add plugin**.

### Cloud sessions

Cloud sessions load the plugins a repository's settings enable. Add this to `.claude/settings.json` in each repository you run cloud sessions on, and commit it:

```json
{
  "extraKnownMarketplaces": {
    "plan-progress": {
      "source": { "source": "github", "repo": "christianfure/plan-progress" }
    }
  },
  "enabledPlugins": {
    "plan-progress@plan-progress": true
  }
}
```
