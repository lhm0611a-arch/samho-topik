export async function getAIFeedback(prompt: string, systemInstruction: string): Promise<string> {
  const res = await fetch("/api/feedback", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ prompt, systemInstruction }),
  });
  
  if (!res.ok) {
    throw new Error("Failed to fetch AI feedback");
  }
  
  const data = await res.json();
  return data.text;
}

export async function extractPDFWithAI(prompt: string, base64Image: string): Promise<string> {
  const res = await fetch("/api/extract", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ prompt, base64Image }),
  });
  
  if (!res.ok) {
    throw new Error("Failed to extract PDF data");
  }
  
  const data = await res.json();
  return data.text;
}
