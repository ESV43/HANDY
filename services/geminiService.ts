import { GoogleGenAI, Type } from "@google/genai";
import { OutputFileFormat, PdfContent } from "../types";

const API_KEY = process.env.API_KEY;

if (!API_KEY) {
  throw new Error("API_KEY environment variable not set");
}

const ai = new GoogleGenAI({ apiKey: API_KEY });

const getTexPrompt = () => `
    You are an expert academic assistant and tutor specializing in converting handwritten notes into beautifully formatted, comprehensive LaTeX documents. I will provide you with a series of images, each representing a page of handwritten notes. These notes might be lecture slides, homework assignments, or study guides.

    Your task is to transform these notes into a complete, 'study-ready' document. This involves:
    1. **Accurate Transcription**: Transcribe the text accurately, correcting any spelling or grammatical errors.
    2. **Intelligent Structuring**: Structure the content using appropriate LaTeX commands. Identify headings (\\section{}, \\subsection{}), lists (\\begin{itemize}, \\begin{enumerate}), and mathematical equations (using $...$ for inline and \\[...\\] or \\begin{equation} for display).
    3. **Content Enhancement & Elaboration**: This is crucial. If the notes seem sparse or are just outlines (like lecture slides), you must flesh them out. Add detailed explanations, clarifying examples, and logical derivations for formulas or concepts. Your goal is to make the topic perfectly understandable for someone studying from this document.
    4. **Problem Solving**: If the notes contain questions, exercises, or assignments, you must solve them completely and present the solutions clearly within the document. Show your work and explain the steps taken.
    5. **Diagram Recreation**: If you encounter any diagrams, flowcharts, or figures, recreate them using the TikZ package. Ensure the TikZ code is clean, well-structured, and accurately represents the visual information.
    6. **Produce a single, complete, and valid LaTeX document** that is ready to be compiled. The document should start with \\documentclass{article} and include necessary packages like amsmath, geometry, and tikz. Enclose the entire document within \\begin{document} and \\end{document}.

    Do NOT include any explanatory text or markdown formatting like \`\`\`latex. Your entire output should be ONLY the raw LaTeX code. The final document should be a polished, comprehensive, and educational resource.
`;

const getPdfPrompt = () => `
    You are an expert academic assistant and tutor specializing in converting handwritten notes into structured, comprehensive digital content. I will provide you with a series of images, each representing a page of handwritten notes. These notes might be lecture slides, homework assignments, or study guides.

    Your task is to transform these notes into a 'study-ready' document by following these steps:
    1. **Analyze and Transcribe**: Analyze the text and structure across all pages. Transcribe the text accurately, correcting spelling and grammar.
    2. **Content Enhancement & Elaboration**: This is the most important step. You must enhance the notes by adding detail, providing in-depth explanations, and clarifying concepts to make them comprehensive. If you see formulas, include their derivations. The goal is to create a document that is perfect for studying.
    3. **Problem Solving**: If the notes contain questions, exercises, or an assignment, you must solve them completely. The answers and explanations should be integrated into the document content.
    4. **Title Creation**: Come up with a suitable title for the notes.
    5. **Diagrams**: If you encounter any diagrams, flowcharts, or figures, you must provide TWO things for it:
        a) A detailed textual description of the diagram. This goes into the 'text' field.
        b) A clean, valid, self-contained SVG string that visually represents the diagram. This goes into the 'svg' field.
    6. **Structure and Format**: Structure the entire enhanced content into a logical sequence of elements (headings, paragraphs, lists) and return it as a single JSON object conforming to the provided schema.

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
                        description: "Type of content block. Can be 'heading1', 'heading2', 'paragraph', 'bullet_list', or 'diagram'." 
                    },
                    text: { 
                        type: Type.STRING, 
                        description: "The text content for a heading, paragraph, or a diagram's textual description." 
                    },
                    items: {
                        type: Type.ARRAY,
                        description: "An array of strings for list items. Only used if type is 'bullet_list'.",
                        items: {
                            type: Type.STRING,
                        }
                    },
                    svg: {
                        type: Type.STRING,
                        description: "A self-contained SVG string representing the diagram. Only used if type is 'diagram'."
                    }
                },
                required: ["type", "text"]
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
        config: {
            thinkingConfig: { thinkingBudget: 0 },
            ...(format === 'pdf' ? {
                responseMimeType: 'application/json',
                responseSchema: pdfResponseSchema,
            } : {}),
        }
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