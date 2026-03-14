import * as vscode from 'vscode';
import { spawn, ChildProcess } from 'child_process';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export type LogLevel = 'V' | 'D' | 'I' | 'W' | 'E';

const LOG_LEVEL_LABELS: Record<LogLevel, string> = {
    V: 'Verbose',
    D: 'Debug',
    I: 'Info',
    W: 'Warn',
    E: 'Error',
};

const LOG_LEVEL_PREFIX: Record<string, string> = {
    V: '[VERBOSE]',
    D: '[DEBUG  ]',
    I: '[INFO   ]',
    W: '[WARN   ]',
    E: '[ERROR  ]',
};

export class LogcatSession {
    private process: ChildProcess | undefined;
    private channel: vscode.OutputChannel;
    private running = false;

    constructor() {
        this.channel = vscode.window.createOutputChannel('Android Logcat');
    }

    get isRunning(): boolean {
        return this.running;
    }

    async start(serial: string, logLevel: LogLevel, packageName?: string): Promise<void> {
        if (this.running) {
            this.stop();
        }

        this.channel.clear();
        this.channel.show(true); // preserve focus

        let pidArgs: string[] = [];

        if (packageName) {
            const pid = await getAppPid(serial, packageName);
            if (pid) {
                pidArgs = ['--pid', pid];
                this.channel.appendLine(`--- Filtering logcat for: ${packageName} (PID: ${pid}) ---`);
            } else {
                this.channel.appendLine(
                    `--- Warning: ${packageName} is not running. Showing all logs. ---`
                );
                this.channel.appendLine(`--- Start the app and restart logcat to filter by PID. ---`);
            }
        }

        const args = ['-s', serial, 'logcat', ...pidArgs, '-v', 'time', `*:${logLevel}`];
        this.channel.appendLine(`--- Starting logcat (level: ${LOG_LEVEL_LABELS[logLevel]}) ---\n`);

        this.process = spawn('adb', args);
        this.running = true;

        this.process.stdout?.on('data', (data: Buffer) => {
            const lines = data.toString().split('\n');
            for (const line of lines) {
                const trimmed = line.trimEnd();
                if (trimmed) {
                    this.channel.appendLine(formatLine(trimmed));
                }
            }
        });

        this.process.stderr?.on('data', (data: Buffer) => {
            this.channel.appendLine(`[ADB ERR] ${data.toString().trim()}`);
        });

        this.process.on('close', (code) => {
            if (this.running) {
                this.channel.appendLine(`\n--- Logcat stopped (exit code: ${code}) ---`);
                this.running = false;
            }
        });

        this.process.on('error', (err) => {
            this.channel.appendLine(`\n--- Logcat error: ${err.message} ---`);
            this.running = false;
        });
    }

    stop(): void {
        if (this.process) {
            this.process.kill();
            this.process = undefined;
        }
        this.running = false;
        this.channel.appendLine('\n--- Logcat stopped ---');
    }

    clear(): void {
        this.channel.clear();
    }

    show(): void {
        this.channel.show(true);
    }

    dispose(): void {
        this.stop();
        this.channel.dispose();
    }
}

async function getAppPid(serial: string, packageName: string): Promise<string | undefined> {
    try {
        const { stdout } = await execAsync(`adb -s ${serial} shell pidof ${packageName}`);
        const pid = stdout.trim();
        return pid || undefined;
    } catch {
        return undefined;
    }
}

function formatLine(line: string): string {
    // Logcat -v time format: "MM-DD HH:MM:SS.mmm PID TID LEVEL/TAG: message"
    // Extract level character (single letter before '/')
    const match = line.match(/\s([VDIWEF])\/\S/);
    if (match) {
        const level = match[1];
        const prefix = LOG_LEVEL_PREFIX[level] ?? `[${level}      ]`;
        return `${prefix} ${line}`;
    }
    return line;
}

export const LOG_LEVELS: Array<{ label: string; level: LogLevel; description: string }> = [
    { label: 'Verbose', level: 'V', description: 'All messages' },
    { label: 'Debug',   level: 'D', description: 'Debug and above' },
    { label: 'Info',    level: 'I', description: 'Info and above' },
    { label: 'Warn',    level: 'W', description: 'Warnings and errors only' },
    { label: 'Error',   level: 'E', description: 'Errors only' },
];
