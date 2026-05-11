import { useEffect, useMemo, useRef } from "react";

export function DevicePreview({
  device,
  html,
  css,
  inputMode,
  url,
  remoteDocument,
  refreshKey,
  showIssues,
}) {
  const iframeRef = useRef(null);

  const srcDoc = useMemo(() => {
    if (inputMode === "url") {
      if (!remoteDocument?.html) {
        return "";
      }

      return buildPreviewDocument({
        html: remoteDocument.html,
        css: "",
        deviceId: device.id,
        baseHref: remoteDocument.finalUrl,
      });
    }

    if (inputMode !== "code") {
      return "";
    }

    const safeHtml = sanitizeHtml(html || "<main><p>Add HTML to inspect your layout.</p></main>");
    const safeCss = sanitizeCss(css || "body { font-family: sans-serif; padding: 24px; }");

    return buildPreviewDocument({
      html: safeHtml,
      css: safeCss,
      deviceId: device.id,
    });
  }, [css, device.id, html, inputMode, remoteDocument]);

  useEffect(() => {
    if (!iframeRef.current?.contentWindow || !srcDoc) {
      return;
    }

    const timer = window.setTimeout(() => {
      iframeRef.current.contentWindow.postMessage(
        {
          type: "RLD_TOGGLE_ISSUES",
          payload: { visible: showIssues, refreshKey },
        },
        "*",
      );
    }, 120);

    return () => window.clearTimeout(timer);
  }, [refreshKey, showIssues, srcDoc]);

  return (
    <section className="device-card">
      <div className="device-card__header">
        <div>
          <h2>{device.label}</h2>
          <p>{device.width}px viewport</p>
        </div>
        <span className="device-pill">{device.description}</span>
      </div>

      <div className="device-shell" style={{ width: `${device.width}px` }}>
        <iframe
          ref={iframeRef}
          title={device.label}
          className="device-frame"
          sandbox="allow-scripts"
          srcDoc={srcDoc}
        />
        {!srcDoc && inputMode === "url" && (
          <div className="device-frame__message">
            <strong>
              {remoteDocument?.status === "error" ? "URL analysis failed" : "Waiting for URL analysis"}
            </strong>
            <span>
              {remoteDocument?.status === "error"
                ? remoteDocument.error
                : url
                  ? "Fetch the page to inspect its layout across devices."
                  : "Paste a full URL to begin."}
            </span>
          </div>
        )}
      </div>
    </section>
  );
}

function buildPreviewDocument({ html, css, deviceId, baseHref }) {
  const safeBase = baseHref ? `<base href="${baseHref}">` : "";

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    ${safeBase}
    <style>
      * { box-sizing: border-box; }
      html, body { margin: 0; min-height: 100%; }
      body { font-family: system-ui, sans-serif; background: white; }
      ${css}
    </style>
  </head>
  <body>
    ${html}
    <script>${buildIframeScript(deviceId)}</script>
  </body>
</html>`;
}

function buildIframeScript(deviceId) {
  return `
    (() => {
      const DEVICE_ID = ${JSON.stringify(deviceId)};
      const ISSUE_STROKE = "#ff4d5e";
      const ISSUE_FILL = "rgba(255, 77, 94, 0.12)";
      let overlaysVisible = true;
      let issueRegistry = new Map();
      let cleanupFns = [];

      const makeSelector = (element) => {
        if (!element || element === document.body) return "body";
        if (element.id) return "#" + element.id;

        const parts = [];
        let current = element;
        while (current && current.nodeType === 1 && current !== document.body && parts.length < 4) {
          let part = current.tagName.toLowerCase();
          if (current.classList.length) {
            part += "." + Array.from(current.classList).slice(0, 2).join(".");
          }
          const siblings = current.parentElement
            ? Array.from(current.parentElement.children).filter((child) => child.tagName === current.tagName)
            : [];
          if (siblings.length > 1) {
            part += ":nth-of-type(" + (siblings.indexOf(current) + 1) + ")";
          }
          parts.unshift(part);
          current = current.parentElement;
        }
        return parts.join(" > ");
      };

      const createIssue = (element, config) => {
        const rect = element.getBoundingClientRect();
        const selector = makeSelector(element);
        return {
          id: DEVICE_ID + "::" + config.type + "::" + selector,
          issueId: DEVICE_ID + "::" + config.type + "::" + selector,
          deviceId: DEVICE_ID,
          selector,
          type: config.type,
          label: config.label,
          explanation: config.explanation,
          fix: config.fix,
          cause: config.cause,
          causeLabel: config.causeLabel,
          rationale: config.rationale || "",
          rect: {
            top: rect.top + window.scrollY,
            left: rect.left + window.scrollX,
            width: rect.width,
            height: rect.height
          },
          severity: "medium"
        };
      };

      const withSeverity = (issue, severity) => ({
        ...issue,
        severity
      });

      const approxOverflowX = (element, rect) => {
        const widthOverflow = element.scrollWidth - element.clientWidth > 1;
        const viewportOverflow = rect.left < -1 || rect.right - window.innerWidth > 1;
        return widthOverflow || viewportOverflow;
      };

      const approxOverflowY = (element) => {
        if (element.clientHeight === 0) return false;
        return element.scrollHeight - element.clientHeight > 1;
      };

      const getNumeric = (value) => {
        const parsed = parseFloat(value);
        return Number.isFinite(parsed) ? parsed : null;
      };

      const widthLooksFixed = (style) => {
        const value = style.width || "";
        if (!value.endsWith("px")) return false;
        if (["auto", "max-content", "min-content", "fit-content"].includes(value)) return false;
        return true;
      };

      const imagesNeedContainment = (element, style, parentRect, rect) => {
        if (element.tagName !== "IMG") return false;
        const lacksConstraint =
          style.maxWidth === "none" &&
          style.width !== "100%" &&
          !style.width.includes("%") &&
          !style.width.includes("vw");
        return lacksConstraint && rect.width > ((parentRect && parentRect.width) || window.innerWidth) + 1;
      };

      const issuePriority = {
        high: 3,
        medium: 2,
        low: 1
      };

      const overlayRoot = document.createElement("div");
      Object.assign(overlayRoot.style, {
        position: "absolute",
        inset: "0",
        pointerEvents: "none",
        zIndex: "2147483647"
      });

      const ensureOverlayRoot = () => {
        if (!overlayRoot.isConnected) {
          document.body.appendChild(overlayRoot);
        }
        overlayRoot.style.display = overlaysVisible ? "block" : "none";
      };

      const clearDecorations = () => {
        cleanupFns.forEach((fn) => fn());
        cleanupFns = [];
        overlayRoot.innerHTML = "";
        issueRegistry.clear();
      };

      const drawOverlay = (issue, element) => {
        issueRegistry.set(issue.id, element);
        const rect = issue.rect;

        const box = document.createElement("div");
        Object.assign(box.style, {
          position: "absolute",
          left: rect.left + "px",
          top: rect.top + "px",
          width: Math.max(rect.width, 12) + "px",
          height: Math.max(rect.height, 12) + "px",
          border: "2px solid " + ISSUE_STROKE,
          background: ISSUE_FILL,
          borderRadius: "6px"
        });

        const label = document.createElement("div");
        label.textContent = issue.label;
        Object.assign(label.style, {
          position: "absolute",
          left: rect.left + "px",
          top: Math.max(rect.top - 26, 0) + "px",
          background: ISSUE_STROKE,
          color: "white",
          padding: "4px 8px",
          borderRadius: "999px",
          font: "600 11px/1.2 system-ui, sans-serif",
          boxShadow: "0 8px 20px rgba(0,0,0,0.18)"
        });

        overlayRoot.appendChild(box);
        overlayRoot.appendChild(label);

        const previousOutline = element.style.outline;
        const previousOffset = element.style.outlineOffset;
        element.style.outline = "2px solid " + ISSUE_STROKE;
        element.style.outlineOffset = "1px";
        cleanupFns.push(() => {
          element.style.outline = previousOutline;
          element.style.outlineOffset = previousOffset;
        });
      };

      const analyze = () => {
        ensureOverlayRoot();
        clearDecorations();

        const allElements = Array.from(document.body.querySelectorAll("*"));
        const issues = [];

        for (const element of allElements) {
          if (!(element instanceof HTMLElement)) continue;
          if (element === overlayRoot || overlayRoot.contains(element)) continue;

          const style = window.getComputedStyle(element);
          const rect = element.getBoundingClientRect();
          const parent = element.parentElement;
          const parentStyle = parent ? window.getComputedStyle(parent) : null;
          const parentRect = parent ? parent.getBoundingClientRect() : null;
          const rectOverflowX = Math.max(0, rect.right - window.innerWidth) + Math.max(0, -rect.left);
          const rectOverflowY = Math.max(0, rect.bottom - window.innerHeight) + Math.max(0, -rect.top);

          if (rect.width === 0 && rect.height === 0) continue;

          if (approxOverflowX(element, rect)) {
            issues.push(
              withSeverity(
                createIssue(element, {
                  type: "horizontal-overflow",
                  label: "Overflow detected",
                  cause: "container-width-mismatch",
                  causeLabel: "Element is wider than the available space",
                  explanation:
                    "This element is wider than its container or extends beyond the viewport, which often causes horizontal scrolling on smaller screens.",
                  fix: "Reduce fixed widths, use max-width: 100%, or allow the layout to wrap.",
                  rationale:
                    rectOverflowX > 0
                      ? "Its rendered box crosses the viewport boundary at this breakpoint."
                      : "Its internal content is wider than the element's available content box.",
                }),
                rectOverflowX > 40 ? "high" : "medium"
              )
            );
          }

          if (
            approxOverflowY(element) &&
            ["hidden", "scroll", "auto", "clip"].includes(style.overflowY || style.overflow)
          ) {
            issues.push(
              withSeverity(
                createIssue(element, {
                  type: "vertical-overflow",
                  label: "Content overflow",
                  cause: "height-constraint",
                  causeLabel: "Container height is too constrained",
                  explanation:
                    "The content inside this element is taller than the space available, so some of it may be clipped or require scrolling.",
                  fix: "Increase available height, remove fixed heights, or adjust overflow behavior.",
                  rationale:
                    "The element's scrollHeight is larger than its clientHeight while overflow is constrained.",
                }),
                rectOverflowY > 80 || element.scrollHeight - element.clientHeight > 80 ? "high" : "medium"
              )
            );
          }

          const fixedWidth = parseFloat(style.width);
          if (
            widthLooksFixed(style) &&
            Number.isFinite(fixedWidth) &&
            fixedWidth > Math.min(window.innerWidth * 0.6, 420) &&
            window.innerWidth < 1100
          ) {
            issues.push(
              withSeverity(
                createIssue(element, {
                  type: "fixed-width",
                  label: "Fixed width may break responsiveness",
                  cause: "fixed-dimension",
                  causeLabel: "A fixed width is preventing the layout from shrinking",
                  explanation:
                    "This element uses a fixed pixel width, so it cannot shrink smoothly on narrower screens.",
                  fix: "Replace fixed width with width: 100%, max-width, clamp(), or responsive media queries.",
                  rationale: "The computed width stays in pixels instead of adapting to the viewport or parent width.",
                }),
                fixedWidth > window.innerWidth ? "high" : "medium"
              )
            );
          }

          if (style.display === "flex" && style.flexWrap === "nowrap") {
            const totalChildWidth = Array.from(element.children).reduce((sum, child) => {
              const childRect = child.getBoundingClientRect();
              const childStyle = window.getComputedStyle(child);
              const margins =
                (getNumeric(childStyle.marginLeft) || 0) + (getNumeric(childStyle.marginRight) || 0);
              return sum + childRect.width + margins;
            }, 0);
            const gapX = getNumeric(style.columnGap) || getNumeric(style.gap) || 0;
            const totalWidthWithGap = totalChildWidth + gapX * Math.max(element.children.length - 1, 0);
            if (totalWidthWithGap - rect.width > 2) {
              issues.push(
                withSeverity(
                  createIssue(element, {
                    type: "missing-flex-wrap",
                    label: "Flex items do not wrap",
                    cause: "single-line-flex",
                    causeLabel: "A single-line flex row is forcing children to stay on one line",
                    explanation:
                      "This flex container keeps items on a single line even when they no longer fit, which can force overflow on smaller devices.",
                    fix: "Add flex-wrap: wrap or change the layout direction at smaller breakpoints.",
                    rationale:
                      "The combined child widths plus gaps exceed the flex container width while flex-wrap is nowrap.",
                  }),
                  totalWidthWithGap - rect.width > 80 ? "high" : "medium"
                )
              );
            }
          }

          if (
            parentStyle &&
            ["flex", "inline-flex", "grid", "inline-grid"].includes(parentStyle.display) &&
            (style.minWidth === "auto" || parseFloat(style.minWidth) > 0) &&
            rect.width > (parentRect ? parentRect.width : rect.width)
          ) {
            issues.push(
              withSeverity(
                createIssue(element, {
                  type: "min-width-shrink-blocker",
                  label: "Element resists shrinking",
                  cause: "shrink-blocked",
                  causeLabel: "The item cannot shrink with its layout container",
                  explanation:
                    "This item sits inside a flex or grid layout and its minimum width prevents it from shrinking with the container.",
                  fix: "Try adding min-width: 0 to the item so the layout can compress without overflow.",
                  rationale:
                    "The item is wider than its flex or grid parent and its minimum width behavior is blocking compression.",
                }),
                rect.width - (parentRect ? parentRect.width : rect.width) > 60 ? "high" : "medium"
              )
            );
          }

          if (imagesNeedContainment(element, style, parentRect, rect)) {
            issues.push(
              withSeverity(
                createIssue(element, {
                  type: "image-scaling",
                  label: "Image can exceed its container",
                  cause: "media-not-contained",
                  causeLabel: "Media is not constrained to its container width",
                  explanation:
                    "This image does not have a max-width constraint, so it can overflow on smaller screens.",
                  fix: "Add img { max-width: 100%; height: auto; }.",
                  rationale:
                    "The image width exceeds its parent width and no responsive max-width rule is present.",
                }),
                rect.width > window.innerWidth ? "high" : "medium"
              )
            );
          }

          if (
            ["absolute", "fixed"].includes(style.position) &&
            (rect.right > window.innerWidth + 1 ||
              rect.left < -1 ||
              rect.bottom > window.innerHeight + 1 ||
              rect.top < -1)
          ) {
            issues.push(
              withSeverity(
                createIssue(element, {
                  type: "absolute-offscreen",
                  label: "Positioned element is off-screen",
                  cause: "position-offset",
                  causeLabel: "Position offsets push the element outside the viewport",
                  explanation:
                    "This absolutely positioned element falls outside the visible canvas at this screen size, which usually means its offsets do not adapt responsively.",
                  fix: "Review top/right/bottom/left values and use responsive positioning rules or transforms.",
                  rationale:
                    "At this breakpoint the element's positioned box extends outside the viewport bounds.",
                }),
                rectOverflowX > 40 || rectOverflowY > 60 ? "high" : "medium"
              )
            );
          }
        }

        const uniqueIssues = Array.from(
          issues.reduce((map, issue) => {
            const dedupeKey = issue.deviceId + "::" + issue.selector + "::" + issue.type;
            const existing = map.get(dedupeKey);
            if (!existing || issuePriority[issue.severity] > issuePriority[existing.severity]) {
              map.set(dedupeKey, issue);
            }
            return map;
          }, new Map()).values()
        ).sort((left, right) => issuePriority[right.severity] - issuePriority[left.severity]);
        uniqueIssues.forEach((issue) => {
          const element = document.querySelector(issue.selector);
          if (element) drawOverlay(issue, element);
        });

        window.parent.postMessage(
          {
            type: "RLD_ANALYSIS_RESULT",
            payload: { deviceId: DEVICE_ID, issues: uniqueIssues }
          },
          "*"
        );
      };

      const focusIssue = (issueId) => {
        const target = issueRegistry.get(issueId);
        if (!target) return;
        target.scrollIntoView({ behavior: "smooth", block: "center", inline: "center" });
        const previousTransition = target.style.transition;
        const previousBoxShadow = target.style.boxShadow;
        target.style.transition = "box-shadow 120ms ease";
        target.style.boxShadow = "0 0 0 4px rgba(255, 77, 94, 0.35)";
        window.setTimeout(() => {
          target.style.transition = previousTransition;
          target.style.boxShadow = previousBoxShadow;
        }, 1200);
      };

      window.addEventListener("message", (event) => {
        if (!event.data || typeof event.data !== "object") return;
        if (event.data.type === "RLD_TOGGLE_ISSUES") {
          overlaysVisible = Boolean(event.data.payload && event.data.payload.visible);
          analyze();
        }
        if (event.data.type === "RLD_FOCUS_ISSUE") {
          focusIssue(event.data.payload && event.data.payload.issueId);
        }
      });

      window.addEventListener("load", analyze);
      window.addEventListener("resize", analyze);
      document.addEventListener("DOMContentLoaded", analyze);
      new ResizeObserver(() => analyze()).observe(document.body);
      window.setTimeout(analyze, 150);
    })();
  `;
}

function sanitizeHtml(value) {
  return value
    .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, "")
    .replace(/\son[a-z]+\s*=\s*(['"]).*?\1/gi, "")
    .replace(/\son[a-z]+\s*=\s*[^\s>]+/gi, "");
}

function sanitizeCss(value) {
  return value.replace(/<\/style>/gi, "<\\/style>");
}
