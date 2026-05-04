import { Parser } from "expr-eval";

export interface FormulaContext {
  /** Map of column name → numeric value for the current row */
  values: Record<string, number>;
}

export interface FormulaResult {
  value: number | null;
  error: string | null;
}

/**
 * Sanitizes a string by replacing spaces with underscores.
 * Column names may contain spaces; this normalizes them for expr-eval.
 */
function sanitizeName(name: string): string {
  return name.replace(/ /g, "_");
}

/**
 * Sanitizes an expression by replacing spaces within multi-word identifiers
 * (column names) with underscores, while preserving spaces around operators.
 *
 * Strategy: replace sequences of word-chars + spaces + word-chars that look
 * like multi-word identifiers. We do this by replacing spaces that are
 * surrounded by word characters on both sides (i.e., spaces inside identifiers).
 */
function sanitizeExpression(expression: string): string {
  // Replace spaces that are between word characters (identifier spaces)
  // This handles "Math Score" → "Math_Score" while leaving "a + b" intact.
  return expression.replace(/(\w) (?=\w)/g, "$1_");
}

/**
 * Evaluates a formula expression string against a row context.
 * Uses expr-eval under the hood — no eval().
 *
 * - Column names with spaces are sanitized (spaces → underscores) in both
 *   the expression and the context keys before evaluation.
 * - Missing context keys resolve to 0.
 * - Division by zero returns { value: null, error: "Division by zero" }.
 * - Any other error returns { value: null, error: errorMessage }.
 */
export function evaluateFormula(
  expression: string,
  context: FormulaContext
): FormulaResult {
  try {
    const sanitizedExpression = sanitizeExpression(expression);

    // Sanitize context keys: spaces → underscores, then lowercase for case-insensitive matching
    const sanitizedValues: Record<string, number> = {};
    for (const [key, val] of Object.entries(context.values)) {
      sanitizedValues[sanitizeName(key).toLowerCase()] = val;
    }

    // Also lowercase the expression variable names by lowercasing all identifiers
    // We do this by lowercasing the entire sanitized expression — safe because
    // expr-eval operators (+, -, *, /, etc.) are already lowercase/symbols.
    const lowercasedExpression = sanitizedExpression.toLowerCase();

    // Parse the expression to discover referenced variables
    const parser = new Parser();
    const parsed = parser.parse(lowercasedExpression);
    const referencedVars = parsed.variables();

    // Pre-fill missing keys with 0
    for (const varName of referencedVars) {
      if (!(varName in sanitizedValues)) {
        sanitizedValues[varName] = 0;
      }
    }

    const result = parsed.evaluate(sanitizedValues);

    // Check for division by zero (expr-eval returns Infinity or NaN)
    if (!isFinite(result) || isNaN(result)) {
      return { value: null, error: "Division by zero" };
    }

    return { value: result, error: null };
  } catch (err: unknown) {
    const message =
      err instanceof Error ? err.message : "Unknown evaluation error";
    return { value: null, error: message };
  }
}

/**
 * Validates a formula expression and returns any syntax/reference errors.
 *
 * - Returns null if the expression is syntactically valid.
 * - Returns an error message string if parsing fails.
 * - After successful parse, checks that all referenced variable names exist
 *   in `columnNames` (case-insensitive, spaces normalized to underscores).
 *   If any are missing, returns a warning string (they will resolve to 0).
 *
 * @param expression  The formula string to validate.
 * @param columnNames The list of currently defined Number column names.
 * @returns null on success, or an error/warning string.
 */
export function validateFormula(
  expression: string,
  columnNames: string[]
): string | null {
  const sanitizedExpression = sanitizeExpression(expression).toLowerCase();

  let parsed;
  try {
    parsed = new Parser().parse(sanitizedExpression);
  } catch (err: unknown) {
    const message =
      err instanceof Error ? err.message : "Invalid formula syntax";
    return message;
  }

  // Check referenced variables against known column names (all lowercased)
  const referencedVars = parsed.variables();
  const knownNames = columnNames.map((n) => sanitizeName(n).toLowerCase());

  const unknownVars = referencedVars.filter(
    (v) => !knownNames.includes(v.toLowerCase())
  );

  if (unknownVars.length > 0) {
    return `Unknown column(s): ${unknownVars.join(", ")} — they will resolve to 0`;
  }

  return null;
}
