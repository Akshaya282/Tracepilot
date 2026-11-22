import { GoogleGenAI } from "@google/genai";
import { NextRequest, NextResponse } from "next/server";

type Finding = {
  severity: "high" | "medium" | "low";
  title: string;
  detail: string;
  recommendation: string;
};

function parseTrace(logs: string) {
  return logs.split(/\r?\n/).filter(Boolean).slice(0, 100).map((line, index) => {
    const match = line.match(/^(\d{2}:\d{2}:\d{2})\s+(INFO|WARN|WARNING|ERROR|DEBUG)\s+(.*)$/i);
    if (match) {
      return { time: match[1], level: match[2].toUpperCase() === "WARNING" ? "WARN" : match[2].toUpperCase(), message: match[3] };
    }
    return { time: `event-${String(index + 1).padStart(2, "0")}`, level: /error|failed|exception|timeout/i.test(line) ? "ERROR" : "INFO", message: line };
  });
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const logs = typeof body.logs === "string" ? body.logs.trim() : "";
    if (!logs) return NextResponse.json({ error: "Please provide a trace to investigate." }, { status: 400 });
    if (logs.length > 30000) return NextResponse.json({ error: "Trace is too long. Please keep it under 30,000 characters." }, { status: 413 });

    const lower = logs.toLowerCase();
    const findings: Finding[] = [];
    let rootCause = "No obvious failure pattern detected";
    let summary = "The trace does not contain a clear timeout, tool error, retry loop, or output-validation failure. Review the surrounding application context.";

    if (lower.includes("timeout") || lower.includes("timed out")) {
      rootCause = "A tool or downstream service timed out";
      summary = "The trace contains timeout language. The agent may be waiting on a slow or unavailable dependency.";
      findings.push({
        severity: "high",
        title: "Timeout detected",
        detail: "At least one event indicates that a tool or dependency exceeded its time limit.",
        recommendation: "Check dependency health and latency. Set a bounded timeout, emit duration metrics, and consider a fallback for this tool."
      });
    }
    if (lower.includes("retry") || lower.includes("retries")) {
      findings.push({
        severity: "medium",
        title: "Retry behavior detected",
        detail: "The trace mentions a retry. Repeated retries can amplify latency when the underlying failure is persistent.",
        recommendation: "Use capped exponential backoff with jitter, and retry only errors that are safe to repeat."
      });
    }
    if (lower.includes("invalid json") || lower.includes("schema") || lower.includes("parse error")) {
      rootCause = "The agent output may not match the expected structure";
      summary = "The trace suggests a structured-output parsing or validation problem.";
      findings.push({
        severity: "high",
        title: "Structured output validation issue",
        detail: "A JSON, schema, or parsing error appears in the trace.",
        recommendation: "Validate model output at the boundary, return the validation error to the agent, and cap repair attempts."
      });
    }
    if (lower.includes("permission") || lower.includes("unauthorized") || lower.includes("403")) {
      findings.push({
        severity: "high",
        title: "Authorization issue detected",
        detail: "The trace includes a permission or authorization failure.",
        recommendation: "Verify the runtime identity, tool scopes, and resource-level permissions. Avoid logging secrets or tokens."
      });
      if (!lower.includes("timeout")) {
        rootCause = "A tool call may be blocked by authorization";
        summary = "The trace includes a permission-related failure that may prevent the agent from using a tool.";
      }
    }
    if (lower.includes("loop") || lower.includes("maximum steps") || lower.includes("max iterations")) {
      findings.push({
        severity: "medium",
        title: "Possible agent loop or step-limit hit",
        detail: "The trace suggests repeated actions or a maximum-step limit.",
        recommendation: "Add a clear stop condition, detect repeated tool/action pairs, and log the agent's current goal."
      });
      if (!lower.includes("timeout")) {
        rootCause = "The agent may be stuck repeating actions";
        summary = "The trace suggests a loop or a run that reached its step limit.";
      }
    }
    if (findings.length === 0) {
      findings.push({
        severity: "low",
        title: "No matching signature found",
        detail: "The current prototype checks a small set of common failure patterns.",
        recommendation: "Include the full tool request/response, exception message, and run ID to make the trace more actionable."
      });
    }
        // Gemini adds an AI investigation; existing rule-based results remain the fallback.
    let aiSummary = summary;
    let aiRootCause = rootCause;
    let aiFindings = findings;

    try {
      const ai = new GoogleGenAI({
        apiKey: process.env.GEMINI_API_KEY,
      });

      const response = await ai.models.generateContent({
        model: "gemini-3.1-flash-lite",
        contents: `
You are TracePilot, an application trace investigator.
Analyze the logs below. Use only evidence present in the logs.
Do not invent events or claim certainty when the evidence is inconclusive.
Return ONLY valid JSON with this exact shape:
{
  "summary": "brief explanation",
  "rootCause": "likely cause, or say it is unclear",
  "findings": [
    {
      "severity": "high",
      "title": "short title",
      "detail": "evidence from the trace",
      "recommendation": "next debugging step"
    }
  ]
}
Severity must be "high", "medium", or "low".
If there is no clear issue, return one low-severity finding.

Logs:
${logs}
        `,
        config: {
          responseMimeType: "application/json",
        },
      });

      const text = response.text;
      if (text) {
        const parsed = JSON.parse(text);

        if (
          typeof parsed.summary === "string" &&
          typeof parsed.rootCause === "string" &&
          Array.isArray(parsed.findings)
        ) {
          aiSummary = parsed.summary;
          aiRootCause = parsed.rootCause;
          aiFindings = parsed.findings;
        }
      }
    } catch (error) {
      // Keep the rule-based analysis if Gemini is unavailable or returns invalid data.
      console.error("Gemini investigation failed:", error);
    }
    const trace = parseTrace(logs).slice(-30);
    const errorCount = trace.filter(e => e.level === "ERROR").length;
    const runId = `TP-${Date.now().toString(36).toUpperCase()}`;

    return NextResponse.json({
      runId,
      status: errorCount ? "needs_attention" : "reviewed",
      summary: aiSummary,
      rootCause: aiRootCause,
      findings: aiFindings,
      trace
    });
  } catch {
    return NextResponse.json({ error: "Invalid request. Send JSON with a logs string." }, { status: 400 });
  }
}
