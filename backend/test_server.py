import pytest
import asyncio
from fastapi.testclient import TestClient
from datetime import datetime, timedelta
from server import app
import pytest_asyncio

client = TestClient(app)

# Test data
test_user = {
    "name": "Test User",
    "email": "test@example.com",
    "password": "testpass123",
    "timezone": "UTC"
}

test_session = {
    "title": "Test Session",
    "description": "Test coworking session",
    "start_time": (datetime.utcnow() + timedelta(hours=1)).isoformat(),
    "end_time": (datetime.utcnow() + timedelta(hours=2)).isoformat()
}

@pytest.fixture(scope="session")
def event_loop():
    loop = asyncio.get_event_loop_policy().new_event_loop()
    yield loop
    loop.close()

@pytest.mark.asyncio
async def test_root():
    response = client.get("/api")
    assert response.status_code == 200
    assert response.json() == {"message": "Coworking Platform API"}

@pytest.mark.asyncio
async def test_register_user():
    response = client.post("/api/auth/register", json=test_user)
    assert response.status_code == 200
    data = response.json()
    assert data["email"] == test_user["email"]
    assert data["name"] == test_user["name"]
    assert "id" in data

@pytest.mark.asyncio
async def test_login():
    response = client.post(
        "/api/auth/token",
        data={
            "username": test_user["email"],
            "password": test_user["password"]
        }
    )
    assert response.status_code == 200
    data = response.json()
    assert "access_token" in data
    assert data["email"] == test_user["email"]
    return data["access_token"]

@pytest.mark.asyncio
async def test_get_me():
    token = await test_login()
    headers = {"Authorization": f"Bearer {token}"}
    response = client.get("/api/auth/me", headers=headers)
    assert response.status_code == 200
    data = response.json()
    assert data["email"] == test_user["email"]

@pytest.mark.asyncio
async def test_create_session():
    token = await test_login()
    headers = {"Authorization": f"Bearer {token}"}
    response = client.post("/api/sessions", json=test_session, headers=headers)
    assert response.status_code == 200
    data = response.json()
    assert data["title"] == test_session["title"]
    assert data["description"] == test_session["description"]
    return data["id"]

@pytest.mark.asyncio
async def test_get_sessions():
    token = await test_login()
    headers = {"Authorization": f"Bearer {token}"}
    response = client.get("/api/sessions", headers=headers)
    assert response.status_code == 200
    data = response.json()
    assert isinstance(data, list)

@pytest.mark.asyncio
async def test_get_available_sessions():
    token = await test_login()
    headers = {"Authorization": f"Bearer {token}"}
    response = client.get("/api/sessions/available", headers=headers)
    assert response.status_code == 200
    data = response.json()
    assert isinstance(data, list)

@pytest.mark.asyncio
async def test_join_session():
    # Create a second user to join the session
    second_user = {**test_user, "email": "test2@example.com"}
    client.post("/api/auth/register", json=second_user)
    token_response = client.post(
        "/api/auth/token",
        data={
            "username": second_user["email"],
            "password": second_user["password"]
        }
    )
    token = token_response.json()["access_token"]

    # Get session ID from previous test
    session_id = await test_create_session()

    # Join session with second user
    headers = {"Authorization": f"Bearer {token}"}
    response = client.post(f"/api/sessions/{session_id}/join", headers=headers)
    assert response.status_code == 200
    data = response.json()
    assert data["partner_id"] is not None

@pytest.mark.asyncio
async def test_submit_feedback():
    token = await test_login()
    session_id = await test_create_session()
    headers = {"Authorization": f"Bearer {token}"}
    feedback = {
        "rating": 5,
        "comment": "Great session!"
    }
    response = client.post(f"/api/sessions/{session_id}/feedback", json=feedback, headers=headers)
    assert response.status_code == 200
    data = response.json()
    assert "feedback" in data
    assert data["feedback"]["host"]["rating"] == 5

if __name__ == "__main__":
    pytest.main(["-v", "test_server.py"])
