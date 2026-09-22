import { NextResponse } from "next/server";
import { Resend } from "resend";

export async function POST(request: Request) {
  let body: Record<string, string>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { from, to, subject, content, apiKey } = body;

  if (!apiKey) {
    return NextResponse.json(
      { error: "RESEND_API_KEY is required" },
      { status: 400 },
    );
  }

  if (!from || !to || !subject || !content) {
    return NextResponse.json({ error: "All fields are required" }, { status: 400 });
  }

  const resend = new Resend(apiKey);

  const { data, error } = await resend.emails.send({
    from,
    to: [to],
    subject,
    html: content,
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ id: data?.id });
}
