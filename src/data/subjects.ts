import { Subject } from "../types";

export const SUBJECTS: Subject[] = [
  {
    id: "math",
    name: "คณิตศาสตร์ (Mathematics)",
    icon: "Calculator",
    color: "text-sky-600 bg-sky-50 border-sky-200",
    bgLight: "bg-sky-50 dark:bg-sky-950/20",
    description: "ตรรกะ ตัวเลข พีชคณิต เรขาคณิต และการแก้ปัญหาอย่างมีเหตุมีผล",
    defaultQuestionsCount: 0
  },
  {
    id: "science",
    name: "วิทยาศาสตร์ (Science & Tech)",
    icon: "FlaskConical",
    color: "text-emerald-600 bg-emerald-50 border-emerald-200",
    bgLight: "bg-emerald-50 dark:bg-emerald-950/20",
    description: "ฟิสิกส์ เคมี ชีววิทยา ดาราศาสตร์ และปรากฏการณ์ธรรมชาติ",
    defaultQuestionsCount: 0
  },
  {
    id: "english",
    name: "ภาษาอังกฤษ (English)",
    icon: "Languages",
    color: "text-indigo-600 bg-indigo-50 border-indigo-200",
    bgLight: "bg-indigo-50 dark:bg-indigo-950/20",
    description: "ไวยากรณ์ คำศัพท์ การอ่านจับใจความ และทักษะการสื่อสารสากล",
    defaultQuestionsCount: 0
  },
  {
    id: "history",
    name: "ประวัติศาสตร์และสังคม (Social Studies)",
    icon: "BookOpen",
    color: "text-amber-600 bg-amber-50 border-amber-200",
    bgLight: "bg-amber-50 dark:bg-amber-950/20",
    description: "อารยธรรมมนุษย์ เหตุการณ์สำคัญทางประวัติศาสตร์ และความเข้าใจสังคมภูมิศาสตร์",
    defaultQuestionsCount: 0
  },
  {
    id: "computer",
    name: "วิชาคอมพิวเตอร์และวิทยาการคำนวณ (Computer Science & ICT)",
    icon: "Laptop",
    color: "text-blue-600 bg-blue-50 border-blue-200",
    bgLight: "bg-blue-50 dark:bg-blue-950/20",
    description: "ระบบคอมพิวเตอร์ ฮาร์ดแวร์ ซอฟต์แวร์ เครือข่าย ความปลอดภัยไซเบอร์ และการคิดเชิงคำนวณ",
    defaultQuestionsCount: 0
  },
  {
    id: "coding",
    name: "การเขียนโปรแกรม & โค้ดดิ้ง (Coding & Programming)",
    icon: "Code",
    color: "text-violet-600 bg-violet-50 border-violet-200",
    bgLight: "bg-violet-50 dark:bg-violet-950/20",
    description: "แนวคิดการเขียนโค้ด อัลกอริทึม โครงสร้างข้อมูล และการพัฒนาโปรแกรมประยุกต์",
    defaultQuestionsCount: 0
  },
  {
    id: "marine",
    name: "ชีวิตใต้ทะเลและสมุทรศาสตร์ (Marine Life & Ocean)",
    icon: "Waves",
    color: "text-cyan-600 bg-cyan-50 border-cyan-200",
    bgLight: "bg-cyan-50 dark:bg-cyan-950/20",
    description: "สิ่งมีชีวิตใต้ทะเล ระบบนิเวศปะการัง สัตว์น้ำลึก สมุทรศาสตร์ และการอนุรักษ์ทะเล",
    defaultQuestionsCount: 0
  },
  {
    id: "animals",
    name: "สัตว์บกและสิ่งมีชีวิตบนบก (Land Animals & Wildlife)",
    icon: "PawPrint",
    color: "text-amber-700 bg-amber-50 border-amber-200",
    bgLight: "bg-amber-50 dark:bg-amber-950/20",
    description: "พฤติกรรมสัตว์บก สัตว์เลี้ยงลูกด้วยนม สัตว์เลื้อยคลาน สัตว์ป่าสงวน และระบบนิเวศบนบก",
    defaultQuestionsCount: 0
  }
];
