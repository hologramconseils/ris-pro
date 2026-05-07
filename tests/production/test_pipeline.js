// Native fetch is used (Node 18+)

const BASE_URL = process.env.TEST_URL || "https://ris.hologramconseils.com";

async function testHealth() {
  console.log(`--- Testing Health Check at ${BASE_URL} ---`);
  try {
    const res = await fetch(`${BASE_URL}/api/analyze`);
    const data = await res.json();
    console.log("Status:", res.status);
    console.log("Version:", data.version || "Unknown");
    if (data.version && data.version.includes("20260507")) {
      console.log("✅ Latest version is deployed!");
    } else {
      console.log("❌ Older version detected.");
    }
  } catch (err) {
    console.error("Health check failed:", err.message);
  }
}

async function testAnalysis(filePath) {
  console.log(`--- Testing Analysis for ${filePath} ---`);
  try {
    const res = await fetch(`${BASE_URL}/api/analyze`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ filePath })
    });
    
    if (res.status === 405) {
      console.log("❌ 405 Method Not Allowed - The endpoint is likely static or misconfigured.");
      return;
    }

    const data = await res.json();
    if (res.ok) {
      console.log("✅ Analysis successful!");
      console.log("Anomalies found:", data.anomalies?.length || 0);
    } else {
      console.log("❌ Analysis failed:", data.error || data.details);
    }
  } catch (err) {
    console.error("Analysis request failed:", err.message);
  }
}

async function runTests() {
  await testHealth();
  // On teste avec le fichier identifié dans le screenshot de l'utilisateur
  await testAnalysis("uploads/80pjpy7lyd_1778167409366.pdf");
}

runTests();
