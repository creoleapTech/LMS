import { parsePptx } from "./client/src/lib/pptx-parser";
import { readFileSync } from "fs";

const filePath = process.argv[2] || "ESP32_Introduction.pptx";

async function main() {
  console.log(`\n=== PPTX Parser Test ===`);
  console.log(`File: ${filePath}`);

  const buffer = readFileSync(filePath);
  console.log(`File size: ${buffer.length} bytes`);

  const startTime = performance.now();
  const presentation = await parsePptx(buffer.buffer);
  const elapsed = performance.now() - startTime;

  console.log(`\nParse time: ${elapsed.toFixed(1)}ms`);
  console.log(`\nSlide dimensions: ${presentation.slideWidth} x ${presentation.slideHeight} EMU`);
  console.log(`Slide dimensions: ${(presentation.slideWidth / 914400).toFixed(2)}" x ${(presentation.slideHeight / 914400).toFixed(2)}"`);
  console.log(`Total slides: ${presentation.slides.length}`);

  for (let i = 0; i < presentation.slides.length; i++) {
    const slide = presentation.slides[i];
    console.log(`\n--- Slide ${i + 1} ---`);
    console.log(`  Background: ${slide.background?.type || "none"} ${slide.background?.color || ""}`);
    console.log(`  Elements: ${slide.elements.length}`);

    for (let j = 0; j < slide.elements.length; j++) {
      const el = slide.elements[j];
      const pos = el.position;
      console.log(`    [${j}] type=${el.type} pos=(${(pos.x / 914400).toFixed(2)}", ${(pos.y / 914400).toFixed(2)}") size=${(pos.width / 914400).toFixed(2)}"x${(pos.height / 914400).toFixed(2)}"`);

      if (el.type === "text" && el.paragraphs) {
        for (const para of el.paragraphs) {
          const text = para.runs.map(r => r.text).join("");
          if (text.trim()) {
            console.log(`      text: "${text.substring(0, 80)}${text.length > 80 ? "..." : ""}"`);
          }
        }
      }
      if (el.type === "image") {
        console.log(`      image: ${el.imageData ? el.imageData.substring(0, 50) + "..." : "no data"}`);
      }
      if (el.type === "table" && el.table) {
        console.log(`      table: ${el.table.rows.length} rows x ${el.table.gridCols.length} cols`);
      }
    }
  }

  console.log("\n=== Test Complete ===\n");
}

main().catch(console.error);
