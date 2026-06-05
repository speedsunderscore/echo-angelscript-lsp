import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';

interface BundlerSettings {
  source: string;
  output: string;
  strip: boolean;
}

/** Read the user's bundler settings from the workspace configuration. */
function readSettings(): BundlerSettings {
  const config = vscode.workspace.getConfiguration('echoAngelscript.bundler');
  return {
    source: config.get<string>('source', ''),
    output: config.get<string>('output', ''),
    strip: config.get<boolean>('strip', false),
  };
}

/**
 * Run the AngelScript bundler. If no source/output is configured yet,
 * offer to launch the configuration wizard instead of failing outright.
 */
export async function runBundle(): Promise<void> {
  const settings = readSettings();
  const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
  if (!workspaceFolder) {
    vscode.window.showErrorMessage('Echo AngelScript: open a folder before bundling.');
    return;
  }
  if (!settings.source || !settings.output) {
    const choice = await vscode.window.showWarningMessage(
      'The bundler is not configured yet.',
      'Configure now',
      'Cancel',
    );
    if (choice === 'Configure now') await configureBundler();
    return;
  }

  const root = workspaceFolder.uri.fsPath;
  const srcDir = resolveAgainst(root, settings.source);
  const outputFile = resolveAgainst(root, settings.output);

  try {
    const stat = await fs.promises.stat(srcDir);
    if (!stat.isDirectory()) {
      vscode.window.showErrorMessage(`Bundler source is not a directory: ${srcDir}`);
      return;
    }
  } catch {
    vscode.window.showErrorMessage(`Bundler source directory not found: ${srcDir}`);
    return;
  }

  // Flush every dirty editor to disk so the bundler reads the current
  // buffer contents rather than the last-saved version. saveAll(false)
  // skips untitled files (they have no path on disk).
  await vscode.workspace.saveAll(false);

  try {
    const fileCount = await bundle(srcDir, outputFile, settings.strip);
    vscode.window.showInformationMessage(
      `Bundled ${fileCount} file(s) to ${path.relative(root, outputFile) || outputFile}`,
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    vscode.window.showErrorMessage(`Bundler failed: ${msg}`);
  }
}

/**
 * Guided bundler setup. Uses VSCode's native folder / file pickers and
 * writes the results to the workspace's `.vscode/settings.json`.
 */
export async function configureBundler(): Promise<void> {
  const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
  if (!workspaceFolder) {
    vscode.window.showErrorMessage('Open a folder before configuring the bundler.');
    return;
  }
  const root = workspaceFolder.uri.fsPath;
  const current = readSettings();

  const sourceDefault = current.source
    ? resolveAgainst(root, current.source)
    : path.join(root, 'source');
  const sourcePick = await vscode.window.showOpenDialog({
    canSelectFiles: false,
    canSelectFolders: true,
    canSelectMany: false,
    openLabel: 'Use as bundler source',
    title: 'Bundler: pick the source folder containing your .as files',
    defaultUri: existsSync(sourceDefault) ? vscode.Uri.file(sourceDefault) : workspaceFolder.uri,
  });
  if (!sourcePick || sourcePick.length === 0) return;
  const sourcePath = relativeIfInside(sourcePick[0].fsPath, root);

  const outputDefault = current.output
    ? resolveAgainst(root, current.output)
    : path.join(root, 'bundled.as');
  const outputPick = await vscode.window.showSaveDialog({
    title: 'Bundler: pick the output .as file',
    saveLabel: 'Use as bundler output',
    filters: { 'AngelScript': ['as'] },
    defaultUri: vscode.Uri.file(outputDefault),
  });
  if (!outputPick) return;
  const outputPath = relativeIfInside(outputPick.fsPath, root);

  const stripPick = await vscode.window.showQuickPick(
    [
      { label: 'Keep comments', description: 'Bundled output retains comment-only lines', value: false },
      { label: 'Strip comments', description: 'Remove comment-only lines from the bundled output', value: true },
    ],
    { title: 'Bundler: strip comments?', placeHolder: 'Choose how to handle comment-only lines' },
  );
  if (!stripPick) return;

  const config = vscode.workspace.getConfiguration('echoAngelscript.bundler');
  await config.update('source', sourcePath, vscode.ConfigurationTarget.Workspace);
  await config.update('output', outputPath, vscode.ConfigurationTarget.Workspace);
  await config.update('strip', stripPick.value, vscode.ConfigurationTarget.Workspace);

  const runChoice = await vscode.window.showInformationMessage(
    `Bundler configured. Source: ${sourcePath}, output: ${outputPath}, strip: ${stripPick.value}.`,
    'Run bundle now',
    'Done',
  );
  if (runChoice === 'Run bundle now') await runBundle();
}

// ---------------------------------------------------------------------------
// Bundling implementation
// ---------------------------------------------------------------------------

async function bundle(srcDir: string, outputFile: string, stripComments: boolean): Promise<number> {
  const visited = new Set<string>();
  const processing = new Set<string>();
  const fileOrder: string[] = [];

  const allFiles = await collectAsFiles(srcDir);
  for (const file of allFiles) {
    await processFile(file, [], visited, processing, fileOrder);
  }

  const parts: string[] = [];
  for (const file of fileOrder) {
    let content = await fs.promises.readFile(file, 'utf8');
    content = stripIncludes(content);
    if (stripComments) content = stripCommentLines(content);
    content = content.trim();
    if (content.length > 0) {
      const rel = path.relative(srcDir, file).split(path.sep).join('/');
      parts.push(`// File: ${rel}\n${content}`);
    }
  }

  const bundled = parts.join('\n\n');
  await fs.promises.mkdir(path.dirname(outputFile), { recursive: true });
  await fs.promises.writeFile(outputFile, bundled);
  return visited.size;
}

async function collectAsFiles(dir: string): Promise<string[]> {
  const out: string[] = [];
  async function walk(d: string): Promise<void> {
    const entries = await fs.promises.readdir(d, { withFileTypes: true });
    for (const e of entries) {
      const full = path.join(d, e.name);
      if (e.isDirectory()) {
        if (e.name.startsWith('.') || e.name === 'node_modules') continue;
        await walk(full);
      } else if (e.isFile() && e.name.endsWith('.as')) {
        out.push(full);
      }
    }
  }
  await walk(dir);
  return out;
}

async function processFile(
  file: string,
  chain: string[],
  visited: Set<string>,
  processing: Set<string>,
  fileOrder: string[],
): Promise<void> {
  const norm = path.resolve(file);
  if (visited.has(norm)) return;
  if (processing.has(norm)) {
    const trail = [...chain, norm].join('\n  -> ');
    throw new Error(`Circular dependency:\n  -> ${trail}`);
  }

  try {
    await fs.promises.access(norm);
  } catch {
    const parent = chain.length > 0 ? `\n  Referenced from: ${chain[chain.length - 1]}` : '';
    throw new Error(`File not found: ${norm}${parent}`);
  }

  processing.add(norm);
  visited.add(norm);

  const content = await fs.promises.readFile(norm, 'utf8');
  const includes = parseIncludes(content);
  const fileDir = path.dirname(norm);

  for (const inc of includes) {
    const incPath = path.resolve(fileDir, inc);
    await processFile(incPath, [...chain, norm], visited, processing, fileOrder);
  }

  processing.delete(norm);
  fileOrder.push(norm);
}

function parseIncludes(content: string): string[] {
  const out: string[] = [];
  const re = /#include\s+"([^"]+)"/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(content)) !== null) {
    out.push(match[1]);
  }
  return out;
}

function stripIncludes(content: string): string {
  return content.replace(/#include\s+"[^"]+"\s*/g, '');
}

function stripCommentLines(content: string): string {
  let out = content;
  out = out.replace(/^[^\S\r\n]*\/\/.*$/gm, '');
  out = out.replace(/^[^\S\r\n]*\/\*[\s\S]*?\*\/[^\S\r\n]*$/gm, '');
  out = out.replace(/(\r?\n){3,}/g, '\n\n');
  return out;
}

// ---------------------------------------------------------------------------
// Path helpers
// ---------------------------------------------------------------------------

function resolveAgainst(root: string, p: string): string {
  return path.isAbsolute(p) ? p : path.join(root, p);
}

/**
 * If `target` lives inside `root`, return a forward-slash relative path;
 * otherwise return the absolute path. Keeps workspace settings portable
 * across machines for in-project paths while still allowing absolute
 * external outputs.
 */
function relativeIfInside(target: string, root: string): string {
  const rel = path.relative(root, target);
  if (!rel || rel.startsWith('..') || path.isAbsolute(rel)) {
    return target.split(path.sep).join('/');
  }
  return rel.split(path.sep).join('/');
}

function existsSync(p: string): boolean {
  try {
    fs.accessSync(p);
    return true;
  } catch {
    return false;
  }
}
