"""Fernet-based encryption for data source credentials.

Credentials are encrypted at rest and decrypted on-demand when establishing
connections. Mirrors the Flowise AES credential pattern.

For production, swap ``get_or_create_key`` to read from a secrets manager
(AWS Secrets Manager, HashiCorp Vault, etc.) instead of a local file.
"""

from __future__ import annotations

import json
from pathlib import Path

from cryptography.fernet import Fernet

_DEFAULT_KEY_PATH = Path.home() / ".flowise" / "federated_encryption.key"


def get_or_create_key(key_path: Path = _DEFAULT_KEY_PATH) -> bytes:
    """Return the Fernet key, creating it if it doesn't exist."""
    if key_path.exists():
        return key_path.read_bytes().strip()
    key_path.parent.mkdir(parents=True, exist_ok=True)
    key = Fernet.generate_key()
    key_path.write_bytes(key)
    return key


def encrypt_config(config: dict, key_path: Path = _DEFAULT_KEY_PATH) -> str:
    """Encrypt a config dict to a Fernet token string."""
    key = get_or_create_key(key_path)
    f = Fernet(key)
    plaintext = json.dumps(config).encode()
    return f.encrypt(plaintext).decode()


def decrypt_config(encrypted: str, key_path: Path = _DEFAULT_KEY_PATH) -> dict:
    """Decrypt a Fernet token string back to a config dict."""
    key = get_or_create_key(key_path)
    f = Fernet(key)
    plaintext = f.decrypt(encrypted.encode())
    return json.loads(plaintext)
