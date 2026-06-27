export type SmartBuddyStudent = {
  id?: string;
  full_name?: string;
  email?: string;
  school_id?: string;
  class_assigned?: string;
  parent_phone?: string;
  age?: string | number | null;
};

export type SmartBuddySchool = {
  id?: string;
  name?: string;
  selected_plan_tier?: string;
};

export type SmartBuddySavedProfile = {
  form_data: Record<string, any>;
  assessment_data: Record<string, any>;
  created_at: string | null;
  updated_at: string | null;
};

export type SmartBuddySessionResponse = {
  session_token: string;
  expires_at: string;
  student: SmartBuddyStudent;
  school: SmartBuddySchool;
  saved_profile: SmartBuddySavedProfile;
};

const API_BASE_URL = (
  import.meta.env.VITE_STUDENT_SHIELD_API_URL ||
  import.meta.env.VITE_API_BASE_URL ||
  "http://localhost:5000"
).replace(/\/+$/, "");

const emptySavedProfile = (): SmartBuddySavedProfile => ({
  form_data: {},
  assessment_data: {},
  created_at: null,
  updated_at: null,
});

function normalizeSmartBuddyResponse(
  data: any,
  sessionToken = ""
): SmartBuddySessionResponse {
  // Session API returns { session_token, expires_at, profile: {...} }
  // Profile API may return either { profile: {...} } or {...}
  const profile = data?.profile ?? data ?? {};
  const savedProfile = profile?.saved_profile ?? emptySavedProfile();

  return {
    session_token:
      data?.session_token ||
      sessionToken ||
      sessionStorage.getItem("smart_buddy_session_token") ||
      "",

    expires_at: data?.expires_at ?? "",

    student: profile?.student ?? {},
    school: profile?.school ?? {},

    saved_profile: {
      ...emptySavedProfile(),
      ...savedProfile,
      form_data: savedProfile?.form_data ?? {},
      assessment_data: savedProfile?.assessment_data ?? {},
    },
  };
}

async function smartBuddyRequest<T>(
  path: string,
  options: RequestInit = {},
  sessionToken?: string
): Promise<T> {
  const token =
    sessionToken || sessionStorage.getItem("smart_buddy_session_token");

  if (!token) {
    throw new Error("Smart Buddy session missing");
  }

  const res = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(options.body instanceof FormData
        ? {}
        : { "Content-Type": "application/json" }),
      ...(options.headers || {}),
    },
  });

  const data = await res.json().catch(() => null);

  if (!res.ok) {
    throw new Error(data?.error || "Smart Buddy request failed");
  }

  return data as T;
}

export async function exchangeSmartBuddyLaunchToken(
  launchToken: string
): Promise<SmartBuddySessionResponse> {
  const res = await fetch(`${API_BASE_URL}/api/smart-buddy/session`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      launch_token: launchToken,
    }),
  });

  const data = await res.json().catch(() => null);

  if (!res.ok) {
    throw new Error(data?.error || "Unable to start Smart Buddy session");
  }

  const normalized = normalizeSmartBuddyResponse(data);

  if (!normalized.session_token) {
    throw new Error("Smart Buddy session token was not returned");
  }

  sessionStorage.setItem(
    "smart_buddy_session_token",
    normalized.session_token
  );

  return normalized;
}

export async function getSmartBuddyProfile(
  sessionToken?: string
): Promise<SmartBuddySessionResponse> {
  const raw = await smartBuddyRequest<any>(
    "/api/smart-buddy/profile",
    {},
    sessionToken
  );

  return normalizeSmartBuddyResponse(raw, sessionToken);
}

export function saveSmartBuddyProfile(
  body: {
    form_data?: Record<string, any>;
    assessment_data?: Record<string, any>;
  },
  sessionToken?: string
) {
  return smartBuddyRequest<any>(
    "/api/smart-buddy/profile",
    {
      method: "PUT",
      body: JSON.stringify(body),
    },
    sessionToken
  );
}

export function uploadSmartBuddyReport(
  formData: FormData,
  sessionToken?: string
) {
  return smartBuddyRequest<any>(
    "/api/smart-buddy/reports",
    {
      method: "POST",
      body: formData,
    },
    sessionToken
  );
}

export async function logoutSmartBuddySession(sessionToken?: string) {
  try {
    await smartBuddyRequest(
      "/api/smart-buddy/session/logout",
      {
        method: "POST",
      },
      sessionToken
    );
  } finally {
    sessionStorage.removeItem("smart_buddy_session_token");
  }
}