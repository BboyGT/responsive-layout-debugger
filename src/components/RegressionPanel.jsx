export function RegressionPanel({ baseline, regressionSummary }) {
  if (!baseline || regressionSummary.length === 0) {
    return null;
  }

  return (
    <section className="regression-panel">
      <div className="regression-panel__header">
        <div>
          <p className="eyebrow">Regression Review</p>
          <h2>Compare the current run against your saved baseline.</h2>
        </div>
        <span className="device-pill">Captured {new Date(baseline.createdAt).toLocaleString()}</span>
      </div>

      <div className="regression-grid">
        {regressionSummary.map((item) => (
          <div key={item.id} className="regression-card">
            <strong>{item.label}</strong>
            <span>Baseline: {item.baselineCount}</span>
            <span>Current: {item.currentCount}</span>
            <span className={item.delta > 0 ? "delta delta--up" : item.delta < 0 ? "delta delta--down" : "delta"}>
              Delta: {item.delta > 0 ? `+${item.delta}` : item.delta}
            </span>
          </div>
        ))}
      </div>

      <div className="snapshot-grid">
        {baseline.snapshots.map((snapshot) => (
          <figure key={snapshot.deviceId} className="snapshot-card">
            <figcaption>
              <strong>{snapshot.label}</strong>
              <span>Baseline capture</span>
            </figcaption>
            <img src={snapshot.dataUrl} alt={`${snapshot.label} baseline snapshot`} />
          </figure>
        ))}
      </div>
    </section>
  );
}
