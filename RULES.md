# RULES.md - Borrower Copilot Business Rules

Every threshold, band, and assumption the app uses is listed here. `rules.js` is a
structured mirror of this table - the Rules Engine never hardcodes a number that
isn't a row below. If you want to change how the app behaves, change it here first,
then update `rules.js` to match; nothing else needs to change.

Legend for **Source**: a cited public/industry norm, or **"my judgement"** where no
single public figure exists and a defensible call had to be made for this build.

## FOIR (Fixed Obligations to Income Ratio)

| What | Value | Why | Source |
|---|---|---|---|
| Sanction FOIR - salaried | 55% | Typical upper bound Indian lenders use for salaried unsecured eligibility | my judgement, consistent with common personal-loan FOIR norms (50-55%) |
| Sanction FOIR - self-employed | 50% | Lenders apply a slightly tighter cap for less-verifiable income | my judgement |
| Sanction FOIR - informal | 40% | No documentation means formal lenders cap much lower even at "sanction" level | my judgement |
| Safe FOIR - salaried | 40% | The safe-carry ceiling should sit meaningfully below what a lender would sanction, per FR-O2 | my judgement |
| Safe FOIR - self-employed | 35% | Income volatility warrants a stricter self-imposed ceiling | my judgement |
| Safe FOIR - informal | 30% | Highest income uncertainty and highest debt-stress risk segment | my judgement |
| Safe buffer factor | 0.90 | An additional 10% margin below the computed safe ceiling, so "safe" isn't a knife-edge number | my judgement |

## Interest rate bands (annual %, before credit-score/collateral adjustment)

| Loan type | Band | Source |
|---|---|---|
| Personal | 11% – 24% | my judgement, broadly consistent with public Indian personal-loan rate ranges |
| Home | 8.5% – 11% | my judgement, consistent with public Indian home-loan rate ranges |
| LAP (Loan Against Property) | 9.5% – 13% | my judgement |
| Gold | 9% – 15% | my judgement |
| Two-wheeler | 10% – 18% | my judgement |
| Business | 12% – 20% | my judgement |
| Secured-routing override band | 8.5% – 12% | Applied instead of the loan-type band when a borrower is routed to secured-product reasoning (see below) | my judgement |

## Credit-score adjustment to the rate band

| What | Value | Why | Source |
|---|---|---|---|
| Score ≥ 750 | Band narrows to [low, low + 40% of span] | Strong score narrows toward the favourable end | my judgement |
| 650 ≤ Score < 750 | Band narrows to [low + 20% of span, low + 70% of span] | Middling score, middling band | my judgement |
| Score < 650 | Band narrows to [low + 50% of span, high] | Weak score shifts toward the costly end | my judgement |
| Score unknown | Full, unmodified band | FR-Q6 - unknown must never be silently treated as worst-case | Confirmed requirement, FR-Q6 |

## Fees and APR

| What | Value | Why | Source |
|---|---|---|---|
| Processing fee | 2% one-time | Representative Indian lender processing-fee level | my judgement |
| APR approximation | rate + processingFeePct / tenureYears | Simple amortised-fee-into-annual-rate approximation, consistent with the RBI all-in-cost disclosure intent | my judgement (simplified - not a full XIRR calculation) |

## Default tenures (years), used for EMI/amount conversion and the tenure trade-off

| Loan type | Default tenure |
|---|---|
| Personal | 5 |
| Home | 20 |
| LAP | 15 |
| Gold | 3 |
| Two-wheeler | 5 |
| Business | 7 |

Tenure trade-off is shown at `default - 2 years` (minimum 1) and `default + 3 years`.

## Collateral / secured routing

| What | Value | Why | Source |
|---|---|---|---|
| Collateral routing minimum ratio | 1.0× amount wanted | A borrower whose unencumbered collateral covers at least the amount requested is routed to secured-product reasoning instead of unsecured high-risk assessment (§6.3 collateral routing) | my judgement |
| Segments eligible for routing | self-employed, informal | Salaried borrowers are assumed to already have near-verifiable income and don't need collateral to prove creditworthiness | my judgement |

## Self-employed income uncertainty

| What | Value | Why | Source |
|---|---|---|---|
| Blend weights | 40% documented income, 60% estimated cash income | Declared/ITR income that understates true cash flow is blended upward rather than capped at the lower figure, per §6.3 | my judgement |
| Trigger condition | Only applied when the borrower's stated cash-income estimate exceeds documented net income | Otherwise there's nothing to blend | - |

## Stress scenario (FR-O4)

| What | Value | Why | Source |
|---|---|---|---|
| Income-drop stress test | 20% income drop | A single, clearly-labelled stress case as required by FR-O4; 20% is a round, defensible shock size for a household budget | my judgement |

## Plausibility bounds (FR-Q7)

| What | Value | Why | Source |
|---|---|---|---|
| Lendable age range | 21 – 65 | Standard Indian lending age eligibility window | my judgement, consistent with common lender age bands |
| Existing EMI ≥ net income | Flagged, not blocked | FR-Q7 requires confirm-or-correct, not silent rejection | Confirmed requirement, FR-Q7 |
| Net income ≤ 0 | Flagged | Cannot compute any FOIR-based output from non-positive income | - |
| Amount wanted ≤ 0 | Flagged | Nothing to assess | - |

## Confidence tiers (§5.5)

| What | Value | Why | Source |
|---|---|---|---|
| Ratio for "High" tier | ≥ 80% of applicable additional questions answered | "Substantially all applicable additional questions" per §5.5 | my judgement interpreting §5.5 |
| Max range-widening (Low, ratio = 0) | ±25% | Widest defensible range on must-set-only answers | my judgement |
| Min range-widening floor (High, ratio = 1) | ±5% | A range must never collapse to a false point (FR-E3), even at highest confidence | my judgement |
| Widening formula | `max(minWidenPct, maxWidenPct × (1 − ratio))` | Monotonically decreasing in ratio ⇒ answering more never narrows a range that answering less already widened only in one direction - an unanswered question can never make it narrower (FR-Q5) | - |

## Verdict rule (§6.3 "high-cost existing debt / bounce history")

| What | Value | Why | Source |
|---|---|---|---|
| Severe stress trigger | ≥1 bounce in last 6 months **and** existing high-cost debt > 0 | Combination of recent bounce plus existing high-cost debt is the strongest available signal of debt distress from self-reported data alone | my judgement, modelling Anita's persona (§4.2) |
| "Don't borrow" threshold under severe stress | Safe-carry amount < 30% of amount wanted | Distinguishes "don't borrow at all" from "borrow much less" as both being reachable under stress, per §6.3 | my judgement |
| Debt-stress discount on safe-carry ceiling | ×0.5 | Applied directly to the safe EMI ceiling (not just mentioned in the verdict sentence) once severe stress is detected, so O2/O4 and the verdict stay numerically consistent | my judgement |
| Discretionary purposes | Wedding/discretionary, Other discretionary | Used only to shape the explanation sentence (§6.3 "discretionary vs productive"), never to block a verdict on its own | my judgement |

## What this build does *not* know

- Real-world FOIR/rate norms vary by lender, city tier, and season; the bands above are **illustrative defaults for a self-assessment tool**, not a specific lender's actual policy.
- APR here is a simplified fee-amortisation approximation, not a full effective-interest-rate (XIRR) calculation.
- All figures depend entirely on borrower self-report; there is no bureau or income verification (by design - see the requirements' §3.1 and NFR-1).
