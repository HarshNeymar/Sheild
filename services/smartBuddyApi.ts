export type SmartBuddySessionResponse = {
  session_token: string;
  expires_at: string;
  student: any;
  school: any;
  saved_profile: {
    form_data: Record<string, any>;
    assessment_data: Record<string, any>;
    created_at: string | null;
    updated_at: string | null;
  };
};

const API_BASE_URL =
  import.meta.env.VITE_STUDENT_SHIELD_API_URL ||
  import.meta.env.VITE_API_BASE_URL ||
  "http://localhost:5000";

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

  return data;
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

  sessionStorage.setItem("smart_buddy_session_token", data.session_token);

  return data;
}

export function getSmartBuddyProfile(sessionToken?: string) {
  return smartBuddyRequest<SmartBuddySessionResponse>(
    "/api/smart-buddy/profile",
    {},
    sessionToken
  );
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