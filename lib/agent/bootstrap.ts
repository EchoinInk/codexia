import { registerTools } from "@/lib/tools/register";

let started = false;

export function bootstrapAgent() {
  if (started) {
    return;
  }

  registerTools();

  started = true;
}
