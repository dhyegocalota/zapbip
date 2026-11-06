# Tester briefing: Install skills

Written by the developer sub-agent when its steps are done. The developer does not run `test-plan.md` and does not declare the feature works.

## Step 0 (959cdd4)

Contract only, no behaviour change. `InstallClient` (ten clients), `WakeMode` and `WakeRung` copied from scheduled-wake, install constants and `AGENT_RULES` are real; the install section renderers, `renderInstallPage`, `pickStandbyAgent`, `readInitializeClientName` and `createInstallPageRoute` throw `… is not implemented`. Nothing is tested yet.

## What changed

- <file or module> — <one line>

## How to run

```bash
<commands to start the stack and open the feature>
```

## Red today, green after

| Test | Red before the change because | Green after because |
|------|--------------------------------|---------------------|
| `<path>::<name>` |  |  |

## Hypotheses to attack

Every "it works" is a hypothesis the tester tries to break.

1. Hypothesis: <claim>. Break it by: <suggested attack>.

## Known gaps

- <what the developer knows is missing or untested>
