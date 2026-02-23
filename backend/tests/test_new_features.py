"""
Test suite for NEW FEATURES:
- E2E encryption key exchange (POST /api/keys/publish, GET /api/keys/{user_id})
- Session info public_key field (GET /api/security/session-info)
- Call signaling (POST /api/calls/signal, PUT /api/calls/{call_id}/accept, PUT /api/calls/{call_id}/reject)
"""

import pytest
import requests
import time


class TestPublicKeyExchange:
    """Test X25519 public key publishing and retrieval"""

    def test_publish_public_key(self, api_client, base_url):
        """POST /api/keys/publish - publish user's X25519 public key"""
        # Register user
        reg_response = api_client.post(f"{base_url}/api/auth/register/anonymous", json={
            "device_fingerprint": f"TEST_KEY_PUBLISH_{time.time()}",
            "alias": "TEST_KeyPublisher"
        })
        assert reg_response.status_code == 200
        token = reg_response.json()["token"]
        user_id = reg_response.json()["user"]["id"]

        # Publish public key
        pub_key = "TEST_PUBLIC_KEY_BASE64_ENCODED_X25519_" + "A" * 32
        publish_response = api_client.post(
            f"{base_url}/api/keys/publish",
            json={"public_key": pub_key},
            headers={"Authorization": f"Bearer {token}"}
        )
        assert publish_response.status_code == 200
        assert publish_response.json()["status"] == "published"

        # Verify key was stored - check session info
        session_response = api_client.get(
            f"{base_url}/api/security/session-info",
            headers={"Authorization": f"Bearer {token}"}
        )
        assert session_response.status_code == 200
        session_data = session_response.json()
        assert session_data["public_key"] == pub_key
        print(f"✅ Published public key: {pub_key[:32]}...")

    def test_get_public_key(self, api_client, base_url):
        """GET /api/keys/{user_id} - retrieve another user's public key"""
        # Create two users
        user1_response = api_client.post(f"{base_url}/api/auth/register/anonymous", json={
            "device_fingerprint": f"TEST_KEY_USER1_{time.time()}",
            "alias": "TEST_User1"
        })
        assert user1_response.status_code == 200
        user1_token = user1_response.json()["token"]
        user1_id = user1_response.json()["user"]["id"]

        user2_response = api_client.post(f"{base_url}/api/auth/register/anonymous", json={
            "device_fingerprint": f"TEST_KEY_USER2_{time.time()}",
            "alias": "TEST_User2"
        })
        assert user2_response.status_code == 200
        user2_token = user2_response.json()["token"]
        user2_id = user2_response.json()["user"]["id"]

        # User1 publishes their public key
        pub_key_user1 = "USER1_PUBLIC_KEY_X25519_" + "B" * 40
        publish_response = api_client.post(
            f"{base_url}/api/keys/publish",
            json={"public_key": pub_key_user1},
            headers={"Authorization": f"Bearer {user1_token}"}
        )
        assert publish_response.status_code == 200

        # User2 retrieves User1's public key
        get_key_response = api_client.get(
            f"{base_url}/api/keys/{user1_id}",
            headers={"Authorization": f"Bearer {user2_token}"}
        )
        assert get_key_response.status_code == 200
        key_data = get_key_response.json()
        assert key_data["user_id"] == user1_id
        assert key_data["alias"] == "TEST_User1"
        assert key_data["public_key"] == pub_key_user1
        print(f"✅ User2 successfully retrieved User1's public key")

    def test_get_public_key_not_found(self, api_client, base_url):
        """GET /api/keys/{user_id} - should return 404 if user has no public key"""
        # Register user without publishing key
        reg_response = api_client.post(f"{base_url}/api/auth/register/anonymous", json={
            "device_fingerprint": f"TEST_NO_KEY_{time.time()}",
            "alias": "TEST_NoKey"
        })
        assert reg_response.status_code == 200
        token = reg_response.json()["token"]
        user_id = reg_response.json()["user"]["id"]

        # Create another user to request the key
        requester_response = api_client.post(f"{base_url}/api/auth/register/anonymous", json={
            "device_fingerprint": f"TEST_REQUESTER_{time.time()}",
            "alias": "TEST_Requester"
        })
        assert requester_response.status_code == 200
        requester_token = requester_response.json()["token"]

        # Try to get public key from user who hasn't published
        get_response = api_client.get(
            f"{base_url}/api/keys/{user_id}",
            headers={"Authorization": f"Bearer {requester_token}"}
        )
        assert get_response.status_code == 404
        assert "not found" in get_response.json()["detail"].lower()
        print(f"✅ Correctly returned 404 for user without published key")


class TestSessionInfo:
    """Test session info includes public_key field"""

    def test_session_info_includes_public_key(self, api_client, base_url):
        """GET /api/security/session-info - should include public_key field"""
        # Register user
        reg_response = api_client.post(f"{base_url}/api/auth/register/anonymous", json={
            "device_fingerprint": f"TEST_SESSION_INFO_{time.time()}",
            "alias": "TEST_SessionUser"
        })
        assert reg_response.status_code == 200
        token = reg_response.json()["token"]

        # Get session info before publishing key
        session_before = api_client.get(
            f"{base_url}/api/security/session-info",
            headers={"Authorization": f"Bearer {token}"}
        )
        assert session_before.status_code == 200
        assert "public_key" in session_before.json()
        assert session_before.json()["public_key"] == ""  # Empty before publishing

        # Publish public key
        pub_key = "SESSION_TEST_PUBLIC_KEY_" + "C" * 45
        api_client.post(
            f"{base_url}/api/keys/publish",
            json={"public_key": pub_key},
            headers={"Authorization": f"Bearer {token}"}
        )

        # Get session info after publishing key
        session_after = api_client.get(
            f"{base_url}/api/security/session-info",
            headers={"Authorization": f"Bearer {token}"}
        )
        assert session_after.status_code == 200
        session_data = session_after.json()
        assert "public_key" in session_data
        assert session_data["public_key"] == pub_key
        assert "user_id" in session_data
        assert "alias" in session_data
        assert "encryption_key_hash" in session_data
        print(f"✅ Session info correctly includes public_key field")


class TestCallSignaling:
    """Test WebRTC call signaling endpoints"""

    def test_call_signal_offer(self, api_client, base_url):
        """POST /api/calls/signal - send WebRTC offer signal"""
        # Create two users
        caller_response = api_client.post(f"{base_url}/api/auth/register/anonymous", json={
            "device_fingerprint": f"TEST_CALLER_{time.time()}",
            "alias": "TEST_Caller"
        })
        assert caller_response.status_code == 200
        caller_token = caller_response.json()["token"]
        caller_id = caller_response.json()["user"]["id"]

        receiver_response = api_client.post(f"{base_url}/api/auth/register/anonymous", json={
            "device_fingerprint": f"TEST_RECEIVER_{time.time()}",
            "alias": "TEST_Receiver"
        })
        assert receiver_response.status_code == 200
        receiver_id = receiver_response.json()["user"]["id"]

        # Initiate call
        call_response = api_client.post(
            f"{base_url}/api/calls",
            json={"target_user_id": receiver_id, "call_type": "voice"},
            headers={"Authorization": f"Bearer {caller_token}"}
        )
        assert call_response.status_code == 200
        call_id = call_response.json()["id"]

        # Send WebRTC offer signal
        signal_response = api_client.post(
            f"{base_url}/api/calls/signal",
            json={
                "call_id": call_id,
                "signal_type": "offer",
                "signal_data": "MOCK_WEBRTC_OFFER_SDP_DATA"
            },
            headers={"Authorization": f"Bearer {caller_token}"}
        )
        assert signal_response.status_code == 200
        assert signal_response.json()["status"] == "signaled"
        print(f"✅ Call signal (offer) sent successfully for call {call_id}")

    def test_call_signal_ice_candidate(self, api_client, base_url):
        """POST /api/calls/signal - send ICE candidate"""
        # Create users and call
        caller_response = api_client.post(f"{base_url}/api/auth/register/anonymous", json={
            "device_fingerprint": f"TEST_ICE_CALLER_{time.time()}",
            "alias": "TEST_ICECaller"
        })
        caller_token = caller_response.json()["token"]
        caller_id = caller_response.json()["user"]["id"]

        receiver_response = api_client.post(f"{base_url}/api/auth/register/anonymous", json={
            "device_fingerprint": f"TEST_ICE_RECEIVER_{time.time()}",
            "alias": "TEST_ICEReceiver"
        })
        receiver_id = receiver_response.json()["user"]["id"]

        call_response = api_client.post(
            f"{base_url}/api/calls",
            json={"target_user_id": receiver_id, "call_type": "video"},
            headers={"Authorization": f"Bearer {caller_token}"}
        )
        call_id = call_response.json()["id"]

        # Send ICE candidate signal
        ice_response = api_client.post(
            f"{base_url}/api/calls/signal",
            json={
                "call_id": call_id,
                "signal_type": "ice-candidate",
                "signal_data": '{"candidate": "candidate:123456", "sdpMid": "0"}'
            },
            headers={"Authorization": f"Bearer {caller_token}"}
        )
        assert ice_response.status_code == 200
        assert ice_response.json()["status"] == "signaled"
        print(f"✅ ICE candidate signal sent successfully")

    def test_accept_call(self, api_client, base_url):
        """PUT /api/calls/{call_id}/accept - receiver accepts call"""
        # Create users
        caller_response = api_client.post(f"{base_url}/api/auth/register/anonymous", json={
            "device_fingerprint": f"TEST_ACCEPT_CALLER_{time.time()}",
            "alias": "TEST_AcceptCaller"
        })
        caller_token = caller_response.json()["token"]
        caller_id = caller_response.json()["user"]["id"]

        receiver_response = api_client.post(f"{base_url}/api/auth/register/anonymous", json={
            "device_fingerprint": f"TEST_ACCEPT_RECEIVER_{time.time()}",
            "alias": "TEST_AcceptReceiver"
        })
        receiver_token = receiver_response.json()["token"]
        receiver_id = receiver_response.json()["user"]["id"]

        # Initiate call
        call_response = api_client.post(
            f"{base_url}/api/calls",
            json={"target_user_id": receiver_id, "call_type": "voice"},
            headers={"Authorization": f"Bearer {caller_token}"}
        )
        call_id = call_response.json()["id"]
        assert call_response.json()["status"] == "initiated"

        # Receiver accepts call
        accept_response = api_client.put(
            f"{base_url}/api/calls/{call_id}/accept",
            headers={"Authorization": f"Bearer {receiver_token}"}
        )
        assert accept_response.status_code == 200
        assert accept_response.json()["status"] == "accepted"
        print(f"✅ Call accepted successfully, status changed from initiated to accepted")

        # Verify call status changed in database
        call_history = api_client.get(
            f"{base_url}/api/calls",
            headers={"Authorization": f"Bearer {caller_token}"}
        )
        calls = call_history.json()
        accepted_call = next((c for c in calls if c["id"] == call_id), None)
        assert accepted_call is not None
        assert accepted_call["status"] == "connected"  # Backend updates to "connected"
        print(f"✅ Call status verified in database: connected")

    def test_reject_call(self, api_client, base_url):
        """PUT /api/calls/{call_id}/reject - receiver rejects call"""
        # Create users
        caller_response = api_client.post(f"{base_url}/api/auth/register/anonymous", json={
            "device_fingerprint": f"TEST_REJECT_CALLER_{time.time()}",
            "alias": "TEST_RejectCaller"
        })
        caller_token = caller_response.json()["token"]

        receiver_response = api_client.post(f"{base_url}/api/auth/register/anonymous", json={
            "device_fingerprint": f"TEST_REJECT_RECEIVER_{time.time()}",
            "alias": "TEST_RejectReceiver"
        })
        receiver_token = receiver_response.json()["token"]
        receiver_id = receiver_response.json()["user"]["id"]

        # Initiate call
        call_response = api_client.post(
            f"{base_url}/api/calls",
            json={"target_user_id": receiver_id, "call_type": "voice"},
            headers={"Authorization": f"Bearer {caller_token}"}
        )
        call_id = call_response.json()["id"]
        assert call_response.json()["status"] == "initiated"

        # Receiver rejects call
        reject_response = api_client.put(
            f"{base_url}/api/calls/{call_id}/reject",
            headers={"Authorization": f"Bearer {receiver_token}"}
        )
        assert reject_response.status_code == 200
        assert reject_response.json()["status"] == "rejected"
        print(f"✅ Call rejected successfully")

        # Verify call status changed
        call_history = api_client.get(
            f"{base_url}/api/calls",
            headers={"Authorization": f"Bearer {receiver_token}"}
        )
        calls = call_history.json()
        rejected_call = next((c for c in calls if c["id"] == call_id), None)
        assert rejected_call is not None
        assert rejected_call["status"] == "rejected"
        print(f"✅ Call status verified in database: rejected")

    def test_call_signal_invalid_call_id(self, api_client, base_url):
        """POST /api/calls/signal - should return 404 for invalid call_id"""
        # Register user
        user_response = api_client.post(f"{base_url}/api/auth/register/anonymous", json={
            "device_fingerprint": f"TEST_INVALID_CALL_{time.time()}",
            "alias": "TEST_InvalidCall"
        })
        token = user_response.json()["token"]

        # Try to signal non-existent call
        signal_response = api_client.post(
            f"{base_url}/api/calls/signal",
            json={
                "call_id": "non-existent-call-id-12345",
                "signal_type": "offer",
                "signal_data": "test"
            },
            headers={"Authorization": f"Bearer {token}"}
        )
        assert signal_response.status_code == 404
        assert "not found" in signal_response.json()["detail"].lower()
        print(f"✅ Correctly returned 404 for invalid call_id")
