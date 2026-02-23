"""
GhostRecon Backend API Tests
Tests for: Contacts, Conversations, Messages
"""
import pytest
import requests

@pytest.fixture(scope="module")
def auth_token(api_client, base_url):
    """Create a test user and return auth token"""
    fingerprint = "TEST_main_user_fp_" + "x" * 16
    payload = {"device_fingerprint": fingerprint, "alias": "TEST_MainUser"}
    response = api_client.post(f"{base_url}/api/auth/register/anonymous", json=payload)
    return response.json()["token"]

@pytest.fixture(scope="module")
def auth_headers(auth_token):
    """Headers with auth token"""
    return {"Authorization": f"Bearer {auth_token}"}

@pytest.fixture(scope="module")
def second_user(api_client, base_url):
    """Create a second test user for contacts/conversations"""
    fingerprint = "TEST_second_user_fp_" + "y" * 16
    payload = {"device_fingerprint": fingerprint, "alias": "TEST_SecondUser"}
    response = api_client.post(f"{base_url}/api/auth/register/anonymous", json=payload)
    return response.json()["user"]


class TestContacts:
    """Contacts endpoint tests"""
    
    def test_add_contact(self, api_client, base_url, auth_headers, second_user):
        """Test POST /api/contacts - add contact"""
        payload = {
            "target_user_id": second_user["id"],
            "trust_level": 3
        }
        response = api_client.post(f"{base_url}/api/contacts", json=payload, headers=auth_headers)
        assert response.status_code == 200
        
        data = response.json()
        assert data["contact_id"] == second_user["id"]
        assert data["contact_alias"] == second_user["alias"]
        assert data["trust_level"] == 3
        print(f"✓ Contact added: {data['contact_alias']}")
        
        # Verify persistence
        get_response = api_client.get(f"{base_url}/api/contacts", headers=auth_headers)
        assert get_response.status_code == 200
        contacts = get_response.json()
        assert any(c["contact_id"] == second_user["id"] for c in contacts)
        print(f"✓ Contact persisted in list")
    
    def test_get_contacts(self, api_client, base_url, auth_headers):
        """Test GET /api/contacts - list contacts"""
        response = api_client.get(f"{base_url}/api/contacts", headers=auth_headers)
        assert response.status_code == 200
        
        data = response.json()
        assert isinstance(data, list)
        if len(data) > 0:
            contact = data[0]
            assert "contact_id" in contact
            assert "contact_alias" in contact
            assert "trust_level" in contact
            assert "contact_info" in contact
        print(f"✓ Contacts list retrieved: {len(data)} contacts")
    
    def test_add_duplicate_contact(self, api_client, base_url, auth_headers, second_user):
        """Test POST /api/contacts - duplicate contact fails"""
        payload = {"target_user_id": second_user["id"], "trust_level": 2}
        
        # Try to add same contact again
        response = api_client.post(f"{base_url}/api/contacts", json=payload, headers=auth_headers)
        assert response.status_code == 400
        assert "already exists" in response.json()["detail"].lower()
        print(f"✓ Duplicate contact correctly rejected")


class TestConversations:
    """Conversations endpoint tests"""
    
    def test_create_conversation(self, api_client, base_url, auth_headers, second_user):
        """Test POST /api/conversations - create conversation"""
        payload = {
            "participant_ids": [second_user["id"]],
            "is_group": False
        }
        response = api_client.post(f"{base_url}/api/conversations", json=payload, headers=auth_headers)
        assert response.status_code == 200
        
        data = response.json()
        assert "id" in data
        assert second_user["id"] in data["participants"]
        assert data["is_group"] == False
        assert data["encryption_protocol"] == "AES-256-GCM + X25519"
        print(f"✓ Conversation created: {data['id']}")
        
        # Verify persistence
        get_response = api_client.get(f"{base_url}/api/conversations", headers=auth_headers)
        assert get_response.status_code == 200
        convs = get_response.json()
        assert any(c["id"] == data["id"] for c in convs)
        print(f"✓ Conversation persisted")
        
        return data["id"]
    
    def test_get_conversations(self, api_client, base_url, auth_headers):
        """Test GET /api/conversations - list conversations"""
        response = api_client.get(f"{base_url}/api/conversations", headers=auth_headers)
        assert response.status_code == 200
        
        data = response.json()
        assert isinstance(data, list)
        if len(data) > 0:
            conv = data[0]
            assert "id" in conv
            assert "participants" in conv
            assert "participant_info" in conv
            assert "unread_count" in conv
        print(f"✓ Conversations list retrieved: {len(data)} conversations")
    
    def test_create_duplicate_dm_returns_existing(self, api_client, base_url, auth_headers, second_user):
        """Test POST /api/conversations - duplicate DM returns existing"""
        payload = {
            "participant_ids": [second_user["id"]],
            "is_group": False
        }
        
        # Create first
        response1 = api_client.post(f"{base_url}/api/conversations", json=payload, headers=auth_headers)
        conv1_id = response1.json()["id"]
        
        # Create again with same participant
        response2 = api_client.post(f"{base_url}/api/conversations", json=payload, headers=auth_headers)
        conv2_id = response2.json()["id"]
        
        assert conv1_id == conv2_id
        print(f"✓ Duplicate DM returns existing conversation")


class TestMessages:
    """Messages endpoint tests"""
    
    @pytest.fixture(scope="class")
    def conversation_id(self, api_client, base_url, auth_headers, second_user):
        """Create a conversation for message tests"""
        payload = {
            "participant_ids": [second_user["id"]],
            "is_group": False
        }
        response = api_client.post(f"{base_url}/api/conversations", json=payload, headers=auth_headers)
        return response.json()["id"]
    
    def test_send_message(self, api_client, base_url, auth_headers, conversation_id):
        """Test POST /api/messages - send message"""
        payload = {
            "conversation_id": conversation_id,
            "content": "TEST: Ghost protocol activated",
            "self_destruct_seconds": 300,
            "forward_protected": True
        }
        response = api_client.post(f"{base_url}/api/messages", json=payload, headers=auth_headers)
        assert response.status_code == 200
        
        data = response.json()
        assert data["conversation_id"] == conversation_id
        assert data["content"] == "TEST: Ghost protocol activated"
        assert data["encrypted"] == True
        assert data["self_destruct_seconds"] == 300
        assert data["forward_protected"] == True
        assert "expires_at" in data
        print(f"✓ Message sent: {data['id']}")
        
        # Verify persistence
        get_response = api_client.get(f"{base_url}/api/messages/{conversation_id}", headers=auth_headers)
        assert get_response.status_code == 200
        messages = get_response.json()
        assert any(m["id"] == data["id"] for m in messages)
        print(f"✓ Message persisted")
        
        return data["id"]
    
    def test_get_messages(self, api_client, base_url, auth_headers, conversation_id):
        """Test GET /api/messages/{conv_id} - get messages"""
        response = api_client.get(f"{base_url}/api/messages/{conversation_id}", headers=auth_headers)
        assert response.status_code == 200
        
        data = response.json()
        assert isinstance(data, list)
        if len(data) > 0:
            msg = data[0]
            assert "id" in msg
            assert "content" in msg
            assert "sender_id" in msg
            assert "encrypted" in msg
            assert msg["recalled"] == False
        print(f"✓ Messages retrieved: {len(data)} messages")
    
    def test_recall_message(self, api_client, base_url, auth_headers, conversation_id):
        """Test DELETE /api/messages/{msg_id} - recall message"""
        # First send a message
        send_payload = {
            "conversation_id": conversation_id,
            "content": "TEST: Message to be recalled"
        }
        send_response = api_client.post(f"{base_url}/api/messages", json=send_payload, headers=auth_headers)
        message_id = send_response.json()["id"]
        
        # Now recall it
        response = api_client.delete(f"{base_url}/api/messages/{message_id}", headers=auth_headers)
        assert response.status_code == 200
        assert response.json()["status"] == "recalled"
        print(f"✓ Message recalled successfully")
        
        # Verify message is recalled
        get_response = api_client.get(f"{base_url}/api/messages/{conversation_id}", headers=auth_headers)
        messages = get_response.json()
        # Recalled messages should be filtered out
        assert not any(m["id"] == message_id and m["recalled"] == False for m in messages)
        print(f"✓ Recalled message not in active messages")
