
import * as XLSX from 'xlsx';
import * as fs from 'fs';
import * as path from 'path';

const data = [
    {
        name: "John Doe",
        parentName: "Robert Doe",
        parentMobile: "9876543210",
        grade: "1",
        section: "A",
        email: "john.doe@example.com",
        gender: "male",
        admissionNumber: "ADM001"
    },
    {
        name: "Jane Smith",
        parentName: "Maria Smith",
        parentMobile: "8765432109",
        grade: "1",
        section: "B",
        email: "jane.smith@example.com",
        gender: "female",
        admissionNumber: "ADM002"
    },
    {
        name: "Alice Johnson",
        parentName: "David Johnson",
        parentMobile: "7654321098",
        grade: "2",
        section: "A",
        email: "alice.j@example.com",
        gender: "female",
        admissionNumber: "ADM003"
    },
    {
        name: "Bob Brown",
        parentName: "Sarah Brown",
        parentMobile: "6543210987",
        grade: "2",
        section: "A",
        email: "bob.b@example.com",
        gender: "male",
        admissionNumber: "ADM004"
    }
];

const worksheet = XLSX.utils.json_to_sheet(data);
const workbook = XLSX.utils.book_new();
XLSX.utils.book_append_sheet(workbook, worksheet, "Students");

const outputPath = path.resolve("d:/Pro-files/LMS/student_onboarding_sample.xlsx");
XLSX.writeFile(workbook, outputPath);

console.log(`Sample Excel file generated at: ${outputPath}`);
