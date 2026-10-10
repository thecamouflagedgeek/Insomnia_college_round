// Usage:
//   node gen.mjs commitment <secret>
//   node gen.mjs proof '{"secret":"s","members":["1","2"],"message":"m:...","scope":"cmp:...","depth":16}'
import { Group, Identity, generateProof } from "@semaphore-protocol/core"

const replacer = (_k, v) => (typeof v === "bigint" ? v.toString() : v)
const [mode, arg] = process.argv.slice(2)

if (mode === "commitment") {
  const identity = new Identity(arg)
  console.log(JSON.stringify({ commitment: identity.commitment }, replacer))
} else if (mode === "proof") {
  const input = JSON.parse(arg)
  const identity = new Identity(input.secret)
  const group = new Group(input.members.map((m) => BigInt(m)))
  const proof = await generateProof(identity, group, input.message, input.scope, input.depth ?? 16)
  console.log(JSON.stringify({ commitment: identity.commitment, proof }, replacer))
  process.exit(0)
} else {
  console.error("usage: gen.mjs commitment <secret> | proof <json>")
  process.exit(1)
}
