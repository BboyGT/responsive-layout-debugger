import { useDeferredValue, useEffect, useMemo, useState } from "react";
import { DevicePreview } from "./components/DevicePreview";
import { IssuesSidebar } from "./components/IssuesSidebar";
import { RegressionPanel } from "./components/RegressionPanel";
import { TopBar } from "./components/TopBar";
import {
  buildCauseExplanation,
  buildComparisonFix,
  buildRegressionSummary,
  SEVERITY_RANK,
} from "./lib/insights";
import { captureDeviceSnapshot } from "./lib/snapshots";

const DEVICES = [
  { id: "mobile", label: "Mobile", width: 375, description: "Small touch screen" },
  { id: "tablet", label: "Tablet", width: 768, description: "Mid-sized layout" },
  { id: "desktop", label: "Desktop", width: 1440, description: "Wide viewport" },
];

const SAMPLE_HTML = `<main class="page">
  <header class="hero">
    <div>
      <p class="kicker">Landing Page</p>
      <h1>Build faster with a layout that adapts gracefully.</h1>
      <p>This demo intentionally includes a few responsive issues so the debugger has something to catch.</p>
    </div>
    <nav class="nav">
      <a href="#">Product</a>
      <a href="#">Pricing</a>
      <a href="#">Customers</a>
      <a href="#">Docs</a>
      <a href="#">Contact</a>
    </nav>
  </header>

  <section class="cards">
    <article class="card">
      <img src="https://images.unsplash.com/photo-1516321318423-f06f85e504b3?auto=format&fit=crop&w=1000&q=80" alt="Workspace" />
      <div class="card__body">
        <h2>Fixed media block</h2>
        <p>The image and the body width create pressure on smaller screens.</p>
      </div>
    </article>
    <article class="card card--wide">
      <h2>Marketing banner with absolute badge</h2>
      <p>There is also a positioned badge that can slip outside the card at narrow widths.</p>
      <div class="badge">Limited offer</div>
    </article>
  </section>
</main>`;

const SAMPLE_CSS = `body {
  background: linear-gradient(180deg, #fff9f0 0%, #fff 100%);
  color: #271f1a;
}

.page {
  width: 100%;
  max-width: 1200px;
  margin: 0 auto;
  padding: 32px;
}

.hero {
  display: flex;
  justify-content: space-between;
  gap: 32px;
  margin-bottom: 32px;
}

.hero h1 {
  font-size: clamp(2rem, 4vw, 4.5rem);
  line-height: 0.95;
  max-width: 8ch;
}

.nav {
  display: flex;
  gap: 18px;
  padding-top: 12px;
}

.nav a {
  color: inherit;
  text-decoration: none;
  white-space: nowrap;
}

.cards {
  display: flex;
  gap: 24px;
}

.card {
  position: relative;
  min-width: 320px;
  border-radius: 24px;
  background: white;
  overflow: hidden;
  box-shadow: 0 16px 40px rgba(39, 31, 26, 0.08);
}

.card img {
  width: 520px;
  display: block;
}

.card__body {
  padding: 24px;
}

.card--wide {
  width: 420px;
  padding: 24px;
}

.badge {
  position: absolute;
  top: 16px;
  right: -40px;
  padding: 10px 16px;
  border-radius: 999px;
  background: #ff7a59;
  color: white;
}`;

export default function App() {
  const [inputMode, setInputMode] = useState("code");
  const [html, setHtml] = useState(SAMPLE_HTML);
  const [css, setCss] = useState(SAMPLE_CSS);
  const [url, setUrl] = useState("https://example.com");
  const [showIssues, setShowIssues] = useState(true);
  const [darkMode, setDarkMode] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [severityFilter, setSeverityFilter] = useState("all");
  const [deviceFilter, setDeviceFilter] = useState("all");
  const [refreshKey, setRefreshKey] = useState(0);
  const [baselineReview, setBaselineReview] = useState(null);
  const [remoteDocument, setRemoteDocument] = useState({
    status: "idle",
    html: "",
    finalUrl: "",
    warning: "",
    error: "",
  });
  const [issuesByDevice, setIssuesByDevice] = useState({
    mobile: [],
    tablet: [],
    desktop: [],
  });
  const deferredHtml = useDeferredValue(html);
  const deferredCss = useDeferredValue(css);
  const deferredUrl = useDeferredValue(url);

  useEffect(() => {
    const handleMessage = (event) => {
      if (!event.data || typeof event.data !== "object") return;
      if (event.data.type !== "RLD_ANALYSIS_RESULT") return;

      const { deviceId, issues } = event.data.payload || {};
      if (!deviceId || !Array.isArray(issues)) return;

      setIssuesByDevice((current) => ({
        ...current,
        [deviceId]: issues,
      }));
    };

    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, []);

  useEffect(() => {
    setRefreshKey((value) => value + 1);
  }, [deferredHtml, deferredCss, deferredUrl, inputMode]);

  useEffect(() => {
    if (inputMode !== "url") {
      setRemoteDocument((current) => ({
        ...current,
        status: "idle",
        html: "",
        finalUrl: "",
        warning: "",
        error: "",
      }));
      return;
    }

    if (!deferredUrl) {
      setRemoteDocument({
        status: "idle",
        html: "",
        finalUrl: "",
        warning: "",
        error: "",
      });
      return;
    }

    let cancelled = false;
    const controller = new AbortController();

    setRemoteDocument({
      status: "loading",
      html: "",
      finalUrl: "",
      warning: "",
      error: "",
    });
    setIssuesByDevice({
      mobile: [],
      tablet: [],
      desktop: [],
    });

    fetch(`/__rld/fetch?url=${encodeURIComponent(deferredUrl)}`, {
      signal: controller.signal,
    })
      .then(async (response) => {
        const payload = await response.json();
        if (!response.ok) {
          throw new Error(payload.error || "Unable to inspect that URL.");
        }
        if (cancelled) {
          return;
        }
        setRemoteDocument({
          status: "ready",
          html: payload.html || "",
          finalUrl: payload.finalUrl || deferredUrl,
          warning: payload.warning || "",
          error: "",
        });
      })
      .catch((error) => {
        if (cancelled || error.name === "AbortError") {
          return;
        }
        setRemoteDocument({
          status: "error",
          html: "",
          finalUrl: "",
          warning: "",
          error: error.message || "Unable to inspect that URL.",
        });
      });

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [deferredUrl, inputMode]);

  useEffect(() => {
    document.documentElement.dataset.theme = darkMode ? "dark" : "light";
  }, [darkMode]);

  const flatIssues = useMemo(
    () =>
      DEVICES.flatMap((device) => issuesByDevice[device.id] || []).sort(
        (left, right) => (SEVERITY_RANK[right.severity] || 0) - (SEVERITY_RANK[left.severity] || 0),
      ),
    [issuesByDevice],
  );

  const summary = useMemo(
    () =>
      DEVICES.map((device) => ({
        ...device,
        count: issuesByDevice[device.id]?.length || 0,
      })),
    [issuesByDevice],
  );

  const causeGroups = useMemo(() => {
    const grouped = new Map();

    for (const issue of flatIssues) {
      const key = issue.cause || issue.type;
      const current = grouped.get(key) || {
        id: key,
        cause: issue.cause || issue.type,
        causeLabel: issue.causeLabel || issue.label,
        severity: issue.severity || "medium",
        fix: issue.fix,
        rationale: new Set(),
        selectors: new Set(),
        devices: new Set(),
        issues: [],
      };

      current.issues.push(issue);
      current.selectors.add(issue.selector);
      current.devices.add(issue.deviceId);
      if (issue.rationale) {
        current.rationale.add(issue.rationale);
      }
      if ((SEVERITY_RANK[issue.severity] || 0) > (SEVERITY_RANK[current.severity] || 0)) {
        current.severity = issue.severity;
        current.fix = issue.fix;
      }
      grouped.set(key, current);
    }

    return Array.from(grouped.values())
      .map((entry) => ({
        ...entry,
        selectors: Array.from(entry.selectors),
        devices: Array.from(entry.devices),
        rationale: Array.from(entry.rationale),
        explanation: buildCauseExplanation(entry),
      }))
      .sort(
        (left, right) => (SEVERITY_RANK[right.severity] || 0) - (SEVERITY_RANK[left.severity] || 0),
      );
  }, [flatIssues]);

  const comparisons = useMemo(() => {
    const grouped = new Map();

    for (const issue of flatIssues) {
      const key = `${issue.selector}::${issue.type}`;
      const entry = grouped.get(key) || {
        selector: issue.selector,
        type: issue.type,
        label: issue.label,
        devices: new Set(),
        severity: issue.severity || "medium",
      };
      entry.devices.add(issue.deviceId);
      if ((SEVERITY_RANK[issue.severity] || 0) > (SEVERITY_RANK[entry.severity] || 0)) {
        entry.severity = issue.severity;
      }
      grouped.set(key, entry);
    }

    return Array.from(grouped.values())
      .filter((entry) => entry.devices.size > 0 && entry.devices.size < DEVICES.length)
      .map((entry) => {
        const affected = Array.from(entry.devices);
        const healthy = DEVICES.map((device) => device.id).filter((id) => !entry.devices.has(id));
        const firstIssue = flatIssues.find(
          (issue) => issue.selector === entry.selector && issue.type === entry.type,
        );

        return {
          id: `comparison::${entry.selector}::${entry.type}`,
          selector: entry.selector,
          label: `${entry.label} only appears on some screen sizes`,
          explanation: `This ${entry.label.toLowerCase()} appears on ${affected.join(", ")} but not on ${healthy.join(", ")}. That usually means the element only runs out of room once the viewport gets narrow enough for its current width, wrapping, or positioning rules to break down.`,
          fix: buildComparisonFix(entry.type),
          issueId: firstIssue?.issueId,
          deviceId: firstIssue?.deviceId,
          severity: entry.severity,
        };
      })
      .sort(
        (left, right) => (SEVERITY_RANK[right.severity] || 0) - (SEVERITY_RANK[left.severity] || 0),
      );
  }, [flatIssues]);

  const normalizedSearch = searchQuery.trim().toLowerCase();

  const filteredIssues = useMemo(
    () =>
      flatIssues.filter((issue) => {
        const matchesSeverity =
          severityFilter === "all" ? true : (issue.severity || "medium") === severityFilter;
        const matchesDevice = deviceFilter === "all" ? true : issue.deviceId === deviceFilter;
        const matchesSearch =
          normalizedSearch.length === 0
            ? true
            : [
                issue.selector,
                issue.label,
                issue.explanation,
                issue.fix,
                issue.causeLabel,
                issue.rationale,
              ]
                .filter(Boolean)
                .some((value) => value.toLowerCase().includes(normalizedSearch));
        return matchesSeverity && matchesDevice && matchesSearch;
      }),
    [deviceFilter, flatIssues, normalizedSearch, severityFilter],
  );

  const filteredCauseGroups = useMemo(
    () =>
      causeGroups.filter((group) => {
        const matchesSeverity =
          severityFilter === "all" ? true : (group.severity || "medium") === severityFilter;
        const matchesDevice =
          deviceFilter === "all" ? true : group.devices.includes(deviceFilter);
        const matchesSearch =
          normalizedSearch.length === 0
            ? true
            : [group.causeLabel, group.explanation, group.fix, group.selectors.join(", ")]
                .filter(Boolean)
                .some((value) => value.toLowerCase().includes(normalizedSearch));
        return matchesSeverity && matchesDevice && matchesSearch;
      }),
    [causeGroups, deviceFilter, normalizedSearch, severityFilter],
  );

  const filteredComparisons = useMemo(
    () =>
      comparisons.filter((comparison) => {
        const matchesSeverity =
          severityFilter === "all" ? true : (comparison.severity || "medium") === severityFilter;
        const matchesDevice =
          deviceFilter === "all" ? true : comparison.deviceId === deviceFilter;
        const matchesSearch =
          normalizedSearch.length === 0
            ? true
            : [comparison.selector, comparison.label, comparison.explanation, comparison.fix]
                .filter(Boolean)
                .some((value) => value.toLowerCase().includes(normalizedSearch));
        return matchesSeverity && matchesDevice && matchesSearch;
      }),
    [comparisons, deviceFilter, normalizedSearch, severityFilter],
  );

  const exportReport = () => {
    const payload = {
      generatedAt: new Date().toISOString(),
      mode: inputMode,
      source:
        inputMode === "code"
          ? { type: "code", htmlLength: html.length, cssLength: css.length }
          : {
              type: "url",
              requestedUrl: url,
              finalUrl: remoteDocument.finalUrl || "",
              status: remoteDocument.status,
              warning: remoteDocument.warning,
            },
      summary,
      totals: {
        issues: flatIssues.length,
        filteredIssues: filteredIssues.length,
        causeGroups: causeGroups.length,
        comparisons: comparisons.length,
      },
      baselineReview,
      regressionSummary: baselineReview ? buildRegressionSummary(baselineReview.summary, summary) : [],
      causeGroups,
      comparisons,
      issues: flatIssues,
    };

    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: "application/json;charset=utf-8",
    });
    const href = URL.createObjectURL(blob);
    const link = document.createElement("a");
    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    link.href = href;
    link.download = `responsive-layout-report-${stamp}.json`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(href);
  };

  const handleCaptureBaseline = async () => {
    const snapshots = [];

    for (const device of DEVICES) {
      const frame = document.querySelector(`iframe[title="${device.label}"]`);
      const capture = await captureDeviceSnapshot(frame);
      if (capture) {
        snapshots.push({
          deviceId: device.id,
          label: device.label,
          ...capture,
        });
      }
    }

    setBaselineReview({
      createdAt: new Date().toISOString(),
      summary,
      snapshots,
    });
  };

  const regressionSummary = useMemo(
    () => (baselineReview ? buildRegressionSummary(baselineReview.summary, summary) : []),
    [baselineReview, summary],
  );

  const handleIssueClick = (issue) => {
    if (!issue?.issueId || !issue.deviceId) return;

    const label = DEVICES.find((device) => device.id === issue.deviceId)?.label;
    const frame = label ? document.querySelector(`iframe[title="${label}"]`) : null;

    frame?.contentWindow?.postMessage(
      {
        type: "RLD_FOCUS_ISSUE",
        payload: { issueId: issue.issueId },
      },
      "*",
    );
  };

  const handleRun = () => {
    const nextKey = refreshKey + 1;
    setRefreshKey(nextKey);
    document.querySelectorAll("iframe").forEach((frame) => {
      frame.contentWindow?.postMessage(
        {
          type: "RLD_TOGGLE_ISSUES",
          payload: { visible: showIssues, refreshKey: nextKey },
        },
        "*",
      );
    });
  };

  return (
    <div className="app-shell">
      <TopBar
        inputMode={inputMode}
        setInputMode={setInputMode}
        html={html}
        setHtml={setHtml}
        css={css}
        setCss={setCss}
        url={url}
        setUrl={setUrl}
        showIssues={showIssues}
        setShowIssues={setShowIssues}
        darkMode={darkMode}
        setDarkMode={setDarkMode}
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        severityFilter={severityFilter}
        setSeverityFilter={setSeverityFilter}
        deviceFilter={deviceFilter}
        setDeviceFilter={setDeviceFilter}
        onRun={handleRun}
        onExport={exportReport}
        onCaptureBaseline={handleCaptureBaseline}
        hasBaseline={Boolean(baselineReview)}
        summary={summary}
        remoteDocument={remoteDocument}
      />

      <main className="workspace">
        <section className="workspace-main">
          <RegressionPanel baseline={baselineReview} regressionSummary={regressionSummary} />

          <section className="preview-grid">
            {DEVICES.map((device) => (
              <DevicePreview
                key={device.id}
                device={device}
                html={deferredHtml}
                css={deferredCss}
                inputMode={inputMode}
                url={deferredUrl}
                remoteDocument={remoteDocument}
                refreshKey={refreshKey}
                showIssues={showIssues}
              />
            ))}
          </section>
        </section>

        <IssuesSidebar
          causeGroups={filteredCauseGroups}
          issues={filteredIssues}
          comparisons={filteredComparisons}
          hasFilters={
            normalizedSearch.length > 0 || severityFilter !== "all" || deviceFilter !== "all"
          }
          onIssueClick={handleIssueClick}
        />
      </main>
    </div>
  );
}
