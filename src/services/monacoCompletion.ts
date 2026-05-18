// Completion provider for new gmy.* namespace, pm.*, and putman.* APIs

export const registerPutmanCompletions = (monaco: any) => {
  const namespaces = ['gmy', 'pm', 'putman'];

  const completionProvider = monaco.languages.registerCompletionItemProvider('javascript', {
    provideCompletionItems: (model, position) => {
      const word = model.getWordUntilPosition(position);
      const range = {
        startLineNumber: position.lineNumber,
        endLineNumber: position.lineNumber,
        startColumn: word.startColumn,
        endColumn: word.endColumn,
      };

      const suggestions: any[] = [];

      namespaces.forEach(ns => {
        suggestions.push(
          {
            label: ns,
            kind: monaco.languages.CompletionItemKind.Variable,
            documentation: `The global ${ns.toUpperCase()} API object`,
            insertText: ns,
            range,
          },
          {
            label: `${ns}.request`,
            kind: monaco.languages.CompletionItemKind.Function,
            documentation: 'Execute an asynchronous network request.',
            insertText: `${ns}.request({\n  url: "\${1:https://api.example.com}",\n  method: "\${2:GET}",\n  headers: \${3:{}},\n  body: \${4:{}}\n})`,
            insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
            range,
          },
          {
            label: `${ns}.import`,
            kind: monaco.languages.CompletionItemKind.Method,
            documentation: 'Asynchronously import and execute another script from the Laboratory.',
            insertText: `const \${1:script} = await ${ns}.import("\${2:script_name}");\nawait \${1:script}();`,
            insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
            range,
          },
          {
            label: `${ns}.environment.get`,
            kind: monaco.languages.CompletionItemKind.Method,
            documentation: 'Retrieve an environment variable.',
            insertText: `${ns}.environment.get("\${1:key}")`,
            insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
            range,
          },
          {
            label: `${ns}.environment.set`,
            kind: monaco.languages.CompletionItemKind.Method,
            documentation: 'Set an environment variable dynamically.',
            insertText: `${ns}.environment.set("\${1:key}", "\${2:value}")`,
            insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
            range,
          },
          {
            label: `${ns}.environment.has`,
            kind: monaco.languages.CompletionItemKind.Method,
            documentation: 'Check if an environment variable is defined.',
            insertText: `${ns}.environment.has("\${1:key}")`,
            insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
            range,
          },
          {
            label: `${ns}.environment.unset`,
            kind: monaco.languages.CompletionItemKind.Method,
            documentation: 'Delete an environment variable.',
            insertText: `${ns}.environment.unset("\${1:key}")`,
            insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
            range,
          },
          {
            label: `${ns}.environment.clear`,
            kind: monaco.languages.CompletionItemKind.Method,
            documentation: 'Clear all variables in active environment.',
            insertText: `${ns}.environment.clear()`,
            range,
          },
          {
            label: `${ns}.collectionVariables.get`,
            kind: monaco.languages.CompletionItemKind.Method,
            documentation: 'Retrieve a collection-level variable.',
            insertText: `${ns}.collectionVariables.get("\${1:key}")`,
            insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
            range,
          },
          {
            label: `${ns}.collectionVariables.set`,
            kind: monaco.languages.CompletionItemKind.Method,
            documentation: 'Set a collection-level variable.',
            insertText: `${ns}.collectionVariables.set("\${1:key}", "\${2:value}")`,
            insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
            range,
          },
          {
            label: `${ns}.globals.get`,
            kind: monaco.languages.CompletionItemKind.Method,
            documentation: 'Retrieve a global variable.',
            insertText: `${ns}.globals.get("\${1:key}")`,
            insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
            range,
          },
          {
            label: `${ns}.globals.set`,
            kind: monaco.languages.CompletionItemKind.Method,
            documentation: 'Set a global variable.',
            insertText: `${ns}.globals.set("\${1:key}", "\${2:value}")`,
            insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
            range,
          },
          {
            label: `${ns}.variables.get`,
            kind: monaco.languages.CompletionItemKind.Method,
            documentation: 'Retrieve a resolved variable from any scope (active environment, collection, global).',
            insertText: `${ns}.variables.get("\${1:key}")`,
            insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
            range,
          },
          {
            label: `${ns}.response.code`,
            kind: monaco.languages.CompletionItemKind.Field,
            documentation: 'Response HTTP status code.',
            insertText: `${ns}.response.code`,
            range,
          },
          {
            label: `${ns}.response.status`,
            kind: monaco.languages.CompletionItemKind.Field,
            documentation: 'Response status text (e.g. "OK").',
            insertText: `${ns}.response.status`,
            range,
          },
          {
            label: `${ns}.response.headers.get`,
            kind: monaco.languages.CompletionItemKind.Method,
            documentation: 'Get the value of a response header.',
            insertText: `${ns}.response.headers.get("\${1:Header-Name}")`,
            insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
            range,
          },
          {
            label: `${ns}.response.json`,
            kind: monaco.languages.CompletionItemKind.Method,
            documentation: 'Parse the response body as JSON.',
            insertText: `${ns}.response.json()`,
            range,
          },
          {
            label: `${ns}.response.responseTime`,
            kind: monaco.languages.CompletionItemKind.Field,
            documentation: 'Response transmission time in milliseconds.',
            insertText: `${ns}.response.responseTime`,
            range,
          },
          {
            label: `${ns}.test`,
            kind: monaco.languages.CompletionItemKind.Function,
            documentation: 'Define an integration test assertion context.',
            insertText: `${ns}.test("\${1:Status code is 200}", () => {\n  ${ns}.expect(${ns}.response.code).to.equal(200);\n});`,
            insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
            range,
          },
          {
            label: `${ns}.expect`,
            kind: monaco.languages.CompletionItemKind.Function,
            documentation: 'Perform standard test assertions on objects and parameters.',
            insertText: `${ns}.expect(\${1:value}).to.\${2:equal}(\${3:expected})`,
            insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
            range,
          }
        );
      });

      return { suggestions };
    },
  });

  // Register hover provider for documentation
  const hoverProvider = monaco.languages.registerHoverProvider('javascript', {
    provideHover: (model, position) => {
      const line = model.getLineContent(position.lineNumber);
      
      const matchedNs = namespaces.find(ns => line.includes(`${ns}.request`));
      if (matchedNs) {
        return {
          contents: [
            { value: `**${matchedNs}.request(options)**` },
            { value: 'Executes an asynchronous network request. Returns a promise that resolves with the response.' },
            { value: '```javascript\n{\n  url: string,\n  method: string,\n  headers: object,\n  body: any\n}\n```' }
          ]
        };
      }
      
      const testNs = namespaces.find(ns => line.includes(`${ns}.test`));
      if (testNs) {
        return {
          contents: [
            { value: `**${testNs}.test(testName, executorFunction)**` },
            { value: 'Registers a test assertion group. The executor function contains expects and checks.' },
            { value: '```javascript\ngmy.test("Response is valid", () => {\n  gmy.expect(gmy.response.code).to.equal(200);\n});\n```' }
          ]
        };
      }

      return null;
    }
  });

  return [completionProvider, hoverProvider];
};
