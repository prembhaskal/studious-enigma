import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export interface AdbDevice {
    serial: string;
    state: 'device' | 'offline' | 'unauthorized' | 'connecting';
    model?: string;
}

export async function listDevices(): Promise<AdbDevice[]> {
    const { stdout } = await execAsync('adb devices -l');
    const lines = stdout.trim().split('\n').slice(1); // skip "List of devices attached"
    const devices: AdbDevice[] = [];

    for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) {
            continue;
        }
        const parts = trimmed.split(/\s+/);
        const serial = parts[0];
        const state = parts[1] as AdbDevice['state'];
        const modelPart = trimmed.match(/model:(\S+)/);
        const model = modelPart ? modelPart[1].replace(/_/g, ' ') : undefined;
        devices.push({ serial, state, model });
    }

    return devices;
}

export async function connectDevice(address: string): Promise<string> {
    const { stdout, stderr } = await execAsync(`adb connect ${address}`);
    return (stdout + stderr).trim();
}

export async function disconnectDevice(serial: string): Promise<string> {
    const { stdout, stderr } = await execAsync(`adb disconnect ${serial}`);
    return (stdout + stderr).trim();
}

export async function installApk(serial: string, apkPath: string): Promise<string> {
    const { stdout, stderr } = await execAsync(`adb -s ${serial} install -r "${apkPath}"`);
    return (stdout + stderr).trim();
}

export async function launchApp(serial: string, packageName: string, activity: string): Promise<string> {
    const { stdout, stderr } = await execAsync(
        `adb -s ${serial} shell am start -n "${packageName}/${activity}"`
    );
    return (stdout + stderr).trim();
}

export async function isAdbAvailable(): Promise<boolean> {
    try {
        await execAsync('adb version');
        return true;
    } catch {
        return false;
    }
}
