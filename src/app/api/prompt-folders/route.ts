import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const folders = await prisma.promptFolder.findMany({
    where: {
      OR: [{ user_id: session.user.id }, { is_default: true }],
    },
    include: {
      prompts: {
        where: {
          OR: [{ user_id: session.user.id }, { is_default: true }],
        },
        include: { response_format: true },
        orderBy: { created_at: "asc" },
      },
    },
    orderBy: [{ is_default: "desc" }, { created_at: "asc" }],
  });

  return NextResponse.json({ folders });
}

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { name } = await request.json();
  if (!name?.trim()) {
    return NextResponse.json({ error: "name is required" }, { status: 400 });
  }

  const folder = await prisma.promptFolder.create({
    data: {
      user_id: session.user.id,
      name: name.trim(),
      is_default: false,
    },
  });

  return NextResponse.json({ folder: { ...folder, prompts: [] } });
}

export async function PATCH(request: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id, name } = await request.json();
  if (!id || !name?.trim()) {
    return NextResponse.json(
      { error: "id and name are required" },
      { status: 400 }
    );
  }

  await prisma.promptFolder.updateMany({
    where: { id, user_id: session.user.id },
    data: { name: name.trim() },
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

  const folder = await prisma.promptFolder.findUnique({
    where: { id },
    select: { is_default: true },
  });

  if (folder?.is_default) {
    return NextResponse.json(
      { error: "Cannot delete the default folder" },
      { status: 400 }
    );
  }

  await prisma.promptFolder.deleteMany({
    where: { id, user_id: session.user.id },
  });

  return NextResponse.json({ success: true });
}
