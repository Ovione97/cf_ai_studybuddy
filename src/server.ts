import type { Ai } from "@cloudflare/workers-types";

/* ------------------------------------------------------------------ */
/*                              ENV TYPES                             */
/* ------------------------------------------------------------------ */

export interface Env {
    AI: Ai;
    ChatAgent: DurableObjectNamespace;
    ASSETS: Fetcher;
}

/* ------------------------------------------------------------------ */
/*                              WORKER                                 */
/* ------------------------------------------------------------------ */

export default {
    async fetch(request: Request, env: Env): Promise<Response> {
        const url = new URL(request.url);

        // Chat routes
        if (url.pathname.startsWith("/chat/") && ["POST", "GET"].includes(request.method)) {
            const id = url.pathname.split("/").pop()!;
            const stub = env.ChatAgent.get(env.ChatAgent.idFromName(id));
            return stub.fetch(request);
        }

        // Serve static assets safely
        try {
            console.log("📥 Incoming request:", url.pathname);
            let asset = await env.ASSETS.fetch(request);
            console.log("📦 Asset fetch result:", asset.status);

            // Fallback to index.html for / or trailing slashes
            if (asset.status === 404) {
                if (url.pathname === "/" || url.pathname === "" || url.pathname.endsWith("/")) {
                    const indexUrl = new URL("/index.html", request.url);
                    asset = await env.ASSETS.fetch(new Request(indexUrl.toString(), request));
                }
            }

            return asset;
        } catch (err) {
            console.error("Asset fetch error:", err);
            return new Response("⚠️ Internal Error while serving assets", { status: 500 });
        }
    },
};


/* ------------------------------------------------------------------ */
/*                          DURABLE OBJECT                             */
/* ------------------------------------------------------------------ */

export class ChatAgent {
    state: DurableObjectState;
    env: Env;

    constructor(state: DurableObjectState, env: Env) {
        this.state = state;
        this.env = env;
    }

    /* ----------------------------- STORAGE ----------------------------- */

    // Load history from Durable Object storage
    async loadHistory(): Promise<string[]> {
        return (await this.state.storage.get<string[]>("history")) || [];
    }

    // Save updated history
    async saveHistory(history: string[]): Promise<void> {
        await this.state.storage.put("history", history);
    }

    // Clear all stored history
    async clearHistory(): Promise<void> {
        await this.state.storage.delete("history");
    }

    /* ------------------------------ AI LOGIC ---------------------------- */

    // Generate AI response
    async getAIResponse(prompt: string, history: string[]): Promise<string> {
        const conversation = [...history, `User: ${prompt}`].join("\n");

        // System prompt for tone and clarity
        const systemPrompt = `You are "AI Study Buddy", a concise and encouraging AI tutor.
Reply in a natural, friendly tone. Keep answers short (1–2 sentences).`;

        // Call Cloudflare AI
        const result = await this.env.AI.run(
            "@cf/meta/llama-3.3-70b-instruct-fp8-fast",
            {
                messages: [
                    { role: "system", content: systemPrompt },
                    { role: "user", content: conversation },
                ],
                max_tokens: 50,
            }
        );

        // Extract clean text
        if (typeof result === "string") return result.trim();
        if (result && typeof result === "object" && "response" in result)
            return (result as any).response.trim();

        return "Sorry, I couldn’t generate a reply.";
    }

    /* ---------------------------- REQUEST HANDLER ---------------------- */

    async fetch(request: Request): Promise<Response> {
        const url = new URL(request.url);

        // Reset chat history (/reset endpoint)
        if (url.pathname.endsWith("/reset")) {
            await this.clearHistory();
            return new Response("✅ Chat history cleared.", {
                headers: { "content-type": "text/plain" },
            });
        }

        // POST → add new message and get AI reply
        if (request.method === "POST") {
            const body = await request.text();
            const history = await this.loadHistory();
            const reply = await this.getAIResponse(body, history);

            history.push(`User: ${body}`, `AI: ${reply}`);
            await this.saveHistory(history);

            return new Response(reply, {
                headers: { "content-type": "text/plain" },
            });
        }

        // GET → fetch current chat history
        if (request.method === "GET") {
            const history = await this.loadHistory();
            return new Response(history.join("\n"), {
                headers: { "content-type": "text/plain" },
            });
        }

        // Default fallback
        return new Response("ChatAgent ready (send POST data)");
    }
}
