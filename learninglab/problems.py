"""Seeded original tasks, answer keys kept server-side, explicit proof rubrics."""

import math
import random

GENERATED = {
    "fractions",
    "algebra",
    "functions",
    "derivatives",
    "vectors",
    "linear-maps",
    "eigenvalues",
    "probability",
    "ode-growth",
    "logic",
    "sequences",
}


def make_problem(concept, seed, dimension="intuition"):
    rng = random.Random(seed)
    a, b = rng.randint(2, 7), rng.randint(2, 8)
    if concept == "fractions":
        prompt, answer, wrong = (
            f"What is {a}/{a * b} as a simplified fraction?",
            f"1/{b}",
            [f"1/{a}", f"{a}/{b}", f"1/{a + b}"],
        )
        reason = "Divide numerator and denominator by the same nonzero number. The amount stays the same."
    elif concept == "algebra":
        prompt, answer, wrong = (
            f"Solve {a}x + {b} = {a * a + b}.",
            str(a),
            [str(a + 1), str(a - 1), str(b + a)],
        )
        reason = f"Subtract {b} from both sides, then divide both sides by {a}."
    elif concept == "functions":
        prompt, answer, wrong = (
            f"A machine maps x to {a}x + {b}. Where does 2 go?",
            str(2 * a + b),
            [str(a + b), str(2 * (a + b)), str(a * b)],
        )
        reason = (
            "A function assigns one output to each allowed input. Substitute the input before simplifying."
        )
    elif concept == "derivatives":
        prompt, answer, wrong = (
            f"For f(x) = x², what is the instantaneous rate at x = {a}?",
            str(2 * a),
            [str(a * a), str(a), str(2 * a + 1)],
        )
        reason = f"The difference quotient is 2x + h. As h approaches zero, this approaches 2x = {2 * a}."
    elif concept in {"vectors", "linear-maps"}:
        prompt, answer, wrong = (
            f"T(x,y) = ({a}x, {b}y). What is T(1,2)?",
            f"({a}, {2 * b})",
            [f"({2 * a}, {b})", f"({a + 1}, {b + 2})", f"({b}, {2 * a})"],
        )
        reason = (
            "Apply the rule to both coordinates. A linear map preserves addition and scalar multiplication."
        )
    elif concept == "eigenvalues":
        prompt, answer, wrong = (
            f"T(x,y)=({a}x,{b}y). By what factor is the horizontal vector (1,0) scaled?",
            str(a),
            [str(b), "0", str(a + b)],
        )
        reason = f"T(1,0)=({a},0)={a}(1,0). The direction is unchanged; the scale is the eigenvalue."
    elif concept == "probability":
        prompt, answer, wrong = (
            f"A bag has {a} blue and {b} gold counters. A uniformly random counter is drawn. P(blue)?",
            f"{a}/{a + b}",
            [f"{a}/{b}", f"{b}/{a + b}", f"1/{a + b}"],
        )
        reason = "For equally likely counters, probability is favorable outcomes divided by all outcomes."
    elif concept == "ode-growth":
        prompt, answer, wrong = (
            f"x′ = {a}x and x(0) = {b}. What is the slope at time zero?",
            str(a * b),
            [str(a + b), str(a), str(b)],
        )
        reason = "The equation supplies a local rate. Insert the current state x(0) into the right-hand side."
    elif concept == "logic":
        prompt, answer, wrong = (
            "Negate: for every real x, there exists a real y with y > x.",
            "There exists a real x such that every real y satisfies y ≤ x.",
            [
                "For every real x, every real y satisfies y ≤ x.",
                "There exists a real y greater than every real x.",
                "For every real x, there exists a real y with y ≤ x.",
            ],
        )
        reason = "Negating swaps each universal/existential quantifier, keeping its order, and negates the predicate."
    elif concept == "sequences":
        prompt, answer, wrong = (
            f"For aₙ = 1/n, choose N so n > N implies |aₙ| < 1/{a}.",
            str(a),
            ["0", "1", str(a - 1)],
        )
        reason = f"n > {a} implies 1/n < 1/{a}. The bound must work for every index beyond N."
    else:
        raise ValueError("No validated problem family for this concept yet")
    if dimension == "proof":
        return {
            "concept": concept,
            "dimension": "proof",
            "kind": "proof",
            "prompt": "Explain and justify the general rule behind this example: " + prompt,
            "rubric": [
                "State the claim and its domain precisely",
                "Use definitions and justify every inference",
                "Explain why the reasoning covers all cases in the claim",
                "Test assumptions and boundary cases",
            ],
            "reason": reason,
            "answer": None,
        }
    choices = list(dict.fromkeys([answer, *wrong]))
    rng.shuffle(choices)
    return {
        "concept": concept,
        "dimension": dimension,
        "kind": "choice",
        "prompt": prompt,
        "choices": choices,
        "answer": answer,
        "reason": reason,
    }


def update_skill(profile, concept, dimension, correct, assisted):
    # Simple interpretable Beta evidence model, NOT a validated psychometric test.
    profile.setdefault("skills", {})
    old = profile["skills"].setdefault(concept, {}).get(dimension, {})
    alpha, beta = old.get("alpha", 1.0), old.get("beta", 1.0)
    weight = 0.25 if assisted else 1.0
    alpha += weight if correct else 0
    beta += 0 if correct else weight
    n = alpha + beta
    mean = alpha / n
    sd = math.sqrt(alpha * beta / (n * n * (n + 1)))
    result = {
        "alpha": alpha,
        "beta": beta,
        "mean": mean,
        "interval": [max(0, mean - 1.96 * sd), min(1, mean + 1.96 * sd)],
        "observations": old.get("observations", 0) + 1,
        "assisted": old.get("assisted", 0) + int(assisted),
        "interpretation": "Prototype evidence estimate; interval is a normal approximation, not a mastery certificate",
    }
    profile["skills"][concept][dimension] = result
    return result
