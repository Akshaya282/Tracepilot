 "use client";

import { FormEvent, useState } from "react";

type Finding = {
  severity: "high" | "medium" | "low";
  title: string;
  detail: string;
  recommendation: string;
};
type Result = {
  runId: string;
  status: string;
  summary: string;
  rootCause: string;
  findings: Finding[];
  trace: { time: string; level: string; message: string }[];
};

const example = `09:41:02 INFO Agent started
09:41:03 INFO Calling tool: search_customer
09:41:08 ERROR Tool search_customer timed out after 5000ms
09:41:08 WARN Retrying tool call (attempt 2/2)
09:41:13 ERROR Tool search_customer timed out after 5000ms
09:41:13 ERROR Agent stopped: maximum retries exceeded`;

export default function Home() {
  const [logs, setLogs] = useState(example);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState("");

  async function investigate(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError("");
    setResult(null);
    try {
      const response = await fetch("/api/investigate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ logs })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Investigation failed.");
      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unexpected error.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="shell">
      <nav className="nav">
        <a className="brand" href="#"><span className="brand-mark">T</span> TracePilot</a>
        <span className="nav-tag">AGENT DEBUGGER · MVP</span>
      </nav>

      <section className="hero">
        <div className="eyebrow"><span className="pulse" /> INVESTIGATE AGENT FAILURES</div>
        <h1>Find the reason<br /><em>your agent failed.</em></h1>
        <p className="intro">Paste a run trace. TracePilot will inspect the events, identify likely failure patterns, and suggest what to check next.</p>
      </section>

      <section className="workspace">
        <form className="input-panel" onSubmit={investigate}>
          <div className="panel-heading">
            <div><span className="step">01</span><h2>Run trace</h2></div>
            <button className="text-button" type="button" onClick={() => setLogs(example)}>Load sample</button>
          </div>
          <p className="helper">Paste timestamped logs, tool events, errors, or agent output.</p>
          <textarea value={logs} onChange={e => setLogs(e.target.value)} spellCheck={false} aria-label="Run trace" />
          <div className="input-footer">
            <span>{logs.trim() ? logs.trim().split(/\s+/).length + " tokens approx." : "No trace entered"}</span>
            <button className="primary" type="submit" disabled={loading || !logs.trim()}>
              {loading ? "Investigating…" : "Investigate trace"} <span>↗</span>
            </button>
          </div>
        </form>

        <section className="results-panel" aria-live="polite">
          <div className="panel-heading">
            <div><span className="step">02</span><h2>Investigation</h2></div>
            {result && <span className="status"><i /> COMPLETE</span>}
          </div>
          {!result && !loading && !error && (
            <div className="empty-state">
              <div className="orbit"><span>✳</span></div>
              <h3>Your findings will appear here</h3>
              <p>Submit a trace to see the suspected root cause, evidence, and recommended next steps.</p>
            </div>
          )}
          {loading && <div className="loading-state"><div className="spinner" /><p>Reading trace and checking failure patterns…</p></div>}
          {error && <div className="error-box">{error}</div>}
          {result && (
            <div className="results">
              <div className="summary"><span className="label">LIKELY ROOT CAUSE</span><h3>{result.rootCause}</h3><p>{result.summary}</p></div>
              <div className="finding-list">
                {result.findings.map((finding, i) => (
                  <article className="finding" key={i}>
                    <div className="finding-top"><span className={`severity ${finding.severity}`}>{finding.severity}</span><strong>{finding.title}</strong></div>
                    <p>{finding.detail}</p>
                    <div className="recommendation"><b>Next step</b> {finding.recommendation}</div>
                  </article>
                ))}
              </div>
              <div className="trace-heading"><span>TRACE EVENTS</span><span>{result.trace.length} events</span></div>
              <div className="trace-list">
                {result.trace.map((event, i) => <div className="trace-row" key={i}><time>{event.time}</time><span className={`level ${event.level.toLowerCase()}`}>{event.level}</span><p>{event.message}</p></div>)}
              </div>
              <p className="disclaimer">Prototype analysis uses deterministic pattern matching, not an external LLM. Treat findings as debugging hints.</p>
            </div>
          )}
        </section>
      </section>
      <footer><span>TRACEPILOT</span><span>Built for clearer agent observability.</span></footer>
    </main>
  );
}
