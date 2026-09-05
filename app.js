// Borrower Copilot - UI layer. Renders from questions.js, calls rules.js for
// all calculation and explanation logic. Contains no thresholds of its own.
(function () {
  "use strict";

  var R = window.BorrowerCopilot;
  var Q = window.BorrowerCopilotQuestions;

  var state = {
    answers: {},          // question id -> value
    unknownFields: {},    // question id -> true if explicitly "don't know"
    answeredAdditional: {} // question id -> true once the borrower has provided a value
  };

  var mustEl = document.getElementById("must-questions");
  var additionalEl = document.getElementById("additional-questions");
  var additionalSection = document.getElementById("additional-section");
  var outputsSection = document.getElementById("outputs-section");
  var outputsEl = document.getElementById("outputs");
  var cardSection = document.getElementById("card-section");
  var cardEl = document.getElementById("card");
  var issuesEl = document.getElementById("issues");

  function renderQuestion(container, q) {
    var wrap = document.createElement("div");
    wrap.className = "question";

    var label = document.createElement("label");
    label.textContent = q.label;
    label.setAttribute("for", "q_" + q.id);
    wrap.appendChild(label);

    if (q.type === "select") {
      var select = document.createElement("select");
      select.id = "q_" + q.id;
      var blank = document.createElement("option");
      blank.value = ""; blank.textContent = "-- choose --";
      select.appendChild(blank);
      q.options.forEach(function (opt) {
        var o = document.createElement("option");
        o.value = opt; o.textContent = opt;
        select.appendChild(o);
      });
      select.addEventListener("change", function () { onAnswer(q, select.value); });
      wrap.appendChild(select);
    } else if (q.type === "number-or-unknown") {
      var row = document.createElement("div");
      row.className = "inline-row";
      var input = document.createElement("input");
      input.type = "number"; input.id = "q_" + q.id;
      input.addEventListener("input", function () {
        state.unknownFields[q.id] = false;
        onAnswer(q, input.value === "" ? null : Number(input.value));
      });
      var dontKnow = document.createElement("label");
      dontKnow.className = "dontknow";
      var cb = document.createElement("input");
      cb.type = "checkbox";
      cb.addEventListener("change", function () {
        if (cb.checked) { input.value = ""; input.disabled = true; state.unknownFields[q.id] = true; onAnswer(q, null); }
        else { input.disabled = false; state.unknownFields[q.id] = false; onAnswer(q, null); }
      });
      dontKnow.appendChild(cb);
      dontKnow.appendChild(document.createTextNode(" I don't know"));
      row.appendChild(input); row.appendChild(dontKnow);
      wrap.appendChild(row);
    } else {
      var num = document.createElement("input");
      num.type = "number"; num.id = "q_" + q.id;
      num.addEventListener("input", function () { onAnswer(q, num.value === "" ? null : Number(num.value)); });
      wrap.appendChild(num);
    }

    container.appendChild(wrap);
  }

  function onAnswer(q, value) {
    state.answers[q.id] = value;
    if (!Q.MUST_QUESTIONS.some(function (mq) { return mq.id === q.id; })) {
      // Additional question: FR-Q5/FR-Q3 - only counts as "answered" (and only
      // ever tightens ranges) once a real value is supplied; skipping or
      // clearing it never narrows anything.
      state.answeredAdditional[q.id] = value !== null && value !== "" && !isNaN(value) || (typeof value === "string" && value !== "");
    }
    tryRender();
  }

  function mustSetComplete() {
    return Q.MUST_QUESTIONS.every(function (q) {
      if (q.id === "creditScore") return state.unknownFields.creditScore || state.answers.creditScore != null;
      var v = state.answers[q.id];
      return v !== undefined && v !== null && v !== "";
    });
  }

  function tryRender() {
    issuesEl.innerHTML = "";
    if (!mustSetComplete()) {
      additionalSection.hidden = true;
      outputsSection.hidden = true;
      cardSection.hidden = true;
      return;
    }

    // ponytail: FR-Q7 asks for "confirm or correct" before a flagged value is
    // used. This implements the stricter half (never silently used) by
    // blocking outputs until the value is edited; it skips a separate
    // "use anyway" override control. Add one if reviewers want borrowers to
    // proceed with a flagged-but-intentional value (e.g. EMI genuinely near income).
    var issues = R.plausibilityIssues(state.answers);
    if (issues.length) {
      issues.forEach(function (msg) {
        var li = document.createElement("li");
        li.textContent = msg;
        issuesEl.appendChild(li);
      });
      // FR-Q7: prompt to confirm/correct rather than silently proceeding.
      outputsSection.hidden = true;
      cardSection.hidden = true;
    }

    var segment = R.segmentFromIncomeType(state.answers.incomeType);
    renderAdditional(segment);

    if (issues.length === 0) {
      renderOutputs(segment);
    }
  }

  var renderedSegment = null;
  function renderAdditional(segment) {
    additionalSection.hidden = false;
    if (renderedSegment === segment) return; // avoid re-render wiping in-progress input
    renderedSegment = segment;
    additionalEl.innerHTML = "";
    Q.applicableAdditional(segment).forEach(function (q) { renderQuestion(additionalEl, q); });
  }

  function answeredAdditionalCount(segment) {
    var applicable = Q.applicableAdditional(segment);
    return applicable.filter(function (q) { return state.answeredAdditional[q.id]; }).length;
  }

  function fmtPct(n) { return n.toFixed(1) + "%"; }
  function fmtRange(range, prefix) {
    prefix = prefix || "₹";
    return prefix + R.fmtINR(range[0]) + " – " + prefix + R.fmtINR(range[1]);
  }

  function renderOutputs(segment) {
    outputsSection.hidden = false;
    var applicable = Q.applicableAdditional(segment);
    var answered = answeredAdditionalCount(segment);
    var result = R.assess(state.answers, answered, applicable.length);
    state.lastResult = result;

    outputsEl.innerHTML = "";
    addOutput(outputsEl, "O1 - Borrowing verdict", result.verdict.verdict, result.verdict.reason);
    addOutput(outputsEl, "O2 - Maximum amount",
      "Lender sanction: " + fmtRange(result.o2.sanctionRange) + " · Safe to carry: " + fmtRange(result.o2.safeCarryRange),
      result.o2.recommendation);
    addOutput(outputsEl, "O3 - Fair interest rate",
      "Fair band: " + fmtPct(result.o3.band[0]) + " – " + fmtPct(result.o3.band[1]) + " · All-in APR ≈ " + fmtPct(result.o3.apr),
      result.o3.secured
        ? "Your unencumbered collateral routes this to secured-product reasoning, which carries a lower fair rate than an unsecured assessment would."
        : "This band reflects your loan type, segment, and credit history as told to us.");
    addOutput(outputsEl, "O4 - EMI / outflow ceiling",
      "Ceiling: " + fmtRange(result.o4.ceilingRange) + "/month",
      "Tenure trade-off: " + result.o4.tradeoff.shortYears + "y → ₹" + R.fmtINR(result.o4.tradeoff.shortEMI) + "/mo, " +
      result.o4.tradeoff.longYears + "y → ₹" + R.fmtINR(result.o4.tradeoff.longEMI) + "/mo. " +
      "Stress test (20% income drop): " + (result.o4.stress.holds ? "ceiling still holds." : "ceiling would be breached - consider borrowing less or a longer tenure."));

    var confBadge = document.getElementById("confidence-badge");
    confBadge.textContent = "Confidence: " + result.confidence.tier +
      " (" + answered + "/" + applicable.length + " additional questions answered - more answers narrow these ranges, never the reverse)";
    confBadge.className = "badge badge-" + result.confidence.tier.toLowerCase();

    renderCard(result, segment);
  }

  function addOutput(container, title, headline, detail) {
    var box = document.createElement("div");
    box.className = "output-box";
    var h = document.createElement("h3"); h.textContent = title;
    var p1 = document.createElement("p"); p1.className = "headline"; p1.textContent = headline;
    var p2 = document.createElement("p"); p2.className = "detail"; p2.textContent = detail;
    box.appendChild(h); box.appendChild(p1); box.appendChild(p2);
    container.appendChild(box);
  }

  function renderCard(result, segment) {
    cardSection.hidden = false;
    var lenderQuote = state.answers.lenderQuoteRate;
    var rateLine = lenderQuote
      ? "Lender quoted " + fmtPct(lenderQuote) + " - fair for your profile is " +
        fmtPct(result.o3.band[0]) + "–" + fmtPct(result.o3.band[1]) + " (all-in APR ≈ " + fmtPct(result.o3.apr) + "), because your income and loan type support this band."
      : "Fair for your profile: " + fmtPct(result.o3.band[0]) + "–" + fmtPct(result.o3.band[1]) + " (all-in APR ≈ " + fmtPct(result.o3.apr) + ").";

    var lines = [
      result.verdict.verdict + " - " + result.verdict.reason,
      "Safe to carry: " + fmtRange(result.o2.safeCarryRange) +
        (Math.abs(result.raw.sanctionAmount - result.raw.safeCarryAmount) > result.raw.safeCarryAmount * 0.05
          ? " (a lender may offer more - rely on this figure, not the sanction figure)" : ""),
      rateLine,
      "Don't exceed ₹" + R.fmtINR(result.o4.ceilingRange[1]) + "/month. Stress test (20% income drop): " +
        (result.o4.stress.holds ? "still holds." : "would be breached."),
      "Confidence: " + result.confidence.tier,
      "Self-assessment only - not a loan offer. Generated " + new Date().toLocaleDateString("en-IN")
    ];

    cardEl.innerHTML = "";
    lines.forEach(function (l) {
      var p = document.createElement("p");
      p.textContent = l;
      cardEl.appendChild(p);
    });
  }

  Q.MUST_QUESTIONS.forEach(function (q) { renderQuestion(mustEl, q); });
})();
