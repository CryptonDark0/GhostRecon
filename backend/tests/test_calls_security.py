"""
GhostRecon Backend API Tests
Tests for: Calls, Security settings, Key rotation, Panic wipe
"""
import pytest
import requests

@pytest.fixture(scope="module")
def auth_token(api_client, base_url):
    """Create a test user and return auth token"""
    fingerprint = "TEST_calls_user_fp_" + "z" * 16
    payload = {"device_fingerprint": fingerprint, "alias": "TEST_CallsUser"}
    response = api_client.post(f"{base_url}/api/auth/register/anonymous", json=payload)
    return response.json()["token"]

@pytest.fixture(scope="module")
def auth_headers(auth_token):
    """Headers with auth token"""
    return {"Authorization": f"Bearer {auth_token}"}

@pytest.fixture(scope="module")
def target_user(api_client, base_url):
    """Create a target user for calls"""
    fingerprint = "TEST_call_target_fp_" + "w" * 16
    payload = {"device_fingerprint": fingerprint, "alias": "TEST_TargetUser"}
    response = api_client.post(f"{base_url}/api/auth/register/anonymous", json=payload)
    return response.json()["user"]


class TestCalls:
    """Calls endpoint tests"""
    
    def test_initiate_voice_call(self, api_client, base_url, auth_headers, target_user):
        """Test POST /api/calls - initiate voice call"""
        payload = {
            "target_user_id": target_user["id"],
            "call_type": "voice"
        }
        response = api_client.post(f"{base_url}/api/calls", json=payload, headers=auth_headers)
        assert response.status_code == 200
        
        data = response.json()
        assert data["receiver_id"] == target_user["id"]
        assert data["call_type"] == "voice"
        assert data["status"] == "initiated"
        assert data["encryption"] == "SRTP + ZRTP"
        assert "started_at" in data
        print(f"✓ Voice call initiated: {data['id']}")
        
        return data["id"]
    
    def test_initiate_video_call(self, api_client, base_url, auth_headers, target_user):
        """Test POST /api/calls - initiate video call"""
        payload = {
            "target_user_id": target_user["id"],
            "call_type": "video"
        }
        response = api_client.post(f"{base_url}/api/calls", json=payload, headers=auth_headers)
        assert response.status_code == 200
        
        data = response.json()
        assert data["call_type"] == "video"
        assert data["status"] == "initiated"
        print(f"✓ Video call initiated: {data['id']}")
    
    def test_get_call_history(self, api_client, base_url, auth_headers):
        """Test GET /api/calls - get call history"""
        response = api_client.get(f"{base_url}/api/calls", headers=auth_headers)
        assert response.status_code == 200
        
        data = response.json()
        assert isinstance(data, list)
        if len(data) > 0:
            call = data[0]
            assert "id" in call
            assert "caller_id" in call
            assert "receiver_id" in call
            assert "call_type" in call
            assert "status" in call
            assert "encryption" in call
        print(f"✓ Call history retrieved: {len(data)} calls")
    
    def test_end_call(self, api_client, base_url, auth_headers, target_user):
        """Test PUT /api/calls/{call_id}/end - end call"""
        # First initiate a call
        payload = {"target_user_id": target_user["id"], "call_type": "voice"}
        init_response = api_client.post(f"{base_url}/api/calls", json=payload, headers=auth_headers)
        call_id = init_response.json()["id"]
        
        # End the call
        response = api_client.put(f"{base_url}/api/calls/{call_id}/end", headers=auth_headers)
        assert response.status_code == 200
        
        data = response.json()
        assert data["status"] == "ended"
        assert "duration_seconds" in data
        print(f"✓ Call ended successfully, duration: {data['duration_seconds']}s")


class TestSecuritySettings:
    """Security settings endpoint tests"""
    
    def test_get_security_settings(self, api_client, base_url, auth_headers):
        """Test GET /api/security/settings - get security settings"""
        response = api_client.get(f"{base_url}/api/security/settings", headers=auth_headers)
        assert response.status_code == 200
        
        data = response.json()
        assert "screenshot_protection" in data
        assert "read_receipts" in data
        assert "typing_indicators" in data
        assert "link_previews" in data
        print(f"✓ Security settings retrieved: {data}")
    
    def test_update_security_settings(self, api_client, base_url, auth_headers):
        """Test PUT /api/security/settings - update security settings"""
        payload = {
            "screenshot_protection": True,
            "read_receipts": True,
            "typing_indicators": False,
            "link_previews": False,
            "auto_delete_days": 7
        }
        response = api_client.put(f"{base_url}/api/security/settings", json=payload, headers=auth_headers)
        assert response.status_code == 200
        
        data = response.json()
        assert data["status"] == "updated"
        assert data["settings"]["read_receipts"] == True
        print(f"✓ Security settings updated")
        
        # Verify persistence
        get_response = api_client.get(f"{base_url}/api/security/settings", headers=auth_headers)
        settings = get_response.json()
        assert settings["read_receipts"] == True
        assert settings["auto_delete_days"] == 7
        print(f"✓ Settings persisted correctly")


class TestKeyRotation:
    """Encryption key rotation tests"""
    
    def test_rotate_keys(self, api_client, base_url, auth_headers):
        """Test POST /api/security/rotate-keys - rotate encryption keys"""
        # Get current key hash
        me_response = api_client.get(f"{base_url}/api/auth/me", headers=auth_headers)
        old_key_hash = me_response.json()["encryption_key_hash"]
        
        # Rotate keys
        response = api_client.post(f"{base_url}/api/security/rotate-keys", headers=auth_headers)
        assert response.status_code == 200
        
        data = response.json()
        assert data["status"] == "keys_rotated"
        assert "new_key_hash" in data
        new_key_hash = data["new_key_hash"]
        
        # Verify new key is different
        assert new_key_hash != old_key_hash
        print(f"✓ Keys rotated: {old_key_hash[:16]}... -> {new_key_hash[:16]}...")
        
        # Verify persistence
        me_response2 = api_client.get(f"{base_url}/api/auth/me", headers=auth_headers)
        assert me_response2.json()["encryption_key_hash"] == new_key_hash
        print(f"✓ New key persisted")


class TestPanicWipe:
    """Panic wipe endpoint tests"""
    
    def test_panic_wipe_invalid_code(self, api_client, base_url):
        """Test POST /api/security/panic-wipe - invalid confirmation code"""
        # Create a new user for this test
        fingerprint = "TEST_panic_invalid_" + "p" * 16
        reg_payload = {"device_fingerprint": fingerprint, "alias": "TEST_PanicUser"}
        reg_response = api_client.post(f"{base_url}/api/auth/register/anonymous", json=reg_payload)
        token = reg_response.json()["token"]
        headers = {"Authorization": f"Bearer {token}"}
        
        # Try with invalid code
        payload = {"confirm_code": "WRONG-CODE"}
        response = api_client.post(f"{base_url}/api/security/panic-wipe", json=payload, headers=headers)
        assert response.status_code == 400
        assert "invalid" in response.json()["detail"].lower()
        print(f"✓ Invalid panic code rejected")
    
    def test_panic_wipe_success(self, api_client, base_url):
        """Test POST /api/security/panic-wipe - successful wipe"""
        # Create a new user with data to wipe
        fingerprint = "TEST_panic_success_" + "q" * 16
        reg_payload = {"device_fingerprint": fingerprint, "alias": "TEST_WipeUser"}
        reg_response = api_client.post(f"{base_url}/api/auth/register/anonymous", json=reg_payload)
        token = reg_response.json()["token"]
        user_id = reg_response.json()["user"]["id"]
        headers = {"Authorization": f"Bearer {token}"}
        
        # Create some data (contact, conversation, message)
        # First need another user
        target_fp = "TEST_wipe_target_" + "r" * 16
        target_payload = {"device_fingerprint": target_fp, "alias": "TEST_WipeTarget"}
        target_response = api_client.post(f"{base_url}/api/auth/register/anonymous", json=target_payload)
        target_id = target_response.json()["user"]["id"]
        
        # Add contact
        api_client.post(f"{base_url}/api/contacts", json={"target_user_id": target_id, "trust_level": 2}, headers=headers)
        
        # Create conversation
        conv_response = api_client.post(f"{base_url}/api/conversations", json={"participant_ids": [target_id]}, headers=headers)
        conv_id = conv_response.json()["id"]
        
        # Send message
        api_client.post(f"{base_url}/api/messages", json={"conversation_id": conv_id, "content": "TEST: to be wiped"}, headers=headers)
        
        # Initiate call
        api_client.post(f"{base_url}/api/calls", json={"target_user_id": target_id, "call_type": "voice"}, headers=headers)
        
        # Verify data exists
        contacts = api_client.get(f"{base_url}/api/contacts", headers=headers).json()
        assert len(contacts) > 0
        
        # Now panic wipe
        wipe_payload = {"confirm_code": "WIPE-CONFIRM"}
        response = api_client.post(f"{base_url}/api/security/panic-wipe", json=wipe_payload, headers=headers)
        assert response.status_code == 200
        
        data = response.json()
        assert data["status"] == "wiped"
        print(f"✓ Panic wipe successful")
        
        # Verify data is wiped
        contacts_after = api_client.get(f"{base_url}/api/contacts", headers=headers).json()
        assert len(contacts_after) == 0
        
        convs_after = api_client.get(f"{base_url}/api/conversations", headers=headers).json()
        # User's created conversations should be deleted
        assert not any(c["id"] == conv_id for c in convs_after)
        
        calls_after = api_client.get(f"{base_url}/api/calls", headers=headers).json()
        # Calls should be deleted
        assert len([c for c in calls_after if c["caller_id"] == user_id]) == 0
        
        print(f"✓ All data wiped: contacts={len(contacts_after)}, conversations deleted")


class TestSessionInfo:
    """Security session info tests"""
    
    def test_get_session_info(self, api_client, base_url, auth_headers):
        """Test GET /api/security/session-info - get session info"""
        response = api_client.get(f"{base_url}/api/security/session-info", headers=auth_headers)
        assert response.status_code == 200
        
        data = response.json()
        assert "user_id" in data
        assert "alias" in data
        assert "encryption_key_hash" in data
        assert "registration_type" in data
        assert "key_rotation_available" in data
        assert "active_conversations" in data
        assert "total_contacts" in data
        print(f"✓ Session info retrieved: {data['alias']}, {data['active_conversations']} conversations")
