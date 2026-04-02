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

  const datasets = await prisma.dataset.findMany({
    where: { user_id: session.user.id },
    include: {
      input_sources: {
        select: {
          id: true,
          name: true,
          type: true,
          original_filename: true,
          file_size: true,
          metadata: true,
          created_at: true,
        },
        orderBy: { created_at: "desc" },
      },
    },
    orderBy: { created_at: "desc" },
  });

  return NextResponse.json({ datasets: serializeBigInt(datasets) });
}

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { name, description } = await request.json();
    if (!name?.trim()) {
      return NextResponse.json({ error: "Dataset name is required" }, { status: 400 });
    }

    const dataset = await prisma.dataset.create({
      data: {
        user_id: session.user.id,
        name: name.trim(),
        description: description?.trim() || null,
      },
      include: {
        input_sources: {
          select: {
            id: true,
            name: true,
            type: true,
            original_filename: true,
            file_size: true,
            metadata: true,
            created_at: true,
          },
        },
      },
    });

    return NextResponse.json({ dataset: serializeBigInt(dataset) });
  } catch (err) {
    console.error("[datasets] Error:", err);
    return NextResponse.json({ error: "Failed to create dataset" }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { id, name, description } = await request.json();
    if (!id || !name?.trim()) {
      return NextResponse.json({ error: "id and name are required" }, { status: 400 });
    }

    const dataset = await prisma.dataset.updateMany({
      where: { id, user_id: session.user.id },
      data: {
        name: name.trim(),
        description: description?.trim() || null,
      },
    });

    if (dataset.count === 0) {
      return NextResponse.json({ error: "Dataset not found" }, { status: 404 });
    }

    const updated = await prisma.dataset.findFirst({
      where: { id, user_id: session.user.id },
      include: {
        input_sources: {
          select: {
            id: true,
            name: true,
            type: true,
            original_filename: true,
            file_size: true,
            metadata: true,
            created_at: true,
          },
          orderBy: { created_at: "desc" },
        },
      },
    });

    return NextResponse.json({ dataset: serializeBigInt(updated) });
  } catch (err) {
    console.error("[datasets] Error:", err);
    return NextResponse.json({ error: "Failed to update dataset" }, { status: 500 });
  }
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

  // Get all files in the dataset to delete from storage
  const sources = await prisma.inputSource.findMany({
    where: { dataset_id: id, user_id: session.user.id },
    select: { storage_path: true },
  });

  const storagePaths = sources
    .map((s) => s.storage_path)
    .filter((p): p is string => !!p);

  if (storagePaths.length > 0) {
    await supabaseStorage.storage.from("input-files").remove(storagePaths);
  }

  // Delete dataset (cascades to input_sources)
  await prisma.dataset.deleteMany({
    where: { id, user_id: session.user.id },
  });

  return NextResponse.json({ success: true });
}
