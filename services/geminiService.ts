import { GoogleGenAI, Type } from "@google/genai";
import { OutputFileFormat, PdfContent } from "../types";

const API_KEY = process.env.API_KEY;

if (!API_KEY) {
  throw new Error("API_KEY environment variable not set");
}

const ai = new GoogleGenAI({ apiKey: API_KEY });

const getTexPrompt = () => `
    You are an expert academic assistant specializing in converting handwritten notes into beautifully formatted LaTeX documents. I will provide you with a series of images, each representing a page of handwritten notes.

    Your task is to:
    1. Analyze the text and structure of the handwritten notes across all provided pages.
    2. Transcribe the text accurately, correcting any spelling or grammatical errors.
    3. Intelligently structure the content using appropriate LaTeX commands. This includes identifying headings (\\section{}, \\subsection{}), lists (\\begin{itemize}, \\begin{enumerate}), mathematical equations (using $...$ for inline and \\[...\\] or \\begin{equation} for display), and paragraphs.
    4. Enhance the notes by adding detail, clarifying concepts, and ensuring a logical flow. The final output should be a comprehensive and polished version of the original notes.
    5. Produce a single, complete, and valid LaTeX document that is ready to be compiled. The document should start with \\documentclass{article} and include necessary packages like amsmath, and geometry. Enclose the entire document within \\begin{document} and \\end{document}.

    Do NOT include any explanatory text or markdown formatting like \`\`\`latex. Your entire output should be ONLY the raw LaTeX code.
`;

const getPdfPrompt = () => `
    You are an expert academic assistant specializing in converting handwritten notes into structured digital content. I will provide you with a series of images, each representing a page of handwritten notes.

    Your task is to:
    1. Analyze the text and structure of the handwritten notes across all provided pages.
    2. Transcribe the text accurately, correcting any spelling or grammatical errors.
    3. Enhance the notes by adding detail and clarifying concepts to make them more comprehensive.
    4. Come up with a suitable title for the notes.
    5. Structure the entire content into a logical sequence of elements: main title, headings (level 1 and 2), paragraphs, and bulleted lists.
    6. Return the final, enhanced content as a single JSON object conforming to the provided schema.

    Do not include any explanatory text or markdown formatting. Your entire output must be only the raw JSON string.
`;


const pdfResponseSchema = {
    type: Type.OBJECT,
    properties: {
        title: { 
            type: Type.STRING,
            description: "A concise and relevant title for the document."
        },
        content: {
            type: Type.ARRAY,
            description: "An array of content blocks that make up the document.",
            items: {
                type: Type.OBJECT,
                properties: {
                    type: { 
                        type: Type.STRING, 
                        description: "Type of content block. Can be 'heading1', 'heading2', 'paragraph', or 'bullet_list'." 
                    },
                    text: { 
                        type: Type.STRING, 
                        description: "The text content for a heading or paragraph." 
                    },
                    items: {
                        type: Type.ARRAY,
                        description: "An array of strings for list items. Only used if type is 'bullet_list'.",
                        items: {
                            type: Type.STRING,
                        }
                    }
                },
                required: ["type"]
            }
        }
    },
    required: ["title", "content"]
};


export const processHandwrittenNotes = async (
    base64Images: string[],
    format: OutputFileFormat
): Promise<string | PdfContent> => {

    const imageParts = base64Images.map(img => ({
        inlineData: {
            mimeType: 'image/jpeg',
            data: img
        }
    }));

    const prompt = format === 'tex' ? getTexPrompt() : getPdfPrompt();

    const contents = {
        parts: [{ text: prompt }, ...imageParts],
    };

    const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents,
        config: format === 'pdf' ? {
            responseMimeType: 'application/json',
            responseSchema: pdfResponseSchema,
        } : {},
    });

    const responseText = response.text.trim();

    if (format === 'pdf') {
        try {
            return JSON.parse(responseText) as PdfContent;
        } catch (e) {
            console.error("Failed to parse JSON response:", responseText);
            throw new Error("AI returned invalid JSON format.");
        }
    } else {
        return responseText;
    }
};
