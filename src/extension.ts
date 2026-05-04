import * as vscode from 'vscode';
import {
    LanguageClient,
    LanguageClientOptions,
    ServerOptions,
    TransportKind,
} from 'vscode-languageclient/node';

let client: LanguageClient;

export function activate(context: vscode.ExtensionContext) {
    context.subscriptions.push(
        vscode.commands.registerCommand("caniuse-ls.restartLanguageServer", async () => {
            vscode.window.showInformationMessage("Ayyyy lmao");
        })
    );

    const exeName = "caniuse-ls" + (process.platform === "win32" ? ".exe" : "");

    const serverOptions: ServerOptions = {
        command: exeName,
        transport: TransportKind.stdio,
        options: {
            shell: true,
        },
    };

    const clientOptions: LanguageClientOptions = {
        documentSelector: [
            { scheme: "file", language: "HTML" },
            { scheme: "file", language: "CSS" },
            { scheme: "file", language: "JavaScript" },
            { scheme: "file", language: "TypeScript" },
            { scheme: "file", language: "JavaScript JSX" },
            { scheme: "file", language: "TypeScript JSX" },
            { scheme: "file", language: "vue" },
            { scheme: "file", language: "Svelte" },
            { scheme: "file", language: "Astro" },
        ],
    };

    client = new LanguageClient(
        "caniuse-ls",
        "CanIUse LS",
        serverOptions,
        clientOptions,
    );

    console.log('here?')
    client.start();
}

export function deactivate() {
    if (client) client.stop();
}
