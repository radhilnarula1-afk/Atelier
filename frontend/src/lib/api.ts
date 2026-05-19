const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:8000";

let token = localStorage.getItem("token") || "";

export const setToken = (newToken: string) => {
  token = newToken;
  localStorage.setItem("token", token);
};

const getHeaders = (isJson = true) => {
  const headers: Record<string, string> = {
    "Authorization": `Bearer ${token}`
  };
  if (isJson) headers["Content-Type"] = "application/json";
  return headers;
};

export const api = {
  login: async (creds: any) => {
    const res = await fetch(`${API_BASE}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(creds)
    });
    if (!res.ok) throw new Error("Login failed");
    return res.json();
  },

  register: async (creds: any) => {
    const res = await fetch(`${API_BASE}/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(creds)
    });
    if (!res.ok) throw new Error("Registration failed");
    return res.json();
  },

  googleLogin: async (idToken: string) => {
    const res = await fetch(`${API_BASE}/auth/google`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id_token: idToken })
    });
    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData.detail || "Google Login failed");
    }
    return res.json();
  },

  getProfile: async () => {
    const res = await fetch(`${API_BASE}/auth/profile`, {
      headers: getHeaders()
    });
    if (!res.ok) throw new Error("Failed to get profile");
    return res.json();
  },

  updateProfile: async (name: string) => {
    const res = await fetch(`${API_BASE}/auth/profile`, {
      method: "POST",
      headers: getHeaders(),
      body: JSON.stringify({ name })
    });
    if (!res.ok) throw new Error("Failed to update profile");
    return res.json();
  },

  addToInventory: async (item: any) => {
    const res = await fetch(`${API_BASE}/inventory/add`, {
      method: "POST",
      headers: getHeaders(),
      body: JSON.stringify(item),
    });
    if (!res.ok) throw new Error("Failed to add to inventory");
    return res.json();
  },

  getInventory: async () => {
    const res = await fetch(`${API_BASE}/inventory`, { headers: getHeaders() });
    if (!res.ok) throw new Error("Failed to get inventory");
    return res.json();
  },

  deleteInventoryItem: async (itemId: number) => {
    const res = await fetch(`${API_BASE}/inventory/${itemId}`, {
      method: "DELETE",
      headers: getHeaders()
    });
    if (!res.ok) throw new Error("Failed to delete inventory item");
    return res.json();
  },

  uploadToWardrobe: async (file: File) => {
    const formData = new FormData();
    formData.append("file", file);
    const res = await fetch(`${API_BASE}/inventory/upload`, {
      method: "POST",
      headers: getHeaders(false),
      body: formData
    });
    if (!res.ok) throw new Error("Upload failed");
    return res.json();
  },

  addCalendarEntry: async (files: File[] | File | null, date: string, location: string, mood: string, notes: string, wardrobeItemId?: number) => {
    const formData = new FormData();
    if (files) {
      if (Array.isArray(files)) {
        files.forEach(f => formData.append("files", f));
      } else {
        formData.append("files", files);
      }
    }
    formData.append("date", date);
    formData.append("location", location);
    formData.append("mood", mood);
    formData.append("notes", notes);
    if (wardrobeItemId) formData.append("wardrobe_item_id", wardrobeItemId.toString());

    const res = await fetch(`${API_BASE}/calendar/add`, {
      method: "POST",
      headers: getHeaders(false),
      body: formData
    });
    if (!res.ok) throw new Error("Failed to add calendar entry");
    return res.json();
  },

  deleteCalendarEntry: async (entryId: number) => {
    const res = await fetch(`${API_BASE}/calendar/${entryId}`, {
      method: "DELETE",
      headers: getHeaders()
    });
    if (!res.ok) throw new Error("Failed to delete calendar entry");
    return res.json();
  },

  getCalendar: async () => {
    const res = await fetch(`${API_BASE}/calendar`, { headers: getHeaders() });
    if (!res.ok) throw new Error("Failed to get calendar");
    return res.json();
  },

  recommendDaily: async (location: string, mood: string, selectedItemIds: number[] = []) => {
    const res = await fetch(`${API_BASE}/recommend_daily`, {
      method: "POST",
      headers: getHeaders(),
      body: JSON.stringify({ location, mood, selected_item_ids: selectedItemIds })
    });
    if (!res.ok) throw new Error("Recommendation failed. Maybe your wardrobe is empty?");
    return res.json();
  },

  recommendForItem: async (itemId: number) => {
    const res = await fetch(`${API_BASE}/inventory/recommend/${itemId}`, { headers: getHeaders() });
    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData.detail || "Failed to get recommendations for item");
    }
    return res.json();
  },

  getImageUrl: (path: string) => {
    if (!path) return "";
    // Cloudinary and other full URLs work fine
    if (path.startsWith("http") || path.startsWith("data:")) return path;
    // Local /uploads/ paths are ephemeral — wiped on every Render redeploy. Return empty so fallback shows.
    if (path.startsWith("/uploads/") || path.startsWith("uploads/")) return "";
    return `${API_BASE}${path.startsWith('/') ? path : '/' + path}`;
  }
};
