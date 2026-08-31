import json
import os
from pathlib import Path

from web3 import Web3


BLOCKCHAIN_URL = "http://127.0.0.1:8545"
CONTRACT_ADDRESS = "0x5FbDB2315678afecb367f032d93F642f64180aa3"

BASE_DIR = Path(__file__).resolve().parent.parent
PROJECT_DIR = BASE_DIR.parent

ARTIFACT_PATH = (
    PROJECT_DIR
    / "blockchain"
    / "artifacts"
    / "contracts"
    / "HealthcareDataSharing.sol"
    / "HealthcareDataSharing.json"
)

web3 = Web3(Web3.HTTPProvider(BLOCKCHAIN_URL))


def load_contract():
    if not web3.is_connected():
        raise ConnectionError(
            "Cannot connect to the Hardhat blockchain at "
            f"{BLOCKCHAIN_URL}. Make sure 'npx hardhat node' is running."
        )

    if not ARTIFACT_PATH.exists():
        raise FileNotFoundError(
            f"Contract artifact not found: {ARTIFACT_PATH}"
        )

    with ARTIFACT_PATH.open("r", encoding="utf-8") as artifact_file:
        artifact = json.load(artifact_file)

    checksum_address = Web3.to_checksum_address(
        CONTRACT_ADDRESS
    )

    return web3.eth.contract(
        address=checksum_address,
        abi=artifact["abi"],
    )


contract = load_contract()
