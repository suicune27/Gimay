// Completion provider for Gimay / GMY API
export const registerPutmanCompletions = (monaco: any) => {
  monaco.languages.registerCompletionItemProvider('javascript', {
    provideCompletionItems: (model: any, position: any) => {
      const word = model.getWordUntilPosition(position);
      const range = {
        startLineNumber: position.lineNumber,
        endLineNumber: position.lineNumber,
        startColumn: word.startColumn,
        endColumn: word.endColumn,
      };

      const suggestions: any[] = [];

      // Global variable suggestion objects
      ['gmy', 'gimay', 'pm'].forEach((globalVar) => {
        suggestions.push(
          {
            label: globalVar,
            kind: monaco.languages.CompletionItemKind.Variable,
            documentation: `The global ${globalVar.toUpperCase()} script utility engine`,
            insertText: globalVar,
            range,
          },
          {
            label: `${globalVar}.sendRequest`,
            kind: monaco.languages.CompletionItemKind.Function,
            documentation: 'Asynchronously execute an HTTP request with callback.',
            insertText: `${globalVar}.sendRequest({\n  url: "\${1:url}",\n  method: "\${2:POST}",\n  header: {\n    'Content-Type': 'application/json'\n  },\n  body: {\n    mode: 'raw',\n    raw: JSON.stringify({\n      \${3:key}: "\${4:value}"\n    })\n  }\n}, function (err, res) {\n  if (err) {\n    console.error(err);\n  } else {\n    console.log(res.json());\n  }\n});`,
            insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
            range,
          },
          {
            label: `${globalVar}.environment.get`,
            kind: monaco.languages.CompletionItemKind.Method,
            documentation: 'Retrieve a key from the active Environment variables.',
            insertText: `${globalVar}.environment.get("\${1:key}")`,
            insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
            range,
          },
          {
            label: `${globalVar}.environment.set`,
            kind: monaco.languages.CompletionItemKind.Method,
            documentation: 'Store a key/value pair in the active Environment variables.',
            insertText: `${globalVar}.environment.set("\${1:key}", "\${2:value}")`,
            insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
            range,
          },
          {
            label: `${globalVar}.globals.get`,
            kind: monaco.languages.CompletionItemKind.Method,
            documentation: 'Retrieve a key from Global variables.',
            insertText: `${globalVar}.globals.get("\${1:key}")`,
            insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
            range,
          },
          {
            label: `${globalVar}.globals.set`,
            kind: monaco.languages.CompletionItemKind.Method,
            documentation: 'Store a key/value pair in Global variables.',
            insertText: `${globalVar}.globals.set("\${1:key}", "\${2:value}")`,
            insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
            range,
          },
          {
            label: `${globalVar}.variables.get`,
            kind: monaco.languages.CompletionItemKind.Method,
            documentation: 'Retrieve a variable from the resolved scope hierarchy.',
            insertText: `${globalVar}.variables.get("\${1:key}")`,
            insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
            range,
          },
          {
            label: `${globalVar}.variables.set`,
            kind: monaco.languages.CompletionItemKind.Method,
            documentation: 'Set a variable in the local execution scope.',
            insertText: `${globalVar}.variables.set("\${1:key}", "\${2:value}")`,
            insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
            range,
          },
          {
            label: `${globalVar}.test`,
            kind: monaco.languages.CompletionItemKind.Function,
            documentation: 'Write test specifications for validating responses.',
            insertText: `${globalVar}.test("\${1:Status code is 200}", function () {\n  ${globalVar}.expect(${globalVar}.response.code).to.equal(200);\n});`,
            insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
            range,
          },
          {
            label: `${globalVar}.expect`,
            kind: monaco.languages.CompletionItemKind.Method,
            documentation: 'Assert response values and body content.',
            insertText: `${globalVar}.expect(\${1:value}).to.equal(\${2:expected});`,
            insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
            range,
          }
        );
      });

      // CryptoJS Snippets
      suggestions.push(
        {
          label: 'CryptoJS.HmacSHA256',
          kind: monaco.languages.CompletionItemKind.Function,
          documentation: 'Generate HmacSHA256 hash using CryptoJS library.',
          insertText: 'CryptoJS.HmacSHA256(${1:message}, ${2:secretKey})',
          insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
          range,
        },
        {
          label: 'CryptoJS.enc.Base64.stringify',
          kind: monaco.languages.CompletionItemKind.Function,
          documentation: 'Stringify an object into Base64 format.',
          insertText: 'CryptoJS.enc.Base64.stringify(${1:hash})',
          insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
          range,
        }
      );

      return { suggestions };
    },
  });

  // Hover Provider for documentation lookup
  monaco.languages.registerHoverProvider('javascript', {
    provideHover: (model: any, position: any) => {
      const line = model.getLineContent(position.lineNumber);
      
      const matched = line.match(/(gmy|gimay|pm)\.(sendRequest|environment\.set|environment\.get|test|expect)/);
      if (matched) {
        const prefix = matched[1];
        const method = matched[2];
        
        switch (method) {
          case 'sendRequest':
            return {
              contents: [
                { value: `**${prefix}.sendRequest(options, callback)**` },
                { value: 'Executes an asynchronous network call within scripts.' },
                { value: '```javascript\n' + prefix + '.sendRequest({\n  url: "https://api.example.com",\n  method: "POST",\n  header: { "Content-Type": "application/json" },\n  body: { mode: "raw", raw: "{}" }\n}, (err, res) => {\n  console.log(res.code);\n});\n```' }
              ]
            };
          case 'environment.set':
            return {
              contents: [
                { value: `**${prefix}.environment.set(key, value)**` },
                { value: 'Persists an environment variable in the active environment.' }
              ]
            };
          case 'environment.get':
            return {
              contents: [
                { value: `**${prefix}.environment.get(key)**` },
                { value: 'Gets an environment variable value from the active environment.' }
              ]
            };
          case 'test':
            return {
              contents: [
                { value: `**${prefix}.test(name, fn)**` },
                { value: 'Creates a named validation test for execution evaluation.' }
              ]
            };
          case 'expect':
            return {
              contents: [
                { value: `**${prefix}.expect(val)**` },
                { value: 'Starts a chainable BDD assertions list.' }
              ]
            };
        }
      }
      return null;
    }
  });
};
