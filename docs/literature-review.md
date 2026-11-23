# Initial evidence review

Status: initial scoping review, 2026-11-23. This is not a systematic review and does not represent full reading of every listed book or paper.

The machine-readable register is [sources.json](../learninglab/data/sources.json). Every card records the actual inspection depth, a design implication, and a limitation. The larger review must use authorized full texts in the connected private library; only bibliographic metadata and original review notes appropriate for public distribution belong here.

## Decisions supported so far

| Question | Relevant evidence | Decision | Remaining uncertainty |
|---|---|---|---|
| How much should a novice solve without support? | [IES practice guide](https://ies.ed.gov/ncee/wwc/PracticeGuide/1), [Sweller](https://doi.org/10.1207/s15516709cog1202_4) | Combine examples, small steps, self-explanation, and fading support | The right timing and amount depend on expertise and task |
| How should a learner model memory? | [ACT-R overview](https://act-r.psy.cmu.edu/about/), [source-activation model](https://pmc.ncbi.nlm.nih.gov/articles/PMC2597812/) | Separate storage, retrieval, and working buffers; expose parameters | A trace-decay baseline is not a calibrated cognitive architecture |
| How should tutoring success be measured? | [Bastani et al.](https://doi.org/10.1073/pnas.2422633122) | Separate assisted practice from later unassisted outcomes | The study does not establish effectiveness of this product |
| How should proof learning be assessed? | [Melhuish et al.](https://doi.org/10.1016/j.jmathb.2022.100986), [Chen et al. preprint](https://arxiv.org/abs/2509.16778) | Distinguish comprehension, construction, transfer, and independent verification | Automated proof feedback and durable proof learning are different outcomes |
| What does a correct-answer predictor tell us? | [Knowledge Tracing survey](https://arxiv.org/abs/2201.06953) | Start with a transparent evidence baseline and uncertainty | Predictive performance does not identify causal learning interventions |
| How can textbook sequences be compared? | [Axler](https://linear.axler.net/), [Strang](https://ocw.mit.edu/courses/18-06-linear-algebra-spring-2010/), [Lebl](https://www.jirka.org/diffyqs/) | Compare objectives, order, representations, proof burden, and exercises | No overall textbook ranking follows from contents inspection |
| How should visuals be produced? | [Manim](https://docs.manim.community/en/stable/), [Motion Canvas](https://motioncanvas.io/docs/), [Penrose](https://penrose.cs.cmu.edu/docs/ref/using) | Use inspectable original scenes and separate meaning from visual style | Rendering capability does not demonstrate narrative or learning quality |

These decisions are design inferences, not direct replications of the cited interventions.

## Textbook review matrix to expand

The initial register spans foundations, discrete mathematics, proofs, linear algebra, calculus, ODEs, real analysis, elementary and advanced probability, topology, and category theory. Future review needs substantially more coverage: abstract algebra, measure/integration, functional and complex analysis, geometry, PDEs, optimization, numerical analysis, statistics, logic, and current specialist research.

For each edition and proposed chapter path, inspect motivation, examples/nonexamples, representations, hidden prerequisites, quantifier demands, proof scaffolding, exercise progression, numerical experiments, cross-field connections, accessibility, and source rights. Record page/section anchors and counterevidence. Do not equate a famous book, an open book, or an appealing explanation with empirical superiority.

## Review workflow

1. Search multiple primary-source channels, recording query, date, inclusion rule, and exclusions.
2. Deduplicate by DOI, arXiv identity/version, or ISBN/edition. Preserve version provenance.
3. Separate metadata screening, abstract review, targeted section review, and full-text critical appraisal.
4. Extract population, task, intervention, comparator, outcome, assessment delay, assistance access, sample size, uncertainty, attrition, and limitations.
5. Link every architectural recommendation to evidence and identify when it is an untested inference.
6. Publish only appropriate original summaries and bibliographic references. Keep source files in authorized external storage.
7. Review disagreements and negative/null findings before changing a release.

Current background research performs only step 1 for a narrow arXiv query. Full-text appraisal, broad retrieval, independent screening, and expert synthesis are not automated yet.
