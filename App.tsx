import React, { useState, useEffect, useRef } from 'react';
import { ChatStep, UserBranch, ChatMessage, ChatState, AIPlanOutput, UserProfile } from './types';
import { generateSmartBuddyPlan } from './services/gemini';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
// @ts-ignore
import logo from './logo.png';
// --- Constants ---
import {
  exchangeSmartBuddyLaunchToken,
  getSmartBuddyProfile,
  logoutSmartBuddySession,
  saveSmartBuddyProfile,
  uploadSmartBuddyReport,
} from './services/smartBuddyApi';
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

const firstNonEmpty = (...values: unknown[]) => {
  for (const value of values) {
    if (value === 0) return "0";

    if (value !== null && value !== undefined) {
      const normalized = String(value).trim();

      if (normalized) {
        return normalized;
      }
    }
  }

  return "";
};

const buildUserFromSmartBuddySession = (data: any): UserProfile => {
  const profile = data?.profile ?? data ?? {};

  const student = profile.student ?? {};
  const school = profile.school ?? {};
  const savedProfile = profile.saved_profile ?? {};

  const formData = savedProfile.form_data ?? {};
  const assessmentData = savedProfile.assessment_data ?? {};
  const savedDetails = formData.details ?? {};

  // Main Student Shield profile is always the source of truth.
  const canonicalDetails = {
    name: firstNonEmpty(student.full_name, savedDetails.name, "Student"),
    age: firstNonEmpty(student.age, savedDetails.age),
    grade: firstNonEmpty(
      student.class_assigned,
      savedDetails.grade,
      savedDetails.className
    ),
    school: firstNonEmpty(
      school.name,
      savedDetails.school,
      student.school_id
    ),
  };

  return {
    name: canonicalDetails.name,
    age: canonicalDetails.age,
    className: canonicalDetails.grade,
    schoolId: canonicalDetails.school,

    phone: firstNonEmpty(
      student.parent_phone,
      student.id,
      "smart-buddy-student"
    ),

    password: "",
    studentId: student.id,

    sessionToken:
      data?.session_token ||
      sessionStorage.getItem("smart_buddy_session_token") ||
      "",

    routine: formData.routine ?? {},

    // Keep raw old data so we can detect and repair blank/wrong values.
    savedFormData: formData,

    savedAssessmentData: assessmentData,
  };
};

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
            <div className="w-[200px] h-[50px] rounded-full flex items-center justify-center overflow-hidden">
                {/* FIX: Changed from string path to imported variable */}
                <img src={logo} alt="Student Shield" className="w-full h-full object-cover" />
            </div>
         
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

const SavedSessionReview: React.FC<{
  user: UserProfile;
  onContinue: () => void;
  onUpdate: () => void;
}> = ({ user, onContinue, onUpdate }) => {
  const formData = user.savedFormData || {};
  const routine = formData.routine || {};
  const answers = formData.answers || {};
  const latestPlan = user.savedAssessmentData?.latest_plan;

  const getSavedValue = (key: string) =>
    firstNonEmpty(routine[key], answers[key], "Not set");

  const lastSaved =
    formData.updated_at ||
    user.savedAssessmentData?.updated_at ||
    user.savedAssessmentData?.generated_at;

  return (
    <div className="min-h-screen bg-slate-100 p-4 sm:p-8 flex items-center justify-center">
      <div className="w-full max-w-4xl bg-white rounded-3xl shadow-xl overflow-hidden">
        <div className="bg-indigo-600 px-6 py-7 text-white">
          <p className="text-xs uppercase tracking-[0.25em] text-indigo-100">
            Smart Buddy
          </p>

          <h1 className="text-2xl sm:text-3xl font-black mt-2">
            Welcome back, {user.name}
          </h1>

          <p className="text-sm text-indigo-100 mt-2">
            Review your saved session before continuing. You can update your
            routine and answers anytime.
          </p>
        </div>

        <div className="p-6 space-y-6">
          <div>
            <h2 className="font-bold text-slate-800 text-lg">
              Student Details
            </h2>

            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3 mt-3">
              <div className="rounded-xl bg-slate-50 border p-3">
                <p className="text-xs text-slate-500">Student</p>
                <p className="font-semibold text-slate-800 mt-1">
                  {user.name || "—"}
                </p>
              </div>

              <div className="rounded-xl bg-slate-50 border p-3">
                <p className="text-xs text-slate-500">Age</p>
                <p className="font-semibold text-slate-800 mt-1">
                  {user.age || "—"}
                </p>
              </div>

              <div className="rounded-xl bg-slate-50 border p-3">
                <p className="text-xs text-slate-500">Class</p>
                <p className="font-semibold text-slate-800 mt-1">
                  {user.className || "—"}
                </p>
              </div>

              <div className="rounded-xl bg-slate-50 border p-3">
                <p className="text-xs text-slate-500">School</p>
                <p className="font-semibold text-slate-800 mt-1">
                  {user.schoolId || "—"}
                </p>
              </div>
            </div>

            <p className="text-xs text-slate-500 mt-3">
              Name, age, class and school are synced from Student Shield.
              Update these from the main Student Shield portal.
            </p>
          </div>

          <div>
            <h2 className="font-bold text-slate-800 text-lg">
              Saved Routine & Preferences
            </h2>

            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3 mt-3">
              <div className="rounded-xl border p-3">
                <p className="text-xs text-slate-500">Wake-up Time</p>
                <p className="font-medium text-slate-800 mt-1">
                  {getSavedValue("wakeUp")}
                </p>
              </div>

              <div className="rounded-xl border p-3">
                <p className="text-xs text-slate-500">School Hours</p>
                <p className="font-medium text-slate-800 mt-1">
                  {getSavedValue("schoolHours")}
                </p>
              </div>

              <div className="rounded-xl border p-3">
                <p className="text-xs text-slate-500">After School</p>
                <p className="font-medium text-slate-800 mt-1">
                  {getSavedValue("afterSchool")}
                </p>
              </div>

              <div className="rounded-xl border p-3">
                <p className="text-xs text-slate-500">Study Hours</p>
                <p className="font-medium text-slate-800 mt-1">
                  {getSavedValue("studyHours")}
                </p>
              </div>

              <div className="rounded-xl border p-3">
                <p className="text-xs text-slate-500">Dinner Time</p>
                <p className="font-medium text-slate-800 mt-1">
                  {getSavedValue("dinnerTime")}
                </p>
              </div>

              <div className="rounded-xl border p-3">
                <p className="text-xs text-slate-500">Bedtime</p>
                <p className="font-medium text-slate-800 mt-1">
                  {getSavedValue("bedTime")}
                </p>
              </div>
            </div>
          </div>

          {latestPlan?.title && (
            <div className="rounded-xl border border-indigo-100 bg-indigo-50 p-4">
              <p className="text-xs font-bold uppercase tracking-wide text-indigo-500">
                Latest Saved Plan
              </p>
              <p className="font-bold text-indigo-950 mt-1">
                {latestPlan.title}
              </p>
            </div>
          )}

          {lastSaved && (
            <p className="text-xs text-slate-500">
              Last saved: {new Date(lastSaved).toLocaleString()}
            </p>
          )}

          <div className="flex flex-col sm:flex-row gap-3 pt-2">
            <button
              type="button"
              onClick={onContinue}
              className="flex-1 rounded-xl bg-indigo-600 px-5 py-3 text-white font-bold hover:bg-indigo-700 transition"
            >
              Continue Saved Session
            </button>

            <button
              type="button"
              onClick={onUpdate}
              className="flex-1 rounded-xl border border-indigo-200 bg-white px-5 py-3 text-indigo-700 font-bold hover:bg-indigo-50 transition"
            >
              Update Routine & Answers
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

const ChatScreen: React.FC<{
  user: UserProfile;
  onLogout: () => void;
  onUpdateUser: (u: UserProfile) => void;
  isAutoLogin?: boolean;
}> = ({ user, onLogout, onUpdateUser, isAutoLogin = false }) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  
 const savedFormData = user.savedFormData || {};
const savedDetails = savedFormData.details || {};
const savedRoutine = savedFormData.routine || {};
const savedAnswers = savedFormData.answers || {};

const hasSavedSession =
  Object.keys(savedRoutine).length > 0 ||
  Object.keys(savedAnswers).length > 0 ||
  Boolean(user.savedAssessmentData?.latest_plan);

const [showSavedSessionReview, setShowSavedSessionReview] =
  useState(hasSavedSession);
// Student Shield portal details override old Smart Buddy saved details.
const studentDetails = {
  name: firstNonEmpty(user.name, savedDetails.name, "Student"),
  age: firstNonEmpty(user.age, savedDetails.age),
  grade: firstNonEmpty(
    user.className,
    savedDetails.grade,
    savedDetails.className
  ),
  school: firstNonEmpty(user.schoolId, savedDetails.school),
};

const [state, setState] = useState<ChatState>({
  step: "GREETING",
  details: studentDetails,
  answers: savedFormData.answers || {},
  branch: savedFormData.branch,
  currentQuestionIndex: savedFormData.currentQuestionIndex || 0,
});

const [userInput, setUserInput] = useState("");
const [loading, setLoading] = useState(false);

const [result, setResult] = useState<AIPlanOutput | null>(
  user.savedAssessmentData?.latest_plan || null
);
  const scrollRef = useRef<HTMLDivElement>(null);
useEffect(() => {
  const existingDetails = savedFormData.details || {};

  const detailsNeedRepair =
    existingDetails.name !== studentDetails.name ||
    String(existingDetails.age ?? "") !== studentDetails.age ||
    existingDetails.grade !== studentDetails.grade ||
    existingDetails.school !== studentDetails.school;

  if (detailsNeedRepair) {
    void persistSmartBuddyProfile({
      ...savedFormData,
      details: studentDetails,
    });
  }
}, []);
  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const addMessage = (msg: Omit<ChatMessage, 'id'>) => {
    setMessages(prev => [...prev, { ...msg, id: Math.random().toString(36).substr(2, 9) }]);
  };

  const persistSmartBuddyProfile = async (
  nextFormData: Record<string, any>,
  nextAssessmentData?: Record<string, any>
) => {
  if (!user.sessionToken) return;

  try {
    await saveSmartBuddyProfile(
      {
        form_data: {
          ...(user.savedFormData || {}),
          ...nextFormData,
          updated_at: new Date().toISOString(),
        },
        ...(nextAssessmentData
          ? {
              assessment_data: {
                ...(user.savedAssessmentData || {}),
                ...nextAssessmentData,
                updated_at: new Date().toISOString(),
              },
            }
          : {}),
      },
      user.sessionToken
    );
  } catch (error) {
    console.error('Smart Buddy profile save failed:', error);
  }
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
  const savedAnswers = user.savedFormData?.answers || {};
  const savedRoutine = user.routine || user.savedFormData?.routine || {};

  if (savedRoutine && Object.keys(savedRoutine).length > 0) {
    const greetingText = `Welcome back, ${user.name}! I remember your saved routine. You can continue or update your Smart Buddy plan anytime.`;

    addMessage({
      sender: 'bot',
      text: greetingText,
      type: 'text',
    });

    showMainOptions();

    setState((prev) => ({
      ...prev,
      step: 'MAIN_CHOICE',
      answers: {
        ...prev.answers,
        ...savedAnswers,
        ...savedRoutine,
      },
    }));
  } else {
    const greetingText = `Welcome, ${user.name}! I’m your Student Shield — your mentor & friend. To help me serve you best, please share your current daily routine. I will save this for your future visits.`;

    addMessage({
      sender: 'bot',
      text: greetingText,
      type: 'text',
    });

    addMessage({
      sender: 'bot',
      text: 'Please fill in your typical daily schedule below.',
      type: 'routine',
    });

    setState((prev) => ({
      ...prev,
      step: 'COLLECTING_ROUTINE',
    }));
  }
};
 const handleRoutineSubmit = async (routineData: Record<string, string>) => {
  const updatedAnswers = { ...state.answers, ...routineData };

  const updatedUser: UserProfile = {
    ...user,
    routine: routineData,
    savedFormData: {
      ...(user.savedFormData || {}),
      routine: routineData,
      answers: updatedAnswers,
      details: state.details,
    },
  };

  onUpdateUser(updatedUser);

  await persistSmartBuddyProfile({
    routine: routineData,
    answers: updatedAnswers,
    details: state.details,
  });

  addMessage({ sender: 'bot', text: "Thanks! I've saved your routine." });

  showMainOptions();

  setState((prev) => ({
    ...prev,
    answers: updatedAnswers,
    step: 'MAIN_CHOICE',
  }));
};

  const handleChoice = async (option: string) => {
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

      // --- VALIDATION: Check if difficult subjects are in the previously entered current subjects list ---
      if (branch === 'SCHOOL_STUDY' && answerKey === 'difficultSubjects') {
          const currentSubjectsRaw = state.answers['currentSubjects'] || '';
          
          // Helper to split and normalize strings (remove whitespace, lowercase, filter empty)
          const normalizeList = (str: string) => str.split(',').map(s => s.trim().toLowerCase()).filter(s => s.length > 0);
          
          const currentList = normalizeList(currentSubjectsRaw);
          const difficultList = normalizeList(option);
          
          // Find subjects in difficult list that are NOT in current list
          const invalidSubjects = difficultList.filter(d => !currentList.includes(d));
          
          if (invalidSubjects.length > 0) {
              addMessage({ 
                  sender: 'bot', 
                  text: `Please verify your subjects. You listed "${invalidSubjects.join(', ')}" as difficult, but these weren't in your main subject list (${currentSubjectsRaw}). Please choose only from your current subjects.` 
              });
              return; // Halt progress until valid input is given
          }
      }
      // --- END VALIDATION ---
      
    const nextIndex = state.currentQuestionIndex + 1;

const nextAnswers = {
  ...state.answers,
  [answerKey]: option,
};

const nextState: ChatState = {
  ...state,
  answers: nextAnswers,
  currentQuestionIndex: nextIndex,
};

setState(nextState);

await persistSmartBuddyProfile({
  routine: user.routine || nextAnswers,
  branch,
  answers: nextAnswers,
  details: nextState.details,
  currentQuestionIndex: nextIndex,
});

if (nextIndex < qs.length) {
  const nextQ = qs[nextIndex];

  addMessage({
    sender: 'bot',
    text: nextQ.q,
    options: nextQ.options,
    type: nextQ.options.length ? 'choice' : 'text',
  });
} else {
  processResults(nextState);
}
    }
  };

const processResults = async (stateToGenerate: ChatState = state) => {
  setState((prev) => ({ ...prev, step: 'GENERATING' }));
  setLoading(true);

  addMessage({
    sender: 'bot',
    text: `Thank you, ${stateToGenerate.details.name}! I am now analyzing your details to build your specialized plan based on Ultra-Core requirements...`,
  });

  try {
    const plan = await generateSmartBuddyPlan(stateToGenerate);

    setResult(plan);

    setState((prev) => ({
      ...prev,
      step: 'COMPLETED',
    }));

    await persistSmartBuddyProfile(
      {
        routine: user.routine || stateToGenerate.answers,
        branch: stateToGenerate.branch,
        answers: stateToGenerate.answers,
        details: stateToGenerate.details,
        currentQuestionIndex: stateToGenerate.currentQuestionIndex,
      },
      {
        latest_plan: plan,
        latest_branch: stateToGenerate.branch,
        generated_at: new Date().toISOString(),
      }
    );

    addMessage({
      sender: 'bot',
      text: 'I have finished your personalized plan! You can download your specialized report below.',
      type: 'download',
    });
  } catch (err: any) {
    addMessage({
      sender: 'bot',
      text: err.message || 'I encountered a small glitch. Please try restarting!',
    });
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
const loadPdfLogo = (
  src: string
): Promise<{ dataUrl: string; width: number; height: number }> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";

    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;

      const ctx = canvas.getContext("2d");

      if (!ctx) {
        reject(new Error("Unable to load logo canvas"));
        return;
      }

      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0);

      resolve({
        dataUrl: canvas.toDataURL("image/png"),
        width: img.naturalWidth,
        height: img.naturalHeight,
      });
    };

    img.onerror = reject;
    img.src = src;
  });
};

const drawCenteredFittedText = (
  doc: any,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  startFontSize: number,
  minFontSize: number
) => {
  let fontSize = startFontSize;
  doc.setFontSize(fontSize);

  while (doc.getTextWidth(text) > maxWidth && fontSize > minFontSize) {
    fontSize -= 0.25;
    doc.setFontSize(fontSize);
  }

  doc.text(text, x, y, { align: "center" });
};

const getPdfStudentDetails = () => ({
  name: firstNonEmpty(user.name, state.details?.name, "Student"),
  age: firstNonEmpty(user.age, state.details?.age, "—"),
  grade: firstNonEmpty(
    user.className,
    state.details?.grade,
    "—"
  ),
  school: firstNonEmpty(user.schoolId, state.details?.school, "—"),
});

const downloadPDF = async () => {
  if (!result) return;

  const pdfStudent = getPdfStudentDetails();

  try {
    const doc = new jsPDF();
    const pdfLogo = await loadPdfLogo(logo);

    const pw = doc.internal.pageSize.getWidth();
    const ph = doc.internal.pageSize.getHeight();

    let primaryRGB: [number, number, number] = [79, 70, 229];
    let lightRGB: [number, number, number] = [240, 244, 255];
    let planTitle = "SUCCESS ROADMAP";

    if (state.branch?.includes("DIET") || state.branch?.includes("NUTRITION")) {
      primaryRGB = [225, 29, 72];
      lightRGB = [255, 241, 242];
      planTitle = "PERSONALIZED DIET & NUTRITION PLAN";
    } else if (state.branch?.includes("WELLNESS")) {
      primaryRGB = [16, 185, 129];
      lightRGB = [236, 253, 245];
      planTitle = "STUDENT WELLNESS & MINDSET PLAN";
    } else if (state.branch?.includes("DAILY_ROUTINE")) {
      primaryRGB = [37, 99, 235];
      lightRGB = [239, 246, 255];
      planTitle = "PRE-SCHOOL DAILY ROUTINE";
    } else if (state.branch?.includes("STUDY")) {
      planTitle = "PERSONALIZED STUDY ROADMAP";
    }

    doc.setFillColor(primaryRGB[0], primaryRGB[1], primaryRGB[2]);
    doc.rect(0, 0, pw, 28, "F");

    doc.setFillColor(255, 255, 255);
    doc.roundedRect(10, 10, pw - 20, 50, 4, 4, "F");

    doc.setDrawColor(230, 230, 230);
    doc.setLineWidth(0.5);
    doc.roundedRect(10, 10, pw - 20, 50, 4, 4, "D");

    const logoMaxW = 75;
    const logoMaxH = 34;
    const logoRatio = pdfLogo.width / pdfLogo.height;

    let logoW = logoMaxW;
    let logoH = logoW / logoRatio;

    if (logoH > logoMaxH) {
      logoH = logoMaxH;
      logoW = logoH * logoRatio;
    }

    doc.addImage(
      pdfLogo.dataUrl,
      "PNG",
      pw - logoW - 16,
      15,
      logoW,
      logoH
    );

    doc.setFontSize(30);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(30, 30, 30);

    // Uses actual school data from Student Shield backend.
    const schoolName =
      cleanText(pdfStudent.school).toUpperCase() || "YOUR SCHOOL";

    // Keep title away from the logo at top-right.
    const titleLines = doc.splitTextToSize(schoolName, pw - 95);

    let titleY = 32;

    if (titleLines.length > 1) titleY = 28;
    if (titleLines.length > 2) titleY = 24;

    doc.text(titleLines, pw / 2, titleY, { align: "center" });

    doc.setFontSize(7);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(primaryRGB[0], primaryRGB[1], primaryRGB[2]);

    drawCenteredFittedText(
      doc,
      "STUDENT SHIELD SMART BUDDY: ULTRA-CORE SUCCESS ECOSYSTEM",
      pw / 2,
      46,
      pw - 45,
      7,
      5.5
    );

    doc.setFillColor(248, 250, 252);
    doc.rect(10, 68, pw - 20, 16, "F");

    doc.setDrawColor(220);
    doc.line(10, 68, pw - 10, 68);
    doc.line(10, 84, pw - 10, 84);

    doc.setFontSize(11);
    doc.setTextColor(60);
    doc.setFont("helvetica", "bold");

    // Uses actual student data from Student Shield backend.
    const profile =
      `STUDENT: ${cleanText(pdfStudent.name).toUpperCase()}  |  ` +
      `SCHOOL: ${cleanText(pdfStudent.school).toUpperCase()}  |  ` +
      `CLASS: ${cleanText(pdfStudent.grade)}  |  ` +
      `AGE: ${cleanText(pdfStudent.age) || "—"} YRS`;

    doc.text(profile, pw / 2, 78, { align: "center" });

    doc.setFontSize(16);
    doc.setTextColor(30);
    doc.setFont("helvetica", "bold");
    doc.text(planTitle, pw / 2, 95, { align: "center" });

    let y = 110;

    result.sections.forEach((sec, idx) => {
      if (y > ph - 45) {
        doc.addPage();
        y = 30;

        doc.setFillColor(primaryRGB[0], primaryRGB[1], primaryRGB[2]);
        doc.rect(0, 0, 8, ph, "F");
      }

      doc.setFontSize(14);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(primaryRGB[0], primaryRGB[1], primaryRGB[2]);

      const cleanHeading = cleanText(sec.heading).replace(
        /^\d+[\.\)\s]+\s*/,
        ""
      );

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
      doc.setFont("helvetica", "normal");
      doc.setTextColor(70, 70, 70);

      const isTable =
        Array.isArray(sec.content) &&
        sec.content.length > 0 &&
        typeof sec.content[0] === "object";

      const isList =
        Array.isArray(sec.content) &&
        (sec.content.length === 0 || typeof sec.content[0] === "string");

      if (isTable) {
        const tableData = (sec.content as any[]).filter(
          (row) => row && typeof row === "object"
        );

        if (tableData.length > 0) {
          const headKeys = Object.keys(tableData[0]);

          const headLabels = headKeys.map((key) =>
            key.replace(/([A-Z])/g, " $1").toUpperCase()
          );

          const body = tableData.map((row: any) =>
            headKeys.map((key) => cleanText(row[key]))
          );

          autoTable(doc, {
            startY: y,
            head: [headLabels],
            body,
            margin: { left: 18, right: 18 },
            theme: "striped",
            headStyles: {
              fillColor: primaryRGB,
              textColor: 255,
              fontStyle: "bold",
              fontSize: 9,
              halign: "center",
              cellPadding: 4,
            },
            styles: {
              fontSize: 8.5,
              cellPadding: 4,
              valign: "middle",
              textColor: 50,
              lineColor: [240, 240, 240],
              lineWidth: 0.1,
            },
            alternateRowStyles: {
              fillColor: lightRGB,
            },
          });

          y = (doc as any).lastAutoTable.finalY + 18;
        }
      } else if (isList) {
        const listItems = sec.content as string[];

        listItems.forEach((item) => {
          if (y > ph - 22) {
            doc.addPage();
            y = 30;

            doc.setFillColor(primaryRGB[0], primaryRGB[1], primaryRGB[2]);
            doc.rect(0, 0, 8, ph, "F");
          }

          const cleaned = cleanText(item);

          if (!cleaned) return;

          doc.setFillColor(primaryRGB[0], primaryRGB[1], primaryRGB[2]);
          doc.circle(21, y - 1.2, 0.6, "F");

          const lines = doc.splitTextToSize(cleaned, pw - 48);

          doc.text(lines, 26, y);
          y += lines.length * 7 + 3;
        });

        y += 8;
      } else {
        const rawText =
          typeof sec.content === "string"
            ? sec.content
            : JSON.stringify(sec.content);

        const cleanedText = cleanText(rawText);
        const lines = doc.splitTextToSize(cleanedText, pw - 36);

        doc.text(lines, 18, y, { lineHeightFactor: 1.5 });
        y += lines.length * 7.5 + 12;
      }
    });

    if (y > ph - 55) {
      doc.addPage();
      y = 30;

      doc.setFillColor(primaryRGB[0], primaryRGB[1], primaryRGB[2]);
      doc.rect(0, 0, 8, ph, "F");
    }

    doc.setFillColor(lightRGB[0], lightRGB[1], lightRGB[2]);
    doc.roundedRect(15, y, pw - 30, 35, 2, 2, "F");

    doc.setDrawColor(primaryRGB[0], primaryRGB[1], primaryRGB[2]);
    doc.setLineWidth(0.5);
    doc.roundedRect(15, y, pw - 30, 35, 2, 2, "D");

    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(primaryRGB[0], primaryRGB[1], primaryRGB[2]);

    doc.text(
      "A Personal Message from your Student Shield: Smart Buddy:",
      20,
      y + 10
    );

    doc.setFontSize(10);
    doc.setFont("helvetica", "italic");
    doc.setTextColor(80, 80, 80);

    const summaryLines = doc.splitTextToSize(
      cleanText(result.summary || ""),
      pw - 45
    );

    doc.text(summaryLines, 20, y + 18, {
      lineHeightFactor: 1.3,
    });

    const pageCount = (doc as any).internal.getNumberOfPages();

    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);

      doc.setFillColor(primaryRGB[0], primaryRGB[1], primaryRGB[2]);
      doc.rect(0, 0, 5, ph, "F");

      doc.setFontSize(7.5);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(180, 180, 180);

      doc.text(
        `Student Shield: SMART BUDDY ULTRA-CORE REPORT © 2025 | Page ${i} of ${pageCount}`,
        pw / 2,
        ph - 10,
        { align: "center" }
      );
    }

    const fileName = `${pdfStudent.name.replace(
      /\s+/g,
      "_"
    )}_SmartBuddy_Plan.pdf`;

    const pdfBlob = doc.output("blob");

    doc.save(fileName);

    if (user.sessionToken) {
      try {
        const formData = new FormData();

        formData.append("file", pdfBlob, fileName);

        formData.append(
          "report_title",
          result.title || "Smart Buddy Report"
        );

        formData.append(
          "report_data",
          JSON.stringify({
            student: pdfStudent,
            details: {
              name: pdfStudent.name,
              age: pdfStudent.age,
              grade: pdfStudent.grade,
              school: pdfStudent.school,
            },
            branch: state.branch,
            answers: state.answers,
            routine: user.routine || {},
            plan: result,
            generated_at: new Date().toISOString(),
          })
        );

        await uploadSmartBuddyReport(formData, user.sessionToken);

        alert("PDF downloaded and saved to your Student Shield portal.");
      } catch (uploadError) {
        console.error("PDF archive upload failed:", uploadError);

        alert(
          "PDF downloaded, but could not be saved to Student Shield portal. Please try again."
        );
      }
    }
  } catch (err) {
    console.error("PDF Generation Error:", err);

    alert(
      "Something went wrong while generating the PDF. Please try again or check the console."
    );
  }
};
const continueSavedSession = () => {
  setShowSavedSessionReview(false);

  addMessage({
    sender: "bot",
    text: `Welcome back, ${user.name}! Your saved session has been loaded. Choose what you would like to work on today.`,
  });

  setState((prev) => ({
    ...prev,
    step: "MAIN_CHOICE",
    answers: {
      ...savedAnswers,
      ...savedRoutine,
      ...prev.answers,
    },
  }));

  showMainOptions();
};

const updateSavedSession = () => {
  setShowSavedSessionReview(false);

  addMessage({
    sender: "bot",
    text: `Sure, ${user.name}. Your previous routine is pre-filled below. Update anything that has changed and save it.`,
  });

  addMessage({
    sender: "bot",
    text: "Please update your daily schedule.",
    type: "routine",
  });

  setState((prev) => ({
    ...prev,
    step: "COLLECTING_ROUTINE",
    currentQuestionIndex: 0,
    answers: {
      ...savedAnswers,
      ...savedRoutine,
    },
  }));
};

useEffect(() => {
  if (!hasSavedSession) {
    handleStart();
  }
  // Initial decision only. Saved users see the review screen first.
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, []);

if (showSavedSessionReview) {
  return (
    <SavedSessionReview
      user={user}
      onContinue={continueSavedSession}
      onUpdate={updateSavedSession}
    />
  );
}

  return (
    <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4">
      <div className="w-full max-w-2xl bg-white h-[90vh] rounded-[2.5rem] shadow-2xl flex flex-col overflow-hidden border border-white">
        
        <div className="bg-indigo-600 p-6 flex items-center gap-4 text-white shadow-lg relative z-10">
          
          <div>
            <div className="w-[200px] h-12  rounded-full flex items-center justify-center overflow-hidden">
            <img src={logo} alt="Student Shield" className="w-full h-full object-cover" />
          </div>
            {/* <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center overflow-hidden">
              <img src={logo} alt="Student Shield" className="w-full h-full object-cover" />
              </div> */}
            <p className="text-indigo-100 text-xs font-bold ml-8 opacity-80 uppercase tracking-widest">Mentor & Friend</p>
          </div>
          {!isAutoLogin && (
  <button
    onClick={onLogout}
    className="ml-auto text-xs bg-indigo-700 px-3 py-1 rounded-lg hover:bg-indigo-800 transition"
  >
    Logout
  </button>
)}
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
                        onClick={() => void handleChoice(opt)}
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
  initialValues={{
    ...savedAnswers,
    ...savedRoutine,
  }}
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
              onKeyDown={async (e) => {
  if (e.key === 'Enter' && userInput) {
    const value = userInput;
    setUserInput('');
    await handleChoice(value);
  }
}}
              className="flex-1 px-6 py-4 rounded-2xl bg-slate-50 border border-slate-200 outline-none focus:border-indigo-400 font-bold"
            />
            <button 
              onClick={async () => {
  if (userInput) {
    const value = userInput;
    setUserInput('');
    await handleChoice(value);
  }
}}
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
        className="w-full p-3 rounded-xl bg-white border border-slate-200 text-xs font-bold outline-none focus:border-indigo-500 text-slate-700 appearance-none cursor-pointer"
      >
        <option value="">Select Time</option>
        {TIME_OPTIONS.map(t => <option key={t} value={t}>{t}</option>)}
      </select>
      <i className="fa-solid fa-clock absolute right-3 top-3.5 text-slate-300 pointer-events-none"></i>
    </div>
  </div>
);

// --- New Sub-Component for Dynamic Activities ---

const DynamicActivityRow: React.FC<{
  label: string,
  activities: { name: string, start: string, end: string }[],
  onAdd: () => void,
  onChange: (index: number, field: string, value: string) => void,
  placeholder: string
}> = ({ label, activities, onAdd, onChange, placeholder }) => (
  <div className="space-y-2 mb-4">
    <div className="flex justify-between items-center px-1">
      <label className="text-[10px] font-extrabold text-slate-500 uppercase tracking-wider">{label}</label>
      <button 
        onClick={onAdd}
        className="flex items-center gap-1 px-2 py-1 bg-indigo-50 text-indigo-600 rounded-lg hover:bg-indigo-600 hover:text-white transition-all group"
      >
        <span className="text-[10px] font-bold">Add</span>
        <i className="fa-solid fa-plus text-[10px]"></i>
      </button>
    </div>
    
    {activities.map((act, idx) => (
      <div key={idx} className="flex gap-2 items-center animate-in fade-in slide-in-from-top-1">
        <div className="flex-[2]">
          <input 
            type="text" 
            placeholder={placeholder} 
            value={act.name} 
            onChange={e => onChange(idx, 'name', e.target.value)} 
            className="w-full p-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs font-bold outline-none focus:border-indigo-500 transition-colors"
          />
        </div>
        <div className="flex-1">
          <select 
            value={act.start} 
            onChange={e => onChange(idx, 'start', e.target.value)}
            className="w-full p-2.5 rounded-xl bg-white border border-slate-200 text-[10px] font-bold outline-none focus:ring-1 focus:ring-indigo-500 appearance-none cursor-pointer"
          >
            <option value="">Start</option>
            {TIME_OPTIONS.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
        <div className="flex-1">
          <select 
            value={act.end} 
            onChange={e => onChange(idx, 'end', e.target.value)}
            className="w-full p-2.5 rounded-xl bg-white border border-slate-200 text-[10px] font-bold outline-none focus:ring-1 focus:ring-indigo-500 appearance-none cursor-pointer"
          >
            <option value="">End</option>
            {TIME_OPTIONS.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
      </div>
    ))}
  </div>
);

const RoutineForm: React.FC<{
  onSubmit: (d: Record<string, string>) => void;
  isPreSchool: boolean;
  initialValues?: Record<string, string>;
}> = ({ onSubmit, isPreSchool, initialValues = {} }) => {
  const [schoolStart = "", schoolEnd = ""] = String(
  initialValues.schoolHours || ""
)
  .split(/\s+to\s+/i)
  .map((value) => value.trim());

const [base, setBase] = useState({
  wakeUp: initialValues.wakeUp || "",
  lunchTime: initialValues.lunchTime || "",
  dinnerTime: initialValues.dinnerTime || "",
  bedTime: initialValues.bedTime || "",
});

const [savedSchoolStart, setSchoolStart] = useState(schoolStart);
const [savedSchoolEnd, setSchoolEnd] = useState(schoolEnd);

  // Dynamic States for multiple activities
  const [afterSchool, setAfterSchool] = useState([{ name: '', start: '', end: '' }]);
  const [tuition, setTuition] = useState([{ name: '', start: '', end: '' }]);
  const [evening, setEvening] = useState([{ name: '', start: '', end: '' }]);

  const handleAdd = (setter: any) => setter((prev: any) => [...prev, { name: '', start: '', end: '' }]);
  
  const handleChange = (setter: any, index: number, field: string, value: string) => {
    setter((prev: any) => prev.map((item: any, i: number) => i === index ? { ...item, [field]: value } : item));
  };

  const formatActivities = (list: { name: string, start: string, end: string }[]) => {
    return list
      .filter(a => a.name.trim() !== '')
      .map(a => `${a.name} (${a.start} - ${a.end})`)
      .join(', ');
  };

  const handleSubmit = () => {
    const submissionData = {
      wakeUp: base.wakeUp,
      schoolHours: `${savedSchoolStart} to ${savedSchoolEnd}`,
      lunchTime: base.lunchTime,
      napRoutine: isPreSchool ? formatActivities(afterSchool) : '',
      afterSchool: !isPreSchool ? formatActivities(afterSchool) : '',
      tuitionTime: formatActivities(tuition),
      eveningActivity: formatActivities(evening),
      dinnerTime: base.dinnerTime,
      bedTime: base.bedTime
    };
    onSubmit(submissionData);
  };

  const isComplete = base.wakeUp && schoolStart && schoolEnd && base.lunchTime && base.dinnerTime && base.bedTime;
const ROUTINE_FIELDS = [
  "wakeUp",
  "schoolHours",
  "lunchTime",
  "napRoutine",
  "afterSchool",
  "tuitionTime",
  "eveningActivity",
  "dinnerTime",
  "bedTime",
];

const getRoutineOnly = (source: Record<string, any>) =>
  ROUTINE_FIELDS.reduce((result, key) => {
    if (source[key] !== undefined && source[key] !== null) {
      result[key] = source[key];
    }

    return result;
  }, {} as Record<string, string>);
  return (
    <div className="mt-4 pb-4">
      <div className="grid grid-cols-2 gap-3 mb-4">
        <TimeSelect label="Wake Up Time" value={base.wakeUp} onChange={v => setBase({...base, wakeUp: v})} />
        <TimeSelect label="Bed Time" value={base.bedTime} onChange={v => setBase({...base, bedTime: v})} />
      </div>
      
      <div className="mb-4">
        <label className="block text-[10px] font-extrabold text-slate-500 uppercase mb-2 px-1">School Hours</label>
        <div className="grid grid-cols-2 gap-3">
          <select value={savedSchoolStart}
onChange={(e) => setSchoolStart(e.target.value)} className="w-full p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs font-bold outline-none focus:border-indigo-500 cursor-pointer">
            <option value="">Start</option>
            {TIME_OPTIONS.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
          <select value={savedSchoolEnd}
onChange={(e) => setSchoolEnd(e.target.value)} className="w-full p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs font-bold outline-none focus:border-indigo-500 cursor-pointer">
            <option value="">End</option>
            {TIME_OPTIONS.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 mb-6">
        <TimeSelect label="Lunch Time" value={base.lunchTime} onChange={v => setBase({...base, lunchTime: v})} />
        <TimeSelect label="Dinner Time" value={base.dinnerTime} onChange={v => setBase({...base, dinnerTime: v})} />
      </div>

      <div className="space-y-2">
        <DynamicActivityRow 
          label={isPreSchool ? "Nap or Afternoon Rest?" : "After School Activity?"}
          activities={afterSchool}
          onAdd={() => handleAdd(setAfterSchool)}
          onChange={(idx, f, v) => handleChange(setAfterSchool, idx, f, v)}
          placeholder="Activity name..."
        />

        <DynamicActivityRow 
          label="Tuition / Coaching?"
          activities={tuition}
          onAdd={() => handleAdd(setTuition)}
          onChange={(idx, f, v) => handleChange(setTuition, idx, f, v)}
          placeholder="Subject/Class..."
        />

        <DynamicActivityRow 
          label="Evening Activity"
          activities={evening}
          onAdd={() => handleAdd(setEvening)}
          onChange={(idx, f, v) => handleChange(setEvening, idx, f, v)}
          placeholder="Play/Hobbies..."
        />
      </div>

      <button 
        disabled={!isComplete}
        onClick={handleSubmit}
        className="w-full py-4 mt-6 bg-indigo-600 text-white rounded-2xl font-black text-sm hover:bg-indigo-700 transition-all disabled:opacity-50 shadow-lg shadow-indigo-100 uppercase tracking-widest"
      >
        Confirm Routine
      </button>
    </div>
  );
};

const App: React.FC = () => {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [isAutoLogin, setIsAutoLogin] = useState(false);
  const [booting, setBooting] = useState(true);
  const [bootError, setBootError] = useState('');

  const setCurrentUser = (u: UserProfile | null, autoLogin = false) => {
    setUser(u);
    setIsAutoLogin(autoLogin);

    if (u && !autoLogin) {
      localStorage.setItem('smart_buddy_active_user', JSON.stringify(u));
    } else {
      localStorage.removeItem('smart_buddy_active_user');
    }
  };

  useEffect(() => {
    const bootstrap = async () => {
      try {
        const params = new URLSearchParams(window.location.search);
        const launchToken = params.get('launch_token');

        if (launchToken) {
          const session = await exchangeSmartBuddyLaunchToken(launchToken);
          const nextUser = buildUserFromSmartBuddySession(session);

          window.history.replaceState(
            {},
            document.title,
            window.location.pathname
          );

          setCurrentUser(nextUser, true);
          return;
        }

        const existingSessionToken = sessionStorage.getItem(
          'smart_buddy_session_token'
        );

        if (existingSessionToken) {
          const profile = await getSmartBuddyProfile(existingSessionToken);

          const nextUser = buildUserFromSmartBuddySession({
            ...profile,
            session_token: existingSessionToken,
          });

          setCurrentUser(nextUser, true);
          return;
        }

        const savedUser = localStorage.getItem('smart_buddy_active_user');

        if (savedUser) {
          try {
            setCurrentUser(JSON.parse(savedUser), false);
          } catch {
            localStorage.removeItem('smart_buddy_active_user');
          }
        }
      } catch (error: any) {
        console.error('Smart Buddy bootstrap failed:', error);
        sessionStorage.removeItem('smart_buddy_session_token');
        setBootError(
          error?.message ||
            'Smart Buddy session expired. Please open it again from Student Shield.'
        );
      } finally {
        setBooting(false);
      }
    };

    bootstrap();
  }, []);

  const getUsers = () => {
    const stored = localStorage.getItem('smart_buddy_users');
    return stored ? JSON.parse(stored) : {};
  };

  const updateUser = (updatedUser: UserProfile) => {
    if (isAutoLogin) {
      setUser(updatedUser);
      return;
    }

    const users = getUsers();
    users[updatedUser.phone] = updatedUser;
    localStorage.setItem('smart_buddy_users', JSON.stringify(users));
    setCurrentUser(updatedUser, false);
  };

  const handleLogout = async () => {
    if (user?.sessionToken) {
      await logoutSmartBuddySession(user.sessionToken);
    }

    setCurrentUser(null, false);
  };

  if (booting) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4">
        <div className="bg-white rounded-3xl shadow-xl p-8 text-center">
          <div className="w-10 h-10 border-4 border-indigo-100 border-t-indigo-600 rounded-full animate-spin mx-auto mb-4" />
          <p className="font-bold text-slate-700">Opening Smart Buddy...</p>
        </div>
      </div>
    );
  }

  if (bootError && !user) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4">
        <div className="bg-white rounded-3xl shadow-xl p-8 max-w-md text-center">
          <h1 className="text-xl font-black text-slate-800 mb-2">
            Session Error
          </h1>

          <p className="text-sm text-slate-500 mb-6">{bootError}</p>

          <button
            onClick={() => {
              setBootError('');
              window.location.href =
                import.meta.env.VITE_STUDENT_SHIELD_APP_URL ||
                'https://student-shield-frontend.vercel.app/student/smart-buddy';
            }}
            className="px-6 py-3 rounded-xl bg-indigo-600 text-white font-bold"
          >
            Back to Student Shield
          </button>
        </div>
      </div>
    );
  }

  return (
    <>
      {!user ? (
        <AuthScreen onLogin={(u) => setCurrentUser(u, false)} />
      ) : (
        <ChatScreen
          user={user}
          isAutoLogin={isAutoLogin}
          onLogout={handleLogout}
          onUpdateUser={updateUser}
        />
      )}
    </>
  );
};

export default App;

