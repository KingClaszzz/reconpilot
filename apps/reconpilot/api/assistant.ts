import { handleAssistant } from "../server/assistant";

// Vercel function: POST /api/assistant
export async function POST(request: Request) {
  return handleAssistant(request, process.env);
}
