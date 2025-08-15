import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

// Console interceptor to forward browser console messages to server
if (import.meta.env.DEV) {
  const originalConsole = {
    log: console.log,
    error: console.error,
    warn: console.warn,
    info: console.info,
    debug: console.debug
  };

  const forwardToServer = (level: string, args: any[]) => {
    // Call original console method first
    (originalConsole as any)[level](...args);
    
    // Forward to server
    try {
      const message = args.map(arg => 
        typeof arg === 'object' ? JSON.stringify(arg) : String(arg)
      ).join(' ');
      
      fetch('/api/dev/console', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ level, message, timestamp: Date.now() })
      }).catch(() => {}); // Silently fail if server not available
    } catch (e) {
      // Silently fail to avoid infinite loops
    }
  };

  console.log = (...args) => forwardToServer('log', args);
  console.error = (...args) => forwardToServer('error', args);
  console.warn = (...args) => forwardToServer('warn', args);
  console.info = (...args) => forwardToServer('info', args);
  console.debug = (...args) => forwardToServer('debug', args);
}

createRoot(document.getElementById("root")!).render(<App />);
