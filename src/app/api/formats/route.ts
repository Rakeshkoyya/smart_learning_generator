import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const formats = await prisma.responseFormat.findMany({
    where: {
      OR: [
        { user_id: session.user.id },
        { is_default: true },
      ],
    },
    orderBy: [{ is_default: "desc" }, { created_at: "asc" }],
  });

  return NextResponse.json({ formats });
}

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { name, description, template_text } = await request.json();
  if (!name || !template_text) {
    return NextResponse.json(
      { error: "name and template_text are required" },
      { status: 400 }
    );
  }

  const format = await prisma.responseFormat.create({
    data: {
      user_id: session.user.id,
      name,
      description,
      template_text,
      is_default: false,
    },
  });

  return NextResponse.json({ format });
}

export async function PATCH(request: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id, name, description, template_text } = await request.json();
  if (!id) {
    return NextResponse.json({ error: "id is required" }, { status: 400 });
  }

  await prisma.responseFormat.updateMany({
    where: { id, user_id: session.user.id },
    data: { name, description, template_text },
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

  const format = await prisma.responseFormat.findUnique({
    where: { id },
    select: { is_default: true },
  });

  if (format?.is_default) {
    return NextResponse.json(
      { error: "Cannot delete default formats" },
      { status: 400 }
    );
  }

  await prisma.responseFormat.deleteMany({
    where: { id, user_id: session.user.id },
  });

  return NextResponse.json({ success: true });
}
