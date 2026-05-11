export async function captureDeviceSnapshot(frame) {
  const doc = frame?.contentDocument;
  if (!doc?.documentElement) {
    return null;
  }

  const width = Math.max(frame.clientWidth, doc.documentElement.scrollWidth, 320);
  const height = Math.min(
    Math.max(doc.documentElement.scrollHeight, frame.clientHeight, 320),
    1600,
  );
  const headMarkup = doc.head?.innerHTML || "";
  const bodyMarkup = doc.body?.innerHTML || "";
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
      <foreignObject width="100%" height="100%">
        <div xmlns="http://www.w3.org/1999/xhtml" style="width:${width}px;height:${height}px;overflow:hidden;background:white;">
          ${headMarkup}
          ${bodyMarkup}
        </div>
      </foreignObject>
    </svg>
  `;
  const dataUrl = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;

  return {
    width,
    height,
    dataUrl,
  };
}
