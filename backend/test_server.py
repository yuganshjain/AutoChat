import pytest
from fastapi.testclient import TestClient
from datetime import datetime, timedelta
from server import app

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

def test_root():
    response = client.get("/api")
    assert response.status_code == 200
    assert response.json() == {"message": "Coworking Platform API"}

def test_register_user():
    response = client.post("/api/auth/register", json=test_user)
    assert response.status_code == 200
    data = response.json()
    assert data["email"] == test_user["email"]
    assert data["name"] == test_user["name"]
    assert "id" in data

def test_login():
    # Login with the registered user
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

def test_get_me():
    token = test_login()
    headers = {"Authorization": f"Bearer {token}"}
    response = client.get("/api/auth/me", headers=headers)
    assert response.status_code == 200
    data = response.json()
    assert data["email"] == test_user["email"]

def test_create_session():
    token = test_login()
    headers = {"Authorization": f"Bearer {token}"}
    response = client.post("/api/sessions", json=test_session, headers=headers)
    assert response.status_code == 200
    data = response.json()
    assert data["title"] == test_session["title"]
    assert data["description"] == test_session["description"]
    return data["id"]

def test_get_sessions():
    token = test_login()
    headers = {"Authorization": f"Bearer {token}"}
    response = client.get("/api/sessions", headers=headers)
    assert response.status_code == 200
    data = response.json()
    assert isinstance(data, list)
    assert len(data) > 0

def test_get_available_sessions():
    token = test_login()
    headers = {"Authorization": f"Bearer {token}"}
    response = client.get("/api/sessions/available", headers=headers)
    assert response.status_code == 200
    data = response.json()
    assert isinstance(data, list)

def test_join_session():
    # Create a second user to join the session
    second_user = {**test_user, "email": "test2@example.com"}
    client.post("/api/auth/register", json=second_user)
    token = client.post(
        "/api/auth/token",
        data={
            "username": second_user["email"],
            "password": second_user["password"]
        }
    ).json()["access_token"]

    # Get session ID from previous test
    session_id = test_create_session()

    # Join session with second user
    headers = {"Authorization": f"Bearer {token}"}
    response = client.post(f"/api/sessions/{session_id}/join", headers=headers)
    assert response.status_code == 200
    data = response.json()
    assert data["partner_id"] is not None

def test_submit_feedback():
    token = test_login()
    session_id = test_create_session()
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
