"""Benchmark the centralised EHR baseline system.

Mirrors measure-throughput.ts's methodology (sequential and batched
record creation, same record count) so the two sets of results are
directly comparable in the dissertation's Phase 4 evaluation.

Usage (with app.py already running on port 5099):
    python benchmark_baseline.py
"""

import time
import uuid
from concurrent.futures import ThreadPoolExecutor

import requests

API_URL = "http://127.0.0.1:5099"
RECORD_COUNT = 20
PATIENT_ID = "benchmark-patient"


def create_record(index: int, prefix: str) -> None:
    response = requests.post(
        f"{API_URL}/records",
        json={
            "patient_id": PATIENT_ID,
            "file_hash": f"{prefix}-file-hash-{index}",
            "storage_reference": f"{prefix}-storage-ref-{index}",
        },
        timeout=10,
    )
    response.raise_for_status()


def main():
    print(
        f"\nBenchmarking centralised baseline with "
        f"{RECORD_COUNT} record-creation requests\n"
    )

    # --- Scenario 1: sequential throughput -----------------------

    sequential_latencies_ms = []
    sequential_start = time.perf_counter()

    for i in range(RECORD_COUNT):
        tx_start = time.perf_counter()
        create_record(i, "seq")
        sequential_latencies_ms.append(
            (time.perf_counter() - tx_start) * 1000
        )

    sequential_total_seconds = (
        time.perf_counter() - sequential_start
    )
    sequential_tps = RECORD_COUNT / sequential_total_seconds
    sequential_avg_latency_ms = sum(
        sequential_latencies_ms
    ) / len(sequential_latencies_ms)

    print("Sequential submission (one at a time):")
    print(f"  Total time: {sequential_total_seconds:.3f}s")
    print(f"  Throughput: {sequential_tps:.2f} TPS")
    print(
        "  Average latency per request: "
        f"{sequential_avg_latency_ms:.2f}ms"
    )

    # --- Scenario 2: batched (concurrent) throughput --------------

    batch_start = time.perf_counter()

    with ThreadPoolExecutor(max_workers=RECORD_COUNT) as executor:
        futures = [
            executor.submit(create_record, i, "batch")
            for i in range(RECORD_COUNT)
        ]
        for future in futures:
            future.result()

    batch_total_seconds = time.perf_counter() - batch_start
    batch_tps = RECORD_COUNT / batch_total_seconds

    print("\nBatched submission (concurrent):")
    print(f"  Total time: {batch_total_seconds:.3f}s")
    print(f"  Throughput: {batch_tps:.2f} TPS")

    print(
        "\nNote: this measures a plain Flask + SQLite CRUD API "
        "with no blockchain, no cryptographic access control, "
        "and no immutable audit trail -- it is a traditional "
        "centralised baseline, not a fair-in-every-respect "
        "comparison. Its higher throughput reflects the absence "
        "of those guarantees, which is precisely the trade-off "
        "this comparison is intended to illustrate."
    )


if __name__ == "__main__":
    main()
