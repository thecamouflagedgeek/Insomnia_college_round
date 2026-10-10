import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {performance} from 'node:perf_hooks';
import {createHash, randomUUID} from 'node:crypto';
import puppeteer from 'puppeteer-core';
import {Identity, Group, verifyProof} from '@semaphore-protocol/core';

const html = await readFile(new URL('../../../mobile/assets/prover/prover.html', import.meta.url));
const server = createServer((_req,res) => {res.setHeader('Content-Type','text/html; charset=utf-8'); res.end(html);});
await new Promise(resolve => server.listen(0,'127.0.0.1',resolve));
let browser;
try {
 browser = await puppeteer.launch({executablePath: process.env.CHROME_PATH ?? 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless:true});
 const page = await browser.newPage();
 await page.setRequestInterception(true);
 let unexpectedNetwork = false;
 let artifacts = 0;
 page.on('request', request => {
  const url = new URL(request.url());
  const permitted = url.protocol === 'blob:' || url.hostname === '127.0.0.1' || (url.protocol === 'https:' && url.hostname === 'snark-artifacts.pse.dev' && url.pathname.startsWith('/semaphore/4.13.0/') && !url.search);
  if (!permitted) {unexpectedNetwork = true; request.abort();} else {if(url.hostname === 'snark-artifacts.pse.dev') artifacts++; request.continue();}
 });
 await page.goto(`http://127.0.0.1:${server.address().port}`, {waitUntil:'load'});
 assert.equal(await page.evaluate(() => typeof window.incognito.prove), 'function');
 const privateKey = 'incognito-public-browser-test-fixture';
 const identity = new Identity(privateKey);
 const group = new Group([identity.commitment,new Identity('public-member-2').commitment,new Identity('public-member-3').commitment]);
 const members = group.members.map(String), onchainRoot = group.root.toString();
 assert.equal(await page.evaluate(key => window.incognito.commitment(key), privateKey), identity.commitment.toString());
 const mismatch = await page.evaluate(async args => {try {await window.incognito.prove(args); return null;} catch(error) {return error.message;}}, {privateKey,members,onchainRoot:'0',message:'m:browser-test',scope:'cmp:2026-10-11',depth:16});
 assert.match(mismatch, /^GROUP_ROOT_MISMATCH:/); assert.equal(artifacts, 0);
 const started = performance.now();
 const proof = await page.evaluate(args => window.incognito.prove(args), {privateKey,members,onchainRoot,message:'m:browser-test',scope:'cmp:2026-10-11',depth:16});
 const seconds = (performance.now()-started)/1000;
 assert.equal(proof.merkle_tree_depth,16); assert.equal(proof.merkle_tree_root,onchainRoot);
 for(const key of ['merkle_tree_root','nullifier','message','scope']) assert.match(proof[key], /^[0-9]+$/);
 assert.equal(proof.points.length,8); proof.points.forEach(p => assert.match(p,/^[0-9]+$/));
 const textSignal = text => BigInt('0x' + Buffer.from(text).toString('hex').padEnd(64,'0')).toString();
 assert.equal(proof.message,textSignal('m:browser-test')); assert.equal(proof.scope,textSignal('cmp:2026-10-11'));
 assert.equal(await verifyProof({merkleTreeDepth:16,merkleTreeRoot:proof.merkle_tree_root,nullifier:proof.nullifier,message:proof.message,scope:proof.scope,points:proof.points}),true);
 assert.equal(unexpectedNetwork,false);
 console.log(JSON.stringify({browser:'Chrome',sdk:'4.14.3',proofVerified:true,rootMismatchRejected:true,depth:16,artifactRequests:artifacts,proofSeconds:Number(seconds.toFixed(3))}));
 if (process.env.FORK_BACKEND_URL) {
  const backend = new URL(process.env.FORK_BACKEND_URL);
  assert.equal(backend.origin, 'http://127.0.0.1:8011', 'Only the isolated local fork backend is allowed');
  const setup = JSON.parse(await readFile(new URL('../.fork-tools/fork-setup.json', import.meta.url)));
  const rpc = await fetch(setup.rpc_url, {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({jsonrpc:'2.0',id:1,method:'eth_chainId',params:[]})});
  assert.equal((await rpc.json()).result, '0x7a69', 'Refusing to use any non-local chain');
  const api = async (path, {method='GET',body,headers={},expected=200}={}) => {
   const response = await fetch(new URL(path,backend), {method,headers:{'Content-Type':'application/json',...headers},body:body === undefined ? undefined : JSON.stringify(body),signal:AbortSignal.timeout(120000)});
   const data = await response.json();
   const reason = typeof data.detail?.reason === 'string' && /^[a-z_]+$/.test(data.detail.reason) ? data.detail.reason : 'unavailable';
   assert.equal(response.status,expected,'Unexpected backend HTTP status (' + reason + ')');
   return data;
  };
  const testKey = `public-fork-test-${randomUUID()}`;
  const testCommitment = await page.evaluate(key => window.incognito.commitment(key),testKey);
  await api('/zk/enroll',{method:'POST',headers:{'X-Enroll-Code':'DEMO-INVITE'},body:{commitment:testCommitment}});
  const chainGroup = await api('/zk/group');
  assert.equal(chainGroup.group_id,setup.group_id); assert.notEqual(chainGroup.group_id,23);
  const makeProof = async (payload,sdkScope) => {
   const message = 'm:' + createHash('sha256').update(payload,'utf8').digest('hex').slice(0,28);
   return page.evaluate(args => window.incognito.prove(args), {privateKey:testKey,members:chainGroup.members,onchainRoot:chainGroup.onchain_root,message,scope:sdkScope,depth:16});
  };
  const payload = JSON.stringify({category:'Bullying',title:'Fictional fork test ' + randomUUID(),description:'Fictional test: a manager repeatedly shouted at a team member during workplace meetings.',client_nonce:randomUUID()});
  const complaintScope = await api('/zk/scopes/complaint');
  const reportProof = await makeProof(payload,complaintScope.sdk_argument);
  const created = await api('/reports',{method:'POST',body:{payload,proof:reportProof},expected:201});
  // The unchanged backend rejects identical content before checking the proof.
  const duplicateContent = await api('/reports',{method:'POST',body:{payload,proof:reportProof},expected:422});
  assert.equal(duplicateContent.detail.reason,'claim_integrity');
  // A different correctly bound payload still has this identity's spent daily nullifier.
  const replayPayload = JSON.stringify({...JSON.parse(payload),title:'Second fictional fork test ' + randomUUID()});
  const replayProof = await makeProof(replayPayload,complaintScope.sdk_argument);
  assert.equal(replayProof.nullifier,reportProof.nullifier);
  const replay = await api('/reports',{method:'POST',body:{payload:replayPayload,proof:replayProof},expected:400});
  assert.equal(replay.detail.reason,'replay');
  const headers = {Authorization:`Bearer ${created.case_token}`};
  const view = await api(`/reports/${created.case_id}`,{headers});
  const member = view.committee[0].member_id;
  const challengeScope = await api(`/zk/scopes/challenge?case_id=${encodeURIComponent(created.case_id)}&member_id=${encodeURIComponent(member)}`);
  const challengePayload = JSON.stringify({member_id:member,reason:'Professional relationship',explanation:'Fictional test: prior involvement creates a potential conflict.',client_nonce:randomUUID()});
  const challengeProof = await makeProof(challengePayload,challengeScope.sdk_argument);
  await api(`/reports/${created.case_id}/challenge`,{method:'POST',headers,body:{payload:challengePayload,proof:challengeProof},expected:201});
  const duplicate = await api(`/reports/${created.case_id}/challenge`,{method:'POST',headers,body:{payload:challengePayload,proof:challengeProof},expected:400});
  assert.equal(duplicate.detail.reason,'replay');
  let audit;
  for(let attempt=0;attempt<20;attempt++) {
   audit = await api(`/audit/cases/${created.case_id}/verify`,{headers});
   if(audit.ok && audit.events.length && audit.events.every(event => event.status === 'verified')) break;
   await new Promise(resolve => setTimeout(resolve,1000));
  }
  assert.equal(audit.ok,true); assert.ok(audit.events.length > 0); assert.ok(audit.events.every(event => event.status === 'verified'));
  console.log(JSON.stringify({localAmoyFork:true,groupId:chainGroup.group_id,reportAccepted:true,replayRejected:true,challengeAccepted:true,challengeReplayRejected:true,auditVerified:true,auditEvents:audit.events.length}));
 }
} finally {
 if(browser) await browser.close();
 await new Promise(resolve => server.close(resolve));
 if(globalThis.curve_bn128) await globalThis.curve_bn128.terminate();
}
