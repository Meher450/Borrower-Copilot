// Borrower Copilot - Rules Engine
// Pure functions only. Every threshold below must have a matching row in RULES.md.
// No UI code, no DOM access, no I/O - this file must be importable by both
// index.html (browser) and test_rules.js (node) unchanged.

(function (root) {
  "use strict";

  var RULES = {
    // FOIR (Fixed Obligations to Income Ratio) ceilings by segment.
    // "sanction" = what a formal lender's eligibility rule would allow.
    // "safe" = what Borrower Copilot recommends the borrower actually carry.
    foir: {
      salaried:      { sanction: 0.55, safe: 0.40 },
      "self-employed": { sanction: 0.50, safe: 0.35 },
      informal:      { sanction: 0.40, safe: 0.30 }
    },
    safeBufferFactor: 0.90, // extra margin applied on top of the safe FOIR ceiling

    // Baseline annual rate bands [low, high] by loan type, before credit-score
    // or collateral adjustment.
    rateBands: {
      Personal:      [11, 24],
      Home:          [8.5, 11],
      LAP:           [9.5, 13],
      Gold:          [9, 15],
      "Two-wheeler": [10, 18],
      Business:      [12, 20]
    },
    securedBand: [8.5, 12], // used when a borrower is routed to secured-product reasoning

    defaultTenureYears: {
      Personal: 5, Home: 20, LAP: 15, Gold: 3, "Two-wheeler": 5, Business: 7
    },

    processingFeePct: 2, // one-time, folded into APR

    // Collateral must cover at least this multiple of the amount wanted to
    // route a borrower toward secured-product reasoning.
    collateralRoutingMinRatio: 1.0,

    // Self-employed borrowers who report a cash income estimate above their
    // documented net income get a blended figure instead of being capped at
    // the lower documented number.
    incomeBlend: { documentedWeight: 0.4, cashWeight: 0.6 },

    stressIncomeDropPct: 20, // FR-O4 stress scenario: model a 20% income drop

    // Applied to the safe-carry EMI ceiling when a borrower shows severe debt
    // stress (recent bounce + existing high-cost debt) - the raw FOIR math
    // alone doesn't capture that risk, so the ceiling is discounted directly
    // rather than only mentioned in the verdict sentence.
    debtStressDiscount: 0.5,

    plausibility: {
      minAge: 21,
      maxAge: 65
    },

    // Confidence-tier range widening. ratio = additional questions answered /
    // additional questions applicable to the borrower's segment.
    confidence: {
      highRatioThreshold: 0.8,
      maxWidenPct: 0.25,  // Low confidence (ratio 0)
      minWidenPct: 0.05   // floor - a range is never shown as a false point
    }
  };

  var DISCRETIONARY_PURPOSES = [
    "Wedding/discretionary",
    "Other discretionary"
  ];

  function fmtINR(n) {
    return Math.round(n).toLocaleString("en-IN");
  }

  function segmentFromIncomeType(incomeType) {
    if (incomeType === "Salaried") return "salaried";
    if (incomeType === "Self-employed/Business") return "self-employed";
    if (incomeType === "Informal/Gig/Cash") return "informal";
    return null;
  }

  // FR-Q7 - plausibility checks. Returns a list of issues; empty = clean.
  function plausibilityIssues(inputs) {
    var issues = [];
    if (!(inputs.netIncome > 0)) issues.push("Net income must be greater than zero.");
    if (inputs.age != null && (inputs.age < RULES.plausibility.minAge || inputs.age > RULES.plausibility.maxAge)) {
      issues.push("Age " + inputs.age + " is outside the " + RULES.plausibility.minAge + "-" + RULES.plausibility.maxAge + " range this tool models - please confirm.");
    }
    if (inputs.netIncome > 0 && inputs.existingEMIs >= inputs.netIncome) {
      issues.push("Existing EMIs meet or exceed net income - please confirm this is correct.");
    }
    if (!(inputs.amountWanted > 0)) issues.push("Amount wanted must be greater than zero.");
    return issues;
  }

  // Confidence tier from how many applicable additional questions were answered.
  function classifyConfidence(answeredCount, applicableCount) {
    var ratio = applicableCount > 0 ? answeredCount / applicableCount : 1;
    var tier = ratio === 0 ? "Low" : (ratio >= RULES.confidence.highRatioThreshold ? "High" : "Medium");
    var widenPct = Math.max(
      RULES.confidence.minWidenPct,
      RULES.confidence.maxWidenPct * (1 - ratio)
    );
    return { tier: tier, ratio: ratio, widenPct: widenPct };
  }

  function effectiveNetIncome(inputs, segment) {
    // FR-Q6 / §6.3 - declared income that understates cash flow is blended,
    // not capped at the lowest documented figure.
    if (segment === "self-employed" && inputs.cashIncomeEstimate > inputs.netIncome) {
      var w = RULES.incomeBlend;
      return w.documentedWeight * inputs.netIncome + w.cashWeight * inputs.cashIncomeEstimate;
    }
    return inputs.netIncome;
  }

  function hasSevereStress(inputs) {
    return (inputs.bounces || 0) >= 1 && (inputs.highCostDebt || 0) > 0;
  }

  function emiCeilings(inputs, segment) {
    var ni = effectiveNetIncome(inputs, segment);
    var foir = RULES.foir[segment];
    var sanctionEMI = Math.max(0, foir.sanction * ni - inputs.existingEMIs);
    var disposable = ni - inputs.existingEMIs - inputs.householdExpenses;
    var safeEMI = Math.max(0, Math.min(foir.safe * ni - inputs.existingEMIs, disposable) * RULES.safeBufferFactor);
    if (hasSevereStress(inputs)) safeEMI *= RULES.debtStressDiscount;
    return { sanctionEMI: sanctionEMI, safeEMI: safeEMI, effectiveNetIncome: ni };
  }

  function isSecuredRouted(inputs, segment) {
    if (segment === "salaried") return false;
    var collateral = inputs.collateralValue || 0;
    return collateral >= RULES.collateralRoutingMinRatio * inputs.amountWanted;
  }

  function rateBandFor(inputs, segment, secured) {
    if (secured) return RULES.securedBand.slice();
    var band = RULES.rateBands[inputs.loanType];
    var score = inputs.creditScore; // null/undefined = unknown
    if (score == null) return band.slice(); // FR-Q6: unknown is never treated as worst-case
    var span = band[1] - band[0];
    if (score >= 750) return [band[0], band[0] + 0.4 * span];
    if (score >= 650) return [band[0] + 0.2 * span, band[0] + 0.7 * span];
    return [band[0] + 0.5 * span, band[1]];
  }

  function widenBand(band, widenPct) {
    var span = band[1] - band[0];
    return [Math.max(0, band[0] - span * widenPct), band[1] + span * widenPct];
  }

  function apr(rate, loanType) {
    var years = RULES.defaultTenureYears[loanType];
    return rate + RULES.processingFeePct / years;
  }

  // Standard amortising-loan EMI formula.
  function emiForPrincipal(principal, annualRatePct, tenureMonths) {
    var r = annualRatePct / 12 / 100;
    if (r === 0) return principal / tenureMonths;
    var factor = Math.pow(1 + r, tenureMonths);
    return principal * r * factor / (factor - 1);
  }

  // Inverse: how much principal does a given EMI ceiling support?
  function principalForEMI(emi, annualRatePct, tenureMonths) {
    var r = annualRatePct / 12 / 100;
    if (r === 0) return emi * tenureMonths;
    var factor = Math.pow(1 + r, tenureMonths);
    return emi * (factor - 1) / (r * factor);
  }

  function midpoint(band) { return (band[0] + band[1]) / 2; }

  function rangeAround(value, widenPct) {
    return [Math.max(0, value * (1 - widenPct)), value * (1 + widenPct)];
  }

  function tenureTradeoff(loanType, principal, rate) {
    var def = RULES.defaultTenureYears[loanType];
    var shortYears = Math.max(1, def - 2);
    var longYears = def + 3;
    return {
      shortYears: shortYears,
      shortEMI: emiForPrincipal(principal, rate, shortYears * 12),
      longYears: longYears,
      longEMI: emiForPrincipal(principal, rate, longYears * 12)
    };
  }

  function stressTest(safeEMI, proposedEMI) {
    var stressedSafeEMI = safeEMI * (1 - RULES.stressIncomeDropPct / 100);
    var holds = proposedEMI <= stressedSafeEMI;
    return {
      dropPct: RULES.stressIncomeDropPct,
      stressedSafeEMI: stressedSafeEMI,
      holds: holds
    };
  }

  function calcVerdict(inputs, safeCarryAmount) {
    var severeStress = hasSevereStress(inputs);
    var isDiscretionary = DISCRETIONARY_PURPOSES.indexOf(inputs.purpose) !== -1;
    if (severeStress) {
      if (safeCarryAmount < inputs.amountWanted * 0.3) {
        return {
          verdict: "Don't borrow",
          reason: "Recent payment bounces plus existing high-cost debt mean taking on more debt now is likely to strain you further" +
            (isDiscretionary ? ", especially for a discretionary purpose." : ".")
        };
      }
      return {
        verdict: "Borrow less",
        reason: "Recent bounces and existing high-cost debt mean you can safely carry about ₹" + fmtINR(safeCarryAmount) +
          ", well below the ₹" + fmtINR(inputs.amountWanted) + " you asked for."
      };
    }
    if (inputs.amountWanted <= safeCarryAmount) {
      return {
        verdict: "Borrow",
        reason: "Your income comfortably covers this " + (isDiscretionary ? "discretionary" : "productive") +
          " borrowing within a safe monthly outflow."
      };
    }
    return {
      verdict: "Borrow less",
      reason: "You can safely carry about ₹" + fmtINR(safeCarryAmount) + " rather than the full ₹" +
        fmtINR(inputs.amountWanted) + " you asked for, based on your income and existing obligations."
    };
  }

  // Full assessment. `answeredAdditionalCount`/`applicableAdditionalCount` drive
  // the confidence tier (FR-Q3/FR-Q5/§5.5): confidence and range width depend
  // only on how much has been answered, never on which specific fields.
  function assess(inputs, answeredAdditionalCount, applicableAdditionalCount) {
    var segment = segmentFromIncomeType(inputs.incomeType);
    var confidence = classifyConfidence(answeredAdditionalCount, applicableAdditionalCount);
    var ceilings = emiCeilings(inputs, segment);
    var secured = isSecuredRouted(inputs, segment);
    var band = widenBand(rateBandFor(inputs, segment, secured), confidence.widenPct);
    var rate = midpoint(band);

    var sanctionAmount = principalForEMI(ceilings.sanctionEMI, rate, RULES.defaultTenureYears[inputs.loanType] * 12);
    var safeCarryAmount = principalForEMI(ceilings.safeEMI, rate, RULES.defaultTenureYears[inputs.loanType] * 12);

    var proposedEMI = emiForPrincipal(inputs.amountWanted, rate, RULES.defaultTenureYears[inputs.loanType] * 12);
    var stress = stressTest(ceilings.safeEMI, proposedEMI);
    var tradeoff = tenureTradeoff(inputs.loanType, inputs.amountWanted, rate);

    var verdict = calcVerdict(inputs, safeCarryAmount);

    return {
      segment: segment,
      confidence: confidence,
      secured: secured,
      verdict: verdict,
      o2: {
        sanctionRange: rangeAround(sanctionAmount, confidence.widenPct),
        safeCarryRange: rangeAround(safeCarryAmount, confidence.widenPct),
        recommendation: safeCarryAmount < sanctionAmount
          ? "A lender may sanction more, but rely on the safe-carry figure - it accounts for your actual household expenses, not just formal eligibility."
          : "Your sanction and safe-carry figures are close; either can guide your ask."
      },
      o3: {
        band: band,
        apr: apr(rate, inputs.loanType) + confidence.widenPct * 2, // wider APR range echoes rate uncertainty
        secured: secured
      },
      o4: {
        ceilingRange: rangeAround(ceilings.safeEMI, confidence.widenPct),
        tradeoff: tradeoff,
        stress: stress
      },
      raw: { sanctionAmount: sanctionAmount, safeCarryAmount: safeCarryAmount, rate: rate, ceilings: ceilings }
    };
  }

  var api = {
    RULES: RULES,
    DISCRETIONARY_PURPOSES: DISCRETIONARY_PURPOSES,
    fmtINR: fmtINR,
    segmentFromIncomeType: segmentFromIncomeType,
    plausibilityIssues: plausibilityIssues,
    classifyConfidence: classifyConfidence,
    effectiveNetIncome: effectiveNetIncome,
    hasSevereStress: hasSevereStress,
    emiCeilings: emiCeilings,
    isSecuredRouted: isSecuredRouted,
    rateBandFor: rateBandFor,
    widenBand: widenBand,
    apr: apr,
    emiForPrincipal: emiForPrincipal,
    principalForEMI: principalForEMI,
    tenureTradeoff: tenureTradeoff,
    stressTest: stressTest,
    calcVerdict: calcVerdict,
    assess: assess
  };

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  } else {
    root.BorrowerCopilot = api;
  }
})(typeof window !== "undefined" ? window : globalThis);
