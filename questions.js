// Borrower Copilot - Question Engine schema.
// Declarative question list; app.js renders from this instead of hand-written
// per-question markup, and rules.js/test_rules.js can reason about which
// additional questions are "applicable" to a segment without duplicating the list.

(function (root) {
  "use strict";

  var MUST_QUESTIONS = [
    { id: "purpose", label: "What is this loan for?", type: "select",
      options: ["Wedding/discretionary", "Medical/emergency", "Home purchase/renovation",
        "Vehicle purchase", "Business stock/equipment", "Debt consolidation",
        "Income-generating asset", "Other discretionary"] },
    { id: "amountWanted", label: "How much do you want to borrow?", type: "number", unit: "currency" },
    { id: "loanType", label: "What type of loan?", type: "select",
      options: ["Personal", "Home", "LAP", "Gold", "Two-wheeler", "Business"] },
    { id: "incomeType", label: "How would you describe your income?", type: "select",
      options: ["Salaried", "Self-employed/Business", "Informal/Gig/Cash"] },
    { id: "netIncome", label: "Net monthly income, take-home", type: "number", unit: "currency" },
    { id: "existingEMIs", label: "Total existing monthly EMIs (0 if none)", type: "number", unit: "currency" },
    { id: "householdExpenses", label: "Monthly household expenses, excluding EMIs", type: "number", unit: "currency" },
    { id: "age", label: "Your age", type: "number" },
    { id: "creditScore", label: "Credit score, if known", type: "number-or-unknown" }
  ];

  // segments: 'all' or an array of segment keys this question applies to.
  var ADDITIONAL_QUESTIONS = [
    { id: "incomeStabilityYears", label: "How many years of stable income/business history do you have?",
      type: "number", segments: ["self-employed", "informal"] },
    { id: "variableIncomeShare", label: "What share of your income is variable or irregular? (%)",
      type: "number", segments: ["self-employed"] },
    { id: "cashIncomeEstimate", label: "Estimated actual monthly cash income, if higher than net income above (0 if same)",
      type: "number", unit: "currency", segments: ["self-employed"] },
    { id: "collateralValue", label: "Value of unencumbered collateral you could offer (0 if none)",
      type: "number", unit: "currency", segments: ["self-employed", "informal"] },
    { id: "bounces", label: "Number of bounced EMIs/payments in the last 6 months",
      type: "number", segments: ["self-employed", "informal"] },
    { id: "highCostDebt", label: "Outstanding high-cost debt, e.g. app loans or credit cards (0 if none)",
      type: "number", unit: "currency", segments: ["informal"] },
    { id: "cardUtilisation", label: "Credit card utilisation (%), if you have one",
      type: "number", segments: ["salaried", "self-employed"] },
    { id: "emergencySavings", label: "Emergency savings, in months of expenses covered",
      type: "number", segments: "all" },
    { id: "coApplicantIncome", label: "Co-applicant's net monthly income (0 if none)",
      type: "number", unit: "currency", segments: "all" },
    { id: "upcomingExpense", label: "Any large upcoming expense in the next year? (0 if none)",
      type: "number", unit: "currency", segments: "all" },
    { id: "lenderQuoteRate", label: "Rate already quoted by a lender, if any (%)",
      type: "number", segments: "all" }
  ];

  function applicableAdditional(segment) {
    return ADDITIONAL_QUESTIONS.filter(function (q) {
      return q.segments === "all" || q.segments.indexOf(segment) !== -1;
    });
  }

  var api = { MUST_QUESTIONS: MUST_QUESTIONS, ADDITIONAL_QUESTIONS: ADDITIONAL_QUESTIONS, applicableAdditional: applicableAdditional };

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  } else {
    root.BorrowerCopilotQuestions = api;
  }
})(typeof window !== "undefined" ? window : globalThis);
