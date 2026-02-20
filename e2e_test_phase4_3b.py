#!/usr/bin/env python3
"""Phase 4 Part 3B E2E Tests for Gratonite API"""

import json
import urllib.request
import urllib.error
import random
import string
import sys
import time

BASE = "http://localhost:4000/api/v1"
PASS_COUNT = 0
FAIL_COUNT = 0

def rand_suffix():
    return ''.join(random.choices(string.ascii_lowercase + string.digits, k=6))

def api(method, path, token=None, body=None, return_status=False):
    url = f"{BASE}{path}"
    data = json.dumps(body).encode() if body else None
    headers = {"Content-Type": "application/json"}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    req = urllib.request.Request(url, data=data, headers=headers, method=method)
    try:
        resp = urllib.request.urlopen(req)
        status = resp.status
        text = resp.read().decode()
        result = json.loads(text) if text.strip() else {}
    except urllib.error.HTTPError as e:
        status = e.code
        text = e.read().decode()
        try:
            result = json.loads(text) if text.strip() else {}
        except:
            result = {"raw": text}
    if return_status:
        return status, result
    return result

def send_message(channelid, token, content):
    """Send a message with a small delay to avoid rate limiting."""
    time.sleep(1.2)
    return api("POST", f"/channels/{channelid}/messages", token=token,
               body={"content": content}, return_status=True)

def ok(test_name, detail=""):
    global PASS_COUNT
    PASS_COUNT += 1
    msg = f"PASS {test_name}"
    if detail:
        msg += f" ({detail})"
    print(msg)

def fail(test_name, detail=""):
    global FAIL_COUNT
    FAIL_COUNT += 1
    msg = f"FAIL {test_name}"
    if detail:
        msg += f" ({detail})"
    print(msg)

def main():
    global PASS_COUNT, FAIL_COUNT

    print("=" * 50)
    print("Phase 4 Part 3B E2E Tests")
    print("=" * 50)
    print()

    suffix = rand_suffix()

    # ========== SETUP ==========
    print("--- Setup: Register users and create guild ---")

    user1 = api("POST", "/auth/register", body={
        "username": f"automod_{suffix}",
        "displayName": f"AutoMod Tester {suffix}",
        "email": f"automod_{suffix}@test.com",
        "password": "TestPass123!",
        "dateOfBirth": "1995-06-15"
    })
    token1 = user1.get("accessToken")
    userid1 = user1.get("user", {}).get("id")
    print(f"User1: {userid1}")

    if not token1:
        print(f"ERROR: Failed to register user1: {user1}")
        return 1

    # Wait between registrations to avoid rate limiting
    time.sleep(2)

    user2 = api("POST", "/auth/register", body={
        "username": f"target_{suffix}",
        "displayName": f"Target User {suffix}",
        "email": f"target_{suffix}@test.com",
        "password": "TestPass123!",
        "dateOfBirth": "1996-03-20"
    })
    token2 = user2.get("accessToken")
    userid2 = user2.get("user", {}).get("id")
    print(f"User2: {userid2}")

    if not token2:
        print(f"ERROR: Failed to register user2: {user2}")
        return 1

    guild = api("POST", "/guilds", token=token1, body={"name": "Moderation Test Server"})
    guildid = guild.get("id") or guild.get("guildId")
    print(f"Guild: {guildid}")

    if not guildid:
        print(f"ERROR: Failed to create guild: {guild}")
        return 1

    channel = api("POST", f"/guilds/{guildid}/channels", token=token1, body={
        "name": "general",
        "type": "GUILD_TEXT"
    })
    channelid = channel.get("id")
    print(f"Channel: {channelid}")

    if not channelid:
        print(f"ERROR: Failed to create channel: {channel}")
        return 1

    print()

    # ========== TEST 1: Auto-Moderation CRUD ==========
    print("--- Test 1: Auto-Moderation CRUD ---")

    rule = api("POST", f"/guilds/{guildid}/auto-moderation/rules", token=token1, body={
        "name": "Block Bad Words",
        "eventType": "message_send",
        "triggerType": "keyword",
        "triggerMetadata": {"keywordFilter": ["badword", "forbidden"]},
        "actions": [{"type": "block_message"}]
    })
    ruleid = rule.get("id")
    if ruleid:
        ok("TEST 1a - Create automod rule", f"id={ruleid}")
    else:
        fail("TEST 1a - Create automod rule", f"response={rule}")

    rules = api("GET", f"/guilds/{guildid}/auto-moderation/rules", token=token1)
    rcount = len(rules) if isinstance(rules, list) else 0
    if rcount == 1:
        ok("TEST 1b - List rules", f"count={rcount}")
    else:
        fail("TEST 1b - List rules", f"got {rcount}, expected 1")

    single = api("GET", f"/guilds/{guildid}/auto-moderation/rules/{ruleid}", token=token1)
    sname = single.get("name")
    if sname == "Block Bad Words":
        ok("TEST 1c - Get single rule", f"name={sname}")
    else:
        fail("TEST 1c - Get single rule", f"got name={sname}")
    print()

    # ========== TEST 2: Automod Message Blocking ==========
    print("--- Test 2: Automod Message Blocking ---")

    status, _ = send_message(channelid, token1, "this contains badword in it")
    if status == 403:
        ok("TEST 2a - Block message with keyword", f"status={status}")
    else:
        fail("TEST 2a - Block message with keyword", f"got {status}, expected 403")

    status2, blocked_body = send_message(channelid, token1, "this contains forbidden text")
    blocked_code = blocked_body.get("code")
    if blocked_code == "AUTO_MODERATION_BLOCKED":
        ok("TEST 2b - Block response code", f"{blocked_code}")
    else:
        fail("TEST 2b - Block response code", f"got {blocked_code}, expected AUTO_MODERATION_BLOCKED")

    status3, _ = send_message(channelid, token1, "this is a normal message")
    if status3 == 201:
        ok("TEST 2c - Allow normal message", f"status={status3}")
    else:
        fail("TEST 2c - Allow normal message", f"got {status3}, expected 201")
    print()

    # ========== TEST 3: Automod Action Logs ==========
    print("--- Test 3: Automod Action Logs ---")

    logs = api("GET", f"/guilds/{guildid}/auto-moderation/logs", token=token1)
    if isinstance(logs, list):
        logcount = len(logs)
        if logcount >= 1:
            ok("TEST 3a - Automod logs exist", f"{logcount} logs")
        else:
            fail("TEST 3a - Automod logs exist", f"got {logcount}")

        if logcount > 0:
            logkw = logs[0].get("matchedKeyword")
            if logkw:
                ok("TEST 3b - Log matched keyword", f"{logkw}")
            else:
                fail("TEST 3b - Log matched keyword", f"got {logkw}, log keys={list(logs[0].keys())}")
        else:
            fail("TEST 3b - Log matched keyword", "no logs to check")
    else:
        fail("TEST 3a - Automod logs exist", f"response not array: {logs}")
        fail("TEST 3b - Log matched keyword", "no logs")
    print()

    # ========== TEST 4: Update/Disable Automod Rule ==========
    print("--- Test 4: Update/Disable Automod Rule ---")

    updated = api("PATCH", f"/guilds/{guildid}/auto-moderation/rules/{ruleid}", token=token1,
                   body={"enabled": False})
    uenabled = updated.get("enabled")
    if uenabled == False:
        ok("TEST 4a - Disable rule", f"enabled={uenabled}")
    else:
        fail("TEST 4a - Disable rule", f"got enabled={uenabled}")

    status4, _ = send_message(channelid, token1, "badword is now allowed")
    if status4 == 201:
        ok("TEST 4b - Message allowed after disable", f"status={status4}")
    else:
        fail("TEST 4b - Message allowed after disable", f"got {status4}, expected 201")

    del_status, _ = api("DELETE", f"/guilds/{guildid}/auto-moderation/rules/{ruleid}",
                         token=token1, return_status=True)
    if del_status == 204:
        ok("TEST 4c - Delete rule", f"status={del_status}")
    else:
        fail("TEST 4c - Delete rule", f"got {del_status}, expected 204")
    print()

    # ========== TEST 5: Raid Protection Config ==========
    print("--- Test 5: Raid Protection Config ---")

    rconfig = api("GET", f"/guilds/{guildid}/raid-config", token=token1)
    renabled = rconfig.get("enabled")
    if renabled == False:
        ok("TEST 5a - Default raid config", f"enabled={renabled}")
    else:
        fail("TEST 5a - Default raid config", f"got enabled={renabled}, response={rconfig}")

    uconfig = api("PATCH", f"/guilds/{guildid}/raid-config", token=token1, body={
        "enabled": True,
        "joinThreshold": 3,
        "joinWindowSeconds": 60,
        "action": "alert_only"
    })
    uenabled2 = uconfig.get("enabled")
    uthresh = uconfig.get("joinThreshold")
    if uenabled2 == True and uthresh == 3:
        ok("TEST 5b - Update raid config", f"enabled={uenabled2}, threshold={uthresh}")
    else:
        fail("TEST 5b - Update raid config", f"enabled={uenabled2}, threshold={uthresh}, response={uconfig}")

    resolve = api("POST", f"/guilds/{guildid}/raid-resolve", token=token1)
    resolved = resolve.get("resolved")
    if resolved == True:
        ok("TEST 5c - Resolve raid", f"resolved={resolved}")
    else:
        fail("TEST 5c - Resolve raid", f"got resolved={resolved}, response={resolve}")
    print()

    # ========== TEST 6: User Reports ==========
    print("--- Test 6: User Reports ---")

    # Create invite via correct endpoint: POST /invites/guilds/{guildId}/invites
    invite = api("POST", f"/invites/guilds/{guildid}/invites", token=token1,
                  body={"channelId": str(channelid)})
    invite_code = invite.get("code")
    print(f"Invite code: {invite_code}")

    # Accept invite: POST /invites/{code}
    accept = api("POST", f"/invites/{invite_code}", token=token2)
    print(f"Accept invite: {accept.get('guildId', accept)}")

    report = api("POST", f"/guilds/{guildid}/reports", token=token2, body={
        "reportedUserId": str(userid1),
        "reason": "spam",
        "description": "Sending repeated messages"
    })
    reportid = report.get("id")
    rstatus = report.get("status")
    if reportid and rstatus == "pending":
        ok("TEST 6a - Create report", f"id={reportid}, status={rstatus}")
    else:
        fail("TEST 6a - Create report", f"id={reportid}, status={rstatus}, body={report}")

    reports = api("GET", f"/guilds/{guildid}/reports", token=token1)
    repcount = len(reports) if isinstance(reports, list) else 0
    if repcount >= 1:
        ok("TEST 6b - List reports", f"count={repcount}")
    else:
        fail("TEST 6b - List reports", f"got {repcount}, response={reports}")

    if reportid:
        singlerep = api("GET", f"/guilds/{guildid}/reports/{reportid}", token=token1)
        sreason = singlerep.get("reason")
        if sreason == "spam":
            ok("TEST 6c - Get single report", f"reason={sreason}")
        else:
            fail("TEST 6c - Get single report", f"got reason={sreason}")

        uresult = api("PATCH", f"/guilds/{guildid}/reports/{reportid}", token=token1, body={
            "status": "resolved",
            "resolutionNote": "Warned the user"
        })
        urstatus = uresult.get("status")
        uresolvedat = uresult.get("resolvedAt")
        if urstatus == "resolved" and uresolvedat:
            ok("TEST 6d - Resolve report", f"status={urstatus}, resolvedAt={uresolvedat}")
        else:
            fail("TEST 6d - Resolve report", f"status={urstatus}, resolvedAt={uresolvedat}, body={uresult}")
    else:
        fail("TEST 6c - Get single report", "no report id to fetch")
        fail("TEST 6d - Resolve report", "no report id to resolve")
    print()

    # ========== TEST 7: Moderation Dashboard ==========
    print("--- Test 7: Moderation Dashboard ---")

    dash = api("GET", f"/guilds/{guildid}/moderation/dashboard?days=7", token=token1)
    draid = dash.get("raidStatus")
    drules = dash.get("activeAutoModRules")
    if draid == "inactive":
        ok("TEST 7a - Dashboard stats", f"rules={drules}, raid={draid}")
    else:
        fail("TEST 7a - Dashboard stats", f"response={dash}")

    actions = api("GET", f"/guilds/{guildid}/moderation/actions?limit=10", token=token1)
    if isinstance(actions, list):
        acount = len(actions)
        ok("TEST 7b - Recent mod actions", f"{acount} actions")
    else:
        fail("TEST 7b - Recent mod actions", f"response={actions}")
    print()

    # ========== TEST 8: Analytics ==========
    print("--- Test 8: Analytics ---")

    analytics = api("GET", f"/guilds/{guildid}/analytics?period=7d", token=token1)
    if isinstance(analytics, list):
        ok("TEST 8a - Daily analytics", "type=array")
    else:
        fail("TEST 8a - Daily analytics", f"got type={type(analytics).__name__}, response={analytics}")

    heatmap = api("GET", f"/guilds/{guildid}/analytics/heatmap?days=7", token=token1)
    if isinstance(heatmap, list):
        ok("TEST 8b - Hourly heatmap", "type=array")
    else:
        fail("TEST 8b - Hourly heatmap", f"got type={type(heatmap).__name__}, response={heatmap}")

    status8, _ = api("GET", f"/guilds/{guildid}/analytics?period=7d", token=token2, return_status=True)
    if status8 == 403:
        ok("TEST 8c - Non-owner analytics forbidden", f"status={status8}")
    else:
        fail("TEST 8c - Non-owner analytics forbidden", f"got {status8}, expected 403")
    print()

    # ========== TEST 9: Keyword Preset Automod ==========
    print("--- Test 9: Keyword Preset Automod ---")

    preset_rule = api("POST", f"/guilds/{guildid}/auto-moderation/rules", token=token1, body={
        "name": "Block Profanity",
        "eventType": "message_send",
        "triggerType": "keyword_preset",
        "triggerMetadata": {"presets": ["profanity"]},
        "actions": [{"type": "block_message"}]
    })
    preset_id = preset_rule.get("id")
    if preset_id:
        ok("TEST 9a - Create preset rule", f"id={preset_id}")
    else:
        fail("TEST 9a - Create preset rule", f"response={preset_rule}")

    status9b, _ = send_message(channelid, token1, "this message has shit in it")
    if status9b == 403:
        ok("TEST 9b - Block profanity preset", f"status={status9b}")
    else:
        fail("TEST 9b - Block profanity preset", f"got {status9b}, expected 403")

    status9c, _ = send_message(channelid, token1, "this message is perfectly clean")
    if status9c == 201:
        ok("TEST 9c - Allow clean message", f"status={status9c}")
    else:
        fail("TEST 9c - Allow clean message", f"got {status9c}, expected 201")

    # Cleanup
    if preset_id:
        api("DELETE", f"/guilds/{guildid}/auto-moderation/rules/{preset_id}", token=token1)
    print()

    # ========== TEST 10: Mention Spam Automod ==========
    print("--- Test 10: Mention Spam Automod ---")

    mention_rule = api("POST", f"/guilds/{guildid}/auto-moderation/rules", token=token1, body={
        "name": "Block Mention Spam",
        "eventType": "message_send",
        "triggerType": "mention_spam",
        "triggerMetadata": {"mentionTotalLimit": 3},
        "actions": [{"type": "block_message"}]
    })
    mentionruleid = mention_rule.get("id")
    if mentionruleid:
        ok("TEST 10a - Create mention spam rule", f"id={mentionruleid}")
    else:
        fail("TEST 10a - Create mention spam rule", f"response={mention_rule}")

    status10b, _ = send_message(channelid, token1, "Hey <@123> <@456> <@789> stop it")
    if status10b == 403:
        ok("TEST 10b - Block mention spam", f"status={status10b}")
    else:
        fail("TEST 10b - Block mention spam", f"got {status10b}, expected 403")

    status10c, _ = send_message(channelid, token1, "Hey <@123> how are you?")
    if status10c == 201:
        ok("TEST 10c - Allow few mentions", f"status={status10c}")
    else:
        fail("TEST 10c - Allow few mentions", f"got {status10c}, expected 201")

    # Cleanup
    if mentionruleid:
        api("DELETE", f"/guilds/{guildid}/auto-moderation/rules/{mentionruleid}", token=token1)
    print()

    # ========== SUMMARY ==========
    print("=" * 50)
    print("Phase 4 Part 3B E2E Test Complete")
    print("=" * 50)
    print()
    print(f"PASSED: {PASS_COUNT}")
    print(f"FAILED: {FAIL_COUNT}")
    print(f"TOTAL:  {PASS_COUNT + FAIL_COUNT}")
    print()
    if FAIL_COUNT == 0:
        print("ALL TESTS PASSED")
    else:
        print(f"SOME TESTS FAILED ({FAIL_COUNT} failures)")

    return FAIL_COUNT

if __name__ == "__main__":
    sys.exit(main())
