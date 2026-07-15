type GeneratePayload = {
  prompt: string;
  width?: number;
  height?: number;
  output?: "png" | "svg" | "both";
  style?: Record<string, unknown>;
  brand_rules?: Record<string, unknown>;
  filename_prefix?: string;
  vectorizer?: string;
};


type GenerateResponse = {
  [key: string]: unknown;
};



export async function generateSymbol(
  payload: GeneratePayload
): Promise<GenerateResponse> {

  const res =
    await fetch(
      "http://localhost:5001/generate",
      {
        method: "POST",

        headers: {
          "Content-Type": "application/json",
        },

        body:
          JSON.stringify(payload),
      }
    );


  if (!res.ok) {
    throw new Error(
      `Engine error ${res.status}`
    );
  }


  return res.json();

}