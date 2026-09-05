# Borrower Copilot

A pre-lending self-assessment tool for Indian borrowers. No login, no bureau pull, nothing stored - see `Borrower_Copilot_BRS.docx` for the full requirements and `Borrower_Copilot_Implementation_Plan.md` for the delivery plan this was built from.

## Run it (under 5 minutes, no backend)

There is no build step. Either:

```
open index.html
```

or, if your browser blocks local `file://` script loading:

```
python3 -m http.server 8000
# then visit http://localhost:8000
```

## Run the tests

```
node test_rules.js
```

13 assertion-based checks against the rules engine - persona outcomes, and the FR-Q3/FR-Q5/FR-Q6/FR-Q7/FR-O1 invariants (no framework needed, plain Node).

## Files

| File | Purpose |
|---|---|
| `index.html`, `style.css`, `app.js` | UI - question flow, outputs, Negotiation Card |
| `questions.js` | Declarative must/additional question schema, segment tagging |
| `rules.js` | Rules engine - all calculation logic, no DOM code, importable by both the browser and Node |
| `RULES.md` | Every threshold, band, and assumption the engine uses - what/value/why/source |
| `test_rules.js` | Runnable regression checks |
| `runthroughs/priya.md`, `ravi.md`, `anita.md` | The three required persona run-throughs, generated from real engine output |
| `WALKTHROUGH.md` | Five-minute written walkthrough - what's built, what's next, what would be cut |
| `Borrower_Copilot_BRS.docx` | Source requirements |
| `Borrower_Copilot_Implementation_Plan.md` | Delivery plan (workstreams, WBS, traceability matrix) this build followed |
