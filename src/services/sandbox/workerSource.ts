export const WORKER_SOURCE = `
  try {
    importScripts('https://cdnjs.cloudflare.com/ajax/libs/crypto-js/4.1.1/crypto-js.min.js');
  } catch (e) {
    // Fail silently if offline or blocked
  }

  let logs = [];
  let testResults = [];
  let changedVariables = {};
  let changedEnvironment = {};

  const consoleMock = {
    log: (...args) => {
      logs.push({ level: 'log', message: args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' ') });
    },
    info: (...args) => {
      logs.push({ level: 'info', message: args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' ') });
    },
    warn: (...args) => {
      logs.push({ level: 'warn', message: args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' ') });
    },
    error: (...args) => {
      logs.push({ level: 'error', message: args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' ') });
    }
  };

  let currentScriptState = null;

  self.onmessage = async (e) => {
    if (!e.data) return;
    let { type, code, context, id, data, error, runtimeId } = e.data;

    if (type === 'coordination_response') {
      const respRuntimeId = e.data.runtimeId;
      if (respRuntimeId && currentScriptState && currentScriptState.activeRuntimeId !== respRuntimeId) return;
      if (currentScriptState) currentScriptState.handleCoordination(id, data, error);
      return;
    }

    if (type === 'ping') { self.postMessage({ type: 'pong' }); return; }
    if (!context) return;

    logs = []; testResults = []; changedVariables = {}; changedEnvironment = {};

    let vars = { ...context.variables || {} };
    let envVars = { ...context.environmentVariables || {} };

    let variableStore = {
      get: (key) => vars[key],
      set: (key, value) => { vars[key] = value; changedVariables[key] = value; },
      has: (key) => key in vars,
      unset: (key) => { delete vars[key]; changedVariables[key] = null; },
      clear: () => {
        for (const k in vars) { changedVariables[k] = null; }
        Object.keys(vars).forEach(k => delete vars[k]);
      }
    };

    let environmentStore = {
      get: (key) => envVars[key],
      set: (key, value) => { envVars[key] = value; changedEnvironment[key] = value; vars[key] = value; },
      has: (key) => key in envVars,
      unset: (key) => { delete envVars[key]; changedEnvironment[key] = null; delete vars[key]; },
      clear: () => {
        for (const k in envVars) { changedEnvironment[k] = null; delete vars[k]; }
        Object.keys(envVars).forEach(k => delete envVars[k]);
      }
    };

    let activeAsyncRequests = 0;
    let messageId = 0;
    let pendingResolvers = new Map();

    let sendToMain = (action, actionData) => {
      return new Promise((resolve, reject) => {
        const msgId = messageId++;
        pendingResolvers.set(msgId, { resolve, reject });
        self.postMessage({ type: 'coordination', action, id: msgId, data: actionData, runtimeId });
      });
    };

    currentScriptState = {
      activeRuntimeId: runtimeId,
      handleCoordination: (msgId, msgData, msgError) => {
        const resolver = pendingResolvers.get(msgId);
        if (resolver) {
          pendingResolvers.delete(msgId);
          if (msgError) resolver.reject(new Error(msgError));
          else resolver.resolve(msgData);
        }
      }
    };

    let requestHeaders = context.request?.headers || [];
    let headersMap = new Map();
    if (Array.isArray(requestHeaders)) {
      requestHeaders.forEach(h => {
        if (h && typeof h === 'object' && h.active !== false) headersMap.set((h.key || '').toLowerCase(), h.value || '');
      });
    } else if (requestHeaders && typeof requestHeaders === 'object') {
      Object.entries(requestHeaders).forEach(([k, v]) => headersMap.set(k.toLowerCase(), String(v || '')));
    }

    let requestFunc = async (opts) => await sendToMain('request', opts);
    requestFunc.method = context.request?.method || 'GET';
    requestFunc.url = context.request?.url || '';
    requestFunc.body = { raw: typeof context.request?.body === 'object' ? JSON.stringify(context.request?.body) : String(context.request?.body || '') };
    requestFunc.headers = {
      get: (key) => headersMap.get(String(key || '').toLowerCase()) || '',
      add: (headerObj) => { if (headerObj && headerObj.key) headersMap.set(String(headerObj.key).toLowerCase(), String(headerObj.value || '')); },
      remove: (key) => { if (key) headersMap.delete(String(key).toLowerCase()); },
      upsert: (headerObj) => { if (headerObj && headerObj.key) headersMap.set(String(headerObj.key).toLowerCase(), String(headerObj.value || '')); }
    };

    let gmy = {
      environment: environmentStore,
      collectionVariables: variableStore,
      globals: variableStore,
      variables: variableStore,
      request: requestFunc,
      sendRequest: (opts, callback) => {
        activeAsyncRequests++;
        sendToMain('request', opts)
          .then((res) => {
            const compatResponse = {
              code: res.status, status: res.statusText,
              headers: { get: (key) => res.headers?.[key] || res.headers?.[key.toLowerCase()] },
              json: () => { try { return typeof res.body === 'string' ? JSON.parse(res.body) : res.body; } catch (e) { return null; } },
              text: () => typeof res.body === 'object' ? JSON.stringify(res.body) : String(res.body),
              toString: () => typeof res.body === 'object' ? JSON.stringify(res.body) : String(res.body)
            };
            try { if (callback) callback(null, compatResponse); } catch (err) { consoleMock.error("Callback error: " + err.message); }
            finally { activeAsyncRequests--; }
          })
          .catch((err) => {
            try { if (callback) callback(err, null); } catch (cbErr) { consoleMock.error("Callback error: " + cbErr.message); }
            finally { activeAsyncRequests--; }
          });
      },
      import: async (identifier) => {
        const scriptContent = await sendToMain('import', identifier);
        return async () => { await eval("(async () => {" + scriptContent + "})()"); };
      },
      response: {
        code: context.response?.status,
        status: context.response?.statusText,
        headers: { get: (key) => context.response?.headers?.[key] || context.response?.headers?.[key.toLowerCase()] },
        responseTime: context.response?.time,
        responseSize: context.response?.size,
        json: () => { try { return typeof context.response?.body === 'string' ? JSON.parse(context.response?.body) : context.response?.body; } catch (e) { return null; } }
      },
      test: (name, fn) => {
        try {
          const res = fn();
          if (res instanceof Promise) { testResults.push(res.then(() => ({ name, status: 'pass' })).catch(err => ({ name, status: 'fail', message: err.message }))); }
          else { testResults.push({ name, status: 'pass' }); }
        } catch (error) { testResults.push({ name, status: 'fail', message: error.message }); }
      },
      expect: (val) => {
        const assertion = {
          to: {
            equal: (expected) => { if (val !== expected) throw new Error("Expected " + JSON.stringify(val) + " to equal " + JSON.stringify(expected)); return assertion; },
            not: {
              equal: (expected) => { if (val === expected) throw new Error("Expected " + JSON.stringify(val) + " NOT to equal " + JSON.stringify(expected)); return assertion; },
              include: (item) => { if ((Array.isArray(val) || typeof val === 'string') && val.includes(item)) throw new Error("Expected " + JSON.stringify(val) + " NOT to include " + JSON.stringify(item)); return assertion; }
            },
            be: {
              a: (type) => { if (typeof val !== type) throw new Error("Expected value to be a " + type + ", but got " + typeof val); return assertion; },
              an: (type) => assertion.to.be.a(type),
              below: (limit) => { if (val >= limit) throw new Error("Expected " + val + " to be below " + limit); return assertion; },
              above: (limit) => { if (val <= limit) throw new Error("Expected " + val + " to be above " + limit); return assertion; },
              true: () => { if (val !== true) throw new Error("Expected " + val + " to be true"); return assertion; },
              false: () => { if (val !== false) throw new Error("Expected " + val + " to be false"); return assertion; },
              null: () => { if (val !== null) throw new Error("Expected " + val + " to be null"); return assertion; }
            },
            include: (item) => {
              if (Array.isArray(val) || typeof val === 'string') { if (!val.includes(item)) throw new Error("Expected " + JSON.stringify(val) + " to include " + JSON.stringify(item)); }
              else if (val && typeof val === 'object') { if (!Object.keys(val).includes(item)) throw new Error("Expected object to include key " + item); }
              else throw new Error("Target is not include-compatible");
              return assertion;
            },
            have: {
              property: (prop) => { if (!val || typeof val !== 'object' || !(prop in val)) throw new Error("Expected object to have property \\"" + prop + "\\""); return assertion; },
              status: (code) => { if (gmy.response.code !== code) throw new Error("Expected status " + code + " but got " + gmy.response.code); return assertion; }
            }
          }
        };
        return assertion;
      }
    };

    let pm = gmy;
    let gimay = gmy;
    let putman = gmy;
    let console = consoleMock;

    class Script {
      constructor(name) { this.name = name; }
      async Run() {
        const scriptContent = await sendToMain('import', this.name);
        let processedContent = scriptContent || '';
        processedContent = processedContent.replace(/new\\\\s*\\\\(\\\\s*(['"\\\`])(.*?)\\\\1\\\\s*\\\\)/g, 'new Script("$2")');
        await eval("(async () => {" + processedContent + "})()");
      }
    }

    try {
      let processedCode = code || '';
      processedCode = processedCode.replace(/new\\\\s*\\\\(\\\\s*(['"\\\`])(.*?)\\\\1\\\\s*\\\\)/g, 'new Script("$2")');
      const asyncScript = \`(async () => {
        \${processedCode}
      })()\`;

      await eval(asyncScript);

      let waitTime = 0;
      while (activeAsyncRequests > 0 && waitTime < 10000) {
        await new Promise((resolve) => setTimeout(resolve, 50));
        waitTime += 50;
      }

      const resolvedTests = [];
      for (const t of testResults) {
        if (t instanceof Promise) resolvedTests.push(await t);
        else resolvedTests.push(t);
      }

      self.postMessage({
        type: 'result', runtimeId, logs, testResults: resolvedTests,
        changedVariables, changedEnvironment,
        changedRequest: {
          method: requestFunc.method, url: requestFunc.url, body: requestFunc.body.raw,
          headers: Array.from(headersMap.entries()).map(([k, v]) => ({ key: k, value: v, active: true }))
        }
      });
    } catch (e) {
      logs.push({ level: 'error', message: e.message });
      self.postMessage({
        type: 'result', runtimeId, logs, testResults: [],
        changedVariables, changedEnvironment,
        changedRequest: {
          method: requestFunc.method, url: requestFunc.url, body: requestFunc.body.raw,
          headers: Array.from(headersMap.entries()).map(([k, v]) => ({ key: k, value: v, active: true }))
        },
        error: e.message
      });
    } finally {
      currentScriptState = null;
      logs = []; testResults = []; changedVariables = {}; changedEnvironment = {};
      if (pendingResolvers) { pendingResolvers.clear(); pendingResolvers = null; }
      vars = null; envVars = null; variableStore = null; environmentStore = null;
      sendToMain = null; requestHeaders = null;
      if (headersMap) { headersMap.clear(); headersMap = null; }
      requestFunc = null; gmy = null; pm = null; gimay = null; putman = null; console = null; context = null;
    }
  };
`;
