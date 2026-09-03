/**
 * Polyfills for modern JS APIs used by pdfjs-dist 5.x
 * Ensures PDFs load on older browsers / WebViews (e.g. Android Chrome < 129)
 * where Uint8Array.prototype.toHex / toBase64, Promise.withResolvers,
 * Set.prototype.intersection, etc. are missing.
 *
 * This file is imported at the very top of src/main.tsx so it runs before
 * any other module. The legacy pdfjs-dist build also bundles its own core-js
 * polyfills, but we keep these here as a safety net for the main thread and
 * for any code that runs before the legacy worker's polyfills initialise.
 */

// ─── Uint8Array.prototype.toHex ──────────────────────────────────────────
// TC39 proposal: https://github.com/tc39/proposal-arraybuffer-base64
// Used by pdfjs-dist for PDF fingerprinting (calculateMD5 / stringToBytes → toHex)
if (
  typeof Uint8Array !== "undefined" &&
  !(Uint8Array.prototype as unknown as { toHex?: unknown }).toHex
) {
  Object.defineProperty(Uint8Array.prototype, "toHex", {
    value: function (this: Uint8Array): string {
      let out = "";
      for (let i = 0; i < this.length; i++) {
        const hex = this[i].toString(16);
        out += hex.length === 1 ? "0" + hex : hex;
      }
      return out;
    },
    writable: true,
    configurable: true,
  });
}

// ─── Uint8Array.prototype.toBase64 ───────────────────────────────────────
// Used by pdfjs-dist for font embedding (createFontFaceRule → data.toBase64())
if (
  typeof Uint8Array !== "undefined" &&
  !(Uint8Array.prototype as unknown as { toBase64?: unknown }).toBase64
) {
  Object.defineProperty(Uint8Array.prototype, "toBase64", {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    value: function (this: Uint8Array, options?: any): string {
      const alphabet: string =
        options?.alphabet === "base64url"
          ? "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_"
          : "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
      const omitPadding: boolean = !!options?.omitPadding;

      let result = "";
      let i = 0;
      const length = this.length;

      const at = (shift: number, triplet: number): string =>
        alphabet.charAt((triplet >> (6 * shift)) & 63);

      for (; i + 2 < length; i += 3) {
        const triplet = (this[i] << 16) + (this[i + 1] << 8) + this[i + 2];
        result += at(3, triplet) + at(2, triplet) + at(1, triplet) + at(0, triplet);
      }
      if (i + 2 === length) {
        const triplet = (this[i] << 16) + (this[i + 1] << 8);
        result += at(3, triplet) + at(2, triplet) + at(1, triplet) + (omitPadding ? "" : "=");
      } else if (i + 1 === length) {
        const triplet = this[i] << 16;
        result += at(3, triplet) + at(2, triplet) + (omitPadding ? "" : "==");
      }
      return result;
    },
    writable: true,
    configurable: true,
  });
}

// ─── Uint8Array.fromHex / fromBase64 (static) ────────────────────────────
// Not currently required by pdfjs-dist, but cheap to add for completeness.
if (typeof Uint8Array !== "undefined" && !(Uint8Array as unknown as Record<string, unknown>).fromHex) {
  (Uint8Array as unknown as Record<string, unknown>).fromHex = function (hex: string): Uint8Array {
    if (typeof hex !== "string") throw new TypeError("fromHex: argument is not a string");
    if (hex.length % 2 !== 0) throw new SyntaxError("fromHex: odd length");
    const out = new Uint8Array(hex.length / 2);
    for (let i = 0; i < hex.length; i += 2) {
      const byte = parseInt(hex.slice(i, i + 2), 16);
      if (Number.isNaN(byte)) throw new SyntaxError("fromHex: invalid hex");
      out[i / 2] = byte;
    }
    return out;
  };
}

// ─── Promise.withResolvers ───────────────────────────────────────────────
// ES2024, required by pdfjs-dist worker (used for transport / stream handling)
if (typeof Promise !== "undefined" && !(Promise as unknown as Record<string, unknown>).withResolvers) {
  (Promise as unknown as Record<string, unknown>).withResolvers = function <T>() {
    let resolve!: (value: T | PromiseLike<T>) => void;
    let reject!: (reason?: unknown) => void;
    const promise = new Promise<T>((res, rej) => {
      resolve = res;
      reject = rej;
    });
    return { promise, resolve, reject };
  };
}

// ─── Set.prototype.intersection etc. ─────────────────────────────────────
// ES2025 Set methods used by pdfjs-dist structure-tree handling.
// Only polyfill if missing; simple correct implementation for small sets.
if (
  typeof Set !== "undefined" &&
  !(Set.prototype as unknown as { intersection?: unknown }).intersection
) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (Set.prototype as any).intersection = function <T>(other: Set<T>): Set<T> {
    const result = new Set<T>();
    for (const v of this as Set<T>) {
      if (other.has(v)) result.add(v);
    }
    return result;
  };
}
if (
  typeof Set !== "undefined" &&
  !(Set.prototype as unknown as { union?: unknown }).union
) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (Set.prototype as any).union = function <T>(other: Set<T>): Set<T> {
    const result = new Set<T>(this as Set<T>);
    for (const v of other) result.add(v);
    return result;
  };
}
if (
  typeof Set !== "undefined" &&
  !(Set.prototype as unknown as { difference?: unknown }).difference
) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (Set.prototype as any).difference = function <T>(other: Set<T>): Set<T> {
    const result = new Set<T>();
    for (const v of this as Set<T>) {
      if (!other.has(v)) result.add(v);
    }
    return result;
  };
}
if (
  typeof Set !== "undefined" &&
  !(Set.prototype as unknown as { symmetricDifference?: unknown }).symmetricDifference
) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (Set.prototype as any).symmetricDifference = function <T>(other: Set<T>): Set<T> {
    const result = new Set<T>();
    for (const v of this as Set<T>) if (!other.has(v)) result.add(v);
    for (const v of other) if (!(this as Set<T>).has(v)) result.add(v);
    return result;
  };
}
