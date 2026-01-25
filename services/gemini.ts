import { ChatState, AIPlanOutput } from '../types';

export const generateSmartBuddyPlan = async (state: ChatState): Promise<AIPlanOutput> => {
  const { details, answers, branch } = state;

  // This strict instruction ensures the AI doesn't just print raw text for tables
  const systemInstruction = `
    You are an expert Student Success & Wellness Coach. 
    Create a highly professional, detailed roadmap.

    IMPORTANT RULES FOR OUTPUT:
    1. Return valid JSON only.
    2. For any section that contains a schedule, timetable, or comparison, you MUST use the following JSON Table Structure:
       "content": {
         "headers": ["Column 1", "Column 2"],
         "rows": [
           ["Row 1 Val 1", "Row 1 Val 2"],
           ["Row 2 Val 1", "Row 2 Val 2"]
         ]
       }
    3. For lists, use an array of strings: "content": ["Item 1", "Item 2"]
    4. For regular text, use a simple string.
  `;

  const userPrompt = `
    Generate a ${branch} for a student with these details:
    - Name: ${details.name}
    - Class: ${details.grade}
    - Age: ${details.age}
    - School: ${details.school}

    Specific Context: ${JSON.stringify(answers)}

    The plan must include exactly 6-8 sections with headings and content.
  `;

  try {
    const response = await fetch('/api/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        prompt: systemInstruction + userPrompt,
        config: {
          response_mime_type: "application/json",
          // This schema ensures the top-level structure is always correct
          response_schema: {
            type: "object",
            properties: {
              sections: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    heading: { type: "string" },
                    content: { type: "any" } 
                  }
                }
              }
            }
          }
        }
      })
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Failed to generate plan');
    }

    const data = await response.json();
    // Parse the stringified text returned by the backend server.js
    return JSON.parse(data.text);
  } catch (error) {
    console.error("Gemini Service Error:", error);
    throw error;
  }
};
