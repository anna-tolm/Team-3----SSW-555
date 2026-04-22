import json
import re
import uuid
import urllib.request
import urllib.parse
import urllib.error


class NoRedirectHandler(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        return None


def request(method, path, data=None, content_type=None):
    url = "http://localhost:3000" + path
    headers = {}

    if data is not None and content_type is not None:
        headers["Content-Type"] = content_type

    req = urllib.request.Request(url, data=data, headers=headers, method=method)
    opener = urllib.request.build_opener(NoRedirectHandler)

    try:
        with opener.open(req, timeout=20) as resp:
            body = resp.read().decode("utf-8", "replace")
            return resp.status, dict(resp.headers), body
    except urllib.error.HTTPError as e:
        body = e.read().decode("utf-8", "replace")
        return e.code, dict(e.headers), body


def form_request(method, path, form_dict):
    data = urllib.parse.urlencode(form_dict).encode("utf-8")
    return request(method, path, data, "application/x-www-form-urlencoded")


def json_request(method, path, obj):
    data = json.dumps(obj).encode("utf-8")
    return request(method, path, data, "application/json")


def parse_json(text):
    try:
        return json.loads(text)
    except Exception:
        return None


def extract_user_id(location):
    if not location:
        return None
    match = re.search(r"/profile\.html\?id=([^&]+)", location)
    if match:
        return urllib.parse.unquote(match.group(1))
    return None


def print_result(name, status, details=""):
    print(f"{status}: {name}")
    if details:
        print(f"   {details}")


passes = 0
fails = 0
skip_count = 0


def mark_pass(name, details=""):
    global passes
    passes += 1
    print_result(name, "PASS", details)


def mark_fail(name, details=""):
    global fails
    fails += 1
    print_result(name, "FAIL", details)


def mark_skip(name, details=""):
    global skip_count
    skip_count += 1
    print_result(name, "SKIP", details)


email = f"aifeature_{uuid.uuid4().hex[:8]}@example.com"
password = "Testing1234"
name = "AI Feature Tester"
user_id = None
created_goal_id = None


# 1. Create-goal page loads
try:
    status, headers, body = request("GET", "/create-goal.html")
    if status == 200:
        mark_pass("Test 1 - GET /create-goal.html works")
    else:
        mark_fail("Test 1 - GET /create-goal.html works", f"Expected 200, got {status}")
except Exception as e:
    mark_fail("Test 1 - GET /create-goal.html works", str(e))


# 2. Chat page loads
try:
    status, headers, body = request("GET", "/chat/chat.html")
    if status == 200:
        mark_pass("Test 2 - GET /chat/chat.html works")
    else:
        mark_fail("Test 2 - GET /chat/chat.html works", f"Expected 200, got {status}")
except Exception as e:
    mark_fail("Test 2 - GET /chat/chat.html works", str(e))


# 3. Register a temporary user for AI tests
try:
    status, headers, body = form_request(
        "POST",
        "/users/register",
        {
            "name": name,
            "email": email,
            "password": password,
            "confirmPassword": password
        }
    )
    location = headers.get("Location")
    if status in (201, 302, 303) and location and "/login.html" in location:
        mark_pass("Test 3 - Register temp user works")
    else:
        mark_fail("Test 3 - Register temp user works", f"Status: {status}")
except Exception as e:
    mark_fail("Test 3 - Register temp user works", str(e))


# 4. Login and capture user id
try:
    status, headers, body = form_request(
        "POST",
        "/users/login",
        {
            "email": email,
            "password": password
        }
    )
    location = headers.get("Location")
    user_id = extract_user_id(location)
    if status in (302, 303) and user_id:
        mark_pass("Test 4 - Login works for AI test user")
    else:
        mark_fail("Test 4 - Login works for AI test user", f"Status: {status}")
except Exception as e:
    mark_fail("Test 4 - Login works for AI test user", str(e))


# 5. Chat API rejects missing message
try:
    if not user_id:
        mark_skip("Test 5 - AI chat requires message", "No user_id from login test")
    else:
        status, headers, body = json_request("POST", "/api/health-coach/chat", {"userId": user_id})
        data = parse_json(body)
        if status == 400 and isinstance(data, dict) and "error" in data:
            mark_pass("Test 5 - AI chat requires message")
        else:
            mark_fail("Test 5 - AI chat requires message", f"Status: {status}")
except Exception as e:
    mark_fail("Test 5 - AI chat requires message", str(e))


# 6. Chat API accepts a valid request and returns the standard response shape
try:
    if not user_id:
        mark_skip("Test 6 - AI chat returns response payload", "No user_id from login test")
    else:
        status, headers, body = json_request(
            "POST",
            "/api/health-coach/chat",
            {
                "userId": user_id,
                "message": "Give me one short healthy snack idea."
            }
        )
        data = parse_json(body)
        if (
            status == 200
            and isinstance(data, dict)
            and isinstance(data.get("success"), bool)
            and isinstance(data.get("message"), str)
        ):
            mark_pass("Test 6 - AI chat returns response payload")
        else:
            mark_fail("Test 6 - AI chat returns response payload", f"Status: {status}")
except Exception as e:
    mark_fail("Test 6 - AI chat returns response payload", str(e))


# 7. Create-goal API rejects missing user id
try:
    status, headers, body = json_request(
        "POST",
        "/api/health-coach/create-goal",
        {"message": "Build me a simple weekly walking plan."}
    )
    data = parse_json(body)
    if status == 400 and isinstance(data, dict) and "error" in data:
        mark_pass("Test 7 - AI create-goal requires userId")
    else:
        mark_fail("Test 7 - AI create-goal requires userId", f"Status: {status}")
except Exception as e:
    mark_fail("Test 7 - AI create-goal requires userId", str(e))


# 8. Create-goal API accepts a valid request and returns the standard response shape
try:
    if not user_id:
        mark_skip("Test 8 - AI create-goal returns response payload", "No user_id from login test")
    else:
        status, headers, body = json_request(
            "POST",
            "/api/health-coach/create-goal",
            {
                "userId": user_id,
                "message": "Make me a simple beginner goal for walking three times this week."
            }
        )
        data = parse_json(body)
        if (
            status == 200
            and isinstance(data, dict)
            and isinstance(data.get("success"), bool)
            and isinstance(data.get("message"), str)
            and "goalJson" in data
        ):
            mark_pass("Test 8 - AI create-goal returns response payload")
        else:
            mark_fail("Test 8 - AI create-goal returns response payload", f"Status: {status}")
except Exception as e:
    mark_fail("Test 8 - AI create-goal returns response payload", str(e))


# 9. Manual goal creation works as a simple miscellaneous goal test
try:
    if not user_id:
        mark_skip("Test 9 - POST /goals works", "No user_id from login test")
    else:
        goal_payload = {
            "userId": user_id,
            "type": "fitness",
            "target": "Walk 3 times this week",
            "description": "Simple manual goal used for endpoint testing.",
            "weeklyPlan": {
                "sunday": "Rest",
                "monday": "Walk for 20 minutes",
                "tuesday": "Stretch for 10 minutes",
                "wednesday": "Walk for 20 minutes",
                "thursday": "Rest",
                "friday": "Walk for 20 minutes",
                "saturday": "Light stretching"
            }
        }
        status, headers, body = json_request("POST", "/goals", goal_payload)
        data = parse_json(body)
        if status == 201 and isinstance(data, dict) and data.get("userId") == user_id:
            created_goal_id = data.get("_id")
            mark_pass("Test 9 - POST /goals works")
        else:
            mark_fail("Test 9 - POST /goals works", f"Status: {status}")
except Exception as e:
    mark_fail("Test 9 - POST /goals works", str(e))


# 10. Fetching the user's goals returns an array and includes the created goal
try:
    if not user_id:
        mark_skip("Test 10 - GET /goals/user/:userId works", "No user_id from login test")
    else:
        status, headers, body = request("GET", f"/goals/user/{user_id}")
        data = parse_json(body)
        found_goal = isinstance(data, list) and any(goal.get("_id") == created_goal_id for goal in data if isinstance(goal, dict))
        if status == 200 and isinstance(data, list) and (created_goal_id is None or found_goal):
            mark_pass("Test 10 - GET /goals/user/:userId works")
        else:
            mark_fail("Test 10 - GET /goals/user/:userId works", f"Status: {status}")
except Exception as e:
    mark_fail("Test 10 - GET /goals/user/:userId works", str(e))


print(f"\nPassed: {passes}")
print(f"Failed: {fails}")
print(f"Skipped: {skip_count}")
