"""Database-neutral SQLAlchemy column types."""
from sqlalchemy import JSON, Uuid

UUID_PK = Uuid(as_uuid=True)
JSON_DATA = JSON
