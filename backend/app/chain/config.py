import os
from dataclasses import dataclass
from typing import Mapping


@dataclass(frozen=True)
class ChainSettings:
    rpc_url: str
    relayer_private_key: str
    semaphore_address: str
    group_id: int | None
    registry_address: str
    database_url: str
    explorer_tx_url: str
    min_priority_gwei: int
    anchor_interval_s: float
    signal_mode: str

    @classmethod
    def from_env(cls, env: Mapping[str, str] = os.environ) -> "ChainSettings":
        group = env.get("SEMAPHORE_GROUP_ID", "")
        return cls(
            rpc_url=env["AMOY_RPC_URL"],
            relayer_private_key=env["RELAYER_PRIVATE_KEY"],
            semaphore_address=env.get("SEMAPHORE_ADDRESS", "0x8A1fd199516489B0Fb7153EB5f075cDAC83c693D"),
            group_id=int(group) if group else None,
            registry_address=env.get("REGISTRY_ADDRESS", ""),
            database_url=env.get("DATABASE_URL", ""),
            explorer_tx_url=env.get("EXPLORER_TX_URL", "https://amoy.polygonscan.com/tx/{hash}"),
            min_priority_gwei=int(env.get("MIN_PRIORITY_GWEI", "30")),
            anchor_interval_s=float(env.get("ANCHOR_INTERVAL_S", "5")),
            signal_mode=env.get("ZK_SIGNAL_MODE", "text"),
        )
