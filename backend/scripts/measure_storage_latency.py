"""Off-chain storage retrieval latency benchmark.

Measures upload and download latency against whichever storage
backend is configured (STORAGE_PROVIDER=local or STORAGE_PROVIDER=b2
in .env), in isolation from the blockchain layer. This directly
fulfils the proposal's Technical Risk mitigation: "Performance
benchmarking will explicitly measure and report B2 retrieval times."

Unlike measure-throughput.ts (which benchmarks smart contract
transaction speed), this script benchmarks the file-storage layer
alone -- no Hardhat node needs to be running to use it.

Usage (from backend/, with venv activated):
    python scripts/measure_storage_latency.py
"""

import statistics
import sys
import time
from pathlib import Path

from flask import Flask

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.config import Config
from app import storage_backend

FILE_COUNT = 20
FILE_SIZE_BYTES = 200_000  # ~200KB, representative of an encrypted document


def build_app():
    app = Flask(__name__)
    app.config.from_object(Config)
    return app


def main():
    app = build_app()

    provider = app.config.get("STORAGE_PROVIDER", "local")
    print(f"\nBenchmarking storage backend: {provider}")
    print(f"{FILE_COUNT} files, {FILE_SIZE_BYTES:,} bytes each\n")

    payload = b"0" * FILE_SIZE_BYTES

    upload_latencies_ms = []
    download_latencies_ms = []
    filenames = []

    with app.app_context():
        # --- Upload latency ---
        for i in range(FILE_COUNT):
            filename = f"latency-test-{i}.enc"
            filenames.append(filename)

            start = time.perf_counter()
            storage_backend.save_encrypted_file(filename, payload)
            upload_latencies_ms.append(
                (time.perf_counter() - start) * 1000
            )

        # --- Download (retrieval) latency ---
        for filename in filenames:
            start = time.perf_counter()
            data = storage_backend.load_encrypted_file(filename)
            download_latencies_ms.append(
                (time.perf_counter() - start) * 1000
            )
            assert data == payload, "retrieved content mismatch"

        # --- Cleanup ---
        for filename in filenames:
            storage_backend.delete_encrypted_file(filename)

    def report(label, values):
        print(f"{label}:")
        print(f"  Mean:   {statistics.mean(values):.2f} ms")
        print(f"  Median: {statistics.median(values):.2f} ms")
        print(f"  Min:    {min(values):.2f} ms")
        print(f"  Max:    {max(values):.2f} ms")
        print()

    report("Upload latency", upload_latencies_ms)
    report("Retrieval (download) latency", download_latencies_ms)


if __name__ == "__main__":
    main()
