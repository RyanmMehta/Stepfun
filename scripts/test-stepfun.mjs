// Minimal StepFun connectivity check: one tiny step-3.7-flash call.
import { readFileSync } from "node:fs";

function loadEnv() {
  try {
    for (const line of readFileSync(".env.local", "utf8").split("\n")) {
      const m = line.match(/^\s*([A-Z_]+)\s*=\s*(.*)\s*$/);
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
    }
  } catch {}
}
loadEnv();

const key = process.env.STEPFUN_API_KEY;
const base = process.env.STEPFUN_BASE_URL || "https://api.stepfun.ai/v1";
if (!key) {
  console.error("FAIL: STEPFUN_API_KEY missing (put it in .env.local)");
  process.exit(1);
}

async function tryBase(url) {
  const res = await fetch(`${url}/chat/completions`, {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "step-3.7-flash",
      reasoning_effort: "low",
      max_tokens: 200,
      messages: [{ role: "user", content: "Reply with the single word: ok" }],
    }),
  });
  const text = await res.text();
  return { status: res.status, text };
}

let r = await tryBase(base);
let used = base;
if (r.status === 401) {
  used = "https://api.stepfun.ai/step_plan/v1";
  console.log("401 on", base, "- trying fallback", used);
  r = await tryBase(used);
}
if (r.status >= 200 && r.status < 300) {
  const j = JSON.parse(r.text);
  console.log("SUCCESS via", used);
  console.log("reply:", JSON.stringify(j.choices?.[0]?.message?.content));
  console.log("usage:", JSON.stringify(j.usage));
} else {
  console.error("FAIL via", used, "status", r.status);
  console.error(r.text);
  process.exit(1);
}
