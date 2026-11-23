# Research agenda and pilot protocol

Status: proposed human-study protocol and implemented synthetic baseline, 2026-11-23. No human efficacy result is claimed.

## Main question

Can a curriculum that explicitly connects representations and scaffolds proof construction improve delayed independent reasoning compared with a conventional sequence, at a matched learning-time budget?

Start with a bounded ODE/linear-algebra bridge or the transition to proof. Do not start by claiming to optimize all of mathematics.

## Preregister a human pilot before recruitment

Define the target population and prior-knowledge assessment. Use objective-matched content and equal opportunity/time budgets across arms. Randomize at a level that controls contamination; record instructor/class clustering where relevant. Compare a fixed conventional sequence, a fixed connected sequence, and an adaptive sequence only if the available sample can support those comparisons.

Primary outcome: blind-rubric scoring on previously unseen independent reasoning tasks after a meaningful delay, with assistance removed. Secondary outcomes: immediate learning, later retention, transfer, proof-error detection, calibration, time, help use, and self-reported task burden. Separate subjective comfort from measured learning. Include accessibility and adverse experience reporting without diagnosing learners.

Choose sample size by a prospective power or precision analysis; specify exclusions, attrition handling, randomization, scoring reliability, multiplicity, effect intervals, and stopping rules before examining outcomes. Record negative and null outcomes. Obtain appropriate consent and institutional review where applicable before running a study with people.

## Synthetic discovery stage

The implemented simulator starts with empty trace memory and exposes memory capacity, decay, reinforcement, and prerequisite-readiness assumptions. It compares blocked, spaced, and random exposure schedules across 24 paired seeds, using equal exposures and a delayed retrieval evaluation. Output includes variability across seeds, model parameters, and a prominent warning that the encoded assumptions influence the result.

It does not perform semantic proof search, learn mathematical representations from scratch, or validate human behavior. Simulated learners cannot rank human curricula without empirical calibration. Future models should include alternative architectures, parameter-recovery checks, held-out human traces, sensitivity analysis, and comparison against simple baselines.

## AI contamination and evaluation

Prompting a pretrained model to know no mathematics does not remove its prior knowledge. Any LLM learner experiments must document training contamination limits and distinguish context conditioning from persistent learning. Use generated held-out tasks with mathematically checked answers, adversarial counterexamples, and new representation/transfer demands. Keep evaluators and curriculum-generation feedback separate from held-out evaluation tasks.

A model evaluator's agreement with another model is not proof correctness or human understanding. Use expert rubrics, disagreement review, and optional formal checking. Formal proof verification establishes a statement under its formal assumptions, not that the learner independently understands or discovered it.

## Diagnostic validation

The current concept checks are intentionally narrow. Before interpreting scores as a multi-dimensional profile, build evidence for item validity, difficulty, guess/slip behavior, reliability, representation effects, uncertainty calibration, and transfer. Evaluate spoken and written explanations without treating verbal fluency or confidence as ability.

## Visual narrative experiments

Compare the same content with and without a visualization, manipulation, narration, and precise formal step. Test whether a learner can predict a new case and explain a failure of the picture. Evaluate accessibility and reduced-motion alternatives. A pleasing animation or engagement increase alone is insufficient evidence of improved mathematical reasoning.
