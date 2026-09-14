/** Bounding box of visible pixels, independent of canvas/WebGL for testing. */
export function alphaBounds(pixels, width, height, threshold = 16) {
  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      if (pixels[(y * width + x) * 4 + 3] <= threshold) continue;
      minX = Math.min(minX, x);
      maxX = Math.max(maxX, x);
      minY = Math.min(minY, y);
      maxY = Math.max(maxY, y);
    }
  }
  return maxX < minX ? null : { x: minX, y: minY, width: maxX - minX + 1, height: maxY - minY + 1 };
}

/** Remove camera margins, not anatomy or equipment. Keep the complete alpha
 * silhouette inside a small margin at the original canvas resolution.
 */
export function renderPortraitImage(source) {
  const output = document.createElement("canvas");
  output.width = source.width;
  output.height = source.height;
  const context = output.getContext("2d");
  if (!context) return source.toDataURL("image/webp", .85);
  context.drawImage(source, 0, 0);
  const pixels = context.getImageData(0, 0, output.width, output.height).data;
  const bounds = alphaBounds(pixels, output.width, output.height);
  if (bounds) {
    const scale = Math.min(output.width * .94 / bounds.width, output.height * .96 / bounds.height);
    const width = bounds.width * scale;
    const height = bounds.height * scale;
    context.clearRect(0, 0, output.width, output.height);
    context.drawImage(source, bounds.x, bounds.y, bounds.width, bounds.height,
      (output.width - width) / 2, (output.height - height) / 2, width, height);
  }
  return output.toDataURL("image/webp", .85);
}
