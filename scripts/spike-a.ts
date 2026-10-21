// Spike A: signed GET /v2/account and /v2/positions for Follower A. Records the equity field.
import { writeFileSync } from "node:fs";
import { signed } from "./spike-lib.js";

const account = await signed("GET", "/v2/account");
const positions = await signed("GET", "/v2/positions");
console.log("GET /v2/account   ->", account.status);
console.log(JSON.stringify(account.json, null, 2));
console.log("GET /v2/positions ->", positions.status);
console.log(JSON.stringify(positions.json, null, 2));
writeFileSync("docs/proof/spike-a.json", JSON.stringify({ account, positions }, null, 2));
if (account.status !== 200) process.exit(1);
