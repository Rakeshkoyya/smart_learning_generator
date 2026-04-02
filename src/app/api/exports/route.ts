import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { supabaseStorage } from "@/lib/supabase";
import { serializeBigInt } from "@/lib/utils";

export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const exports = await prisma.exportedDocument.findMany({
    where: { user_id: session.user.id },
    include: {
      generation: {
        select: {
          id: true,
          title: true,
          status: true,
          created_at: true,
          generation_sources: {
            select: {
              source: {
                select: {
                  dataset: {
                    select: { id: true, name: true },
                  },
                },
              },
            },
            take: 1,
          },
        },
      },
    },
    orderBy: { created_at: "desc" },
  });

  return NextResponse.json({ exports: serializeBigInt(exports) });
}

export async function PATCH(request: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id, filename } = await request.json();
  if (!id || !filename) {
    return NextResponse.json({ error: "id and filename are required" }, { status: 400 });
  }

  const sanitized = filename.replace(/[^a-zA-Z0-9\s\-_.]/g, "").trim();
  if (!sanitized) {
    return NextResponse.json({ error: "Invalid filename" }, { status: 400 });
  }

  await prisma.exportedDocument.updateMany({
    where: { id, user_id: session.user.id },
    data: { filename: sanitized },
  });

  return NextResponse.json({ success: true });
}

export async function DELETE(request: NextRequest) {
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
    select: { storage_path: true },
  });

  if (doc?.storage_path) {
    await supabaseStorage.storage.from("exports").remove([doc.storage_path]);
  }

  await prisma.exportedDocument.deleteMany({
    where: { id, user_id: session.user.id },
  });

  return NextResponse.json({ success: true });
}
