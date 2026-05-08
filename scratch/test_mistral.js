import axios from 'axios';

const apiKey = "MISTRAL_API_KEY_HERE"; // Replace with actual key

async function testMistral() {
  try {
    const response = await axios.post('https://api.mistral.ai/v1/chat/completions', {
      model: "mistral-tiny",
      messages: [{ role: "user", content: "Hello, are you working?" }]
    }, {
      headers: { 'Authorization': `Bearer ${apiKey}` }
    });
    console.log("Mistral Response:", response.data.choices[0].message.content);
  } catch (error) {
    console.error("Mistral Error:", error.response?.data || error.message);
  }
}

testMistral();
