// TEMPORARY MOCK IMPLEMENTATION: colleges and their courses for the signup dropdowns.
// Replace with the real endpoint (for example GET /colleges) once the backend exists.
// Course names match the programs already used in mockUsers.ts.

export interface MockCourse {
  id: string;
  name: string;
}

export interface MockCollege {
  id: string;
  name: string;
  courses: MockCourse[];
}

export const MOCK_COLLEGES: MockCollege[] = [
  {
    id: "ccs",
    name: "College of Computer Studies",
    courses: [
      { id: "bscs", name: "BS Computer Science" },
      { id: "bsit", name: "BS Information Technology" },
      { id: "bsis", name: "BS Information Systems" },
    ],
  },
  {
    id: "coe",
    name: "College of Engineering",
    courses: [
      { id: "bsce", name: "BS Civil Engineering" },
      { id: "bsee", name: "BS Electrical Engineering" },
      { id: "bsme", name: "BS Mechanical Engineering" },
    ],
  },
  {
    id: "cba",
    name: "College of Business Administration",
    courses: [
      { id: "bsba", name: "BS Business Administration" },
      { id: "bsa", name: "BS Accountancy" },
      { id: "bsentre", name: "BS Entrepreneurship" },
    ],
  },
  {
    id: "ced",
    name: "College of Education",
    courses: [
      { id: "beed", name: "BS Education" },
      { id: "bsed", name: "BS Secondary Education" },
    ],
  },
  {
    id: "con",
    name: "College of Nursing",
    courses: [
      { id: "bsn", name: "BS Nursing" },
      { id: "bsmid", name: "BS Midwifery" },
    ],
  },
  {
    id: "cas",
    name: "College of Arts and Sciences",
    courses: [
      { id: "bsbio", name: "BS Biology" },
      { id: "bspsych", name: "BS Psychology" },
      { id: "abcomm", name: "AB Communication" },
    ],
  },
];