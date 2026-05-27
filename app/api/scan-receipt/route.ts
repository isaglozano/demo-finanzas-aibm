import { GoogleGenAI } from "@google/genai";
import { NextRequest, NextResponse } from "next/server";

const CATEGORIES = [
  "Food",
  "Transport",
  "Shopping",
  "Bills",
  "Entertainment",
  "Other",
] as const;

const receiptSchema = {
  type: "object",
  properties: {
    description: {
      type: "string",
      description:
        "Brief expense description, typically the merchant name or main purchase items",
    },
    amount: {
      type: "number",
      description:
        "Total amount paid on the receipt as a number (no currency symbol)",
    },
    category: {
      type: "string",
      enum: [...CATEGORIES],
      description: "Best matching expense category",
    },
    date: {
      type: "string",
      description:
        "Date of purchase in YYYY-MM-DD format. Use today's date if not visible.",
    },
    merchant: {
      type: "string",
      description: "Store or merchant name if visible on the receipt",
    },
  },
  required: ["description", "amount", "category", "date"],
};

const ALLOWED_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
]);

export async function POST(request: NextRequest) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "Gemini API key not configured" },
      { status: 500 },
    );
  }

  const formData = await request.formData();
  const file = formData.get("receipt");

  if (!(file instanceof File)) {
    return NextResponse.json(
      { error: "No receipt image provided" },
      { status: 400 },
    );
  }

  if (!ALLOWED_TYPES.has(file.type)) {
    return NextResponse.json(
      { error: "Unsupported image format. Use JPEG, PNG, or WebP." },
      { status: 400 },
    );
  }

  if (file.size > 10 * 1024 * 1024) {
    return NextResponse.json(
      { error: "Image too large (max 10 MB)" },
      { status: 400 },
    );
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const base64 = buffer.toString("base64");

  const ai = new GoogleGenAI({ apiKey });

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: [
        {
          inlineData: {
            mimeType: file.type,
            data: base64,
          },
        },
        {
          text: `Analyze this receipt image and extract the expense information.

Categorize the expense into exactly one of these categories:
- Food: restaurants, groceries, cafés, food delivery
- Transport: gas, parking, transit, rideshare, tolls
- Shopping: retail, clothing, electronics, general merchandise
- Bills: utilities, subscriptions, insurance, rent, services
- Entertainment: movies, concerts, games, hobbies, streaming
- Other: anything that doesn't fit the above

Extract the total amount paid (not subtotals). Use USD unless another currency is clearly shown on the receipt.`,
        },
      ],
      config: {
        responseMimeType: "application/json",
        responseSchema: receiptSchema,
      },
    });

    const text = response.text;
    if (!text) {
      return NextResponse.json(
        { error: "Could not read receipt. Try a clearer photo." },
        { status: 422 },
      );
    }

    const parsed = JSON.parse(text) as {
      description: string;
      amount: number;
      category: (typeof CATEGORIES)[number];
      date: string;
      merchant?: string;
    };

    if (
      !parsed.description ||
      typeof parsed.amount !== "number" ||
      parsed.amount <= 0 ||
      !CATEGORIES.includes(parsed.category)
    ) {
      return NextResponse.json(
        { error: "Could not extract valid expense data from receipt." },
        { status: 422 },
      );
    }

    return NextResponse.json(parsed);
  } catch (error) {
    console.error("Receipt scan error:", error);
    return NextResponse.json(
      { error: "Failed to analyze receipt. Please try again or add manually." },
      { status: 500 },
    );
  }
}
