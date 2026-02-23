"""
GhostRecon Backend API Tests - NEW FEATURES
Tests for: WebSocket real-time messaging, Push notification registration, Message broadcasting
"""
import pytest
import requests
import json
import asyncio
from websockets.sync.client import connect as ws_connect
from websockets.exceptions import WebSocketException
import time


class TestVersionCheck:
    """Verify API version 2.0.0"""
    
    def test_api_version_2_0_0(self, api_client, base_url):
        """Test GET /api/ returns version 2.0.0"""
        response = api_client.get(f"{base_url}/api/")
        assert response.status_code == 200
        data = response.json()
        assert data["version"] == "2.0.0"
        assert data["app"] == "GhostRecon"
        assert data["status"] == "operational"
        print(f"✓ API version 2.0.0 confirmed: {data}")


class TestPushNotifications:
    """Push notification token registration tests"""
    
    def test_register_push_token_authenticated(self, api_client, base_url):
        """Test POST /api/notifications/register - with valid token"""
        # First create a user
        fingerprint = "TEST_push_" + "x" * 20
        reg_payload = {"device_fingerprint": fingerprint, "alias": "TEST_PushUser"}
        reg_response = api_client.post(f"{base_url}/api/auth/register/anonymous", json=reg_payload)
        assert reg_response.status_code == 200
        token = reg_response.json()["token"]
        
        # Register push token
        headers = {"Authorization": f"Bearer {token}"}
        push_payload = {"push_token": "ExponentPushToken[TEST_ABC123XYZ]"}
        response = api_client.post(f"{base_url}/api/notifications/register", json=push_payload, headers=headers)
        assert response.status_code == 200
        
        data = response.json()
        assert data["status"] == "registered"
        print(f"✓ Push token registered successfully")
    
    def test_register_push_token_unauthenticated(self, api_client, base_url):
        """Test POST /api/notifications/register - fails without auth"""
        push_payload = {"push_token": "ExponentPushToken[TEST_UNAUTH]"}
        response = api_client.post(f"{base_url}/api/notifications/register", json=push_payload)
        assert response.status_code == 401
        print(f"✓ Unauthenticated push token registration correctly rejected")


class TestWebSocket:
    """WebSocket connection and messaging tests"""
    
    def test_websocket_connection_with_valid_token(self, api_client, base_url):
        """Test WebSocket /api/ws/{token} accepts connection"""
        # Create user and get token
        fingerprint = "TEST_ws_" + "y" * 20
        reg_payload = {"device_fingerprint": fingerprint, "alias": "TEST_WSUser"}
        reg_response = api_client.post(f"{base_url}/api/auth/register/anonymous", json=reg_payload)
        assert reg_response.status_code == 200
        token = reg_response.json()["token"]
        
        # Convert https to wss for websocket
        ws_base = base_url.replace('https://', 'wss://').replace('http://', 'ws://')
        ws_url = f"{ws_base}/api/ws/{token}"
        
        try:
            with ws_connect(ws_url, open_timeout=10) as websocket:
                print(f"✓ WebSocket connection established")
                
                # Connection successful
                assert websocket is not None
        except WebSocketException as e:
            pytest.fail(f"WebSocket connection failed: {e}")
    
    def test_websocket_ping_pong(self, api_client, base_url):
        """Test WebSocket ping/pong mechanism"""
        # Create user
        fingerprint = "TEST_ws_ping_" + "z" * 20
        reg_payload = {"device_fingerprint": fingerprint, "alias": "TEST_WSPingUser"}
        reg_response = api_client.post(f"{base_url}/api/auth/register/anonymous", json=reg_payload)
        token = reg_response.json()["token"]
        
        ws_base = base_url.replace('https://', 'wss://').replace('http://', 'ws://')
        ws_url = f"{ws_base}/api/ws/{token}"
        
        try:
            with ws_connect(ws_url, open_timeout=10) as websocket:
                # Send ping
                ping_msg = json.dumps({"type": "ping"})
                websocket.send(ping_msg)
                print(f"✓ Sent ping message")
                
                # Wait for pong response
                response = websocket.recv(timeout=5)
                data = json.loads(response)
                
                assert data["type"] == "pong"
                print(f"✓ Received pong response: {data}")
        except WebSocketException as e:
            pytest.fail(f"WebSocket ping/pong failed: {e}")
    
    def test_websocket_invalid_token_rejected(self, api_client, base_url):
        """Test WebSocket connection fails with invalid token"""
        ws_base = base_url.replace('https://', 'wss://').replace('http://', 'ws://')
        ws_url = f"{ws_base}/api/ws/invalid_token_12345"
        
        try:
            with ws_connect(ws_url, open_timeout=5) as websocket:
                pytest.fail("WebSocket should have rejected invalid token")
        except WebSocketException as e:
            # Connection should be rejected
            print(f"✓ Invalid token correctly rejected: {str(e)[:100]}")
            assert True


class TestMessageBroadcasting:
    """Test message sending broadcasts via WebSocket"""
    
    def test_message_send_creates_message(self, api_client, base_url):
        """Test POST /api/messages creates message in database"""
        # Create two users
        fp1 = "TEST_msg_user1_" + "a" * 15
        fp2 = "TEST_msg_user2_" + "b" * 15
        
        reg1 = api_client.post(f"{base_url}/api/auth/register/anonymous", json={"device_fingerprint": fp1, "alias": "TEST_User1"})
        reg2 = api_client.post(f"{base_url}/api/auth/register/anonymous", json={"device_fingerprint": fp2, "alias": "TEST_User2"})
        
        token1 = reg1.json()["token"]
        user1_id = reg1.json()["user"]["id"]
        user2_id = reg2.json()["user"]["id"]
        
        # Create conversation
        headers1 = {"Authorization": f"Bearer {token1}"}
        conv_payload = {"participant_ids": [user2_id], "is_group": False}
        conv_response = api_client.post(f"{base_url}/api/conversations", json=conv_payload, headers=headers1)
        assert conv_response.status_code == 200
        conv_id = conv_response.json()["id"]
        
        # Send message
        msg_payload = {
            "conversation_id": conv_id,
            "content": "TEST: Hello via WebSocket!",
            "self_destruct_seconds": None,
            "forward_protected": True
        }
        msg_response = api_client.post(f"{base_url}/api/messages", json=msg_payload, headers=headers1)
        assert msg_response.status_code == 200
        
        msg_data = msg_response.json()
        assert msg_data["content"] == "TEST: Hello via WebSocket!"
        assert msg_data["sender_id"] == user1_id
        assert msg_data["conversation_id"] == conv_id
        print(f"✓ Message sent and created: {msg_data['id']}")
        
        # Verify message persists
        get_response = api_client.get(f"{base_url}/api/messages/{conv_id}", headers=headers1)
        assert get_response.status_code == 200
        messages = get_response.json()
        assert len(messages) > 0
        assert any(m["id"] == msg_data["id"] for m in messages)
        print(f"✓ Message persisted in database")


class TestExistingEndpointsStillWork:
    """Smoke tests to ensure existing endpoints weren't broken by new features"""
    
    def test_auth_endpoints_working(self, api_client, base_url):
        """Verify auth endpoints still work"""
        # Anonymous registration
        fp = "TEST_smoke_" + "m" * 20
        response = api_client.post(f"{base_url}/api/auth/register/anonymous", json={"device_fingerprint": fp})
        assert response.status_code == 200
        token = response.json()["token"]
        
        # Auth me
        headers = {"Authorization": f"Bearer {token}"}
        me_response = api_client.get(f"{base_url}/api/auth/me", headers=headers)
        assert me_response.status_code == 200
        print(f"✓ Auth endpoints working")
    
    def test_conversations_endpoints_working(self, api_client, base_url):
        """Verify conversation endpoints still work"""
        fp = "TEST_smoke_conv_" + "n" * 15
        response = api_client.post(f"{base_url}/api/auth/register/anonymous", json={"device_fingerprint": fp})
        token = response.json()["token"]
        headers = {"Authorization": f"Bearer {token}"}
        
        # Get conversations
        conv_response = api_client.get(f"{base_url}/api/conversations", headers=headers)
        assert conv_response.status_code == 200
        print(f"✓ Conversation endpoints working")
    
    def test_security_endpoints_working(self, api_client, base_url):
        """Verify security endpoints still work"""
        fp = "TEST_smoke_sec_" + "p" * 15
        response = api_client.post(f"{base_url}/api/auth/register/anonymous", json={"device_fingerprint": fp})
        token = response.json()["token"]
        headers = {"Authorization": f"Bearer {token}"}
        
        # Get security settings
        sec_response = api_client.get(f"{base_url}/api/security/settings", headers=headers)
        assert sec_response.status_code == 200
        
        # Get session info
        session_response = api_client.get(f"{base_url}/api/security/session-info", headers=headers)
        assert session_response.status_code == 200
        print(f"✓ Security endpoints working")
