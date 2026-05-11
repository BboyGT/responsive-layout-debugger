const DEVICE_LABELS = {
  mobile: "Mobile",
  tablet: "Tablet",
  desktop: "Desktop",
};

function formatSeverity(severity) {
  if (!severity) return "Medium";
  return severity.charAt(0).toUpperCase() + severity.slice(1);
}

export function IssuesSidebar({
  causeGroups,
  issues,
  onIssueClick,
  comparisons,
  hasFilters,
}) {
  const hasActionableIssues = issues.length > 0 || comparisons.length > 0 || causeGroups.length > 0;

  return (
    <aside className="issues-sidebar">
      <div className="issues-sidebar__header">
        <p className="eyebrow">Issues</p>
        <h2>{issues.length + comparisons.length} findings</h2>
      </div>

      {!hasActionableIssues && (
        <div className="sidebar-note">
          <strong>{hasFilters ? "No matches" : "Ready to analyze"}</strong>
          <span>
            {hasFilters
              ? "Try broadening your search or clearing one of the active filters."
              : "Paste HTML and CSS or inspect a URL to get overlays, grouped causes, and click-to-focus findings."}
          </span>
        </div>
      )}

      {causeGroups.length > 0 && (
        <section className="issue-group">
          <h3>Likely root causes</h3>
          <div className="issue-list">
            {causeGroups.map((group) => (
              <div key={group.id} className="issue-row issue-row--grouped">
                <div className="issue-row__meta">
                  <strong>{group.causeLabel}</strong>
                  <span className={`severity-tag severity-tag--${group.severity || "medium"}`}>
                    {formatSeverity(group.severity)}
                  </span>
                </div>
                <span>{group.explanation}</span>
                <small>{group.fix}</small>
                <code>{group.selectors.slice(0, 3).join(", ")}</code>
              </div>
            ))}
          </div>
        </section>
      )}

      {comparisons.length > 0 && (
        <section className="issue-group">
          <h3>Cross-device differences</h3>
          <div className="issue-list">
            {comparisons.map((comparison) => (
              <button
                key={comparison.id}
                type="button"
                className="issue-row issue-row--comparison"
                onClick={() => onIssueClick(comparison)}
              >
                <div className="issue-row__meta">
                  <strong>{comparison.selector}</strong>
                  <span className={`severity-tag severity-tag--${comparison.severity || "medium"}`}>
                    {formatSeverity(comparison.severity)}
                  </span>
                </div>
                <span>{comparison.label}</span>
                <span>{comparison.explanation}</span>
                <small>{comparison.fix}</small>
              </button>
            ))}
          </div>
        </section>
      )}

      <section className="issue-group">
        <h3>Detected issues</h3>
        <div className="issue-list">
          {issues.length === 0 ? (
            <div className="empty-state">
              <p>No issues detected yet.</p>
              <small>Paste HTML + CSS and the analyzer will flag overflows and common responsive mistakes.</small>
            </div>
          ) : (
            issues.map((issue) => (
              <button
                key={issue.id}
                type="button"
                className="issue-row"
                onClick={() => onIssueClick(issue)}
              >
                <div className="issue-row__meta">
                  <strong>{issue.selector}</strong>
                  <div className="issue-row__badges">
                    <span className={`severity-tag severity-tag--${issue.severity || "medium"}`}>
                      {formatSeverity(issue.severity)}
                    </span>
                    <span className="device-tag">{DEVICE_LABELS[issue.deviceId] || issue.deviceId}</span>
                  </div>
                </div>
                <span>{issue.label}</span>
                <small>{issue.explanation}</small>
                {issue.rationale ? <small>{issue.rationale}</small> : null}
                <code>{issue.fix}</code>
              </button>
            ))
          )}
        </div>
      </section>
    </aside>
  );
}
