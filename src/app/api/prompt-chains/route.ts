import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const chains = await prisma.promptChain.findMany({
    where: { user_id: session.user.id },
    include: {
      steps: {
        include: {
          prompt: true,
          response_format: true,
        },
        orderBy: { step_order: "asc" },
      },
    },
    orderBy: { created_at: "desc" },
  });

  return NextResponse.json({ chains });
}

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { name, description, steps } = await request.json();
  if (!name?.trim()) {
    return NextResponse.json({ error: "name is required" }, { status: 400 });
  }
  if (!steps || !Array.isArray(steps) || steps.length === 0) {
    return NextResponse.json(
      { error: "At least one step is required" },
      { status: 400 }
    );
  }

  const chain = await prisma.promptChain.create({
    data: {
      user_id: session.user.id,
      name: name.trim(),
      description: description || null,
      steps: {
        create: steps.map(
          (
            s: {
              prompt_id: string;
              response_format_id?: string;
            },
            i: number
          ) => ({
            prompt_id: s.prompt_id,
            step_order: i + 1,
            response_format_id: s.response_format_id || null,
          })
        ),
      },
    },
    include: {
      steps: {
        include: { prompt: true, response_format: true },
        orderBy: { step_order: "asc" },
      },
    },
  });

  return NextResponse.json({ chain });
}

export async function PATCH(request: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id, name, description, steps } = await request.json();
  if (!id) {
    return NextResponse.json({ error: "id is required" }, { status: 400 });
  }

  // Verify ownership
  const existing = await prisma.promptChain.findFirst({
    where: { id, user_id: session.user.id },
  });
  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Update chain and replace steps
  await prisma.$transaction(async (tx: any) => {
    await tx.promptChain.update({
      where: { id },
      data: {
        name: name?.trim() || existing.name,
        description: description !== undefined ? description : existing.description,
      },
    });

    if (steps && Array.isArray(steps)) {
      // Remove old steps
      await tx.promptChainStep.deleteMany({ where: { chain_id: id } });
      // Create new steps
      await tx.promptChainStep.createMany({
        data: steps.map(
          (
            s: { prompt_id: string; response_format_id?: string },
            i: number
          ) => ({
            chain_id: id,
            prompt_id: s.prompt_id,
            step_order: i + 1,
            response_format_id: s.response_format_id || null,
          })
        ),
      });
    }
  });

  const updated = await prisma.promptChain.findUnique({
    where: { id },
    include: {
      steps: {
        include: { prompt: true, response_format: true },
        orderBy: { step_order: "asc" },
      },
    },
  });

  return NextResponse.json({ chain: updated });
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

  await prisma.promptChain.deleteMany({
    where: { id, user_id: session.user.id },
  });

  return NextResponse.json({ success: true });
}
