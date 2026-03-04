const baseUrl = 'http://localhost:3000';

async function request(method, path, body) {
  const url = `${baseUrl}${path}`;
  const options = {
    method,
    headers: { 'Content-Type': 'application/json' }
  };
  if (body !== undefined) options.body = JSON.stringify(body);

  const res = await fetch(url, options);
  const text = await res.text();
  let bodyJson = null;
  try {
    bodyJson = text ? JSON.parse(text) : null;
  } catch (_) {}

  return { status: res.status, text, body: bodyJson };
}

function test(name, method, path, body, expectedStatus, extraCheck) {
  return async () => {
    try {
      const { status, body: resBody, text } = await request(method, path, body);
      const ok = status === expectedStatus && (!extraCheck || extraCheck(resBody));
      console.log(ok ? `  OK  ${name}` : `  FAIL ${name} (expected ${expectedStatus}, got ${status})`);
      if (!ok) console.log('      Response:', text || resBody);
      if (extraCheck && status === expectedStatus && !extraCheck(resBody)) console.log('      Check failed:', resBody);
      return { ok, status, body: resBody };
    } catch (err) {
      console.log(`  FAIL ${name} (${err.message})`);
      return { ok: false, error: err.message };
    }
  };
}

async function run() {
  console.log('\n--- Route tests ---\n');

  // --- Health & users list ---
  await test('GET / (health)', 'GET', '/', undefined, 200)();
  await test('GET /users (list)', 'GET', '/users', undefined, 200, (b) => Array.isArray(b))();

  // --- Register & login ---
  const uniqueEmail = `test_${Date.now()}@example.com`;
  const password = 'Passw0rd!';
  const reg = await test('POST /users/register', 'POST', '/users/register', {
    name: 'Test User',
    email: uniqueEmail,
    password
  }, 201, (b) => b && b._id && b.email === uniqueEmail)();

  if (!reg.body || !reg.body._id) {
    console.log('\nAborting: could not create user.');
    return;
  }
  const userId = reg.body._id;

  await test('POST /users/login', 'POST', '/users/login', { email: uniqueEmail, password }, 200, (b) => b && b._id)();

  // --- Error: login wrong password ---
  await test('POST /users/login (wrong password → 401)', 'POST', '/users/login', { email: uniqueEmail, password: 'Wrong!' }, 401)();

  // --- Error: register duplicate email ---
  await test('POST /users/register (duplicate email → 400)', 'POST', '/users/register', { name: 'A', email: uniqueEmail, password }, 400)();

  // --- User profile & update ---
  await test('GET /users/:id', 'GET', `/users/${userId}`, undefined, 200, (b) => b && b._id === userId)();
  await test('PATCH /users/:id', 'PATCH', `/users/${userId}`, { name: 'Updated Name' }, 200, (b) => b && b.name === 'Updated Name')();

  // --- Error: invalid user id ---
  await test('GET /users/:id (invalid id → 400)', 'GET', '/users/invalid', undefined, 400)();

  // --- Biometrics ---
  await test('PUT /users/:id/biometrics', 'PUT', `/users/${userId}/biometrics`, {
    age: 30,
    sex: 'female',
    heightIn: 65,
    weightLbs: 140
  }, 200, (b) => b && b.biometrics && b.biometrics.weightLbs === 140)();

  // --- Progress ---
  await test('POST /users/:id/progress', 'POST', `/users/${userId}/progress`, { date: '2025-03-01', weightLbs: 139, notes: 'Weekly check' }, 201, (b) => b && b._id && b.date)();
  await test('GET /users/:id/progress', 'GET', `/users/${userId}/progress`, undefined, 200, (b) => Array.isArray(b))();
  await test('GET /users/:id/progress?from=2025-03-01&to=2025-03-31', 'GET', `/users/${userId}/progress?from=2025-03-01&to=2025-03-31`, undefined, 200, (b) => Array.isArray(b))();

  // --- Meals ---
  await test('POST /users/:id/meals', 'POST', `/users/${userId}/meals`, { mealType: 'lunch', description: 'Salad and soup', calories: 350 }, 201, (b) => b && b._id && b.mealType === 'lunch')();
  await test('GET /users/:id/meals', 'GET', `/users/${userId}/meals`, undefined, 200, (b) => Array.isArray(b))();

  // --- Goals: create ---
  const goalPayload = { userId, type: 'weight', target: 130, description: 'Reach target weight' };
  const createGoal = await test('POST /goals', 'POST', '/goals', goalPayload, 201, (b) => b && b._id && b.type === 'weight')();

  if (!createGoal.body || !createGoal.body._id) {
    console.log('\nAborting: could not create goal.');
    return;
  }
  const goalId = createGoal.body._id;

  await test('GET /goals/user/:userId', 'GET', `/goals/user/${userId}`, undefined, 200, (b) => Array.isArray(b) && b.length >= 1)();
  await test('GET /goals/user/:userId?status=active', 'GET', `/goals/user/${userId}?status=active`, undefined, 200, (b) => Array.isArray(b))();
  await test('GET /goals/:id', 'GET', `/goals/${goalId}`, undefined, 200, (b) => b && b._id === goalId)();

  // --- Error: invalid goal id ---
  await test('GET /goals/:id (invalid id → 400)', 'GET', '/goals/invalid', undefined, 400)();

  await test('PATCH /goals/:id', 'PATCH', `/goals/${goalId}`, { description: 'Updated goal description', target: 128 }, 200, (b) => b && b.description === 'Updated goal description')();

  await test('PUT /goals/:id/plan', 'PUT', `/goals/${goalId}/plan`, { summary: 'Manual plan', weeklySchedule: [], tips: ['Stay consistent'] }, 200, (b) => b && b.plan)();

  // POST /goals/:id/plan/ai requires GEMINI_API_KEY; expect 503 if not set, 200 if set
  const aiRes = await request('POST', `/goals/${goalId}/plan/ai`, undefined);
  const aiOk = aiRes.status === 200 || aiRes.status === 503;
  console.log(aiOk ? '  OK  POST /goals/:id/plan/ai (200 or 503)' : `  FAIL POST /goals/:id/plan/ai (got ${aiRes.status})`);

  await test('DELETE /goals/:id', 'DELETE', `/goals/${goalId}`, undefined, 200, (b) => b && b.deleted === true)();

  // --- 404 ---
  await test('GET unknown route → 404', 'GET', '/unknown/route', undefined, 404, (b) => b && b.error)();

  console.log('\n--- Done ---\n');
}

run().catch((err) => {
  console.error('Run failed:', err);
});
