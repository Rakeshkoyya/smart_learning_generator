import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { supabaseStorage } from "@/lib/supabase";
import {
  SUMMARY_SYSTEM_PROMPT,
  SUMMARY_USER_PROMPT,
  IMAGE_PROMPT_SYSTEM,
  IMAGE_PROMPT_USER,
  STYLE_PROMPTS,
  DETAIL_PROMPTS,
  DIMENSION_OPTIONS,
  type InfographicStyle,
  type DetailLevel,
} from "@/components/workspace/genie/infographics-config";

const IMAGE_MODEL = "google/gemini-3.1-flash-image-preview";

async function callLLM(
  apiKey: string,
  model: string,
  systemPrompt: string,
  userContent: string
): Promise<string> {
  const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userContent },
      ],
    }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(
      errorData?.error?.message || `OpenRouter API error: ${response.status}`
    );
  }

  const data = await response.json();
  return data.choices?.[0]?.message?.content || "";
}

async function generateImage(
  apiKey: string,
  prompt: string,
  aspectRatio: string
): Promise<string> {
  const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: IMAGE_MODEL,
      messages: [
        {
          role: "user",
          content: prompt,
        },
      ],
      modalities: ["image", "text"],
      image_config: {
        aspect_ratio: aspectRatio,
      },
    }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    console.error("[infographics] Image API error response:", JSON.stringify(errorData, null, 2));
    throw new Error(
      errorData?.error?.message || `Image generation error: ${response.status}`
    );
  }

  const data = await response.json();
  console.log("[infographics] Image API response keys:", JSON.stringify({
    hasChoices: !!data.choices,
    choiceCount: data.choices?.length,
    messageKeys: data.choices?.[0]?.message ? Object.keys(data.choices[0].message) : [],
    hasImages: !!data.choices?.[0]?.message?.images,
    imageCount: data.choices?.[0]?.message?.images?.length,
    contentType: typeof data.choices?.[0]?.message?.content,
  }));

  const message = data.choices?.[0]?.message;
  if (!message) {
    throw new Error("No message in response");
  }

  // OpenRouter returns images in message.images[] array
  if (message.images && Array.isArray(message.images) && message.images.length > 0) {
    for (const image of message.images) {
      if (image.image_url?.url) {
        return image.image_url.url;
      }
      if (image.type === "image_url" && image.image_url?.url) {
        return image.image_url.url;
      }
    }
  }

  // Fallback: check content for multipart array format
  const content = message.content;
  if (Array.isArray(content)) {
    for (const part of content) {
      if (part.type === "image_url" && part.image_url?.url) {
        return part.image_url.url;
      }
    }
  }

  // Fallback: content might be a data URL string
  if (typeof content === "string") {
    if (content.startsWith("data:image")) {
      return content;
    }
  }

  console.error("[infographics] Unexpected response structure:", JSON.stringify(data, null, 2).substring(0, 2000));
  throw new Error("No image found in response. Check server logs for details.");
}

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "OPENROUTER_API_KEY is not configured" },
      { status: 500 }
    );
  }

  try {
    const body = await request.json();
    const {
      sourceIds,
      model,
      dimensionId,
      style,
      detailLevel,
      filename,
    } = body as {
      sourceIds: string[];
      model: string;
      dimensionId: string;
      style: InfographicStyle;
      detailLevel: DetailLevel;
      filename: string;
    };

    // Validate inputs
    if (!sourceIds?.length) {
      return NextResponse.json({ error: "No sources selected" }, { status: 400 });
    }
    if (!model) {
      return NextResponse.json({ error: "No model specified" }, { status: 400 });
    }
    if (!dimensionId || !style || !detailLevel || !filename?.trim()) {
      return NextResponse.json({ error: "Missing required configuration" }, { status: 400 });
    }

    const dimension = DIMENSION_OPTIONS.find((d) => d.id === dimensionId);
    if (!dimension) {
      return NextResponse.json({ error: "Invalid dimension" }, { status: 400 });
    }

    if (!STYLE_PROMPTS[style]) {
      return NextResponse.json({ error: "Invalid style" }, { status: 400 });
    }

    // ── Step 0: Gather source content ──
    const sources = await prisma.inputSource.findMany({
      where: { id: { in: sourceIds }, user_id: session.user.id },
      select: {
        id: true,
        name: true,
        type: true,
        extracted_text: true,
        storage_path: true,
      },
    });

    let sourceText = "";
    for (const source of sources) {
      if (source.extracted_text) {
        sourceText += `\n\n--- Source: ${source.name} ---\n\n${source.extracted_text}`;
      }
    }

    if (!sourceText.trim()) {
      return NextResponse.json(
        { error: "No text content found in selected sources" },
        { status: 400 }
      );
    }

    // Use streaming response to send progress events
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        const send = (event: string, data?: string) => {
          controller.enqueue(encoder.encode(`event:${event}\n`));
          if (data) controller.enqueue(encoder.encode(`data:${data}\n`));
          controller.enqueue(encoder.encode("\n"));
        };

        try {
          // ── Step 1: Generate summary ──
          send("summarizing");

          const summaryUserPrompt = SUMMARY_USER_PROMPT.replace(
            "{SOURCE_TEXT}",
            sourceText
          );

          const summary = await callLLM(
            apiKey,
            model,
            SUMMARY_SYSTEM_PROMPT,
            summaryUserPrompt
          );

          if (!summary.trim()) {
            throw new Error("Failed to generate summary — empty response");
          }

          // ── Step 2: Generate image prompt ──
          send("prompting");

          const imagePromptUser = IMAGE_PROMPT_USER
            .replace("{SUMMARY}", summary)
            .replace("{STYLE_INSTRUCTIONS}", STYLE_PROMPTS[style])
            .replace("{DETAIL_INSTRUCTIONS}", DETAIL_PROMPTS[detailLevel])
            .replace("{WIDTH}", String(dimension.width))
            .replace("{HEIGHT}", String(dimension.height))
            .replace("{RATIO}", dimension.ratio);

          const imagePrompt = await callLLM(
            apiKey,
            model,
            IMAGE_PROMPT_SYSTEM,
            imagePromptUser
          );

          if (!imagePrompt.trim()) {
            throw new Error("Failed to generate image prompt — empty response");
          }

          // ── Step 3: Generate image ──
          send("generating");

          const imageDataUrl = await generateImage(apiKey, imagePrompt, dimension.ratio);

          // ── Step 4: Save image to storage ──
          const safeFilename = filename.trim().replace(/[^a-zA-Z0-9_-]/g, "_");
          const storagePath = `${session.user.id}/genie/infographics/${Date.now()}_${safeFilename}.png`;

          // Convert data URL to buffer for upload
          let uploadBuffer: Buffer;
          let contentType = "image/png";

          if (imageDataUrl.startsWith("data:")) {
            const [header, base64Data] = imageDataUrl.split(",");
            const mimeMatch = header.match(/data:([^;]+)/);
            if (mimeMatch) contentType = mimeMatch[1];
            uploadBuffer = Buffer.from(base64Data, "base64");
          } else {
            // URL — fetch the image
            const imgRes = await fetch(imageDataUrl);
            if (!imgRes.ok) throw new Error("Failed to download generated image");
            const arrayBuf = await imgRes.arrayBuffer();
            uploadBuffer = Buffer.from(arrayBuf);
            contentType = imgRes.headers.get("content-type") || "image/png";
          }

          const { error: uploadError } = await supabaseStorage.storage
            .from("exports")
            .upload(storagePath, uploadBuffer, {
              contentType,
              upsert: false,
            });

          if (uploadError) {
            console.error("[infographics] Storage upload error:", uploadError);
            // Still return the data URL so user can download
          }

          // Create Generation + GenerationSource + ExportedDocument records
          let exportId: string | null = null;
          if (!uploadError) {
            try {
              const generation = await prisma.generation.create({
                data: {
                  user_id: session.user.id,
                  title: `Infographic — ${safeFilename}`,
                  prompt_text: imagePrompt,
                  model_used: IMAGE_MODEL,
                  response_content: summary,
                  status: "completed",
                  generation_sources: {
                    create: sourceIds.map((sid: string) => ({
                      source_id: sid,
                    })),
                  },
                },
              });

              const exportDoc = await prisma.exportedDocument.create({
                data: {
                  user_id: session.user.id,
                  generation_id: generation.id,
                  format: "png",
                  storage_path: storagePath,
                  filename: `${safeFilename}.png`,
                  file_size: uploadBuffer.length,
                },
              });
              exportId = exportDoc.id;
            } catch (dbErr) {
              console.error("[infographics] DB record creation error:", dbErr);
            }
          }

          // Send final result — use data URL for immediate preview
          const result = JSON.stringify({
            imageUrl: imageDataUrl,
            filename: safeFilename,
            summary,
            imagePrompt,
            storagePath: uploadError ? null : storagePath,
            exportId,
          });

          controller.enqueue(encoder.encode(`data:final:${result}\n`));
          controller.close();
        } catch (err) {
          const msg = err instanceof Error ? err.message : "Generation failed";
          const errorResult = JSON.stringify({ error: msg });
          controller.enqueue(encoder.encode(`data:final:${errorResult}\n`));
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  } catch (err) {
    console.error("[infographics] Error:", err);
    return NextResponse.json(
      { error: "Failed to process infographic generation" },
      { status: 500 }
    );
  }
}
