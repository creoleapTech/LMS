// lib/excel-parser.ts
import * as XLSX from "xlsx";

export interface ExcelParseResult<T> {
  success: boolean;
  data: T[];
  errors: Array<{ row: number; errors: string[] }>;
  totalRows: number;
  validRows: number;
}

/**
 * Parse Excel file buffer and validate data
 * @param buffer - File buffer from uploaded Excel file
 * @param validator - Function to validate each row
 * @param requiredColumns - Array of required column names
 * @returns Parsed and validated data with errors
 */
export function parseExcelFile<T>(
  buffer: Buffer,
  validator: (row: any, rowIndex: number) => { isValid: boolean; errors: string[]; data?: T },
  requiredColumns: string[]
): ExcelParseResult<T> {
  try {
    // Read the Excel file
    const workbook = XLSX.read(buffer, { type: "buffer" });
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];

    // Convert to JSON
    const rawData: any[] = XLSX.utils.sheet_to_json(worksheet, { defval: "" });

    if (rawData.length === 0) {
      return {
        success: false,
        data: [],
        errors: [{ row: 0, errors: ["Excel file is empty"] }],
        totalRows: 0,
        validRows: 0,
      };
    }

    // Check for required columns
    const firstRow = rawData[0];
    const missingColumns = requiredColumns.filter((col) => !(col in firstRow));

    if (missingColumns.length > 0) {
      return {
        success: false,
        data: [],
        errors: [
          {
            row: 0,
            errors: [`Missing required columns: ${missingColumns.join(", ")}`],
          },
        ],
        totalRows: rawData.length,
        validRows: 0,
      };
    }

    // Validate each row
    const validData: T[] = [];
    const errors: Array<{ row: number; errors: string[] }> = [];

    rawData.forEach((row, index) => {
      const result = validator(row, index + 2); // +2 because Excel rows start at 1 and we skip header
      
      if (result.isValid && result.data) {
        validData.push(result.data);
      } else {
        errors.push({
          row: index + 2,
          errors: result.errors,
        });
      }
    });

    return {
      success: validData.length > 0,
      data: validData,
      errors,
      totalRows: rawData.length,
      validRows: validData.length,
    };
  } catch (error: any) {
    return {
      success: false,
      data: [],
      errors: [{ row: 0, errors: [`Failed to parse Excel file: ${error.message}`] }],
      totalRows: 0,
      validRows: 0,
    };
  }
}

/**
 * Generate Excel template with headers
 * @param headers - Column headers
 * @param sampleData - Optional sample data rows
 * @returns Excel buffer
 */
export function generateExcelTemplate(
  headers: string[],
  sampleData?: any[]
): Buffer {
  const worksheet = XLSX.utils.json_to_sheet(sampleData || [{}], {
    header: headers,
  });

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Template");

  return XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });
}
