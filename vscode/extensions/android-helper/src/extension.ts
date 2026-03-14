import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { listDevices, connectDevice, disconnectDevice, isAdbAvailable, installApk, launchApp, AdbDevice } from './adb';
import { findApk, parseManifest, BuildVariant } from './android';
import { LogcatSession, LOG_LEVELS } from './logcat';

let buildStatusBar: vscode.StatusBarItem;
let deviceStatusBar: vscode.StatusBarItem;
let selectedDevice: AdbDevice | undefined;
let logcatSession: LogcatSession | undefined;

export function activate(context: vscode.ExtensionContext) {
    // --- Status bar items ---
    buildStatusBar = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
    buildStatusBar.command = 'android-helper.build';
    buildStatusBar.text = '$(tools) Android Build';
    buildStatusBar.tooltip = 'Run Android Gradle Build';
    buildStatusBar.show();

    deviceStatusBar = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 99);
    deviceStatusBar.command = 'android-helper.selectDevice';
    updateDeviceStatusBar();
    deviceStatusBar.show();

    // --- Commands ---
    const buildCommand = vscode.commands.registerCommand('android-helper.build', async () => {
        const buildType = await vscode.window.showQuickPick(
            [
                { label: 'Debug', description: 'assembleDebug — fast build for development' },
                { label: 'Release', description: 'assembleRelease — optimized build for distribution' },
            ],
            { placeHolder: 'Select build type' }
        );

        if (!buildType) {
            return;
        }

        const workspaceFolder = getWorkspaceRoot();
        if (!workspaceFolder) {
            vscode.window.showErrorMessage('No workspace folder open.');
            return;
        }

        const gradlew = getGradlewPath(workspaceFolder);
        if (!gradlew) {
            vscode.window.showErrorMessage(
                'gradlew not found in workspace root. Make sure this is an Android project.'
            );
            return;
        }

        const task = buildType.label === 'Debug' ? 'assembleDebug' : 'assembleRelease';
        const gradleCmd = process.platform === 'win32' ? 'gradlew.bat' : './gradlew';

        const terminal = vscode.window.createTerminal({
            name: `Android Build (${buildType.label})`,
            cwd: workspaceFolder,
        });

        buildStatusBar.text = `$(sync~spin) Building ${buildType.label}...`;
        terminal.show();
        terminal.sendText(`${gradleCmd} ${task}`);

        setTimeout(() => {
            buildStatusBar.text = '$(tools) Android Build';
        }, 3000);
    });

    const connectCommand = vscode.commands.registerCommand('android-helper.connectDevice', async () => {
        if (!await checkAdb()) {
            return;
        }

        const address = await vscode.window.showInputBox({
            prompt: 'Enter device IP address and port',
            placeHolder: '192.168.1.100:5555',
            validateInput: (val) => {
                return val && val.trim() ? null : 'Address cannot be empty';
            }
        });

        if (!address) {
            return;
        }

        deviceStatusBar.text = '$(sync~spin) Connecting...';
        try {
            const result = await connectDevice(address.trim());
            if (result.includes('connected') && !result.includes('unable') && !result.includes('failed')) {
                vscode.window.showInformationMessage(`ADB: ${result}`);
                // Auto-refresh device list and select the newly connected device
                await refreshAndSelectDevice(address.trim());
            } else {
                vscode.window.showErrorMessage(`ADB: ${result}`);
                updateDeviceStatusBar();
            }
        } catch (err: any) {
            vscode.window.showErrorMessage(`Failed to connect: ${err.message}`);
            updateDeviceStatusBar();
        }
    });

    const disconnectCommand = vscode.commands.registerCommand('android-helper.disconnectDevice', async () => {
        if (!await checkAdb()) {
            return;
        }

        let devices: AdbDevice[];
        try {
            devices = await listDevices();
        } catch (err: any) {
            vscode.window.showErrorMessage(`Failed to list devices: ${err.message}`);
            return;
        }

        if (devices.length === 0) {
            vscode.window.showInformationMessage('No devices connected.');
            return;
        }

        const items = devices.map(d => ({
            label: d.model ?? d.serial,
            description: d.serial,
            detail: `State: ${d.state}`,
            device: d,
        }));

        const picked = await vscode.window.showQuickPick(items, {
            placeHolder: 'Select device to disconnect',
        });

        if (!picked) {
            return;
        }

        try {
            const result = await disconnectDevice(picked.device.serial);
            vscode.window.showInformationMessage(`ADB: ${result}`);
            if (selectedDevice?.serial === picked.device.serial) {
                selectedDevice = undefined;
                updateDeviceStatusBar();
            }
        } catch (err: any) {
            vscode.window.showErrorMessage(`Failed to disconnect: ${err.message}`);
        }
    });

    const selectDeviceCommand = vscode.commands.registerCommand('android-helper.selectDevice', async () => {
        if (!await checkAdb()) {
            return;
        }

        let devices: AdbDevice[];
        try {
            devices = await listDevices();
        } catch (err: any) {
            vscode.window.showErrorMessage(`Failed to list devices: ${err.message}`);
            return;
        }

        if (devices.length === 0) {
            const connect = await vscode.window.showInformationMessage(
                'No devices connected. Connect one?',
                'Connect via WiFi'
            );
            if (connect) {
                vscode.commands.executeCommand('android-helper.connectDevice');
            }
            return;
        }

        const items = devices.map(d => ({
            label: d.model ?? d.serial,
            description: d.serial,
            detail: `State: ${d.state}`,
            device: d,
        }));

        const picked = await vscode.window.showQuickPick(items, {
            placeHolder: 'Select active device',
        });

        if (!picked) {
            return;
        }

        selectedDevice = picked.device;
        updateDeviceStatusBar();
        vscode.window.showInformationMessage(`Selected device: ${picked.label}`);
    });

    const runAppCommand = vscode.commands.registerCommand('android-helper.runApp', async () => {
        if (!await checkAdb()) {
            return;
        }

        // Ensure a device is selected
        if (!selectedDevice) {
            const pick = await vscode.window.showInformationMessage(
                'No device selected. Select a device first.',
                'Select Device'
            );
            if (pick) {
                await vscode.commands.executeCommand('android-helper.selectDevice');
            }
            if (!selectedDevice) {
                return;
            }
        }

        const workspaceFolder = getWorkspaceRoot();
        if (!workspaceFolder) {
            vscode.window.showErrorMessage('No workspace folder open.');
            return;
        }

        // Pick build variant
        const variantPick = await vscode.window.showQuickPick(
            [
                { label: 'Debug', description: 'Install debug APK' },
                { label: 'Release', description: 'Install release APK' },
            ],
            { placeHolder: 'Select APK variant to install' }
        );
        if (!variantPick) {
            return;
        }

        const variant = variantPick.label.toLowerCase() as BuildVariant;
        let apkPath = findApk(workspaceFolder, variant);

        if (!apkPath) {
            const build = await vscode.window.showInformationMessage(
                `No ${variant} APK found. Build the project first?`,
                'Build Now'
            );
            if (build) {
                await vscode.commands.executeCommand('android-helper.build');
            }
            return;
        }

        // Parse manifest for package + activity
        const appInfo = parseManifest(workspaceFolder);
        if (!appInfo) {
            vscode.window.showErrorMessage(
                'Could not parse AndroidManifest.xml. Make sure app/src/main/AndroidManifest.xml exists.'
            );
            return;
        }

        const device = selectedDevice;
        deviceStatusBar.text = `$(sync~spin) Installing...`;

        try {
            const installResult = await installApk(device.serial, apkPath);
            if (!installResult.includes('Success') && !installResult.toLowerCase().includes('success')) {
                vscode.window.showErrorMessage(`Install failed: ${installResult}`);
                updateDeviceStatusBar();
                return;
            }

            deviceStatusBar.text = `$(sync~spin) Launching...`;
            const launchResult = await launchApp(device.serial, appInfo.packageName, appInfo.mainActivity);

            if (launchResult.includes('Error') || launchResult.includes('error')) {
                vscode.window.showErrorMessage(`Launch failed: ${launchResult}`);
            } else {
                vscode.window.showInformationMessage(
                    `App launched on ${device.model ?? device.serial}: ${appInfo.packageName}`
                );
            }
        } catch (err: any) {
            vscode.window.showErrorMessage(`Run failed: ${err.message}`);
        } finally {
            updateDeviceStatusBar();
        }
    });

    const startLogcatCommand = vscode.commands.registerCommand('android-helper.startLogcat', async () => {
        if (!await checkAdb()) {
            return;
        }

        if (!selectedDevice) {
            const pick = await vscode.window.showInformationMessage(
                'No device selected. Select a device first.',
                'Select Device'
            );
            if (pick) {
                await vscode.commands.executeCommand('android-helper.selectDevice');
            }
            if (!selectedDevice) {
                return;
            }
        }

        // Pick log level
        const levelPick = await vscode.window.showQuickPick(
            LOG_LEVELS.map(l => ({ label: l.label, description: l.description, level: l.level })),
            { placeHolder: 'Select minimum log level (default: Debug)' }
        );
        if (!levelPick) {
            return;
        }

        // Optionally filter by package
        const workspaceFolder = getWorkspaceRoot();
        let packageName: string | undefined;

        if (workspaceFolder) {
            const appInfo = parseManifest(workspaceFolder);
            if (appInfo) {
                const filterPick = await vscode.window.showInformationMessage(
                    `Filter logcat for ${appInfo.packageName}?`,
                    'Yes — App only',
                    'No — All logs'
                );
                if (filterPick === 'Yes — App only') {
                    packageName = appInfo.packageName;
                }
            }
        }

        if (!logcatSession) {
            logcatSession = new LogcatSession();
        }

        await logcatSession.start(selectedDevice.serial, levelPick.level, packageName);
    });

    const stopLogcatCommand = vscode.commands.registerCommand('android-helper.stopLogcat', () => {
        if (!logcatSession?.isRunning) {
            vscode.window.showInformationMessage('Logcat is not running.');
            return;
        }
        logcatSession.stop();
    });

    const clearLogcatCommand = vscode.commands.registerCommand('android-helper.clearLogcat', () => {
        if (!logcatSession) {
            vscode.window.showInformationMessage('No logcat session active.');
            return;
        }
        logcatSession.clear();
        logcatSession.show();
    });

    context.subscriptions.push(
        buildCommand,
        connectCommand,
        disconnectCommand,
        selectDeviceCommand,
        runAppCommand,
        startLogcatCommand,
        stopLogcatCommand,
        clearLogcatCommand,
        buildStatusBar,
        deviceStatusBar,
    );
}

async function checkAdb(): Promise<boolean> {
    if (!await isAdbAvailable()) {
        vscode.window.showErrorMessage('ADB not found. Make sure Android SDK is installed and adb is on PATH.');
        return false;
    }
    return true;
}

async function refreshAndSelectDevice(serial: string): Promise<void> {
    try {
        const devices = await listDevices();
        const match = devices.find(d => d.serial === serial || serial.startsWith(d.serial));
        if (match) {
            selectedDevice = match;
        }
    } catch {
        // ignore
    }
    updateDeviceStatusBar();
}

function updateDeviceStatusBar(): void {
    if (selectedDevice) {
        const label = selectedDevice.model ?? selectedDevice.serial;
        deviceStatusBar.text = `$(device-mobile) ${label}`;
        deviceStatusBar.tooltip = `Serial: ${selectedDevice.serial} | State: ${selectedDevice.state}\nClick to change device`;
    } else {
        deviceStatusBar.text = '$(device-mobile) No device';
        deviceStatusBar.tooltip = 'Click to select a device';
    }
}

function getWorkspaceRoot(): string | undefined {
    const folders = vscode.workspace.workspaceFolders;
    if (!folders || folders.length === 0) {
        return undefined;
    }
    if (folders.length === 1) {
        return folders[0].uri.fsPath;
    }
    for (const folder of folders) {
        if (getGradlewPath(folder.uri.fsPath)) {
            return folder.uri.fsPath;
        }
    }
    return folders[0].uri.fsPath;
}

function getGradlewPath(root: string): string | null {
    const gradlew = path.join(root, process.platform === 'win32' ? 'gradlew.bat' : 'gradlew');
    return fs.existsSync(gradlew) ? gradlew : null;
}

export function deactivate() {
    buildStatusBar?.dispose();
    deviceStatusBar?.dispose();
    logcatSession?.dispose();
}

export { selectedDevice };
