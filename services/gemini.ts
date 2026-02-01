import { ChatState, AIPlanOutput } from "../types";

function cleanRepetitiveLoops(text: string): string {
  if (!text || typeof text !== 'string') return text;
  return text.replace(/\*\*/g, '').trim();
}

function safeJsonParse(str: string) {
  try {
    let cleaned = str.trim();
    if (cleaned.startsWith('```json')) cleaned = cleaned.replace(/^```json/, '').replace(/```$/, '');
    else if (cleaned.startsWith('```')) cleaned = cleaned.replace(/^```/, '').replace(/```$/, '');
    return JSON.parse(cleaned);
  } catch (e) {
    console.error("JSON Parse Error:", e);
    throw new Error("Failed to parse AI response. Please try again.");
  }
}

export async function generateSmartBuddyPlan(state: ChatState): Promise<AIPlanOutput> {
  const { branch, details, answers } = state;

  let routineConstraints = "";
  if (answers.wakeUp || answers.schoolHours) {
     routineConstraints = `
     USER'S CURRENT ROUTINE CONSTRAINTS:
     - Wake Up: ${answers.wakeUp || 'N/A'}
     - Bedtime: ${answers.bedTime || 'N/A'}
     - School: ${answers.schoolHours || 'N/A'}
     - Lunch: ${answers.lunchTime || 'N/A'}
     - Afternoon: ${answers.napRoutine || answers.afterSchool || 'N/A'}
     - Tuition: ${answers.tuitionTime || 'N/A'}
     - Evening: ${answers.eveningActivity || 'N/A'}
     - Dinner: ${answers.dinnerTime || 'N/A'}
     `;
  }

  const prompt = `
    Generate a professional plan for ${details.name} (Age: ${details.age}, Grade: ${details.grade}).
    Branch: ${branch}
    Goals: ${JSON.stringify(state.answers)}
    ${routineConstraints}
    
    RETURN ONLY RAW JSON.
    Structure:
    {
      "title": "Plan Title",
      "summary": "Short summary.",
      "sections": [
        { "heading": "Section Name", "type": "text", "content": "Text content..." },
        { "heading": "List Name", "type": "list", "content": ["Item 1", "Item 2"] },
        { "heading": "Table Name", "type": "table", "content": [{"Col1": "Val1", "Col2": "Val2"}, {"Col1": "Val3", "Col2": "Val4"}] }
      ]
    }

    REQUIRED SECTIONS FOR ${branch}:
    ${branch === 'PRE_DAILY_ROUTINE' ? `
    1. Student profile & objective
    2. Age-based routine framework
    3. Daily flow
    4. Time-block routine (morning to bedtime) (type: table)
    5. Sleep & hygiene
    6. Active play
    7. Screen time control
    8. Behaviour support
    9. Weekly planner (type: table)
    10. Parent checklist` : ''}

    ${branch === 'PRE_NUTRITION' ? `
    1. Nutrition objective
    2. Nutrition framework
    3. Meal timing structure (type: table)
    4. Balanced plate
    5. Hydration
    6. Immunity habits
    7. Screen-time eating impact
    8. Picky eating strategies
    9. Weekly food planner (type: table)
    10. Parent checklist` : ''}

    ${branch === 'SCHOOL_WELLNESS' ? `
    1. Wellness profile
    2. Mind focus
    3. Confidence
    4. Stress insight
    5. Mental blocks
    6. Mind-training
    7. Focus activities
    8. Confidence exercises
    9. Stress-relief
    10. Positive mindset
    11. Habits
    12. Screen balance
    13. Weekly wellness planner (type: table)
    14. Reflection
    15. Consistency` : ''}

    ${branch === 'SCHOOL_STUDY' ? `
    1. Profile overview
    2. Study goal
    3. Subject focus
    4. Priorities
    5. Time allocation
    6. Hour-wise structure (type: table)
    7. Subject distribution
    8. Time per subject
    9. Best study times
    10. Morning/evening mapping
    11. Daily study routine (type: table)
    12. Study flow
    13. Weekly timetable (type: table)
    14. Planning
    15. Methods
    16. Techniques
    17. Break tips
    18. Recovery
    19. Habits
    20. Screen control
    21. Motivation
    22. Exam readiness
    23. Guidance
    24. Execution` : ''}

    ${branch === 'SCHOOL_DIET' ? `
    1. Diet goal
    2. Body requirements
    3. Calorie guidance
    4. Water intake
    5. Food planning
    6. Daily meal structure (type: table)
    7. Meal suggestions (type: table)
    8. Energy foods
    9. Healthy snacks
    10. Immunity foods
    11. Eating routine
    12. Avoid list
    13. Lifestyle tips
    14. Guidance
    15. Safety note` : ''}
  `;

  const config = {
    temperature: 0.3,
    responseMimeType: "application/json"
  };

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 90000);

    const response = await fetch('/api/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt, config }),
      signal: controller.signal
    });
    
    clearTimeout(timeoutId);

    if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || "Generation failed");
    }

    const data = await response.json();
    const parsed = safeJsonParse(data.text);
    return parsed;

  } catch (error: any) {
    if (error?.name === 'AbortError') throw new Error("Request timed out.");
    throw error;
  }
}