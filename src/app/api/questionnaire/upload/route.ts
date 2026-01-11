import { NextResponse } from "next/server";
import { put } from "@vercel/blob";
import { nanoid } from "nanoid";

const ALLOWED_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
];

const MAX_SIZE = 10 * 1024 * 1024; // 10MB

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const projectId = formData.get("projectId") as string | null;
    const questionId = formData.get("questionId") as string | null;

    if (!file || !projectId || !questionId) {
      return NextResponse.json(
        { error: "file, projectId, and questionId are required" },
        { status: 400 }
      );
    }

    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json(
        { error: "Invalid file type. Allowed types: images, PDF, Word documents" },
        { status: 400 }
      );
    }

    if (file.size > MAX_SIZE) {
      return NextResponse.json(
        { error: "File too large. Maximum size is 10MB" },
        { status: 400 }
      );
    }

    const ext = file.name.split(".").pop() || "bin";
    const filename = `questionnaire/${projectId}/${questionId}/${nanoid()}.${ext}`;

    const blob = await put(filename, file, {
      access: "public",
      addRandomSuffix: false,
    });

    return NextResponse.json({
      filePath: blob.url,
      filename: blob.pathname,
      size: file.size,
      type: file.type,
    });
  } catch (error) {
    console.error("Failed to upload questionnaire file:", error);
    return NextResponse.json({ error: "Failed to upload file" }, { status: 500 });
  }
}
