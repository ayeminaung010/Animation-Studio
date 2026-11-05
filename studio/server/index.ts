import http from "node:http";
import path from "node:path";
import { isSlugTaken } from "./engines.ts";
import { JobStore } from "./jobs.ts";
import { DATA, REPO } from "./paths.ts";
import { createHandler } from "./routes.ts";
import { createRunner } from "./runner.ts";
import { Hub } from "./sse.ts";
import { makeSuggest } from "./suggest.ts";

const HOST = "127.0.0.1";
const port = Number(process.env.STUDIO_PORT ?? 4317);

const store = new JobStore(DATA, isSlugTaken);
const recovered = store.recoverOnStartup();
if (recovered.length > 0) console.log(`Marked ${recovered.length} interrupted job(s) as failed (server restarted)`);

const hub = new Hub();
const runner = createRunner(store, (jobId, index, ev) => hub.publish(jobId, index, ev));
const handler = createHandler({
  store,
  runner,
  hub,
  port,
  suggest: makeSuggest(),
  webDir: path.join(REPO, "studio", "web"),
});

const server = http.createServer(handler);
server.on("error", (err) => {
  console.error(`Studio could not listen on ${HOST}:${port}: ${err.message}`);
  process.exit(1);
});
server.listen(port, HOST, () => {
  console.log(`Studio on http://${HOST}:${port}`);
});
