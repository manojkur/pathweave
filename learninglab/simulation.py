"""A deliberately explicit toy model, never an uncontaminated human-like LLM."""

import math
import random
import statistics
from dataclasses import dataclass, field


@dataclass
class MemoryLearner:
    capacity: int = 4
    decay: float = 0.35
    chunks: dict = field(default_factory=dict)
    working: list = field(default_factory=list)
    tick: float = 1

    def activation(self, key):
        traces = self.chunks.get(key, [])
        return sum((max(1, self.tick - t)) ** (-self.decay) for t in traces)

    def retrieve(self, cues):
        # Only relevant stored chunks enter the working buffer. Not the entire archive.
        ranked = sorted(
            (key for key in cues if key in self.chunks), key=lambda key: (-self.activation(key), key)
        )
        self.working = ranked[: self.capacity]
        return list(self.working)

    def study(self, concept, prerequisites):
        self.tick += 1
        active = self.retrieve(prerequisites)
        readiness = sum(min(1, self.activation(p) / 2) for p in active) / max(1, len(prerequisites))
        gain = 0.3 + 0.7 * readiness if prerequisites else 1.0
        # Reinforcement adds a trace; a fractional trace modulates strength by exposure time.
        self.chunks.setdefault(concept, []).append(self.tick - (1 / gain - 1))
        self.retrieve([concept, *prerequisites])

    def probability(self, concept):
        return 1 - math.exp(-self.activation(concept) / 2)


def experiment(snapshot, seeds=24):
    # Identical exposure budget and paired seeds; independent simulated retrieval draws.
    nodes = [n for n in snapshot["concepts"] if n.get("stage", 99) <= 3]
    strategies = ["blocked", "spaced", "random"]
    outcomes = {s: [] for s in strategies}
    for seed in range(seeds):
        for strategy in strategies:
            rng = random.Random(seed)
            learner = MemoryLearner(capacity=3 + seed % 3, decay=0.25 + (seed % 5) * 0.05)
            sequence = [n for n in nodes for _ in range(3)] if strategy == "blocked" else nodes * 3
            if strategy == "random":
                sequence = list(sequence)
                rng.shuffle(sequence)
            for node in sequence:
                learner.study(node["id"], node.get("prerequisites", []))
            learner.tick += 30
            outcomes[strategy].append(
                statistics.mean(int(rng.random() < learner.probability(n["id"])) for n in nodes)
            )
    return {
        "kind": "synthetic",
        "human_efficacy": "not established",
        "warning": "The model encodes spacing and prerequisite assumptions. Results do not independently validate them.",
        "protocol": {
            "paired_seeds": seeds,
            "exposures_per_concept": 3,
            "delay_ticks": 30,
            "working_memory_slots": [3, 4, 5],
            "model": "trace-decay-v1",
        },
        "results": [
            {
                "strategy": strategy,
                "mean": statistics.mean(values),
                "sd_across_seeds": statistics.stdev(values),
                "n": len(values),
            }
            for strategy, values in outcomes.items()
        ],
    }
