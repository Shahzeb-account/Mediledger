"""RSA hybrid-encryption helpers.

Implements the standard hybrid pattern: bulk file data stays encrypted
with a fast symmetric cipher (Fernet/AES), while the per-file symmetric
key itself is protected with RSA so it can be safely handed to specific
recipients without ever leaving it in plaintext outside memory.
"""

import base64

from Crypto.Cipher import PKCS1_OAEP
from Crypto.PublicKey import RSA


RSA_KEY_SIZE_BITS = 2048


def generate_rsa_keypair() -> tuple[str, str]:
    """Generate a new RSA keypair.

    Returns:
        (public_pem, private_pem) as UTF-8 PEM strings.
    """
    key = RSA.generate(RSA_KEY_SIZE_BITS)
    private_pem = key.export_key().decode("utf-8")
    public_pem = key.publickey().export_key().decode("utf-8")
    return public_pem, private_pem


def wrap_key(public_pem: str, symmetric_key: bytes) -> str:
    """Encrypt (wrap) a symmetric key with an RSA public key.

    Returns the wrapped key as a base64 string, safe to store in a
    database text column.
    """
    public_key = RSA.import_key(public_pem)
    cipher_rsa = PKCS1_OAEP.new(public_key)
    wrapped = cipher_rsa.encrypt(symmetric_key)
    return base64.b64encode(wrapped).decode("utf-8")


def unwrap_key(private_pem: str, wrapped_key_b64: str) -> bytes:
    """Decrypt (unwrap) a symmetric key using the matching RSA private key."""
    private_key = RSA.import_key(private_pem)
    cipher_rsa = PKCS1_OAEP.new(private_key)
    wrapped = base64.b64decode(wrapped_key_b64)
    return cipher_rsa.decrypt(wrapped)
