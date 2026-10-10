import json
import os
from pathlib import Path

import pytest

ANVIL_KEY_0 = "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80"


def pytest_configure(config):
    config.addinivalue_line("markers", "chain: needs CHAIN_TEST_RPC_URL (anvil --fork-url $AMOY_RPC_URL)")


@pytest.fixture(scope="session")
def chain():
    rpc = os.environ.get("CHAIN_TEST_RPC_URL")
    if not rpc:
        pytest.skip("CHAIN_TEST_RPC_URL not set")
    from app.chain.semaphore import SemaphoreClient
    from app.chain.web3_client import TxSender, make_w3

    w3 = make_w3(rpc)
    sender = TxSender(w3, ANVIL_KEY_0, min_priority_gwei=1)
    semaphore = SemaphoreClient(w3, sender, "0x8A1fd199516489B0Fb7153EB5f075cDAC83c693D")
    return {"w3": w3, "sender": sender, "semaphore": semaphore}


@pytest.fixture(scope="session")
def registry(chain):
    from app.chain.registry import RegistryClient

    artifact = json.loads((Path(__file__).parent / "CaseAuditRegistry.artifact.json").read_text())
    w3, sender = chain["w3"], chain["sender"]
    factory = w3.eth.contract(abi=artifact["abi"], bytecode=artifact["bytecode"])
    receipt = sender.send(factory.constructor(sender.address))
    return RegistryClient(w3, sender, receipt["contractAddress"])
