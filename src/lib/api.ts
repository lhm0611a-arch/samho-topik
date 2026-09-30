export async function getAIFeedback(prompt: string, systemInstruction: string): Promise<string> {
  const res = await fetch("/api/feedback", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ prompt, systemInstruction }),
  });
  
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || "Failed to fetch AI feedback");
  }
  
  return data.text;
}

export async function extractPDFWithAI(prompt: string, base64Image: string): Promise<string> {
  const res = await fetch("/api/extract", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ prompt, base64Image }),
  });
  
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || "Failed to extract PDF data");
  }
  
  return data.text;
}

