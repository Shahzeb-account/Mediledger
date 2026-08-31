"""Storage backend abstraction.

Switches between local disk storage and Backblaze B2 (an S3-compatible
cloud object storage service) based on the STORAGE_PROVIDER config
value, so the rest of the application never needs to know which one
is actually in use.

Set STORAGE_PROVIDER=local (default) to keep using the backend/storage
folder on disk -- nothing else needs to change, and no cloud account
is required.

Set STORAGE_PROVIDER=b2 and provide B2_ENDPOINT_URL, B2_KEY_ID,
B2_APPLICATION_KEY and B2_BUCKET_NAME in .env to store encrypted
files in Backblaze B2 instead. B2's free tier (10GB, no credit card
required) is used here in place of Azure Blob Storage -- functionally
equivalent for this project's purposes (an S3-compatible, encrypted,
off-chain object store), and avoids requiring a paid cloud account.
"""

from pathlib import Path

from flask import current_app


def save_encrypted_file(filename: str, data: bytes) -> None:
    """Persist already-encrypted file bytes under the given filename."""
    if _using_b2():
        _save_to_b2(filename, data)
    else:
        _save_to_local(filename, data)


def load_encrypted_file(filename: str) -> bytes:
    """Read back the raw (still-encrypted) bytes for a stored file."""
    if _using_b2():
        return _load_from_b2(filename)
    return _load_from_local(filename)


def encrypted_file_exists(filename: str) -> bool:
    if _using_b2():
        return _b2_object_exists(filename)
    return _local_file_exists(filename)


def delete_encrypted_file(filename: str) -> bool:
    """Delete a stored file if it exists. Returns True if a file was
    actually removed, False if there was nothing to delete."""
    if _using_b2():
        return _delete_from_b2(filename)
    return _delete_from_local(filename)


def _using_b2() -> bool:
    return current_app.config.get("STORAGE_PROVIDER", "local") == "b2"


# --- Local disk backend -----------------------------------------------

def _local_storage_dir() -> Path:
    storage_dir = Path(current_app.config["LOCAL_STORAGE_PATH"])
    storage_dir.mkdir(parents=True, exist_ok=True)
    return storage_dir


def _save_to_local(filename: str, data: bytes) -> None:
    (_local_storage_dir() / filename).write_bytes(data)


def _load_from_local(filename: str) -> bytes:
    return (_local_storage_dir() / filename).read_bytes()


def _local_file_exists(filename: str) -> bool:
    return (_local_storage_dir() / filename).exists()


def _delete_from_local(filename: str) -> bool:
    file_path = _local_storage_dir() / filename

    if file_path.exists():
        file_path.unlink()
        return True

    return False


# --- Backblaze B2 backend (S3-compatible, via boto3) --------------------

def _get_b2_client():
    # Imported lazily so boto3 is only required when
    # STORAGE_PROVIDER=b2 is actually in use.
    import boto3

    endpoint_url = current_app.config.get("B2_ENDPOINT_URL", "")
    key_id = current_app.config.get("B2_KEY_ID", "")
    application_key = current_app.config.get("B2_APPLICATION_KEY", "")

    if not endpoint_url or not key_id or not application_key:
        raise RuntimeError(
            "STORAGE_PROVIDER is set to 'b2' but one or more of "
            "B2_ENDPOINT_URL, B2_KEY_ID, B2_APPLICATION_KEY is "
            "missing from backend/.env. Set STORAGE_PROVIDER=local "
            "to use local disk storage instead."
        )

    return boto3.client(
        "s3",
        endpoint_url=endpoint_url,
        aws_access_key_id=key_id,
        aws_secret_access_key=application_key,
    )


def _b2_bucket_name() -> str:
    return current_app.config.get("B2_BUCKET_NAME", "mediledger-records")


def _save_to_b2(filename: str, data: bytes) -> None:
    client = _get_b2_client()
    client.put_object(
        Bucket=_b2_bucket_name(),
        Key=filename,
        Body=data,
    )


def _load_from_b2(filename: str) -> bytes:
    client = _get_b2_client()
    response = client.get_object(
        Bucket=_b2_bucket_name(),
        Key=filename,
    )
    return response["Body"].read()


def _b2_object_exists(filename: str) -> bool:
    import botocore

    client = _get_b2_client()

    try:
        client.head_object(
            Bucket=_b2_bucket_name(),
            Key=filename,
        )
        return True
    except botocore.exceptions.ClientError as error:
        error_code = error.response.get("Error", {}).get("Code", "")
        if error_code in ("404", "NoSuchKey"):
            return False
        raise


def b2_is_configured() -> bool:
    """True if all required B2 credentials are present in config,
    regardless of what STORAGE_PROVIDER is set to for medical
    files. Lets credential backups run independently."""
    return bool(
        current_app.config.get("B2_ENDPOINT_URL")
        and current_app.config.get("B2_KEY_ID")
        and current_app.config.get("B2_APPLICATION_KEY")
    )


def save_user_credential_backup(
    wallet_address: str, payload: dict
) -> None:
    """Store a JSON backup of a user's account record in B2, under
    a users/ prefix so it never collides with medical record files
    in the same bucket. This is a best-effort backup only -- the
    local SQLite database remains the system of record; callers
    should not fail a registration if this raises.
    """
    import json

    client = _get_b2_client()
    key = f"users/{wallet_address}.json"

    client.put_object(
        Bucket=_b2_bucket_name(),
        Key=key,
        Body=json.dumps(payload, default=str).encode("utf-8"),
        ContentType="application/json",
    )


def _delete_from_b2(filename: str) -> bool:
    if not _b2_object_exists(filename):
        return False

    client = _get_b2_client()
    client.delete_object(
        Bucket=_b2_bucket_name(),
        Key=filename,
    )
    return True
