import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const users = await prisma.user.findMany({
    select: {
      id: true,
      email: true,
      name: true,
      avatar_url: true,
      role: true,
      is_approved: true,
      auth_provider: true,
      created_at: true,
    },
    orderBy: { created_at: "desc" },
  });

  return NextResponse.json({ users });
}

export async function PATCH(request: NextRequest) {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { userId, is_approved } = await request.json();

  if (!userId || typeof is_approved !== "boolean") {
    return NextResponse.json({ error: "userId and is_approved are required" }, { status: 400 });
  }

  // Prevent admin from changing their own approval
  if (userId === session.user.id) {
    return NextResponse.json({ error: "Cannot modify your own approval" }, { status: 400 });
  }

  await prisma.user.update({
    where: { id: userId },
    data: { is_approved },
  });

  return NextResponse.json({ success: true });
}
