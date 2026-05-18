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
  },
  {
    name: 'APIdog HMAC Auth Flow',
    description: 'Complex auth flow with token fetching and HMAC signature calculation (APIdog reference).',
    categoryName: 'Authentication',
    content: `var partnerId = "";
var sessionId = "";
var bearer_token = "";
var hashing_key = "";
var grant_type = "";
var client_id = "";
var client_secret = "";
var scope = "";

var now = new Date();
var get_token_url = "";
var formattedDateTime = now.toLocaleString('en-US', {
    month: '2-digit',
    day: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true
});
	 
formattedDateTime = formattedDateTime.replace(",","");

function ProcessRequest() {
	getAllParams();
    console.log("Token URL:", get_token_url);
    console.log("Grant Type:", grant_type);

	pm.sendRequest({
		url: get_token_url,
		method: 'POST',
		header: {
			'Content-Type': 'application/x-www-form-urlencoded'
		},
		body: {
			mode: 'urlencoded',
			urlencoded: [
				{ key: 'grant_type', value: grant_type },
				{ key: 'client_id', value: client_id },
				{ key: 'client_secret', value: client_secret },
				{ key: 'scope', value: scope }
			]
		}
	}, function (err, res) {
		if (err) {
            console.log("Error fetching token: ", err.toString());
		} else {
			if (res.code === 200) {
				var jsonData = res.json();
				var token = jsonData.access_token;  
			   
				pm.environment.set("bearer_token", "Bearer " + token);
				continueProcess();
			} else {
				console.log("Failed to fetch token. Status Code:", res.code);
			}
		}
	});
}
 
function getAllParams() {
	partnerId = pm.request.headers.get("x-cb-partner-id");
	sessionId = generateUUID(partnerId);
	bearer_token = "";
	hashing_key = pm.environment.get("hashing_key");
	grant_type = pm.environment.get("grant_type");
	client_id = pm.environment.get("client_id");
	client_secret = pm.environment.get("client_secret");
	scope = pm.environment.get("scope");
	get_token_url = pm.environment.get("get_token_url");
	
	pm.environment.set("session_id", sessionId);
	pm.environment.set("request_dt", formattedDateTime);
}
 
function continueProcess() {
    bearer_token =  pm.environment.get("bearer_token");
 
    var message =  
        bearer_token +
        partnerId +
        sessionId +
        formattedDateTime +
        (pm.request.method === "GET" ? "" : pm.request.body.raw);
 
    var secretKey = hashing_key + sessionId.trim();
    // CryptoJS is bundled in the sandbox environment
    var hash = CryptoJS.HmacSHA256(message, secretKey);
    var base64Hash = CryptoJS.enc.Base64.stringify(hash);
    pm.environment.set("signature", base64Hash);
}
 
function generateUUID(pid) {
  return pid + Math.floor(1000000 + Math.random() * 9000000).toString();
}

ProcessRequest();`,
    variables_used: ['hashing_key', 'grant_type', 'client_id', 'client_secret', 'scope', 'get_token_url', 'bearer_token', 'session_id', 'request_dt', 'signature'],
    version: '1.0.0',
    tags: ['apidog', 'auth', 'hmac', 'token']
  }
];
