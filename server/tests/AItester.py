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
        with opener.open(req, timeout=10) as resp:
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


email = f"aitester_{uuid.uuid4().hex[:8]}@example.com"
password = "Testing1234"
name = "AI Tester"
updated_name = "AI Tester Updated"
user_id = None

#1 Test if the server is reachable
try:
    status, headers, body = request("GET", "/")
    if status == 200:
        mark_pass("Test 1 - GET / works")
    else:
        mark_fail("Test 1 - GET / works", f"Expected 200, got {status}")
except Exception as e:
    mark_fail("Test 1 - GET / works", str(e))

#2 Does profile.html load
try:
    status, headers, body = request("GET", "/profile.html")
    if status == 200:
        mark_pass("Test 2 - GET /profile.html works")
    else:
        mark_fail("Test 2 - GET /profile.html works", f"Expected 200, got {status}")
except Exception as e:
    mark_fail("Test 2 - GET /profile.html works", str(e))

#3 /users returns something with JSON in it
try:
    status, headers, body = request("GET", "/users")
    data = parse_json(body)
    if status == 200 and isinstance(data, list):
        mark_pass("Test 3 - GET /users returns array")
    else:
        mark_fail("Test 3 - GET /users returns array", f"Status: {status}")
except Exception as e:
    mark_fail("Test 3 - GET /users returns array", str(e))

#4 Registering a new user test
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
        mark_pass("Test 4 - Register user works")
    else:
        mark_fail("Test 4 - Register user works")
except Exception as e:
    mark_fail("Test 4 - Register user works", str(e))

#5 Valid login redirects to profile with user id
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
        mark_pass("Test 5 - Login works and gives profile id")
    else:
        mark_fail("Test 5 - Login works and gives profile id")
except Exception as e:
    mark_fail("Test 5 - Login works and gives profile id", str(e))

#6 Is a bad login properly rejected?
try:
    status, headers, body = form_request(
        "POST",
        "/users/login",
        {
            "email": email,
            "password": "WrongPassword123"
        }
    )
    data = parse_json(body)
    if status == 401 and isinstance(data, dict) and "error" in data:
        mark_pass("Test 6 - Bad login is rejected")
    else:
        mark_fail("Test 6 - Bad login is rejected", f"Status: {status}")
except Exception as e:
    mark_fail("Test 6 - Bad login is rejected", str(e))

#7 Can we fetch a logged in user's info
try:
    if not user_id:
        mark_skip("Test 7 - GET /users/:id works", "No user_id from login test")
    else:
        status, headers, body = request("GET", f"/users/{user_id}")
        data = parse_json(body)
        if status == 200 and isinstance(data, dict):
            mark_pass("Test 7 - GET /users/:id works")
        else:
            mark_fail("Test 7 - GET /users/:id works", f"Status: {status}")
except Exception as e:
    mark_fail("Test 7 - GET /users/:id works", str(e))

#8 Profile data contains the correct email
try:
    if not user_id:
        mark_skip("Test 8 - Profile has correct email", "No user_id from login test")
    else:
        status, headers, body = request("GET", f"/users/{user_id}")
        data = parse_json(body)
        if status == 200 and isinstance(data, dict) and data.get("email") == email.lower():
            mark_pass("Test 8 - Profile has correct email")
        else:
            mark_fail("Test 8 - Profile has correct email", f"Returned email: {data.get('email') if isinstance(data, dict) else 'N/A'}")
except Exception as e:
    mark_fail("Test 8 - Profile has correct email", str(e))

# 9. Update name works
try:
    if not user_id:
        mark_skip("Test 9 - /users/:id updates name", "No user_id from login test")
    else:
        status, headers, body = json_request("PATCH", f"/users/{user_id}", {"name": updated_name})
        data = parse_json(body)
        if status == 200 and isinstance(data, dict) and data.get("name") == updated_name:
            mark_pass("Test 9 - /users/:id properly updates name")
        else:
            mark_fail("Test 9 - /users/:id properly updates name", f"Status: {status}")
except Exception as e:
    mark_fail("Test 9 - /users/:id updates name", str(e))

# 10. Testing for the ability to update biometrics (profile data).
try:
    if not user_id:
        mark_skip("Test 10 - PUT /users/:id/biometrics works", "No user_id from login test")
    else:
        biometrics = {
            "age": 22,
            "sex": "male",
            "heightIn": 70,
            "weightLbs": 155,
            "goalWeightLbs": 165,
            "activityLevel": "moderate",
            "medicalConditions": [],
            "dietaryPreferences": {"vegetarian": False, "vegan": False},
            "injuriesOrLimitations": [],
            "sleepHoursPerNight": 7
        }
        status, headers, body = json_request("PUT", f"/users/{user_id}/biometrics", biometrics)
        data = parse_json(body)
        if status == 200 and isinstance(data, dict) and isinstance(data.get("biometrics"), dict):
            mark_pass("Test 10 - PUT /users/:id/biometrics works")
        else:
            mark_fail("Test 10 - PUT /users/:id/biometrics works", f"Status: {status}")
except Exception as e:
    mark_fail("Test 10 - PUT /users/:id/biometrics works", str(e))

print(f"\nPassed: {passes}")
print(f"Failed: {fails}")