import { CONFIG } from "@/lib/config";

import type {
  Msg
} from "@/lib/agent/types";


export type OllamaMessage = Msg;



/**
 * Send streaming request to Ollama
 */
export async function ollamaStream(
  messages: OllamaMessage[]
): Promise<ReadableStream<Uint8Array>> {


  const res =
    await fetch(
      `${CONFIG.ollamaUrl}/api/chat`,
      {
        method: "POST",

        headers: {
          "Content-Type": "application/json",
        },

        body: JSON.stringify({

          model: CONFIG.model,

          messages,

          stream: true,

        }),
      }
    );



  if (!res.ok || !res.body) {

    const text =
      await res.text()
        .catch(() => "");


    throw new Error(
      `Ollama error ${res.status}: ${text}`
    );

  }



  return res.body;

}



/**
 * Parse Ollama NDJSON stream
 */
export async function* iterOllamaTokens(
  stream: ReadableStream<Uint8Array>
) {


  const reader =
    stream.getReader();


  const decoder =
    new TextDecoder();


  let buffer = "";



  while (true) {


    const {
      value,
      done
    } =
      await reader.read();



    if (done) {
      break;
    }



    buffer += decoder.decode(
      value,
      {
        stream: true
      }
    );



    const lines =
      buffer.split("\n");



    buffer =
      lines.pop() ?? "";



    for (const line of lines) {


      const trimmed =
        line.trim();



      if (!trimmed) {
        continue;
      }



      try {

        const json =
          JSON.parse(trimmed);



        const token =
          json?.message?.content;



        if (token) {
          yield token;
        }


      } catch {

        // Ignore malformed chunks

      }

    }

  }

}



/**
 * Non-streaming Ollama request
 */
export async function chatWithOllama(
  messages: OllamaMessage[]
): Promise<string> {


  const res =
    await fetch(
      `${CONFIG.ollamaUrl}/api/chat`,
      {

        method: "POST",

        headers: {
          "Content-Type": "application/json",
        },

        body: JSON.stringify({

          model: CONFIG.model,

          messages,

          stream: false,

        }),

      }
    );



  if (!res.ok) {


    const text =
      await res.text()
        .catch(() => "");



    throw new Error(
      `Ollama error ${res.status}: ${text}`
    );

  }



  const data =
    await res.json();



  return data?.message?.content ?? "";

}