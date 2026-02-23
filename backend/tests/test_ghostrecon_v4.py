"""
Test suite for GhostRecon v4 NEW FEATURES:
- WebRTC configuration (GET /api/webrtc/config)
- Disappearing profile photos (POST/GET/DELETE /api/profile/photo)
- Group encryption key distribution (POST /api/groups/distribute-key, GET /api/groups/{conv_id}/key, POST /api/groups/{conv_id}/rotate-key)
- Regression: Existing endpoints still working
"""

import pytest
import requests
import time
import base64


class TestWebRTCConfig:
    """Test WebRTC STUN/TURN server configuration endpoint"""

    def test_get_webrtc_config(self, api_client, base_url):
        """GET /api/webrtc/config - should return STUN/TURN server list"""
        # Register user
        reg_response = api_client.post(f"{base_url}/api/auth/register/anonymous", json={
            "device_fingerprint": f"TEST_WEBRTC_{time.time()}",
            "alias": "TEST_WebRTCUser"
        })
        assert reg_response.status_code == 200
        token = reg_response.json()["token"]

        # Get WebRTC config
        config_response = api_client.get(
            f"{base_url}/api/webrtc/config",
            headers={"Authorization": f"Bearer {token}"}
        )
        assert config_response.status_code == 200
        
        config = config_response.json()
        assert "iceServers" in config
        assert "iceCandidatePoolSize" in config
        assert isinstance(config["iceServers"], list)
        assert len(config["iceServers"]) > 0
        
        # Verify STUN servers
        stun_servers = [s for s in config["iceServers"] if "stun:" in s["urls"]]
        assert len(stun_servers) >= 2
        assert config["iceCandidatePoolSize"] == 10
        
        print(f"✅ WebRTC config returned {len(config['iceServers'])} ICE servers")

    def test_webrtc_config_requires_auth(self, api_client, base_url):
        """GET /api/webrtc/config - should require authentication"""
        config_response = api_client.get(f"{base_url}/api/webrtc/config")
        assert config_response.status_code == 401
        print(f"✅ WebRTC config correctly requires authentication")


class TestDisappearingProfilePhotos:
    """Test disappearing profile photo with view tracking"""

    def test_upload_profile_photo(self, api_client, base_url):
        """POST /api/profile/photo - upload photo with disappear_after_views"""
        # Register user
        reg_response = api_client.post(f"{base_url}/api/auth/register/anonymous", json={
            "device_fingerprint": f"TEST_PHOTO_UPLOAD_{time.time()}",
            "alias": "TEST_PhotoUser"
        })
        assert reg_response.status_code == 200
        token = reg_response.json()["token"]

        # Upload photo
        photo_data = "data:image/jpeg;base64," + base64.b64encode(b"FAKE_IMAGE_DATA").decode()
        upload_response = api_client.post(
            f"{base_url}/api/profile/photo",
            json={
                "photo_data": photo_data,
                "disappear_after_views": 3,
                "disappear_after_seconds": None
            },
            headers={"Authorization": f"Bearer {token}"}
        )
        assert upload_response.status_code == 200
        
        result = upload_response.json()
        assert result["status"] == "uploaded"
        assert "photo_id" in result
        
        print(f"✅ Profile photo uploaded successfully: {result['photo_id']}")

    def test_view_profile_photo_tracking(self, api_client, base_url):
        """GET /api/profile/photo/{user_id} - view photo and track view count"""
        # Create owner user
        owner_response = api_client.post(f"{base_url}/api/auth/register/anonymous", json={
            "device_fingerprint": f"TEST_PHOTO_OWNER_{time.time()}",
            "alias": "TEST_PhotoOwner"
        })
        owner_token = owner_response.json()["token"]
        owner_id = owner_response.json()["user"]["id"]

        # Upload photo
        photo_data = "data:image/jpeg;base64," + base64.b64encode(b"TEST_PHOTO_VIEW_TRACKING").decode()
        api_client.post(
            f"{base_url}/api/profile/photo",
            json={
                "photo_data": photo_data,
                "disappear_after_views": 2,
                "disappear_after_seconds": None
            },
            headers={"Authorization": f"Bearer {owner_token}"}
        )

        # Create viewer user
        viewer_response = api_client.post(f"{base_url}/api/auth/register/anonymous", json={
            "device_fingerprint": f"TEST_PHOTO_VIEWER_{time.time()}",
            "alias": "TEST_PhotoViewer"
        })
        viewer_token = viewer_response.json()["token"]

        # First view
        view1_response = api_client.get(
            f"{base_url}/api/profile/photo/{owner_id}",
            headers={"Authorization": f"Bearer {viewer_token}"}
        )
        assert view1_response.status_code == 200
        
        view1_data = view1_response.json()
        assert "photo_data" in view1_data
        assert view1_data["photo_data"] == photo_data
        assert view1_data["view_count"] == 1
        assert view1_data["max_views"] == 2
        
        print(f"✅ First view tracked: {view1_data['view_count']}/{view1_data['max_views']}")

    def test_profile_photo_disappears_after_max_views(self, api_client, base_url):
        """Profile photo should disappear after reaching max views"""
        # Create owner
        owner_response = api_client.post(f"{base_url}/api/auth/register/anonymous", json={
            "device_fingerprint": f"TEST_DISAPPEAR_OWNER_{time.time()}",
            "alias": "TEST_DisappearOwner"
        })
        owner_token = owner_response.json()["token"]
        owner_id = owner_response.json()["user"]["id"]

        # Upload photo with 1 max view
        photo_data = "data:image/jpeg;base64," + base64.b64encode(b"DISAPPEAR_TEST").decode()
        api_client.post(
            f"{base_url}/api/profile/photo",
            json={
                "photo_data": photo_data,
                "disappear_after_views": 1,
                "disappear_after_seconds": None
            },
            headers={"Authorization": f"Bearer {owner_token}"}
        )

        # Create viewer
        viewer_response = api_client.post(f"{base_url}/api/auth/register/anonymous", json={
            "device_fingerprint": f"TEST_DISAPPEAR_VIEWER_{time.time()}",
            "alias": "TEST_DisappearViewer"
        })
        viewer_token = viewer_response.json()["token"]

        # First view - should reach max
        view1_response = api_client.get(
            f"{base_url}/api/profile/photo/{owner_id}",
            headers={"Authorization": f"Bearer {viewer_token}"}
        )
        assert view1_response.status_code == 200
        print(f"✅ Photo viewed 1 time (max reached)")

        # Second view - photo should be gone
        view2_response = api_client.get(
            f"{base_url}/api/profile/photo/{owner_id}",
            headers={"Authorization": f"Bearer {viewer_token}"}
        )
        assert view2_response.status_code == 404
        assert "no active photo" in view2_response.json()["detail"].lower()
        print(f"✅ Photo disappeared after max views reached")

    def test_delete_profile_photo(self, api_client, base_url):
        """DELETE /api/profile/photo - delete own profile photo"""
        # Register user
        reg_response = api_client.post(f"{base_url}/api/auth/register/anonymous", json={
            "device_fingerprint": f"TEST_DELETE_PHOTO_{time.time()}",
            "alias": "TEST_DeletePhoto"
        })
        token = reg_response.json()["token"]
        user_id = reg_response.json()["user"]["id"]

        # Upload photo
        photo_data = "data:image/jpeg;base64," + base64.b64encode(b"DELETE_ME").decode()
        api_client.post(
            f"{base_url}/api/profile/photo",
            json={"photo_data": photo_data, "disappear_after_views": 5},
            headers={"Authorization": f"Bearer {token}"}
        )

        # Verify photo exists
        view_response = api_client.get(
            f"{base_url}/api/profile/photo/{user_id}",
            headers={"Authorization": f"Bearer {token}"}
        )
        assert view_response.status_code == 200

        # Delete photo
        delete_response = api_client.delete(
            f"{base_url}/api/profile/photo",
            headers={"Authorization": f"Bearer {token}"}
        )
        assert delete_response.status_code == 200
        assert delete_response.json()["status"] == "deleted"
        print(f"✅ Profile photo deleted successfully")

        # Verify photo is gone
        view_after_delete = api_client.get(
            f"{base_url}/api/profile/photo/{user_id}",
            headers={"Authorization": f"Bearer {token}"}
        )
        assert view_after_delete.status_code == 404


class TestGroupEncryption:
    """Test group encryption key distribution and rotation"""

    def test_distribute_group_key(self, api_client, base_url):
        """POST /api/groups/distribute-key - distribute encrypted group keys"""
        # Create 3 users
        users = []
        for i in range(3):
            reg_response = api_client.post(f"{base_url}/api/auth/register/anonymous", json={
                "device_fingerprint": f"TEST_GROUP_USER{i}_{time.time()}",
                "alias": f"TEST_GroupUser{i}"
            })
            users.append({
                "id": reg_response.json()["user"]["id"],
                "token": reg_response.json()["token"]
            })

        # Create group conversation
        conv_response = api_client.post(
            f"{base_url}/api/conversations",
            json={
                "participant_ids": [users[1]["id"], users[2]["id"]],
                "name": "TEST Group Chat",
                "is_group": True
            },
            headers={"Authorization": f"Bearer {users[0]['token']}"}
        )
        assert conv_response.status_code == 200
        conv_id = conv_response.json()["id"]
        print(f"✅ Group conversation created: {conv_id}")

        # Distribute group keys
        encrypted_keys = {
            users[0]["id"]: "ENCRYPTED_KEY_USER0_BASE64",
            users[1]["id"]: "ENCRYPTED_KEY_USER1_BASE64",
            users[2]["id"]: "ENCRYPTED_KEY_USER2_BASE64"
        }
        distribute_response = api_client.post(
            f"{base_url}/api/groups/distribute-key",
            json={
                "conversation_id": conv_id,
                "encrypted_keys": encrypted_keys
            },
            headers={"Authorization": f"Bearer {users[0]['token']}"}
        )
        assert distribute_response.status_code == 200
        
        result = distribute_response.json()
        assert result["status"] == "distributed"
        assert result["recipients"] == 3
        print(f"✅ Group keys distributed to {result['recipients']} recipients")

    def test_get_my_group_key(self, api_client, base_url):
        """GET /api/groups/{conv_id}/key - retrieve my encrypted group key"""
        # Create 2 users
        user1_response = api_client.post(f"{base_url}/api/auth/register/anonymous", json={
            "device_fingerprint": f"TEST_GET_KEY_USER1_{time.time()}",
            "alias": "TEST_GetKeyUser1"
        })
        user1_token = user1_response.json()["token"]
        user1_id = user1_response.json()["user"]["id"]

        user2_response = api_client.post(f"{base_url}/api/auth/register/anonymous", json={
            "device_fingerprint": f"TEST_GET_KEY_USER2_{time.time()}",
            "alias": "TEST_GetKeyUser2"
        })
        user2_token = user2_response.json()["token"]
        user2_id = user2_response.json()["user"]["id"]

        # Create group conversation
        conv_response = api_client.post(
            f"{base_url}/api/conversations",
            json={
                "participant_ids": [user2_id],
                "name": "TEST Get Key Chat",
                "is_group": True
            },
            headers={"Authorization": f"Bearer {user1_token}"}
        )
        conv_id = conv_response.json()["id"]

        # Distribute keys
        encrypted_keys = {
            user1_id: "USER1_ENCRYPTED_GROUP_KEY_XYZ",
            user2_id: "USER2_ENCRYPTED_GROUP_KEY_ABC"
        }
        api_client.post(
            f"{base_url}/api/groups/distribute-key",
            json={"conversation_id": conv_id, "encrypted_keys": encrypted_keys},
            headers={"Authorization": f"Bearer {user1_token}"}
        )

        # User2 retrieves their key
        get_key_response = api_client.get(
            f"{base_url}/api/groups/{conv_id}/key",
            headers={"Authorization": f"Bearer {user2_token}"}
        )
        assert get_key_response.status_code == 200
        
        key_data = get_key_response.json()
        assert key_data["conversation_id"] == conv_id
        assert key_data["encrypted_key"] == encrypted_keys[user2_id]
        assert key_data["distributed_by"] == user1_id
        assert "distributed_at" in key_data
        assert key_data["rotation_count"] == 0
        print(f"✅ User2 retrieved their encrypted group key successfully")

    def test_rotate_group_key(self, api_client, base_url):
        """POST /api/groups/{conv_id}/rotate-key - rotate group encryption key"""
        # Create 2 users
        user1_response = api_client.post(f"{base_url}/api/auth/register/anonymous", json={
            "device_fingerprint": f"TEST_ROTATE_USER1_{time.time()}",
            "alias": "TEST_RotateUser1"
        })
        user1_token = user1_response.json()["token"]
        user1_id = user1_response.json()["user"]["id"]

        user2_response = api_client.post(f"{base_url}/api/auth/register/anonymous", json={
            "device_fingerprint": f"TEST_ROTATE_USER2_{time.time()}",
            "alias": "TEST_RotateUser2"
        })
        user2_token = user2_response.json()["token"]
        user2_id = user2_response.json()["user"]["id"]

        # Create group
        conv_response = api_client.post(
            f"{base_url}/api/conversations",
            json={"participant_ids": [user2_id], "name": "TEST Rotate", "is_group": True},
            headers={"Authorization": f"Bearer {user1_token}"}
        )
        conv_id = conv_response.json()["id"]

        # Initial key distribution
        initial_keys = {
            user1_id: "INITIAL_KEY_USER1",
            user2_id: "INITIAL_KEY_USER2"
        }
        api_client.post(
            f"{base_url}/api/groups/distribute-key",
            json={"conversation_id": conv_id, "encrypted_keys": initial_keys},
            headers={"Authorization": f"Bearer {user1_token}"}
        )

        # Get initial rotation count
        initial_key_data = api_client.get(
            f"{base_url}/api/groups/{conv_id}/key",
            headers={"Authorization": f"Bearer {user1_token}"}
        ).json()
        assert initial_key_data["rotation_count"] == 0

        # Rotate key
        rotated_keys = {
            user1_id: "ROTATED_KEY_USER1",
            user2_id: "ROTATED_KEY_USER2"
        }
        rotate_response = api_client.post(
            f"{base_url}/api/groups/{conv_id}/rotate-key",
            json={"conversation_id": conv_id, "encrypted_keys": rotated_keys},
            headers={"Authorization": f"Bearer {user2_token}"}
        )
        assert rotate_response.status_code == 200
        assert rotate_response.json()["status"] == "rotated"
        print(f"✅ Group key rotated successfully")

        # Verify rotation count incremented
        rotated_key_data = api_client.get(
            f"{base_url}/api/groups/{conv_id}/key",
            headers={"Authorization": f"Bearer {user1_token}"}
        ).json()
        assert rotated_key_data["rotation_count"] == 1
        assert rotated_key_data["encrypted_key"] == rotated_keys[user1_id]
        print(f"✅ Rotation count incremented to {rotated_key_data['rotation_count']}")

    def test_get_group_key_not_found(self, api_client, base_url):
        """GET /api/groups/{conv_id}/key - should return 404 if no key distributed"""
        # Create user and group
        user_response = api_client.post(f"{base_url}/api/auth/register/anonymous", json={
            "device_fingerprint": f"TEST_NO_KEY_{time.time()}",
            "alias": "TEST_NoKeyUser"
        })
        token = user_response.json()["token"]

        conv_response = api_client.post(
            f"{base_url}/api/conversations",
            json={"participant_ids": [], "name": "TEST No Key", "is_group": True},
            headers={"Authorization": f"Bearer {token}"}
        )
        conv_id = conv_response.json()["id"]

        # Try to get key without distributing
        get_key_response = api_client.get(
            f"{base_url}/api/groups/{conv_id}/key",
            headers={"Authorization": f"Bearer {token}"}
        )
        assert get_key_response.status_code == 404
        assert "no group key distributed" in get_key_response.json()["detail"].lower()
        print(f"✅ Correctly returned 404 for conversation without distributed keys")


class TestRegressionExistingEndpoints:
    """Regression tests to ensure existing endpoints still work"""

    def test_health_check(self, api_client, base_url):
        """GET /api/health - basic health check"""
        response = api_client.get(f"{base_url}/api/health")
        assert response.status_code == 200
        assert response.json()["status"] == "ok"
        print(f"✅ Health check passed")

    def test_auth_register_login(self, api_client, base_url):
        """Auth flow: register and login still working"""
        # Register
        reg_response = api_client.post(f"{base_url}/api/auth/register/anonymous", json={
            "device_fingerprint": f"TEST_REGRESSION_AUTH_{time.time()}",
            "alias": "TEST_RegressionAuth"
        })
        assert reg_response.status_code == 200
        assert "token" in reg_response.json()
        assert "user" in reg_response.json()
        
        # Login
        device_fp = reg_response.json()["user"]["device_fingerprint"]
        login_response = api_client.post(f"{base_url}/api/auth/login", json={
            "identifier": device_fp,
            "password": None
        })
        assert login_response.status_code == 200
        assert "token" in login_response.json()
        print(f"✅ Auth register/login still working")

    def test_conversations_and_messages(self, api_client, base_url):
        """Conversations and messages endpoints still working"""
        # Create 2 users
        user1 = api_client.post(f"{base_url}/api/auth/register/anonymous", json={
            "device_fingerprint": f"TEST_CONV_USER1_{time.time()}",
            "alias": "TEST_ConvUser1"
        }).json()
        
        user2 = api_client.post(f"{base_url}/api/auth/register/anonymous", json={
            "device_fingerprint": f"TEST_CONV_USER2_{time.time()}",
            "alias": "TEST_ConvUser2"
        }).json()

        # Create conversation
        conv_response = api_client.post(
            f"{base_url}/api/conversations",
            json={"participant_ids": [user2["user"]["id"]]},
            headers={"Authorization": f"Bearer {user1['token']}"}
        )
        assert conv_response.status_code == 200
        conv_id = conv_response.json()["id"]

        # Send message
        msg_response = api_client.post(
            f"{base_url}/api/messages",
            json={
                "conversation_id": conv_id,
                "content": "TEST regression message",
                "self_destruct_seconds": None,
                "forward_protected": True
            },
            headers={"Authorization": f"Bearer {user1['token']}"}
        )
        assert msg_response.status_code == 200
        assert msg_response.json()["content"] == "TEST regression message"

        # Get messages
        get_msgs_response = api_client.get(
            f"{base_url}/api/messages/{conv_id}",
            headers={"Authorization": f"Bearer {user2['token']}"}
        )
        assert get_msgs_response.status_code == 200
        assert len(get_msgs_response.json()) >= 1
        print(f"✅ Conversations and messages endpoints working")

    def test_security_endpoints(self, api_client, base_url):
        """Security endpoints still working"""
        # Register user
        user = api_client.post(f"{base_url}/api/auth/register/anonymous", json={
            "device_fingerprint": f"TEST_SECURITY_{time.time()}",
            "alias": "TEST_SecurityUser"
        }).json()
        token = user["token"]

        # Get session info
        session_response = api_client.get(
            f"{base_url}/api/security/session-info",
            headers={"Authorization": f"Bearer {token}"}
        )
        assert session_response.status_code == 200
        assert "encryption_key_hash" in session_response.json()

        # Rotate keys
        rotate_response = api_client.post(
            f"{base_url}/api/security/rotate-keys",
            headers={"Authorization": f"Bearer {token}"}
        )
        assert rotate_response.status_code == 200
        assert rotate_response.json()["status"] == "keys_rotated"
        print(f"✅ Security endpoints working")

    def test_calls_endpoints(self, api_client, base_url):
        """Calls endpoints still working"""
        # Create 2 users
        caller = api_client.post(f"{base_url}/api/auth/register/anonymous", json={
            "device_fingerprint": f"TEST_CALL_CALLER_{time.time()}",
            "alias": "TEST_CallCaller"
        }).json()
        
        receiver = api_client.post(f"{base_url}/api/auth/register/anonymous", json={
            "device_fingerprint": f"TEST_CALL_RECEIVER_{time.time()}",
            "alias": "TEST_CallReceiver"
        }).json()

        # Initiate call
        call_response = api_client.post(
            f"{base_url}/api/calls",
            json={"target_user_id": receiver["user"]["id"], "call_type": "voice"},
            headers={"Authorization": f"Bearer {caller['token']}"}
        )
        assert call_response.status_code == 200
        call_id = call_response.json()["id"]

        # End call
        end_response = api_client.put(
            f"{base_url}/api/calls/{call_id}/end",
            headers={"Authorization": f"Bearer {caller['token']}"}
        )
        assert end_response.status_code == 200
        assert end_response.json()["status"] == "ended"
        print(f"✅ Calls endpoints working")
