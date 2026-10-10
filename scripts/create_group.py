"""Create the organisation's Semaphore group on Amoy (run once). Prints SEMAPHORE_GROUP_ID.

    set -a; source .env; set +a; PYTHONPATH=backend .venv/bin/python scripts/create_group.py
"""
from app.chain.config import ChainSettings
from app.chain.semaphore import SemaphoreClient
from app.chain.web3_client import TxSender, make_w3

if __name__ == "__main__":
    s = ChainSettings.from_env()
    w3 = make_w3(s.rpc_url)
    sender = TxSender(w3, s.relayer_private_key, s.min_priority_gwei)
    group_id = SemaphoreClient(w3, sender, s.semaphore_address).create_group(sender.address)
    print(f"SEMAPHORE_GROUP_ID={group_id}")
