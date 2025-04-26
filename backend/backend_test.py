import pytest
import requests
from datetime import datetime, timedelta
import uuid

# Get backend URL from environment variable
BACKEND_URL = "https://coworking-backend-3c2f.onrender.com/api"

class TestCoworkingAPI:
    def __init__(self):
        self.user_token = None
        self.user_id = None
        self.test_session_id = None

    def test_register(self):
        """Test user registration"""
        test_user = {
            "name": f"Test User {uuid.uuid4().hex[:8]}",
            "email": f"test_{uuid.uuid4().hex[:8]}@test.com",
            "password": "TestPass123!",
            "timezone": "UTC"
        }
        
        response = requests.post(f"{BACKEND_URL}/auth/register", json=test_user)
        assert response.status_code == 200, "Registration failed"
        print("✅ Registration test passed")
        return test_user

    def test_login(self, credentials):
        """Test user login"""
        login_data = {
            "username": credentials["email"],
            "password": credentials["password"]
        }
        
        response = requests.post(
            f"{BACKEND_URL}/auth/token",
            data=login_data,
            headers={"Content-Type": "application/x-www-form-urlencoded"}
        )
        assert response.status_code == 200, "Login failed"
        data = response.json()
        self.user_token = data["access_token"]
        self.user_id = data["user_id"]
        print("✅ Login test passed")

    def test_create_session(self):
        """Test creating a coworking session"""
        headers = {"Authorization": f"Bearer {self.user_token}"}
        start_time = datetime.utcnow() + timedelta(hours=1)
        end_time = start_time + timedelta(hours=1)
        
        session_data = {
            "title": "Test Coworking Session",
            "description": "Test session for API verification",
            "start_time": start_time.isoformat(),
            "end_time": end_time.isoformat()
        }
        
        response = requests.post(f"{BACKEND_URL}/sessions", json=session_data, headers=headers)
        assert response.status_code == 200, "Session creation failed"
        self.test_session_id = response.json()["id"]
        print("✅ Session creation test passed")

    def test_get_sessions(self):
        """Test retrieving user sessions"""
        headers = {"Authorization": f"Bearer {self.user_token}"}
        response = requests.get(f"{BACKEND_URL}/sessions", headers=headers)
        assert response.status_code == 200, "Failed to get sessions"
        sessions = response.json()
        assert len(sessions) > 0, "No sessions found"
        print("✅ Get sessions test passed")

    def test_get_available_sessions(self):
        """Test retrieving available sessions"""
        headers = {"Authorization": f"Bearer {self.user_token}"}
        response = requests.get(f"{BACKEND_URL}/sessions/available", headers=headers)
        assert response.status_code == 200, "Failed to get available sessions"
        print("✅ Get available sessions test passed")

    def test_get_session_details(self):
        """Test getting specific session details"""
        headers = {"Authorization": f"Bearer {self.user_token}"}
        response = requests.get(f"{BACKEND_URL}/sessions/{self.test_session_id}", headers=headers)
        assert response.status_code == 200, "Failed to get session details"
        session = response.json()
        assert session["id"] == self.test_session_id
        print("✅ Get session details test passed")

def run_tests():
    try:
        tester = TestCoworkingAPI()
        
        # Run the test sequence
        test_user = tester.test_register()
        tester.test_login(test_user)
        tester.test_create_session()
        tester.test_get_sessions()
        tester.test_get_available_sessions()
        tester.test_get_session_details()
        
        print("\n🎉 All backend tests passed successfully!")
        
    except AssertionError as e:
        print(f"\n❌ Test failed: {str(e)}")
    except Exception as e:
        print(f"\n❌ Unexpected error: {str(e)}")

if __name__ == "__main__":
    run_tests()