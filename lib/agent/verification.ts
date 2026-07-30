import { exec } from "child_process";
import { promisify } from "util";


const execAsync = promisify(exec);


export interface VerificationResult {

  success: boolean;

  command: string;

  output: string;

  error?: string;

}



export async function runVerification(signal?: AbortSignal): Promise<
  VerificationResult[]
> {

  const commands = [
    "npx tsc --noEmit",
    "npm test -- --runInBand",
    "npm run lint",
  ];


  const results: VerificationResult[] = [];


  for (const command of commands) {

    if (signal?.aborted) {

      results.push({

        success: false,

        command,

        output: "Verification cancelled",

        error: "Verification cancelled",

      });

      break;

    }

    try {

      const { stdout, stderr } =
        await execAsync(command, { signal });


      results.push({

        success: true,

        command,

        output:
          stdout || stderr,

      });


    } catch (error) {

      results.push({

        success: false,

        command,

        output:
          error instanceof Error
            ? error.message
            : String(error),

        error:
          error instanceof Error
            ? error.message
            : String(error),

      });

    }

  }


  return results;

}