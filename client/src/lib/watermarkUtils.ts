/** Build a tiled watermark as a base64 PNG data URL using canvas */
export function buildWatermarkDataUrl(text: string): string {
  const canvas = document.createElement("canvas");
  const tileW = 320;
  const tileH = 160;
  canvas.width = tileW;
  canvas.height = tileH;
  const ctx = canvas.getContext("2d")!;

  ctx.clearRect(0, 0, tileW, tileH);
  ctx.save();

  // Rotate around tile centre
  ctx.translate(tileW / 2, tileH / 2);
  ctx.rotate(-Math.PI / 6); // -30°

  ctx.font = "600 15px system-ui, sans-serif";
  ctx.fillStyle = "rgba(0,0,0,0.07)";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  // Draw the text centred — it will tile seamlessly
  ctx.fillText(text, 0, 0);

  ctx.restore();
  return canvas.toDataURL("image/png");
}
