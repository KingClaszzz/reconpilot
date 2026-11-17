import { createHash } from "node:crypto";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { basename, join } from "node:path";

// A spec is markdown: front matter with name and url, then plain-English steps.
export function parseSpec(text, file) {
  const meta = {};
  let body = text.replace(/^﻿/, "");
  const fm = body.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/);
  if (fm) {
    for (const line of fm[1].split(/\r?\n/)) {
      const m = line.match(/^\s*([\w-]+)\s*:\s*(.*?)\s*$/);
      if (m) meta[m[1]] = m[2].replace(/^["']|["']$/g, "");
    }
    body = body.slice(fm[0].length);
  }
  const id = basename(file).replace(/\.md$/i, "");
  return {
    id,
    file,
    name: meta.name || id,
    url: meta.url || "/",
    objective: body.trim(),
    hash: createHash("sha1").update(text).digest("hex").slice(0, 12),
  };
}

export function loadSpecs(root, specsDir, only = []) {
  const dir = join(root, specsDir);
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((f) => f.toLowerCase().endsWith(".md") && !f.startsWith("_"))
    .sort()
    .map((f) => parseSpec(readFileSync(join(dir, f), "utf8"), join(specsDir, f).replace(/\\/g, "/")))
    .filter((s) => s.objective && (only.length === 0 || only.includes(s.id)));
}

export function resolveUrl(baseUrl, url) {
  return /^https?:\/\//i.test(url) ? url : new URL(url, baseUrl.endsWith("/") ? baseUrl : baseUrl + "/").toString();
}
