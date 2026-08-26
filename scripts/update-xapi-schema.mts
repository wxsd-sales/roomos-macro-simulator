/**
 * Regenerates the vendored RoomOS xAPI schema used as the offline fallback for
 * editor IntelliSense and runtime validation.
 *
 * Usage: npm run schema:update
 */
import { writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { compactSchemaPayload } from "../src/modules/xapi/compactSchema.ts";
import { fetchLatestXapiSchema } from "../src/modules/xapi/schema.ts";

const OUTPUT_PATH = fileURLToPath(new URL("../src/modules/xapi/pinnedSchema.json", import.meta.url));

function formatBytes(bytes: number): string {
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}

async function main(): Promise<void> {
  console.log("Fetching latest RoomOS xAPI schema from Cisco...");
  const { schemaName, payload } = await fetchLatestXapiSchema();
  console.log(`Resolved schema: ${schemaName}`);

  const upstreamSize = JSON.stringify(payload).length;
  const compact = compactSchemaPayload(payload, schemaName);
  const serialized = JSON.stringify(compact);

  await writeFile(OUTPUT_PATH, `${serialized}\n`, "utf8");

  const counts = compact.objects.reduce<Record<string, number>>((totals, object) => {
    totals[object.t] = (totals[object.t] ?? 0) + 1;
    return totals;
  }, {});

  console.log(`Wrote ${OUTPUT_PATH}`);
  console.log(`  upstream: ${formatBytes(upstreamSize)}  ->  vendored: ${formatBytes(serialized.length)}`);
  console.log(`  objects: ${compact.objects.length}`, counts);
  console.log(`  products: ${compact.products.length}`);
}

main().catch((error: unknown) => {
  console.error("Failed to update the xAPI schema:", error);
  process.exitCode = 1;
});
