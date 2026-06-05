import {
  CompletionParams,
  createConnection,
  Diagnostic,
  DiagnosticSeverity,
  DidChangeConfigurationNotification,
  DocumentHighlightParams,
  DocumentSymbolParams,
  HoverParams,
  InitializeParams,
  InitializeResult,
  DefinitionParams,
  ProposedFeatures,
  ReferenceParams,
  SignatureHelpParams,
  TextDocuments,
  TextDocumentSyncKind,
} from 'vscode-languageserver/node';
import { TextDocument } from 'vscode-languageserver-textdocument';
import { Lexer, Parser } from './parser';
import { loadApiScope } from './api';
import { Workspace } from './workspace';
import { buildDocumentSymbols } from './features/document-symbols';
import { findDefinition } from './features/definition';
import { findReferences } from './features/references';
import { findDocumentHighlights } from './features/document-highlight';
import { findHover } from './features/hover';
import { findCompletions } from './features/completion';
import { findSignatureHelp } from './features/signature-help';
import { computeSemanticTokens, SEMANTIC_TOKENS_LEGEND } from './features/semantic-tokens';

const connection = createConnection(ProposedFeatures.all);
const documents = new TextDocuments(TextDocument);

interface Settings {
  maxNumberOfProblems: number;
}

const DEFAULT_SETTINGS: Settings = { maxNumberOfProblems: 1000 };
let globalSettings: Settings = DEFAULT_SETTINGS;
let hasConfigurationCapability = false;

let workspace: Workspace | null = null;
let workspaceFolderUris: string[] = [];

connection.onInitialize((params: InitializeParams): InitializeResult => {
  const caps = params.capabilities;
  hasConfigurationCapability = !!caps.workspace?.configuration;

  workspaceFolderUris = (params.workspaceFolders ?? []).map(f => f.uri);
  // Older clients use rootUri.
  if (workspaceFolderUris.length === 0 && params.rootUri) {
    workspaceFolderUris = [params.rootUri];
  }

  return {
    capabilities: {
      textDocumentSync: TextDocumentSyncKind.Incremental,
      documentSymbolProvider: true,
      definitionProvider: true,
      referencesProvider: true,
      documentHighlightProvider: true,
      hoverProvider: true,
      completionProvider: {
        triggerCharacters: ['.', ':'],
      },
      signatureHelpProvider: {
        triggerCharacters: ['(', ','],
        retriggerCharacters: [')'],
      },
      semanticTokensProvider: {
        legend: SEMANTIC_TOKENS_LEGEND,
        full: true,
      },
    },
  };
});

connection.onInitialized(async () => {
  if (hasConfigurationCapability) {
    connection.client.register(DidChangeConfigurationNotification.type, undefined);
  }
  const apiScope = loadApiScope();
  workspace = new Workspace(apiScope);
  await workspace.discover(workspaceFolderUris);
  connection.console.log(
    `Echo AngelScript LSP: initialized; tracking ${workspaceFolderUris.length} folder(s).`,
  );
  // Push diagnostics for any open documents now that the workspace is ready.
  for (const doc of documents.all()) {
    workspace.setFile(doc.uri, doc.getText());
    publishDiagnostics(doc.uri);
  }
});

connection.onDidChangeConfiguration(async (change) => {
  const incoming = (change.settings?.echoAngelscript ?? {}) as Partial<Settings>;
  globalSettings = { ...DEFAULT_SETTINGS, ...incoming };
  for (const doc of documents.all()) {
    publishDiagnostics(doc.uri);
  }
});

documents.onDidOpen((e) => {
  if (!workspace) return;
  workspace.setFile(e.document.uri, e.document.getText());
  publishDiagnostics(e.document.uri);
});

documents.onDidChangeContent((change) => {
  if (!workspace) return;
  workspace.setFile(change.document.uri, change.document.getText());
  publishDiagnostics(change.document.uri);
});

documents.onDidClose((e) => {
  // Keep the file in the workspace cache (last LSP-tracked content is still
  // valid until the on-disk content drifts). Just clear its diagnostics.
  connection.sendDiagnostics({ uri: e.document.uri, diagnostics: [] });
});

connection.onDocumentSymbol((params: DocumentSymbolParams) => {
  const state = workspace?.getFile(params.textDocument.uri);
  return state ? buildDocumentSymbols(state.module) : [];
});

connection.onDefinition((params: DefinitionParams) => {
  const state = workspace?.getFile(params.textDocument.uri);
  if (!state) return [];
  return findDefinition(params.textDocument.uri, params.position, state.references);
});

connection.onReferences((params: ReferenceParams) => {
  const state = workspace?.getFile(params.textDocument.uri);
  if (!state) return [];
  return findReferences(
    params.textDocument.uri,
    params.position,
    state.references,
    params.context.includeDeclaration,
  );
});

connection.onDocumentHighlight((params: DocumentHighlightParams) => {
  const state = workspace?.getFile(params.textDocument.uri);
  if (!state) return [];
  return findDocumentHighlights(params.position, state.references);
});

connection.onHover((params: HoverParams) => {
  const state = workspace?.getFile(params.textDocument.uri);
  if (!state) return null;
  return findHover(params.position, state.references);
});

connection.onCompletion((params: CompletionParams) => {
  const state = workspace?.getFile(params.textDocument.uri);
  const doc = documents.get(params.textDocument.uri);
  if (!state || !doc) return [];
  const offset = doc.offsetAt(params.position);
  return findCompletions(doc.getText(), offset, params.position, state.analysis.global);
});

connection.onSignatureHelp((params: SignatureHelpParams) => {
  const state = workspace?.getFile(params.textDocument.uri);
  const doc = documents.get(params.textDocument.uri);
  if (!state || !doc) return null;
  const offset = doc.offsetAt(params.position);
  return findSignatureHelp(doc.getText(), offset, state.analysis.global);
});

connection.languages.semanticTokens.on((params) => {
  const state = workspace?.getFile(params.textDocument.uri);
  if (!state) return { data: [] };
  return computeSemanticTokens(state.references);
});

function publishDiagnostics(uri: string): void {
  const doc = documents.get(uri);
  if (!doc) return;

  const text = doc.getText();
  const diagnostics: Diagnostic[] = [];

  const { tokens, errors: lexErrors, docs } = new Lexer(text).tokenize();
  const { errors: parseErrors } = new Parser(tokens, docs).parse();

  const limit = globalSettings.maxNumberOfProblems;
  for (const e of lexErrors) {
    if (diagnostics.length >= limit) break;
    diagnostics.push({
      severity: DiagnosticSeverity.Error,
      range: {
        start: { line: e.startPos.line, character: e.startPos.column },
        end: { line: e.endPos.line, character: e.endPos.column },
      },
      message: e.message,
      source: 'echo-angelscript',
    });
  }
  for (const e of parseErrors) {
    if (diagnostics.length >= limit) break;
    diagnostics.push({
      severity: DiagnosticSeverity.Error,
      range: {
        start: { line: e.startPos.line, character: e.startPos.column },
        end: { line: e.endPos.line, character: e.endPos.column },
      },
      message: e.message,
      source: 'echo-angelscript',
    });
  }

  connection.sendDiagnostics({ uri, diagnostics });
}

documents.listen(connection);
connection.listen();
