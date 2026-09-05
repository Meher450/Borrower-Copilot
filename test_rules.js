// Run: node test_rules.js
// Assertion-based checks against rules.js - no framework, no fixtures.
var assert = require("assert");
var R = require("./rules.js");
var Q = require("./questions.js");

function run(name, fn) {
  try {
    fn();
    console.log("PASS  " + name);
  } catch (e) {
    console.error("FAIL  " + name);
    console.error("      " + e.message);
    process.exitCode = 1;
  }
}

// --- Persona fixtures (requirements §4.2) -----------------------------------

var priya = {
  purpose: "Wedding/discretionary", amountWanted: 800000, loanType: "Personal",
  incomeType: "Salaried", netIncome: 110000, existingEMIs: 14000,
  householdExpenses: 28000, age: 29, creditScore: 780
};

var ravi = {
  purpose: "Business stock/equipment", amountWanted: 1500000, loanType: "Business",
  incomeType: "Self-employed/Business", netIncome: 35000, existingEMIs: 0,
  householdExpenses: 20000, age: 42, creditScore: null,
  cashIncomeEstimate: 60000, collateralValue: 4500000, bounces: 0,
  incomeStabilityYears: 14, variableIncomeShare: 60
};

var anita = {
  purpose: "Income-generating asset", amountWanted: 150000, loanType: "Two-wheeler",
  incomeType: "Informal/Gig/Cash", netIncome: 28000, existingEMIs: 0,
  householdExpenses: 22000, age: 35, creditScore: null,
  bounces: 1, highCostDebt: 35000, incomeStabilityYears: 3
};

// --- Persona outcome checks --------------------------------------------------

run("Priya: clean salaried case yields Borrow", function () {
  var segApplicable = Q.applicableAdditional("salaried").length;
  var result = R.assess(priya, 0, segApplicable);
  assert.strictEqual(result.verdict.verdict, "Borrow");
  assert.strictEqual(result.segment, "salaried");
});

run("Ravi: unencumbered collateral routes to secured-product reasoning", function () {
  var segApplicable = Q.applicableAdditional("self-employed").length;
  var answered = 5; // cashIncomeEstimate, collateralValue, bounces, incomeStabilityYears, variableIncomeShare
  var result = R.assess(ravi, answered, segApplicable);
  assert.strictEqual(result.segment, "self-employed");
  assert.strictEqual(result.secured, true, "expected Ravi to be routed to secured reasoning");
});

run("Ravi: declared-vs-cash income is blended, not capped at the lower figure", function () {
  var ni = R.effectiveNetIncome(ravi, "self-employed");
  assert.ok(ni > ravi.netIncome, "blended income should exceed the low documented figure");
  assert.ok(ni < ravi.cashIncomeEstimate, "blended income should not simply equal the higher cash estimate either");
});

run("Anita: bounce history + high-cost debt makes Don't borrow / Borrow less reachable", function () {
  var segApplicable = Q.applicableAdditional("informal").length;
  var result = R.assess(anita, 3, segApplicable);
  assert.strictEqual(result.segment, "informal");
  assert.ok(["Don't borrow", "Borrow less"].indexOf(result.verdict.verdict) !== -1,
    "expected a negative verdict, got " + result.verdict.verdict);
});

run("Anita: 'Borrow less' message is numerically consistent - the safe-carry figure really is below the ask", function () {
  var segApplicable = Q.applicableAdditional("informal").length;
  var result = R.assess(anita, 3, segApplicable);
  if (result.verdict.verdict === "Borrow less") {
    assert.ok(result.raw.safeCarryAmount < anita.amountWanted,
      "'well below the ask' message must not fire when safe-carry actually exceeds the ask");
  }
});

run("Debt-stress discount actually reduces the safe EMI ceiling vs the same profile without stress", function () {
  var clean = Object.assign({}, anita, { bounces: 0, highCostDebt: 0 });
  var stressed = anita;
  var ceilingsClean = R.emiCeilings(clean, "informal");
  var ceilingsStressed = R.emiCeilings(stressed, "informal");
  assert.ok(ceilingsStressed.safeEMI < ceilingsClean.safeEMI);
});

run("FR-O1: 'Don't borrow' is reachable, not decorative - a more distressed informal profile hits it", function () {
  var extreme = Object.assign({}, anita, { netIncome: 26000, householdExpenses: 24000, bounces: 2, highCostDebt: 60000 });
  var result = R.assess(extreme, 2, Q.applicableAdditional("informal").length);
  assert.strictEqual(result.verdict.verdict, "Don't borrow");
});

run("A clean profile does NOT get 'Don't borrow' by default (verdict is not decorative)", function () {
  var segApplicable = Q.applicableAdditional("salaried").length;
  var result = R.assess(priya, segApplicable, segApplicable);
  assert.notStrictEqual(result.verdict.verdict, "Don't borrow");
});

// --- FR-Q6: unknown credit score must not be treated as worst-case ---------

run("FR-Q6: unknown credit score keeps the full rate band, not the worst end", function () {
  var bandUnknown = R.rateBandFor(ravi, "self-employed", false);
  var bandWorst = R.rateBandFor(Object.assign({}, ravi, { creditScore: 300 }), "self-employed", false);
  assert.deepStrictEqual(bandUnknown, R.RULES.rateBands.Business);
  assert.ok(bandWorst[0] > bandUnknown[0], "a known-bad score should shift the band worse than 'unknown'");
});

// --- FR-Q3 / FR-Q5: additional answers only ever narrow, never widen -------

run("FR-Q3/FR-Q5: answering more additional questions never widens a range, and skipping never narrows it", function () {
  var segApplicable = Q.applicableAdditional("informal").length;
  var widths = [];
  for (var answered = 0; answered <= segApplicable; answered++) {
    var conf = R.classifyConfidence(answered, segApplicable);
    widths.push(conf.widenPct);
  }
  for (var i = 1; i < widths.length; i++) {
    assert.ok(widths[i] <= widths[i - 1] + 1e-9,
      "widenPct must be non-increasing as more questions are answered: " + widths.join(", "));
  }
  assert.ok(widths[widths.length - 1] < widths[0], "answering everything should strictly narrow vs answering nothing");
});

run("FR-E3: even at full confidence, ranges never collapse to a point", function () {
  var conf = R.classifyConfidence(20, 20);
  assert.ok(conf.widenPct >= R.RULES.confidence.minWidenPct);
});

// --- FR-Q7: plausibility checks ---------------------------------------------

run("FR-Q7: EMI exceeding income is flagged, not silently accepted", function () {
  var bad = Object.assign({}, priya, { existingEMIs: 200000 });
  var issues = R.plausibilityIssues(bad);
  assert.ok(issues.length > 0);
});

run("FR-Q7: a clean profile raises no plausibility issues", function () {
  assert.deepStrictEqual(R.plausibilityIssues(priya), []);
});

console.log("\nDone.");
