import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { supabaseStorage } from "@/lib/supabase";
import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  HeadingLevel,
  AlignmentType,
} from "docx";

interface PromptResult {
  prompt: string;
  response: string;
}

const DEFAULT_FONT = "Calibri";
const DEFAULT_SIZE = 22; // 11pt

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { title, results, generationId } = (await request.json()) as {
      title: string;
      results: PromptResult[];
      generationId?: string;
    };

    if (!results || results.length === 0) {
      return NextResponse.json(
        { error: "No results to export" },
        { status: 400 }
      );
    }

    const docTitle = title || "Generated Document";

    const children: Paragraph[] = [];

    // Title
    children.push(
      new Paragraph({
        children: [
          new TextRun({
            text: docTitle,
            bold: true,
            size: 48,
            font: DEFAULT_FONT,
          }),
        ],
        alignment: AlignmentType.CENTER,
        spacing: { before: 600, after: 400 },
      })
    );

    // Append each response directly — no prompt headings
    for (let i = 0; i < results.length; i++) {
      const result = results[i];
      const responseParagraphs = parseResponseContent(result.response);
      children.push(...responseParagraphs);

      // Small gap between sections
      if (i < results.length - 1) {
        children.push(
          new Paragraph({ children: [new TextRun("")], spacing: { after: 200 } })
        );
      }
    }

    const doc = new Document({
      styles: {
        default: {
          document: {
            run: { font: DEFAULT_FONT, size: DEFAULT_SIZE },
          },
        },
      },
      numbering: {
        config: [
          {
            reference: "default-numbering",
            levels: [
              {
                level: 0,
                format: "decimal",
                text: "%1.",
                alignment: AlignmentType.START,
              },
            ],
          },
        ],
      },
      sections: [{ children }],
    });

    const buffer = await Packer.toBuffer(doc);
    const uint8 = new Uint8Array(buffer);
    const safeFilename = sanitizeFilename(docTitle);

    // Save to Supabase Storage + DB if we have a generation ID
    if (generationId && session.user.id) {
      const storagePath = `${session.user.id}/${Date.now()}_${safeFilename}.docx`;
      await supabaseStorage.storage
        .from("exports")
        .upload(storagePath, uint8, {
          contentType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        });

      await prisma.exportedDocument.create({
        data: {
          user_id: session.user.id,
          generation_id: generationId,
          format: "docx",
          storage_path: storagePath,
          filename: `${safeFilename}.docx`,
          file_size: uint8.length,
        },
      });
    }

    return new NextResponse(uint8, {
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "Content-Disposition": `attachment; filename="${safeFilename}.docx"`,
      },
    });
  } catch (err) {
    console.error("[export-docx] Error generating document:", err);
    return NextResponse.json(
      { error: "Failed to generate document" },
      { status: 500 }
    );
  }
}

function sanitizeFilename(name: string): string {
  return name.replace(/[^a-zA-Z0-9\s\-_]/g, "").trim() || "document";
}

/**
 * Parse the response content into Word Paragraph objects.
 * Uses document-level defaults for font/size — only overrides when needed.
 */
function parseResponseContent(text: string): Paragraph[] {
  const paragraphs: Paragraph[] = [];
  const lines = text.split("\n");

  for (const line of lines) {
    const trimmed = line.trim();

    // Empty line → add a blank paragraph for spacing
    if (!trimmed) {
      paragraphs.push(new Paragraph({ children: [new TextRun("")], spacing: { after: 80 } }));
      continue;
    }

    // <heading>text</heading>
    const headingMatch = trimmed.match(/^<heading>(.*?)<\/heading>$/);
    if (headingMatch) {
      paragraphs.push(
        new Paragraph({
          children: [new TextRun({ text: headingMatch[1].trim(), bold: true, size: 28 })],
          heading: HeadingLevel.HEADING_2,
          spacing: { before: 240, after: 120 },
        })
      );
      continue;
    }

    // <subheading>text</subheading>
    const subMatch = trimmed.match(/^<subheading>(.*?)<\/subheading>$/);
    if (subMatch) {
      paragraphs.push(
        new Paragraph({
          children: [new TextRun({ text: subMatch[1].trim(), bold: true, size: 24 })],
          heading: HeadingLevel.HEADING_3,
          spacing: { before: 200, after: 100 },
        })
      );
      continue;
    }

    // Numbered list: 1. Item text
    const numMatch = trimmed.match(/^(\d+)[.)]\s+(.+)/);
    if (numMatch) {
      paragraphs.push(
        new Paragraph({
          children: parseInlineBold(numMatch[2]),
          numbering: { reference: "default-numbering", level: 0 },
          spacing: { after: 80 },
        })
      );
      continue;
    }

    // Bullet list: - Item text or • Item text
    const bulletMatch = trimmed.match(/^[-•*]\s+(.+)/);
    if (bulletMatch) {
      paragraphs.push(
        new Paragraph({
          children: parseInlineBold(bulletMatch[1]),
          bullet: { level: 0 },
          spacing: { after: 80 },
        })
      );
      continue;
    }

    // Markdown headings fallback
    const mdHeadingMatch = trimmed.match(/^(#{1,3})\s+(.+)/);
    if (mdHeadingMatch) {
      const level = mdHeadingMatch[1].length;
      const headingLevel =
        level === 1 ? HeadingLevel.HEADING_2
          : level === 2 ? HeadingLevel.HEADING_3
            : HeadingLevel.HEADING_4;
      paragraphs.push(
        new Paragraph({
          children: [new TextRun({ text: mdHeadingMatch[2], bold: true, size: level === 1 ? 28 : level === 2 ? 24 : 22 })],
          heading: headingLevel,
          spacing: { before: 200, after: 100 },
        })
      );
      continue;
    }

    // Regular text — each line is its own paragraph (preserves line breaks)
    paragraphs.push(
      new Paragraph({
        children: parseInlineBold(trimmed),
        spacing: { after: 80 },
      })
    );
  }

  return paragraphs;
}

/**
 * Parse inline <bold>text</bold> and **text** within a string.
 * Only sets bold when needed — font/size inherited from document defaults.
 */
function parseInlineBold(text: string): TextRun[] {
  const runs: TextRun[] = [];
  const parts = text.split(/(<bold>[\s\S]*?<\/bold>|\*\*[\s\S]*?\*\*)/g);

  for (const part of parts) {
    if (!part) continue;

    const xmlBoldMatch = part.match(/^<bold>([\s\S]*?)<\/bold>$/);
    if (xmlBoldMatch) {
      runs.push(new TextRun({ text: xmlBoldMatch[1], bold: true }));
      continue;
    }

    const mdBoldMatch = part.match(/^\*\*([\s\S]*?)\*\*$/);
    if (mdBoldMatch) {
      runs.push(new TextRun({ text: mdBoldMatch[1], bold: true }));
      continue;
    }

    runs.push(new TextRun(part));
  }

  if (runs.length === 0) {
    runs.push(new TextRun(text));
  }

  return runs;
}
