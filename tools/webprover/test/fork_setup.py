"""No-cost local fork setup. Uses a publicly documented Anvil test account only."""
import json
import sys
from pathlib import Path
import psycopg
from web3 import Web3

ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(ROOT / 'backend'))
from app.chain.web3_client import make_w3, TxSender
from app.chain.semaphore import SemaphoreClient
from tests.chain.conftest import ANVIL_KEY_0

rpc = 'http://127.0.0.1:18545'
w3 = make_w3(rpc)
assert w3.eth.chain_id == 31337, 'Refusing to sign outside the isolated local fork'
sender = TxSender(w3, ANVIL_KEY_0, min_priority_gwei=1)
with psycopg.connect('postgresql://incognito_test@127.0.0.1:54329/postgres', autocommit=True) as conn:
    exists = conn.execute("select 1 from pg_database where datname = 'incognito_webprover'").fetchone()
    if not exists:
        conn.execute('create database incognito_webprover')
dsn = 'postgresql://incognito_test@127.0.0.1:54329/incognito_webprover'
with psycopg.connect(dsn) as conn:
    conn.execute((ROOT / 'backend/migrations/0040_chain.sql').read_text())
sem = SemaphoreClient(w3, sender, '0x8A1fd199516489B0Fb7153EB5f075cDAC83c693D')
group = sem.create_group(sender.address)
artifact = json.loads((ROOT / 'backend/tests/chain/CaseAuditRegistry.artifact.json').read_text())
factory = w3.eth.contract(abi=artifact['abi'], bytecode=artifact['bytecode'])
receipt = sender.send(factory.constructor(sender.address))
config = {'rpc_url':rpc,'database_url':dsn,'group_id':group,'registry_address':receipt['contractAddress']}
output = ROOT / 'tools/webprover/.fork-tools/fork-setup.json'
output.write_text(json.dumps(config))
print(json.dumps({'localFork':True,'chainId':31337,'groupId':group,'freshRegistry':True,'databaseInitialized':True}))
