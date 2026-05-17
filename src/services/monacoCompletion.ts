// Completion provider for Putman API

export const registerPutmanCompletions = (monaco: any) => {
  monaco.languages.registerCompletionItemProvider('javascript', {
    provideCompletionItems: (model, position) => {
      const word = model.getWordUntilPosition(position);
      const range = {
        startLineNumber: position.lineNumber,
        endLineNumber: position.lineNumber,
        startColumn: word.startColumn,
        endColumn: word.endColumn,
      };

      const suggestions: any[] = [
        {
          label: 'putman',
          kind: monaco.languages.CompletionItemKind.Variable,
          documentation: 'The global Putman API object',
          insertText: 'putman',
          range,
        },
        {
          label: 'putman.request',
          kind: monaco.languages.CompletionItemKind.Function,
          documentation: 'Execute a network request',
          insertText: 'putman.request({\n  url: "${1:https://api.example.com}",\n  method: "${2:GET}",\n  headers: ${3:{}},\n  body: ${4:{}}\n})',
          insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
          range,
        },
        {
          label: 'putman.import',
          kind: monaco.languages.CompletionItemKind.Method,
          documentation: 'Import and execute another script from the Laboratory',
          insertText: 'const ${1:script} = await putman.import("${2:script_name}");\nawait ${1:script}();',
          insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
          range,
        },
        {
          label: 'putman.get',
          kind: monaco.languages.CompletionItemKind.Function,
          documentation: 'Execute a GET request',
          insertText: 'putman.get("${1:url}")',
          insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
          range,
        },
        {
          label: 'putman.post',
          kind: monaco.languages.CompletionItemKind.Function,
          documentation: 'Execute a POST request',
          insertText: 'putman.post("${1:url}", ${2:body})',
          insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
          range,
        },
        {
          label: 'putman.env.get',
          kind: monaco.languages.CompletionItemKind.Method,
          documentation: 'Retrieve an environment variable',
          insertText: 'putman.env.get("${1:key}")',
          insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
          range,
        },
        {
          label: 'putman.env.set',
          kind: monaco.languages.CompletionItemKind.Method,
          documentation: 'Set an environment variable',
          insertText: 'putman.env.set("${1:key}", "${2:value}")',
          insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
          range,
        },
        {
          label: 'putman.test.expect',
          kind: monaco.languages.CompletionItemKind.Method,
          documentation: 'Perform a test assertion',
          insertText: 'putman.test.expect(${1:value}).toBe(${2:expected})',
          insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
          range,
        },
        {
          label: 'putman.console.log',
          kind: monaco.languages.CompletionItemKind.Method,
          documentation: 'Log a message to the Putman console',
          insertText: 'putman.console.log(${1:message})',
          insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
          range,
        }
      ];

      return { suggestions };
    },
  });

  // Register hover provider for documentation
  monaco.languages.registerHoverProvider('javascript', {
    provideHover: (model, position) => {
      const line = model.getLineContent(position.lineNumber);
      if (line.includes('putman.request')) {
        return {
          contents: [
            { value: '**putman.request(options)**' },
            { value: 'Executes an asynchronous network request. Returns a promise that resolves with the response object.' },
            { value: '```javascript\n{\n  url: string,\n  method: string,\n  headers: object,\n  body: any\n}\n```' }
          ]
        };
      }
      return null;
    }
  });
};
