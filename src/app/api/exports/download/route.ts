import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { supabaseStorage } from "@/lib/supabase";

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  if (!id) {
    return NextResponse.json({ error: "id is required" }, { status: 400 });
  }

  const doc = await prisma.exportedDocument.findFirst({
    where: { id, user_id: session.user.id },
  });

  if (!doc) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const { data, error } = await supabaseStorage.storage
    .from("exports")
    .download(doc.storage_path);

  if (error || !data) {
    return NextResponse.json({ error: "File not found" }, { status: 404 });
  }

  const buffer = new Uint8Array(await data.arrayBuffer());

  const contentType =
    doc.format === "docx"
      ? "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
      : doc.format === "pdf"
      ? "application/pdf"
      : "text/plain; charset=utf-8";

  return new NextResponse(buffer, {
    headers: {
      "Content-Type": contentType,
      "Content-Disposition": `attachment; filename="${doc.filename}"`,
    },
  });
}
