/**
 * Minimal TESTNET relayer process: status API only (GET /status, /messages).
 * Canonical copy — `scripts/testnet/run-relayer-status.mjs` is a thin wrapper.
 * Full watch→sign→deliver loop is next; this proves read-only endpoints for the frontend.
 *
 * Usage:
 *   RELAYER_ID=1 PORT=3101 node relayer/scripts/run-relayer-status.mjs
 */
import { createServer } from "node:http";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { computeAddress, SigningKey } from "ethers";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "../..");
const id = process.env.RELAYER_ID || "1";
const port = Number(process.env.PORT || 3100 + Number(id));
const pk = JSON.parse(readFileSync(resolve(ROOT, `secrets/relayers/${id}.json`), "utf8")).private_key;
const address = computeAddress(new SigningKey(pk).publicKey);

const payload = {
  ok: true,
  relayerId: Number(id),
  address,
  network: "sepolia-devnet",
  bridgeEndpoint: "0x577f3B58DF21357ED4F8AF6631d2017FAeE38389",
  solanaProgram: "2DvHn2Hxj3HFsbn2iDuBGL4TQAzTomcVCsDTPoZ2h1JL",
  messageCount: 0,
  reconcile: null,
  source: "relayer",
};

const server = createServer((req, res) => {
  if (req.method !== "GET") {
    res.writeHead(405, { Allow: "GET", "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "method_not_allowed", allowed: ["GET"] }));
    return;
  }
  const url = new URL(req.url || "/", `http://127.0.0.1:${port}`);
  if (url.pathname === "/status" || url.pathname === "/messages") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(
      JSON.stringify(
        url.pathname === "/messages" ? { source: "relayer", messages: [] } : payload,
      ),
    );
    return;
  }
  res.writeHead(404, { "Content-Type": "application/json" });
  res.end(JSON.stringify({ error: "not_found" }));
});

server.listen(port, "127.0.0.1", () => {
  console.log(`relayer-${id} ${address} status http://127.0.0.1:${port}/status`);
});
