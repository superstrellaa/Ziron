import { withRetry } from "./retry.js";
import { logger } from "../../../../engine/core/logger.js";

const REPO = "superstrellaa/Ziron";
const API = `https://api.github.com/repos/${REPO}`;
const TAG_PREFIX = "app-v";
const CACHE_TTL = 5 * 60 * 1000;

const cache = new Map();

async function cached(key, loader, fresh = false) {
  const hit = cache.get(key);
  if (!fresh && hit && Date.now() - hit.at < CACHE_TTL) {
    logger.debug("Updater", `GitHub cache hit: ${key}`);
    return hit.value;
  }
  logger.debug(
    "Updater",
    `GitHub fetch: ${key}${fresh ? " (forced fresh)" : ""}`,
  );
  const value = await loader();
  cache.set(key, { value, at: Date.now() });
  return value;
}

async function ghFetch(path) {
  return withRetry(
    async () => {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 10000);
      try {
        const res = await fetch(`${API}${path}`, {
          headers: { Accept: "application/vnd.github+json" },
          signal: ctrl.signal,
        });
        if (!res.ok) {
          const err = new Error(`GitHub API ${res.status}`);
          err.status = res.status;
          throw err;
        }
        return await res.json();
      } finally {
        clearTimeout(timer);
      }
    },
    {
      attempts: 2,
      baseDelay: 600,
      label: `github ${path}`,
      // 404 / 403 (rate limit) no se arreglan reintentando; red caída o 5xx sí
      shouldRetry: (e) => e.status == null || e.status >= 500,
    },
  );
}

function normalize(r) {
  return {
    version: String(r.tag_name ?? "").replace(/^app-v|^v/, ""),
    name: r.name ?? r.tag_name,
    notes: r.body ?? "",
    date: r.published_at ?? null,
    url: r.html_url ?? null,
  };
}

export function fetchLatestRelease({ fresh = false } = {}) {
  return cached(
    "latest",
    async () => normalize(await ghFetch("/releases/latest")),
    fresh,
  );
}

export function fetchReleaseByVersion(version) {
  return cached(`tag:${version}`, async () =>
    normalize(await ghFetch(`/releases/tags/${TAG_PREFIX}${version}`)),
  );
}

export function fetchReleaseHistory(limit = 10) {
  return cached("history", async () => {
    const list = await ghFetch(`/releases?per_page=${limit}`);
    return list.filter((r) => !r.draft).map(normalize);
  });
}

export function escapeHtml(s) {
  return String(s).replace(
    /[&<>"]/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c],
  );
}

function inline(s) {
  return s
    .replace(/`([^`]+)`/g, "<code>$1</code>")
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
}

export function renderMarkdown(md) {
  if (!md || !md.trim()) return "";

  const out = [];
  let inList = false;
  const closeList = () => {
    if (inList) {
      out.push("</ul>");
      inList = false;
    }
  };

  // se escapa TODO primero: lo que llega de internet nunca se inyecta como HTML
  for (const raw of escapeHtml(md).split(/\r?\n/)) {
    const line = raw.trimEnd();
    const heading = line.match(/^#{1,3}\s+(.*)$/);
    const item = line.match(/^\s*[-*]\s+(.*)$/);

    if (heading) {
      closeList();
      out.push(`<h4>${inline(heading[1])}</h4>`);
    } else if (item) {
      if (!inList) {
        out.push("<ul>");
        inList = true;
      }
      out.push(`<li>${inline(item[1])}</li>`);
    } else if (line.trim() === "") {
      closeList();
    } else {
      closeList();
      out.push(`<p>${inline(line)}</p>`);
    }
  }
  closeList();
  return out.join("");
}
