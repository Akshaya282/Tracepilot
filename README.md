# TracePilot — Next.js MVP

A small portfolio prototype for investigating simulated AI-agent run traces.

## What it does
- Paste a trace or load the included sample.
- The Next.js API route parses up to 100 events.
- Deterministic pattern checks flag timeouts, retries, malformed structured output, authorization errors, and possible loops.
- The UI displays a likely cause, findings, next steps, and parsed events.

**Honest scope:** this first version uses rule-based pattern matching. It is not connected to an LLM, Google ADK, MCP, or a real agent runtime. Describe it that way until those integrations are implemented.

## Run in VS Code
1. Install Node.js 20 or newer.
2. Open this folder in VS Code.
3. In the terminal, run:

   ```bash
   npm install
   npm run dev
   ```

4. Open http://localhost:3000

## Project structure
```text
app/
  api/investigate/route.ts   # backend API
  globals.css                # frontend styling
  layout.tsx
  page.tsx                   # frontend page
```

## Example API request
```bash
curl -X POST http://localhost:3000/api/investigate \
  -H "Content-Type: application/json" \
  -d '{"logs":"10:00:00 ERROR Tool timeout\\n10:00:01 WARN retry attempt 2"}'
```

## Good next upgrades
- Add run IDs and persist traces in SQLite/PostgreSQL.
- Add unit tests for each failure pattern.
- Connect a real agent execution adapter and capture tool inputs/outputs with secrets redacted.
- Add OpenTelemetry-compatible trace IDs and latency measurements.
- Only claim integrations you have actually built and tested.
