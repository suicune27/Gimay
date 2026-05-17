export const defaultScriptCategories = [
  { name: 'Authentication', description: 'Scripts for handling various auth flows', icon: 'key' },
  { name: 'Validation', description: 'Schema and response validation scripts', icon: 'check-circle' },
  { name: 'Data Transformation', description: 'Format and manipulate data payloads', icon: 'refresh-cw' },
  { name: 'Utilities', description: 'Random generators, encoders, and helpers', icon: 'tool' },
];

export const defaultScripts = [
  {
    name: 'Bearer Token Injector',
    description: 'Automatically injects a bearer token from the environment into the request headers.',
    categoryName: 'Authentication',
    content: `// Retrieve the token from environment variables
const token = pm.environment.get('BEARER_TOKEN');

if (token) {
  // Inject the authorization header
  pm.request.headers.push({
    key: 'Authorization',
    value: \`Bearer \${token}\`
  });
  console.log('Bearer token injected successfully.');
} else {
  console.warn('No BEARER_TOKEN found in environment.');
}`,
    variables_used: ['BEARER_TOKEN'],
    version: '1.0.0',
    tags: ['auth', 'jwt', 'bearer']
  },
  {
    name: 'Response Status Checker',
    description: 'Basic assertions to ensure the response status is 200 OK.',
    categoryName: 'Validation',
    content: `pm.test("Status code is 200", function () {
    pm.expect(pm.response.code).to.equal(200);
});

pm.test("Response time is less than 500ms", function () {
    pm.expect(pm.response.responseTime).to.be.below(500);
});`,
    variables_used: [],
    version: '1.0.0',
    tags: ['test', 'performance']
  },
  {
    name: 'Generate UUID',
    description: 'Generates a random v4 UUID and saves it to the environment.',
    categoryName: 'Utilities',
    content: `// Generate a new UUID using the crypto API
const newId = crypto.randomUUID();

// Save it to environment for use in the body or URL (e.g., {{random_id}})
pm.environment.set('random_id', newId);

console.log('Generated new UUID: ' + newId);`,
    variables_used: ['random_id'],
    version: '1.0.0',
    tags: ['uuid', 'random']
  },
  {
    name: 'HMAC Signature Generator',
    description: 'Generates an HMAC SHA-256 signature for the request body.',
    categoryName: 'Authentication',
    content: `// Note: This uses standard Web Crypto API available in the sandbox
async function generateHmac(secret, payload) {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
  );
  const signature = await crypto.subtle.sign('HMAC', key, enc.encode(payload));
  return Array.from(new Uint8Array(signature)).map(b => b.toString(16).padStart(2, '0')).join('');
}

const secret = pm.environment.get('API_SECRET');
if (secret && pm.request.body) {
  const sig = await generateHmac(secret, pm.request.body);
  pm.request.headers.push({ key: 'X-Signature', value: sig });
  console.log('Signature generated:', sig);
}`,
    variables_used: ['API_SECRET'],
    version: '1.0.0',
    tags: ['hmac', 'crypto', 'auth']
  }
];
