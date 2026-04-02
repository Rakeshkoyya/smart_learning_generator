import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient({
  datasourceUrl: process.env.DIRECT_URL,
});

async function main() {
  console.log("🌱 Seeding database...");

  // --- Admin user (password: Admin@123) ---
  const admin = await prisma.user.upsert({
    where: { email: "admin" },
    update: {},
    create: {
      email: "admin",
      name: "Administrator",
      role: "admin",
      is_approved: true,
      auth_provider: "credentials",
      password_hash:
        "$2b$10$zK7gvKDxbH5QYDY/8LeajOcjBalWT1CxC1c3hb5ItsF4E1H/ST9bq",
    },
  });
  console.log(`  ✓ Admin user: ${admin.email} (${admin.id})`);

  // --- Default prompt folder ---
  let defaultFolder = await prisma.promptFolder.findFirst({
    where: { is_default: true },
  });
  if (!defaultFolder) {
    defaultFolder = await prisma.promptFolder.create({
      data: {
        user_id: null,
        name: "Default",
        is_default: true,
      },
    });
    console.log(`  ✓ Default folder created`);
  } else {
    console.log(`  - Default folder already exists`);
  }

  // --- Default response formats ---
  const defaultFormats = [
    {
      name: "Structured XML",
      description:
        "Headings, subheadings, bold, bullet/numbered lists wrapped in XML tags",
      template_text: `Format your response using these rules:
1. Wrap your entire response in <response></response> tags.
2. Use <heading>Text</heading> for main headings.
3. Use <subheading>Text</subheading> for sub headings.
4. Use <bold>text</bold> for emphasis.
5. Use "- Item" for bullet lists.
6. Use "1. Item" for numbered lists.
7. Plain text paragraphs separated by blank lines.
Do NOT use markdown.`,
    },
    {
      name: "Plain Bullets",
      description: "Simple bullet-point output",
      template_text: `Format your response as a clean bullet-point list:
1. Wrap your entire response in <response></response> tags.
2. Use "- " prefix for every point.
3. Group related points under a label line ending with a colon.
4. No markdown, no HTML except the response tags.`,
    },
    {
      name: "Numbered List",
      description: "Sequentially numbered items",
      template_text: `Format your response as a numbered list:
1. Wrap your entire response in <response></response> tags.
2. Number every item sequentially: 1. 2. 3. etc.
3. Group items under topic labels using <heading>Topic</heading>.
4. No markdown.`,
    },
    {
      name: "Table Format",
      description: "Pipe-delimited table rows",
      template_text: `Format your response as a table:
1. Wrap your entire response in <response></response> tags.
2. Use pipe-delimited rows: | Column1 | Column2 | Column3 |
3. First row is the header. Second row is separator: | --- | --- | --- |
4. Use <heading>Section</heading> above each table if multiple tables.
5. No markdown.`,
    },
    {
      name: "Q&A Format",
      description: "Question and Answer pairs",
      template_text: `Format your response as Q&A pairs:
1. Wrap your entire response in <response></response> tags.
2. Each question: <bold>Q: question text</bold>
3. Each answer on the next line: A: answer text
4. Leave a blank line between Q&A pairs.
5. Group under <heading>Topic</heading> headings.
6. No markdown.`,
    },
  ];

  const formatMap: Record<string, string> = {};
  for (const format of defaultFormats) {
    const existing = await prisma.responseFormat.findFirst({
      where: { name: format.name, is_default: true },
    });
    if (!existing) {
      const created = await prisma.responseFormat.create({
        data: {
          user_id: null,
          name: format.name,
          description: format.description,
          template_text: format.template_text,
          is_default: true,
        },
      });
      formatMap[format.name] = created.id;
      console.log(`  ✓ Format: ${format.name}`);
    } else {
      formatMap[format.name] = existing.id;
      console.log(`  - Format already exists: ${format.name}`);
    }
  }

  // --- Default prompts (now with folder and paired format) ---
  const defaultPrompts = [
    {
      name: "One-Liner Questions",
      text: "Create many, many questions of one line from this Chapter, PDF. One-liner questions, so cover all the concepts and topics and subtopics of this chapter. All the questions, those are possible from this chapter, those answers can be given in one word or one line. You should write down, cover every concept, every topic, and every subtopic, everything from the whole chapter, read it deeply and make as many as questions possible from this Chapter. Write in the end some HOT and Long Questions also List of topics and subtopics to be covered, mapping of all the concepts of the chapter. write in a very compact way, every topic and subtopics in one line with arrow like a flow chart what students will learn in this in this chapter.",
      pairedFormat: "Structured XML",
    },
    {
      name: "Hindi-English Glossary",
      text: "Now Make a long simple list with compact formating print friendly saving space & very compact info, on sheet of all the words of this chapter, these words in Simple English and also in Hindi in one line both, so that students understand these words, terms, concepts, deeply and clearly. For the Students of Hindi Speaking background..format is fine, make a list of words, under topics and subtopics of the chapter, don't left any hard word undefined.",
      pairedFormat: "Plain Bullets",
    },
    {
      name: "Visual Concept Maps (English)",
      text: "Now Create visual maps not image based on arrow concepts maps of the all topics and subtopics including all paragraphs of all topics and subtopics, all concepts must be covered, full of emojis and pics and make it easy for students to retain, arrow concept maps of all paragraphs under topics and subtopics with lots of emojis to make visual notes of the chapter for better memory retain and understanding write more and more in one line only, do minimum line breaks, as minimum as possible.",
      pairedFormat: "Structured XML",
    },
    {
      name: "Bilingual Emoji Concept Map",
      text: "bilingual English + Hindi emoji concept map version.",
      pairedFormat: null,
    },
    {
      name: "Facts & Data List",
      text: "All Facts, Important data, make a long list under topics and subtopics, Name of concept, place, Person, some date, important event and some ranking, where, what, which position, rankings, personality, invention all different kind of all possible facts of the chapter under all topics and subtopics. Make a simple print friendly list with emojis. Lots of facts in form of a simple list.",
      pairedFormat: "Plain Bullets",
    },
    {
      name: "Real-World Projects & Problems",
      text: "Now Create many many real life Project and real life Problems to solve students so that they can develop problem solving skills, so that they can deeply develop different types of thinkings. Many many small or big problems based on all the subtopics and topics and every concept they have learned so far. I want to connect learning to real life and develop thinking skills and other 21st century skills. Create problems under topics and subtopics but also write which skill will develop or targeted skill for the problem children are solving, for all thinking types: Critical Thinking, Analytical Thinking, Creative Thinking, Divergent Thinking, Convergent Thinking, Logical Thinking, Concrete Thinking, Abstract Thinking, Reflective Thinking, Systems Thinking, Intuitive Thinking, Deductive Thinking, Inductive Thinking, Lateral Thinking, Emotional Thinking.",
      pairedFormat: "Numbered List",
    },
    {
      name: "Life-Changing Concepts",
      text: "NOW MAP THE big concepts which we want that student must carry in their hearts and brains after doing this chapter. Concepts which can bring Behavioural change. Life Changing concepts, concepts that can change attitude of the child. Major Concepts they must develop after doing this chapter so that I can do the Assessment based on Life transformation of the child after learning all the above chapter. So make a list of these Life Changing concepts from this chapter affecting behaviour, attitude, life, must become life long learning after this chapter. Map the concepts against skills which can be acquired and life long learning ideas and principals to live now onwards. Make a solid list of these deep life changing concepts for the child assessment.",
      pairedFormat: "Structured XML",
    },
  ];

  for (const prompt of defaultPrompts) {
    const existing = await prisma.prompt.findFirst({
      where: { name: prompt.name, is_default: true },
    });
    if (!existing) {
      await prisma.prompt.create({
        data: {
          user_id: null,
          folder_id: defaultFolder.id,
          name: prompt.name,
          text: prompt.text,
          is_default: true,
          response_format_id: prompt.pairedFormat
            ? formatMap[prompt.pairedFormat] || null
            : null,
        },
      });
      console.log(`  ✓ Prompt: ${prompt.name}`);
    } else {
      // Update existing prompt to link to folder and format
      await prisma.prompt.update({
        where: { id: existing.id },
        data: {
          folder_id: defaultFolder.id,
          response_format_id: prompt.pairedFormat
            ? formatMap[prompt.pairedFormat] || null
            : null,
        },
      });
      console.log(`  - Prompt updated: ${prompt.name}`);
    }
  }

  console.log("\n✅ Seeding complete!");
}

main()
  .catch((e) => {
    console.error("❌ Seed error:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
