import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { supabaseStorage } from "@/lib/supabase";

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { title, content, generationId } = await request.json();

    if (!content) {
      return NextResponse.json({ error: "No content to export" }, { status: 400 });
    }

    const docTitle = title || "Generated Document";
    // Strip XML tags for plain text
    const plainText = content
      .replace(/<heading>(.*?)<\/heading>/g, "=== $1 ===\n")
      .replace(/<subheading>(.*?)<\/subheading>/g, "--- $1 ---\n")
      .replace(/<bold>(.*?)<\/bold>/g, "$1")
      .replace(/<response>|<\/response>/g, "");

    const fullText = `${docTitle}\n${"=".repeat(docTitle.length)}\n\n${plainText}`;
    const encoder = new TextEncoder();
    const uint8 = encoder.encode(fullText);
    const safeFilename = docTitle.replace(/[^a-zA-Z0-9\s\-_]/g, "").trim() || "document";

    // Save to storage + DB
    if (generationId) {
      const storagePath = `${session.user.id}/${Date.now()}_${safeFilename}.txt`;
      await supabaseStorage.storage
        .from("exports")
        .upload(storagePath, uint8, { contentType: "text/plain" });

      await prisma.exportedDocument.create({
        data: {
          user_id: session.user.id,
          generation_id: generationId,
          format: "txt",
          storage_path: storagePath,
          filename: `${safeFilename}.txt`,
          file_size: uint8.length,
        },
      });
    }

    return new NextResponse(uint8, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Content-Disposition": `attachment; filename="${safeFilename}.txt"`,
      },
    });
  } catch (err) {
    console.error("[export-txt] Error:", err);
    return NextResponse.json({ error: "Failed to export" }, { status: 500 });
  }
}
