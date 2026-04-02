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
  const limit = parseInt(searchParams.get("limit") || "20");
  const offset = parseInt(searchParams.get("offset") || "0");

  const generations = await prisma.generation.findMany({
    where: { user_id: session.user.id },
    select: {
      id: true,
      title: true,
      model_used: true,
      status: true,
      created_at: true,
      response_content: true,
    },
    orderBy: { created_at: "desc" },
    skip: offset,
    take: limit,
  });

  return NextResponse.json({ generations });
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

  // Delete exported documents from storage first
  const exports = await prisma.exportedDocument.findMany({
    where: { generation_id: id, user_id: session.user.id },
    select: { storage_path: true },
  });

  if (exports.length > 0) {
    const paths = exports.map((e: { storage_path: any; }) => e.storage_path);
    await supabaseStorage.storage.from("exports").remove(paths);
  }

  await prisma.generation.deleteMany({
    where: { id, user_id: session.user.id },
  });

  return NextResponse.json({ success: true });
}
