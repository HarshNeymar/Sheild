import { ChatState, AIPlanOutput } from "../types";

// Helper function definitions remain the same
function cleanRepetitiveLoops(text: string): string {
  if (!text || typeof text !== 'string') return text;
  const words = text.split(/\s+/);
  if (words.length < 10) return text;
  const cleaned: string[] = [];
  for (let i = 0; i < words.length; i++) {
    if (i > 2 && words[i] === words[i-1] && words[i] === words[i-2]) continue; 
    cleaned.push(words[i]);
  }
  let result = cleaned.join(' ');
  const segments = result.split('/');
  if (segments.length > 5) {
    const seen = new Set();
    const uniqueSegments = segments.filter(s => {
      const trimmed = s.trim().toLowerCase();
      if (seen.has(trimmed)) return false;
      seen.add(trimmed);
      return true;
    });
    result = uniqueSegments.join(' / ');
  }
  if (result.length > 500) result = result.substring(0, 497) + "...";
  return result;
}

function safeJsonParse(str: string) {
  try {
    return JSON.parse(str);
  } catch (e) {
    let fixed = str.trim();
    if (fixed.endsWith(',')) fixed = fixed.slice(0, -1);
    const stack: string[] = [];
    let inString = false;
    let escaped = false;
    for (let i = 0; i < fixed.length; i++) {
        const char = fixed[i];
        if (escaped) { escaped = false; continue; }
        if (char === '\\') { escaped = true; continue; }
        if (char === '"') { inString = !inString; continue; }
        if (!inString) {
            if (char === '{') stack.push('}');
            else if (char === '[') stack.push(']');
            else if (char === '}' || char === ']') stack.pop();
        }
    }
    if (inString) fixed += '"';
    while (stack.length > 0) { fixed += stack.pop(); }
    try {
        return JSON.parse(fixed);
    } catch (e2) {
        throw e;
    }
  }
}

export async function generateSmartBuddyPlan(state: ChatState): Promise<AIPlanOutput> {
  const { branch, details, answers } = state;

  let routineConstraints = "";
  
  if (answers.wakeUp || answers.schoolHours) {
     routineConstraints = `
     USER'S CURRENT ROUTINE CONSTRAINTS (MUST BE STRICTLY FOLLOWED):
     - Wake Up: ${answers.wakeUp || 'N/A'}
     - Bedtime: ${answers.bedTime || 'N/A'}
     - School Hours: ${answers.schoolHours || 'N/A'}
     - Lunch: ${answers.lunchTime || 'N/A'}
     - Afternoon (Nap/Rest/Play): ${answers.napRoutine || answers.afterSchool || 'N/A'}
     - Tuition: ${answers.tuitionTime || 'N/A'}
     - Evening Activity: ${answers.eveningActivity || 'N/A'}
     - Dinner: ${answers.dinnerTime || 'N/A'}
     
     Ensure the Time-Block Routine or Schedule in the output EXACTLY aligns with these times.
     Do not schedule activities during School Hours or Tuition times.
     `;
  }

  const prompt = `
    As "Smart Buddy", generate a comprehensive, professional plan for ${details.name}.
    Branch: ${branch}
    Goals: ${JSON.stringify(state.answers)}
    ${routineConstraints}
    
    CRITICAL INSTRUCTIONS:
    1. Do NOT repeat words or phrases.
    2. Do NOT use markdown bolding (like **text**) in the JSON content.
    3. Keep descriptions concise and high-value.
    
    STRICTLY FOLLOW THE HEADERS LISTED BELOW FOR THE ${branch} CATEGORY. 
    DO NOT ADD ANY HEADERS OUTSIDE OF THIS LIST.

    ${branch === 'PRE_DAILY_ROUTINE' ? `
    REQUIRED HEADERS:
    1. Student profile & routine objective
    2. Age-based routine framework
    3. Home-school balanced daily flow
    4. Time-block routine (morning to bedtime)
    5. Sleep, hygiene & meal habits
    6. Active play, focus & daily activities
    7. Screen time control & replacement activities
    8. Behaviour & emotional regulation support
    9. Weekly planner
    10. Parent checklist & Smart Buddy branding` : ''}

    ${branch === 'PRE_NUTRITION' ? `
    REQUIRED HEADERS:
    1. Child profile & nutrition objective
    2. Age-based nutrition framework
    3. Daily meal & snack timing structure
    4. Balanced plate guidance
    5. Hydration & water intake habits
    6. Immunity-supporting daily habits
    7. Screen-time impact on eating behaviour
    8. Picky eating & meal discipline strategies
    9. Weekly food habit planner
    10. Parent checklist & Smart Buddy branding` : ''}

    ${branch === 'SCHOOL_WELLNESS' ? `
    REQUIRED HEADERS:
    1. Student wellness profile
    2. Mind focus assessment
    3. Confidence overview
    4. Stress insight
    5. Mental blocks identified
    6. Mind-training routine
    7. Focus-building activities
    8. Confidence-boosting exercises
    9. Stress-relief practices
    10. Positive mindset guidance
    11. Healthy daily habits
    12. Screen time balance
    13. Weekly wellness planner
    14. Self-reflection tips
    15. Guidance for consistency
    16. Safety note` : ''}

    ${branch === 'SCHOOL_STUDY' ? `
    REQUIRED HEADERS:
    1. Student profile overview
    2. Study goal
    3. Subject-wise focus
    4. Priority subjects
    5. Daily study time allocation
    6. Hour-wise study structure
    7. Subject distribution
    8. Time per subject
    9. Best study times
    10. Morning/evening mapping
    11. Daily study routine
    12. Study flow
    13. Weekly study timetable
    14. Day-wise planning
    15. Study methods
    16. Effective study techniques
    17. Break tips
    18. Focus recovery
    19. Study habits
    20. Screen control
    21. Motivation support
    22. Exam readiness
    23. Parent/self guidance
    24. Execution tips` : ''}

    ${branch === 'SCHOOL_DIET' ? `
    REQUIRED HEADERS:
    1. Student profile overview
    2. Selected diet goal
    3. Body requirement overview
    4. Daily calorie intake guidance
    5. Water intake recommendation
    6. Food preference-based planning
    7. Daily meal structure
    8. Sample Indian meal suggestions
    9. Study-time energy foods
    10. Healthy snack alternatives
    11. Immunity-supporting food habits
    12. Eating routine and timing tips
    13. Foods to limit or avoid
    14. Simple lifestyle improvement tips
    15. Parent / self guidance
    16. Safety and usage note` : ''}

    Use "table" type for schedules. Use "list" type for tips. Use "text" for summaries.
  `;

  // Define schema using raw strings instead of SDK Enum to keep frontend lightweight
  const config = {
    temperature: 0.2,
    systemInstruction: `You are Smart Buddy. Return ONLY valid JSON. 
    NO MARKDOWN FORMATTING IN VALUES (no **bold**). 
    NO REPETITIVE LOOPS.
    Schema: title, summary, sections (heading, type, content).`,
    responseMimeType: "application/json",
    responseSchema: {
      type: "OBJECT",
      properties: {
        title: { type: "STRING" },
        sections: {
          type: "ARRAY",
          items: {
            type: "OBJECT",
            properties: {
              heading: { type: "STRING" },
              type: { type: "STRING", enum: ['text', 'list', 'table'] },
              content: { type: "STRING", description: "JSON stringified content" }
            },
            required: ["heading", "type", "content"]
          }
        },
        summary: { type: "STRING" }
      },
      required: ["title", "sections", "summary"]
    }
  };

  try {
    // Call the Secure Backend
    const response = await fetch('/api/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt, config })
    });

    if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || "Generation failed");
    }

    const data = await response.json();
    if (!data.text) throw new Error("Empty response from AI");

    const parsed = safeJsonParse(data.text.trim());
    
    // Post-processing cleaning
    if (parsed.title) parsed.title = cleanRepetitiveLoops(parsed.title);
    if (parsed.summary) parsed.summary = cleanRepetitiveLoops(parsed.summary);
    
    if (parsed.sections) {
      parsed.sections = parsed.sections.map((s: any) => {
          let content = s.content;
          if (typeof content === 'string') {
              try { 
                if (content.trim().startsWith('[') || content.trim().startsWith('{')) {
                  content = JSON.parse(content); 
                }
              } catch (e) {}
          }
          
          if (Array.isArray(content)) {
              content = content.map(item => {
                  if (typeof item === 'string') return cleanRepetitiveLoops(item);
                  if (typeof item === 'object' && item !== null) {
                      const newObj: any = {};
                      for (const k in item) newObj[k] = cleanRepetitiveLoops(String(item[k]));
                      return newObj;
                  }
                  return item;
              });
          } else if (typeof content === 'string') {
              content = cleanRepetitiveLoops(content);
          }
          
          s.content = content;
          return s;
      });
    }

    return parsed;

  } catch (error: any) {
    console.error("GenAI Error:", error);
    if (error?.message?.includes('Quota') || error?.message?.includes('429')) {
        throw new Error("Server is busy (Quota Limit). Please try again in a minute.");
    }
    throw new Error(error.message || "Plan generation failed. Please try again.");
  }
}