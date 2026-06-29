import { NextRequest, NextResponse } from 'next/server';
import {
  GoogleGenAI,
  FunctionCallingConfigMode,
  Type,
  type Content,
  type FunctionDeclaration,
} from '@google/genai';

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000';

const SYSTEM_INSTRUCTION = `You are BTS Assistant, an AI helper built into a Service Booking Management System (BTS — Booking Tracking System).

You assist operational staff with:
- Looking up booking status, counts, and details
- Finding agent workloads and performance
- Understanding dashboard metrics
- Checking attendance
- Navigating the application

System facts:
- Booking statuses: Pending, In Progress, Completed, Ignored
- Booking priorities: Low, Medium, High, Urgent
- DA numbers are tracking/delivery-advice numbers assigned when bookings are completed
- "At risk" bookings are those exceeding SLA targets
- Agents handle bookings as primary or support agents

Navigation guide (sidebar links):
- Dashboard: /dashboard — overview stats and charts
- All Bookings: /dashboard/all-bookings — full booking list with filters
- My Bookings: /dashboard/my-bookings — your own assigned bookings
- Agents: /dashboard/agents — agent list and workload
- Attendance: /dashboard/attendance — daily attendance tracking
- Allocations: /dashboard/allocations — allocation logs
- Reports: /dashboard/reports — analytics and trends

When answering: be concise and direct, use bullet points for lists, always use tools to fetch real data rather than guessing.`;

const functionDeclarations: FunctionDeclaration[] = [
  {
    name: 'fetch_dashboard_stats',
    description: "Get today's booking statistics: total, pending, in_progress, completed, ignored, da_numbers_count, at_risk.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        date: {
          type: Type.STRING,
          description: 'Date in YYYY-MM-DD format. Omit for today.',
        },
      },
    },
  },
  {
    name: 'fetch_bookings',
    description: 'Fetch a filtered list of bookings. Returns subject, status, priority, agent name, sender email, received date.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        status: { type: Type.STRING, description: 'Filter: Pending | In Progress | Completed | Ignored' },
        priority: { type: Type.STRING, description: 'Filter: Low | Medium | High | Urgent' },
        search: { type: Type.STRING, description: 'Search term matched against subject or sender email' },
        page_size: { type: Type.NUMBER, description: 'Number of results (default 10, max 25)' },
      },
    },
  },
  {
    name: 'fetch_agents',
    description: 'Get all agents with name, email, role, shift, and active status.',
    parameters: {
      type: Type.OBJECT,
      properties: {},
    },
  },
];

async function runTool(name: string, args: Record<string, unknown>, token: string): Promise<Record<string, unknown>> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  };

  try {
    if (name === 'fetch_dashboard_stats') {
      const date = args.date as string | undefined;
      const tz = 'Asia/Kolkata';
      const url = date
        ? `${API_BASE}/dashboard/stats?date=${encodeURIComponent(date)}&tz=${encodeURIComponent(tz)}`
        : `${API_BASE}/dashboard/stats?tz=${encodeURIComponent(tz)}`;
      const res = await fetch(url, { headers });
      if (!res.ok) return { error: `API returned ${res.status}` };
      return await res.json();
    }

    if (name === 'fetch_bookings') {
      const params = new URLSearchParams();
      if (args.status) params.set('status', args.status as string);
      if (args.priority) params.set('priority', args.priority as string);
      if (args.search) params.set('search', args.search as string);
      params.set('page_size', String(Math.min(Number(args.page_size ?? 10), 25)));
      const res = await fetch(`${API_BASE}/bookings?${params}`, { headers });
      if (!res.ok) return { error: `API returned ${res.status}` };
      const data = await res.json();
      const items: Record<string, unknown>[] = Array.isArray(data) ? data : (data.items ?? []);
      return {
        total: Array.isArray(data) ? items.length : (data.total ?? items.length),
        items: items.map((b) => ({
          id: b.id,
          subject: b.subject,
          status: b.status,
          priority: b.priority,
          agent: (b.agent as Record<string, unknown> | null)?.name ?? 'Unassigned',
          sender_email: b.sender_email,
          received_at: b.received_at,
          da_number: b.da_number,
        })),
      };
    }

    if (name === 'fetch_agents') {
      const res = await fetch(`${API_BASE}/agents`, { headers });
      if (!res.ok) return { error: `API returned ${res.status}` };
      return { agents: await res.json() };
    }

    return { error: `Unknown tool: ${name}` };
  } catch (err) {
    return { error: String(err) };
  }
}

export async function POST(req: NextRequest) {
  if (!process.env.GEMINI_API_KEY) {
    return NextResponse.json(
      { error: 'AI service is not configured. Add GEMINI_API_KEY to your environment.' },
      { status: 503 }
    );
  }

  let body: {
    messages: { role: 'user' | 'assistant'; content: string }[];
    accessToken: string;
    userContext?: { name: string; role: string };
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 });
  }

  const { messages, accessToken, userContext } = body;
  if (!accessToken) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
  }

  const systemInstruction = userContext
    ? `${SYSTEM_INSTRUCTION}\n\nLogged-in user: ${userContext.name} (role: ${userContext.role})`
    : SYSTEM_INSTRUCTION;

  try {
    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

    const config = {
      systemInstruction,
      tools: [{ functionDeclarations }],
      toolConfig: { functionCallingConfig: { mode: FunctionCallingConfigMode.AUTO } },
    };

    // Build mutable contents array in Gemini format
    const contents: Content[] = messages.map((m) => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }],
    }));

    const callGemini = () =>
      ai.models.generateContent({ model: 'gemini-2.0-flash-lite', contents, config });

    const MAX_ITERS = 5;

    for (let i = 0; i < MAX_ITERS; i++) {
      // Auto-retry once on 429 after the suggested delay (capped at 35s)
      let response = await callGemini().catch(async (err: Error) => {
        if (!err.message.includes('429')) throw err;
        const match = err.message.match(/"retryDelay"\s*:\s*"(\d+)s"/);
        const delaySec = Math.min(parseInt(match?.[1] ?? '30', 10), 35);
        await new Promise((r) => setTimeout(r, delaySec * 1000));
        return callGemini();
      });

      const fnCalls = response!.functionCalls;

      if (!fnCalls || fnCalls.length === 0) {
        return NextResponse.json({ content: response!.text ?? 'No response generated.' });
      }

      // Append model's turn (with function call parts) to history
      const modelParts = response!.candidates?.[0]?.content?.parts ?? [];
      contents.push({ role: 'model', parts: modelParts });

      // Execute all function calls in parallel, append results
      const fnResponseParts = await Promise.all(
        fnCalls.map(async (fc) => {
          const result = await runTool(fc.name ?? '', fc.args ?? {}, accessToken);
          return {
            functionResponse: {
              id: fc.id,
              name: fc.name ?? '',
              response: result,
            },
          };
        })
      );
      contents.push({ role: 'user', parts: fnResponseParts });
    }

    return NextResponse.json({ content: 'I needed too many steps to answer. Please try a more specific question.' });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[AI chat]', message);
    // Return a user-friendly message for quota/rate-limit errors
    if (message.includes('429') || message.includes('RESOURCE_EXHAUSTED') || message.includes('quota')) {
      return NextResponse.json(
        { content: "I'm temporarily rate-limited by the AI service. Please wait a moment and try again." },
        { status: 200 }
      );
    }
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
