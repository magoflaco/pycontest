// src/lib/highlight.js — Lightweight Python syntax highlighter
// Produces HTML with span classes matching the CSS in main.css

const PY_KEYWORDS = new Set([
  "def", "return", "if", "elif", "else", "for", "while", "import", "from",
  "class", "in", "not", "and", "or", "is", "try", "except", "finally",
  "with", "as", "yield", "raise", "pass", "break", "continue", "lambda",
  "True", "False", "None", "del", "global", "nonlocal", "assert", "async", "await",
]);

const PY_BUILTINS = new Set([
  "print", "input", "len", "range", "int", "str", "float", "list", "dict",
  "set", "tuple", "type", "open", "map", "filter", "sorted", "enumerate",
  "zip", "any", "all", "min", "max", "sum", "abs", "round", "bool",
  "isinstance", "issubclass", "hasattr", "getattr", "setattr", "repr",
  "format", "hex", "oct", "bin", "chr", "ord", "reversed", "super",
  "next", "iter", "staticmethod", "classmethod", "property",
]);

/**
 * Highlight Python code and return HTML string.
 * Light enough for browser use — no dependencies.
 */
export function highlightPython(code) {
  if (!code) return "";
  const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const tokens = tokenize(code);
  return tokens.map((t) => {
    const text = esc(t.value);
    switch (t.type) {
      case "keyword":   return `<span class="kw">${text}</span>`;
      case "builtin":   return `<span class="bi">${text}</span>`;
      case "string":    return `<span class="str">${text}</span>`;
      case "number":    return `<span class="num">${text}</span>`;
      case "comment":   return `<span class="cm">${text}</span>`;
      case "decorator": return `<span class="dec">${text}</span>`;
      case "function":  return `<span class="fn">${text}</span>`;
      case "paren":     return `<span class="par">${text}</span>`;
      case "operator":  return `<span class="op">${text}</span>`;
      default:          return text;
    }
  }).join("");
}

function tokenize(code) {
  const tokens = [];
  let i = 0;
  const len = code.length;

  while (i < len) {
    const ch = code[i];

    // Comments
    if (ch === "#") {
      let end = code.indexOf("\n", i);
      if (end === -1) end = len;
      tokens.push({ type: "comment", value: code.slice(i, end) });
      i = end;
      continue;
    }

    // Strings (single, double, triple-quoted)
    if (ch === '"' || ch === "'") {
      const triple = code.slice(i, i + 3);
      let end;
      if (triple === '"""' || triple === "'''") {
        end = code.indexOf(triple, i + 3);
        end = end === -1 ? len : end + 3;
      } else {
        end = i + 1;
        while (end < len && code[end] !== ch) {
          if (code[end] === "\\") end++;
          end++;
        }
        end = Math.min(end + 1, len);
      }
      tokens.push({ type: "string", value: code.slice(i, end) });
      i = end;
      continue;
    }

    // f-strings (basic: just treat as string)
    if ((ch === "f" || ch === "r" || ch === "b") && (code[i + 1] === '"' || code[i + 1] === "'")) {
      const q = code[i + 1];
      let end = i + 2;
      while (end < len && code[end] !== q) {
        if (code[end] === "\\") end++;
        end++;
      }
      end = Math.min(end + 1, len);
      tokens.push({ type: "string", value: code.slice(i, end) });
      i = end;
      continue;
    }

    // Numbers
    if (/\d/.test(ch) || (ch === "." && i + 1 < len && /\d/.test(code[i + 1]))) {
      let end = i;
      if (code.slice(i, i + 2) === "0x" || code.slice(i, i + 2) === "0X") {
        end = i + 2;
        while (end < len && /[0-9a-fA-F_]/.test(code[end])) end++;
      } else {
        while (end < len && /[\d._eE+-]/.test(code[end])) end++;
      }
      tokens.push({ type: "number", value: code.slice(i, end) });
      i = end;
      continue;
    }

    // Decorators
    if (ch === "@" && (i === 0 || /\n/.test(code[i - 1]))) {
      let end = i + 1;
      while (end < len && /[\w.]/.test(code[end])) end++;
      tokens.push({ type: "decorator", value: code.slice(i, end) });
      i = end;
      continue;
    }

    // Parentheses / brackets
    if ("()[]{}".includes(ch)) {
      tokens.push({ type: "paren", value: ch });
      i++;
      continue;
    }

    // Operators
    if ("+-*/%=<>!&|^~:".includes(ch)) {
      let end = i + 1;
      while (end < len && "+-*/%=<>!&|^~".includes(code[end])) end++;
      tokens.push({ type: "operator", value: code.slice(i, end) });
      i = end;
      continue;
    }

    // Words (identifiers, keywords, builtins)
    if (/[a-zA-Z_]/.test(ch)) {
      let end = i + 1;
      while (end < len && /[\w]/.test(code[end])) end++;
      const word = code.slice(i, end);

      if (PY_KEYWORDS.has(word)) {
        tokens.push({ type: "keyword", value: word });
      } else if (PY_BUILTINS.has(word)) {
        tokens.push({ type: "builtin", value: word });
      } else if (end < len && code[end] === "(") {
        // Check if previous token was "def" or "class"
        const prevToken = tokens.length > 0 ? tokens[tokens.length - 1] : null;
        const prevNonWs = findPrevNonWhitespace(tokens);
        if (prevNonWs && prevNonWs.value === "def") {
          tokens.push({ type: "function", value: word });
        } else {
          tokens.push({ type: "builtin", value: word }); // function call
        }
      } else {
        tokens.push({ type: "text", value: word });
      }
      i = end;
      continue;
    }

    // Whitespace and other
    tokens.push({ type: "text", value: ch });
    i++;
  }

  return tokens;
}

function findPrevNonWhitespace(tokens) {
  for (let i = tokens.length - 1; i >= 0; i--) {
    if (tokens[i].value.trim()) return tokens[i];
  }
  return null;
}

/**
 * Render a code block with syntax highlighting.
 * Returns an HTML string using .code-highlight class.
 */
export function codeBlock(code, lang = "python") {
  if (lang === "python" || lang === "py") {
    return `<div class="code-highlight">${highlightPython(code)}</div>`;
  }
  // For other languages, just escape and wrap
  const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  return `<div class="code-highlight">${esc(code)}</div>`;
}
