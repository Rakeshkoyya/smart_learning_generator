import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { supabaseStorage } from "@/lib/supabase";

const BASE_SYSTEM_PROMPT = `You are a helpful assistant. You are given the content of one or more documents. Answer the user's prompt based on the provided content. Be thorough and well-structured in your response.`;

const NO_FORMAT_INSTRUCTIONS = `\n\nIMPORTANT: Wrap your entire response in <response></response> XML tags. Structure your content using:
- <heading>Text</heading> for main headings
- <subheading>Text</subheading> for sub headings
- <bold>text</bold> for emphasis
- "- Item" for bullet lists
- "1. Item" for numbered lists
Do NOT use markdown.`;

function extractResponseContent(content: string): string {
  const match = content.match(/<response>([\s\S]*?)<\/response>/);
  if (match) {
    return match[1].trim();
  }
  return content.trim();
}

async function callLLM(
  apiKey: string,
  model: string,
  systemPrompt: string,
  userContent: string | Array<{type: string; text?: string; image_url?: {url: string}}>
) {
  const messages: Array<{role: string; content: string | Array<{type: string; text?: string; image_url?: {url: string}}>}> = [
    { role: "system", content: systemPrompt },
    { role: "user", content: userContent },
  ];

  const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ model, messages }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData?.error?.message || `OpenRouter API error: ${response.status}`);
  }

  const data = await response.json();
  return data.choices?.[0]?.message?.content || "";
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
    const { sourceIds, promptText, formatText, model, title, chainId } = await request.json();

    const selectedModel = model || process.env.OPENROUTER_MODEL;
    if (!selectedModel) {
      return NextResponse.json({ error: "No model specified" }, { status: 400 });
    }

    // Fetch source content — base64 for PDFs/images, text for others
    let contextText = "";
    const mediaParts: Array<{type: string; image_url: {url: string}}> = [];

    if (sourceIds && sourceIds.length > 0) {
      const sources = await prisma.inputSource.findMany({
        where: { id: { in: sourceIds }, user_id: session.user.id },
      });

      for (const source of sources) {
        if ((source.type === "pdf" || source.type === "image") && source.storage_path) {
          // Download file from storage and convert to base64
          const { data: fileData, error: dlError } = await supabaseStorage.storage
            .from("input-files")
            .download(source.storage_path);

          if (dlError || !fileData) {
            console.warn(`[generate] Failed to download ${source.name}:`, dlError?.message);
            // Fallback to extracted text if available
            if (source.extracted_text) {
              contextText += `\n\n--- Source: ${source.name} ---\n\n${source.extracted_text}`;
            }
            continue;
          }

          const buffer = Buffer.from(await fileData.arrayBuffer());
          const base64 = buffer.toString("base64");
          const mimeType = source.type === "pdf"
            ? "application/pdf"
            : ((source.metadata as Record<string, unknown>)?.mimeType as string) || "image/png";
          const dataUri = `data:${mimeType};base64,${base64}`;

          mediaParts.push({ type: "image_url", image_url: { url: dataUri } });
          console.log(`[generate] Attached ${source.type} as base64: ${source.name} (${(buffer.length / 1024).toFixed(0)} KB)`);
        } else if (source.extracted_text) {
          contextText += `\n\n--- Source: ${source.name} ---\n\n${source.extracted_text}`;
        }
      }
    }

    // Chain generation: run multiple prompts in sequence
    if (chainId) {
      const chain = await prisma.promptChain.findFirst({
        where: { id: chainId, user_id: session.user.id },
        include: {
          steps: {
            include: { prompt: true, response_format: true },
            orderBy: { step_order: "asc" },
          },
        },
      });

      if (!chain || chain.steps.length === 0) {
        return NextResponse.json({ error: "Chain not found or empty" }, { status: 404 });
      }

      const generation = await prisma.generation.create({
        data: {
          user_id: session.user.id,
          title: title || chain.name,
          prompt_text: chain.steps.map((s: any) => s.prompt.name).join(" → "),
          model_used: selectedModel,
          status: "processing",
          prompt_chain_id: chainId,
        },
      });

      // Link sources
      if (sourceIds && sourceIds.length > 0) {
        const sources = await prisma.inputSource.findMany({
          where: { id: { in: sourceIds }, user_id: session.user.id },
          select: { id: true },
        });
        if (sources.length > 0) {
          await prisma.generationSource.createMany({
            data: sources.map((s: { id: string }) => ({
              generation_id: generation.id,
              source_id: s.id,
            })),
          });
        }
      }

      try {
        let accumulatedContent = "";

        for (const step of chain.steps) {
          const stepFormatText = step.response_format?.template_text;

          let systemPrompt = BASE_SYSTEM_PROMPT;
          if (stepFormatText) {
            systemPrompt += `\n\nCRITICAL FORMATTING RULES:\n${stepFormatText}`;
          } else {
            systemPrompt += NO_FORMAT_INSTRUCTIONS;
          }

          // Build user message: include source context + previous outputs
          let userText = "";
          if (contextText) {
            userText += `Document content:\n${contextText}\n\n---\n\n`;
          }
          if (accumulatedContent) {
            userText += `Previous generation output:\n${accumulatedContent}\n\n---\n\n`;
          }
          userText += `Prompt: ${step.prompt.text}`;

          let userContent: string | Array<{type: string; text?: string; image_url?: {url: string}}>;
          if (mediaParts.length > 0) {
            const parts: Array<{type: string; text?: string; image_url?: {url: string}}> = [
              { type: "text", text: userText },
              ...mediaParts,
            ];
            userContent = parts;
          } else {
            userContent = userText;
          }

          console.log(`[generate-chain] Step ${step.step_order}: ${step.prompt.name}`);
          const rawContent = await callLLM(apiKey, selectedModel, systemPrompt, userContent);
          const parsed = extractResponseContent(rawContent);
          accumulatedContent += (accumulatedContent ? "\n\n---\n\n" : "") + parsed;
        }

        await prisma.generation.update({
          where: { id: generation.id },
          data: { status: "completed", response_content: accumulatedContent },
        });

        return NextResponse.json({
          content: accumulatedContent,
          generationId: generation.id,
        });
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : "Chain generation failed";
        await prisma.generation.update({
          where: { id: generation.id },
          data: { status: "error", error_message: errorMsg },
        });
        return NextResponse.json({ error: errorMsg }, { status: 500 });
      }
    }

    // Single prompt generation
    if (!promptText) {
      return NextResponse.json({ error: "promptText is required" }, { status: 400 });
    }

    const generation = await prisma.generation.create({
      data: {
        user_id: session.user.id,
        title: title || "Untitled",
        prompt_text: promptText,
        response_format_text: formatText || null,
        model_used: selectedModel,
        status: "processing",
      },
    });

    // Link sources
    if (sourceIds && sourceIds.length > 0) {
      const sources = await prisma.inputSource.findMany({
        where: { id: { in: sourceIds }, user_id: session.user.id },
        select: { id: true },
      });
      if (sources.length > 0) {
        await prisma.generationSource.createMany({
          data: sources.map((s: { id: string }) => ({
            generation_id: generation.id,
            source_id: s.id,
          })),
        });
      }
    }

    // Build system prompt with format instructions
    let systemPrompt = BASE_SYSTEM_PROMPT;
    if (formatText) {
      systemPrompt += `\n\nCRITICAL FORMATTING RULES:\n${formatText}`;
    } else {
      systemPrompt += NO_FORMAT_INSTRUCTIONS;
    }

    // Build user message
    let userContent: string | Array<{type: string; text?: string; image_url?: {url: string}}>;

    if (mediaParts.length > 0) {
      const parts: Array<{type: string; text?: string; image_url?: {url: string}}> = [];
      if (contextText) {
        parts.push({ type: "text", text: `Document content:\n${contextText}\n\n---\n\nPrompt: ${promptText}` });
      } else {
        parts.push({ type: "text", text: `Prompt: ${promptText}` });
      }
      parts.push(...mediaParts);
      userContent = parts;
    } else {
      userContent = contextText
        ? `Document content:\n${contextText}\n\n---\n\nPrompt: ${promptText}`
        : promptText;
    }

    console.log(`[generate] Model: ${selectedModel}, Sources: ${sourceIds?.length || 0}, Media: ${mediaParts.length}`);

    try {
      const rawContent = await callLLM(apiKey, selectedModel, systemPrompt, userContent);
      const parsedContent = extractResponseContent(rawContent);

      await prisma.generation.update({
        where: { id: generation.id },
        data: { status: "completed", response_content: parsedContent },
      });

      return NextResponse.json({
        content: parsedContent,
        generationId: generation.id,
      });
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : "Generation failed";
      await prisma.generation.update({
        where: { id: generation.id },
        data: { status: "error", error_message: errorMsg },
      });
      return NextResponse.json({ error: errorMsg }, { status: 500 });
    }
  } catch {
    return NextResponse.json(
      { error: "Failed to generate content" },
      { status: 500 }
    );
  }
}
