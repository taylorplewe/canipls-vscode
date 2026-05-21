import * as vscode from 'vscode';
import {
    LanguageClient,
    LanguageClientOptions,
    ServerOptions,
    TransportKind,
} from 'vscode-languageclient/node';
import extract from 'extract-zip';
import childProcess from 'child_process';

let client: LanguageClient | undefined;
let caniplsExePath: vscode.Uri;

const CANIPLS_REPO = "taylorplewe/canipls";
const CANIPLS_VSCODE_ID = "canipls";
const CANIPLS_LATEST_RELEASE_URL = `https://api.github.com/repos/${CANIPLS_REPO}/releases/latest`;

class SemVer {
    major: number = 0;
    minor: number = 0;
    patch: number = 0;
    constructor(str: string) {
        const semVerRe = /v?(\d+)\.(\d+)\.(\d+)/;
        const match = str.match(semVerRe);
        if (!match) {
            console.log('no match');
            return;
        } else if (match.length !== 4) {
            console.log('invlaid semver string ' + str);
        }
        this.major = parseInt(match[1]);
        this.minor = parseInt(match[2]);
        this.patch = parseInt(match[3]);
    }

    gt(other: SemVer): boolean {
        if (other.major > this.major) return false;
        if (other.major < this.major) return true;
        if (other.minor > this.minor) return false;
        if (other.minor < this.minor) return true;
        if (other.patch > this.patch) return false;
        return false;
    }
}

export async function activate(context: vscode.ExtensionContext): Promise<void> {
    context.subscriptions.push(
        vscode.commands.registerCommand("canipls.restartLanguageServer", async () => {
            restartClient();
            vscode.window.showInformationMessage("Restarted canipls server");
        })
    );

    // allow user to override the path to their LSP executable
    const overridePath = vscode.workspace.getConfiguration(CANIPLS_VSCODE_ID).get<string>("path");
    if (overridePath) {
        caniplsExePath = vscode.Uri.parse(overridePath);
    } else {
        await getLatestCaniplsVersion(context);
        caniplsExePath = vscode.Uri.joinPath(context.globalStorageUri, `canipls${process.platform === "win32" ? ".exe" : ""}`);
    }

    await restartClient();
}

export const deactivate = stopClient;

async function getLatestCaniplsVersion(context: vscode.ExtensionContext): Promise<void> {
    // get latest canipls release from GitHub
    let arch: string = process.arch;
    switch (process.arch) {
        case "x64":
            arch = "x86_64";
            break;
        case "arm64":
            arch = "aarch64";
            break;
    }
    let os: string = process.platform;
    switch (process.platform) {
        case "win32":
            os = "windows";
            break;
        case "darwin":
            os = "macos";
            break;
    }
    const latestReleaseResponse: any = await fetch(CANIPLS_LATEST_RELEASE_URL).then(res => res.json());
    const latestSemVer = new SemVer(latestReleaseResponse.name);

    let shouldDownloadLatest = false;

    // get installed version if exists
    const installedVersionPath = vscode.Uri.joinPath(context.globalStorageUri, "latest");
    try {
        const installedBytes = await vscode.workspace.fs.readFile(installedVersionPath);
        const installedSemVer = new SemVer(installedBytes.toString());
        if (latestSemVer.gt(installedSemVer)) {
            shouldDownloadLatest = true;
        }
    } catch {
        shouldDownloadLatest = true;
    }

    // download latest release archive, expand into executable
    if (shouldDownloadLatest) {
        console.log('downloading latest canipls version...');
        let caniplsArchivePath: vscode.Uri = vscode.Uri.parse("");
        for (const asset of latestReleaseResponse.assets) {
            if (asset.name.indexOf(`${arch}-${os}`) !== -1) {
                const archiveRes = await fetch(asset.url, { headers: {"Accept": "application/octet-stream"} });
                const archiveData = Buffer.from(await archiveRes.arrayBuffer());
                caniplsArchivePath = vscode.Uri.joinPath(context.globalStorageUri, asset.name);

                // write archive to directory
                await vscode.workspace.fs.writeFile(caniplsArchivePath, archiveData);

                // extract archive
                if (process.platform === "win32") {
                    await extract(caniplsArchivePath.fsPath, { dir: context.globalStorageUri.fsPath });
                } else {
                    childProcess.exec(`tar xzf ${caniplsArchivePath.fsPath}`);
                }

                // record installed version
                await vscode.workspace.fs.writeFile(installedVersionPath, Buffer.from(latestReleaseResponse.name));

                // cleanup (delete archive)
                await vscode.workspace.fs.delete(caniplsArchivePath, { useTrash: false });
            }
        }
    }
}

// https://codeberg.org/ziglang/vscode-zig/src/commit/b4ab446da2400ec23a8dc27152865328f5da7ccc/src/zls.ts#L75-L83
async function stopClient(): Promise<void> {
    if (!client) return;
    const oldClient = client;
    client = undefined;
    await oldClient.stop(); // The `stop` call will send the "shutdown" notification to the LSP
    await oldClient.dispose(); // The `dipose` call will send the "exit" request to the LSP which actually tells the child process to exit
}

async function startClient(): Promise<void> {
    const serverOptions: ServerOptions = {
        command: caniplsExePath.fsPath,
        transport: TransportKind.stdio,
        options: {
            shell: true,
        },
    };

    const clientOptions: LanguageClientOptions = {
        documentSelector: [
            { scheme: "file", language: "html" },
            { scheme: "file", language: "css" },
            { scheme: "file", language: "javascript" },
            { scheme: "file", language: "typescript" },
            { scheme: "file", language: "javascriptreact" },
            { scheme: "file", language: "typescriptreact" },
            { scheme: "file", language: "vue" },
            { scheme: "file", language: "svelte" },
            { scheme: "file", language: "astro" },
        ],
    };

    client = new LanguageClient(
        "canipls",
        "canipls",
        serverOptions,
        clientOptions,
    );

    await client.start();
}

async function restartClient(): Promise<void> {
    await stopClient();
    await startClient();
}
