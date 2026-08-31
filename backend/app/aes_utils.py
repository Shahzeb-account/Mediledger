"""AES-256-GCM file encryption.

Replaces Fernet (which uses AES-128-CBC under the hood) with true
AES-256 in GCM mode, matching Objective 4's "AES-256 encryption for
data at rest" claim literally rather than approximately. GCM is an
authenticated mode: decryption also verifies the data was not
tampered with, which CBC does not provide on its own.

Each encrypted file still gets its own randomly generated 256-bit
key, which is RSA-wrapped per authorised user exactly as before --
only what the key itself encrypts with has changed.
"""

from Crypto.Cipher import AES
from Crypto.Random import get_random_bytes

KEY_SIZE_BYTES = 32  # 256 bits
NONCE_SIZE_BYTES = 12  # recommended size for GCM
TAG_SIZE_BYTES = 16


def generate_key() -> bytes:
    """Generate a fresh random 256-bit key for one file."""
    return get_random_bytes(KEY_SIZE_BYTES)


def encrypt_bytes(key: bytes, plaintext: bytes) -> bytes:
    """Encrypt plaintext with AES-256-GCM.

    Returns nonce || tag || ciphertext, packed into a single blob
    so nothing but the key itself needs to be stored separately.
    """
    nonce = get_random_bytes(NONCE_SIZE_BYTES)
    cipher = AES.new(key, AES.MODE_GCM, nonce=nonce)
    ciphertext, tag = cipher.encrypt_and_digest(plaintext)
    return nonce + tag + ciphertext


def decrypt_bytes(key: bytes, blob: bytes) -> bytes:
    """Decrypt a blob produced by encrypt_bytes, verifying integrity.

    Raises ValueError if the data was tampered with or the key is
    wrong -- the same failure mode Fernet's decrypt() had, so
    existing error handling around it does not need to change.
    """
    nonce = blob[:NONCE_SIZE_BYTES]
    tag = blob[NONCE_SIZE_BYTES:NONCE_SIZE_BYTES + TAG_SIZE_BYTES]
    ciphertext = blob[NONCE_SIZE_BYTES + TAG_SIZE_BYTES:]

    cipher = AES.new(key, AES.MODE_GCM, nonce=nonce)
    return cipher.decrypt_and_verify(ciphertext, tag)
