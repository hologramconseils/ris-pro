import { GoogleGenerativeAI } from "@google/generative-ai";

const apiKey = "AIzaSyCxM3UCKEDTGYq0De5R6Vq_kMdOWeEGpLs";
const genAI = new GoogleGenerativeAI(apiKey);

async function test() {
  console.log("Testing Gemini API with model gemini-1.5-flash...")
  try {
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
    const result = await model.generateContent("Hello, are you working?");
    console.log("Response:", result.response.text());
  } catch (error) {
    console.error("Gemini Error:", error.message);
  }
}

test()
