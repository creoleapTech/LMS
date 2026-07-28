import * as XLSX from "xlsx";

export interface ExcelParseResult<T> {
  success: boolean;
  data: T[];
  errors: Array<{ row: number; errors: string[] }>;
  totalRows: number;
  validRows: number;
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

export function normalizeRowObject(row: Record<string, any>): Record<string, string> {
  const normalized: Record<string, string> = {};
  for (const [key, val] of Object.entries(row)) {
    const valStr = val == null ? "" : String(val).trim();
    const cleanKey = key.trim().toLowerCase().replace(/[^a-z0-9]/g, "");
    const mappedKey = KEY_ALIASES[cleanKey] || key.trim();
    normalized[mappedKey] = valStr;
    if (!normalized[cleanKey]) {
      normalized[cleanKey] = valStr;
    }
    if (!normalized[key.trim()]) {
      normalized[key.trim()] = valStr;
    }
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

    const normalizedData = rawData.map((row) => normalizeRowObject(row));
    const firstRow = normalizedData[0];

    const missingColumns = requiredColumns.filter((col) => {
      const cleanCol = col.trim().toLowerCase().replace(/[^a-z0-9]/g, "");
      const canonicalReq = KEY_ALIASES[cleanCol] || col;
      return !(canonicalReq in firstRow) && !(col in firstRow) && !(cleanCol in firstRow);
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
      };
    }

    const validData: T[] = [];
    const errors: Array<{ row: number; errors: string[] }> = [];

    normalizedData.forEach((row, index) => {
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

