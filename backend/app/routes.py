import os
from werkzeug.security import (
    generate_password_hash,
    check_password_hash,
)
from .models import UserProfile, RecordKey, db
from .crypto_utils import generate_rsa_keypair, wrap_key, unwrap_key
from . import storage_backend
from . import aes_utils
from flask import (
    Blueprint,
    current_app,
    jsonify,
    request,
    send_file,
)
from sqlalchemy import func, or_
import hashlib
import mimetypes
from werkzeug.utils import secure_filename
from io import BytesIO
from pathlib import Path
from uuid import uuid4
from cryptography.fernet import Fernet
from .blockchain import contract, web3
BASE_DIR = Path(__file__).resolve().parent.parent
KEY_FILE = BASE_DIR / "encryption.key"


def load_encryption_key() -> bytes:
    environment_key = os.getenv(
        "ENCRYPTION_KEY",
        "",
    ).strip()

    if environment_key:
        encryption_key = environment_key.encode(
            "utf-8"
        )
    else:
        # Local-development fallback.
        if not KEY_FILE.exists():
            KEY_FILE.write_bytes(
                Fernet.generate_key()
            )

        encryption_key = KEY_FILE.read_bytes().strip()

    try:
        # Validate the key during application startup.
        Fernet(encryption_key)
    except (TypeError, ValueError) as error:
        raise RuntimeError(
            "ENCRYPTION_KEY is not a valid Fernet key."
        ) from error

    return encryption_key


ENCRYPTION_KEY = load_encryption_key()
cipher = Fernet(ENCRYPTION_KEY)

ALLOWED_EXTENSIONS = {
    ".pdf",
    ".png",
    ".jpg",
    ".jpeg",
    ".doc",
    ".docx",
    ".txt",
}

api = Blueprint("api", __name__)
@api.route("/profiles/repair", methods=["POST"])
def repair_profile():
    data = request.get_json(silent=True) or {}

    wallet_address = str(
        data.get("wallet_address", "")
    ).strip()

    full_name = str(
        data.get("full_name", "")
    ).strip()

    role = data.get("role")

    if not wallet_address:
        return jsonify(
            {"error": "Wallet address is required"}
        ), 400

    if not full_name:
        return jsonify(
            {"error": "Full name is required"}
        ), 400

    if role not in [1, 2, 3]:
        return jsonify(
            {"error": "Role must be 1, 2, or 3"}
        ), 400

    try:
        checksum_address = web3.to_checksum_address(
            wallet_address
        )

        profile = UserProfile.query.filter(
            func.lower(UserProfile.wallet_address)
            == checksum_address.lower()
        ).first()

        if profile is None:
            profile = UserProfile(
                wallet_address=checksum_address,
                full_name=full_name,
                role=int(role),
            )

            db.session.add(profile)

        profile.full_name = full_name
        profile.role = int(role)
        profile.email = data.get("email")
        profile.institution = data.get("institution")
        profile.department = data.get("department")
        profile.speciality = data.get("speciality")
        profile.professional_id = data.get(
            "professional_id"
        )

        db.session.commit()

        return jsonify(
            {
                "message": "Profile repaired successfully",
                "profile": profile.to_dict(),
            }
        ), 200

    except Exception as error:
        db.session.rollback()

        return jsonify(
            {"error": str(error)}
        ), 400
@api.route("/users", methods=["GET"])
def search_user_profiles():
    query = str(
        request.args.get("q", "")
    ).strip()

    role_value = request.args.get("role")
    institution = str(
        request.args.get("institution", "")
    ).strip()

    department = str(
        request.args.get("department", "")
    ).strip()

    speciality = str(
        request.args.get("speciality", "")
    ).strip()

    profiles_query = UserProfile.query

    if role_value:
        try:
            role = int(role_value)
        except ValueError:
            return jsonify(
                {
                    "error": "Role must be an integer"
                }
            ), 400

        if role not in [1, 2, 3]:
            return jsonify(
                {
                    "error": "Role must be 1, 2, or 3"
                }
            ), 400

        profiles_query = profiles_query.filter(
            UserProfile.role == role
        )

    if query:
        search_pattern = f"%{query}%"

        profiles_query = profiles_query.filter(
    or_(
        UserProfile.full_name.ilike(
            search_pattern
        ),
        UserProfile.wallet_address.ilike(
            search_pattern
        ),
        UserProfile.email.ilike(
            search_pattern
        ),
        UserProfile.professional_id.ilike(
            search_pattern
        ),
    )
)

    if institution:
        profiles_query = profiles_query.filter(
            UserProfile.institution.ilike(
                f"%{institution}%"
            )
        )

    if department:
        profiles_query = profiles_query.filter(
            UserProfile.department.ilike(
                f"%{department}%"
            )
        )

    if speciality:
        profiles_query = profiles_query.filter(
            UserProfile.speciality.ilike(
                f"%{speciality}%"
            )
        )

    profiles = profiles_query.order_by(
        UserProfile.full_name.asc()
    ).all()

    return jsonify(
        {
            "count": len(profiles),
            "users": [
                profile.to_dict()
                for profile in profiles
            ],
        }
    ), 200
@api.route(
    "/records/<int:record_id>/audit-logs",
    methods=["GET"],
)
def get_record_audit_logs(record_id):
    account = str(
        request.args.get("account", "")
    ).strip()

    if not account:
        return jsonify(
            {
                "error": (
                    "Account query parameter is required"
                )
            }
        ), 400

    try:
        owner_address = (
            web3.to_checksum_address(account)
        )

        raw_logs = (
            contract.functions
            .getRecordAccessLogs(record_id)
            .call(
                {
                    "from": owner_address
                }
            )
        )

        logs = []

        for raw_log in raw_logs:
            accessed_by = (
                web3.to_checksum_address(
                    raw_log[1]
                )
            )

            accessor_profile = (
    UserProfile.query.filter(
        func.lower(
            UserProfile.wallet_address
        )
        == accessed_by.lower()
    ).first()
)

            logs.append(
                {
                    "record_id": int(raw_log[0]),
                    "accessed_by": accessed_by,
                    "role": int(raw_log[2]),
                    "accessed_at": int(raw_log[3]),
                    "accessor_profile": (
                        accessor_profile.to_dict()
                        if accessor_profile
                        else None
                    ),
                }
            )

        return jsonify(
            {
                "record_id": record_id,
                "owner": owner_address,
                "log_count": len(logs),
                "logs": logs,
            }
        ), 200

    except Exception as error:
        return jsonify(
            {
                "error": str(error)
            }
        ), 400
@api.route(
    "/wallets/<wallet_address>",
    methods=["GET"],
)
def get_wallet_information(wallet_address):
    try:
        checksum_address = (
            web3.to_checksum_address(
                wallet_address
            )
        )

        if not web3.is_connected():
            return jsonify(
                {
                    "error": (
                        "Blockchain connection unavailable"
                    )
                }
            ), 503

        balance_wei = web3.eth.get_balance(
            checksum_address
        )

        return jsonify(
            {
                "account": checksum_address,
                "balance_wei": str(balance_wei),
                "balance_eth": str(
                    web3.from_wei(
                        balance_wei,
                        "ether",
                    )
                ),
                "chain_id": web3.eth.chain_id,
                "latest_block":
                    web3.eth.block_number,
                "contract_address":
                    contract.address,
                "blockchain_connected": True,
            }
        ), 200

    except Exception as error:
        return jsonify(
            {
                "error": str(error)
            }
        ), 400
@api.route("/")
def home():
    return jsonify(
        {
            "message": "Healthcare Blockchain API Running"
        }
    )


@api.route("/health")
def health():
    connected = web3.is_connected()

    return jsonify(
        {
            "status": "healthy" if connected else "unhealthy",
            "blockchain_connected": connected,
            "latest_block": (
                web3.eth.block_number if connected else None
            ),
            "contract_address": contract.address,
        }
    )


@api.route("/blockchain/accounts")
def blockchain_accounts():
    accounts = web3.eth.accounts[1:]

    return jsonify(
        {
            "count": len(accounts),
            "accounts": accounts,
        }
    )


@api.route("/users/register", methods=["POST"])
def register_user():
    data = request.get_json()

    if not data:
        return jsonify(
            {
                "error": "JSON body is required"
            }
        ), 400

    name = data.get("name")
    role = data.get("role")
    account = data.get("account")

    if not name:
        return jsonify(
            {
                "error": "Name is required"
            }
        ), 400

    if role not in [1, 2, 3]:
        return jsonify(
            {
                "error": (
                    "Role must be 1 for Patient, "
                    "2 for Doctor, or 3 for Researcher"
                )
            }
        ), 400

    if not account:
        return jsonify(
            {
                "error": "Account is required"
            }
        ), 400

    try:
        checksum_account = web3.to_checksum_address(
            account
        )

        transaction_hash = (
            contract.functions.registerUser(
                name,
                role
            ).transact(
                {
                    "from": checksum_account
                }
            )
        )

        receipt = web3.eth.wait_for_transaction_receipt(
            transaction_hash
        )

        return jsonify(
            {
                "message": "User registered successfully",
                "transaction_hash": transaction_hash.hex(),
                "block_number": receipt.blockNumber,
                "account": checksum_account,
                "name": name,
                "role": role,
            }
        ), 201

    except Exception as error:
        return jsonify(
            {
                "error": str(error)
            }
        ), 400


@api.route("/users/<account>", methods=["GET"])
def get_user(account):
    try:
        checksum_account = web3.to_checksum_address(
            account
        )

        user = contract.functions.getUser(
            checksum_account
        ).call()

        return jsonify(
            {
                "wallet": user[0],
                "name": user[1],
                "role": user[2],
                "is_registered": user[3],
            }
        ), 200

    except Exception as error:
        return jsonify(
            {
                "error": str(error)
            }
        ), 400


@api.route("/users/login-email", methods=["POST"])
def login_with_email():
    data = request.get_json()

    if not data:
        return jsonify(
            {
                "error": "JSON body is required"
            }
        ), 400

    email = str(data.get("email", "")).strip()
    password = str(data.get("password", ""))

    if not email or not password:
        return jsonify(
            {
                "error": "Email and password are required"
            }
        ), 400

    profile = UserProfile.query.filter(
        db.func.lower(UserProfile.email) == email.lower()
    ).first()

    if (
        not profile
        or not profile.password_hash
        or not check_password_hash(
            profile.password_hash, password
        )
    ):
        return jsonify(
            {
                "error": "Invalid email or password."
            }
        ), 401

    return jsonify(
        {
            "wallet_address": profile.wallet_address,
        }
    ), 200


@api.route("/records", methods=["POST"])
def add_medical_record():
    data = request.get_json()

    if not data:
        return jsonify(
            {
                "error": "JSON body is required"
            }
        ), 400

    account = data.get("account")
    file_hash = data.get("file_hash")
    storage_reference = data.get("storage_reference")

    if not account:
        return jsonify(
            {
                "error": "Account is required"
            }
        ), 400

    if not file_hash:
        return jsonify(
            {
                "error": "File hash is required"
            }
        ), 400

    if not storage_reference:
        return jsonify(
            {
                "error": "Storage reference is required"
            }
        ), 400

    try:
        checksum_account = web3.to_checksum_address(
            account
        )

        transaction_hash = (
            contract.functions.addMedicalRecord(
                file_hash,
                storage_reference
            ).transact(
                {
                    "from": checksum_account
                }
            )
        )

        receipt = web3.eth.wait_for_transaction_receipt(
            transaction_hash
        )

        return jsonify(
            {
                "message": "Medical record added successfully",
                "transaction_hash": transaction_hash.hex(),
                "block_number": receipt.blockNumber,
                "patient": checksum_account,
                "file_hash": file_hash,
                "storage_reference": storage_reference,
            }
        ), 201

    except Exception as error:
        return jsonify(
            {
                "error": str(error)
            }
        ), 400
@api.route(
    "/patients/<account>/records",
    methods=["GET"]
)
def get_patient_record_ids(account):
    try:
        checksum_account = web3.to_checksum_address(
            account
        )

        all_record_ids = (
            contract.functions.getPatientRecordIds(
                checksum_account
            ).call()
        )

        active_record_ids = []

        for record_id in all_record_ids:
            is_deleted = (
                contract.functions.isRecordDeleted(
                    int(record_id)
                ).call()
            )

            if not is_deleted:
                active_record_ids.append(
                    int(record_id)
                )

        return jsonify(
            {
                "patient": checksum_account,
                "record_count": len(active_record_ids),
                "record_ids": active_record_ids,
            }
        ), 200

    except Exception as error:
        return jsonify(
            {
                "error": str(error)
            }
        ), 400
@api.route("/records/<int:record_id>", methods=["GET"])
def get_medical_record(record_id):
    account = request.args.get("account")

    if not account:
        return jsonify(
            {
                "error": "Account query parameter is required"
            }
        ), 400

    try:
        checksum_account = web3.to_checksum_address(account)

        record = contract.functions.getMedicalRecord(
            record_id
        ).call(
            {
                "from": checksum_account
            }
        )

        return jsonify(
            {
                "record_id": record[0],
                "patient": record[1],
                "file_hash": record[2],
                "storage_reference": record[3],
                "created_at": record[4],
                "exists": record[5],
            }
        ), 200

    except Exception as error:
        return jsonify(
            {
                "error": str(error)
            }
        ), 400
@api.route("/access/grant", methods=["POST"])
def grant_access():
    data = request.get_json()

    if not data:
        return jsonify(
            {
                "error": "JSON body is required"
            }
        ), 400

    patient_account = data.get("patient_account")
    authorised_account = data.get("authorised_account")
    record_id = data.get("record_id")

    if not patient_account:
        return jsonify(
            {
                "error": "Patient account is required"
            }
        ), 400

    if not authorised_account:
        return jsonify(
            {
                "error": "Authorised account is required"
            }
        ), 400

    if record_id is None:
        return jsonify(
            {
                "error": "Record ID is required"
            }
        ), 400

    try:
        patient_checksum = web3.to_checksum_address(
            patient_account
        )

        authorised_checksum = web3.to_checksum_address(
            authorised_account
        )

        transaction_hash = (
            contract.functions.grantAccess(
                int(record_id),
                authorised_checksum
            ).transact(
                {
                    "from": patient_checksum
                }
            )
        )

        receipt = web3.eth.wait_for_transaction_receipt(
            transaction_hash
        )

        # Give the newly authorised wallet its own RSA-wrapped copy
        # of the record's symmetric file key, so it can decrypt the
        # file without ever needing the owner's private key.
        owner_key_entry = RecordKey.query.filter_by(
            record_id=int(record_id),
            wallet_address=patient_checksum,
        ).first()

        grantee_profile = UserProfile.query.filter_by(
            wallet_address=authorised_checksum
        ).first()

        owner_profile = UserProfile.query.filter_by(
            wallet_address=patient_checksum
        ).first()

        if (
            owner_key_entry
            and grantee_profile
            and grantee_profile.rsa_public_key
            and owner_profile
            and owner_profile.rsa_private_key_encrypted
        ):
            owner_private_key = cipher.decrypt(
                owner_profile.rsa_private_key_encrypted.encode(
                    "utf-8"
                )
            ).decode("utf-8")

            file_key = unwrap_key(
                owner_private_key,
                owner_key_entry.wrapped_key,
            )

            wrapped_for_grantee = wrap_key(
                grantee_profile.rsa_public_key,
                file_key,
            )

            existing_entry = RecordKey.query.filter_by(
                record_id=int(record_id),
                wallet_address=authorised_checksum,
            ).first()

            if existing_entry:
                existing_entry.wrapped_key = wrapped_for_grantee
            else:
                db.session.add(
                    RecordKey(
                        record_id=int(record_id),
                        wallet_address=authorised_checksum,
                        wrapped_key=wrapped_for_grantee,
                    )
                )

            db.session.commit()

        return jsonify(
            {
                "message": "Access granted successfully",
                "record_id": int(record_id),
                "patient": patient_checksum,
                "authorised_user": authorised_checksum,
                "transaction_hash": transaction_hash.hex(),
                "block_number": receipt.blockNumber,
            }
        ), 200

    except Exception as error:
        return jsonify(
            {
                "error": str(error)
            }
        ), 400
@api.route("/access/revoke", methods=["POST"])
def revoke_access():
    data = request.get_json()

    if not data:
        return jsonify(
            {
                "error": "JSON body is required"
            }
        ), 400

    patient_account = data.get("patient_account")
    authorised_account = data.get("authorised_account")
    record_id = data.get("record_id")

    if not patient_account:
        return jsonify(
            {
                "error": "Patient account is required"
            }
        ), 400

    if not authorised_account:
        return jsonify(
            {
                "error": "Authorised account is required"
            }
        ), 400

    if record_id is None:
        return jsonify(
            {
                "error": "Record ID is required"
            }
        ), 400

    try:
        patient_checksum = web3.to_checksum_address(
            patient_account
        )

        authorised_checksum = web3.to_checksum_address(
            authorised_account
        )

        transaction_hash = (
            contract.functions.revokeAccess(
                int(record_id),
                authorised_checksum
            ).transact(
                {
                    "from": patient_checksum
                }
            )
        )

        receipt = web3.eth.wait_for_transaction_receipt(
            transaction_hash
        )

        # Remove the revoked wallet's RSA-wrapped copy of the file
        # key so it no longer has any way to decrypt the record,
        # even if the encrypted file bytes remain on disk.
        RecordKey.query.filter_by(
            record_id=int(record_id),
            wallet_address=authorised_checksum,
        ).delete()

        db.session.commit()

        return jsonify(
            {
                "message": "Access revoked successfully",
                "record_id": int(record_id),
                "patient": patient_checksum,
                "authorised_user": authorised_checksum,
                "transaction_hash": transaction_hash.hex(),
                "block_number": receipt.blockNumber,
            }
        ), 200

    except Exception as error:
        return jsonify(
            {
                "error": str(error)
            }
        ), 400
@api.route("/access/check", methods=["GET"])
def check_access():
    record_id = request.args.get("record_id")
    account = request.args.get("account")

    if record_id is None:
        return jsonify(
            {
                "error": "Record ID query parameter is required"
            }
        ), 400

    if not account:
        return jsonify(
            {
                "error": "Account query parameter is required"
            }
        ), 400

    try:
        checksum_account = web3.to_checksum_address(account)

        access_allowed = contract.functions.hasAccess(
            int(record_id),
            checksum_account
        ).call()

        return jsonify(
            {
                "record_id": int(record_id),
                "account": checksum_account,
                "has_access": access_allowed,
            }
        ), 200

    except Exception as error:
        return jsonify(
            {
                "error": str(error)
            }
        ), 400
@api.route("/records/<int:record_id>/access", methods=["POST"])
def access_medical_record(record_id):
    data = request.get_json()

    if not data:
        return jsonify(
            {
                "error": "JSON body is required"
            }
        ), 400

    account = data.get("account")

    if not account:
        return jsonify(
            {
                "error": "Account is required"
            }
        ), 400

    try:
        checksum_account = web3.to_checksum_address(account)

        transaction_hash = (
            contract.functions.accessMedicalRecord(
                record_id
            ).transact(
                {
                    "from": checksum_account
                }
            )
        )

        receipt = web3.eth.wait_for_transaction_receipt(
            transaction_hash
        )

        record = contract.functions.getMedicalRecord(
            record_id
        ).call(
            {
                "from": checksum_account
            }
        )

        return jsonify(
            {
                "message": "Medical record accessed successfully",
                "record_id": record[0],
                "patient": record[1],
                "file_hash": record[2],
                "storage_reference": record[3],
                "created_at": record[4],
                "exists": record[5],
                "accessed_by": checksum_account,
                "transaction_hash": transaction_hash.hex(),
                "block_number": receipt.blockNumber,
            }
        ), 200

    except Exception as error:
        return jsonify(
            {
                "error": str(error)
            }
        ), 400
@api.route("/records/upload", methods=["POST"])
def upload_medical_record():
    account = request.form.get("account")
    uploaded_file = request.files.get("file")

    if not account:
        return jsonify(
            {
                "error": "Account is required"
            }
        ), 400

    if not uploaded_file:
        return jsonify(
            {
                "error": "File is required"
            }
        ), 400

    original_name = secure_filename(
        uploaded_file.filename or "medical-record"
    )

    if not original_name:
        return jsonify(
            {
                "error": "Invalid filename"
            }
        ), 400

    extension = Path(original_name).suffix.lower()

    if extension not in ALLOWED_EXTENSIONS:
        return jsonify(
            {
                "error": (
                    "Allowed file types are PDF, PNG, JPG, "
                    "JPEG, DOC, DOCX and TXT"
                )
            }
        ), 400

    try:
        file_data = uploaded_file.read()

        if not file_data:
            return jsonify(
                {
                    "error": "Uploaded file is empty"
                }
            ), 400

        file_hash = hashlib.sha256(file_data).hexdigest()

        # A fresh symmetric key is generated for every file, rather
        # than reusing one shared server-wide key. This key is what
        # actually encrypts the file bytes; it is then protected via
        # RSA below so only authorised wallets can ever recover it.
        file_key = aes_utils.generate_key()
        encrypted_data = aes_utils.encrypt_bytes(
            file_key, file_data
        )

        encrypted_filename = (
            f"{uuid4().hex}__{original_name}.enc"
        )

        storage_backend.save_encrypted_file(
            encrypted_filename,
            encrypted_data,
        )

        storage_reference = encrypted_filename

        checksum_account = web3.to_checksum_address(
            account
        )

        transaction_hash = (
            contract.functions.addMedicalRecord(
                file_hash,
                storage_reference
            ).transact(
                {
                    "from": checksum_account
                }
            )
        )

        receipt = web3.eth.wait_for_transaction_receipt(
            transaction_hash
        )

        added_events = (
            contract.events.MedicalRecordAdded()
            .process_receipt(receipt)
        )

        new_record_id = (
            added_events[0]["args"]["recordId"]
            if added_events
            else None
        )

        owner_profile = UserProfile.query.filter_by(
            wallet_address=checksum_account
        ).first()

        if new_record_id is not None and owner_profile and owner_profile.rsa_public_key:
            wrapped_key = wrap_key(
                owner_profile.rsa_public_key,
                file_key,
            )

            db.session.add(
                RecordKey(
                    record_id=new_record_id,
                    wallet_address=checksum_account,
                    wrapped_key=wrapped_key,
                )
            )
            db.session.commit()

        return jsonify(
            {
                "message": "Medical record uploaded successfully",
                "record_id": new_record_id,
                "original_filename": original_name,
                "file_hash": file_hash,
                "storage_reference": storage_reference,
                "transaction_hash": transaction_hash.hex(),
                "block_number": receipt.blockNumber,
            }
        ), 201

    except Exception as error:
        return jsonify(
            {
                "error": str(error)
            }
        ), 400
@api.route(
    "/records/<int:record_id>/download",
    methods=["GET"]
)
def download_medical_record(record_id):
    account = request.args.get("account")

    if not account:
        return jsonify(
            {
                "error": "Account query parameter is required"
            }
        ), 400

    try:
        checksum_account = web3.to_checksum_address(account)

        record = contract.functions.getMedicalRecord(
            record_id
        ).call(
            {
                "from": checksum_account
            }
        )

        storage_reference = record[3]

        stored_filename = Path(storage_reference).name

        if not storage_backend.encrypted_file_exists(stored_filename):
            return jsonify(
                {
                    "error": "Encrypted file not found"
                }
            ), 404

        requester_profile = UserProfile.query.filter_by(
            wallet_address=checksum_account
        ).first()

        key_entry = RecordKey.query.filter_by(
            record_id=record_id,
            wallet_address=checksum_account,
        ).first()

        if (
            not requester_profile
            or not requester_profile.rsa_private_key_encrypted
            or not key_entry
        ):
            return jsonify(
                {
                    "error": (
                        "No decryption key is available for this "
                        "account on this record."
                    )
                }
            ), 403

        rsa_private_key = cipher.decrypt(
            requester_profile.rsa_private_key_encrypted.encode(
                "utf-8"
            )
        ).decode("utf-8")

        file_key = unwrap_key(
            rsa_private_key,
            key_entry.wrapped_key,
        )

        encrypted_data = storage_backend.load_encrypted_file(
            stored_filename
        )
        decrypted_data = aes_utils.decrypt_bytes(
            file_key, encrypted_data
        )

        stored_name = stored_filename

        if stored_name.endswith(".enc"):
            stored_name = stored_name[:-4]

        if "__" in stored_name:
            original_name = stored_name.split("__", 1)[1]
        else:
            original_name = stored_name.split("_", 1)[-1]

            if "." not in original_name:
                if decrypted_data.startswith(b"\x89PNG\r\n\x1a\n"):
                    original_name += ".png"
                elif decrypted_data.startswith(b"%PDF"):
                    original_name += ".pdf"
                elif decrypted_data.startswith(b"\xff\xd8\xff"):
                    original_name += ".jpg"
                elif decrypted_data.startswith(b"PK"):
                    original_name += ".docx"
                else:
                    original_name += ".bin"

        mime_type = (
            mimetypes.guess_type(original_name)[0]
            or "application/octet-stream"
        )

        return send_file(
            BytesIO(decrypted_data),
            as_attachment=True,
            download_name=original_name,
            mimetype=mime_type,
        )

    except Exception as error:
        return jsonify(
            {
                "error": str(error)
            }
        ), 400
@api.route("/users/register-auto", methods=["POST"])
def register_user_automatically():
    data = request.get_json()

    if not data:
        return jsonify(
            {
                "error": "JSON body is required"
            }
        ), 400

    full_name = str(
        data.get("full_name", "")
    ).strip()

    role = data.get("role")

    email = str(
        data.get("email", "")
    ).strip() or None

    institution = str(
        data.get("institution", "")
    ).strip() or None

    department = str(
        data.get("department", "")
    ).strip() or None

    speciality = str(
        data.get("speciality", "")
    ).strip() or None

    professional_id = str(
        data.get("professional_id", "")
    ).strip() or None

    password = str(
        data.get("password", "")
    ).strip() or None

    if not full_name:
        return jsonify(
            {
                "error": "Full name is required"
            }
        ), 400

    if role not in [1, 2, 3]:
        return jsonify(
            {
                "error": (
                    "Role must be 1 for Patient, "
                    "2 for Doctor, or 3 for Researcher"
                )
            }
        ), 400

    if role == 2 and not institution:
        return jsonify(
            {
                "error": (
                    "Doctors must provide a hospital "
                    "or institution"
                )
            }
        ), 400

    if email and not password:
        return jsonify(
            {
                "error": (
                    "A password is required when providing "
                    "an email address, so you can log in with "
                    "email and password later."
                )
            }
        ), 400

    if email:
        existing_email = UserProfile.query.filter(
            db.func.lower(UserProfile.email) == email.lower()
        ).first()

        if existing_email:
            return jsonify(
                {
                    "error": (
                        "An account with this email address "
                        "already exists."
                    )
                }
            ), 409

    try:
        available_account = None

        for account in web3.eth.accounts[1:]:
            checksum_account = web3.to_checksum_address(
                account
            )

            user = contract.functions.getUser(
                checksum_account
            ).call()

            is_registered = bool(user[3])

            existing_profile = UserProfile.query.filter_by(
                wallet_address=checksum_account
            ).first()

            if not is_registered and existing_profile is None:
                available_account = checksum_account
                break

        if available_account is None:
            return jsonify(
                {
                    "error": (
                        "No unused Hardhat accounts are available."
                    )
                }
            ), 409

        transaction_hash = (
            contract.functions.registerUser(
                full_name,
                int(role),
            ).transact(
                {
                    "from": available_account
                }
            )
        )

        receipt = web3.eth.wait_for_transaction_receipt(
            transaction_hash
        )

        rsa_public_key, rsa_private_key = generate_rsa_keypair()

        rsa_private_key_encrypted = cipher.encrypt(
            rsa_private_key.encode("utf-8")
        ).decode("utf-8")

        password_hash = (
            generate_password_hash(password)
            if password
            else None
        )

        profile = UserProfile(
            wallet_address=available_account,
            full_name=full_name,
            role=int(role),
            email=email,
            institution=institution,
            department=department,
            speciality=speciality,
            professional_id=professional_id,
            rsa_public_key=rsa_public_key,
            rsa_private_key_encrypted=rsa_private_key_encrypted,
            password_hash=password_hash,
        )

        db.session.add(profile)
        db.session.commit()

        if storage_backend.b2_is_configured():
            try:
                storage_backend.save_user_credential_backup(
                    profile.wallet_address,
                    {
                        "wallet_address": profile.wallet_address,
                        "full_name": profile.full_name,
                        "role": profile.role,
                        "email": profile.email,
                        "institution": profile.institution,
                        "department": profile.department,
                        "speciality": profile.speciality,
                        "professional_id": profile.professional_id,
                        "password_hash": profile.password_hash,
                        "rsa_public_key": profile.rsa_public_key,
                        "rsa_private_key_encrypted": (
                            profile.rsa_private_key_encrypted
                        ),
                        "created_at": profile.created_at,
                    },
                )
            except Exception as backup_error:
                # A failed cloud backup should never block a
                # successful registration -- the local database
                # remains the system of record.
                current_app.logger.warning(
                    "B2 credential backup failed for %s: %s",
                    profile.wallet_address,
                    backup_error,
                )

        return jsonify(
            {
                "message": "User registered successfully",
                "assigned_wallet": available_account,
                "transaction_hash": transaction_hash.hex(),
                "block_number": receipt.blockNumber,
                "profile": profile.to_dict(),
            }
        ), 201

    except Exception as error:
        db.session.rollback()

        return jsonify(
            {
                "error": str(error)
            }
        ), 400
@api.route("/profiles/<wallet_address>", methods=["GET"])
def get_profile(wallet_address):
    try:
        checksum_address = web3.to_checksum_address(
            wallet_address
        )

        profile = UserProfile.query.filter_by(
            wallet_address=checksum_address
        ).first()

        if profile is None:
            return jsonify(
                {
                    "error": "Profile not found"
                }
            ), 404

        return jsonify(profile.to_dict()), 200

    except Exception as error:
        return jsonify(
            {
                "error": str(error)
            }
        ), 400
@api.route(
    "/profiles/<wallet_address>",
    methods=["PATCH"],
)
def update_profile(wallet_address):
    data = request.get_json(silent=True)

    if not data:
        return jsonify(
            {
                "error": "JSON body is required"
            }
        ), 400

    try:
        checksum_address = (
            web3.to_checksum_address(
                wallet_address
            )
        )
    except ValueError:
        return jsonify(
            {
                "error": "Invalid wallet address"
            }
        ), 400

    profile = UserProfile.query.filter_by(
        wallet_address=checksum_address
    ).first()

    if profile is None:
        return jsonify(
            {
                "error": "Profile not found"
            }
        ), 404

    allowed_fields = {
        "full_name",
        "email",
        "institution",
        "department",
        "speciality",
        "professional_id",
    }

    for field_name in allowed_fields:
        if field_name not in data:
            continue

        value = data[field_name]

        if value is not None:
            value = str(value).strip() or None

        setattr(
            profile,
            field_name,
            value,
        )

    if not profile.full_name:
        return jsonify(
            {
                "error": "Full name cannot be empty"
            }
        ), 400

    if (
        profile.role == 2
        and not profile.institution
    ):
        return jsonify(
            {
                "error": (
                    "Doctors must provide an institution"
                )
            }
        ), 400

    try:
        db.session.commit()
    except Exception as error:
        db.session.rollback()

        return jsonify(
            {
                "error": str(error)
            }
        ), 500

    return jsonify(
        profile.to_dict()
    ), 200
@api.route(
    "/doctors/<doctor_wallet>/patients/<patient_wallet>/shared-records",
    methods=["GET"],
)
def get_doctor_shared_records(
    doctor_wallet,
    patient_wallet,
):
    try:
        doctor_address = web3.to_checksum_address(
            doctor_wallet
        )

        patient_address = web3.to_checksum_address(
            patient_wallet
        )

        doctor = contract.functions.getUser(
            doctor_address
        ).call()

        patient = contract.functions.getUser(
            patient_address
        ).call()

        if not doctor[3]:
            return jsonify(
                {
                    "error": "Doctor wallet is not registered"
                }
            ), 404

        if doctor[2] != 2:
            return jsonify(
                {
                    "error": "The supplied wallet is not a doctor"
                }
            ), 403

        if not patient[3]:
            return jsonify(
                {
                    "error": "Patient wallet is not registered"
                }
            ), 404

        if patient[2] != 1:
            return jsonify(
                {
                    "error": "The supplied wallet is not a patient"
                }
            ), 403

        record_ids = (
            contract.functions.getPatientRecordIds(
                patient_address
            ).call()
        )

        shared_records = []

        for record_id in record_ids:
            has_access = contract.functions.hasAccess(
                int(record_id),
                doctor_address,
            ).call()

            if not has_access:
                continue

            record = contract.functions.getMedicalRecord(
                int(record_id)
            ).call(
                {
                    "from": doctor_address
                }
            )

            shared_records.append(
                {
                    "record_id": record[0],
                    "patient": record[1],
                    "file_hash": record[2],
                    "storage_reference": record[3],
                    "created_at": record[4],
                    "exists": record[5],
                }
            )

        return jsonify(
            {
                "doctor": doctor_address,
                "patient": patient_address,
                "record_count": len(shared_records),
                "records": shared_records,
            }
        ), 200

    except Exception as error:
        return jsonify(
            {
                "error": str(error)
            }
        ), 400
@api.route(
    "/patients/<patient_wallet>/doctors/<doctor_wallet>/shared-records",
    methods=["GET"],
)
def get_patient_shared_records(
    patient_wallet,
    doctor_wallet,
):
    try:
        patient_address = web3.to_checksum_address(
            patient_wallet
        )

        doctor_address = web3.to_checksum_address(
            doctor_wallet
        )

        patient = contract.functions.getUser(
            patient_address
        ).call()

        doctor = contract.functions.getUser(
            doctor_address
        ).call()

        if not patient[3]:
            return jsonify(
                {
                    "error": "Patient wallet is not registered"
                }
            ), 404

        if patient[2] != 1:
            return jsonify(
                {
                    "error": "The supplied wallet is not a patient"
                }
            ), 403

        if not doctor[3]:
            return jsonify(
                {
                    "error": "Doctor wallet is not registered"
                }
            ), 404

        if doctor[2] != 2:
            return jsonify(
                {
                    "error": "The supplied wallet is not a doctor"
                }
            ), 403

        doctor_record_ids = (
            contract.functions.getOwnerRecordIds(
                doctor_address
            ).call()
        )

        shared_records = []

        for record_id in doctor_record_ids:
            has_access = contract.functions.hasAccess(
                int(record_id),
                patient_address,
            ).call()

            if not has_access:
                continue

            record = contract.functions.getMedicalRecord(
                int(record_id)
            ).call(
                {
                    "from": patient_address
                }
            )

            shared_records.append(
                {
                    "record_id": record[0],
                    "patient": record[1],
                    "file_hash": record[2],
                    "storage_reference": record[3],
                    "created_at": record[4],
                    "exists": record[5],
                }
            )

        return jsonify(
            {
                "patient": patient_address,
                "doctor": doctor_address,
                "record_count": len(shared_records),
                "records": shared_records,
            }
        ), 200

    except Exception as error:
        return jsonify(
            {
                "error": str(error)
            }
        ), 400
@api.route("/records/<int:record_id>", methods=["DELETE"])
def delete_medical_record(record_id):
    data = request.get_json(silent=True) or {}

    account = str(
        data.get("account", "")
    ).strip()

    if not account:
        return jsonify(
            {
                "error": "Account is required"
            }
        ), 400

    try:
        checksum_account = web3.to_checksum_address(
            account
        )

        # Read the record before deleting it so we can locate
        # the encrypted file in backend storage.
        record = contract.functions.getMedicalRecord(
            record_id
        ).call(
            {
                "from": checksum_account
            }
        )

        record_owner = web3.to_checksum_address(
            record[1]
        )

        if record_owner != checksum_account:
            return jsonify(
                {
                    "error": (
                        "Only the record owner can delete "
                        "this medical record"
                    )
                }
            ), 403

        storage_reference = record[3]

        transaction_hash = (
            contract.functions.deleteMedicalRecord(
                record_id
            ).transact(
                {
                    "from": checksum_account
                }
            )
        )

        receipt = web3.eth.wait_for_transaction_receipt(
            transaction_hash
        )

        file_removed = storage_backend.delete_encrypted_file(
            Path(storage_reference).name
        )

        return jsonify(
            {
                "message": "Medical record deleted successfully",
                "record_id": record_id,
                "owner": checksum_account,
                "file_removed": file_removed,
                "transaction_hash": transaction_hash.hex(),
                "block_number": receipt.blockNumber,
            }
        ), 200

    except Exception as error:
        return jsonify(
            {
                "error": str(error)
            }
        ), 400
@api.route(
    "/users/<wallet>/shared-records/inbox",
    methods=["GET"],
)
def get_shared_record_inbox(wallet):
    try:
        recipient_address = web3.to_checksum_address(
            wallet
        )

        recipient_user = contract.functions.getUser(
            recipient_address
        ).call()

        if not recipient_user[3]:
            return jsonify(
                {
                    "error": "Recipient wallet is not registered"
                }
            ), 404

        recipient_role = int(recipient_user[2])

        if recipient_role == 1:
            owner_role = 2
        elif recipient_role in (2, 3):
            owner_role = 1
        else:
            return jsonify(
                {
                    "error": "Invalid recipient role"
                }
            ), 400

        possible_owners = UserProfile.query.filter_by(
            role=owner_role
        ).all()

        inbox_records = []

        for owner_profile in possible_owners:
            try:
                owner_address = web3.to_checksum_address(
                    owner_profile.wallet_address
                )

                blockchain_owner = (
                    contract.functions.getUser(
                        owner_address
                    ).call()
                )

                if not blockchain_owner[3]:
                    continue

                record_ids = (
                    contract.functions.getOwnerRecordIds(
                        owner_address
                    ).call()
                )

                for record_id in record_ids:
                    is_deleted = (
                        contract.functions.isRecordDeleted(
                            int(record_id)
                        ).call()
                    )

                    if is_deleted:
                        continue

                    has_access = (
                        contract.functions.hasAccess(
                            int(record_id),
                            recipient_address,
                        ).call()
                    )

                    if not has_access:
                        continue

                    record = (
                        contract.functions.getMedicalRecord(
                            int(record_id)
                        ).call(
                            {
                                "from": recipient_address
                            }
                        )
                    )

                    inbox_records.append(
                        {
                            "record_id": int(record[0]),
                            "owner_wallet": record[1],
                            "file_hash": record[2],
                            "storage_reference": record[3],
                            "created_at": int(record[4]),
                            "exists": bool(record[5]),
                            "owner_profile": {
                                "full_name": (
                                    owner_profile.full_name
                                ),
                                "role": owner_profile.role,
                                "email": owner_profile.email,
                                "institution": (
                                    owner_profile.institution
                                ),
                                "department": (
                                    owner_profile.department
                                ),
                                "speciality": (
                                    owner_profile.speciality
                                ),
                                "professional_id": (
                                    owner_profile.professional_id
                                ),
                                "wallet_address": (
                                    owner_profile.wallet_address
                                ),
                            },
                        }
                    )

            except Exception as owner_error:
                print(
                    "Skipping owner",
                    owner_profile.wallet_address,
                    owner_error,
                )
                continue

        inbox_records.sort(
            key=lambda item: item["created_at"],
            reverse=True,
        )

        return jsonify(
            {
                "recipient": recipient_address,
                "recipient_role": recipient_role,
                "record_count": len(inbox_records),
                "records": inbox_records,
            }
        ), 200

    except Exception as error:
        return jsonify(
            {
                "error": str(error)
            }
        ), 400
