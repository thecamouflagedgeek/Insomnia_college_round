import assert from 'node:assert/strict';
import test from 'node:test';
import {Identity, Group} from '@semaphore-protocol/core';
import {commitment, prove} from '../src/prover.js';

const fixture = 'incognito-public-test-fixture-not-a-user-key';
test('commitment matches the pinned official library and is deterministic', async () => {
 assert.equal(await commitment(fixture), new Identity(fixture).commitment.toString());
 assert.equal(await commitment(fixture), await commitment(fixture));
});
test('root mismatch stops before attempting a proof', async () => {
 const group = new Group([new Identity(fixture).commitment]);
 await assert.rejects(prove({privateKey: fixture, members: group.members.map(String), onchainRoot: '0', message: 'm:test', scope: 'cmp:test', depth:16}), /^Error: GROUP_ROOT_MISMATCH:[0-9]+:0$/);
});
test('invalid input produces a safe error without private material', async () => {
 await assert.rejects(commitment(''), /PROVER_FAILURE:identity/);
 await assert.rejects(prove({privateKey: fixture, members:['invalid'], onchainRoot:'0', message:'m:test', scope:'cmp:test', depth:16}), /PROVER_FAILURE:input/);
 await assert.rejects(prove({privateKey: fixture, members:[], onchainRoot:'0', message:'m:test', scope:'cmp:test', depth:20}), /PROVER_FAILURE:input/);
});
