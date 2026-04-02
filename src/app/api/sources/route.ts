import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { supabaseStorage } from "@/lib/supabase";
import { serializeBigInt } from "@/lib/utils";
import { extractText, getDocumentProxy } from "unpdf";
import ExcelJS from "exceljs";
import Papa from "papaparse";

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const textContent = formData.get("text") as string | null;
    const sourceName = formData.get("name") as string | null;
    const datasetId = formData.get("datasetId") as string | null;

    // Handle raw text input
    if (textContent) {
      const source = await prisma.inputSource.create({
        data: {
          user_id: session.user.id,
          dataset_id: datasetId || null,
          name: sourceName || "Text Input",
          type: "text",
          extracted_text: textContent,
          file_size: new TextEncoder().encode(textContent).length,
        },
      });

      return NextResponse.json({ source: serializeBigInt(source) });
    }

    // Handle file upload
    if (!file) {
      return NextResponse.json({ error: "No file or text provided" }, { status: 400 });
    }

    const originalBuffer = new Uint8Array(await file.arrayBuffer());
    // Create a copy for upload — processing (unpdf/exceljs) can detach the original ArrayBuffer
    const uploadBuffer = new Uint8Array(originalBuffer);
    const buffer = originalBuffer;
    const ext = file.name.split(".").pop()?.toLowerCase() || "";

    let type: string;
    let extractedText: string | null = null;

    // Determine file type and extract text
    if (file.type === "application/pdf" || ext === "pdf") {
      type = "pdf";
      const pdf = await getDocumentProxy(buffer);
      const result = await extractText(pdf, { mergePages: true });
      extractedText = result.text;
    } else if (
      file.type.startsWith("image/") ||
      ["png", "jpg", "jpeg", "gif", "webp"].includes(ext)
    ) {
      type = "image";
      extractedText = null;
    } else if (
      ext === "xlsx" || ext === "xls" ||
      file.type === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" ||
      file.type === "application/vnd.ms-excel"
    ) {
      type = "excel";
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.load(buffer.buffer as ArrayBuffer);
      const textParts: string[] = [];
      workbook.eachSheet((sheet) => {
        textParts.push(`## Sheet: ${sheet.name}`);
        sheet.eachRow((row) => {
          const values = (row.values as (string | number | null)[])
            .slice(1)
            .map((v) => (v != null ? String(v) : ""));
          textParts.push(values.join("\t"));
        });
        textParts.push("");
      });
      extractedText = textParts.join("\n");
    } else if (ext === "csv" || file.type === "text/csv") {
      type = "csv";
      const csvText = new TextDecoder().decode(buffer);
      const parsed = Papa.parse(csvText, { header: false });
      const rows = parsed.data as string[][];
      extractedText = rows.map((row) => row.join("\t")).join("\n");
    } else if (
      ["txt", "md", "json", "xml", "html", "htm", "rtf", "log"].includes(ext) ||
      file.type.startsWith("text/")
    ) {
      type = "text";
      extractedText = new TextDecoder().decode(buffer);
    } else if (
      ["doc", "docx", "ppt", "pptx", "odt", "ods", "odp"].includes(ext)
    ) {
      type = "document";
      extractedText = null; // These need specialized parsers; stored as-is
    } else {
      // Accept any other file type — store without extraction
      type = "other";
      extractedText = null;
    }

    // Upload file to Supabase Storage
    const storagePath = `${session.user.id}/${Date.now()}_${file.name}`;
    const { error: uploadError } = await supabaseStorage.storage
      .from("input-files")
      .upload(storagePath, uploadBuffer, {
        contentType: file.type,
        upsert: false,
      });

    if (uploadError) {
      console.error("[sources] Storage upload error:", uploadError);
      return NextResponse.json(
        { error: "Failed to upload file to storage" },
        { status: 500 }
      );
    }

    // Insert record via Prisma
    const source = await prisma.inputSource.create({
      data: {
        user_id: session.user.id,
        dataset_id: datasetId || null,
        name: sourceName || file.name,
        type,
        original_filename: file.name,
        storage_path: storagePath,
        extracted_text: extractedText,
        file_size: file.size,
        metadata: {
          mimeType: file.type,
          ...(type === "pdf" ? { pageCount: extractedText ? extractedText.split("\f").length : 0 } : {}),
        },
      },
    });

    return NextResponse.json({ source: serializeBigInt(source) });
  } catch (err) {
    console.error("[sources] Error:", err);
    return NextResponse.json(
      { error: "Failed to process source" },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const datasetId = searchParams.get("datasetId");

  const where: Record<string, unknown> = { user_id: session.user.id };
  if (datasetId) {
    where.dataset_id = datasetId;
  }

  const sources = await prisma.inputSource.findMany({
    where,
    select: {
      id: true,
      name: true,
      type: true,
      original_filename: true,
      file_size: true,
      metadata: true,
      dataset_id: true,
      created_at: true,
    },
    orderBy: { created_at: "desc" },
  });

  return NextResponse.json({ sources: serializeBigInt(sources) });
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

  // Get source to find storage path
  const source = await prisma.inputSource.findFirst({
    where: { id, user_id: session.user.id },
    select: { storage_path: true },
  });

  // Delete from storage if applicable
  if (source?.storage_path) {
    await supabaseStorage.storage.from("input-files").remove([source.storage_path]);
  }

  // Delete from DB
  await prisma.inputSource.deleteMany({
    where: { id, user_id: session.user.id },
  });

  return NextResponse.json({ success: true });
}
