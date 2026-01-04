import { NextResponse } from "next/server";
import  nodemailer from "nodemailer";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const { name, email, message } = await req.json();

    if (!name || !email || !message) {
      return NextResponse.json(
        { error: "Missing fields" },
        { status: 400 }
      );
    }

    const transporter = nodemailer.createTransport({
      service: "gmail", 
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
    });

    await transporter.sendMail({
      from: `"HypeOn Feedback" <${process.env.EMAIL_USER}>`,
      to: "info@hypeon.ai",
      replyTo: email,
      subject: "New Feedback Submission",
      html: `
        <h2>New Feedback</h2>
        <p><strong>Name:</strong> ${name}</p>
        <p><strong>Email:</strong> ${email}</p>
        <p><strong>Message:</strong></p>
        <p>${message}</p>
      `,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Feedback email error:", error);
    return NextResponse.json(
      { error: "Email failed" },
      { status: 500 }
    );
  }
}
