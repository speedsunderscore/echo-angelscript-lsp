import * as path from 'path';
import { commands, ExtensionContext, workspace } from 'vscode';
import {
  LanguageClient,
  LanguageClientOptions,
  ServerOptions,
  TransportKind,
} from 'vscode-languageclient/node';
import { configureBundler, runBundle } from './bundler';

let client: LanguageClient | undefined;

export function activate(context: ExtensionContext): void {
  const serverModule = context.asAbsolutePath(
    path.join('server', 'out', 'server.js'),
  );

  const debugOptions = { execArgv: ['--nolazy', '--inspect=6009'] };

  const serverOptions: ServerOptions = {
    run: { module: serverModule, transport: TransportKind.ipc },
    debug: {
      module: serverModule,
      transport: TransportKind.ipc,
      options: debugOptions,
    },
  };

  const clientOptions: LanguageClientOptions = {
    documentSelector: [{ scheme: 'file', language: 'angelscript' }],
    synchronize: {
      configurationSection: 'echoAngelscript',
      fileEvents: workspace.createFileSystemWatcher('**/*.as'),
    },
  };

  client = new LanguageClient(
    'echoAngelscript',
    'Echo AngelScript Language Server',
    serverOptions,
    clientOptions,
  );

  client.start();

  context.subscriptions.push(
    commands.registerCommand('echoAngelscript.bundle', runBundle),
    commands.registerCommand('echoAngelscript.configureBundler', configureBundler),
  );
}

export function deactivate(): Thenable<void> | undefined {
  if (!client) {
    return undefined;
  }
  return client.stop();
}
