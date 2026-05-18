import * as vscode from 'vscode';
import {
    LanguageClient,
    LanguageClientOptions,
    ServerOptions,
    TransportKind,
} from 'vscode-languageclient/node';

let client: LanguageClient | undefined;

export async function activate(context: vscode.ExtensionContext) {
    console.log('canipls activated');

    context.subscriptions.push(
        vscode.commands.registerCommand("canipls.restartLanguageServer", async () => {
            vscode.window.showInformationMessage("Ayyyy lmao");
        })
    );

    const exeName = "C:\\Users\\tplew\\webroot\\canipls\\zig-out\\bin\\canipls.exe";

    const serverOptions: ServerOptions = {
        command: exeName,
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
