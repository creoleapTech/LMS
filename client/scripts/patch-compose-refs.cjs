/**
 * Patches @radix-ui/react-compose-refs to fix React 19 infinite loop bug.
 *
 * Two problems with the original code on React 19:
 *
 * 1. composeRefs cleanup called setRef(ref, null) for callback refs, which
 *    re-invoked the callback ref with null → could return yet another cleanup
 *    → infinite loop during commit phase.
 *
 * 2. useComposedRefs used React.useCallback(..., refs) where `refs` contained
 *    inline callback refs (new function identity each render). This made the
 *    composed ref unstable, so React detached + reattached it every render.
 *    If any of those callback refs called setState, each reattach triggered
 *    a re-render → infinite "Maximum update depth exceeded" loop.
 *
 * Fix:
 * - composeRefs: Only call stored cleanup functions during teardown. For
 *   callback refs that don't return a cleanup, do nothing (React 19 handles
 *   detach internally). For ref objects, set .current = null.
 * - useComposedRefs: Store refs in a mutable useRef and return a STABLE
 *   callback (empty deps). The callback always reads the latest refs,
 *   preventing React from ever seeing a new ref identity.
 */

const fs = require("fs");
const path = require("path");

const PATCHED_ESM = `// Patched by scripts/patch-compose-refs.cjs — React 19 compose-refs fix v2
import * as React from "react";

function composeRefs(...refs) {
  return (node) => {
    const cleanups = [];
    for (const ref of refs) {
      if (ref == null) continue;
      if (typeof ref === "function") {
        const maybeCleanup = ref(node);
        if (typeof maybeCleanup === "function") {
          cleanups.push(maybeCleanup);
        }
      } else {
        ref.current = node;
        cleanups.push(() => { ref.current = null; });
      }
    }
    return () => {
      for (const fn of cleanups) fn();
    };
  };
}

function useComposedRefs(...refs) {
  // Store the latest refs in a mutable ref so the callback identity is stable.
  const refsRef = React.useRef(refs);
  refsRef.current = refs;

  // Stable callback — React never sees a new function, so it never
  // detach-reattaches the ref between renders.
  return React.useCallback((node) => {
    return composeRefs(...refsRef.current)(node);
  }, []);
}

export { composeRefs, useComposedRefs };
`;

const PATCHED_CJS = `// Patched by scripts/patch-compose-refs.cjs — React 19 compose-refs fix v2
"use strict";
var React = require("react");

function composeRefs() {
  var refs = Array.prototype.slice.call(arguments);
  return function(node) {
    var cleanups = [];
    for (var i = 0; i < refs.length; i++) {
      var ref = refs[i];
      if (ref == null) continue;
      if (typeof ref === "function") {
        var maybeCleanup = ref(node);
        if (typeof maybeCleanup === "function") {
          cleanups.push(maybeCleanup);
        }
      } else {
        ref.current = node;
        cleanups.push((function(r) { return function() { r.current = null; }; })(ref));
      }
    }
    return function() {
      for (var j = 0; j < cleanups.length; j++) cleanups[j]();
    };
  };
}

function useComposedRefs() {
  var refs = Array.prototype.slice.call(arguments);
  var refsRef = React.useRef(refs);
  refsRef.current = refs;
  return React.useCallback(function(node) {
    return composeRefs.apply(null, refsRef.current)(node);
  }, []);
}

exports.composeRefs = composeRefs;
exports.useComposedRefs = useComposedRefs;
`;

function patchFile(filePath, content) {
  if (!fs.existsSync(filePath)) {
    console.log("  SKIP (not found):", filePath);
    return false;
  }
  fs.writeFileSync(filePath, content, "utf8");
  console.log("  PATCHED:", filePath);
  return true;
}

function findComposeRefsDirs(baseDir) {
  const dirs = [];

  const topLevel = path.join(baseDir, "node_modules", "@radix-ui", "react-compose-refs");
  if (fs.existsSync(topLevel)) dirs.push(topLevel);

  const radixDir = path.join(baseDir, "node_modules", "@radix-ui");
  if (fs.existsSync(radixDir)) {
    for (const pkg of fs.readdirSync(radixDir)) {
      const nested = path.join(radixDir, pkg, "node_modules", "@radix-ui", "react-compose-refs");
      if (fs.existsSync(nested)) dirs.push(nested);
    }
  }

  return [...new Set(dirs)];
}

const clientDir = path.resolve(__dirname, "..");
const dirs = findComposeRefsDirs(clientDir);

console.log(`Found ${dirs.length} compose-refs installation(s):`);

let patched = 0;
for (const dir of dirs) {
  console.log(`\n  ${dir}`);
  const esmPath = path.join(dir, "dist", "index.mjs");
  const cjsPath = path.join(dir, "dist", "index.js");

  if (patchFile(esmPath, PATCHED_ESM)) patched++;
  patchFile(cjsPath, PATCHED_CJS);
}

if (patched === 0 && dirs.length === 0) {
  console.log("No compose-refs found — nothing to patch.");
} else {
  console.log(`\nDone! Patched ${patched} installation(s).`);
}
