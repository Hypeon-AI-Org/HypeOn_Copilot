import { NextResponse } from "next/server";

const GROQ_API_KEY = process.env.GROQ_API_KEY!;
const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";

export async function POST(req: Request) {
  try {
    if (!process.env.GROQ_API_KEY) {
      return NextResponse.json(
        { error: "API configuration error" },
        { status: 500 }
      );
    }

    const { message, model } = await req.json();

    if (!message) {
      return NextResponse.json(
        { error: "Message is required" },
        { status: 400 }
      );
    }

    const systemPrompt = `
You are HypeOn Copilot, an AI for ecommerce product and keyword intelligence.

Your task:
1. Detect the user’s intent automatically.
   - If the user asks about PRODUCTS → return a product table.
   - If the user asks about KEYWORDS → return a keyword table.

You MUST respond ONLY in valid JSON using this structure:

{
  "summary": "4–5 short lines of plain text insight",
  "table": {
    "type": "product_table | keyword_table",
    "columns": [],
    "rows": []
  }
}

==============================
PRODUCT TABLE RULES
==============================
If intent is PRODUCTS:

"type": "product_table"
"columns": [
  "Product Name",
  "Hype Score",
  "Weekly Trend %",
  "Monthly Trend %"
]

Rules:
- Hype Score must be a number from 0 to 100
- Weekly Trend = growth over the last 7 days
- Monthly Trend = growth over the last 30 days
- Data should be realistic for ecommerce
- Return 4–5 rows

==============================
KEYWORD TABLE RULES
==============================
If intent is KEYWORDS:

"type": "keyword_table"
"columns": [
  "Keyword",
  "Search Volume",
  "CPC (USD)"
]

Rules:
- Search Volume is monthly
- CPC must be a realistic USD advertising cost
- Return 4–5 rows

==============================
SUMMARY RULES
==============================
- Summary must be 4–5 short lines
- Plain text only
- No bullet points

==============================
IMPORTANT
==============================
- Output ONLY valid JSON
- No markdown
- No explanations outside JSON
- Do NOT wrap JSON in code blocks

`;

  const res = await fetch(GROQ_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${GROQ_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: model === "pro"
        ? "llama-3.1-70b-versatile"
        : "llama-3.1-8b-instant",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: message },
      ],
      temperature: 0.4,
    }),
  });

    if (!res.ok) {
      const errorData = await res.json().catch(() => ({}));
      return NextResponse.json(
        { error: "API request failed", details: errorData },
        { status: res.status }
      );
    }

    const data = await res.json();
    
    if (!data.choices || !data.choices[0] || !data.choices[0].message) {
      return NextResponse.json(
        { error: "Invalid API response" },
        { status: 500 }
      );
    }

    const content = data.choices[0].message.content;
    const parsedContent = JSON.parse(content);

    return NextResponse.json(parsedContent);
  } catch (error) {
    console.error("Chat API error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
