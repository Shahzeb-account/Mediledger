"""Minimal centralised EHR baseline system.

This is deliberately a plain, traditional CRUD system: a single
SQLite database, no blockchain, no smart contracts, no immutable
audit trail, no cryptographic access control. It exists purely as a
comparison point for the dissertation's Phase 4 evaluation, to
contrast against the blockchain-based MediLedger system:

    - A centralised system like this is fast and simple, but a
      single point of failure: whoever controls the database can
      silently read, alter, or delete any record, and there is no
      tamper-evident history of who accessed what and when.
    - The blockchain system deliberately trades some raw performance
      for those missing properties: immutability, patient-controlled
      consent, and an auditable access log that even the system
      operator cannot rewrite.

Run this app, then run benchmark_baseline.py against it and compare
the printed TPS/latency figures with measure-throughput.ts's output
for the blockchain system.

Usage:
    python app.py
"""

import sqlite3
import time
import uuid
from pathlib import Path

from flask import Flask, g, jsonify, request

DB_PATH = Path(__file__).resolve().parent / "baseline.db"

app = Flask(__name__)


def get_db():
    if "db" not in g:
        g.db = sqlite3.connect(DB_PATH)
        g.db.row_factory = sqlite3.Row
    return g.db


@app.teardown_appcontext
def close_db(_exception=None):
    db = g.pop("db", None)
    if db is not None:
        db.close()


def init_db():
    connection = sqlite3.connect(DB_PATH)

    connection.execute(
        """
        CREATE TABLE IF NOT EXISTS records (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            patient_id TEXT NOT NULL,
            file_hash TEXT NOT NULL,
            storage_reference TEXT NOT NULL,
            created_at REAL NOT NULL
        )
        """
    )

    connection.execute(
        """
        CREATE TABLE IF NOT EXISTS access_grants (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            record_id INTEGER NOT NULL,
            granted_to TEXT NOT NULL,
            created_at REAL NOT NULL
        )
        """
    )

    connection.commit()
    connection.close()


@app.route("/records", methods=["POST"])
def create_record():
    data = request.get_json()

    if not data:
        return jsonify({"error": "JSON body is required"}), 400

    patient_id = data.get("patient_id")
    file_hash = data.get("file_hash")
    storage_reference = data.get("storage_reference")

    if not patient_id or not file_hash or not storage_reference:
        return jsonify(
            {
                "error": (
                    "patient_id, file_hash, and "
                    "storage_reference are all required"
                )
            }
        ), 400

    db = get_db()
    cursor = db.execute(
        """
        INSERT INTO records
            (patient_id, file_hash, storage_reference, created_at)
        VALUES (?, ?, ?, ?)
        """,
        (patient_id, file_hash, storage_reference, time.time()),
    )
    db.commit()

    return jsonify({"record_id": cursor.lastrowid}), 201


@app.route("/records/<int:record_id>", methods=["GET"])
def get_record(record_id):
    db = get_db()
    row = db.execute(
        "SELECT * FROM records WHERE id = ?",
        (record_id,),
    ).fetchone()

    if row is None:
        return jsonify({"error": "Record not found"}), 404

    return jsonify(dict(row)), 200


@app.route("/access/grant", methods=["POST"])
def grant_access():
    data = request.get_json()

    if not data:
        return jsonify({"error": "JSON body is required"}), 400

    record_id = data.get("record_id")
    granted_to = data.get("granted_to")

    if not record_id or not granted_to:
        return jsonify(
            {"error": "record_id and granted_to are required"}
        ), 400

    db = get_db()
    db.execute(
        """
        INSERT INTO access_grants
            (record_id, granted_to, created_at)
        VALUES (?, ?, ?)
        """,
        (record_id, granted_to, time.time()),
    )
    db.commit()

    return jsonify({"message": "Access granted"}), 200


@app.route("/access/check", methods=["GET"])
def check_access():
    record_id = request.args.get("record_id")
    account = request.args.get("account")

    if not record_id or not account:
        return jsonify(
            {"error": "record_id and account are required"}
        ), 400

    db = get_db()
    row = db.execute(
        """
        SELECT 1 FROM access_grants
        WHERE record_id = ? AND granted_to = ?
        """,
        (record_id, account),
    ).fetchone()

    return jsonify({"has_access": row is not None}), 200


@app.route("/health", methods=["GET"])
def health():
    return jsonify({"status": "ok"}), 200


if __name__ == "__main__":
    init_db()
    app.run(port=5099, debug=False)
