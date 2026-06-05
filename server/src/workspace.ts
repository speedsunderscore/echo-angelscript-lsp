import * as fs from 'fs';
import * as path from 'path';
import { pathToFileURL, fileURLToPath } from 'url';
import {
  Analyzer,
  AnalyzerResult,
  Reference,
  Scope,
  Sym,
  TypeChecker,
  TypeCheckResult,
} from './analyzer';
import { Lexer, Module, Parser } from './parser';

const IGNORED_DIR_NAMES = new Set(['node_modules', '.git', '.svn', 'out', 'dist', 'build']);

export interface FileState {
  uri: string;
  source: string;
  module: Module;
  analysis: AnalyzerResult;
  types: TypeCheckResult;
  /** Combined references for LSP features. */
  references: Reference[];
}

/**
 * Tracks every `.as` file in the workspace and the API scope, runs a
 * two-round analysis so cross-file references (e.g. `relay::on_load` in
 * main.as resolving to relay.as) work, and serves cached per-file state
 * to the LSP feature handlers.
 *
 * Round 1: parse + analyze each file in isolation against the API scope,
 *          populating each file's globalScope so other files can see into it.
 * Round 2: re-analyze each file with an externalLookup callback that
 *          consults every OTHER file's globalScope for top-level names.
 *          This is the result we cache.
 *
 * Re-analysis is full on every file change -- slow for huge projects, fine
 * for typical script trees. Easy to optimize later if needed.
 */
export class Workspace {
  private readonly apiScope: Scope;
  /** Map of file URI -> latest source text (from disk or LSP-tracked). */
  private readonly fileSources = new Map<string, string>();
  /** Per-file cached analysis (the round-2 result). */
  private readonly fileStates = new Map<string, FileState>();

  constructor(apiScope: Scope) {
    this.apiScope = apiScope;
  }

  /** Discover every `.as` file under the given workspace folder URIs. */
  async discover(folderUris: string[]): Promise<void> {
    for (const uri of folderUris) {
      const folderPath = safeFileUriToPath(uri);
      if (folderPath) await this.scanFolder(folderPath);
    }
    this.analyzeAll();
  }

  /** Update a file's source text (from didOpen / didChange) and re-analyze. */
  setFile(uri: string, source: string): void {
    this.fileSources.set(uri, source);
    this.analyzeAll();
  }

  /** Forget a file (from didClose without saved disk content). */
  removeFile(uri: string): void {
    if (this.fileSources.delete(uri)) {
      this.fileStates.delete(uri);
      this.analyzeAll();
    }
  }

  getFile(uri: string): FileState | undefined {
    return this.fileStates.get(uri);
  }

  // -------------------------------------------------------------------------

  private async scanFolder(folder: string): Promise<void> {
    let entries: fs.Dirent[];
    try {
      entries = await fs.promises.readdir(folder, { withFileTypes: true });
    } catch {
      return;
    }
    for (const e of entries) {
      const full = path.join(folder, e.name);
      if (e.isDirectory()) {
        if (e.name.startsWith('.') || IGNORED_DIR_NAMES.has(e.name)) continue;
        await this.scanFolder(full);
      } else if (e.isFile() && e.name.endsWith('.as')) {
        try {
          const content = await fs.promises.readFile(full, 'utf8');
          const uri = pathToFileURL(full).toString();
          // Don't clobber LSP-tracked content if it's already set.
          if (!this.fileSources.has(uri)) {
            this.fileSources.set(uri, content);
          }
        } catch {
          /* ignore unreadable files */
        }
      }
    }
  }

  /** Run the two-round analysis across every tracked file. */
  private analyzeAll(): void {
    // Parse every file once.
    interface Parsed { uri: string; source: string; module: Module; }
    const parsed: Parsed[] = [];
    for (const [uri, source] of this.fileSources) {
      try {
        const { tokens, docs } = new Lexer(source).tokenize();
        const { module } = new Parser(tokens, docs).parse();
        parsed.push({ uri, source, module });
      } catch {
        /* skip -- recovery should keep this from happening */
      }
    }

    // Round 1: analyze each file in isolation, JUST to populate per-file
    // global scopes so round 2's externalLookup has something to consult.
    this.fileStates.clear();
    for (const p of parsed) {
      const analysis = new Analyzer(p.uri).analyze(p.module, this.apiScope);
      this.fileStates.set(p.uri, {
        uri: p.uri,
        source: p.source,
        module: p.module,
        analysis,
        // Types/references get overwritten in round 2; placeholders for now.
        types: { types: new Map(), resolvedMemberCount: 0 } as TypeCheckResult,
        references: analysis.references,
      });
    }

    // Round 2: re-analyze with a cross-file fallback for top-level names.
    for (const p of parsed) {
      const analyzer = new Analyzer(p.uri, (name) => this.externalLookup(name, p.uri));
      const analysis = analyzer.analyze(p.module, this.apiScope);
      const types = new TypeChecker().check(p.module, analysis.global, analysis.references);
      this.fileStates.set(p.uri, {
        uri: p.uri,
        source: p.source,
        module: p.module,
        analysis,
        types,
        references: analysis.references,
      });
    }
  }

  /** Find a top-level symbol named `name` in any file other than `excludeUri`. */
  private externalLookup(name: string, excludeUri: string): Sym | null {
    for (const [uri, state] of this.fileStates) {
      if (uri === excludeUri) continue;
      const hit = state.analysis.global.lookupLocal(name);
      if (hit && hit.length > 0) return hit[0];
    }
    return null;
  }
}

function safeFileUriToPath(uri: string): string | null {
  try {
    return fileURLToPath(uri);
  } catch {
    return null;
  }
}
