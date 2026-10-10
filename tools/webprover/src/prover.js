import { Identity, Group, generateProof } from '@semaphore-protocol/core';

const decimal = (value) => BigInt(value).toString(10);
const decimalInput = (value) => typeof value === 'string' && /^[0-9]+$/.test(value);
export async function commitment(privateKey) {
  try {
    if (typeof privateKey !== 'string' || privateKey.length === 0) throw new Error();
    return new Identity(privateKey).commitment.toString();
  } catch { throw new Error('PROVER_FAILURE:identity'); }
}
export async function prove({privateKey, members, onchainRoot, message, scope, depth = 16}) {
  // This check precedes artifact downloads and prevents stale/wrong-order group proofs.
  if (depth !== 16 || !Array.isArray(members) || !members.every(decimalInput) || !decimalInput(onchainRoot) || typeof message !== 'string' || typeof scope !== 'string') {
    throw new Error('PROVER_FAILURE:input');
  }
  let group;
  try { group = new Group(members.map(BigInt)); }
  catch { throw new Error('PROVER_FAILURE:group'); }
  const localRoot = group.root.toString();
  if (localRoot !== onchainRoot) throw new Error(`GROUP_ROOT_MISMATCH:${localRoot}:${onchainRoot}`);
  try {
    const identity = new Identity(privateKey);
    const p = await generateProof(identity, group, message, scope, depth);
    return {
      merkle_tree_depth: 16,
      merkle_tree_root: decimal(p.merkleTreeRoot),
      nullifier: decimal(p.nullifier),
      message: decimal(p.message),
      scope: decimal(p.scope),
      points: p.points.map(decimal),
    };
  } catch { throw new Error('PROVER_FAILURE:proof'); }
}
if (typeof window !== 'undefined') window.incognito = Object.freeze({commitment, prove});
