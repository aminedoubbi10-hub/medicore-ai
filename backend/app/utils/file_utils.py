"""app/utils/file_utils.py — File validation and naming."""
import uuid
import os
from pathlib import Path
from fastapi import UploadFile, HTTPException


ALLOWED_EXTENSIONS = {
    "png", "jpg", "jpeg", "pdf",
    "dcm", "edf", "xml", "hl7", "zip",
}


async def validate_file(
    file: UploadFile,
    allowed_extensions: list[str] | None = None,
    max_size_mb: int = 100,
) -> None:
    """Validate file extension and size. Raises HTTPException on failure."""
    extensions = allowed_extensions or list(ALLOWED_EXTENSIONS)

    if file.filename:
        ext = file.filename.rsplit(".", 1)[-1].lower()
        if ext not in extensions:
            raise HTTPException(
                status_code=400,
                detail=f"File type '.{ext}' not allowed. Accepted: {', '.join(extensions)}",
            )

    # Read and check size
    content = await file.read()
    size_mb = len(content) / (1024 * 1024)
    if size_mb > max_size_mb:
        raise HTTPException(
            status_code=413,
            detail=f"File too large ({size_mb:.1f} MB). Maximum: {max_size_mb} MB",
        )

    # Seek back so downstream can read the content
    await file.seek(0)


def generate_unique_filename(original: str | None) -> str:
    """Generate a UUID-based filename preserving the original extension."""
    if not original:
        return f"{uuid.uuid4()}.bin"
    ext = original.rsplit(".", 1)[-1].lower() if "." in original else "bin"
    return f"{uuid.uuid4()}.{ext}"


def ensure_upload_dir(path: str) -> Path:
    """Create the upload directory if it doesn't exist."""
    p = Path(path)
    p.mkdir(parents=True, exist_ok=True)
    return p
