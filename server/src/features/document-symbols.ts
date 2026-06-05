import { DocumentSymbol, SymbolKind } from 'vscode-languageserver/node';
import {
  ClassDecl,
  Declaration,
  EnumDecl,
  EnumMember,
  FuncDefDecl,
  FunctionDecl,
  InterfaceDecl,
  Module,
  NamespaceDecl,
  NodeBase,
  TypeDefDecl,
  TypeRef,
  VariableDecl,
} from '../parser';

/** Build the outline (Ctrl+Shift+O) for a parsed AS module. */
export function buildDocumentSymbols(module: Module): DocumentSymbol[] {
  return module.declarations.flatMap(symbolsFor);
}

function symbolsFor(decl: Declaration): DocumentSymbol[] {
  switch (decl.kind) {
    case 'ClassDecl':     return [classSymbol(decl)];
    case 'InterfaceDecl': return [interfaceSymbol(decl)];
    case 'EnumDecl':      return [enumSymbol(decl)];
    case 'NamespaceDecl': return [namespaceSymbol(decl)];
    case 'FunctionDecl':  return [functionSymbol(decl, /* method */ false)];
    case 'VariableDecl':  return [variableSymbol(decl, /* field */ false)];
    case 'FuncDefDecl':   return [funcDefSymbol(decl)];
    case 'TypeDefDecl':   return [typeDefSymbol(decl)];
    case 'ImportDecl':    return symbolsFor(decl.signature);
  }
}

function classSymbol(decl: ClassDecl): DocumentSymbol {
  return {
    name: decl.name,
    detail: decl.bases.length ? `: ${decl.bases.join(', ')}` : '',
    kind: SymbolKind.Class,
    range: rangeOf(decl),
    selectionRange: rangeOf(decl),
    children: decl.members.flatMap(m => memberSymbol(m)),
  };
}

function interfaceSymbol(decl: InterfaceDecl): DocumentSymbol {
  return {
    name: decl.name,
    detail: decl.bases.length ? `: ${decl.bases.join(', ')}` : '',
    kind: SymbolKind.Interface,
    range: rangeOf(decl),
    selectionRange: rangeOf(decl),
    children: decl.members.flatMap(m => memberSymbol(m)),
  };
}

function enumSymbol(decl: EnumDecl): DocumentSymbol {
  return {
    name: decl.name,
    detail: '',
    kind: SymbolKind.Enum,
    range: rangeOf(decl),
    selectionRange: rangeOf(decl),
    children: decl.members.map(enumMemberSymbol),
  };
}

function enumMemberSymbol(member: EnumMember): DocumentSymbol {
  return {
    name: member.name,
    detail: '',
    kind: SymbolKind.EnumMember,
    range: rangeOf(member),
    selectionRange: rangeOf(member),
  };
}

function namespaceSymbol(decl: NamespaceDecl): DocumentSymbol {
  return {
    name: decl.name.join('::'),
    detail: '',
    kind: SymbolKind.Namespace,
    range: rangeOf(decl),
    selectionRange: rangeOf(decl),
    children: decl.declarations.flatMap(symbolsFor),
  };
}

function functionSymbol(decl: FunctionDecl, isMethod: boolean): DocumentSymbol {
  const params = decl.params.map(p => formatTypeRef(p.type) + (p.name ? ` ${p.name}` : '')).join(', ');
  const ret = decl.returnType ? formatTypeRef(decl.returnType) + ' ' : '';
  const sig = `${ret}(${params})${decl.isConst ? ' const' : ''}`;
  // Constructor / destructor -- name starts with class name or ~.
  const isCtorDtor = decl.returnType === null;
  return {
    name: decl.name,
    detail: sig,
    kind: isCtorDtor
      ? SymbolKind.Constructor
      : (isMethod ? SymbolKind.Method : SymbolKind.Function),
    range: rangeOf(decl),
    selectionRange: rangeOf(decl),
  };
}

function variableSymbol(decl: VariableDecl, isField: boolean): DocumentSymbol {
  return {
    name: decl.name,
    detail: formatTypeRef(decl.type),
    kind: isField ? SymbolKind.Field : SymbolKind.Variable,
    range: rangeOf(decl),
    selectionRange: rangeOf(decl),
  };
}

function funcDefSymbol(decl: FuncDefDecl): DocumentSymbol {
  const params = decl.params.map(p => formatTypeRef(p.type)).join(', ');
  return {
    name: decl.name,
    detail: `funcdef ${formatTypeRef(decl.returnType)}(${params})`,
    kind: SymbolKind.Function,
    range: rangeOf(decl),
    selectionRange: rangeOf(decl),
  };
}

function typeDefSymbol(decl: TypeDefDecl): DocumentSymbol {
  return {
    name: decl.name,
    detail: `= ${formatTypeRef(decl.aliased)}`,
    kind: SymbolKind.TypeParameter,
    range: rangeOf(decl),
    selectionRange: rangeOf(decl),
  };
}

function memberSymbol(decl: Declaration): DocumentSymbol[] {
  switch (decl.kind) {
    case 'FunctionDecl': return [functionSymbol(decl, /* method */ true)];
    case 'VariableDecl': return [variableSymbol(decl, /* field */ true)];
    case 'EnumDecl':     return [enumSymbol(decl)];
    case 'FuncDefDecl':  return [funcDefSymbol(decl)];
    case 'TypeDefDecl':  return [typeDefSymbol(decl)];
    // Nested classes/interfaces are rare in AS but the parser allows them.
    case 'ClassDecl':    return [classSymbol(decl)];
    case 'InterfaceDecl':return [interfaceSymbol(decl)];
    default:             return symbolsFor(decl);
  }
}

function rangeOf(n: NodeBase) {
  return {
    start: { line: n.startPos.line, character: n.startPos.column },
    end:   { line: n.endPos.line,   character: n.endPos.column },
  };
}

function formatTypeRef(t: TypeRef): string {
  let s = '';
  if (t.isConst) s += 'const ';
  s += t.name.join('::');
  if (t.templateArgs.length) {
    s += '<' + t.templateArgs.map(formatTypeRef).join(', ') + '>';
  }
  for (let i = 0; i < t.arrayDepth; i++) s += '[]';
  if (t.isHandle) s += t.isHandleConst ? '@+' : '@';
  if (t.isReference) s += '&';
  return s;
}
