# SignalBridge AI — Crisis Incident Triage & Evidence Grounding Engine

SignalBridge AI is an evidence-grounded crisis incident triage and correlation system designed for emergency operations centers, disaster dispatchers, and humanitarian coordinators. It extracts structured facts from unstructured situation reports and live public disaster feeds (USGS and UN-OCHA GDACS), detects duplicate incidents using category-aware spatial and temporal logic, reconciles conflicting impact claims without double-counting casualties, and preserves an immutable human reviewer audit trail.

---

## 1. System Architecture

```text
+-----------------------------------------------------------------------------------+
|                                  SignalBridge AI                                  |
+-----------------------------------------------------------------------------------+
                                          |
                   +----------------------+----------------------+
                   |                                             |
                   v                                             v
       [React 19 Frontend SPA]                         [Live Public Feeds]
       - Tailored Crisis Dashboard                     - USGS Earthquake Hazards (GeoJSON)
       - Evidence Highlighting                         - GDACS UN-OCHA / EC-JRC (GeoJSON)
       - Candidate Linkage Inspector                   - ReliefWeb v2 (Token-governed)
       - Interactive 34-Test Runner                              |
                   |                                             v
                   +------------------> [Express API] <----------+
                                         (/api/*)
                                             |
         +-----------------------------------+-----------------------------------+
         |                                   |                                   |
         v                                   v                                   v
[Gemini 3.8 Flash]             [Duplicate Engine]              [Modular Persistence]
- Schema-constrained JSON       - Category-aware spatial scopes  - Idempotent upsert by sourceId
- Verbatim quote grounding      - Semantic temporal isolation    - Non-destructive report merge
- Strict uncalibrated scoring   - Anti-double-counting merge     - Immutable audit event trail
- Bounded transient retries     - Multi-factor recommendation    - In-Memory or Cloud Firestore
         |                                   |                                   |
         +-----------------------------------+-----------------------------------+
                                             |
                                             v
                                  [Cloud Run / Cloud Logging]
                                  - Structured JSON Telemetry
                                  - Automatic Secret Redaction
                                  - /healthz Liveness & Readiness
```

---

## 2. Core Engineering Capabilities

### Evidence Grounding & Anti-Hallucination
* **Verbatim Substring Verification**: Every extracted impact statement and urgent need is verified as an exact substring of the original source text. Unverified claims append an explicit warning to the triage file.
* **Truth vs. Veracity Boundary**: Verbatim quote confirmation validates that the text appeared in the report; it does *not* assert real-world truth. Untrusted claims remain subject to human verification.
* **Uncalibrated Model Confidence**: Gemini self-assessed confidence scores are explicitly marked uncalibrated and isolated from operational verification. A 0.99 model confidence never marks an incident as verified.

### Transparent Duplicate Matching Pipeline
* **Category-Aware Spatial Scopes**: Proximity thresholds adapt to hazard physical dynamics:
  * Point-localized incidents (structural collapses, hazmat spills): strict **< 1.0 km** scope.
  * Neighborhood incidents (floods, wildfires): **15.0 km** scope.
  * Macro-regional shockwaves (earthquakes): up to **150.0 km** hazard impact envelope.
* **Semantic Temporal Isolation**: Incident occurrence time is evaluated independently from publication delay. If event time is unknown, the engine falls back to reporting-window analysis rather than comparing occurrence time against publication time.
* **Anti-Double-Counting Casualty Reconciliation**: Merging multiple reports preserves each source's independent claim in `claimsBreakdown` rather than blindly summing casualty figures.

### Real-Source Ingestion Layer
* **USGS Earthquake Hazards Feed**: Real-time M2.5+ earthquake GeoJSON with seismometer telemetry, focal depth, and review flags.
* **GDACS (UN-OCHA / EC-JRC)**: Real-time global flood, cyclone, and seismic alerts with humanitarian alert levels and satellite centroid coordinates.
* **Rate-Limiting Cache**: Built-in 60-second in-memory cache in `AdapterRegistry` to respect public emergency server resources.

### Observability & Security
* **Structured Cloud Logging**: All events are formatted as Google Cloud Logging-compatible JSON (`severity`, `latencyMs`, `requestId`, `geminiCall`, `feedSync`).
* **Automated Secret Redaction**: Regex masking prevents accidental emission of `AIza...` API keys, Bearer tokens, or authorization headers into server logs.
* **Strict API 404 & Error Masking**: Prevents returning `index.html` for missing `/api/*` routes. Internal database error traces and credentials are never exposed in production HTTP responses.

---

## 3. Architecture Decision Records (ADRs)

* **ADR-01: Temporal Comparison Basis**
  * *Context*: External feeds and 911 reports publish at different delays after an event occurs.
  * *Decision*: Compare `eventOccurrenceTime` against `eventOccurrenceTime` when both are known. If either is missing, evaluate `reporting_publication_windows` and provide an explicit explanatory note to the dispatcher.
* **ADR-02: Spatial Scoping by Hazard Dynamics**
  * *Context*: A 35 km separation might represent separate building collapses, but for a 7.2 earthquake, 35 km is part of the same fault slip event.
  * *Decision*: Replace arbitrary distance tests with a hazard-category spatial matrix (`point_localized`, `neighborhood`, `regional`, `macro_regional`).
* **ADR-03: Substring Quote Verification Boundary**
  * *Context*: LLMs frequently summarize, infer, or extrapolate unstated facts.
  * *Decision*: Compute strict string containment (`rawText.includes(quote)`). Highlight quotes in the UI with a disclaimer: *verbatim quote matching confirms report provenance, not underlying factual truth*.
* **ADR-04: Non-Destructive Merge & Casualty Claim Provenance**
  * *Context*: Hospital A reporting 4 casualties and News Wire B reporting 6 casualties may refer to overlapping victims.
  * *Decision*: Do not sum counts. Keep both claims in `claimsBreakdown` and retain the complete raw source report in `mergedReports`.
* **ADR-05: Modular Persistence with Stable Source Key Indexing**
  * *Context*: Disaster operations must function during testing without cloud credentials, yet prevent duplicate records on repeated feed sync.
  * *Decision*: Implement `IncidentStore` with idempotent upsert based on `${adapterId}:${sourceId}`. Support seamless local memory mode with an explicit `[In-Memory Demo]` status indicator.

---

## 4. Google Cloud Run Deployment

SignalBridge AI is packaged for standard Node.js deployment on Google Cloud Run.

### Prerequisites
1. Google Cloud SDK (`gcloud`) installed and authenticated.
2. Target project set: `gcloud config set project <PROJECT_ID>`.
3. Secret created in Secret Manager:
   ```bash
   echo -n "YOUR_GEMINI_API_KEY" | gcloud secrets create gemini-api-key --data-file=-
   ```

### 1-Command Deployment
```bash
gcloud run deploy signalbridge-ai \
  --source . \
  --platform managed \
  --region us-central1 \
  --allow-unauthenticated \
  --set-env-vars NODE_ENV=production \
  --set-secrets GEMINI_API_KEY=gemini-api-key:latest \
  --port 3000
```

### Health Check Configuration
* Liveness / Readiness Endpoint: `/healthz`
* HTTP Response:
  ```json
  {
    "status": "healthy",
    "service": "SignalBridge AI",
    "version": "1.4.0",
    "model": "gemini-3.8-flash",
    "geminiConfigured": true,
    "storage": {
      "provider": "memory_fallback",
      "isCloudReady": false,
      "status": "In-Memory Repository Active (Cloud Firestore unconfigured)"
    }
  }
  ```

---

## 5. Local Development & Testing

### Installation & Run
```bash
# Install dependencies
npm install

# Start Express server with integrated Vite dev server
npm run dev

# Run Vitest test suite (34 passing tests)
npx vitest run

# Run TypeScript type validation
npm run lint

# Production build
npm run build
```

### Test Suite Structure (34 Tests Total)
* **Suite 1: Real-Source Adapters & Critical Correlation Audit** (9 tests)
  * USGS GeoJSON adapter telemetry & NEIC depth
  * GDACS GeoJSON adapter & humanitarian alert levels
  * 60-second rate-limiting cache
  * Macro-regional earthquake shockwave scoping (150 km)
  * Tight point-localized scoping (structural collapses 3.5 km apart)
  * Semantic temporal isolation (event time vs reporting window)
  * Casualty claim reconciliation (anti-double-counting)
  * Transport encryption vs institutional domain trust evaluation
  * Synthetic demo fixture vs live feed unmistakable separation
* **Suite 2: Gemini Output Validation & Anti-Hallucination** (8 tests)
  * Exact quote span matching & substring verification
  * Hallucinated quote span rejection
  * Warning injection for unverified quotes
  * Malformed JSON recovery and error handling
  * Coordinate fabrication prevention
  * Reliable coordinate acceptance from GPS telemetry
  * Prompt injection detection and control character sanitization
  * Evidence completeness scoring
* **Suite 3: Reviewer Workflow & API Error Resilience** (5 tests)
  * Model confidence isolation from human review status
  * Unsafe URI scheme detection (`javascript:`, `data:`)
  * Grounded deterministic fallback resilience
  * Bounded retry logic for transient 429 rate limits
  * Bounded retry cutoff for persistent 503 errors (no infinite loops)
* **Suite 4: Candidate Duplicate Engine Baseline** (6 tests)
  * Mathematical Haversine distance accuracy
  * Identification of candidate duplicate reports
  * Discrimination of geographically separate incidents
  * Conflicting casualty claim detection
  * Missing coordinates and timestamps tolerance
  * Provenance preservation across report merge
* **Suite 5: Persistent Storage & Audit Log Engine** (6 tests)
  * Idempotent upsert with stable source keys (skips exact duplicate feed items)
  * Preservation of human reviewer status across feed re-syncs
  * Immutable audit trail logging and chronological retrieval
  * Multi-attribute querying and filtering (category, reviewStatus, originType)
  * Safe fallback to in-memory mode when GCP credentials are unset
  * Bounded queue capacity (500-log cap) preventing memory leaks

---

## 6. Known Limitations & Operational Boundaries

1. **Decision Support, Not Automated Dispatch**: SignalBridge AI is an operational triage and correlation assistant for human dispatchers and incident commanders. It does not replace 911 Computer-Aided Dispatch (CAD) systems or automated siren alert gateways.
2. **ReliefWeb Disasters API v2 (HTTP 403)**: ReliefWeb v2 requires an approved `appname` token from the United Nations OCHA team. It is transparently tracked in the Feed Audit Registry rather than simulated with fake data.
3. **No Autonomous Merging**: Candidate matches above the similarity threshold are flagged for human review; no incident records are merged autonomously.
4. **Third-Party HTTPS Transport vs Domain Trust**: Encrypted HTTPS transport does not imply institutional authority. A personal blog using HTTPS remains classified as an unverified source.
