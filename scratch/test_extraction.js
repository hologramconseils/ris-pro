import { GoogleGenerativeAI, SchemaType } from "@google/generative-ai";
import fs from "fs";
import { config } from 'dotenv';
import { resolve } from 'path';

config({ path: resolve(process.cwd(), '.env.vercel') });

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY);

async function run() {
  const pdfPath = "/Users/hologramconseils/.gemini/antigravity/brain/03e8348f-7efa-423f-b213-9b1efc9cbb6b/.user_uploaded/media__1784984162982.pdf";
  const base64Data = fs.readFileSync(pdfPath, { encoding: 'base64' });

  const extractorPrompt = `
<role>Tu es un outil d'extraction de données automatisé (Extracteur expert). Ta tâche exclusive est d'analyser le document PDF (Relevé de Carrière, RIS ou EIG) et d'en extraire les données brutes avec une précision absolue, sans aucune interprétation.</role>

<instructions>
1. Repère le NIR (Numéro de Sécurité Sociale) pour valider le document.
2. Parcourt le document année par année, ligne par ligne.
3. Pour chaque ligne de carrière, extrais l'année, le nom de l'employeur (ou la nature: Chômage, Maladie, Service Militaire), les trimestres validés (ou "trimestres retenus"), les points de retraite complémentaire, et le revenu/salaire brut.
</instructions>

<regles_strictes>
- ZERO HALLUCINATION : N'invente jamais une année ou un employeur. Si la page est illisible, n'invente rien.
- Sépare bien les lignes si une année comporte plusieurs employeurs.
- Si une colonne est vide, absente, ou non chiffrée pour une ligne spécifique : 
  - Trimestres : 0
  - Points : 0.0
  - Salaire : "N/A"
- Ne consolide pas les lignes, n'additionne pas, copie fidèlement le tableau.
</regles_strictes>
  `;

  const extractorSchema = {
    type: SchemaType.OBJECT,
    properties: {
      is_valid_document: { type: SchemaType.BOOLEAN },
      nir: { type: SchemaType.STRING },
      carrieres: {
        type: SchemaType.ARRAY,
        items: {
          type: SchemaType.OBJECT,
          properties: {
            year: { type: SchemaType.INTEGER },
            employer: { type: SchemaType.STRING },
            trimesters: { type: SchemaType.INTEGER },
            points: { type: SchemaType.NUMBER },
            salary: { type: SchemaType.STRING }
          },
          required: ["year", "employer", "trimesters", "points", "salary"]
        }
      }
    },
    required: ["is_valid_document", "nir", "carrieres"]
  };

  const model = genAI.getGenerativeModel({ 
    model: "gemini-2.5-flash",
    generationConfig: { 
      responseMimeType: "application/json",
      responseSchema: extractorSchema 
    }
  });

  try {
    const result = await model.generateContent([
      { inlineData: { data: base64Data, mimeType: "application/pdf" } },
      { text: extractorPrompt }
    ]);
    console.log(JSON.stringify(JSON.parse(result.response.text()), null, 2));
  } catch (err) {
    console.error("Error:", err);
  }
}
run();
