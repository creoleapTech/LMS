import * as XLSX from "xlsx";

export interface ExcelParseResult<T> {
  success: boolean;
  data: T[];
  errors: Array<{ row: number; errors: string[] }>;
  totalRows: number;
  validRows: number;
}

export function parseExcelFile<T>(
  buffer: ArrayBuffer | Uint8Array,
  validator: (row: any, rowIndex: number) => { isValid: boolean; errors: string[]; data?: T },
  requiredColumns: string[],
): ExcelParseResult<T> {
  try {
    const workbook = XLSX.read(buffer, { type: "array" });
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];

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

    const validData: T[] = [];
    const errors: Array<{ row: number; errors: string[] }> = [];

    rawData.forEach((row, index) => {
      const result = validator(row, index + 2);

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

export function generateExcelTemplate(
  headers: string[],
  sampleData?: any[],
): Uint8Array {
  const worksheet = XLSX.utils.json_to_sheet(sampleData || [{}], {
    header: headers,
  });

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Template");

  return XLSX.write(workbook, { type: "array", bookType: "xlsx" }) as Uint8Array;
}
