import { useScriptStore } from '../store/scriptStore';
import { useStore } from '../store/useStore';
import { SandboxRunner } from './sandboxRunner';

export class ScriptEngine {
  static async execute(code: string) {
    const { addLog, setConsoleOpen } = useScriptStore.getState();
    const { environments, activeEnvId, globalVariables } = useStore.getState();

    setConsoleOpen(true);
    addLog({ level: 'info', message: 'Sandbox environment initializing...' });

    // 1. Gather variables from active environment or global fallback
    const activeEnv = environments.find(e => e.id === activeEnvId);
    const envVars = activeEnv ? [...(activeEnv.variables || [])] : [...globalVariables];
    
    const variablesMap: Record<string, any> = {};
    envVars.forEach(v => {
      if (v.active !== false && v.enabled !== false) {
        variablesMap[v.key] = v.value;
      }
    });

    // 2. Run in dynamic Web Worker sandbox
    addLog({ level: 'info', message: 'Starting asynchronous sandboxed execution thread...' });
    const result = await SandboxRunner.run(code, { variables: variablesMap });

    // 3. Process logs
    result.logs.forEach(log => {
      addLog({ level: log.level === 'log' ? 'info' : log.level, message: log.message });
    });

    // 4. Update modified variables
    const hasChanges = Object.keys(result.changedVariables).length > 0;
    if (hasChanges) {
      const activeVars = [...(activeEnv?.variables || [])];
      
      for (const [key, value] of Object.entries(result.changedVariables)) {
        if (value === null) {
          const index = activeVars.findIndex(v => v.key === key);
          if (index !== -1) activeVars.splice(index, 1);
        } else {
          const index = activeVars.findIndex(v => v.key === key);
          if (index !== -1) {
            activeVars[index] = { ...activeVars[index], value: String(value) };
          } else {
            activeVars.push({
              id: Math.random().toString(36).substr(2, 9),
              key,
              value: String(value),
              type: 'string',
              enabled: true,
              active: true
            });
          }
        }
      }

      if (activeEnvId) {
        useStore.getState().updateEnvironment(activeEnvId, { variables: activeVars });
        addLog({ level: 'info', message: `Variables in environment "${activeEnv?.name}" updated.` });
      } else {
        const globals = [...useStore.getState().globalVariables];
        for (const [key, value] of Object.entries(result.changedVariables)) {
          if (value === null) {
            const index = globals.findIndex(v => v.key === key);
            if (index !== -1) globals.splice(index, 1);
          } else {
            const index = globals.findIndex(v => v.key === key);
            if (index !== -1) {
              globals[index] = { ...globals[index], value: String(value) };
            } else {
              globals.push({
                id: Math.random().toString(36).substr(2, 9),
                key,
                value: String(value),
                active: true
              });
            }
          }
        }
        useStore.getState().setGlobalVariables(globals);
        addLog({ level: 'info', message: `Global variables updated.` });
      }
    }

    // 5. Assert final execution state
    if (result.error) {
      addLog({ level: 'error', message: `Execution failed: ${result.error}` });
    } else {
      addLog({ level: 'success', message: 'Execution thread finished successfully.' });
    }
  }
}
