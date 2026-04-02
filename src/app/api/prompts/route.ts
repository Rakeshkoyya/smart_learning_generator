import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const prompts = await prisma.prompt.findMany({
    where: {
      OR: [
        { user_id: session.user.id },
        { is_default: true },
      ],
    },
    include: { response_format: true },
    orderBy: [{ is_default: "desc" }, { created_at: "asc" }],
  });

  return NextResponse.json({ prompts });
}

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { name, text, folder_id, response_format_id } = await request.json();
  if (!name || !text) {
    return NextResponse.json({ error: "name and text are required" }, { status: 400 });
  }

  const prompt = await prisma.prompt.create({
    data: {
      user_id: session.user.id,
      name,
      text,
      folder_id: folder_id || null,
      response_format_id: response_format_id || null,
      is_default: false,
    },
    include: { response_format: true },
  });

  return NextResponse.json({ prompt });
}

export async function PATCH(request: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id, name, text, folder_id, response_format_id } = await request.json();
  if (!id) {
    return NextResponse.json({ error: "id is required" }, { status: 400 });
  }

  const updateData: Record<string, unknown> = {};
  if (name !== undefined) updateData.name = name;
  if (text !== undefined) updateData.text = text;
  if (folder_id !== undefined) updateData.folder_id = folder_id || null;
  if (response_format_id !== undefined)
    updateData.response_format_id = response_format_id || null;

  await prisma.prompt.updateMany({
    where: { id, user_id: session.user.id },
    data: updateData,
  });

  const updated = await prisma.prompt.findUnique({
    where: { id },
    include: { response_format: true },
  });

  return NextResponse.json({ prompt: updated });
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

  // Prevent deleting default prompts
  const prompt = await prisma.prompt.findUnique({
    where: { id },
    select: { is_default: true },
  });

  if (prompt?.is_default) {
    return NextResponse.json({ error: "Cannot delete default prompts" }, { status: 400 });
  }

  await prisma.prompt.deleteMany({
    where: { id, user_id: session.user.id },
  });

  return NextResponse.json({ success: true });
}
