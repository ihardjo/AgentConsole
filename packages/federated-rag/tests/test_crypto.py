from __future__ import annotations

from pathlib import Path

import pytest

from federated_rag.crypto import decrypt_config, encrypt_config, get_or_create_key


def test_get_or_create_key_creates_file(tmp_path: Path):
    key_path = tmp_path / "encryption.key"
    key = get_or_create_key(key_path)
    assert key_path.exists()
    assert len(key) > 0


def test_get_or_create_key_reads_existing(tmp_path: Path):
    key_path = tmp_path / "encryption.key"
    key1 = get_or_create_key(key_path)
    key2 = get_or_create_key(key_path)
    assert key1 == key2


def test_encrypt_decrypt_round_trip(tmp_path: Path):
    key_path = tmp_path / "encryption.key"
    config = {
        "host": "hr-db.company.internal",
        "port": 5432,
        "user": "readonly",
        "password": "s3cret!Pa$$word",
        "database": "hr_production",
    }
    encrypted = encrypt_config(config, key_path)
    assert isinstance(encrypted, str)
    assert "s3cret" not in encrypted

    decrypted = decrypt_config(encrypted, key_path)
    assert decrypted == config


def test_encrypted_output_is_not_plaintext(tmp_path: Path):
    key_path = tmp_path / "encryption.key"
    config = {"password": "super_secret_123"}
    encrypted = encrypt_config(config, key_path)
    assert "super_secret_123" not in encrypted
    assert "password" not in encrypted


def test_decrypt_with_wrong_key_fails(tmp_path: Path):
    key_path_a = tmp_path / "key_a.key"
    key_path_b = tmp_path / "key_b.key"
    config = {"password": "secret"}
    encrypted = encrypt_config(config, key_path_a)
    with pytest.raises(Exception):
        decrypt_config(encrypted, key_path_b)
