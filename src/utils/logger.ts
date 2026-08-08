type LogLevel = 'info' | 'warn' | 'error';

export interface LogEntry {
  id: string;
  level: LogLevel;
  message: string;
  timestamp: Date;
  details?: any[];
}

class Logger {
  private logs: LogEntry[] = [];
  private listeners: Set<() => void> = new Set();
  private originalConsole = {
    log: console.log,
    warn: console.warn,
    error: console.error,
  };

  constructor() {
    this.hijackConsole();
  }

  private hijackConsole() {
    console.log = (...args: any[]) => {
      this.addLog('info', args);
      this.originalConsole.log(...args);
    };

    console.warn = (...args: any[]) => {
      this.addLog('warn', args);
      this.originalConsole.warn(...args);
    };

    console.error = (...args: any[]) => {
      this.addLog('error', args);
      this.originalConsole.error(...args);
    };
  }

  private addLog(level: LogLevel, args: any[]) {
    const message = args.map(a => (typeof a === 'object' ? JSON.stringify(a) : String(a))).join(' ');
    const entry: LogEntry = {
      id: Math.random().toString(36).substring(2, 9),
      level,
      message,
      timestamp: new Date(),
      details: args,
    };
    this.logs.push(entry);
    
    // Keep only last 1000 logs
    if (this.logs.length > 1000) {
      this.logs.shift();
    }
    
    this.notify();
  }

  public getLogs() {
    return [...this.logs];
  }

  public clearLogs() {
    this.logs = [];
    this.notify();
  }

  public subscribe(listener: () => void) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notify() {
    this.listeners.forEach(l => l());
  }
}

export const appLogger = new Logger();
