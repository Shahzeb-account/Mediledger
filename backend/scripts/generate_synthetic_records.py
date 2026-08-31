"""Generate synthetic patient medical records and upload them through
the running backend's own API.

This replaces ad hoc personal test files with de-identified, entirely
fictional records generated in the same spirit as Synthea / NHS
Synthetic Patient Data -- i.e. structurally realistic clinical
documents describing patients who do not exist, containing no real
personal information whatsoever.

Because uploads go through the real /records/upload endpoint, each
record is encrypted and tracked on-chain exactly like a genuine
upload -- there is no separate "seed data" code path to keep in sync
with the real one.

Usage (from the backend/ folder, with the venv activated and the
backend + Hardhat node already running):

    python scripts/generate_synthetic_records.py --account 0xYOUR_WALLET_ADDRESS

Optional flags:
    --count N        number of records to generate (default: 5)
    --api-url URL    backend base URL (default: http://127.0.0.1:5001)
"""

import argparse
import io
import random
from datetime import date, timedelta

import requests


FIRST_NAMES = [
    "Alex", "Jordan", "Taylor", "Morgan", "Casey",
    "Riley", "Jamie", "Avery", "Quinn", "Rowan",
]

LAST_NAMES = [
    "Whitfield", "Harrow", "Denholm", "Pryce", "Osei",
    "Nakamura", "Alvarado", "Ferris", "Kowalski", "Doyle",
]

CONDITIONS = [
    "Type 2 Diabetes Mellitus",
    "Essential Hypertension",
    "Asthma, mild persistent",
    "Osteoarthritis, right knee",
    "Generalised Anxiety Disorder",
    "Hypothyroidism",
    "Seasonal Allergic Rhinitis",
    "Gastro-oesophageal Reflux Disease",
]

MEDICATIONS = [
    "Metformin 500mg, twice daily",
    "Amlodipine 5mg, once daily",
    "Salbutamol inhaler, as required",
    "Levothyroxine 50mcg, once daily",
    "Omeprazole 20mg, once daily",
    "Sertraline 50mg, once daily",
]


def generate_synthetic_patient_record(record_number: int) -> str:
    """Return the text content of one fully fictional patient record."""

    first_name = random.choice(FIRST_NAMES)
    last_name = random.choice(LAST_NAMES)
    dob = date(2026, 1, 1) - timedelta(
        days=random.randint(18 * 365, 85 * 365)
    )
    nhs_number = "".join(
        str(random.randint(0, 9)) for _ in range(10)
    )
    conditions = random.sample(CONDITIONS, k=random.randint(1, 3))
    medications = random.sample(MEDICATIONS, k=random.randint(1, 2))
    visit_date = date(2026, 1, 1) + timedelta(
        days=random.randint(1, 200)
    )
    systolic = random.randint(110, 150)
    diastolic = random.randint(70, 95)
    heart_rate = random.randint(60, 95)

    lines = [
        "SYNTHETIC PATIENT RECORD -- FOR PROJECT TESTING ONLY",
        (
            "This document is entirely fictional. It was generated "
            "programmatically for software testing purposes, in the "
            "style of NHS Synthetic Patient Data / Synthea output. "
            "It does not describe a real person."
        ),
        "",
        f"Record ID (local test seed): SYN-{record_number:04d}",
        f"Patient Name: {first_name} {last_name}",
        f"Date of Birth: {dob.isoformat()}",
        f"Synthetic NHS Number: {nhs_number}",
        "",
        f"Visit Date: {visit_date.isoformat()}",
        f"Blood Pressure: {systolic}/{diastolic} mmHg",
        f"Heart Rate: {heart_rate} bpm",
        "",
        "Active Conditions:",
    ]

    lines.extend(f"  - {condition}" for condition in conditions)
    lines.append("")
    lines.append("Current Medications:")
    lines.extend(f"  - {medication}" for medication in medications)
    lines.append("")
    lines.append(
        "Clinical Note: Patient reviewed at routine follow-up. "
        "No acute concerns raised at this visit. Continue current "
        "management plan and review in line with local guidance."
    )

    return "\n".join(lines)


def upload_record(api_url: str, account: str, content: str, filename: str) -> dict:
    file_bytes = io.BytesIO(content.encode("utf-8"))

    response = requests.post(
        f"{api_url}/records/upload",
        data={"account": account},
        files={"file": (filename, file_bytes, "text/plain")},
        timeout=30,
    )

    response.raise_for_status()
    return response.json()


def main():
    parser = argparse.ArgumentParser(
        description=(
            "Generate synthetic patient records and upload them "
            "through the backend's own API."
        )
    )
    parser.add_argument(
        "--account",
        required=True,
        help="Wallet address to upload the records as (must already be registered).",
    )
    parser.add_argument(
        "--count",
        type=int,
        default=5,
        help="Number of synthetic records to generate (default: 5).",
    )
    parser.add_argument(
        "--api-url",
        default="http://127.0.0.1:5001",
        help="Backend base URL (default: http://127.0.0.1:5001).",
    )

    args = parser.parse_args()

    print(
        f"Generating {args.count} synthetic patient record(s) and "
        f"uploading as {args.account} ...\n"
    )

    for i in range(1, args.count + 1):
        content = generate_synthetic_patient_record(i)
        filename = f"synthetic_patient_record_{i:02d}.txt"

        try:
            result = upload_record(
                args.api_url, args.account, content, filename
            )
        except requests.exceptions.RequestException as error:
            print(f"[{i}/{args.count}] FAILED: {error}")
            continue

        print(
            f"[{i}/{args.count}] Uploaded {filename} "
            f"-> record_id={result.get('record_id')} "
            f"tx={result.get('transaction_hash')}"
        )

    print("\nDone.")


if __name__ == "__main__":
    main()
