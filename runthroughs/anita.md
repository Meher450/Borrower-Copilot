# Run-through - Anita, 35, Hubballi, informal income

**Ask:** ₹1,50,000 for an electric scooter (income-generating asset).

## Questions asked (must set)

| Question | Answer |
|---|---|
| Purpose | Income-generating asset |
| Amount wanted | ₹1,50,000 |
| Loan type | Two-wheeler |
| Income type | Informal/Gig/Cash |
| Net monthly income | ₹28,000 |
| Existing EMIs | ₹0 (no formal EMIs - the app loans below are additional debt, not shown as "EMI") |
| Household expenses | ₹22,000 |
| Age | 35 |
| Credit score | Don't know |

Segment resolved: **informal**.

## Additional questions answered (3 of 8 applicable - Medium confidence)

| Question | Answer |
|---|---|
| Bounces in last 6 months | 1 |
| Outstanding high-cost debt (app loans) | ₹35,000 |
| Years of stable income history | 3 |

## Outputs (Medium confidence, 3/8 answered)

| Output | Result |
|---|---|
| **O1 - Verdict** | **Borrow less.** "Recent bounces and existing high-cost debt mean you can safely carry about ₹1,16,038, well below the ₹1,50,000 you asked for." |
| **O2 - Maximum amount** | Lender sanction: ₹4,06,133 – ₹5,56,552 · Safe to carry: ₹97,907 – ₹1,34,169. Rely on the safe-carry figure - it is materially below what a lender's formal eligibility math alone would show. |
| **O3 - Fair rate** | 8.75% – 19.25%, all-in APR ≈ 14.71% |
| **O4 - EMI ceiling** | ₹2,278 – ₹3,122/month. Tenure trade-off: 3y → ₹5,127/mo, 8y → ₹2,606/mo. Stress test (20% income drop): **ceiling would be breached.** |

## How the key domain challenge was handled

This is the persona the requirements single out as needing "Don't borrow" or "borrow much less" to be a *reachable* outcome despite a productive-sounding purpose (§4.2, §6.3). The must-set-only run (below) actually produces "Borrow" - Anita's raw FOIR math is fine on income and expenses alone. It is specifically the **bounce history + existing high-cost debt** - signals only surfaced by the two additional questions she answered - that flip the verdict to "Borrow less" and cut her safe-carry ceiling by half (`debtStressDiscount` in `RULES.md`). This is the single clearest demonstration in the three personas of why FR-Q2/FR-Q3 additional questions exist: without them, a borrower in real debt distress would be told "Borrow."

## Negotiation Card

> **Borrow less** - Recent bounces and existing high-cost debt mean you can safely carry about ₹1,16,038, well below the ₹1,50,000 you asked for.
> Safe to carry: ₹97,907 – ₹1,34,169 (a lender may offer more - rely on this figure, not the sanction figure).
> Fair for your profile: 8.75%–19.25% (all-in APR ≈ 14.71%).
> Don't exceed ₹3,122/month. Stress test (20% income drop): would be breached.
> Confidence: Medium
> Self-assessment only - not a loan offer. Generated [run date].

## What the must-set-only run showed (Low confidence, for comparison)

Verdict: **Borrow** (not "Borrow less") - safe-carry ₹1,74,057–₹2,90,095, comfortably above the ₹1,50,000 ask, stress test holds. This is the intended contrast: it demonstrates that the must-set alone is *not* enough to catch Anita's real debt stress, and that the additional bounce/high-cost-debt questions are exactly the ones that must be asked for an informal-income borrower (§5.3.1) - not optional flourishes.
