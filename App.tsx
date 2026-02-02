import React, { useState, useEffect, useRef } from 'react';
import { ChatStep, UserBranch, ChatMessage, ChatState, AIPlanOutput, UserProfile } from './types';
import { generateSmartBuddyPlan } from './services/gemini';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

// --- Constants ---

const CLASSES = [
  'Playgroup', 'Nursery', 'LKG', 'UKG',
  'Std 1', 'Std 2', 'Std 3', 'Std 4', 'Std 5', 'Std 6',
  'Std 7', 'Std 8', 'Std 9', 'Std 10', 'Std 11', 'Std 12'
];

const PRE_SCHOOL_CLASSES = ['Playgroup', 'Nursery', 'LKG', 'UKG'];

const generateTimeOptions = () => {
  const times: string[] = [];
  const addTime = (h: number, m: string, p: string) => times.push(`${h}:${m} ${p}`);

  // Morning 5 AM to 11 AM
  for(let h=5; h<=11; h++) {
      addTime(h, '00', 'AM');
      addTime(h, '15', 'AM');
      addTime(h, '30', 'AM');
      addTime(h, '45', 'AM');
  }
  
  // Noon 12 PM
  addTime(12, '00', 'PM');
  addTime(12, '15', 'PM');
  addTime(12, '30', 'PM');
  addTime(12, '45', 'PM');

  // Afternoon/Evening 1 PM to 11 PM
  for(let h=1; h<=11; h++) {
      addTime(h, '00', 'PM');
      addTime(h, '15', 'PM');
      addTime(h, '30', 'PM');
      addTime(h, '45', 'PM');
  }
  return times;
};

const TIME_OPTIONS = generateTimeOptions();

const QUESTIONS: Record<UserBranch, { key: string, q: string, options: string[] }[]> = {
  'PRE_DAILY_ROUTINE': [
    { key: 'primaryGoal', q: 'Which area would you like to improve most?', options: ['Better Sleep Routine', 'Reduced Screen Time', 'Better Eating Habits', 'Calm Behaviour', 'More Focus'] },
    { key: 'screenTime', q: 'How much total screen time does your child get daily?', options: ['Less than 30 mins', '30–60 mins', 'More than 1 hour'] },
    { key: 'activePlay', q: 'How much active outdoor play does your child get?', options: ['Daily (1 hr+)', 'Sometimes', 'Very little / Indoor only'] },
    { key: 'eatingHabits', q: 'How would you describe your child’s eating habits?', options: ['Eats well independently', 'Picky eater', 'Needs distraction to eat'] },
  ],
  'PRE_NUTRITION': [
    { key: 'healthGoal', q: 'What do you want to improve most right now?', options: ['Better immunity', 'Better eating habits', 'Healthy weight gain', 'More energy & activity'] },
    { key: 'height', q: 'What is your child\'s height? (e.g. 100cm)', options: [] },
    { key: 'weight', q: 'What is your child\'s weight? (e.g. 15kg)', options: [] },
    { key: 'dietType', q: 'What type of food does your child usually eat at home?', options: ['Vegetarian', 'Non-vegetarian', 'Eggitarian'] },
    { key: 'appetite', q: 'How is your child’s appetite usually?', options: ['Eats well', 'Eats little', 'Very picky eater', 'Mood-based'] },
    { key: 'skipMeals', q: 'Does your child skip meals at home?', options: ['Rarely', 'Sometimes', 'Often'] },
    { key: 'veggieFreq', q: 'How often does your child eat fruits or vegetables?', options: ['Daily', '3–4 times a week', 'Rarely'] },
    { key: 'snackHabit', q: 'What does your child usually have between meals?', options: ['Fruits / nuts', 'Biscuits / chips', 'Homemade snacks', 'Packaged foods'] },
    { key: 'sicknessFreq', q: 'How often does your child fall sick (cold, cough, fever)?', options: ['Rarely', 'Occasionally', 'Often'] },
  ],
  'SCHOOL_STUDY': [
    { key: 'studyGoal', q: 'What is your main objective for this study plan?', options: ['Daily Routine', 'Weekly Timetable', 'Exam Preparation', 'Balanced Plan'] },
    { key: 'currentSubjects', q: 'Please list all the subjects you are currently studying.', options: [] },
    { key: 'difficultSubjects', q: 'Which of these subjects do you want to focus more on or find difficult?', options: [] },
    { key: 'studyHours', q: 'How many hours can you dedicate to self-study per day?', options: ['1-2 hours', '3-4 hours', '5+ hours'] },
    { key: 'includeBreaks', q: 'Would you like your plan to include breaks and relaxation tips?', options: ['Yes', 'No'] },
    { key: 'healthReminders', q: 'Should we add quick health/posture reminders to your study schedule?', options: ['Yes', 'No'] },
  ],
  'SCHOOL_DIET': [
    { key: 'dietGoal', q: 'What is your specific health goal?', options: ['Weight gain', 'Weight loss', 'Better focus', 'More energy'] },
    { key: 'height', q: 'What is your height? (e.g. 150cm)', options: [] },
    { key: 'weight', q: 'What is your weight? (e.g. 40kg)', options: [] },
    { key: 'dietPreference', q: 'What is your primary food choice?', options: ['Veg', 'Non-veg', 'Eggitarian'] },
    { key: 'mealFrequency', q: 'How many meals do you have in a day?', options: ['2-3 meals', '4-5 small meals'] },
  ],
  'SCHOOL_WELLNESS': [
    { key: 'wellnessGoal', q: 'What would you like to improve most?', options: ['Better focus', 'More confidence', 'Less stress', 'Positive thinking', 'Better daily routine'] },
    { key: 'focusLevel', q: 'How well can you focus while studying?', options: ['Very less', 'Sometimes distracted', 'Mostly focused', 'Very focused'] },
    { key: 'distractionSource', q: 'What distracts you the most?', options: ['Mobile / screen', 'Overthinking', 'Noise / people', 'Nothing much'] },
    { key: 'publicSpeaking', q: 'How do you feel when you have to speak or perform in front of others?', options: ['Very nervous', 'Slightly nervous', 'Comfortable', 'Confident'] },
    { key: 'mistakeReaction', q: 'When you make a mistake, what do you usually do?', options: ['Feel scared or upset', 'Avoid the task', 'Try again slowly', 'Learn and improve'] },
    { key: 'stressFreq', q: 'How often do you feel stressed about studies or exams?', options: ['Very often', 'Sometimes', 'Rarely', 'Never'] },
    { key: 'calmMethod', q: 'What helps you feel calm?', options: ['Music', 'Sleep', 'Talking to someone', 'Nothing specific'] },
    { key: 'screenTime', q: 'How much screen time do you have daily?', options: ['High', 'Medium', 'Low'] },
  ]
};

// --- Auth Components ---

const AuthScreen: React.FC<{ onLogin: (user: UserProfile) => void }> = ({ onLogin }) => {
  const [view, setView] = useState<'LOGIN' | 'SIGNUP' | 'FORGOT'>('LOGIN');
  const [form, setForm] = useState({ name: '', age: '', className: '', schoolId: '', phone: '', password: '', confirmPassword: '', otp: '' });
  const [error, setError] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [generatedOtp, setGeneratedOtp] = useState('');
  const [passwordResetStage, setPasswordResetStage] = useState(false);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setForm({ ...form, [e.target.name]: e.target.value });
    setError('');
  };

  const validatePhone = (p: string) => /^\d{10}$/.test(p);

  const getUsers = () => {
    const stored = localStorage.getItem('smart_buddy_users');
    return stored ? JSON.parse(stored) : {};
  };

  const saveUser = (user: UserProfile) => {
    const users = getUsers();
    users[user.phone] = user;
    localStorage.setItem('smart_buddy_users', JSON.stringify(users));
  };

  const handleSignup = () => {
    if (!form.name || !form.age || !form.className || !form.schoolId || !form.phone || !form.password) {
      setError('All fields are required.');
      return;
    }
    if (!validatePhone(form.phone)) {
      setError('Phone number must be exactly 10 digits.');
      return;
    }
    const users = getUsers();
    if (users[form.phone]) {
      setError('User already exists with this phone number.');
      return;
    }

    const newUser: UserProfile = {
      name: form.name,
      age: form.age,
      className: form.className,
      schoolId: form.schoolId,
      phone: form.phone,
      password: form.password
    };
    saveUser(newUser);
    onLogin(newUser);
  };

  const handleLogin = () => {
    if (!validatePhone(form.phone)) {
        setError('Phone number must be exactly 10 digits.');
        return;
    }
    const users = getUsers();
    const user = users[form.phone];
    if (user && user.password === form.password) {
      onLogin(user);
    } else {
      setError('Invalid phone number or password.');
    }
  };

  const sendOtp = () => {
    if (!validatePhone(form.phone)) {
        setError('Enter a valid 10-digit phone number first.');
        return;
    }
    const users = getUsers();
    if (!users[form.phone]) {
        setError('No account found with this phone number.');
        return;
    }
    const code = Math.floor(1000 + Math.random() * 9000).toString();
    setGeneratedOtp(code);
    setOtpSent(true);
    alert(`Smart Buddy Security OTP: ${code}`); // Simulator
  };

  const verifyOtpAndReset = () => {
    if (form.otp !== generatedOtp) {
        setError('Invalid OTP.');
        return;
    }
    setPasswordResetStage(true);
  };

  const confirmNewPassword = () => {
      if (!form.password) {
          setError('Enter a new password.');
          return;
      }
      const users = getUsers();
      users[form.phone].password = form.password;
      localStorage.setItem('smart_buddy_users', JSON.stringify(users));
      alert('Password changed successfully! Please login.');
      setView('LOGIN');
      setForm({...form, password: '', otp: ''});
      setOtpSent(false);
      setPasswordResetStage(false);
  };




  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-slate-100 p-4">
      <div className="w-full max-w-md bg-white rounded-3xl shadow-2xl p-8 border border-white">
        <div className="flex items-center gap-3 mb-8 justify-center">
            <div className="w-10 h-10 bg-indigo-600 rounded-full flex items-center justify-center text-white text-xl">
                <i className="fa-solid fa-robot-astronomer"></i>
            </div>
            <h1 className="font-black text-2xl text-slate-800 tracking-tight">Smart Buddy</h1>
        </div>
        
        <h2 className="text-xl font-bold text-center mb-6 text-slate-700">
            {view === 'LOGIN' ? 'Student Login' : view === 'SIGNUP' ? 'Student Registration' : 'Reset Password'}
        </h2>

        {error && <div className="mb-4 p-3 bg-rose-50 text-rose-600 text-xs font-bold rounded-xl">{error}</div>}

        <div className="space-y-3">
          {view === 'SIGNUP' && (
            <>
              <input name="name" placeholder="Full Name" onChange={handleInputChange} className="w-full p-4 bg-slate-50 border border-slate-200 rounded-xl font-bold text-sm outline-none focus:border-indigo-500 transition" />
              <div className="flex gap-2">
                <input name="age" type="number" placeholder="Age" onChange={handleInputChange} className="w-1/3 p-4 bg-slate-50 border border-slate-200 rounded-xl font-bold text-sm outline-none focus:border-indigo-500 transition" />
                <select name="className" onChange={handleInputChange} className="w-2/3 p-4 bg-slate-50 border border-slate-200 rounded-xl font-bold text-sm outline-none focus:border-indigo-500 transition text-slate-500">
                  <option value="">Select Class</option>
                  {CLASSES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <input name="schoolId" placeholder="School Name / ID" onChange={handleInputChange} className="w-full p-4 bg-slate-50 border border-slate-200 rounded-xl font-bold text-sm outline-none focus:border-indigo-500 transition" />
            </>
          )}

          <div className="relative">
             <input name="phone" type="tel" maxLength={10} placeholder="Phone Number (10 digits)" value={form.phone} onChange={handleInputChange} className="w-full p-4 bg-slate-50 border border-slate-200 rounded-xl font-bold text-sm outline-none focus:border-indigo-500 transition" />
             <i className="fa-solid fa-phone absolute right-4 top-4 text-slate-300"></i>
          </div>

          {(view === 'LOGIN' || view === 'SIGNUP' || (view === 'FORGOT' && passwordResetStage)) && (
            <input name="password" type="password" placeholder={passwordResetStage ? "New Password" : "Password"} value={form.password} onChange={handleInputChange} className="w-full p-4 bg-slate-50 border border-slate-200 rounded-xl font-bold text-sm outline-none focus:border-indigo-500 transition" />
          )}

          {view === 'FORGOT' && !passwordResetStage && (
             <div className="flex gap-2">
                 <input name="otp" placeholder="Enter OTP" value={form.otp} onChange={handleInputChange} className="flex-1 p-4 bg-slate-50 border border-slate-200 rounded-xl font-bold text-sm outline-none focus:border-indigo-500 transition" />
                 {!otpSent ? (
                     <button onClick={sendOtp} className="px-6 bg-slate-800 text-white rounded-xl font-bold text-xs">Send OTP</button>
                 ) : (
                    <button onClick={verifyOtpAndReset} className="px-6 bg-indigo-600 text-white rounded-xl font-bold text-xs">Verify</button>
                 )}
             </div>
          )}

          {view === 'LOGIN' && (
            <button onClick={handleLogin} className="w-full py-4 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 transition shadow-lg shadow-indigo-100 mt-2">Login</button>
          )}
          
          {view === 'SIGNUP' && (
            <button onClick={handleSignup} className="w-full py-4 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 transition shadow-lg shadow-indigo-100 mt-2">Create Account</button>
          )}

          {view === 'FORGOT' && passwordResetStage && (
            <button onClick={confirmNewPassword} className="w-full py-4 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 transition shadow-lg shadow-indigo-100 mt-2">Set New Password</button>
          )}
        </div>

        <div className="mt-6 text-center space-y-2">
          {view === 'LOGIN' && (
            <>
              <p onClick={() => setView('FORGOT')} className="text-xs font-bold text-slate-400 cursor-pointer hover:text-indigo-600">Forgot Password?</p>
              <p onClick={() => setView('SIGNUP')} className="text-xs font-bold text-slate-400 cursor-pointer hover:text-indigo-600">New Student? Create Account</p>
            </>
          )}
          {view === 'SIGNUP' && (
            <p onClick={() => setView('LOGIN')} className="text-xs font-bold text-slate-400 cursor-pointer hover:text-indigo-600">Already have an account? Login</p>
          )}
          {view === 'FORGOT' && (
            <p onClick={() => setView('LOGIN')} className="text-xs font-bold text-slate-400 cursor-pointer hover:text-indigo-600">Back to Login</p>
          )}
        </div>
      </div>
    </div>
  );
};

// --- Main Chat Component ---

const ChatScreen: React.FC<{ user: UserProfile, onLogout: () => void, onUpdateUser: (u: UserProfile) => void }> = ({ user, onLogout, onUpdateUser }) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [state, setState] = useState<ChatState>({
    step: 'GREETING',
    details: { name: user.name, age: user.age, grade: user.className, school: user.schoolId },
    answers: {},
    currentQuestionIndex: 0
  });
  const [userInput, setUserInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<AIPlanOutput | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const addMessage = (msg: Omit<ChatMessage, 'id'>) => {
    setMessages(prev => [...prev, { ...msg, id: Math.random().toString(36).substr(2, 9) }]);
  };

  const showMainOptions = () => {
    const isPreSchool = PRE_SCHOOL_CLASSES.includes(user.className);
    if (isPreSchool) {
        addMessage({ sender: 'bot', text: 'Choose your support type:', options: ['Daily routine support', 'Nutrition and immunity wellness tips'], type: 'choice' });
    } else {
        addMessage({ sender: 'bot', text: 'Choose your support type:', options: ['Personalized Study Plan', 'Personalized Diet Plan', 'Wellness Support'], type: 'choice' });
    }
  };

  const handleStart = () => {
    // CHECK IF ROUTINE EXISTS IN USER PROFILE
    if (user.routine && Object.keys(user.routine).length > 0) {
      // Routine exists: Jump to Main Choice
      const greetingText = `Welcome back, ${user.name}! I remember your daily routine. How can I help you improve today?`;
      addMessage({ sender: 'bot', text: greetingText, type: 'text' });
      
      showMainOptions();
      
      setState(prev => ({ 
        ...prev, 
        step: 'MAIN_CHOICE',
        answers: { ...prev.answers, ...user.routine } // Load saved routine into answers
      }));

    } else {
      // Routine does not exist: Ask for it
      const greetingText = `Welcome, ${user.name}! I’m your Smart Buddy — your mentor & friend. To help me serve you best, please share your current daily routine. I will save this for your future visits.`;
      addMessage({ sender: 'bot', text: greetingText, type: 'text' });
      addMessage({ sender: 'bot', text: "Please fill in your typical daily schedule below.", type: 'routine' });
      setState(prev => ({ ...prev, step: 'COLLECTING_ROUTINE' }));
    }
  };

  const handleRoutineSubmit = (routineData: Record<string, string>) => {
    // Save routine to Chat State
    const updatedAnswers = { ...state.answers, ...routineData };
    
    // SAVE ROUTINE TO BACKEND (LocalStorage) via User Profile
    const updatedUser: UserProfile = { ...user, routine: routineData };
    onUpdateUser(updatedUser);

    addMessage({ sender: 'bot', text: "Thanks! I've saved your routine." });
    
    showMainOptions();
    setState(prev => ({ ...prev, answers: updatedAnswers, step: 'MAIN_CHOICE' }));
  };

  const handleChoice = (option: string) => {
    addMessage({ sender: 'user', text: option });
    
    if (state.step === 'MAIN_CHOICE') {
      let branch: UserBranch;
      let botResponse = '';

      if (option === 'Daily routine support') { branch = 'PRE_DAILY_ROUTINE'; botResponse = "Let's create a perfect daily routine for your child. I have a few quick questions."; }
      else if (option === 'Nutrition and immunity wellness tips') { branch = 'PRE_NUTRITION'; botResponse = "Nutrition is key! I'll ask a few simple questions about eating habits."; }
      else if (option === 'Personalized Study Plan') { branch = 'SCHOOL_STUDY'; botResponse = "Awesome! Let’s build your personalized study plan."; }
      else if (option === 'Personalized Diet Plan') { branch = 'SCHOOL_DIET'; botResponse = "Great choice! A healthy diet helps you stay active and focused."; }
      else { branch = 'SCHOOL_WELLNESS'; botResponse = "I’m glad you care about your wellness! Let's explore some mindset strategies."; }

      addMessage({ sender: 'bot', text: botResponse });
      
      // Skip COLLECTING_DETAILS and go straight to BRANCH_QUESTIONS
      // Initialize question index
      setState(prev => ({ ...prev, branch, step: 'BRANCH_QUESTIONS', currentQuestionIndex: 0 }));

      // Trigger first question
      const firstQ = QUESTIONS[branch][0];
      setTimeout(() => {
        addMessage({ sender: 'bot', text: firstQ.q, options: firstQ.options, type: firstQ.options.length ? 'choice' : 'text' });
      }, 500);

    } else if (state.step === 'BRANCH_QUESTIONS') {
      const branch = state.branch!;
      const qs = QUESTIONS[branch];
      const currentQuestion = qs[state.currentQuestionIndex];
      const answerKey = currentQuestion.key;
      
      const nextIndex = state.currentQuestionIndex + 1;
      setState(prev => ({ 
        ...prev, 
        answers: { ...prev.answers, [answerKey]: option },
        currentQuestionIndex: nextIndex 
      }));

      if (nextIndex < qs.length) {
        const nextQ = qs[nextIndex];
        addMessage({ sender: 'bot', text: nextQ.q, options: nextQ.options, type: nextQ.options.length ? 'choice' : 'text' });
      } else {
        processResults();
      }
    }
  };

  const processResults = async () => {
    setState(prev => ({ ...prev, step: 'GENERATING' }));
    setLoading(true);
    addMessage({ sender: 'bot', text: `Thank you, ${state.details.name}! I am now analyzing your details to build your specialized plan based on Ultra-Core requirements...` });
    
    try {
      const plan = await generateSmartBuddyPlan(state);
      setResult(plan);
      setState(prev => ({ ...prev, step: 'COMPLETED' }));
      addMessage({ sender: 'bot', text: 'I have finished your personalized plan! You can download your specialized report below.', type: 'download' });
    } catch (err: any) {
      // Display message from service
      addMessage({ sender: 'bot', text: err.message || 'I encountered a small glitch. Please try restarting!' });
    } finally {
      setLoading(false);
    }
  };

  const cleanText = (text: any): string => {
    if (text === null || text === undefined) return '';
    if (typeof text !== 'string') return String(text);
    const cleaned = text.replace(/^\["|", "|^\[|\]$|"\]$|^"|"$/g, '').replace(/\*\*/g, '').trim();
    return cleaned === 'undefined' ? '' : cleaned;
  };

  const downloadPDF = () => {
    if (!result) return;
    try {
      const doc = new jsPDF();
      const pw = doc.internal.pageSize.getWidth();
      const ph = doc.internal.pageSize.getHeight();
      let primaryRGB: [number, number, number] = [79, 70, 229];
      let lightRGB: [number, number, number] = [240, 244, 255]; 
      let planTitle = "SUCCESS ROADMAP";
      
      if (state.branch?.includes('DIET') || state.branch?.includes('NUTRITION')) {
          primaryRGB = [225, 29, 72];
          lightRGB = [255, 241, 242];
          planTitle = "PERSONALIZED DIET & NUTRITION PLAN";
      } else if (state.branch?.includes('WELLNESS')) {
          primaryRGB = [16, 185, 129];
          lightRGB = [236, 253, 245];
          planTitle = "STUDENT WELLNESS & MINDSET PLAN";
      } else if (state.branch?.includes('DAILY_ROUTINE')) {
          primaryRGB = [37, 99, 235];
          lightRGB = [239, 246, 255];
          planTitle = "PRE-SCHOOL DAILY ROUTINE";
      } else if (state.branch?.includes('STUDY')) {
          planTitle = "PERSONALIZED STUDY ROADMAP";
      }

      doc.setFillColor(primaryRGB[0], primaryRGB[1], primaryRGB[2]);
      doc.rect(0, 0, pw, 28, 'F');
      
      doc.setFillColor(255, 255, 255);
      doc.roundedRect(10, 10, pw - 20, 50, 4, 4, 'F'); 
      doc.setDrawColor(230, 230, 230);
      doc.setLineWidth(0.5);
      doc.roundedRect(10, 10, pw - 20, 50, 4, 4, 'D');

      doc.setFontSize(30);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(30, 30, 30);
      
      const schoolName = cleanText(state.details.school).toUpperCase() || "YOUR SCHOOL";
      const titleLines = doc.splitTextToSize(schoolName, pw - 40);
      
      let titleY = 32;
      if (titleLines.length > 1) titleY = 28;
      if (titleLines.length > 2) titleY = 24;

      doc.text(titleLines, pw / 2, titleY, { align: 'center' });
      
      const subTitleY = titleY + (titleLines.length * 11) + 1;
      
      doc.setFontSize(9);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(primaryRGB[0], primaryRGB[1], primaryRGB[2]);
      doc.text('SMART BUDDY: ULTRA-CORE SUCCESS ECOSYSTEM', pw / 2, subTitleY, { align: 'center', charSpace: 1 });
      
      doc.setFillColor(248, 250, 252);
      doc.rect(10, 68, pw - 20, 16, 'F');
      doc.setDrawColor(220);
      doc.line(10, 68, pw - 10, 68);
      doc.line(10, 84, pw - 10, 84);
      
      doc.setFontSize(11);
      doc.setTextColor(60);
      doc.setFont('helvetica', 'bold');
      const profile = `STUDENT: ${cleanText(state.details.name).toUpperCase()}  |  CLASS: ${cleanText(state.details.grade)}  |  AGE: ${cleanText(state.details.age)}YRS`;
      doc.text(profile, pw / 2, 78, { align: 'center' });

      doc.setFontSize(16);
      doc.setTextColor(30);
      doc.setFont('helvetica', 'bold');
      doc.text(planTitle, pw / 2, 95, { align: 'center' });

      let y = 110;

      result.sections.forEach((sec, idx) => {
        if (y > ph - 45) {
          doc.addPage();
          y = 30;
          doc.setFillColor(primaryRGB[0], primaryRGB[1], primaryRGB[2]);
          doc.rect(0, 0, 8, ph, 'F');
        }

        doc.setFontSize(14);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(primaryRGB[0], primaryRGB[1], primaryRGB[2]);
        
        // Fix: Strip existing numbering from AI output (e.g., "1. Introduction" -> "Introduction")
        // preventing double numbering like "1. 1. Introduction"
        const cleanHeading = cleanText(sec.heading).replace(/^\d+[\.\)\s]+\s*/, ''); 
        const headerText = `${idx + 1}. ${cleanHeading.toUpperCase()}`;
        
        doc.text(headerText, 18, y);
        const textWidth = doc.getTextWidth(headerText);
        y += 2.5;
        doc.setDrawColor(primaryRGB[0], primaryRGB[1], primaryRGB[2]);
        doc.setLineWidth(1.2);
        doc.line(18, y, 18 + textWidth, y);
        doc.setLineWidth(0.2); 
        y += 12;

        doc.setFontSize(10.5);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(70, 70, 70);

        const isTable = Array.isArray(sec.content) && sec.content.length > 0 && typeof sec.content[0] === 'object';
        const isList = Array.isArray(sec.content) && (sec.content.length === 0 || typeof sec.content[0] === 'string');

        if (isTable) {
          const tableData = (sec.content as any[]).filter(row => row && typeof row === 'object');
          if (tableData.length > 0) {
            const headKeys = Object.keys(tableData[0]);
            const headLabels = headKeys.map(k => k.replace(/([A-Z])/g, ' $1').toUpperCase());
            const body = tableData.map((obj: any) => headKeys.map(k => cleanText(obj[k])));
            autoTable(doc, {
              startY: y,
              head: [headLabels],
              body: body,
              margin: { left: 18, right: 18 },
              theme: 'striped',
              headStyles: { fillColor: primaryRGB, textColor: 255, fontStyle: 'bold', fontSize: 9, halign: 'center', cellPadding: 4 },
              styles: { fontSize: 8.5, cellPadding: 4, valign: 'middle', textColor: 50, lineColor: [240, 240, 240], lineWidth: 0.1 },
              alternateRowStyles: { fillColor: lightRGB },
            });
            y = (doc as any).lastAutoTable.finalY + 18;
          }
        } else if (isList) {
          const listItems = sec.content as string[];
          listItems.forEach(item => {
            if (y > ph - 22) { doc.addPage(); y = 30; doc.setFillColor(primaryRGB[0], primaryRGB[1], primaryRGB[2]); doc.rect(0,0,8,ph,'F'); }
            const cleaned = cleanText(item);
            if (!cleaned) return;
            doc.setFillColor(primaryRGB[0], primaryRGB[1], primaryRGB[2]);
            doc.circle(21, y - 1.2, 0.6, 'F'); 
            const lines = doc.splitTextToSize(cleaned, pw - 48);
            doc.text(lines, 26, y);
            y += (lines.length * 7) + 3;
          });
          y += 8;
        } else {
          const rawText = typeof sec.content === 'string' ? sec.content : JSON.stringify(sec.content);
          const cleanedText = cleanText(rawText);
          const lines = doc.splitTextToSize(cleanedText, pw - 36);
          doc.text(lines, 18, y, { lineHeightFactor: 1.5 });
          y += (lines.length * 7.5) + 12;
        }
      });

      if (y > ph - 55) { doc.addPage(); y = 30; doc.setFillColor(primaryRGB[0], primaryRGB[1], primaryRGB[2]); doc.rect(0,0,8,ph,'F'); }
      doc.setFillColor(lightRGB[0], lightRGB[1], lightRGB[2]);
      doc.roundedRect(15, y, pw - 30, 35, 2, 2, 'F');
      doc.setDrawColor(primaryRGB[0], primaryRGB[1], primaryRGB[2]);
      doc.setLineWidth(0.5);
      doc.roundedRect(15, y, pw - 30, 35, 2, 2, 'D');
      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(primaryRGB[0], primaryRGB[1], primaryRGB[2]);
      doc.text('A Personal Message from your Smart Buddy:', 20, y + 10);
      doc.setFontSize(10);
      doc.setFont('helvetica', 'italic');
      doc.setTextColor(80, 80, 80);
      const summaryLines = doc.splitTextToSize(cleanText(result.summary || ""), pw - 45);
      doc.text(summaryLines, 20, y + 18, { lineHeightFactor: 1.3 });

      const pageCount = (doc as any).internal.getNumberOfPages();
      for (let i = 1; i <= pageCount; i++) {
          doc.setPage(i);
          doc.setFillColor(primaryRGB[0], primaryRGB[1], primaryRGB[2]);
          doc.rect(0, 0, 5, ph, 'F');
          doc.setFontSize(7.5);
          doc.setFont('helvetica', 'normal');
          doc.setTextColor(180, 180, 180);
          doc.text(`SMART BUDDY ULTRA-CORE REPORT © 2025 | Page ${i} of ${pageCount}`, pw / 2, ph - 10, { align: 'center' });
      }
      doc.save(`${state.details.name.replace(/\s+/g, '_')}_SmartBuddy_Plan.pdf`);
    } catch (err) {
      console.error("PDF Generation Error:", err);
      alert("Something went wrong while generating the PDF. Please try again or check the console.");
    }
  };

  useEffect(() => { handleStart(); }, []);

  return (
    <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4">
      <div className="w-full max-w-2xl bg-white h-[90vh] rounded-[2.5rem] shadow-2xl flex flex-col overflow-hidden border border-white">
        
        <div className="bg-indigo-600 p-6 flex items-center gap-4 text-white shadow-lg relative z-10">
          <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center text-2xl">
            <i className="fa-solid fa-robot-astronomer"></i>
          </div>
          <div>
            <h1 className="font-black text-xl tracking-tight">Smart Buddy</h1>
            <p className="text-indigo-100 text-xs font-bold opacity-80 uppercase tracking-widest">Mentor & Friend</p>
          </div>
          <button onClick={onLogout} className="ml-auto text-xs bg-indigo-700 px-3 py-1 rounded-lg hover:bg-indigo-800 transition">Logout</button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-4 scroll-smooth bg-slate-50">
          {messages.map(m => (
            <div key={m.id} className={`flex ${m.sender === 'user' ? 'justify-end' : 'justify-start'} animate-in fade-in slide-in-from-bottom-2 duration-300`}>
              <div className={`max-w-[85%] p-4 rounded-2xl shadow-sm text-sm font-medium leading-relaxed ${
                m.sender === 'user' 
                ? 'bg-indigo-600 text-white rounded-tr-none' 
                : 'bg-white border border-slate-100 text-slate-700 rounded-tl-none'
              }`}>
                {m.text}
                
                {m.type === 'choice' && m.options && (
                  <div className="mt-4 flex flex-wrap gap-2">
                    {m.options.map(opt => (
                      <button 
                        key={opt}
                        onClick={() => handleChoice(opt)}
                        className="px-4 py-2 bg-indigo-50 text-indigo-600 border border-indigo-100 rounded-xl hover:bg-indigo-600 hover:text-white transition-all font-bold"
                      >
                        {opt}
                      </button>
                    ))}
                  </div>
                )}

                {m.type === 'routine' && state.step === 'COLLECTING_ROUTINE' && (
                  <RoutineForm 
                    onSubmit={handleRoutineSubmit}
                    isPreSchool={PRE_SCHOOL_CLASSES.includes(user.className)}
                  />
                )}

                {m.type === 'download' && result && (
                  <div className="mt-4">
                    <button 
                      onClick={downloadPDF}
                      className="w-full py-4 bg-emerald-500 text-white rounded-xl font-black hover:bg-emerald-600 transition shadow-lg shadow-emerald-100 flex items-center justify-center gap-2"
                    >
                      <i className="fa-solid fa-file-pdf"></i> Download Ultra-Core Success Plan
                    </button>
                    <button 
                      onClick={() => window.location.reload()}
                      className="w-full mt-2 py-2 text-slate-400 font-bold text-xs hover:text-slate-600"
                    >
                      Start New Analysis
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}
          {loading && (
            <div className="flex justify-start">
              <div className="bg-white border border-slate-100 p-4 rounded-2xl flex gap-2 items-center shadow-sm">
                <div className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-bounce"></div>
                <div className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-bounce delay-75"></div>
                <div className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-bounce delay-150"></div>
              </div>
            </div>
          )}
          <div ref={scrollRef} />
        </div>

        {state.step === 'BRANCH_QUESTIONS' && !QUESTIONS[state.branch!][state.currentQuestionIndex]?.options.length && (
          <div className="p-4 bg-white border-t border-slate-100 flex gap-2">
            <input 
              type="text"
              value={userInput}
              onChange={(e) => setUserInput(e.target.value)}
              placeholder="Type your answer..."
              onKeyDown={(e) => e.key === 'Enter' && userInput && (handleChoice(userInput), setUserInput(''))}
              className="flex-1 px-6 py-4 rounded-2xl bg-slate-50 border border-slate-200 outline-none focus:border-indigo-400 font-bold"
            />
            <button 
              onClick={() => userInput && (handleChoice(userInput), setUserInput(''))}
              className="w-14 h-14 bg-indigo-600 text-white rounded-2xl flex items-center justify-center hover:bg-indigo-700 transition"
            >
              <i className="fa-solid fa-paper-plane"></i>
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

const TimeSelect: React.FC<{ label: string, value: string, onChange: (v: string) => void }> = ({ label, value, onChange }) => (
  <div className="space-y-1">
    <label className="text-[10px] font-bold text-slate-500 uppercase">{label}</label>
    <div className="relative">
      <select 
        value={value} 
        onChange={(e) => onChange(e.target.value)}
        className="w-full p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs font-bold outline-none focus:border-indigo-500 text-slate-700 appearance-none"
      >
        <option value="">Select Time</option>
        {TIME_OPTIONS.map(t => <option key={t} value={t}>{t}</option>)}
      </select>
      <i className="fa-solid fa-clock absolute right-3 top-3.5 text-slate-300 pointer-events-none"></i>
    </div>
  </div>
);

type NapRoutine = {
  activity: string;
  startTime: string;
  endTime: string;
};

type TuitionRoutine = {
  subject: string;
  startTime: string;
  endTime: string;
};

type EveningRoutine = {
  activity: string;
  startTime: string;
  endTime: string;
};

type FormState = {
  wakeUp: string;
  schoolStart: string;
  schoolEnd: string;
  lunchTime: string;
  dinnerTime: string;
  bedTime: string;
  napRoutines: NapRoutine[];
  tuitionRoutines: TuitionRoutine[];
  eveningRoutines: EveningRoutine[];
};


const RoutineForm: React.FC<{
  onSubmit: (d: Record<string, string>) => void,
  isPreSchool: boolean
}> = ({ onSubmit, isPreSchool }) => {
 const [form, setForm] = useState<FormState>({
  wakeUp: '',
  schoolStart: '',
  schoolEnd: '',
  lunchTime: '',
  dinnerTime: '',
  bedTime: '',
  napRoutines: [{ activity: '', startTime: '', endTime: '' }],
  tuitionRoutines: [{ subject: '', startTime: '', endTime: '' }],
  eveningRoutines: [{ activity: '', startTime: '', endTime: '' }]
});

const updateArray = <T,>(
  key: keyof FormState,
  index: number,
  field: keyof T,
  value: string
) => {
  const copy = [...(form[key] as T[])];
  copy[index][field] = value;
  setForm({ ...form, [key]: copy });
};

const schoolHours =
  form.schoolStart && form.schoolEnd
    ? `${form.schoolStart} to ${form.schoolEnd}`
    : "";


const handleSubmit = () => {
  onSubmit({
    ...form,
    schoolHours
  });
};


  const isComplete = form.wakeUp && schoolHours && form.lunchTime && form.dinnerTime && form.bedTime;

  return (
    <div className="mt-4 space-y-3">
      <div className="grid grid-cols-2 gap-2">
        <TimeSelect label="Wake Up Time" value={form.wakeUp} onChange={v => setForm({...form, wakeUp: v})} />
        <TimeSelect label="Bed Time" value={form.bedTime} onChange={v => setForm({...form, bedTime: v})} />
      </div>
      
  <div className="space-y-1">
  <label className="text-[10px] font-bold text-slate-500 uppercase">
    School Hours
  </label>

  <div className="grid grid-cols-2 gap-2">
    <div className="relative">
      <select
        value={form.schoolStart}
        onChange={e =>
          setForm({ ...form, schoolStart: e.target.value })
        }
        className="w-full p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs font-bold outline-none focus:border-indigo-500 text-slate-700 appearance-none"
      >
        <option value="">Start</option>
        {TIME_OPTIONS.map(t => (
          <option key={t} value={t}>{t}</option>
        ))}
      </select>
      <i className="fa-solid fa-chevron-down absolute right-3 top-3.5 text-slate-300 pointer-events-none text-[10px]" />
    </div>

    <div className="relative">
      <select
        value={form.schoolEnd}
        onChange={e =>
          setForm({ ...form, schoolEnd: e.target.value })
        }
        className="w-full p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs font-bold outline-none focus:border-indigo-500 text-slate-700 appearance-none"
      >
        <option value="">End</option>
        {TIME_OPTIONS.map(t => (
          <option key={t} value={t}>{t}</option>
        ))}
      </select>
      <i className="fa-solid fa-chevron-down absolute right-3 top-3.5 text-slate-300 pointer-events-none text-[10px]" />
    </div>
  </div>
</div>

      <div className="grid grid-cols-2 gap-2">
        <TimeSelect label="Lunch Time" value={form.lunchTime} onChange={v => setForm({...form, lunchTime: v})} />
        <TimeSelect label="Dinner Time" value={form.dinnerTime} onChange={v => setForm({...form, dinnerTime: v})} />
      </div>

      <div className="space-y-3">
       <label className="text-[10px] font-bold text-slate-500 uppercase">
    {isPreSchool ? "Nap or Afternoon Rest?" : "After School Activity?"}
  </label>
  
{form.napRoutines.map((r, i) => (
  <div key={i} className="grid grid-cols-[1.2fr_1fr_1fr] gap-2">
  
    <input
      value={r.activity}
      onChange={e =>
        updateArray<NapRoutine>(
          "napRoutines",
          i,
          "activity",
          e.target.value
        )
      }
      placeholder={isPreSchool ? "Nap" : "After school"}
      className="w-full p-3 rounded-xl bg-slate-50 border text-xs font-bold"
    />

    <TimeSelect
      value={r.startTime}
      onChange={v =>
        updateArray<NapRoutine>("napRoutines", i, "startTime", v)
      }
    />

    <TimeSelect
      value={r.endTime}
      onChange={v =>
        updateArray<NapRoutine>("napRoutines", i, "endTime", v)
      }
    />
  </div>
))}

<button
  type="button"
  onClick={() =>
    setForm({
      ...form,
      napRoutines: [
        ...form.napRoutines,
        { activity: '', startTime: '', endTime: '' }
      ]
    })
  }
  className="text-xs font-bold text-blue-600"
>
  + Add another
</button>
</div>

<div className="space-y-3">
  <label className="text-[10px] font-bold text-slate-500 uppercase">
    Tuition / Coaching?
  </label>

  {form.tuitionRoutines.map((r, i) => (
 
    <div key={i} className="grid grid-cols-[1.2fr_1fr_1fr] gap-2">

      <input
        value={r.subject}
        onChange={e =>
          updateArray<TuitionRoutine>(
            "tuitionRoutines",
            i,
            "subject",
            e.target.value
          )
        }
        placeholder="Math tuition"
        className="w-full p-3 rounded-xl bg-slate-50 border text-xs font-bold"
      />

      <TimeSelect
        value={r.startTime}
        onChange={v =>
          updateArray<TuitionRoutine>("tuitionRoutines", i, "startTime", v)
        }
      />

      <TimeSelect
        value={r.endTime}
        onChange={v =>
          updateArray<TuitionRoutine>("tuitionRoutines", i, "endTime", v)
        }
      />
 
    </div>
  ))}

  <button
    type="button"
    onClick={() =>
      setForm({
        ...form,
        tuitionRoutines: [
          ...form.tuitionRoutines,
          { subject: '', startTime: '', endTime: '' }
        ]
      })
    }
    className="text-xs font-bold text-indigo-600 hover:underline"
  >
    + Add another
  </button>
</div>

<div className="space-y-3">
  <label className="text-[10px] font-bold text-slate-500 uppercase">
    Evening Activity
  </label>

  {form.eveningRoutines.map((r, i) => (
    <div key={i} className="grid grid-cols-[1.2fr_1fr_1fr] gap-2">
      <input
        value={r.activity}
        onChange={e =>
          updateArray<EveningRoutine>(
            "eveningRoutines",
            i,
            "activity",
            e.target.value
          )
        }
        placeholder="Playing"
        className="w-full p-3 rounded-xl bg-slate-50 border text-xs font-bold"
      />

      <TimeSelect
        value={r.startTime}
        onChange={v =>
          updateArray<EveningRoutine>("eveningRoutines", i, "startTime", v)
        }
      />

      <TimeSelect
        value={r.endTime}
        onChange={v =>
          updateArray<EveningRoutine>("eveningRoutines", i, "endTime", v)
        }
      />
    </div>
  ))}

  <button
    type="button"
    onClick={() =>
      setForm({
        ...form,
        eveningRoutines: [
          ...form.eveningRoutines,
          { activity: '', startTime: '', endTime: '' }
        ]
      })
    }
    className="text-xs font-bold text-indigo-600 hover:underline"
  >
    + Add another
  </button>
</div>



      <button 
        disabled={!isComplete}
        onClick={handleSubmit}
        className="w-full py-3 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 transition disabled:opacity-50 mt-2"
      >
        Confirm Routine
      </button>
    </div>
  );
};

const App: React.FC = () => {
  const [user, setUser] = useState<UserProfile | null>(null);

  useEffect(() => {
    const savedUser = localStorage.getItem('smart_buddy_active_user');
    if (savedUser) {
      try {
        setCurrentUser(JSON.parse(savedUser));
      } catch (e) {
        localStorage.removeItem('smart_buddy_active_user');
      }
    }
  }, []);

  const getUsers = () => {
    const stored = localStorage.getItem('smart_buddy_users');
    return stored ? JSON.parse(stored) : {};
  };

  const updateUser = (updatedUser: UserProfile) => {
    const users = getUsers();
    users[updatedUser.phone] = updatedUser;
    localStorage.setItem('smart_buddy_users', JSON.stringify(users));
    setCurrentUser(updatedUser);
  };

  const setCurrentUser = (u: UserProfile | null) => {
      setUser(u);
      if(u) localStorage.setItem('smart_buddy_active_user', JSON.stringify(u));
      else localStorage.removeItem('smart_buddy_active_user');
  };

  return (
    <>
      {!user ? (
        <AuthScreen onLogin={setCurrentUser} />
      ) : (
        <ChatScreen user={user} onLogout={() => setCurrentUser(null)} onUpdateUser={updateUser} />
      )}
    </>
  );
};

export default App;