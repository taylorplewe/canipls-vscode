import * as vscode from 'vscode';
import {
    LanguageClient,
    LanguageClientOptions,
    ServerOptions,
    TransportKind,
} from 'vscode-languageclient/node';
import extract from 'extract-zip';

let client: LanguageClient | undefined;

const CANIPLS_REPO = "taylorplewe/canipls";
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
        return true;
    }
}

export async function activate(context: vscode.ExtensionContext) {
    console.log('canipls activated');
    console.log('globalStorageUri:', context.globalStorageUri);

    // TODO: check if there's an installed version of canipls at globalStorage/taylorplewe.canipls/

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
    console.log('latest release res: ', latestReleaseResponse);

    const installedSemVer = new SemVer("0.0.0");
    const latestSemVer = new SemVer(latestReleaseResponse.name);

    if (latestSemVer.gt(installedSemVer)) {
        console.log('newer version available');
    }

    let latestArchiveUrl: string;
    let caniplsArchivePath: vscode.Uri = vscode.Uri.parse("");
    for (const asset of latestReleaseResponse.assets) {
        if (asset.name.indexOf(`${arch}-${os}`) !== -1) {
            console.log('asset url:', asset.url);
            const archiveRes = await fetch(asset.url, { headers: {"Accept": "application/octet-stream"} });
            console.log('content-length: ', archiveRes.headers.get("content-length"));
            const archiveData = Buffer.from(await archiveRes.arrayBuffer());
            caniplsArchivePath = vscode.Uri.joinPath(context.globalStorageUri, asset.name);

            // write archive to directory
            await vscode.workspace.fs.writeFile(caniplsArchivePath, archiveData);

            console.log('caniplsExePath:', caniplsArchivePath.fsPath);
            console.log('context.globalStorageUri:', context.globalStorageUri.toString());

            // extract zip
            await extract(caniplsArchivePath.fsPath, { dir: context.globalStorageUri.fsPath });

            console.log('extracted!');

            // cleanup (delete archive)
            await vscode.workspace.fs.delete(caniplsArchivePath);
        }
    }






    const caniplsExePath = vscode.Uri.joinPath(context.globalStorageUri, `canipls${process.platform === "win32" ? ".exe" : ""}`);
    console.log('running exe: ', caniplsExePath.fsPath);

    context.subscriptions.push(
        vscode.commands.registerCommand("canipls.restartLanguageServer", async () => {
            vscode.window.showInformationMessage("Ayyyy lmao");
        })
    );

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

export async function deactivate() {
    await client?.dispose();
    client = undefined;
}

// HELPFUL STUFF I MIGHT NEED
