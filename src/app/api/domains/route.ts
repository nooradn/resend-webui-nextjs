import { NextResponse } from "next/server";
import { Resend } from "resend";

export async function POST(request: Request) {
  let body: { apiKey?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const apiKey = body.apiKey?.trim();
  if (!apiKey) {
    return NextResponse.json(
      { error: "RESEND_API_KEY is required" },
      { status: 400 },
    );
  }

  const resend = new Resend(apiKey);

  const { data, error } = await resend.domains.list();

  if (error) {
    return NextResponse.json(
      { error: error.message, code: error.name },
      { status: 400 },
    );
  }

  const domains = (data?.data ?? []).map((domain) => ({
    name: domain.name,
    status: domain.status,
    region: domain.region,
  }));

  return NextResponse.json({ domains });
}
