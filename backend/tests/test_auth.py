"""
GhostRecon Backend API Tests
Tests for: Health check, Auth endpoints, Seed data
"""
import pytest
import requests
import json

class TestHealthAndSeed:
    """Health check and seed data tests"""
    
    def test_health_check(self, api_client, base_url):
        """Test GET /api/ - health check"""
        response = api_client.get(f"{base_url}/api/")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "operational"
        assert data["app"] == "GhostRecon"
        assert "version" in data
        print(f"✓ Health check passed: {data}")
    
    def test_seed_data(self, api_client, base_url):
        """Test POST /api/seed - seeds 6 demo users"""
        response = api_client.post(f"{base_url}/api/seed")
        assert response.status_code == 200
        data = response.json()
        # Either seeded successfully or already seeded
        assert data["status"] in ["seeded", "already_seeded"]
        if data["status"] == "seeded":
            assert data["users"] == 6
        print(f"✓ Seed data: {data}")


class TestAuthAnonymous:
    """Anonymous registration tests"""
    
    def test_register_anonymous_new_user(self, api_client, base_url):
        """Test POST /api/auth/register/anonymous - new user"""
        fingerprint = "TEST_anon_" + "a" * 24
        payload = {
            "device_fingerprint": fingerprint,
            "alias": "TEST_GhostAgent"
        }
        response = api_client.post(f"{base_url}/api/auth/register/anonymous", json=payload)
        assert response.status_code == 200
        
        data = response.json()
        assert "token" in data
        assert "user" in data
        assert data["user"]["alias"] == "TEST_GhostAgent"
        assert data["user"]["registration_type"] == "anonymous"
        assert data["user"]["device_fingerprint"] == fingerprint
        print(f"✓ Anonymous registration: {data['user']['alias']}")
        
        # Verify persistence with GET /api/auth/me
        token = data["token"]
        headers = {"Authorization": f"Bearer {token}"}
        me_response = api_client.get(f"{base_url}/api/auth/me", headers=headers)
        assert me_response.status_code == 200
        me_data = me_response.json()
        assert me_data["id"] == data["user"]["id"]
        print(f"✓ User persisted and retrievable via /auth/me")
    
    def test_register_anonymous_existing_fingerprint(self, api_client, base_url):
        """Test POST /api/auth/register/anonymous - existing fingerprint returns same user"""
        fingerprint = "TEST_anon_existing_fp"
        payload = {"device_fingerprint": fingerprint}
        
        # First registration
        response1 = api_client.post(f"{base_url}/api/auth/register/anonymous", json=payload)
        assert response1.status_code == 200
        user1 = response1.json()["user"]
        
        # Second registration with same fingerprint
        response2 = api_client.post(f"{base_url}/api/auth/register/anonymous", json=payload)
        assert response2.status_code == 200
        user2 = response2.json()["user"]
        
        assert user1["id"] == user2["id"]
        print(f"✓ Same fingerprint returns same user")


class TestAuthPseudonym:
    """Pseudonym registration tests"""
    
    def test_register_pseudonym_success(self, api_client, base_url):
        """Test POST /api/auth/register/pseudonym - new user"""
        payload = {
            "alias": "TEST_CipherZero",
            "email": "TEST_cipher@ghost.test",
            "password": "SecurePass123!"
        }
        response = api_client.post(f"{base_url}/api/auth/register/pseudonym", json=payload)
        assert response.status_code == 200
        
        data = response.json()
        assert "token" in data
        assert "user" in data
        assert data["user"]["alias"] == "TEST_CipherZero"
        assert data["user"]["registration_type"] == "pseudonym"
        assert data["user"]["email"] == "TEST_cipher@ghost.test"
        assert "password_hash" not in data["user"]
        print(f"✓ Pseudonym registration: {data['user']['alias']}")
    
    def test_register_pseudonym_duplicate_email(self, api_client, base_url):
        """Test POST /api/auth/register/pseudonym - duplicate email fails"""
        email = "TEST_duplicate@ghost.test"
        payload1 = {"alias": "TEST_User1", "email": email, "password": "pass123"}
        payload2 = {"alias": "TEST_User2", "email": email, "password": "pass456"}
        
        response1 = api_client.post(f"{base_url}/api/auth/register/pseudonym", json=payload1)
        assert response1.status_code == 200
        
        response2 = api_client.post(f"{base_url}/api/auth/register/pseudonym", json=payload2)
        assert response2.status_code == 400
        assert "already registered" in response2.json()["detail"].lower()
        print(f"✓ Duplicate email correctly rejected")


class TestAuthLogin:
    """Login tests"""
    
    def test_login_pseudonym_with_email(self, api_client, base_url):
        """Test POST /api/auth/login - pseudonym login with email"""
        # First register
        email = "TEST_login@ghost.test"
        password = "LoginPass123"
        reg_payload = {"alias": "TEST_LoginUser", "email": email, "password": password}
        reg_response = api_client.post(f"{base_url}/api/auth/register/pseudonym", json=reg_payload)
        assert reg_response.status_code == 200
        
        # Now login
        login_payload = {"identifier": email, "password": password}
        login_response = api_client.post(f"{base_url}/api/auth/login", json=login_payload)
        assert login_response.status_code == 200
        
        data = login_response.json()
        assert "token" in data
        assert data["user"]["email"] == email
        print(f"✓ Login successful with email")
    
    def test_login_anonymous_with_fingerprint(self, api_client, base_url):
        """Test POST /api/auth/login - anonymous login with fingerprint"""
        fingerprint = "TEST_login_fp_" + "b" * 20
        reg_payload = {"device_fingerprint": fingerprint}
        reg_response = api_client.post(f"{base_url}/api/auth/register/anonymous", json=reg_payload)
        assert reg_response.status_code == 200
        
        # Login without password
        login_payload = {"identifier": fingerprint}
        login_response = api_client.post(f"{base_url}/api/auth/login", json=login_payload)
        assert login_response.status_code == 200
        
        data = login_response.json()
        assert "token" in data
        print(f"✓ Anonymous login successful with fingerprint")
    
    def test_login_invalid_credentials(self, api_client, base_url):
        """Test POST /api/auth/login - invalid credentials"""
        login_payload = {"identifier": "nonexistent@ghost.test", "password": "wrongpass"}
        response = api_client.post(f"{base_url}/api/auth/login", json=login_payload)
        assert response.status_code == 401
        print(f"✓ Invalid credentials correctly rejected")


class TestAuthMe:
    """Get current user tests"""
    
    def test_get_me_with_valid_token(self, api_client, base_url):
        """Test GET /api/auth/me - returns current user"""
        # Register and get token
        fingerprint = "TEST_me_" + "c" * 24
        reg_payload = {"device_fingerprint": fingerprint, "alias": "TEST_MeUser"}
        reg_response = api_client.post(f"{base_url}/api/auth/register/anonymous", json=reg_payload)
        token = reg_response.json()["token"]
        
        # Get /me
        headers = {"Authorization": f"Bearer {token}"}
        response = api_client.get(f"{base_url}/api/auth/me", headers=headers)
        assert response.status_code == 200
        
        data = response.json()
        assert data["alias"] == "TEST_MeUser"
        assert "password_hash" not in data
        assert "_id" not in data
        print(f"✓ GET /auth/me successful")
    
    def test_get_me_without_token(self, api_client, base_url):
        """Test GET /api/auth/me - fails without token"""
        response = api_client.get(f"{base_url}/api/auth/me")
        assert response.status_code == 401
        print(f"✓ Unauthorized access correctly rejected")
