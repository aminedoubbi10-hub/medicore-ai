"""
tests/test_auth.py — Authentication endpoint tests.
"""
import pytest
from httpx import AsyncClient, ASGITransport
from app.main import app
from app.utils.security import hash_password


@pytest.mark.asyncio
async def test_health_check():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        response = await client.get("/health")
    assert response.status_code == 200
    assert response.json()["status"] == "healthy"


@pytest.mark.asyncio
async def test_login_invalid_credentials():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        response = await client.post("/api/v1/auth/login", json={
            "email": "notexist@test.com",
            "password": "wrongpassword"
        })
    assert response.status_code == 401


@pytest.mark.asyncio
async def test_register_invalid_role():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        response = await client.post("/api/v1/auth/register", json={
            "email": "test@test.com",
            "password": "SecurePass1!",
            "full_name": "Dr. Test",
            "role": "invalid_role",
        })
    assert response.status_code == 422


@pytest.mark.asyncio
async def test_register_short_password():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        response = await client.post("/api/v1/auth/register", json={
            "email": "test2@test.com",
            "password": "short",
            "full_name": "Dr. Test",
            "role": "doctor",
        })
    assert response.status_code == 422


def test_password_hashing():
    """Test bcrypt hashing is one-way and verifiable."""
    from app.utils.security import verify_password
    pwd = "SecurePassword123!"
    hashed = hash_password(pwd)
    assert hashed != pwd
    assert verify_password(pwd, hashed)
    assert not verify_password("wrongpassword", hashed)


def test_jwt_creation_and_decoding():
    """Test JWT tokens are created and decoded correctly."""
    from app.utils.security import create_access_token, decode_token
    import uuid
    user_id = str(uuid.uuid4())
    token = create_access_token(user_id, "doctor")
    payload = decode_token(token)
    assert payload["sub"] == user_id
    assert payload["role"] == "doctor"
    assert payload["type"] == "access"
