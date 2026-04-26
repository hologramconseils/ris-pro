
import { GoogleGenerativeAI } from "@google/generative-ai";
import { createClient } from "@supabase/supabase-js";
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY
);

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY);

async function test() {
  const filePath = "uploads/30cvuypzl4n_1777145909774.pdf";
  console.log("Downloading...", filePath);
  
  const { data: fileData, error: downloadError } = await supabase.storage
    .from('documents')
    .download(filePath);

  if (downloadError) {
    console.error("Download Error:", downloadError);
    return;
  }

  console.log("Converting to base64...");
  const arrayBuffer = await fileData.arrayBuffer();
  const base64Data = Buffer.from(arrayBuffer).toString('base64');

  const modelsToTry = ["gemini-2.5-flash"];
  
  for (const modelName of modelsToTry) {
    try {
      console.log(`Trying model: ${modelName}`);
      const model = genAI.getGenerativeModel({ model: modelName });
      const prompt = "Analyse ce relevé de carrière et donne moi les anomalies en JSON.";
      
      const result = await model.generateContent([
        {
          inlineData: {
            data: base64Data,
            mimeType: "application/pdf"
          }
        },
        prompt
      ]);

      console.log(`Result from ${modelName}:`, result.response.text());
      break;
    } catch (e) {
      console.error(`Error with ${modelName}:`, e.message);
    }
  }
}

test();
