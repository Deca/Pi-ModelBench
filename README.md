# Pi ModelBench

Exploratory, deterministic-first model benchmarking as a Pi extension package.

ModelBench deliberately reuses Pi's model registry and provider adapters. It does **not** maintain a provider catalog, credentials, or model pricing independently. The selected model metadata is snapshotted into each result so runs remain auditable when providers update their models.

## Install for local development

From this repository:

```bash
npm install
pi -e ./src/extension.ts
```

To install as a Pi package after publishing or from Git:

```bash
pi install ./path/to/modelBench
# or
pi install git:github.com/you/pi-modelbench@main
```

## Commands

```text
/benchmark profiles
/benchmark models
/benchmark coding --models openai/gpt-5.6,anthropic/claude-sonnet-4-5 --runs 3
/benchmark reasoning --models openai/gpt-5.6:high --format json
/benchmark report <run-id>
```

If `--models` is omitted, the currently selected Pi model is used. Runs are sequential by design. JSON and Markdown artifacts are saved to `.pi/modelbench/runs/`.

## Included profiles

- `coding` — debugging, API contracts, complexity, and instruction following
- `reasoning` — independently checkable arithmetic, logic, and constraints
- `structured-data` — JSON extraction, classification, and required fields
- `customer-support` — policy accuracy and clarification behavior
- `writing` — constrained writing with deterministic content checks

Project-specific profiles can be placed in `.pi/modelbench/profiles/*.json`; they override bundled profiles with the same name.

## Methodology

The MVP follows the evaluation principles from OpenAI's model guidance:

- use representative task-specific cases rather than generic scores;
- include normal and edge-oriented tasks in profiles;
- keep prompts and settings identical across models;
- repeat each task to expose variability;
- report quality, latency, tokens, cost, and errors together;
- use deterministic graders first and retain raw outputs for inspection;
- run sequentially to make ordering, retries, and rate limits auditable.

The current MVP is single-turn and text-only. It does not yet benchmark tool selection, repository changes, executable code patches, multi-turn workflows, vision, or LLM-as-a-judge scoring. Those should be added as separate profile/task types rather than weakening deterministic results.

## Development

```bash
npm run typecheck
npm test
npm run build
```
