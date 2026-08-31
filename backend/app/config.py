import os
from pathlib import Path

from dotenv import load_dotenv


BASE_DIR = Path(__file__).resolve().parent.parent

load_dotenv(BASE_DIR / ".env")


class Config:
    SECRET_KEY = os.getenv(
        "SECRET_KEY",
        "development-only-secret",
    )

    BLOCKCHAIN_RPC_URL = os.getenv(
        "BLOCKCHAIN_RPC_URL",
        "http://127.0.0.1:8545",
    )

    CONTRACT_ADDRESS = os.getenv(
        "CONTRACT_ADDRESS",
        "",
    )

    DATABASE_URL = os.getenv(
        "DATABASE_URL",
        f"sqlite:///{BASE_DIR / 'mediledger.db'}",
    )

    SQLALCHEMY_DATABASE_URI = DATABASE_URL
    SQLALCHEMY_TRACK_MODIFICATIONS = False

    STORAGE_PROVIDER = os.getenv(
        "STORAGE_PROVIDER",
        "local",
    ).lower()

    LOCAL_STORAGE_PATH = Path(
        os.getenv(
            "LOCAL_STORAGE_PATH",
            str(BASE_DIR / "storage"),
        )
    )

    B2_ENDPOINT_URL = os.getenv(
        "B2_ENDPOINT_URL",
        "",
    )

    B2_KEY_ID = os.getenv(
        "B2_KEY_ID",
        "",
    )

    B2_APPLICATION_KEY = os.getenv(
        "B2_APPLICATION_KEY",
        "",
    )

    B2_BUCKET_NAME = os.getenv(
        "B2_BUCKET_NAME",
        "mediledger-records",
    )
    ENCRYPTION_KEY = os.getenv(
    "ENCRYPTION_KEY",
    "",
)

    FRONTEND_URL = os.getenv(
        "FRONTEND_URL",
        "http://localhost:5173",
    )

    MAX_UPLOAD_SIZE_MB = int(
        os.getenv("MAX_UPLOAD_SIZE_MB", "10")
    )

    MAX_CONTENT_LENGTH = (
        MAX_UPLOAD_SIZE_MB * 1024 * 1024
    )