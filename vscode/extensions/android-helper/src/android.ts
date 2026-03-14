import * as fs from 'fs';
import * as path from 'path';

export interface AppInfo {
    packageName: string;
    mainActivity: string;
}

export type BuildVariant = 'debug' | 'release';

export function findApk(workspaceRoot: string, variant: BuildVariant): string | undefined {
    const apkDir = path.join(workspaceRoot, 'app', 'build', 'outputs', 'apk', variant);
    if (!fs.existsSync(apkDir)) {
        return undefined;
    }
    const files = fs.readdirSync(apkDir).filter(f => f.endsWith('.apk'));
    if (files.length === 0) {
        return undefined;
    }
    // Prefer unsigned > signed > any; for debug just pick first
    return path.join(apkDir, files[0]);
}

export function parseManifest(workspaceRoot: string): AppInfo | undefined {
    const manifestPath = path.join(workspaceRoot, 'app', 'src', 'main', 'AndroidManifest.xml');
    if (!fs.existsSync(manifestPath)) {
        return undefined;
    }

    const content = fs.readFileSync(manifestPath, 'utf-8');

    const packageMatch = content.match(/package\s*=\s*["']([^"']+)["']/);
    if (!packageMatch) {
        return undefined;
    }
    const packageName = packageMatch[1];

    // Find activity with MAIN + LAUNCHER intent filter
    const activityMatch = content.match(
        /<activity[^>]+android:name\s*=\s*["']([^"']+)["'][^>]*>[\s\S]*?<action[^>]+android\.intent\.action\.MAIN/
    ) || content.match(
        /<action[^>]+android\.intent\.action\.MAIN[\s\S]*?<\/activity>/
    );

    let mainActivity: string | undefined;

    if (activityMatch) {
        // Extract activity name from the block around MAIN action
        const nameMatch = activityMatch[0].match(/android:name\s*=\s*["']([^"']+)["']/);
        if (nameMatch) {
            mainActivity = nameMatch[1];
        }
    }

    if (!mainActivity) {
        // Fallback: find first activity
        const firstActivity = content.match(/<activity[^>]+android:name\s*=\s*["']([^"']+)["']/);
        if (firstActivity) {
            mainActivity = firstActivity[1];
        }
    }

    if (!mainActivity) {
        return undefined;
    }

    // Expand relative activity names (e.g. .MainActivity -> com.example.app.MainActivity)
    if (mainActivity.startsWith('.')) {
        mainActivity = packageName + mainActivity;
    }

    return { packageName, mainActivity };
}
