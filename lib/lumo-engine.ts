export async function generateSymbol(payload: {
  prompt: string;
  width?: number;
  height?: number;
  output?: "png" | "svg" | "both";
  style?: any;
  brand_rules?: any;
  filename_prefix?: string;
  vectorizer?: string;
}) {
  const res = await fetch("http://localhost:5001/generate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    throw new Error(`Engine error ${res.status}`);
  }

  return res.json();
}
