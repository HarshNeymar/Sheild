export type ChatStep = 
  | 'GREETING' 
  | 'PRE_SCHOOL_CHECK'
  | 'MAIN_CHOICE'
  | 'COLLECTING_DETAILS'
  | 'COLLECTING_ROUTINE'
  | 'BRANCH_QUESTIONS'
  | 'GENERATING'
  | 'COMPLETED';

export type UserBranch = 
  | 'PRE_DAILY_ROUTINE' 
  | 'PRE_NUTRITION' 
  | 'SCHOOL_STUDY' 
  | 'SCHOOL_DIET' 
  | 'SCHOOL_WELLNESS';

export interface ChatMessage {
  id: string;
  sender: 'bot' | 'user';
  text: string;
  options?: string[];
  type?: 'text' | 'choice' | 'details' | 'routine' | 'download';
}

export interface ChatState {
  step: ChatStep;
  branch?: UserBranch;
  details: {
    name: string;
    age: string;
    grade: string;
    school: string;
    height?: string;
    weight?: string;
    goal?: string;
  };
  answers: Record<string, any>;
  currentQuestionIndex: number;
}

export interface AIPlanOutput {
  title: string;
  sections: {
    heading: string;
    content: string | string[] | Record<string, any>[];
    type: 'text' | 'list' | 'table';
  }[];
  verdict?: string;
  summary?: string;
}

export interface UserProfile {
  name: string;
  age: string;
  className: string;
  schoolId: string;
  phone: string;
  password?: string;
  routine?: Record<string, any>;
}
