import express from "express";
import path from "path";
import dns from "dns";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

// Ensure ipv4 is prioritized to avoid slow connections or docker-related resolution issues
dns.setDefaultResultOrder("ipv4first");

const app = express();
const PORT = Number(process.env.PORT) || 3000;

app.use(express.json());

// Lazy-initialize Gemini API to prevent crash at start
let genAIInstance: GoogleGenAI | null = null;
function getGenAI(): GoogleGenAI {
  if (!genAIInstance) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error("Missing GEMINI_API_KEY environment variable. Please configure it in your Secrets panel.");
    }
    genAIInstance = new GoogleGenAI({ 
      apiKey,
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build"
        }
      }
    });
  }
  return genAIInstance;
}

// High-quality local static fallback questions for all subjects
interface FallbackQuestion {
  question: string;
  options: string[];
  answerIndex: number;
  explanation: string;
}

const FALLBACK_QUESTION_POOL: Record<string, FallbackQuestion[]> = {
  math: [
    {
      question: "จงหาค่าของ (2^3) * (5^2) ว่ามีค่าเท่ากับเท่าใด?",
      options: ["100", "200", "400", "800"],
      answerIndex: 1,
      explanation: "คำนวณทีละส่วน: 2^3 = 8 และ 5^2 = 25 จากนั้นนำผลลัพธ์มาคูณกัน จะได้ 8 * 25 = 200 อย่างถูกต้อง"
    },
    {
      question: "ถ้าสมการคือ 3x - 5 = 16 แล้วค่าของ x + 3 จะเท่ากับข้อใด?",
      options: ["7", "10", "13", "16"],
      answerIndex: 1,
      explanation: "ย้ายข้างแก้สมการ: 3x = 16 + 5 -> 3x = 21 -> x = 7 ดังนั้นค่าของ x + 3 คือ 7 + 3 = 10"
    },
    {
      question: "ผลรวมของมุมภายในของรูปห้าเหลี่ยม (Pentagon) เท่ากับกี่องศา?",
      options: ["360 องศา", "540 องศา", "720 องศา", "900 องศา"],
      answerIndex: 1,
      explanation: "คำนวณจากสูตรผลรวมมุมภายในรูปหลายเหลี่ยม: (n - 2) * 180 องศา โดยที่ n เป็นจำนวนด้าน สำหรับรูปห้าเหลี่ยม n = 5 จะได้ (5 - 2) * 180 = 3 * 180 = 540 องศา"
    }
  ],
  science: [
    {
      question: "ดาวเคราะห์ดวงใดในระบบสุริยะที่ได้รับฉายาว่า 'ดาวฝาแฝดของโลก' (Earth's Twin) เนื่องจากมีขนาดและโครงสร้างใกล้เคียงกัน?",
      options: ["ดาวอังคาร (Mars)", "ดาวพุธ (Mercury)", "ดาวศุกร์ (Venus)", "ดาวพฤหัสบดี (Jupiter)"],
      answerIndex: 2,
      explanation: "ดาวศุกร์ (Venus) มีมวล แรงโน้มถ่วง และขนาดที่ใกล้เคียงกับโลกมากที่สุด จึงได้ฉายานี้ แม้จะมีบรรยากาศประกอบด้วยคาร์บอนไดออกไซด์เข้มข้นจนเกิดสภาวะเรือนกระจกยิ่งยวดก็ตาม"
    },
    {
      question: "สารเคมีกระตุ้นใดในร่างกายมนุษย์ที่ทำหน้าที่หลักในการลำเลียงแก๊สออกซิเจนจับตัวและขนส่งผ่านเม็ดเลือดแดง?",
      options: ["ฮีโมโกลบิน (Hemoglobin)", "คลอโรฟิลล์ (Chlorophyll)", "อินซูลิน (Insulin)", "พลาสม่า (Plasma)"],
      answerIndex: 0,
      explanation: "ฮีโมโกลบิน (Hemoglobin) เป็นโปรตีนที่มีธาตุเหล็กเป็นองค์ประกอบอยู่ในเซลล์เม็ดเลือดแดง ทำหน้าที่จับออกซิเจนเพื่อไปส่งยังส่วนต่างๆ ของร่างกาย"
    },
    {
      question: "กฎข้อที่หนึ่งของนิวตัน (Newton's First Law of Motion) มีอีกชื่อเรียกหนึ่งว่าอย่างไร?",
      options: ["กฎแห่งความเร่ง (Law of Acceleration)", "กฎแห่งความเฉื่อย (Law of Inertia)", "กฎของความตึงตัว (Law of Tension)", "กฎแห่งการดึงดูด (Law of Gravitation)"],
      answerIndex: 1,
      explanation: "กฎข้อที่ 1 ของนิวตัน ระบุว่าวัตถุจะหยุดนิ่งหรือเคลื่อนที่ด้วยความเร็วคงที่ตราบเท่าที่ไม่มีแรงภายนอกมากระทำ ซึ่งสภาวะนี้เรียกว่า 'ความเฉื่อย' (Inertia)"
    }
  ],
  english: [
    {
      question: "Which of the following sentences is grammatically correct?",
      options: [
        "She don't like playing tennis on Sundays.",
        "They has completed their project yesterday.",
        "Neither of the students was ready for the exam.",
        "Each of the books belong to the library."
      ],
      answerIndex: 2,
      explanation: "'Neither of' เป็นคำสรรพนามเอกพจน์ จึงต้องใช้คู่กับคำกริยาประเภทเอกพจน์ (was) ข้ออื่นผิดเพราะ: 'She' ต้องใช้ doesn't; 'They has' ต้องเปลี่ยนเป็น 'They have' หรือใช้ past simple (They completed) เพราะมี yesterday; 'Each' ต้องใช้คู่กับกริยาเอกพจน์ (belongs)"
    },
    {
      question: "What is the synonym of the academic vocabulary word 'ABUNDANT'?",
      options: ["Scarce", "Plentiful", "Fragile", "Mysterious"],
      answerIndex: 1,
      explanation: "'Abundant' แปลว่า มากมาย หรืออุดมสมบูรณ์ ซึ่งมีความหมายตรงกับคำว่า 'Plentiful' ส่วนคำตรงข้ามคือ 'Scarce' (ขาดแคลน)"
    },
    {
      question: "If I _______ more free time yesterday, I would have completed the coding match.",
      options: ["have", "had", "will have", "had had"],
      answerIndex: 3,
      explanation: "โจทย์ใช้โครงสร้าง Conditional Type 3 (เงื่อนไขสมมติในอดีตคู่กับผลลัพธ์ในอดีต) - โครงสร้างคือ If + Past Perfect (had + V.3), would have + V.3 ดังนั้นช่องว่างต้องเป็น 'had had'"
    }
  ],
  history: [
    {
      question: "อารยธรรมโบราณใดที่มีชื่อเสียงที่สุดในการริเริ่มระบบการปกครองระบอบประชาธิปไตย (Democracy) เป็นแห่งแรกของโลก?",
      options: ["อารยธรรมโรมัน (Rome)", "อารยธรรมเอเธนส์ / กรีกโบราณ (Athens)", "อารยธรรมอียิปต์โบราณ (Egypt)", "อารยธรรมเมโสโปเตเมีย (Mesopotamia)"],
      answerIndex: 1,
      explanation: "นครรัฐเอเธนส์ของกรีกโบราณ ถือเป็นผู้คิดค้นระบอบประชาธิปไตยเป็นครั้งแรก โดยให้พลเมืองทุกคนมาประชุมสภาเสนอแนะกฎหมายและลงคะแนนเสียงกันโดยตรง"
    },
    {
      question: "สนธิสัญญาเบาริง (Bowring Treaty) ซึ่งทำขึ้นในสมัยรัชกาลที่ 4 ส่งผลกระทบที่สำคัญที่สุดในข้อใดต่อสังคมสยาม?",
      options: [
        "การเสียดินแดนทางตอนใต้ของสยามให้กับอังกฤษและฝรั่งเศส",
        "การยกเลิกบทบาทผูกขาดการค้าของพระคลังสินค้าและเปิดเสรีการค้ากับตะวันตก",
        "การจัดตั้งระบบโรงเรียนสมัยใหม่และมหาวิทยาลัยแพทยศาสตร์",
        "การเข้าร่วมกลุ่มสัมพันธมิตรเพื่อประกาศสงคราม"
      ],
      answerIndex: 1,
      explanation: "สนธิสัญญาเบาริงทำให้สยามยกเลิกสิทธิ์ผูกขาดการค้าโดยคลังสินค้า เปิดทางให้ทำการค้าขายได้อิสระ เสียภาษีร้อยละ 3 และเปิดโอกาสให้เกิดอารยชนและการค้าเสรีสมัยใหม่"
    },
    {
      question: "อารยธรรมเมโสโปเตเมีย (Mesopotamia) ถือกำเนิดขึ้นท่ามกลางลุ่มแม่น้ำสายสำคัญคู่ใด?",
      options: ["แม่น้ำไนล์ และ คองโก", "แม่น้ำเหลือง และ แยงซี", "แม่น้ำไทกริส และ ยูเฟรติส", "แม่น้ำคงคา และ สินธุ"],
      answerIndex: 2,
      explanation: "เมโสโปเตเมียตั้งอยู่ระหว่างลุ่มแม่น้ำสองสายหลักคือ ไทกริส (Tigris) และยูเฟรติส (Euphrates) ซึ่งเป็นจุดศูนย์กลางของการกำเนิดประวัติศาสตร์และการจดบันทึกตัวอักษรรุ่นแรกสุดของโลก"
    }
  ],
  computer: [
    {
      question: "อุปกรณ์ฮาร์ดแวร์ใดในระบบคอมพิวเตอร์ที่ทำหน้าที่เปรียบเสมือน 'สมอง' ในการประมวลผลคำสั่งทั้งหมด?",
      options: ["ซีพียู (CPU)", "แรม (RAM)", "ฮาร์ดดิสก์ (Hard Disk)", "พาวเวอร์ซัพพลาย (Power Supply)"],
      answerIndex: 0,
      explanation: "CPU (Central Processing Unit) คือหน่วยประมวลผลกลาง ทำหน้าที่คำนวณและประมวลผลชุดคำสั่งทั้งหมดของระบบคอมพิวเตอร์"
    },
    {
      question: "หน่วยความจำประเภท RAM (Random Access Memory) มีคุณสมบัติเด่นตรงกับข้อใด?",
      options: [
        "เก็บข้อมูลถาวรแม้ปิดเครื่องคอมพิวเตอร์",
        "เป็นหน่วยความจำชั่วคราว ข้อมูลจะหายไปเมื่อไม่มีกระแสไฟฟ้าหล่อเลี้ยง",
        "ใช้สำหรับบันทึกข้อมูลระยะยาวแทน SSD",
        "เป็นชิปสำหรับควบคุมการบูตระบบ BIOS เท่านั้น"
      ],
      answerIndex: 1,
      explanation: "RAM เป็นหน่วยความจำหลักแบบ Volatile Memory ที่อ่านเขียนข้อมูลได้รวดเร็วแต่ข้อมูลจะสูญหายทันทีเมื่อปิดเครื่อง"
    },
    {
      question: "โปรโตคอลระบบเครือข่ายใดที่ทำหน้าที่แปลง URL / Domain Name (เช่น google.com) ให้สอดคล้องเป็น IP Address ที่คอมพิวเตอร์เข้าถึงจริง?",
      options: ["HTTP (Hypertext Transfer)", "FTP (File Transfer)", "DNS (Domain Name System)", "SMTP (Simple Mail Transfer)"],
      answerIndex: 2,
      explanation: "DNS (Domain Name System) คือบริการแปลงชื่อจำง่ายของเว็บไซต์ต่างๆ ให้กลายเป็นที่อยู่เซิร์ฟเวอร์ IP เพื่อให้เบราว์เซอร์ดาวน์โหลดหน้าเว็บมาแสดงได้อย่างถูกต้อง"
    }
  ],
  coding: [
    {
      question: "ในวิชาโครงสร้างข้อมูล (Data Structures) โครงสร้างแบบใดทำงานตามหลักการแบบ First-In, First-Out (FIFO) อย่างมีระบบ?",
      options: ["สแต็ก (Stack)", "คิว (Queue)", "อะเรย์สองมิติ (2D Array)", "สตรีพชนิดสายพาน (String Ribbon)"],
      answerIndex: 1,
      explanation: "คิว (Queue) รองรับแบบเข้าก่อน-ออกก่อน (FIFO) เช่นเดียวกับการต่อแถวรอคิวผู้เล่น คนแรกที่เข้าแถวจะได้ออกจากแถวก่อน ขณะที่สแต็ก (Stack) รองรับแบบเข้าหลัง-ออกก่อน (LIFO)"
    },
    {
      question: "ตัวดำเนินการทางตรรกศาสตร์ (Logical Operator) ชนิดใดที่จะให้ผลลัพธ์เป็น 'จริง' (True) ก็ต่อเมื่ออินพุตคู่ทั้งสองตัวมีสถานะเป็นจริงพร้อมกันเท่านั้น?",
      options: ["AND", "OR", "XOR", "NOT"],
      answerIndex: 0,
      explanation: "การใช้เงื่อนไข AND (และ) กำหนดว่าค่าทั้งสองสภาวะจะต้องเป็นจริงทั้งคู่จึงจะประเมินค่าเป็นจริงได้ (True AND True = True)"
    }
  ],
  marine: [
    {
      question: "สิ่งมีชีวิตใดจัดเป็นสัตว์ที่มีขนาดลำตัวใหญ่ที่สุดในมหาสมุทรและใหญ่ที่สุดในโลกเท่าที่เคยบันทึกมา?",
      options: ["ฉลามวาฬ (Whale Shark)", "วาฬสีน้ำเงิน (Blue Whale)", "หมึกยักษ์โคลอสซัล (Colossal Squid)", "วาฬเพชฌฆาต (Orca)"],
      answerIndex: 1,
      explanation: "วาฬสีน้ำเงิน (Blue Whale) เป็นสัตว์เลี้ยงลูกด้วยนมในทะเลที่มีขนาดยาวได้ถึง 30 เมตรและหนักกว่า 150-200 ตัน ถือเป็นสัตว์ที่ใหญ่ที่สุดในโลก"
    },
    {
      question: "ปรากฏการณ์ 'ปะการังฟอกขาว' (Coral Bleaching) ในมหาสมุทร เกิดจากสาเหตุหลักประการใด?",
      options: [
        "อุณหภูมิน้ำทะเลสูงขึ้นต่อเนื่องจนสาหร่ายซูแซนเทลลี (Zooxanthellae) หลุดออกจากเนื้อเยื่อปะการัง",
        "การเพิ่มขึ้นอย่างรวดเร็วของฝูงปลาการ์ตูนในแนวปะการัง",
        "แสงอาทิตย์ส่องสว่างไม่เพียงพอในเวลากลางวัน",
        "ระดับความเค็มของน้ำทะเลเพิ่มสูงขึ้นจนปะการังคายเกลือ"
      ],
      answerIndex: 0,
      explanation: "เมื่ออุณหภูมิน้ำทะเลสูงขึ้น ปะการังจะเกิดความเครียดและขับสาหร่ายซูแซนเทลลีที่อาศัยอยู่ร่วมกันออกไป ทำให้สูญเสียสีสันและแหล่งพลังงานหลักจนเห็นเป็นโครงสร้างหินปูนสีขาว"
    },
    {
      question: "ร่องลึกก้นสมุทรมาเรียนา (Mariana Trench) ซึ่งเป็นจุดที่ลึกที่สุดในโลก ตั้งอยู่ในมหาสมุทรใด?",
      options: ["มหาสมุทรแอตแลนติก", "มหาสมุทรอินเดีย", "มหาสมุทรแปซิฟิก", "มหาสมุทรอาร์กติก"],
      answerIndex: 2,
      explanation: "ร่องลึกก้นสมุทรมาเรียนาตั้งอยู่ทางตะวันตกของมหาสมุทรแปซิฟิก โดยจุดที่ลึกที่สุดคือ Challenger Deep ลึกประมาณเกือบ 11,000 เมตรจากระดับน้ำทะเล"
    }
  ],
  animals: [
    {
      question: "สัตว์เลี้ยงลูกด้วยนมบนบก (Terrestrial Mammal) ที่มีขนาดร่างกายและน้ำหนักตัวมากที่สุดในโลกคือข้อใด?",
      options: ["ช้างแอฟริกา (African Bush Elephant)", "แรดขาว (White Rhinoceros)", "ฮิปโปโปเตมัส (Hippopotamus)", "ยีราฟ (Giraffe)"],
      answerIndex: 0,
      explanation: "ช้างแอฟริกา (African Bush Elephant) เป็นสัตว์บกที่มีขนาดใหญ่ที่สุดในโลก ตัวผู้โตเต็มวัยอาจหนักได้ถึง 6 ตันและสูงกว่า 3-4 เมตร"
    },
    {
      question: "สัตว์บกชนิดใดจัดเป็นสัตว์กินพืช (Herbivore) ที่มีความสูงมากที่สุดในโลก และมีลิ้นยาวช่วยในการรูดกินใบไม้จากยอดไม้สูง?",
      options: ["กวางมูส (Moose)", "ยีราฟ (Giraffe)", "อูฐหนอกคู่ (Bactrian Camel)", "ม้าลาย (Zebra)"],
      answerIndex: 1,
      explanation: "ยีราฟ (Giraffe) มีคอยาวและลำตัวสูงได้ถึง 5-6 เมตร โดยมีลิ้นที่ยาวและเหนียวเพื่อช่วยกินใบกระถินณรงค์และใบไม้บนกิ่งไม้สูง"
    },
    {
      question: "เสือโคร่ง (Panthera tigris) จัดเป็นสัตว์นักล่าระดับบนสุด (Apex Predator) ซึ่งจัดอยู่ในวงศ์สัตว์ใดทางอนุกรมวิธาน?",
      options: ["วงศ์หมา (Canidae)", "วงศ์แมว (Felidae)", "วงศ์หมี (Ursidae)", "วงศ์ไฮยีน่า (Hyaenidae)"],
      answerIndex: 1,
      explanation: "เสือโคร่งจัดอยู่ในวงศ์ Felidae (วงศ์เสือและแมว) โดยเป็นสปีชีส์ที่มีขนาดใหญ่ที่สุดในวงศ์นี้"
    }
  ]
};

const FALLBACK_TRUE_FALSE: Record<string, FallbackQuestion[]> = {
  math: [
    {
      question: "ผลรวมของมุมภายในของรูปห้าเหลี่ยม (Pentagon) มีค่าเท่ากับ 540 องศา ใช่หรือไม่?",
      options: ["จริง / ถูกต้อง", "เท็จ / ไม่ถูกต้อง"],
      answerIndex: 0,
      explanation: "สูตรคำนวณคือ (n - 2) * 180 องศา สำหรับรูปห้าเหลี่ยม n = 5 จะได้ (5 - 2) * 180 = 540 องศา ดังนั้นข้อความนี้จึงถูกต้อง"
    },
    {
      question: "ค่าของสมการ 3x - 5 = 16 จะส่งผลให้ข้อสมมติ x = 10 เป็นจริง หรือไม่?",
      options: ["จริง / ถูกต้อง", "เท็จ / ไม่ถูกต้อง"],
      answerIndex: 1,
      explanation: "จากสมการ จะได้ 3x = 21 ดังนั้น x = 7 ไม่ใช่ 10 ข้อความนี้จึงเป็นเท็จ"
    }
  ],
  science: [
    {
      question: "ดาวศุกร์ (Venus) ได้รับฉายาทางวิทยาศาสตร์ดาราศาสตร์ว่าเป็นดาวฝาแฝดของโลก เนื่องจากมีขนาดและปริมาณมวลใกล้เคียงกัน?",
      options: ["จริง / ถูกต้อง", "เท็จ / ไม่ถูกต้อง"],
      answerIndex: 0,
      explanation: "ถูกต้อง ดาวศุกร์มีแรงโน้มถ่วง ขนาด และมวลส่วนใหญ่ใกล้เคียงกับโลกจนได้สมญานามว่าดาวฝาแฝดของโลก"
    },
    {
      question: "คลอโรฟิลล์ (Chlorophyll) เป็นโปรตีนสำคัญในเม็ดเลือดแดงของมนุษย์ที่มีหน้าที่จับและลำเลียงออกซิเจน?",
      options: ["จริง / ถูกต้อง", "เท็จ / ไม่ถูกต้อง"],
      answerIndex: 1,
      explanation: "ไม่ถูกต้อง โปรตีนลำเลียงออกซิเจนในสัตว์เลี้ยงลูกด้วยนมคือ ฮีโมโกลบิน (Hemoglobin) ส่วนคลอโรฟิลล์เป็นสารสีเขียวในพืชและสาหร่ายที่ทำหน้าที่สังเคราะห์แสง"
    }
  ],
  english: [
    {
      question: "In English grammar, the word 'scarce' is a synonym of 'abundant'. Is this true or false?",
      options: ["True", "False"],
      answerIndex: 1,
      explanation: "False. 'Scarce' means in short supply or rare, which is an antonym (opposite), not a synonym, of 'abundant' (plentiful)."
    },
    {
      question: "The following conditional sentence is grammatically correct: 'If I had had more time, I would have joined the match.'",
      options: ["True", "False"],
      answerIndex: 0,
      explanation: "True. It matches the structure of Third Conditional (If + Past Perfect [had had], would have + V.3)."
    }
  ],
  history: [
    {
      question: "นครรัฐเอเธนส์ของกรีกโบราณได้รับการจารึกว่าเป็นแหล่งอารยธรรมแรกที่คิดค้นริเริ่มระบบการปกครองระบอบประชาธิปไตย?",
      options: ["จริง / ถูกต้อง", "เท็จ / ไม่ถูกต้อง"],
      answerIndex: 0,
      explanation: "ถูกต้อง นครรัฐเอเธนส์เป็นผู้ริเริ่มให้ประชากรผู้มีสิทธิสามารถมีส่วนร่วมออกเสียงปกครองโดยตรงเป็นแห่งแรกของอารยธรรมมนุษย์"
    },
    {
      question: "สนธิสัญญาเบาริงในสมัยรัชกาลที่ 4 ส่งผลให้สยามสิ้นเอกภาพและผูกขาดระบบพระคลังสินค้าเข้มข้นยิ่งขึ้น?",
      options: ["จริง / ถูกต้อง", "เท็จ / ไม่ถูกต้อง"],
      answerIndex: 1,
      explanation: "ไม่ถูกต้อง สนธิสัญญาเบาริงบังคับให้สยามเปิดการเสรีทางการค้าและยกเลิกการค้าผูกขาดแบบเดิมของพระคลังสินค้าโดยสิ้นเชิง"
    }
  ],
  computer: [
    {
      question: "โปรโตคอล DNS (Domain Name System) มีหน้าที่หลักในการแปลง Domain Name ของระบบเว็บให้เป็น IP Address ของเซิร์ฟเวอร์ปลายทาง?",
      options: ["จริง / ถูกต้อง", "เท็จ / ไม่ถูกต้อง"],
      answerIndex: 0,
      explanation: "ถูกต้อง DNS ทำหน้าที่หลักในการเทียบเคียงและแปลงประวัติของ Domain Name เพื่อค้นหาเป้าหมาย IP ปลายทางด่วน"
    },
    {
      question: "แรม (RAM) เป็นหน่วยความจำที่สามารถเก็บรักษาข้อมูลไว้อย่างถาวรแม้จะไม่มีกระแสไฟฟ้าจ่ายให้คอมพิวเตอร์?",
      options: ["จริง / ถูกต้อง", "เท็จ / ไม่ถูกต้อง"],
      answerIndex: 1,
      explanation: "ไม่ถูกต้อง แรม (RAM) เป็นหน่วยความจำชั่วคราว (Volatile Memory) ข้อมูลทั้งหมดจะหายไปเมื่อปิดเครื่อง"
    }
  ],
  coding: [
    {
      question: "โครงสร้างข้อมูลแบบคิว (Queue) ประยุกต์ใช้แนวทางการบริหารแบบเข้าหลัง-ออกก่อน หรือ Last-In, First-Out (LIFO)?",
      options: ["จริง / ถูกต่อง", "เท็จ / ไม่ถูกต้อง"],
      answerIndex: 1,
      explanation: "ไม่ถูกต้อง โครงสร้างคิวใช้ระบบ First-In, First-Out (FIFO) ส่วนโครงสร้างแบบ สแต็ก (Stack) ต่างหากที่ใช้ Last-In, First-Out (LIFO)"
    }
  ],
  marine: [
    {
      question: "โลมา (Dolphin) และวาฬ (Whale) จัดเป็นสัตว์เลี้ยงลูกด้วยนมที่หายใจด้วยปอด ไม่ใช่กลุ่มปลา?",
      options: ["จริง / ถูกต้อง", "เท็จ / ไม่ถูกต้อง"],
      answerIndex: 0,
      explanation: "ถูกต้อง โลมาและวาฬเป็นสัตว์เลี้ยงลูกด้วยนมในทะเล (Marine Mammals) หายใจด้วยปอดผ่านช่องหายใจบนหัว และเลี้ยงลูกด้วยน้ำนม"
    },
    {
      question: "ฉลามเป็นปลากระดูกแข็งที่มีถุงลมสำหรับช่วยพยุงตัวให้ลอยน้ำได้โดยไม่ต้องว่ายน้ำตลอดเวลา?",
      options: ["จริง / ถูกต้อง", "เท็จ / ไม่ถูกต้อง"],
      answerIndex: 1,
      explanation: "ไม่ถูกต้อง ฉลามจัดเป็นปลากระดูกอ่อน (Cartilaginous fish) และไม่มีถุงลม ต้องอาศัยน้ำมันในตับและแรงยกจากการว่ายน้ำเพื่อไม่ให้จม"
    }
  ],
  animals: [
    {
      question: "เสือชีตาห์ (Cheetah) ได้รับการบันทึกว่าเป็นสัตว์บกที่สามารถวิ่งทำความเร็วระยะสั้นได้เร็วที่สุดในโลก?",
      options: ["จริง / ถูกต้อง", "เท็จ / ไม่ถูกต้อง"],
      answerIndex: 0,
      explanation: "ถูกต้อง เสือชีตาห์สามารถเร่งความเร็วได้ถึง 100-120 กม./ชม. ในระยะเวลาสั้นๆ ทำให้เป็นสัตว์บกที่เร็วที่สุดในโลก"
    },
    {
      question: "สัตว์เลือดอุ่น (เช่น สัตว์เลี้ยงลูกด้วยนมและนก) จะมีอุณหภูมิร่างกายเปลี่ยนแปลงขึ้นลงตามอุณหภูมิของสภาพแวดล้อมรอบตัวตลอดเวลา?",
      options: ["จริง / ถูกต้อง", "เท็จ / ไม่ถูกต้อง"],
      answerIndex: 1,
      explanation: "ไม่ถูกต้อง สัตว์เลือดอุ่น (Endotherm) สามารถควบคุมและรักษาอุณหภูมิภายในร่างกายให้คงที่ได้ สัตว์ที่อุณหภูมิเปลี่ยนตามสิ่งแวดล้อมคือสัตว์เลือดเย็น (Ectotherm)"
    }
  ]
};

function getFallbackQuestion(subject: string, format: string, usedQuestions: string[]): FallbackQuestion {
  const normFormat = (format || "").toLowerCase();
  const isTrueFalse = normFormat === "true_false";
  
  const normSub = (subject || "").toLowerCase();
  let pool: FallbackQuestion[];
  
  if (normSub.includes("math") || normSub.includes("คณิต")) {
    pool = isTrueFalse ? FALLBACK_TRUE_FALSE.math : FALLBACK_QUESTION_POOL.math;
  } else if (normSub.includes("marine") || normSub.includes("ocean") || normSub.includes("ทะเล") || normSub.includes("สมุทร") || normSub.includes("สัตว์น้ำ")) {
    pool = isTrueFalse ? FALLBACK_TRUE_FALSE.marine : FALLBACK_QUESTION_POOL.marine;
  } else if (normSub.includes("animal") || normSub.includes("wildlife") || normSub.includes("สัตว์บก") || normSub.includes("สัตว์ป่า")) {
    pool = isTrueFalse ? FALLBACK_TRUE_FALSE.animals : FALLBACK_QUESTION_POOL.animals;
  } else if (normSub.includes("science") || normSub.includes("วิทย์") || normSub.includes("ฟิสิกส์") || normSub.includes("เคมี") || normSub.includes("ชีว")) {
    pool = isTrueFalse ? FALLBACK_TRUE_FALSE.science : FALLBACK_QUESTION_POOL.science;
  } else if (normSub.includes("english") || normSub.includes("อังกฤษ") || normSub.includes("ภาษา")) {
    pool = isTrueFalse ? FALLBACK_TRUE_FALSE.english : FALLBACK_QUESTION_POOL.english;
  } else if (normSub.includes("history") || normSub.includes("ประวัติ") || normSub.includes("สังคม") || normSub.includes("social")) {
    pool = isTrueFalse ? FALLBACK_TRUE_FALSE.history : FALLBACK_QUESTION_POOL.history;
  } else if (normSub.includes("coding") || normSub.includes("code") || normSub.includes("โค้ด") || normSub.includes("โปรแกรม")) {
    pool = isTrueFalse ? FALLBACK_TRUE_FALSE.coding : FALLBACK_QUESTION_POOL.coding;
  } else {
    pool = isTrueFalse ? FALLBACK_TRUE_FALSE.computer : FALLBACK_QUESTION_POOL.computer;
  }
  
  const usedSet = new Set(usedQuestions || []);
  const available = pool.filter(q => !usedSet.has(q.question));
  
  if (available.length > 0) {
    const randIndex = Math.floor(Math.random() * available.length);
    return available[randIndex];
  }
  
  const randIndex = Math.floor(Math.random() * pool.length);
  return pool[randIndex];
}

// Host health check
app.get("/api/health", (req, res) => {
  res.json({ status: "ok", time: new Date().toISOString() });
});

// Subject question generator
app.post("/api/generate-question", async (req, res) => {
  try {
    const { subject, difficulty, educationLevel, questionType, questionFormat, usedQuestions } = req.body;
    
    if (!subject) {
      return res.status(400).json({ error: "Subject is required." });
    }

    const ai = getGenAI();

    // Map the selected options into explicit guidance instructions for the AI
    const educationLevelMap: Record<string, string> = {
      p1: "ระดับชั้นประถมศึกษาปีที่ 1 (ป.1) เนื้อหาขั้นพื้นฐานที่สุด ตัวอักษรและหลักการเลขคณิตหรือคำศัพท์เบื้องต้นที่สุด เหมาะสำหรับเด็ก ป.1",
      p2: "ระดับชั้นประถมศึกษาปีที่ 2 (ป.2) เนื้อหาเสริมทักษะเบื้องต้นต่อเนื่องจาก ป.1 เน้นความเข้าใจง่าย คำศัพท์สั้นๆ เหมาะสำหรับเด็ก ป.2",
      p3: "ระดับชั้นประถมศึกษาปีที่ 3 (ป.3) เนื้อหาหลักสูตรประโยคและหลักการทางวิทยาศาสตร์หรือคณิตศาสตร์สำหรับเด็ก ป.3",
      p4: "ระดับชั้นประถมศึกษาปีที่ 4 (ป.4) ยกระดับเนื้อหาขึ้นมาปานกลางสำหรับประถมศึกษาตอนปลาย เน้นการอ่านจับใจความและกลุ่มคำศัพท์",
      p5: "ระดับชั้นประถมศึกษาปีที่ 5 (ป.5) เนื้อหารายวิชาเน้นหลักสูตรแกนกลางวิชาประถม 5 ความเข้าใจเรื่องพื้นฐานเชิงลึกขึ้น",
      p6: "ระดับชั้นประถมศึกษาปีที่ 6 (ป.6) เนื้อหาประถมศึกษาปีที่ 6 เตรียมตัวสอบจบประถมศึกษาตอนปลายและเข้าเรียนมัธยมต้น",
      m1: "ระดับชั้นมัธยมศึกษาปีที่ 1 (ม.1) เจาะจงเนื้อหาตามหลักสูตรแกนกลางวิชาของ ม.1 ตรงตามช่วงอายุพัฒนาการชั้นปีนี้",
      m2: "ระดับชั้นมัธยมศึกษาปีที่ 2 (ม.2) เจาะจงเนื้อหาตามหลักสูตรแกนกลางวิชาของ ม.2 ตรงตามช่วงอายุพัฒนาการชั้นปีนี้",
      m3: "ระดับชั้นมัธยมศึกษาปีที่ 3 (ม.3) เจาะจงเนื้อหาตามหลักสูตรแกนกลางวิชาของ ม.3 และเตรียมความพร้อมสอบแข่งขันปลายเทอม ม.ต้น",
      m4: "ระดับชั้นมัธยมศึกษาปีที่ 4 (ม.4) เนื้อหาเจาะลึกวิเคราะห์ ทฤษฎีวิชาการสำหรับการเริ่มต้นสายสามัญหรือมัธยมศึกษาตอนปลาย",
      m5: "ระดับชั้นมัธยมศึกษาปีที่ 5 (ม.5) เนื้อหารายวิชาเชิงลึกและทฤษฎีประยุกต์เข้มข้นของระดับมัธยมปลายชั้นปีที่ 5",
      m6: "ระดับชั้นมัธยมศึกษาปีที่ 6 (ม.6) ระดับชั้นมัธยมปลายปีสุดท้าย เน้นการติวโจทย์สอบเข้า มีระดับความวิเคราะห์ยากพิเศษ",
      primary: "ระดับชั้นประถมศึกษา (ป.1 - ป.6) เน้นเนื้อหาเข้าใจง่าย ชัดเจน ใช้ภาษาไทยที่กระชับและส่งเสริมการเรียนรู้ของเด็กวัยประถม",
      junior_high: "ระดับชั้นมัธยมศึกษาตอนต้น (ม.1 - ม.3) เนื้อหาระดับปานกลาง มีหลักการและเหตุผลสอดคล้องหลักสูตรแกนกลาง ม.ต้น",
      senior_high: "ระดับชั้นมัธยมศึกษาตอนปลาย (ม.4 - ม.6) เน้นการประยุกต์ใช้แนวคิดเชิงลึก ทักษะการวิเคราะห์โจทย์ และระดับความยากสอดคล้องหลักสูตร ม.ปลาย หรือเตรียมสอบต่อ",
      university: "ระดับอุดมศึกษา / มหาวิทยาลัย และบุคคลทั่วไป มีความลึกซึ้งเชิงวิชาการ ใช้ศัพท์เทคนิคระดับวิชาชีพและการประยุกต์ทฤษฎีขั้นสูง"
    };

    const questionTypeMap: Record<string, string> = {
      review: "ประเภทคำถาม: 'คำถามทบทวนเนื้อความเชิงความรู้ความจำ' (Review / Recall question - เพื่อพิจารณาจุดสำคัญ คีย์เวิร์ด และนิยามเบื้องต้น)",
      comprehension: "ประเภทคำถาม: 'คำถามวัดระดีบความเข้าใจและการวิเคราะห์เชื่อมโยง' (Comprehension & Application question - เน้นวิเคราะห์ความสัมพันธ์ เหตุผล และประยุกต์ทฤษฎี)",
      past_exams: "ประเภทคำถาม: 'คำถามจำลองแนวข้อสอบเก่าระดับชาติหรือข้อสอบแข่งขันจริง' (National Standard/Competitive Past Exam paper style - ใช้ภาษาและโครงสร้างรัดกุม เป็นทางการ ท้าทายสูง)"
    };

    const questionFormatMap: Record<string, string> = {
      multiple_choice: "รูปแบบคำถาม: 'ปรนัย 4 ตัวเลือก' (Multiple Choice with exactly 4 options). ตัวเลือกทั้งหมดต้องสมเหตุสมผลและมีคำตอบที่ถูกที่สุดเพียงข้อเดียว",
      true_false: "รูปแบบคำถาม: 'จริง / เท็จ' (True or False questions with exactly 2 options). ให้กำหนดอาร์เรย์ options เป็น ['จริง', 'เท็จ'] (หรือ ['ถูก', 'ผิด']) และระบุระดับ index เป็น 0 (สำหรับจริง) หรือ 1 (สำหรับเท็จ)",
      fill_in_blank: "รูปแบบคำถาม: 'เติมคำในช่องว่าง' (Fill in the blank questions with 4 options to choose from). ในเนื้อความคำถามของคุณ จะต้องมีจุดที่เว้นคำตอบเป็นสัญลักษณ์ขีดล่างยาวตัวอย่าง '_______' เพื่อให้เลือกคำตอบ 4 ตัวเลือกจาก options ไปเติมเต็มคำถามให้สมบูรณ์"
    };

    const eduText = educationLevelMap[educationLevel] || educationLevelMap.junior_high;
    const typeText = questionTypeMap[questionType] || questionTypeMap.comprehension;
    const formatText = questionFormatMap[questionFormat] || questionFormatMap.multiple_choice;

    const usedQuestionsContext = usedQuestions && Array.isArray(usedQuestions) && usedQuestions.length > 0
      ? `To make the question unique, DO NOT duplicate or ask any of these recently asked questions: ${usedQuestions.slice(-5).map(q => `"${q}"`).join(", ")}.`
      : "";

    const userPrompt = `
Generate an engaging, educational single choice quiz question in Thai language (ภาษาไทย) on the subject: "${subject}".

Please design the question based on the following configurations:
- Target Learner Education Level: ${eduText}
- Question Type: ${typeText}
- Question Format: ${formatText}
- Difficulty: "${difficulty || "Medium"}" (Adjust complexity accordingly)

CRITICAL BREVITY REQUIREMENT (ข้อกำหนดด้านความกระชับสูงสุดเพื่อลดความเหนื่อยล้าของผู้อ่าน):
1. Question text MUST be extremely short, clear, and direct. Max 1-2 very short sentences (ไม่เกริ่นเยิ่นเย้อ).
2. All answer options MUST be brief, short words or concise phrases. Avoid long verbose clauses.
3. The explanation MUST be punchy, clear, and straight to the point. Max 1-2 standard short sentences (อธิบายแบบกระชับ รวดเร็ว สั้นและเฉียบคมที่สุด).

Additional guidelines:
Provide a clear, extremely concise, educational explanation in Thai explaining why the correct option is right and why other options are wrong.
${usedQuestionsContext}
`;

    const systemInstruction = `You are an expert, professional Thai educator and curriculum designer. You specialize in generating premium-grade learning assessment questions, test papers, and explanations for various academic subjects and education levels in Thailand. Output ONLY a valid JSON object matching the requested schema. Ensure everything is extremely concise and short.`;

    const modelsToTry = [
      "gemini-3.5-flash",
      "gemini-flash-latest",
      "gemini-3.1-flash-lite"
    ];

    let lastError: any = null;
    let parsedQuestion: any = null;

    for (const currentModel of modelsToTry) {
      try {
        console.log(`Attempting question generation with model: ${currentModel}`);
        const response = await ai.models.generateContent({
          model: currentModel,
          contents: userPrompt,
          config: {
            systemInstruction,
            responseMimeType: "application/json",
            responseSchema: {
              type: "OBJECT",
              properties: {
                question: { 
                  type: "STRING", 
                  description: "The question text in professional Thai, corresponding to the requested subject, education level, and format. Must be extremely concise." 
                },
                options: {
                  type: "ARRAY",
                  items: { type: "STRING" },
                  description: "The array of answer options in Thai. If multiple_choice or fill_in_blank, must have exactly 4 items. If true_false, must have exactly 2 elements: ['จริง', 'เท็จ'] (or ['ถูก', 'ผิด'])."
                },
                answerIndex: { 
                  type: "INTEGER", 
                  description: "The 0-based index of the correct answer in the options array. For 4 options, it must be 0, 1, 2, or 3. For 2 options, it must be 0 or 1." 
                },
                explanation: { 
                  type: "STRING", 
                  description: "An extremely brief and punchy educational explanation written in Thai explaining why the answer is correct and breaking down the concepts (max 1-2 sentences)." 
                }
              },
              required: ["question", "options", "answerIndex", "explanation"]
            }
          }
        });

        const textOutput = response.text;
        if (textOutput) {
          parsedQuestion = JSON.parse(textOutput);
          console.log(`Successfully generated question using model ${currentModel}`);
          break; 
        }
      } catch (err: any) {
        console.warn(`Model ${currentModel} failed to generate content:`, err.message || err);
        lastError = err;
      }
    }

    if (!parsedQuestion) {
      console.warn("All Gemini API models failed or returned empty. Using premium local static fallback question.", lastError);
      parsedQuestion = getFallbackQuestion(subject, questionFormat, usedQuestions);
    }

    res.json(parsedQuestion);
  } catch (error: any) {
    console.error("Critical error in question route:", error);
    try {
      const backup = getFallbackQuestion(req.body?.subject || "general", req.body?.questionFormat || "multiple_choice", req.body?.usedQuestions || []);
      res.json(backup);
    } catch (fallbackErr) {
      res.status(500).json({
        error: "Failed to generate question. Please try again.",
        details: error.message
      });
    }
  }
});

function getFallbackQuestionsBulk(subject: string, format: string, count: number): FallbackQuestion[] {
  const result: FallbackQuestion[] = [];
  const used: string[] = [];
  for (let i = 0; i < count; i++) {
    const q = getFallbackQuestion(subject, format, used);
    result.push(q);
    used.push(q.question);
  }
  return result;
}

// Bulk subject question generator
app.post("/api/generate-questions-bulk", async (req, res) => {
  try {
    const { subject, difficulty, educationLevel, questionType, questionFormat, count = 5 } = req.body;
    
    if (!subject) {
      return res.status(400).json({ error: "Subject is required." });
    }

    const ai = getGenAI();

    // Map the selected options into explicit guidance instructions for the AI
    const educationLevelMap: Record<string, string> = {
      p1: "ระดับชั้นประถมศึกษาปีที่ 1 (ป.1) เนื้อหาขั้นพื้นฐานที่สุด ตัวอักษรและหลักการเลขคณิตหรือคำศัพท์เบื้องต้นที่สุด เหมาะสำหรับเด็ก ป.1",
      p2: "ระดับชั้นประถมศึกษาปีที่ 2 (ป.2) เนื้อหาเสริมทักษะเบื้องต้นต่อเนื่องจาก ป.1 เน้นความเข้าใจง่าย คำศัพท์สั้นๆ เหมาะสำหรับเด็ก ป.2",
      p3: "ระดับชั้นประถมศึกษาปีที่ 3 (ป.3) เนื้อหาหลักสูตรประโยคและหลักการทางวิทยาศาสตร์หรือคณิตศาสตร์สำหรับเด็ก ป.3",
      p4: "ระดับชั้นประถมศึกษาปีที่ 4 (ป.4) ยกระดับเนื้อหาขึ้นมาปานกลางสำหรับประถมศึกษาตอนปลาย เน้นการอ่านจับใจความและกลุ่มคำศัพท์",
      p5: "ระดับชั้นประถมศึกษาปีที่ 5 (ป.5) เนื้อหารายวิชาเน้นหลักสูตรแกนกลางวิชาประถม 5 ความเข้าใจเรื่องพื้นฐานเชิงลึกขึ้น",
      p6: "ระดับชั้นประถมศึกษาปีที่ 6 (ป.6) เนื้อหาประถมศึกษาปีที่ 6 เตรียมตัวสอบจบประถมศึกษาตอนปลายและเข้าเรียนมัธยมต้น",
      m1: "ระดับชั้นมัธยมศึกษาปีที่ 1 (ม.1) เจาะจงเนื้อหาตามหลักสูตรแกนกลางวิชาของ ม.1 ตรงตามช่วงอายุพัฒนาการชั้นปีนี้",
      m2: "ระดับชั้นมัธยมศึกษาปีที่ 2 (ม.2) เจาะจงเนื้อหาตามหลักสูตรแกนกลางวิชาของ ม.2 ตรงตามช่วงอายุพัฒนาการชั้นปีนี้",
      m3: "ระดับชั้นมัธยมศึกษาปีที่ 3 (ม.3) เจาะจงเนื้อหาตามหลักสูตรแกนกลางวิชาของ ม.3 และเตรียมความพร้อมสอบแข่งขันปลายเทอม ม.ต้น",
      m4: "ระดับชั้นมัธยมศึกษาปีที่ 4 (ม.4) เนื้อหาเจาะลึกวิเคราะห์ ทฤษฎีวิชาการสำหรับการเริ่มต้นสายสามัญหรือมัธยมศึกษาตอนปลาย",
      m5: "ระดับชั้นมัธยมศึกษาปีที่ 5 (ม.5) เนื้อหารายวิชาเชิงลึกและทฤษฎีประยุกต์เข้มข้นของระดับมัธยมปลายชั้นปีที่ 5",
      m6: "ระดับชั้นมัธยมศึกษาปีที่ 6 (ม.6) ระดับชั้นมัธยมปลายปีสุดท้าย เน้นการติวโจทย์สอบเข้า มีระดับความวิเคราะห์ยากพิเศษ",
      primary: "ระดับชั้นประถมศึกษา (ป.1 - ป.6) เน้นเนื้อหาเข้าใจง่าย ชัดเจน ใช้ภาษาไทยที่กระชับและส่งเสริมการเรียนรู้ของเด็กวัยประถม",
      junior_high: "ระดับชั้นมัธยมศึกษาตอนต้น (ม.1 - ม.3) เนื้อหาระดับปานกลาง มีหลักการและเหตุผลสอดคล้องหลักสูตรแกนกลาง ม.ต้น",
      senior_high: "ระดับชั้นมัธยมศึกษาตอนปลาย (ม.4 - ม.6) เน้นการประยุกต์ใช้แนวคิดเชิงลึก ทักษะการวิเคราะห์โจทย์ และระดับความยากสอดคล้องหลักสูตร ม.ปลาย หรือเตรียมสอบต่อ",
      university: "ระดับอุดมศึกษา / มหาวิทยาลัย และบุคคลทั่วไป มีความลึกซึ้งเชิงวิชาการ ใช้ศัพท์เทคนิคระดับวิชาชีพและการประยุกต์ทฤษฎีขั้นสูง"
    };

    const questionTypeMap: Record<string, string> = {
      review: "ประเภทคำถาม: 'คำถามทบทวนเนื้อความเชิงความรู้ความจำ' (Review / Recall question - เพื่อพิจารณาจุดสำคัญ คีย์เวิร์ด และนิยามเบื้องต้น)",
      comprehension: "ประเภทคำถาม: 'คำถามวัดระดีบความเข้าใจและการวิเคราะห์เชื่อมโยง' (Comprehension & Application question - เน้นวิเคราะห์ความสัมพันธ์ เหตุผล และประยุกต์ทฤษฎี)",
      past_exams: "ประเภทคำถาม: 'คำถามจำลองแนวข้อสอบเก่าระดับชาติหรือข้อสอบแข่งขันจริง' (National Standard/Competitive Past Exam paper style - ใช้ภาษาและโครงสร้างรัดกุม เป็นทางการ ท้าทายสูง)"
    };

    const questionFormatMap: Record<string, string> = {
      multiple_choice: "รูปแบบคำถาม: 'ปรนัย 4 ตัวเลือก' (Multiple Choice with exactly 4 options). ตัวเลือกทั้งหมดต้องสมเหตุสมผลและมีคำตอบที่ถูกที่สุดเพียงข้อเดียว",
      true_false: "รูปแบบคำถาม: 'จริง / เท็จ' (True or False questions with exactly 2 options). ให้กำหนดอาร์เรย์ options เป็น ['จริง', 'เท็จ'] (หรือ ['ถูก', 'ผิด']) และระบุระดับ index เป็น 0 (สำหรับจริง) หรือ 1 (สำหรับเท็จ)",
      fill_in_blank: "รูปแบบคำถาม: 'เติมคำในช่องว่าง' (Fill in the blank questions with 4 options to choose from). ในเนื้อความคำถามของคุณ จะต้องมีจุดที่เว้นคำตอบเป็นสัญลักษณ์ขีดล่างยาวตัวอย่าง '_______' เพื่อให้เลือกคำตอบ 4 ตัวเลือกจาก options ไปเติมเต็มคำถามให้สมบูรณ์"
    };

    const eduText = educationLevelMap[educationLevel] || educationLevelMap.junior_high;
    const typeText = questionTypeMap[questionType] || questionTypeMap.comprehension;
    const formatText = questionFormatMap[questionFormat] || questionFormatMap.multiple_choice;

    const userPrompt = `
Generate exactly ${count} unique, engaging, and educational single choice quiz questions in Thai language (ภาษาไทย) on the subject: "${subject}".

Please design all ${count} questions based on the following configurations:
- Target Learner Education Level: ${eduText}
- Question Type: ${typeText}
- Question Format: ${formatText}
- Difficulty: "${difficulty || "Medium"}" (Adjust complexity accordingly)

CRITICAL BREVITY REQUIREMENT (ข้อกำหนดด้านความกระชับสูงสุดเพื่อลดความเหนื่อยล้าของผู้อ่าน):
1. Question text MUST be extremely short, clear, and direct. Max 1-2 very short sentences (ไม่เกริ่นเยิ่นเย้อ).
2. All answer options MUST be brief, short words or concise phrases. Avoid long verbose clauses.
3. The explanation MUST be punchy, clear, and straight to the point. Max 1-2 standard short sentences (อธิบายแบบกระชับ รวดเร็ว สั้นและเฉียบคมที่สุด).

Additional guidelines:
For each question, provide a clear, extremely concise, educational explanation in Thai explaining why the correct option is right.
Do not repeat topics or questions within the generated set.
`;

    const systemInstruction = `You are an expert, professional Thai educator and curriculum designer. You specialize in generating batches of premium-grade learning assessment questions, test papers, and explanations for various academic subjects and education levels in Thailand. Output ONLY a valid JSON object matching the requested schema. Ensure everything is extremely concise and short.`;

    const modelsToTry = [
      "gemini-3.5-flash",
      "gemini-flash-latest",
      "gemini-3.1-flash-lite"
    ];

    let lastError: any = null;
    let parsedResult: any = null;

    for (const currentModel of modelsToTry) {
      try {
        console.log(`Attempting batch question generation with model: ${currentModel}`);
        const response = await ai.models.generateContent({
          model: currentModel,
          contents: userPrompt,
          config: {
            systemInstruction,
            responseMimeType: "application/json",
            responseSchema: {
              type: "OBJECT",
              properties: {
                questions: {
                  type: "ARRAY",
                  items: {
                    type: "OBJECT",
                    properties: {
                      question: { 
                        type: "STRING", 
                        description: "The question text in professional Thai, corresponding to the requested subject, education level, and format. Must be extremely concise." 
                      },
                      options: {
                        type: "ARRAY",
                        items: { type: "STRING" },
                        description: "The array of answer options in Thai. If multiple_choice or fill_in_blank, must have exactly 4 items. If true_false, must have exactly 2 elements: ['จริง', 'เท็จ'] (or ['ถูก', 'ผิด'])."
                      },
                      answerIndex: { 
                        type: "INTEGER", 
                        description: "The 0-based index of the correct answer in the options array. For 4 options, it must be 0, 1, 2, or 3. For 2 options, it must be 0 or 1." 
                      },
                      explanation: { 
                        type: "STRING", 
                        description: "An extremely brief and punchy educational explanation written in Thai explaining why the answer is correct (max 1-2 sentences)." 
                      }
                    },
                    required: ["question", "options", "answerIndex", "explanation"]
                  },
                  description: "Array of generated quiz questions."
                }
              },
              required: ["questions"]
            }
          }
        });

        const textOutput = response.text;
        if (textOutput) {
          const parsed = JSON.parse(textOutput);
          if (parsed && Array.isArray(parsed.questions) && parsed.questions.length > 0) {
            parsedResult = parsed;
            console.log(`Successfully generated ${parsed.questions.length} questions using model ${currentModel}`);
            break;
          }
        }
      } catch (err: any) {
        console.warn(`Model ${currentModel} failed to generate bulk content:`, err.message || err);
        lastError = err;
      }
    }

    if (!parsedResult) {
      console.warn("All Gemini API models failed bulk or returned empty. Using premium local static fallback questions.", lastError);
      parsedResult = {
        questions: getFallbackQuestionsBulk(subject, questionFormat, count)
      };
    }

    res.json(parsedResult);
  } catch (error: any) {
    console.error("Critical error in bulk question route:", error);
    try {
      const backup = {
        questions: getFallbackQuestionsBulk(req.body?.subject || "general", req.body?.questionFormat || "multiple_choice", req.body?.count || 5)
      };
      res.json(backup);
    } catch (fallbackErr) {
      res.status(500).json({
        error: "Failed to generate questions bulk. Please try again.",
        details: error.message
      });
    }
  }
});

// Vite dev vs production routing
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    // We create a Vite dev server in middleware mode
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    // Use vite's connect instance as middleware
    app.use(vite.middlewares);
    console.log("Vite dev server mounted in middleware mode.");
  } else {
    // In production, serve the dist folder
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
    console.log("Serving static production built assets.");
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server starting on http://localhost:${PORT}`);
  });
}

startServer();
