# Personal Coding Benchmark — Implementation Plan

## Purpose

Build the smallest useful benchmark for choosing between model configurations in one real workflow: software development.

The benchmark should answer:

> For the coding tasks I actually perform, which model configuration gives the best quality/cost/latency trade-off?

A configuration is:

```text
provider + model + reasoning level + request settings
```

Example:

```text
openai-codex/gpt-5.6-luna:low
openai-codex/gpt-5.6-sol:high
```

This is a personal decision-support tool, not an academic leaderboard or a universal intelligence score.

## Scope

### Included

- One profile: `coding-personal`.
- Six to ten representative coding tasks.
- Independent reasoning levels per model configuration.
- Clean task fixtures.
- Deterministic grading wherever possible.
- Isolated execution for tasks that modify files.
- JSON artifact and rich HTML report.
- Main Pi transcript summary.
- Quality, reliability, latency, token, and total-cost metrics.

### Explicitly excluded

- Customer-support, writing, document-QA, and security profiles.
- Reproducing OpenAI or academic benchmark suites.
- Universal model rankings.
- Multi-agent benchmarking.
- LLM-as-a-judge as the default grader.
- Human-review workflow in the first version.
- Benchmarking against the user's real repositories.
- Concurrent execution.

## Success criteria

The benchmark is useful when it can show, for each configuration:

- which tasks passed and failed;
- whether the failure was a model failure or grader failure;
- the number of verification tests passed;
- latency and output-token behavior;
- total benchmark cost;
- enough per-task evidence to explain why two configurations differ.

A single aggregate score is not sufficient. The report must preserve the task matrix and raw outputs.

## Benchmark task design

Use tasks from real personal coding work, simplified into isolated fixtures. Do not begin with generic trivia or tasks that both strong models solve immediately.

Recommended first task set:

| ID | Task shape | Example capability |
| --- | --- | --- |
| `bug-edge-case` | Fix a bug with a non-obvious boundary condition | Debugging and edge-case reasoning |
| `api-change` | Add a small API feature across types, implementation, and tests | Multi-file consistency |
| `regression-test` | Fix a defect and add a test that prevents recurrence | Testing judgment |
| `refactor-contract` | Refactor internals without changing public behavior | Contract preservation |
| `validation` | Add input validation and structured errors | Requirements and defensive coding |
| `async-failure` | Fix a race, retry, or cancellation issue | Concurrency reasoning |
| `performance` | Remove a measurable avoidable inefficiency | Algorithmic and practical reasoning |
| `code-review` | Identify concrete defects in a small change | Review precision |

Start with six tasks. Add the remaining tasks only after the first results reveal gaps.

Each task should have:

```text
fixtures/coding-personal/<task-id>/
├── repository/       # clean starting repository
├── task.json         # task prompt, tags, difficulty, verification command
└── verify/           # tests or verification scripts
```

The fixture must be self-contained and safe to copy to a temporary directory.

## Task definition

Initial task shape:

```json
{
  "id": "bug-edge-case",
  "title": "Fix pagination when the item count is an exact multiple",
  "prompt": "Fix the pagination bug. Preserve the public API and add a regression test.",
  "tags": ["debugging", "edge-case", "testing"],
  "difficulty": "medium",
  "workingDirectory": "repository",
  "verification": {
    "command": "npm test -- --runInBand",
    "timeoutMs": 120000
  }
}
```

The prompt must state the goal and constraints, but must not reveal hidden-test implementation details.

## Execution model

### Phase 1 — deterministic text tasks

Use the existing single-turn runner for tasks that only require an answer or a small generated artifact. Keep this phase optional and limited; it is not expected to distinguish strong coding models reliably.

### Phase 2 — fixture coding tasks

Implement an isolated coding runner:

1. Create a temporary workspace.
2. Copy the fixture repository into the workspace.
3. Start a fresh Pi session for the selected model configuration.
4. Enable only the tools required by the task: `read`, `bash`, `edit`, and `write`.
5. Send the task prompt.
6. Wait for the agent to settle.
7. Run the verification command outside the model.
8. Capture the exit code, output, duration, and tests passed when available.
9. Capture the diff and changed-file list.
10. Delete the temporary workspace.

Every model configuration receives a fresh copy of the same fixture.

The user's real repositories must never be modified by the benchmark.

## Grading

### Primary deterministic grade

For coding tasks, the primary result is verification success:

```text
verification passed / verification total
```

A task passes only when the required verification command succeeds. If the test runner exposes individual test counts, record partial progress separately.

### Secondary deterministic signals

- regression tests passed;
- exit code;
- changed files;
- diff size;
- whether files outside the allowed task scope changed;
- final response contains a summary and validation evidence;
- timeout or execution error.

Diff size and changed-file count are diagnostic signals, not quality scores by themselves.

### Subjective grading

Do not add an LLM judge initially. Add one only for dimensions that cannot be checked by tests, such as maintainability or explanation quality. If introduced later, use it as a separate metric and calibrate it against human labels.

## Metrics

### Quality

- task success rate;
- verification tests passed;
- regression-test success;
- per-task pass/fail matrix;
- failure category.

### Reliability

- repeated-attempt consistency;
- timeout rate;
- tool or provider error rate;
- recovery after failed tests.

When `runs: 1`, consistency must be reported as `N/A`, not `100%`.

### Performance

- mean latency;
- p50 latency;
- p95 latency;
- total model/tool turns;
- input and output tokens;
- output tokens per second.

### Economics

- total benchmark cost as the primary displayed cost;
- cost per successful task as an optional diagnostic;
- per-attempt cost retained in JSON for auditability.

### Configuration comparison

The report must identify each configuration clearly:

```text
C1 = openai-codex/gpt-5.6-luna:low
C2 = openai-codex/gpt-5.6-sol:high
```

Do not merge configurations that share a model but use different reasoning levels.

## Report requirements

### Pi main transcript

Show a compact table with short configuration IDs:

```text
Cfg | Tasks | Tests | Pass | Stable | Mean/P95 ms | Out tok/s | Errors
```

Show the full configuration legend below the table.

Show one total benchmark cost below the table:

```text
Total bench cost: $...
```

### HTML artifact

Save:

```text
.pi/modelbench/runs/<run-id>.json
.pi/modelbench/runs/<run-id>.html
```

The HTML report should contain:

1. benchmark metadata;
2. configuration comparison;
3. per-task capability matrix;
4. verification-test results;
5. performance metrics;
6. total benchmark cost;
7. expandable raw attempts, outputs, and errors;
8. changed-file and diff summaries.

## Implementation milestones

### Milestone 1 — fixture seam

- Add `coding-personal` profile loading.
- Add fixture directory conventions.
- Add task validation.
- Add tests for loading and validating a fixture.

### Milestone 2 — isolated workspace

- Implement temporary fixture copy.
- Ensure cleanup happens on success, failure, timeout, and cancellation.
- Add a fake runner integration test.

### Milestone 3 — Pi coding runner

- Use Pi SDK sessions rather than direct single-turn completion.
- Resolve each model configuration independently.
- Enable task-specific tools.
- Capture agent messages, tool turns, and final response.

### Milestone 4 — executable grader

- Run verification commands outside the model.
- Capture exit status and output.
- Parse common test-runner summaries where practical.
- Add timeout and process cleanup.

### Milestone 5 — reporting

- Add task/test metrics to JSON.
- Add compact main-area table.
- Add rich HTML task and attempt sections.
- Keep total cost prominent and avoid wide tables in Pi's transcript.

### Milestone 6 — first real benchmark

- Add six personal tasks.
- Run at least two configurations with `runs: 2` or `runs: 3`.
- Manually inspect every failure.
- Fix task or grader defects before interpreting model differences.

## Testing seams

Test through these public seams:

1. **Fixture loader** — valid and invalid task definitions.
2. **Workspace runner** — clean copy, verification execution, cleanup.
3. **Benchmark engine** — independent model configurations and stable ordering.
4. **Deterministic grader** — verification outcomes and failure categories.
5. **Report renderer** — total cost, per-configuration rows, task matrix, and raw attempt sections.

Tests must use fake model runners and fake verification commands unless a deliberate manual live run is being performed.

## First-session checklist

In the next session:

1. Read this plan and `CONTEXT.md`.
2. Inspect the existing benchmark engine and report types.
3. Confirm whether the first fixture language should be TypeScript or Python.
4. Create one fixture: `bug-edge-case`.
5. Add a fake verification runner test first.
6. Implement one end-to-end vertical slice.
7. Run it against two model configurations manually only after the fake path works.

## Decision rule

Do not add another profile or metric until a real personal task demonstrates that the current benchmark cannot answer a concrete model-selection question.
