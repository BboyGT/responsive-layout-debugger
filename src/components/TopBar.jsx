export function TopBar({
  inputMode,
  setInputMode,
  html,
  setHtml,
  css,
  setCss,
  url,
  setUrl,
  showIssues,
  setShowIssues,
  darkMode,
  setDarkMode,
  searchQuery,
  setSearchQuery,
  severityFilter,
  setSeverityFilter,
  deviceFilter,
  setDeviceFilter,
  onRun,
  onExport,
  onCaptureBaseline,
  hasBaseline,
  summary,
  remoteDocument,
}) {
  const modeDescription =
    inputMode === "code"
      ? "Live HTML/CSS inspection with overlays and issue explanations."
      : remoteDocument.status === "loading"
        ? "Fetching and rewriting the remote page for safe inspection."
        : remoteDocument.status === "error"
          ? remoteDocument.error
          : remoteDocument.warning ||
            "Remote HTML is fetched locally, scripts are stripped, and the sanitized page is analyzed in the iframe.";
  const modeTitle =
    inputMode === "code"
      ? "Analysis mode"
      : remoteDocument.status === "loading"
        ? "Loading URL"
        : remoteDocument.status === "error"
          ? "URL inspection error"
          : "URL inspection";

  return (
    <header className="topbar">
      <div className="topbar__heading">
        <p className="eyebrow">Responsive Layout Debugger</p>
        <h1>Find layout bugs before your users do.</h1>
      </div>

      <div className="toolbar">
        <div className="toolbar__toggle">
          <button
            type="button"
            className={inputMode === "code" ? "is-active" : ""}
            onClick={() => setInputMode("code")}
          >
            HTML + CSS
          </button>
          <button
            type="button"
            className={inputMode === "url" ? "is-active" : ""}
            onClick={() => setInputMode("url")}
          >
            Live URL
          </button>
        </div>

        <div className="toolbar__actions">
          <label className="switch">
            <input
              type="checkbox"
              checked={showIssues}
              onChange={(event) => setShowIssues(event.target.checked)}
            />
            <span>Show overlays</span>
          </label>
          <label className="switch">
            <input
              type="checkbox"
              checked={darkMode}
              onChange={(event) => setDarkMode(event.target.checked)}
            />
            <span>Dark mode</span>
          </label>
          <button type="button" className="ghost-button" onClick={onExport}>
            Export report
          </button>
          <button type="button" className="ghost-button" onClick={onCaptureBaseline}>
            {hasBaseline ? "Refresh baseline" : "Capture baseline"}
          </button>
          <button type="button" className="run-button" onClick={onRun}>
            Run analysis
          </button>
        </div>
      </div>

      <div className="status-strip">
        <div className="status-card">
          <strong>{modeTitle}</strong>
          <span>{modeDescription}</span>
        </div>
        <div className="status-card status-card--counts">
          {summary.map((item) => (
            <div key={item.id} className="count-chip">
              <strong>{item.label}</strong>
              <span>{item.count} issues</span>
            </div>
          ))}
        </div>
      </div>

      <div className="filters-bar">
        <label className="filter-card filter-card--search">
          <span>Search findings</span>
          <input
            type="text"
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            placeholder="Search selector, cause, fix..."
          />
        </label>
        <label className="filter-card">
          <span>Severity</span>
          <select value={severityFilter} onChange={(event) => setSeverityFilter(event.target.value)}>
            <option value="all">All severities</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </select>
        </label>
        <label className="filter-card">
          <span>Device</span>
          <select value={deviceFilter} onChange={(event) => setDeviceFilter(event.target.value)}>
            <option value="all">All devices</option>
            <option value="mobile">Mobile</option>
            <option value="tablet">Tablet</option>
            <option value="desktop">Desktop</option>
          </select>
        </label>
      </div>

      {inputMode === "code" ? (
        <div className="editor-grid">
          <label className="editor-card">
            <span>HTML</span>
            <textarea
              value={html}
              onChange={(event) => setHtml(event.target.value)}
              spellCheck="false"
            />
          </label>
          <label className="editor-card">
            <span>CSS</span>
            <textarea
              value={css}
              onChange={(event) => setCss(event.target.value)}
              spellCheck="false"
            />
          </label>
        </div>
      ) : (
        <label className="url-card">
          <span>Live URL</span>
          <input
            type="url"
            value={url}
            onChange={(event) => setUrl(event.target.value)}
            placeholder="https://example.com"
          />
          <small>
            External URLs are previewed in a sandboxed iframe. Deep inspection is
            limited by browser security unless the content is provided as HTML + CSS.
          </small>
        </label>
      )}
    </header>
  );
}
