import fs from 'fs';
import { GoogleGenerativeAI } from '@google/generative-ai';
import dotenv from 'dotenv';
dotenv.config();

const genAI = new GoogleGenerativeAI(process.env.VITE_GEMINI_API_KEY);

async function run() {
  try {
    const pdfPath = '/Users/hologramconseils/.gemini/antigravity/brain/03e8348f-7efa-423f-b213-9b1efc9cbb6b/.user_uploaded/media__1784997129541.pdf';
    const filePart = {
      inlineData: {
        data: fs.readFileSync(pdfPath).toString("base64"),
        mimeType: "application/pdf"
      }
    };
    
    console.log("Analyzing...");
    const extractorModel = genAI.getGenerativeModel({ 
      model: "gemini-2.5-pro",
    });
    
    const prompt = `Extraire au format JSON uniquement le tableau intitulé "Détail par année". Pour chaque ligne (année), extrait l'année, le total des trimestres validés ("Durée tous régimes"), et la somme des points.`;
    
    const res = await extractorModel.generateContent([prompt, filePart]);
    console.log(res.response.text());
  } catch (e) {
    console.error(e);
  }
}
run();
