# Pi ModelBench

Pi ModelBench is an exploratory Pi extension for comparing language models against repeatable, usage-oriented benchmark profiles.

Along some profiles with their correlated benchmarks I've bundled `simplebench` profile that uses the public SimpleBench benchmark from the AI Explained team
The question set to its then adapted to ModelBench deterministic runner
Attribution and the original MIT license are preserved in `profiles/SIMPLEBENCH-NOTICE.txt`.

## Design goals

ModelBench follows a deterministic-first evaluation approach:

- use representative, task-specific prompts instead of generic scores;
- run the same tasks and settings against every selected model;
- repeat tasks to expose variability;
- use deterministic graders wherever possible;
- measure quality, latency, tokens, cost, and errors together;
- preserve raw outputs and model metadata for auditability;
- keep provider integrations in Pi instead of maintaining a second provider catalog.

Modelbench reuses Pi's model registry, authentication, provider adapters, model discovery, and pricing metadata so it's basically zero-conf

## Installation

### Run from a local checkout

```bash
npm install
pi -e ./src/extension.ts
```

This loads the extension for the current Pi process

### Install as a Pi package

From a local path:

```bash
pi install ./path/to/pi-modelbench
```

From Git:

```bash
pi install git:github.com/Deca/Pi-ModelBench@main
```

Pi packages can also be installed at project scope with `-l`:

```bash
pi install -l ./path/to/pi-modelbench
```

## Model availability

 Inspect the Pi available models with:

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

##

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
/benchmark coding-personal --models openai/gpt-5.6 --runs 2
```

If `--models` is omitted ModelBench benchmarks the model currently selected in Pi:

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

| Option                | Description                                                    | Default          |
| --------------------- | -------------------------------------------------------------- | ---------------- |
| `--models <list>`     | Comma-separated Pi model references                            | Current Pi model |
| `--runs <n>`          | Number of attempts per model/task pair                         | Profile default  |
| `--thinking <level>`  | `off`, `minimal`, `low`, `medium`, `high`, `xhigh`, or `max`   | Profile default  |
| `--temperature <n>`   | Request temperature where supported                            | Profile default  |
| `--max-tokens <n>`    | Maximum output tokens                                          | Profile default  |
| `--format html\|json` | Choose the saved report format shown in the completion message | `html`           |

Runs execute sequentially. This makes ordering, rate-limit behavior, and failures easier to inspect, although it is slower than parallel execution

## Included profiles

Profiles are JSON files containing benchmark defaults and tasks

### `coding`

Eight tool-free software-engineering tasks designed to separate models on:

- algorithmic complexity and state tracing;
- debugging and JavaScript language semantics;
- API contracts and backward compatibility;
- boundary-test selection and instruction following.

### `coding-personal`

Three isolated repository tasks covering pagination edge cases, strict configuration validation, and asynchronous retry error paths. Each task receives a fresh fixture copy, the Pi coding tools (`read`, `bash`, `edit`, and `write`), and an external verification command. Results retain changed files, diff summaries, verification output, tool-turn counts, and raw agent messages.

### `simplebench`

A public 10-question multiple-choice reasoning calibration profile derived from [SimpleBench](https://github.com/simple-bench/SimpleBench). It remains unchanged for comparability and uses deterministic answer extraction and exact matching, so it runs through the existing text benchmark engine without Python, Docker, or additional provider dependencies. The source project is MIT-licensed; the bundled profile retains the original question content and attribution.

### `reasoning`

Eight multi-step problems with independently checkable answers, covering:

- arithmetic and modular number theory;
- logic and state tracking;
- probability and graph reasoning;
- constraint satisfaction and subset selection.

### `structured-data`

Six machine-readable tasks covering:

- flat and nested JSON extraction;
- normalization and type conversion;
- classification, ordering, and schema compliance.

### `customer-support`

Five support tasks covering:

- refund-policy boundaries;
- clarification and damaged-order triage;
- account-security boundaries, safe escalation, and concise responses.

### `writing`

Five constrained professional-writing tasks covering release notes, executive summaries, customer delay emails, incident updates, and plain-language rewrites. Deterministic checks verify required facts and wording; human or judge review is still recommended for tone and overall quality.

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
- `<run-id>.html` — rich, browser-readable comparison report with styled tables, task-level results, and expandable raw attempts.

The run ID is printed in the completion message and shown in the result entry added to Pi's main transcript. Use that ID with `/benchmark report <run-id>`.

In interactive Pi mode the benchmark summary is printed directly in the main transcript. The saved JSON and Markdown files contain the detailed per-task and per-attempt results.

Reports include:

- pass rate and mean grade score;
- per-task capability/precision results;
- repeated-attempt consistency/stability;
- mean, p50, and p95 latency;
- mean output tokens per second;
- output tokens per task/question;
- cost per complete benchmark run (`$/run`);
- performance per dollar (`Perf/$`, score percentage divided by `$/run`);
- total input/output tokens;
- total cost and cost per successful attempt;
- error rate;
- expandable per-attempt prompts, outputs, grades, timing, and usage.

## Current limitations

The current MVP does not yet benchmark:

- tool selection or tool arguments as a separate profile;
- multi-turn workflows;
- agent handoffs;
- images or other multimodal inputs;
- LLM-as-a-judge or human-review workflows;
- concurrent execution;
- statistical confidence intervals or significance testing.
