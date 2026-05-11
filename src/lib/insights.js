export const SEVERITY_RANK = {
  high: 3,
  medium: 2,
  low: 1,
};

export function buildCauseExplanation(entry) {
  const selectors = Array.from(entry.selectors || []);
  const devices = Array.from(entry.devices || []);
  const rationaleList = Array.from(entry.rationale || []);
  const selectorPreview = selectors.slice(0, 3).join(", ");
  const extraSelectors =
    selectors.length > 3 ? ` and ${selectors.length - 3} more elements` : "";
  const devicePreview = devices.join(", ");
  const rationale = rationaleList[0] ? ` ${rationaleList[0]}` : "";

  return `${entry.causeLabel} affects ${selectorPreview}${extraSelectors} on ${devicePreview}.${rationale}`;
}

export function buildComparisonFix(type) {
  switch (type) {
    case "missing-flex-wrap":
      return "Check whether the layout should wrap or switch to a stacked direction on smaller breakpoints.";
    case "fixed-width":
      return "Replace fixed pixel widths with fluid sizing rules and confirm mobile breakpoints override them.";
    case "min-width-shrink-blocker":
      return "Audit flex/grid children for min-width constraints and add min-width: 0 where shrinking should be allowed.";
    case "absolute-offscreen":
      return "Review breakpoint-specific offsets so positioned elements stay anchored inside the viewport.";
    case "image-scaling":
      return "Constrain media with max-width: 100% and make sure larger desktop sizing rules do not leak into mobile.";
    default:
      return "Compare widths, wrapping rules, and min-width behavior between breakpoints.";
  }
}

export function buildRegressionSummary(baselineSummary, currentSummary) {
  return currentSummary.map((currentItem) => {
    const baselineItem = baselineSummary.find((item) => item.id === currentItem.id);
    const baselineCount = baselineItem?.count || 0;
    return {
      id: currentItem.id,
      label: currentItem.label,
      baselineCount,
      currentCount: currentItem.count,
      delta: currentItem.count - baselineCount,
    };
  });
}
