import * as XLSX from "xlsx";

export interface ExcelParseResult<T> {
  success: boolean;
  data: T[];
  errors: Array<{ row: number; errors: string[] }>;
  totalRows: number;
  validRows: number;
  rowNumbers: number[];
}

const KEY_ALIASES: Record<string, string> = {
  // grade
  grade: "grade",
  class: "grade",
  std: "grade",
  standard: "grade",

  // section
  section: "section",
  sec: "section",

  // name
  name: "name",
  studentname: "name",
  fullname: "name",
  staffname: "name",

  // roll number
  rollnumber: "rollNumber",
  rollno: "rollNumber",
  rollnum: "rollNumber",
  roll: "rollNumber",

  // gender
  gender: "gender",
  sex: "gender",

  // admission number
  admissionnumber: "admissionNumber",
  admno: "admissionNumber",
  admissionno: "admissionNumber",

  // email
  email: "email",
  emailaddress: "email",

  // mobile number
  mobilenumber: "mobileNumber",
  mobile: "mobileNumber",
  phone: "mobileNumber",
  phonenumber: "mobileNumber",
  contact: "mobileNumber",
  contactnumber: "mobileNumber",

  // date of birth
  dateofbirth: "dateOfBirth",
  dob: "dateOfBirth",

  // address
  address: "address",

  // admission date
  admissiondate: "admissionDate",

  // staff specific
  subjects: "subjects",
  subject: "subjects",
  subjectstaught: "subjects",
  designation: "designation",
  role: "designation",
  title: "designation",
  department: "department",
  dept: "department",
  qualification: "qualification",
  qualifications: "qualification",
};

function toCamelCase(str: string): string {
  return str
    .trim()
    .toLowerCase()
    .replace(/[^a-zA-Z0-9]+(.)/g, (_, chr) => chr.toUpperCase());
}

export function normalizeRowObject(row: Record<string, any>): Record<string, string> {
  const normalized: Record<string, string> = {};
  for (const [key, val] of Object.entries(row)) {
    const valStr = val == null ? "" : String(val).trim();
    const trimmedKey = key.trim();
    const lowerKey = trimmedKey.toLowerCase();
    const cleanKey = lowerKey.replace(/[^a-z0-9]/g, "");
    const camelKey = toCamelCase(trimmedKey);
    const mappedKey = KEY_ALIASES[cleanKey] || camelKey || trimmedKey;

    normalized[mappedKey] = valStr;
    normalized[cleanKey] = valStr;
    normalized[lowerKey] = valStr;
    normalized[camelKey] = valStr;
    normalized[trimmedKey] = valStr;
  }
  return normalized;
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

    // Use header:1 to include ALL rows (including empty) for accurate row numbering
    const rows: any[][] = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: "" });

    if (rows.length < 2) {
      return {
        success: false,
        data: [],
        errors: [{ row: 0, errors: ["Excel file is empty or has only headers"] }],
        totalRows: 0,
        validRows: 0,
        rowNumbers: [],
      };
    }

    // First row is the header
    const headerRow = rows[0] as any[];

    // Build row objects from data rows (rows[1] onwards)
    const rawData: any[] = [];
    for (let i = 1; i < rows.length; i++) {
      const rowArr = rows[i];
      const rowObj: Record<string, any> = {};
      for (let j = 0; j < headerRow.length; j++) {
        const key = String(headerRow[j] ?? "").trim();
        if (key) {
          rowObj[key] = rowArr[j] ?? "";
        }
      }
      rawData.push(rowObj);
    }

    if (rawData.length === 0) {
      return {
        success: false,
        data: [],
        errors: [{ row: 0, errors: ["Excel file is empty"] }],
        totalRows: 0,
        validRows: 0,
        rowNumbers: [],
      };
    }

    const normalizedData = rawData.map((row) => normalizeRowObject(row));
    const firstRow = normalizedData[0];

    const missingColumns = requiredColumns.filter((col) => {
      const trimmedCol = col.trim();
      const lowerCol = trimmedCol.toLowerCase();
      const cleanCol = lowerCol.replace(/[^a-z0-9]/g, "");
      const camelCol = toCamelCase(trimmedCol);
      const canonicalReq = KEY_ALIASES[cleanCol] || camelCol || col;

      return (
        !(canonicalReq in firstRow) &&
        !(col in firstRow) &&
        !(cleanCol in firstRow) &&
        !(lowerCol in firstRow) &&
        !(camelCol in firstRow)
      );
    });

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
        rowNumbers: [],
      };
    }

    const validData: T[] = [];
    const validRowNumbers: number[] = [];
    const errors: Array<{ row: number; errors: string[] }> = [];

    normalizedData.forEach((row, index) => {
      // Actual Excel row number (index=0 => Excel row 2, since row 1 is header)
      const actualRowNumber = index + 2;
      const result = validator(row, actualRowNumber);

      if (result.isValid && result.data) {
        validData.push(result.data);
        validRowNumbers.push(actualRowNumber);
      } else if (result.errors.length > 0) {
        errors.push({
          row: actualRowNumber,
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
      rowNumbers: validRowNumbers,
    };
  } catch (error: any) {
    return {
      success: false,
      data: [],
      errors: [{ row: 0, errors: [`Failed to parse Excel file: ${error.message}`] }],
      totalRows: 0,
      validRows: 0,
      rowNumbers: [],
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

