import { GoogleGenerativeAI } from "@google/generative-ai";
import fs from "fs";
import dotenv from "dotenv";
dotenv.config({ path: "./.env" });

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

async function run() {
  const pdfPath = "/Users/hologramconseils/.gemini/antigravity/brain/03e8348f-7efa-423f-b213-9b1efc9cbb6b/.user_uploaded/media__1784984162982.pdf";
  const base64Data = fs.readFileSync(pdfPath).toString("base64");
  
  // Try calling the extractor
  const extractorModel = genAI.getGenerativeModel({ model: "gemini-2.5-pro" });
  
  const extractorPrompt = `
Extraire les carrières.
Réponds uniquement en JSON.
{
  "is_valid_document": true,
  "carrieres": [{"year": "2000", "employer": "X", "trimesters": "4", "points": "120", "salary": "20000"}]
}`;

  try {
     const res = await extractorModel.generateContent([
       { inlineData: { data: base64Data, mimeType: "application/pdf" } },
       extractorPrompt
     ]);
     console.log(res.response.text().substring(0, 500));
  } catch (e) {
     console.error(e);
  }
}
run();
