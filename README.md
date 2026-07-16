# Pi ModelBench

Pi ModelBench is an exploratory Pi extension for comparing language models against repeatable, usage-oriented benchmark profiles.

It helps answer questions such as:

- Which model is most reliable for coding tasks?
- Does a higher reasoning level improve quality enough to justify its cost and latency?
- Which model gives the best balance of quality, speed, and token usage for a specific sector?

ModelBench is **not** an academic leaderboard. It evaluates the models and tasks that matter to your workflow.

## Design goals

ModelBench follows a deterministic-first evaluation approach:

- use representative, task-specific prompts instead of generic scores;
- run the same tasks and settings against every selected model;
- repeat tasks to expose variability;
- use deterministic graders wherever possible;
- measure quality, latency, tokens, cost, and errors together;
- preserve raw outputs and model metadata for auditability;
- keep provider integrations in Pi instead of maintaining a second provider catalog.

The package reuses Pi's model registry, authentication, provider adapters, model discovery, and pricing metadata. It does not maintain provider integrations or a separate model catalog.

## Installation

### Run from a local checkout

```bash
npm install
pi -e ./src/extension.ts
```

This loads the extension for the current Pi process. It is useful while developing or experimenting with the package.

### Install as a Pi package

From a local path:

```bash
pi install ./path/to/pi-modelbench
```

From Git:

```bash
pi install git:github.com/<owner>/pi-modelbench@main
```

Pi packages can also be installed at project scope with `-l`:

```bash
pi install -l ./path/to/pi-modelbench
```

Review extension source before installing packages. Pi extensions run with the permissions of the current user.

## Authentication and model availability

ModelBench uses the credentials already configured for Pi. Configure provider credentials using Pi's normal mechanisms, such as:

- environment variables;
- Pi's `/login` flow where supported;
- Pi's stored authentication configuration;
- custom provider/model configuration supported by Pi.

Inspect registered models with:

```text
/benchmark models
```

Show only models with configured authentication:

```text
/benchmark models --available
```

Model references use Pi's normal format:

```text
provider/model
provider/model:thinking-level
```

Examples:

```text
openai/gpt-5.6
anthropic/claude-sonnet-4-5
openai/gpt-5.6:high
```

Provider and model names change frequently. ModelBench resolves references through Pi's current registry at runtime and snapshots the selected metadata in each report.

## Commands

All commands are entered inside an interactive Pi session after the extension has been loaded.

### Show help

```text
/benchmark
```

### List profiles

```text
/benchmark profiles
```

### List models

```text
/benchmark models
/benchmark models --available
```

### Run a benchmark

```text
/benchmark <profile> --models <model-list> [options]
```

For example:

```text
/benchmark coding --models openai/gpt-5.6,anthropic/claude-sonnet-4-5 --runs 3
```

If `--models` is omitted, ModelBench benchmarks the model currently selected in Pi:

```text
/benchmark coding --runs 3
```

### Compare reasoning levels

A thinking level can be assigned independently to each model reference:

```text
/benchmark reasoning --models openai/gpt-5.6-luna:low,openai/gpt-5.6-sol:medium --runs 3
```

This creates two benchmark configurations with identical tasks but different reasoning settings. You can also set one shared level explicitly with `--thinking`; an explicit `--thinking` value overrides levels included in model references.

### Read a previous report

```text
/benchmark report <run-id>
```

The command accepts a run ID, a JSON report path, or a relative path to a report.

## Run options

| Option | Description | Default |
| --- | --- | --- |
| `--models <list>` | Comma-separated Pi model references | Current Pi model |
| `--runs <n>` | Number of attempts per model/task pair | Profile default |
| `--thinking <level>` | `off`, `minimal`, `low`, `medium`, `high`, `xhigh`, or `max` | Profile default |
| `--temperature <n>` | Request temperature where supported | Profile default |
| `--max-tokens <n>` | Maximum output tokens | Profile default |
| `--format markdown\|json` | Choose the displayed report format | `markdown` |

Runs execute sequentially. This makes ordering, rate-limit behavior, and failures easier to inspect, although it is slower than parallel execution.

## Included profiles

Profiles are JSON files containing benchmark defaults and tasks.

### `coding`

Software-engineering tasks covering:

- algorithmic complexity;
- debugging diagnosis;
- API contracts and structured output;
- instruction following and scope control.

### `reasoning`

Short problems with independently checkable answers, including:

- arithmetic;
- logic;
- constraint satisfaction.

### `structured-data`

Machine-readable tasks covering:

- JSON extraction;
- classification;
- required fields and schema-like checks.

### `customer-support`

Support tasks covering:

- policy accuracy;
- required facts;
- clarification questions;
- concise responses.

### `writing`

Constrained writing tasks with deterministic checks for required content. These checks are useful signals, but writing quality should also be reviewed by a human or a separate judge.

## Custom profiles

Add project-specific profiles to:

```text
.pi/modelbench/profiles/*.json
```

A project profile with the same `name` as a bundled profile overrides the bundled version.

Minimal example:

```json
{
  "name": "my-domain",
  "description": "Tasks representative of my workflow",
  "defaults": {
    "runs": 3,
    "temperature": 0,
    "maxTokens": 512,
    "reasoning": "low"
  },
  "tasks": [
    {
      "id": "classification",
      "tags": ["domain"],
      "prompt": "Return exactly one of: low, medium, high. Classify this case: ...",
      "grader": {
        "type": "normalized-exact",
        "expected": "medium"
      }
    }
  ]
}
```

Supported deterministic graders:

- `exact` — exact string equality;
- `normalized-exact` — trims, collapses whitespace, and ignores case;
- `contains` — requires every listed string;
- `regex` — regular-expression match;
- `number` — numeric answer within a tolerance;
- `json-exact` — parsed JSON must deeply equal the expected value;
- `json-fields` — selected JSON fields must match;
- `all` — all nested graders must pass.

## Reports and statistics

Each completed run writes two files to:

```text
.pi/modelbench/runs/
```

- `<run-id>.json` — complete machine-readable result, including every prompt, output, grade, usage record, timing measurement, error, and model snapshot;
- `<run-id>.md` — human-readable comparison report.

The run ID is printed in the completion message and shown in the result entry added to Pi's main transcript. Use that ID with `/benchmark report <run-id>`.

In interactive Pi mode, the benchmark summary is printed directly in the main transcript. The saved JSON and Markdown files contain the detailed per-task and per-attempt results.

Reports include:

- pass rate;
- mean grade score;
- mean latency;
- p50 latency;
- p95 latency;
- mean input tokens;
- mean output tokens;
- total reported cost;
- error rate;
- per-task and per-attempt raw results.

Benchmark outputs may contain sensitive prompts or model responses. Keep `.pi/modelbench/runs/` private when tasks contain confidential information.

## Current limitations

The current MVP benchmarks single-turn text responses only. It does not yet benchmark:

- tool selection or tool arguments;
- repository changes or executable coding tasks;
- multi-turn workflows;
- agent handoffs;
- images or other multimodal inputs;
- LLM-as-a-judge or human-review workflows;
- concurrent execution;
- statistical confidence intervals or significance testing.

These capabilities should be added as explicit benchmark modes or task types rather than weakening the deterministic single-turn results.

## Development

```bash
npm install
npm run typecheck
npm test
npm run build
```

The core engine is kept separate from the Pi command layer so it can later support another adapter, such as a portable CLI or a skill wrapper, without changing profiles, graders, statistics, or report generation.
