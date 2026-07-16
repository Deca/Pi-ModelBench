# ModelBench Context

## Domain glossary

- **Model** — a provider-qualified model selected from Pi's model registry; its provider, model ID, API type, limits, and pricing are captured in a run snapshot.
- **Profile** — a named benchmark configuration for a usage sector, including defaults and a task set.
- **Task** — one fixed prompt and grading rule within a profile.
- **Attempt** — one execution of one task against one model. Repeated attempts expose output variability.
- **Grader** — a deterministic rule that maps one model output to a pass/fail result and score.
- **Run** — one complete execution of a profile against one or more models, producing raw attempts and aggregate summaries.
- **Runner** — the adapter at the model execution seam. The initial runner delegates to Pi's provider registry.

## Current scope

ModelBench is an exploratory Pi package. It benchmarks single-turn text responses and prioritizes reproducible, inspectable measurements over broad provider-specific feature coverage.
