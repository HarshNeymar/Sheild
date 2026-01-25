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
  const times = [];
  const addTime = (h: number, m: string, p: string) => times.push(`${h}:${m} ${p}`);
  for(let h=5; h<=11; h++) { addTime(h, '00', 'AM'); addTime(h, '15', 'AM'); addTime(h, '30', 'AM'); addTime(h, '45', 'AM'); }
  addTime(12, '00', 'PM'); addTime(12, '15', 'PM'); addTime(12, '30', 'PM'); addTime(12, '45', 'PM');
  for(let h=1; h<=11; h++) { addTime(h, '00', 'PM'); addTime(h, '15', 'PM'); addTime(h, '30', 'PM'); addTime(h, '45', 'PM'); }
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
    if (!form.name || !form.age || !form.className || !form.schoolId || !form.phone || !form.password) { setError('All fields are required.'); return; }
    if (!validatePhone(form.phone)) { setError('Phone number must be exactly 10 digits.'); return; }
    const users = getUsers();
    if (users[form.phone]) { setError('User already exists with this phone number.'); return; }
    const newUser: UserProfile = { name: form.name, age: form.age, className: form.className, schoolId: form.schoolId, phone: form.phone, password: form.password };
    saveUser(newUser);
    onLogin(newUser);
  };

  const handleLogin = () => {
    if (!validatePhone(form.phone)) { setError('Phone number must be exactly 10 digits.'); return; }
    const users = getUsers();
    const user = users[form.phone];
    if (user && user.password === form.password) { onLogin(user); } else { setError('Invalid phone number or password.'); }
  };

  const sendOtp = () => {
    if (!validatePhone(form.phone)) { setError('Enter a valid 10-digit phone number first.'); return; }
    const users = getUsers();
    if (!users[form.phone]) { setError('No account found with this phone number.'); return; }
    const code = Math.floor(1000 + Math.random() * 9000).toString();
    setGeneratedOtp(code);
    setOtpSent(true);
    alert(`Smart Buddy Security OTP: ${code}`); 
  };

  const verifyOtpAndReset = () => {
    if (form.otp !== generatedOtp) { setError('Invalid OTP.'); return; }
    setPasswordResetStage(true);
  };

  const confirmNewPassword = () => {
      if (!form.password) { setError('Enter a new password.'); return; }
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
        <h2 className="text-xl font-bold text-center mb-6 text-slate-700">{view === 'LOGIN' ? 'Student Login' : view === 'SIGNUP' ? 'Student Registration' : 'Reset Password'}</h2>
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
                 {!otpSent ? ( <button onClick={sendOtp} className="px-6 bg-slate-800 text-white rounded-xl font-bold text-xs">Send OTP</button> ) : ( <button onClick={verifyOtpAndReset} className="px-6 bg-indigo-600 text-white rounded-xl font-bold text-xs">Verify</button> )}
             </div>
          )}
          {view === 'LOGIN' && <button onClick={handleLogin} className="w-full py-4 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 transition shadow-lg shadow-indigo-100 mt-2">Login</button>}
          {view === 'SIGNUP' && <button onClick={handleSignup} className="w-full py-4 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 transition shadow-lg shadow-indigo-100 mt-2">Create Account</button>}
          {view === 'FORGOT' && passwordResetStage && <button onClick={confirmNewPassword} className="w-full py-4 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 transition shadow-lg shadow-indigo-100 mt-2">Set New Password</button>}
        </div>
        <div className="mt-6 text-center space-y-2">
          {view === 'LOGIN' && ( <> <p onClick={() => setView('FORGOT')} className="text-xs font-bold text-slate-400 cursor-pointer hover:text-indigo-600">Forgot Password?</p> <p onClick={() => setView('SIGNUP')} className="text-xs font-bold text-slate-400 cursor-pointer hover:text-indigo-600">New Student? Create Account</p> </> )}
          {view === 'SIGNUP' && ( <p onClick={() => setView('LOGIN')} className="text-xs font-bold text-slate-400 cursor-pointer hover:text-indigo-600">Already have an account? Login</p> )}
          {view === 'FORGOT' && ( <p onClick={() => setView('LOGIN')} className="text-xs font-bold text-slate-400 cursor-pointer hover:text-indigo-600">Back to Login</p> )}
        </div>
      </div>
    </div>
  );
};

// --- Main Chat Component ---

const ChatScreen: React.FC<{ user: UserProfile, onLogout: () => void, onUpdateUser: (u: UserProfile) => void }> = ({ user, onLogout, onUpdateUser }) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [state, setState] = useState<ChatState>({ step: 'GREETING', details: { name: user.name, age: user.age, grade: user.className, school: user.schoolId }, answers: {}, currentQuestionIndex: 0 });
  const [userInput, setUserInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<AIPlanOutput | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => { scrollRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);
  const addMessage = (msg: Omit<ChatMessage, 'id'>) => { setMessages(prev => [...prev, { ...msg, id: Math.random().toString(36).substr(2, 9) }]); };

  const showMainOptions = () => {
    const isPreSchool = PRE_SCHOOL_CLASSES.includes(user.className);
    if (isPreSchool) { addMessage({ sender: 'bot', text: 'Choose your support type:', options: ['Daily routine support', 'Nutrition and immunity wellness tips'], type: 'choice' }); } 
    else { addMessage({ sender: 'bot', text: 'Choose your support type:', options: ['Personalized Study Plan', 'Personalized Diet Plan', 'Wellness Support'], type: 'choice' }); }
  };

  const handleStart = () => {
    if (user.routine && Object.keys(user.routine).length > 0) {
      addMessage({ sender: 'bot', text: `Welcome back, ${user.name}! I remember your daily routine. How can I help you improve today?`, type: 'text' });
      showMainOptions();
      setState(prev => ({ ...prev, step: 'MAIN_CHOICE', answers: { ...prev.answers, ...user.routine } }));
    } else {
      addMessage({ sender: 'bot', text: `Welcome, ${user.name}! I’m your Smart Buddy. To help me serve you best, please share your typical daily routine.`, type: 'text' });
      addMessage({ sender: 'bot', text: "Please fill in your typical daily schedule below.", type: 'routine' });
      setState(prev => ({ ...prev, step: 'COLLECTING_ROUTINE' }));
    }
  };

  const handleRoutineSubmit = (routineData: Record<string, string>) => {
    const updatedUser: UserProfile = { ...user, routine: routineData };
    onUpdateUser(updatedUser);
    addMessage({ sender: 'bot', text: "Thanks! I've saved your routine." });
    showMainOptions();
    setState(prev => ({ ...prev, answers: { ...prev.answers, ...routineData }, step: 'MAIN_CHOICE' }));
  };

  const handleChoice = (option: string) => {
    addMessage({ sender: 'user', text: option });
    if (state.step === 'MAIN_CHOICE') {
      let branch: UserBranch;
      let botResponse = '';
      if (option === 'Daily routine support') { branch = 'PRE_DAILY_ROUTINE'; botResponse = "Let's create a perfect daily routine. I have a few quick questions."; }
      else if (option === 'Nutrition and immunity wellness tips') { branch = 'PRE_NUTRITION'; botResponse = "Nutrition is key! I'll ask about eating habits."; }
      else if (option === 'Personalized Study Plan') { branch = 'SCHOOL_STUDY'; botResponse = "Let’s build your study plan."; }
      else if (option === 'Personalized Diet Plan') { branch = 'SCHOOL_DIET'; botResponse = "A healthy diet helps you stay focused."; }
      else { branch = 'SCHOOL_WELLNESS'; botResponse = "Let's explore wellness strategies."; }
      addMessage({ sender: 'bot', text: botResponse });
      setState(prev => ({ ...prev, branch, step: 'BRANCH_QUESTIONS', currentQuestionIndex: 0 }));
      const firstQ = QUESTIONS[branch][0];
      setTimeout(() => { addMessage({ sender: 'bot', text: firstQ.q, options: firstQ.options, type: firstQ.options.length ? 'choice' : 'text' }); }, 500);
    } else if (state.step === 'BRANCH_QUESTIONS') {
      const branch = state.branch!;
      const qs = QUESTIONS[branch];
      const currentQuestion = qs[state.currentQuestionIndex];
      const nextIndex = state.currentQuestionIndex + 1;
      setState(prev => ({ ...prev, answers: { ...prev.answers, [currentQuestion.key]: option }, currentQuestionIndex: nextIndex }));
      if (nextIndex < qs.length) {
        const nextQ = qs[nextIndex];
        addMessage({ sender: 'bot', text: nextQ.q, options: nextQ.options, type: nextQ.options.length ? 'choice' : 'text' });
      } else { processResults(); }
    }
  };

  const processResults = async () => {
    setState(prev => ({ ...prev, step: 'GENERATING' }));
    setLoading(true);
    addMessage({ sender: 'bot', text: `Analyzing your details for your Ultra-Core roadmap...` });
    try {
      const plan = await generateSmartBuddyPlan(state);
      setResult(plan);
      setState(prev => ({ ...prev, step: 'COMPLETED' }));
      addMessage({ sender: 'bot', text: 'I have finished your personalized plan!', type: 'download' });
    } catch (err: any) { addMessage({ sender: 'bot', text: err.message || 'Error generating plan.' }); } finally { setLoading(false); }
  };

  const cleanText = (text: any): string => {
    if (text === null || text === undefined) return '';
    if (typeof text !== 'string') return String(text);
    let cleaned = text.replace(/\*\*/g, '').trim();
    if (cleaned.startsWith('{') && cleaned.endsWith('}')) return cleaned;
    return cleaned.replace(/^\["|", "|^\[|\]$|"\]$|^"|"$/g, '');
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
      
      if (state.branch?.includes('DIET')) { primaryRGB = [225, 29, 72]; lightRGB = [255, 241, 242]; planTitle = "PERSONALIZED DIET PLAN"; }
      else if (state.branch?.includes('WELLNESS')) { primaryRGB = [16, 185, 129]; lightRGB = [236, 253, 245]; planTitle = "STUDENT WELLNESS PLAN"; }

      doc.setFillColor(primaryRGB[0], primaryRGB[1], primaryRGB[2]);
      doc.rect(0, 0, pw, 28, 'F');
      doc.setFillColor(255, 255, 255);
      doc.roundedRect(10, 10, pw - 20, 50, 4, 4, 'F'); 
      doc.setFontSize(30);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(30, 30, 30);
      const schoolName = cleanText(state.details.school).toUpperCase() || "YOUR SCHOOL";
      doc.text(schoolName, pw / 2, 32, { align: 'center' });
      
      doc.setFontSize(11);
      doc.setTextColor(60);
      const profile = `STUDENT: ${cleanText(state.details.name).toUpperCase()} | CLASS: ${cleanText(state.details.grade)}`;
      doc.text(profile, pw / 2, 78, { align: 'center' });

      let y = 110;

      result.sections.forEach((sec, idx) => {
        if (y > ph - 45) { doc.addPage(); y = 30; }
        doc.setFontSize(14);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(primaryRGB[0], primaryRGB[1], primaryRGB[2]);
        doc.text(`${idx + 1}. ${cleanText(sec.heading).toUpperCase()}`, 18, y);
        y += 12;

        let content = sec.content;
        if (typeof content === 'string' && content.trim().startsWith('{')) {
          try { content = JSON.parse(content); } catch (e) { console.error("JSON parse error", e); }
        }

        const isTableObj = content && typeof content === 'object' && 'headers' in content && 'rows' in content;
        
        if (isTableObj) {
          const tableObj = content as { headers: string[], rows: string[][] };
          autoTable(doc, {
            startY: y,
            head: [tableObj.headers.map(h => h.toUpperCase())],
            body: tableObj.rows.map(row => row.map(cell => cleanText(cell))),
            margin: { left: 18, right: 18 },
            theme: 'striped',
            headStyles: { fillColor: primaryRGB },
            styles: { fontSize: 8.5 },
          });
          y = (doc as any).lastAutoTable.finalY + 18;
        } else if (Array.isArray(content)) {
            // Logic for regular lists
            content.forEach(item => {
                doc.text(`• ${cleanText(item)}`, 20, y);
                y += 7;
            });
            y += 5;
        } else {
            doc.setFont('helvetica', 'normal');
            doc.setTextColor(70);
            const lines = doc.splitTextToSize(cleanText(content), pw - 36);
            doc.text(lines, 18, y);
            y += (lines.length * 7) + 12;
        }
      });
      doc.save(`${state.details.name}_Plan.pdf`);
    } catch (err) { console.error("PDF Error", err); }
  };

  useEffect(() => { handleStart(); }, []);

  return (
    <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4">
      <div className="w-full max-w-2xl bg-white h-[90vh] rounded-[2.5rem] shadow-2xl flex flex-col overflow-hidden border border-white">
        <div className="bg-indigo-600 p-6 flex items-center gap-4 text-white shadow-lg relative z-10">
          <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center text-2xl"><i className="fa-solid fa-robot-astronomer"></i></div>
          <div><h1 className="font-black text-xl tracking-tight">Smart Buddy</h1></div>
          <button onClick={onLogout} className="ml-auto text-xs bg-indigo-700 px-3 py-1 rounded-lg">Logout</button>
        </div>
        <div className="flex-1 overflow-y-auto p-6 space-y-4 bg-slate-50">
          {messages.map(m => (
            <div key={m.id} className={`flex ${m.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[85%] p-4 rounded-2xl text-sm font-medium ${m.sender === 'user' ? 'bg-indigo-600 text-white' : 'bg-white border border-slate-100 text-slate-700'}`}>
                {m.text}
                {m.type === 'choice' && m.options && (
                  <div className="mt-4 flex flex-wrap gap-2">
                    {m.options.map(opt => ( <button key={opt} onClick={() => handleChoice(opt)} className="px-4 py-2 bg-indigo-50 text-indigo-600 border border-indigo-100 rounded-xl hover:bg-indigo-600 hover:text-white transition-all font-bold">{opt}</button> ))}
                  </div>
                )}
                {m.type === 'routine' && <RoutineForm onSubmit={handleRoutineSubmit} isPreSchool={PRE_SCHOOL_CLASSES.includes(user.className)} />}
                {m.type === 'download' && result && (
                  <div className="mt-4">
                    <button onClick={downloadPDF} className="w-full py-4 bg-emerald-500 text-white rounded-xl font-black shadow-lg flex items-center justify-center gap-2"><i className="fa-solid fa-file-pdf"></i> Download Success Plan</button>
                    <button onClick={() => window.location.reload()} className="w-full mt-2 text-slate-400 text-xs">Start New Analysis</button>
                  </div>
                )}
              </div>
            </div>
          ))}
          {loading && <div className="flex justify-start"><div className="bg-white p-4 rounded-2xl flex gap-1"><div className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-bounce"></div><div className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-bounce delay-75"></div></div></div>}
          <div ref={scrollRef} />
        </div>
        {state.step === 'BRANCH_QUESTIONS' && !QUESTIONS[state.branch!][state.currentQuestionIndex]?.options.length && (
          <div className="p-4 bg-white border-t flex gap-2">
            <input type="text" value={userInput} onChange={(e) => setUserInput(e.target.value)} placeholder="Type answer..." onKeyDown={(e) => e.key === 'Enter' && userInput && (handleChoice(userInput), setUserInput(''))} className="flex-1 px-6 py-4 rounded-2xl bg-slate-50 border outline-none font-bold" />
            <button onClick={() => userInput && (handleChoice(userInput), setUserInput(''))} className="w-14 h-14 bg-indigo-600 text-white rounded-2xl flex items-center justify-center"><i className="fa-solid fa-paper-plane"></i></button>
          </div>
        )}
      </div>
    </div>
  );
};

// ... TimeSelect and RoutineForm components ...
const TimeSelect: React.FC<{ label: string, value: string, onChange: (v: string) => void }> = ({ label, value, onChange }) => (
    <div className="space-y-1">
      <label className="text-[10px] font-bold text-slate-500 uppercase">{label}</label>
      <select value={value} onChange={(e) => onChange(e.target.value)} className="w-full p-3 rounded-xl bg-slate-50 border text-xs font-bold">
          <option value="">Select Time</option>
          {TIME_OPTIONS.map(t => <option key={t} value={t}>{t}</option>)}
      </select>
    </div>
);

const RoutineForm: React.FC<{ onSubmit: (d: Record<string, string>) => void, isPreSchool: boolean }> = ({ onSubmit, isPreSchool }) => {
    const [r, setR] = useState({ wakeUp: '', schoolHours: '', lunchTime: '', napRoutine: '', tuitionTime: '', eveningActivity: '', dinnerTime: '', bedTime: '' });
    const isComplete = r.wakeUp && r.schoolHours && r.lunchTime && r.dinnerTime && r.bedTime;
    return (
        <div className="mt-4 space-y-3">
            <div className="grid grid-cols-2 gap-2"><TimeSelect label="Wake Up" value={r.wakeUp} onChange={v => setR({...r, wakeUp: v})} /><TimeSelect label="Bed Time" value={r.bedTime} onChange={v => setR({...r, bedTime: v})} /></div>
            <input type="text" placeholder="School Hours (e.g. 8am-2pm)" value={r.schoolHours} onChange={e => setR({...r, schoolHours: e.target.value})} className="w-full p-3 rounded-xl bg-slate-50 border text-xs" />
            <div className="grid grid-cols-2 gap-2"><TimeSelect label="Lunch" value={r.lunchTime} onChange={v => setR({...r, lunchTime: v})} /><TimeSelect label="Dinner" value={r.dinnerTime} onChange={v => setR({...r, dinnerTime: v})} /></div>
            <button disabled={!isComplete} onClick={() => onSubmit(r)} className="w-full py-3 bg-indigo-600 text-white rounded-xl font-bold disabled:opacity-50">Confirm Routine</button>
        </div>
    );
};

const App: React.FC = () => {
  const [user, setUser] = useState<UserProfile | null>(null);
  useEffect(() => {
    const saved = localStorage.getItem('smart_buddy_active_user');
    if (saved) setUser(JSON.parse(saved));
  }, []);
  const setCurrentUser = (u: UserProfile | null) => {
      setUser(u);
      if(u) localStorage.setItem('smart_buddy_active_user', JSON.stringify(u));
      else localStorage.removeItem('smart_buddy_active_user');
  };
  const updateUser = (u: UserProfile) => {
    const users = JSON.parse(localStorage.getItem('smart_buddy_users') || '{}');
    users[u.phone] = u;
    localStorage.setItem('smart_buddy_users', JSON.stringify(users));
    setCurrentUser(u);
  };
  return !user ? <AuthScreen onLogin={setCurrentUser} /> : <ChatScreen user={user} onLogout={() => setCurrentUser(null)} onUpdateUser={updateUser} />;
};

export default App;
