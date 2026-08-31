from datetime import datetime, timezone

from flask_sqlalchemy import SQLAlchemy


db = SQLAlchemy()


class UserProfile(db.Model):
    __tablename__ = "user_profiles"

    id = db.Column(db.Integer, primary_key=True)

    wallet_address = db.Column(
        db.String(42),
        unique=True,
        nullable=False,
        index=True,
    )

    full_name = db.Column(
        db.String(150),
        nullable=False,
    )

    role = db.Column(
        db.Integer,
        nullable=False,
    )

    email = db.Column(
        db.String(150),
        nullable=True,
    )

    institution = db.Column(
        db.String(200),
        nullable=True,
    )

    department = db.Column(
        db.String(150),
        nullable=True,
    )

    speciality = db.Column(
        db.String(150),
        nullable=True,
    )

    professional_id = db.Column(
        db.String(100),
        nullable=True,
    )

    password_hash = db.Column(
        db.String(255),
        nullable=True,
    )

    # RSA keypair used for hybrid encryption of medical record
    # symmetric file keys. The public key is shared freely; the
    # private key is stored encrypted at rest with the server's
    # master Fernet key (a documented prototype simplification --
    # in a production system the private key would be held
    # client-side, e.g. via the user's wallet, never on the server).
    rsa_public_key = db.Column(
        db.Text,
        nullable=True,
    )

    rsa_private_key_encrypted = db.Column(
        db.Text,
        nullable=True,
    )

    created_at = db.Column(
        db.DateTime,
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
    )

    def to_dict(self):
        return {
            "id": self.id,
            "wallet_address": self.wallet_address,
            "full_name": self.full_name,
            "role": self.role,
            "email": self.email,
            "institution": self.institution,
            "department": self.department,
            "speciality": self.speciality,
            "professional_id": self.professional_id,
            "rsa_public_key": self.rsa_public_key,
            "created_at": self.created_at.isoformat(),
        }


class RecordKey(db.Model):
    """Stores, per authorised user, that user's RSA-wrapped copy of a
    medical record's per-file symmetric (Fernet) key. One row is
    created for the uploader at upload time, and one more row is
    added for each user later granted access to that record.
    """

    __tablename__ = "record_keys"

    id = db.Column(db.Integer, primary_key=True)

    record_id = db.Column(
        db.Integer,
        nullable=False,
        index=True,
    )

    wallet_address = db.Column(
        db.String(42),
        nullable=False,
        index=True,
    )

    wrapped_key = db.Column(
        db.Text,
        nullable=False,
    )

    created_at = db.Column(
        db.DateTime,
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
    )

    __table_args__ = (
        db.UniqueConstraint(
            "record_id",
            "wallet_address",
            name="uq_record_wallet_key",
        ),
    )