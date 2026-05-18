import { useEffect, useState, useRef } from "react";
import { useTheme } from "next-themes";
import { api, setToken } from "@/lib/api";
import { toast } from "sonner";
import { Sun, Moon, Cloud, CloudRain, Snowflake, Thermometer, MapPin, Calendar as CalIcon, Image as ImageIcon, X, Sparkles, ExternalLink, Loader2, ArrowUpRight, ShoppingBag, Plus, ChevronLeft, ChevronRight, Check, CheckCircle2, Settings, Filter, Trash2 } from "lucide-react";
import AtelierLogo from "@/components/AtelierLogo";

const getImagesArray = (imagePath: string): string[] => {
  if (!imagePath) return [];
  try {
    const trimmed = imagePath.trim();
    if (trimmed.startsWith("[") && trimmed.endsWith("]")) {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch (e) {
    // Ignore and fallback
  }
  if (imagePath.includes(",")) {
    return imagePath.split(",");
  }
  return [imagePath];
};


export default function Index() {
  const [isAuthenticated, setIsAuth] = useState(!!localStorage.getItem("token"));
  const [activeTab, setActiveTab] = useState("home"); // 'home', 'calendar', 'wardrobe', 'recommend'
  const [username, setUsername] = useState(localStorage.getItem("username") || "Stylist");
  const { theme, setTheme } = useTheme();

  useEffect(() => {
    document.title = "Atelier — Wardrobe Intelligence";
    if (isAuthenticated) {
      setUsername(localStorage.getItem("username") || "Stylist");
    }
  }, [isAuthenticated]);

  if (!isAuthenticated) {
    return <AuthScreen onAuth={() => setIsAuth(true)} />;
  }

  return (
    <main className="min-h-screen bg-background text-foreground pb-20">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-background/80 backdrop-blur-md border-b border-border/40">
        <div className="max-w-6xl mx-auto px-6 h-20 flex items-center justify-between">
          <div 
            onClick={() => setActiveTab("home")}
            className="cursor-pointer hover:opacity-85 transition-all duration-300 flex items-center"
          >
            <AtelierLogo width={105} height={70} showFrame={true} />
          </div>
          <div className="flex gap-6">
            {["home", "calendar", "wardrobe", "recommend"].map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`text-sm uppercase tracking-[0.15em] transition-colors relative py-1 ${
                  activeTab === tab ? "text-foreground font-semibold" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {tab}
                {activeTab === tab && (
                  <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-foreground rounded-full animate-fade-in" />
                )}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-6">
            <button
              onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
              className="p-2 rounded-full hover:bg-secondary/50 transition-colors text-muted-foreground hover:text-foreground flex items-center justify-center"
              title="Toggle Theme"
              aria-label="Toggle theme"
            >
              {theme === "dark" ? <Sun size={18} /> : <Moon size={18} />}
            </button>
            <button
              onClick={() => { setToken(""); localStorage.removeItem("username"); setIsAuth(false); }}
              className="text-sm border-b border-foreground/30 pb-0.5 hover:border-foreground transition"
            >
              Sign out
            </button>
          </div>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-6 pt-16">
        {activeTab === "home" && <HomeView onNavigate={(tab) => setActiveTab(tab)} />}
        {activeTab === "calendar" && <CalendarView />}
        {activeTab === "recommend" && <RecommendView />}
        {activeTab === "wardrobe" && <WardrobeView />}
      </div>
    </main>
  );
}

// ─── AUTH SCREEN ────────────────────────────────────────────────────────────

function AuthScreen({ onAuth }: { onAuth: () => void }) {
  const [isLogin, setIsLogin] = useState(true);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (isLogin) {
        const res = await api.login({ username, password });
        setToken(res.token);
        localStorage.setItem("username", res.username);
        toast.success(`Welcome back, ${res.username}`);
      } else {
        const res = await api.register({ username, password });
        setToken(res.token);
        localStorage.setItem("username", res.username);
        toast.success(`Account created, ${res.username}!`);
      }
      onAuth();
    } catch (err: any) {
      toast.error(err.message || "Authentication failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-surface grain px-6">
      <div className="w-full max-w-md p-10 bg-background rounded-sm shadow-editorial border border-border/40">
        <div className="flex flex-col items-center mb-8">
          <AtelierLogo width={220} height={140} showFrame={true} className="mb-4" />
          <p className="text-muted-foreground text-sm text-center">
            A quiet intelligence for the way you dress.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground block mb-2">Username</label>
            <input
              type="text"
              required
              className="w-full bg-surface border border-border px-4 py-3 text-sm focus:outline-none focus:border-foreground transition"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
            />
          </div>
          <div>
            <label className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground block mb-2">Password</label>
            <input
              type="password"
              required
              className="w-full bg-surface border border-border px-4 py-3 text-sm focus:outline-none focus:border-foreground transition"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-foreground text-background py-3.5 text-sm uppercase tracking-[0.1em] hover:bg-foreground/90 transition disabled:opacity-50"
          >
            {loading ? "Processing..." : isLogin ? "Sign In" : "Create Account"}
          </button>
        </form>

        <div className="mt-6 text-center">
          <button
            onClick={() => setIsLogin(!isLogin)}
            className="text-xs text-muted-foreground hover:text-foreground transition underline underline-offset-4"
          >
            {isLogin ? "Need an account? Sign up" : "Already have an account? Sign in"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── CALENDAR VIEW ──────────────────────────────────────────────────────────

function CalendarView() {
  const [history, setHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [logModalOpen, setLogModalOpen] = useState(false);
  const [selectedEntry, setSelectedEntry] = useState<any | null>(null);

  const fetchHistory = async () => {
    try {
      const res = await api.getCalendar();
      setHistory(res.calendar || []);
    } catch (e) {
      toast.error("Failed to load calendar logs");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHistory();
  }, []);

  const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  const weekdays = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

  const year = currentMonth.getFullYear();
  const month = currentMonth.getMonth();

  // Generate calendar days
  const firstDayOfMonth = new Date(year, month, 1).getDay(); // 0 = Sun, 1 = Mon ...
  const paddingDays = firstDayOfMonth === 0 ? 6 : firstDayOfMonth - 1; // Adjust Mon=0
  const daysInCurrentMonth = new Date(year, month + 1, 0).getDate();
  const daysInPrevMonth = new Date(year, month, 0).getDate();

  const cells: { day: number; dateString: string; isCurrentMonth: boolean }[] = [];

  // Previous month padding
  for (let i = paddingDays - 1; i >= 0; i--) {
    const d = daysInPrevMonth - i;
    const prevMonthIndex = month === 0 ? 11 : month - 1;
    const prevYear = month === 0 ? year - 1 : year;
    cells.push({
      day: d,
      dateString: `${prevYear}-${String(prevMonthIndex + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`,
      isCurrentMonth: false
    });
  }

  // Current month
  for (let d = 1; d <= daysInCurrentMonth; d++) {
    cells.push({
      day: d,
      dateString: `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`,
      isCurrentMonth: true
    });
  }

  // Next month padding
  const remaining = 42 - cells.length;
  for (let d = 1; d <= remaining; d++) {
    const nextMonthIndex = month === 11 ? 0 : month + 1;
    const nextYear = month === 11 ? year + 1 : year;
    cells.push({
      day: d,
      dateString: `${nextYear}-${String(nextMonthIndex + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`,
      isCurrentMonth: false
    });
  }

  const nextMonth = () => {
    setCurrentMonth(new Date(year, month + 1, 1));
  };

  const prevMonth = () => {
    setCurrentMonth(new Date(year, month - 1, 1));
  };

  const handleCellClick = (cell: any) => {
    const matchedEntries = history.filter(entry => entry.date === cell.dateString);
    if (matchedEntries.length > 0) {
      setSelectedEntry(matchedEntries[0]);
    } else {
      setSelectedDate(cell.dateString);
      setLogModalOpen(true);
    }
  };

  const todayStr = new Date().toISOString().split('T')[0];

  return (
    <div className="animate-fade-in">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-12">
        <div>
          <div className="text-xs uppercase tracking-[0.2em] text-muted-foreground mb-4">— Outfit Journal</div>
          <h2 className="font-display text-5xl">Your Calendar</h2>
        </div>
        
        {/* Navigation & Add Button */}
        <div className="flex items-center gap-4">
          <div className="flex items-center bg-surface border border-border/40 rounded-full px-4 py-2 shadow-soft">
            <button onClick={prevMonth} className="p-1 hover:text-accent transition-colors"><ChevronLeft size={18} /></button>
            <span className="font-display text-lg px-4 text-center min-w-[140px]">
              {monthNames[month]} {year}
            </span>
            <button onClick={nextMonth} className="p-1 hover:text-accent transition-colors"><ChevronRight size={18} /></button>
          </div>
          <button 
            onClick={() => { setSelectedDate(todayStr); setLogModalOpen(true); }}
            className="bg-foreground text-background px-6 py-3 rounded-full text-sm font-medium hover:bg-foreground/90 transition flex items-center gap-2 shadow-soft"
          >
            <Plus size={16} /> Log Outfit
          </button>
        </div>
      </div>

      {/* Grid Calendar */}
      <div className="bg-surface rounded-sm border border-border/40 overflow-hidden shadow-soft mb-16">
        {/* Weekday Labels */}
        <div className="grid grid-cols-7 border-b border-border/40 bg-muted/30">
          {weekdays.map(day => (
            <div key={day} className="py-4 text-center text-xs uppercase tracking-widest text-muted-foreground font-semibold">
              {day}
            </div>
          ))}
        </div>

        {/* Days Grid */}
        <div className="grid grid-cols-7 gap-[1px] bg-border/40">
          {cells.map((cell, idx) => {
            const dateEntries = history.filter(entry => entry.date === cell.dateString);
            const hasOutfit = dateEntries.length > 0;
            const entry = dateEntries[0];
            const isToday = cell.dateString === todayStr;

            return (
              <div 
                key={idx}
                onClick={() => handleCellClick(cell)}
                className={`aspect-square bg-background relative cursor-pointer group transition-all duration-300 ${
                  cell.isCurrentMonth ? "text-foreground" : "text-muted-foreground/40"
                } ${hasOutfit ? "hover:scale-[1.01] hover:z-10 shadow-soft" : "hover:bg-surface"}`}
              >
                {hasOutfit ? (
                  /* Cell with outfit */
                  <div className="absolute inset-0 w-full h-full overflow-hidden">
                    <img 
                      src={api.getImageUrl(getImagesArray(entry.image_path)[0])} 
                      alt="Outfit Log" 
                      className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                    />
                    <div className="absolute inset-0 bg-black/30 group-hover:bg-black/60 transition-colors duration-300 flex flex-col justify-between p-3 text-white">
                      <div className="flex justify-between items-start">
                        <span className={`text-xs px-2 py-0.5 rounded-full backdrop-blur-md ${isToday ? "bg-accent text-accent-foreground font-bold" : "bg-black/40"}`}>
                          {cell.day}
                        </span>
                        <div className="flex flex-col gap-1 items-end">
                          {getImagesArray(entry.image_path).length > 1 && (
                            <span className="text-[9px] bg-background/80 backdrop-blur-sm text-background px-1.5 py-0.5 rounded-full font-bold flex items-center gap-1">
                              <ImageIcon size={8} /> {getImagesArray(entry.image_path).length}
                            </span>
                          )}
                          {dateEntries.length > 1 && (
                            <span className="text-[9px] bg-accent text-accent-foreground px-1.5 py-0.5 rounded-full font-bold">
                              +{dateEntries.length - 1}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="opacity-0 group-hover:opacity-100 transition-opacity duration-300 text-left">
                        <div className="text-[10px] uppercase tracking-wider font-semibold truncate capitalize">
                          {entry.labels?.color} {entry.labels?.type}
                        </div>
                        <div className="text-[9px] text-white/80 mt-0.5 flex items-center gap-1">
                          <MapPin size={8} /> {entry.location || "Cozy Vibe"}
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  /* Empty cell */
                  <div className="absolute inset-0 p-3 flex flex-col justify-between items-start">
                    <span className={`text-xs font-semibold w-6 h-6 flex items-center justify-center rounded-full ${
                      isToday ? "bg-foreground text-background font-bold shadow-soft" : ""
                    }`}>
                      {cell.day}
                    </span>
                    <div className="opacity-0 group-hover:opacity-100 transition-all duration-300 self-center mb-4 text-muted-foreground/60">
                      <Plus size={18} />
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Grid List Journal Feed underneath */}
      <div className="mt-16">
        <h3 className="font-display text-3xl mb-8">Journal History</h3>
        {loading ? (
          <div className="text-muted-foreground flex items-center gap-2"><Loader2 className="animate-spin" size={16} /> Loading journal feed...</div>
        ) : history.length === 0 ? (
          <div className="py-20 text-center border border-dashed border-border/50 text-muted-foreground">
            No outfits logged yet. Click any date on the calendar grid to write your first log.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {history.slice(0, 6).map((entry) => (
              <div 
                key={entry.id} 
                onClick={() => setSelectedEntry(entry)}
                className="group bg-surface rounded-sm overflow-hidden border border-border/40 shadow-soft hover:shadow-lift transition-all duration-300 cursor-pointer"
              >
                <div className="h-64 overflow-hidden relative bg-muted border-b border-border/20">
                  <img src={api.getImageUrl(getImagesArray(entry.image_path)[0])} alt="Outfit" className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" />
                  <div className="absolute top-3 left-3 bg-background/90 backdrop-blur px-3 py-1.5 text-xs font-medium rounded-full flex items-center gap-2 border border-border/20 shadow-soft">
                    <CalIcon size={14} /> {entry.date}
                  </div>
                  {getImagesArray(entry.image_path).length > 1 && (
                    <div className="absolute top-3 right-3 bg-background/90 backdrop-blur px-2.5 py-1.5 text-[10px] font-bold rounded-full flex items-center gap-1.5 border border-border/20 shadow-soft text-foreground z-10">
                      <ImageIcon size={12} className="text-muted-foreground" /> {getImagesArray(entry.image_path).length} Photos
                    </div>
                  )}
                </div>
                <div className="p-5">
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1">
                        <MapPin size={12} /> {entry.location || "Unknown location"}
                      </div>
                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <Thermometer size={12} /> {entry.weather} {entry.temperature ? `(${entry.temperature}°C)` : ""}
                      </div>
                    </div>
                    {entry.mood && (
                      <span className="text-[10px] uppercase tracking-[0.1em] px-2.5 py-1 border border-border rounded-full bg-background font-medium">
                        {entry.mood}
                      </span>
                    )}
                  </div>
                  <div className="text-sm capitalize font-semibold tracking-wide flex items-center gap-1">
                    {entry.labels?.color || "Neutral"} {entry.labels?.type || "Garment"}
                    <span className="text-muted-foreground font-normal text-xs">• {entry.labels?.fit || "regular"} fit</span>
                  </div>
                  {entry.notes && (
                    <p className="text-xs text-muted-foreground line-clamp-2 mt-2 italic">"{entry.notes}"</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Log Outfit Modal popup */}
      {logModalOpen && (
        <LogOutfitModal 
          open={logModalOpen}
          setOpen={setLogModalOpen}
          initialDate={selectedDate || todayStr} 
          onLogged={fetchHistory} 
        />
      )}

      {/* View Outfit Details Modal */}
      {selectedEntry && (
        <ViewOutfitModal 
          entry={selectedEntry} 
          onClose={() => setSelectedEntry(null)} 
          onDelete={fetchHistory}
        />
      )}
    </div>
  );
}

interface LogOutfitModalProps {
  open: boolean;
  setOpen: (open: boolean) => void;
  initialDate: string;
  onLogged: () => void;
}

function LogOutfitModal({ open, setOpen, initialDate, onLogged }: LogOutfitModalProps) {
  const [date, setDate] = useState(initialDate);
  const [location, setLocation] = useState("");
  const [mood, setMood] = useState("");
  const [notes, setNotes] = useState("");
  const [logTab, setLogTab] = useState<"upload" | "wardrobe">("upload");
  const [wardrobe, setWardrobe] = useState<any[]>([]);
  const [selectedWardrobeId, setSelectedWardrobeId] = useState<number | null>(null);
  
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const filesList = Array.from(e.target.files);
      if (filesList.length > 3) {
        toast.warning("At most 3 photos are allowed. Keeping the first 3.");
        setSelectedFiles(filesList.slice(0, 3));
      } else {
        setSelectedFiles(filesList);
      }
    }
  };

  useEffect(() => {
    setDate(initialDate);
  }, [initialDate]);

  useEffect(() => {
    if (open && logTab === "wardrobe") {
      api.getInventory().then(res => setWardrobe(res.inventory || [])).catch(() => {});
    }
  }, [open, logTab]);

  const handleUpload = async () => {
    if (logTab === "upload") {
      if (selectedFiles.length === 0) {
        return toast.error("Please select at least 1 photo.");
      }
      if (selectedFiles.length > 3) {
        return toast.error("You can select at most 3 photos.");
      }
      
      setUploading(true);
      const loadId = toast.loading("Analyzing details & saving...");
      try {
        await api.addCalendarEntry(selectedFiles, date, location, mood, notes);
        toast.dismiss(loadId);
        toast.success("Outfit logged successfully!");
        setOpen(false);
        onLogged();
      } catch (e: any) {
        toast.dismiss(loadId);
        toast.error(e.message || "Failed to log outfit");
      } finally {
        setUploading(false);
      }
    } else {
      if (!selectedWardrobeId) return toast.error("Please select a wardrobe item");
      
      setUploading(true);
      const loadId = toast.loading("Logging chosen piece...");
      try {
        await api.addCalendarEntry(null, date, location, mood, notes, selectedWardrobeId);
        toast.dismiss(loadId);
        toast.success("Wardrobe piece logged to date successfully!");
        setOpen(false);
        onLogged();
      } catch (e: any) {
        toast.dismiss(loadId);
        toast.error(e.message || "Failed to log outfit reference");
      } finally {
        setUploading(false);
      }
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center p-6 animate-fade-in">
      <div className="bg-surface p-8 max-w-lg w-full border border-border/50 shadow-editorial rounded-sm relative max-h-[90vh] overflow-y-auto">
        <button onClick={() => setOpen(false)} className="absolute top-4 right-4 text-muted-foreground hover:text-foreground">✕</button>
        <h3 className="font-display text-3xl mb-6">Log an Outfit</h3>
        
        <div className="space-y-5">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs uppercase tracking-[0.1em] text-muted-foreground mb-1 block font-semibold">Date</label>
              <input type="date" value={date} onChange={e => setDate(e.target.value)} className="w-full bg-background border border-border px-3 py-2 text-sm focus:outline-none focus:border-foreground" />
            </div>
            <div>
              <label className="text-xs uppercase tracking-[0.1em] text-muted-foreground mb-1 block font-semibold">Location (City)</label>
              <input type="text" placeholder="e.g. Mumbai, Paris" value={location} onChange={e => setLocation(e.target.value)} className="w-full bg-background border border-border px-3 py-2 text-sm focus:outline-none focus:border-foreground" />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-1">
            <label className="text-xs uppercase tracking-[0.1em] text-muted-foreground mb-1 block font-semibold">Vibe / Mood</label>
            <input type="text" placeholder="e.g. elegant, professional, street-grunge" value={mood} onChange={e => setMood(e.target.value)} className="w-full bg-background border border-border px-3 py-2 text-sm focus:outline-none focus:border-foreground" />
          </div>

          <div>
            <label className="text-xs uppercase tracking-[0.1em] text-muted-foreground mb-1 block font-semibold">Stylist Notes</label>
            <textarea placeholder="Write how you styled it, accessories, fit details..." value={notes} onChange={e => setNotes(e.target.value)} className="w-full bg-background border border-border px-3 py-2 text-sm focus:outline-none focus:border-foreground h-16 resize-none" />
          </div>

          {/* Outfit Source Selector Tabs */}
          <div className="border-t border-border/40 pt-4">
            <label className="text-xs uppercase tracking-[0.1em] text-muted-foreground mb-2 block font-semibold">Outfit Source</label>
            <div className="flex border border-border rounded-sm overflow-hidden mb-4 bg-background">
              <button 
                type="button"
                onClick={() => setLogTab("upload")}
                className={`flex-1 py-2 text-xs uppercase tracking-wider font-semibold transition-colors ${
                  logTab === "upload" ? "bg-foreground text-background" : "hover:bg-muted text-foreground"
                }`}
              >
                Upload Photo
              </button>
              <button 
                type="button"
                onClick={() => setLogTab("wardrobe")}
                className={`flex-1 py-2 text-xs uppercase tracking-wider font-semibold transition-colors ${
                  logTab === "wardrobe" ? "bg-foreground text-background" : "hover:bg-muted text-foreground"
                }`}
              >
                Select from Closet
              </button>
            </div>

            {logTab === "upload" ? (
              <div className="space-y-4">
                <div className="bg-background border border-dashed border-border p-6 rounded-sm text-center relative hover:border-foreground/30 transition-colors cursor-pointer">
                  <ImageIcon className="mx-auto text-muted-foreground/60 mb-2" size={24} />
                  <input 
                    type="file" 
                    accept="image/*" 
                    ref={fileRef} 
                    multiple 
                    onChange={handleFileChange}
                    className="text-xs text-muted-foreground focus:outline-none mx-auto block cursor-pointer" 
                  />
                  <p className="text-[10px] text-muted-foreground/60 mt-2">Upload multiple photos of your look. Atelier's neural network will parse details from the main piece.</p>
                </div>
                
                {selectedFiles.length > 0 && (
                  <div>
                    <span className="text-[10px] uppercase tracking-[0.1em] text-muted-foreground block mb-2 font-semibold">Selected Photos ({selectedFiles.length})</span>
                    <div className="flex flex-wrap gap-2">
                      {selectedFiles.map((f, i) => {
                        const url = URL.createObjectURL(f);
                        return (
                          <div key={i} className="relative w-16 h-20 border border-border/40 rounded-sm overflow-hidden bg-muted group shadow-soft">
                            <img src={url} alt={`preview-${i}`} className="w-full h-full object-cover" />
                            <button
                              type="button"
                              onClick={() => setSelectedFiles(prev => prev.filter((_, idx) => idx !== i))}
                              className="absolute inset-0 m-auto w-5 h-5 bg-background/95 rounded-full flex items-center justify-center text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition shadow-soft border border-border/20 z-10"
                            >
                              <X size={10} />
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="bg-background border border-border p-4 rounded-sm">
                {wardrobe.length === 0 ? (
                  <p className="text-xs text-muted-foreground text-center py-4">Your wardrobe is empty. Go to the "Wardrobe" section to upload clothing items first!</p>
                ) : (
                  <div className="grid grid-cols-4 gap-2 max-h-48 overflow-y-auto pr-1">
                    {wardrobe.map(item => (
                      <div 
                        key={item.id} 
                        onClick={() => setSelectedWardrobeId(item.id)}
                        className={`relative aspect-[3/4] border rounded-sm overflow-hidden cursor-pointer group transition-all ${
                          selectedWardrobeId === item.id ? "border-accent ring-2 ring-accent" : "border-border hover:border-foreground/30"
                        }`}
                      >
                        <img src={api.getImageUrl(item.image_path)} className="w-full h-full object-cover" alt={item.type} />
                        <div className="absolute inset-0 bg-black/10 group-hover:bg-black/20" />
                        {selectedWardrobeId === item.id && (
                          <div className="absolute top-1 right-1 bg-accent text-accent-foreground rounded-full p-0.5"><Check size={8} /></div>
                        )}
                        <span className="absolute bottom-0 inset-x-0 text-[8px] bg-background/80 text-foreground py-0.5 text-center font-bold capitalize truncate px-1">
                          {item.type}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
          
          <button onClick={handleUpload} disabled={uploading} className="w-full bg-foreground text-background py-3.5 mt-4 text-sm font-semibold uppercase tracking-wider hover:bg-foreground/90 transition flex items-center justify-center gap-2">
            {uploading ? (
              <>
                <Loader2 className="animate-spin" size={16} /> Saving Log...
              </>
            ) : "Save to Calendar"}
          </button>
        </div>
      </div>
    </div>
  );
}

interface ViewOutfitModalProps {
  entry: any;
  onClose: () => void;
  onDelete: () => void;
}

function ViewOutfitModal({ entry, onClose, onDelete }: ViewOutfitModalProps) {
  const [deleting, setDeleting] = useState(false);
  const images = getImagesArray(entry.image_path);
  const [currentImageIdx, setCurrentImageIdx] = useState(0);

  const handleDelete = async () => {
    if (!window.confirm("Are you sure you want to delete this outfit log from your journal?")) return;
    setDeleting(true);
    try {
      await api.deleteCalendarEntry(entry.id);
      toast.success("Outfit log deleted successfully.");
      onDelete();
      onClose();
    } catch (e: any) {
      toast.error(e.message || "Failed to delete outfit log");
    } finally {
      setDeleting(false);
    }
  };

  const handleNextImage = () => {
    setCurrentImageIdx(prev => (prev + 1) % images.length);
  };

  const handlePrevImage = () => {
    setCurrentImageIdx(prev => (prev - 1 + images.length) % images.length);
  };

  return (
    <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-md flex items-center justify-center p-4 md:p-6 animate-fade-in" onClick={onClose}>
      <div className="bg-background max-w-md w-full border border-border/50 shadow-editorial rounded-sm overflow-hidden relative" onClick={e => e.stopPropagation()}>
        <button onClick={onClose} className="absolute top-4 right-4 z-15 p-1.5 rounded-full bg-background/80 hover:bg-surface transition border border-border/40 text-muted-foreground hover:text-foreground">
          <X size={16} />
        </button>
        <div className="h-72 overflow-hidden relative bg-muted border-b border-border/20 group">
          {images.length > 0 ? (
            <>
              <img 
                src={api.getImageUrl(images[currentImageIdx])} 
                alt={`Outfit image ${currentImageIdx + 1}`} 
                className="w-full h-full object-cover transition-all duration-500" 
              />
              
              {images.length > 1 && (
                <>
                  <button 
                    onClick={handlePrevImage}
                    className="absolute left-3 top-1/2 -translate-y-1/2 p-1.5 rounded-full bg-background/85 hover:bg-background text-foreground transition-all duration-300 opacity-0 group-hover:opacity-100 shadow-soft border border-border/20 z-10"
                  >
                    <ChevronLeft size={16} />
                  </button>
                  <button 
                    onClick={handleNextImage}
                    className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 rounded-full bg-background/85 hover:bg-background text-foreground transition-all duration-300 opacity-0 group-hover:opacity-100 shadow-soft border border-border/20 z-10"
                  >
                    <ChevronRight size={16} />
                  </button>
                  <div className="absolute bottom-4 right-4 bg-background/90 backdrop-blur px-2.5 py-1 text-[10px] font-bold rounded-full border border-border/10 shadow-soft z-10">
                    {currentImageIdx + 1} / {images.length}
                  </div>
                </>
              )}
            </>
          ) : (
            <div className="w-full h-full flex items-center justify-center text-muted-foreground/45">
              <ImageIcon size={32} />
            </div>
          )}
          
          <div className="absolute bottom-4 left-4 bg-background/90 backdrop-blur px-3 py-1.5 text-xs font-medium rounded-full flex items-center gap-1.5 border border-border/10 shadow-soft z-10">
            <CalIcon size={12} /> {entry.date}
          </div>
        </div>
        <div className="p-6 md:p-8 space-y-5 text-left">
          <div className="flex justify-between items-start">
            <div>
              <div className="text-xs text-muted-foreground flex items-center gap-1.5 mb-1 font-semibold">
                <MapPin size={12} /> {entry.location || "Unknown Location"}
              </div>
              <div className="text-xs text-muted-foreground flex items-center gap-1.5 font-semibold">
                <Thermometer size={12} /> {entry.weather || "Clear Sky"} {entry.temperature ? `(${entry.temperature}°C)` : ""}
              </div>
            </div>
            {entry.mood && (
              <span className="text-[10px] uppercase tracking-wider px-2.5 py-1 bg-surface border border-border rounded-full text-foreground/80 font-semibold capitalize">
                {entry.mood}
              </span>
            )}
          </div>

          {entry.labels && (
            <div className="bg-surface/50 p-4 border border-border/40 rounded-sm">
              <span className="text-[9px] uppercase tracking-[0.2em] text-muted-foreground block mb-2 font-bold">Garment Intelligence</span>
              <div className="flex flex-wrap gap-1.5">
                {Object.entries(entry.labels).map(([cat, val]: [string, any]) => (
                  val && (
                    <span key={cat} className="text-xs bg-background border border-border/30 px-2 py-0.5 rounded-sm capitalize">
                      <span className="text-muted-foreground text-[10px] lowercase mr-1">{cat}:</span>
                      {val}
                    </span>
                  )
                ))}
              </div>
            </div>
          )}

          {entry.notes && (
            <div>
              <span className="text-[9px] uppercase tracking-[0.2em] text-muted-foreground block mb-1 font-semibold">Stylist Notes</span>
              <p className="text-sm text-foreground/85 leading-relaxed italic border-l-2 border-accent pl-3">"{entry.notes}"</p>
            </div>
          )}

          <div className="pt-4 flex justify-between gap-3 border-t border-border/30">
            <button onClick={handleDelete} disabled={deleting} className="text-xs text-destructive hover:underline font-semibold uppercase tracking-wider py-2">
              {deleting ? "Deleting..." : "Delete Log"}
            </button>
            <button onClick={onClose} className="bg-foreground text-background text-xs uppercase tracking-wider font-semibold px-5 py-2.5 hover:bg-foreground/90 transition shadow-soft">
              Close Detail
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── RECOMMENDATION VIEW ────────────────────────────────────────────────────

function RecommendView() {
  const [wardrobeItems, setWardrobeItems] = useState<any[]>([]);
  const [selectedItemIds, setSelectedItemIds] = useState<number[]>([]);
  const [location, setLocation] = useState("Mumbai");
  const [mood, setMood] = useState("casual");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [activeCategory, setActiveCategory] = useState<string>("all");

  const fetchWardrobe = async () => {
    try {
      const res = await api.getInventory();
      setWardrobeItems(res.inventory || []);
    } catch (e) {
      toast.error("Failed to load wardrobe options");
    }
  };

  useEffect(() => {
    fetchWardrobe();
  }, []);

  const handleRecommend = async () => {
    setLoading(true);
    try {
      const res = await api.recommendDaily(location, mood || "casual", selectedItemIds);
      setResult(res);
      toast.success("Outfit curated based on wardrobe selection!");
    } catch (e: any) {
      toast.error(e.message || "Recommendation failed");
    } finally {
      setLoading(false);
    }
  };

  const toggleItemSelection = (id: number) => {
    if (selectedItemIds.includes(id)) {
      setSelectedItemIds(selectedItemIds.filter(x => x !== id));
    } else {
      setSelectedItemIds([...selectedItemIds, id]);
    }
  };

  // Helper categorized filters
  const categories = [
    { key: "all", label: "All Items" },
    { key: "tops", label: "Tops" },
    { key: "bottoms", label: "Bottoms" },
    { key: "outerwear", label: "Outerwear" }
  ];

  const filteredItems = wardrobeItems.filter(item => {
    if (activeCategory === "all") return true;
    const type = item.type?.toLowerCase() || "";
    if (activeCategory === "tops") {
      return ["tshirt", "polo", "shirt", "hoodies_and_sweatshirts"].includes(type);
    }
    if (activeCategory === "bottoms") {
      return ["jeans", "shorts"].includes(type);
    }
    if (activeCategory === "outerwear") {
      return ["jacket"].includes(type);
    }
    return true;
  });

  return (
    <div className="animate-fade-in max-w-5xl mx-auto pt-6 pb-12 text-left">
      <div className="text-center mb-10">
        <div className="text-xs uppercase tracking-[0.2em] text-muted-foreground mb-4">— AI Outfit Builder</div>
        <h2 className="font-display text-4xl md:text-5xl leading-tight mb-4">Coordinate Your Look</h2>
        <p className="text-muted-foreground text-sm max-w-xl mx-auto text-center">
          Instead of entering keywords, simply select pieces from your wardrobe below. Atelier's fashion intelligence will generate a full cohesive outfit surrounding your selections.
        </p>
      </div>

      {/* Settings Drawer / Trigger */}
      <div className="bg-surface border border-border/40 p-4 rounded-sm shadow-soft mb-8 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-4 text-xs">
          <span className="flex items-center gap-1 bg-background px-3 py-1.5 rounded border border-border/20 font-semibold text-muted-foreground">
            <MapPin size={12} /> Location: <strong className="text-foreground">{location}</strong>
          </span>
          <span className="flex items-center gap-1 bg-background px-3 py-1.5 rounded border border-border/20 font-semibold text-muted-foreground">
            <Sparkles size={12} /> Styling Vibe: <strong className="text-foreground capitalize">{mood}</strong>
          </span>
        </div>
        
        <div className="flex items-center gap-3">
          <button 
            onClick={() => setShowSettings(!showSettings)}
            className="flex items-center gap-1.5 text-xs font-semibold px-4 py-2 bg-background border border-border hover:bg-surface rounded-sm transition-colors text-muted-foreground hover:text-foreground"
          >
            <Settings size={14} /> Adjust Options
          </button>
          
          <button 
            onClick={handleRecommend} 
            disabled={loading || wardrobeItems.length === 0} 
            className="px-6 py-2.5 bg-foreground text-background text-xs uppercase tracking-wider font-bold hover:bg-foreground/90 transition shadow-soft flex items-center gap-2"
          >
            {loading ? <><Loader2 className="animate-spin" size={14} /> Building...</> : "Create AI Outfit"}
          </button>
        </div>
      </div>

      {/* Collapsible Settings Form */}
      {showSettings && (
        <div className="bg-surface border-x border-b border-border/35 p-6 rounded-b-sm -mt-8 mb-8 grid grid-cols-1 md:grid-cols-2 gap-4 animate-reveal-up">
          <div>
            <label className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground block mb-2 font-bold">Styling City / Weather Focus</label>
            <input type="text" placeholder="Mumbai, Paris, New York..." value={location} onChange={e => setLocation(e.target.value)} className="w-full bg-background border border-border px-4 py-2.5 text-sm focus:outline-none focus:border-foreground" />
          </div>
          <div>
            <label className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground block mb-2 font-bold">Styling Vibe / Vibe Category</label>
            <select value={mood} onChange={e => setMood(e.target.value)} className="w-full bg-background border border-border px-4 py-2.5 text-sm focus:outline-none focus:border-foreground capitalize">
              <option value="casual">casual streetwear</option>
              <option value="formal">formal editorial</option>
              <option value="luxury">high luxury minimalist</option>
              <option value="vintage">vintage heritage</option>
              <option value="streetwear">grunge streetwear</option>
              <option value="sports">active sportswear</option>
            </select>
          </div>
        </div>
      )}

      {/* Wardrobe Items Display for selection */}
      <div className="mb-12">
        <div className="flex flex-col sm:flex-row justify-between sm:items-center border-b border-border/50 pb-4 mb-6 gap-4">
          <div className="flex gap-2">
            {categories.map(cat => (
              <button 
                key={cat.key}
                onClick={() => setActiveCategory(cat.key)}
                className={`px-4 py-1.5 rounded-full text-xs font-semibold tracking-wide border transition-all ${
                  activeCategory === cat.key ? "bg-foreground text-background border-foreground shadow-soft" : "bg-surface border-border hover:border-foreground/30 text-muted-foreground hover:text-foreground"
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>
          <div className="text-xs font-semibold text-muted-foreground">
            {selectedItemIds.length} pieces selected
          </div>
        </div>

        {wardrobeItems.length === 0 ? (
          <div className="py-20 text-center border border-dashed border-border/50 text-muted-foreground">
            Your wardrobe is empty. Go to the "Wardrobe" tab to upload images first!
          </div>
        ) : filteredItems.length === 0 ? (
          <div className="py-12 text-center text-muted-foreground text-xs">
            No items in this category. Select another category.
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
            {filteredItems.map(item => {
              const isSelected = selectedItemIds.includes(item.id);
              return (
                <div 
                  key={item.id} 
                  onClick={() => toggleItemSelection(item.id)}
                  className={`group relative bg-surface border rounded-sm overflow-hidden cursor-pointer shadow-soft transition-all duration-300 transform hover:-translate-y-0.5 ${
                    isSelected ? "border-accent ring-2 ring-accent" : "border-border/60 hover:border-foreground/30"
                  }`}
                >
                  <div className="aspect-[3/4] overflow-hidden bg-muted relative">
                    <img src={api.getImageUrl(item.image_path)} className="w-full h-full object-cover" alt={item.type} />
                    <div className="absolute inset-0 bg-black/10 group-hover:bg-black/20" />
                    {isSelected && (
                      <div className="absolute top-2 right-2 bg-accent text-accent-foreground rounded-full p-0.5 shadow-soft">
                        <Check size={12} />
                      </div>
                    )}
                  </div>
                  <div className="p-3 text-left">
                    <div className="text-xs font-bold capitalize truncate">{item.color} {item.type}</div>
                    <div className="text-[10px] text-muted-foreground mt-0.5 capitalize">{item.fit} fit • {item.theme}</div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Styled Recommendations Result */}
      {result && (
        <div className="bg-background border border-border/50 shadow-editorial p-8 md:p-12 animate-reveal-up relative overflow-hidden">
          <div className="absolute -top-20 -right-20 w-64 h-64 bg-accent/15 rounded-full blur-3xl" />
          
          <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground mb-8">
            <span className="flex items-center gap-1.5 font-semibold"><MapPin size={16} /> {location}</span>
            <span>•</span>
            <span className="flex items-center gap-1.5 font-semibold"><Thermometer size={16} /> {result.weather.weather} ({result.weather.temperature}°C)</span>
            {selectedItemIds.length > 0 && (
              <>
                <span>•</span>
                <span className="bg-accent/10 text-accent font-bold px-2 py-0.5 rounded text-[9px] uppercase tracking-wider">Custom Base Outfit</span>
              </>
            )}
          </div>

          <h3 className="font-display text-3xl md:text-4xl mb-4 tracking-tight">{result.recommendation.outfit_name}</h3>
          <p className="text-lg leading-relaxed text-foreground/80 mb-10 border-l-2 border-accent pl-4 font-light">{result.recommendation.reason}</p>

          <div className="text-xs uppercase tracking-[0.2em] text-muted-foreground mb-6 border-b border-border/50 pb-2 font-bold">The Curated Coordination</div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {result.recommendation.items.map((item: any, i: number) => {
              // Try to find if this matches any selected or inventory item image
              const dbItem = wardrobeItems.find(x => x.id === item.id);
              const imageUrl = dbItem ? api.getImageUrl(dbItem.image_path) : null;

              return (
                <div key={i} className="flex items-center justify-between p-4 bg-surface border border-border/30 rounded-sm">
                  <div className="flex items-center gap-4 text-left">
                    {imageUrl ? (
                      <div className="w-12 h-16 rounded overflow-hidden border border-border/20 shadow-soft bg-muted shrink-0">
                        <img src={imageUrl} className="w-full h-full object-cover" alt={item.type} />
                      </div>
                    ) : (
                      <div className="w-12 h-16 rounded flex items-center justify-center border border-dashed border-border bg-background shrink-0">
                        <Sparkles size={14} className="text-accent" />
                      </div>
                    )}
                    <div>
                      <div className="capitalize font-semibold text-lg leading-snug">{item.color} {item.type}</div>
                      <div className="text-xs text-muted-foreground capitalize mt-0.5">Silhouette: {item.fit} fit</div>
                    </div>
                  </div>
                  <span className={`text-[10px] uppercase tracking-wider px-2 py-1 border rounded-full font-bold ${
                    item.source === "wardrobe" ? "bg-accent/10 border-accent/20 text-accent" : "bg-muted border-border/60 text-muted-foreground"
                  }`}>
                    {item.source === "wardrobe" ? "In closet" : "Stylist suggestion"}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── WARDROBE VIEW ──────────────────────────────────────────────────────────

function WardrobeView() {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [selectedItem, setSelectedItem] = useState<any | null>(null);
  const [scannedLabels, setScannedLabels] = useState<any | null>(null);

  const fetchInventory = async () => {
    try {
      const res = await api.getInventory();
      setItems(res.inventory || []);
    } catch (e) {
      toast.error("Failed to load wardrobe pieces");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { 
    fetchInventory(); 
  }, []);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    const toastId = toast.loading("Atelier AI is processing garment tags...");
    
    try {
      const res = await api.uploadToWardrobe(file);
      toast.dismiss(toastId);
      toast.success("Successfully added to your closet!");
      setScannedLabels(res.labels);
      fetchInventory();
    } catch (err: any) {
      toast.dismiss(toastId);
      toast.error(err.message || "Failed to parse clothing tags");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const triggerUpload = () => {
    fileInputRef.current?.click();
  };

  return (
    <div className="animate-fade-in text-left">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-12">
        <div>
          <div className="text-xs uppercase tracking-[0.2em] text-muted-foreground mb-4">— Your Closet</div>
          <h2 className="font-display text-5xl">Wardrobe</h2>
        </div>
        <div className="flex items-center gap-4">
          <input 
            type="file" 
            ref={fileInputRef} 
            onChange={handleUpload} 
            accept="image/*" 
            className="hidden" 
          />
          <button 
            onClick={triggerUpload} 
            disabled={uploading}
            className="bg-foreground text-background px-6 py-3 rounded-full text-sm font-medium hover:bg-foreground/90 transition flex items-center gap-2 shadow-soft"
          >
            {uploading ? (
              <><Loader2 className="animate-spin" size={16} /> Scanning...</>
            ) : (
              <><ImageIcon size={16} /> Scan Garment</>
            )}
          </button>
        </div>
      </div>

      {loading ? (
        <div className="text-muted-foreground flex items-center gap-2"><Loader2 className="animate-spin" size={16} /> Loading closet pieces...</div>
      ) : items.length === 0 ? (
        <div className="py-20 text-center border border-dashed border-border/50 text-muted-foreground">
          No items logged yet. Click the "Scan Garment" button to upload your clothing photos!
        </div>
      ) : (
        <div className="columns-2 md:columns-3 lg:columns-4 gap-6 [column-fill:_balance]">
          {/* Visual Grid Items */}
          {items.map((item, i) => (
            <div 
              key={item.id} 
              className="mb-6 break-inside-avoid animate-reveal-up cursor-pointer group relative" 
              style={{ animationDelay: `${i * 50}ms` }}
              onClick={() => setSelectedItem(item)}
            >
              <div className="bg-surface rounded-sm overflow-hidden border border-border/40 shadow-soft group-hover:shadow-lift transition-all duration-300 transform group-hover:-translate-y-1 relative">
                <img src={api.getImageUrl(item.image_path)} className="w-full h-auto object-cover" alt={item.type} />
                
                {/* Delete button on hover */}
                <button
                  onClick={async (e) => {
                    e.stopPropagation();
                    if (window.confirm(`Remove this ${item.color} ${item.type} from your wardrobe?`)) {
                      const loadId = toast.loading("Removing item...");
                      try {
                        await api.deleteInventoryItem(item.id);
                        toast.dismiss(loadId);
                        toast.success("Successfully removed!");
                        fetchInventory();
                      } catch (err: any) {
                        toast.dismiss(loadId);
                        toast.error(err.message || "Failed to remove item");
                      }
                    }
                  }}
                  className="absolute top-2 right-2 p-1.5 rounded-full bg-background/80 backdrop-blur opacity-0 group-hover:opacity-100 transition-opacity duration-300 hover:bg-destructive hover:text-destructive-foreground border border-border/40 shadow-soft text-muted-foreground z-10"
                  title="Remove from wardrobe"
                >
                  <Trash2 size={14} />
                </button>

                <div className="p-3">
                  <div className="text-sm capitalize font-semibold tracking-wide">{item.color} {item.type}</div>
                  <div className="text-xs text-muted-foreground mt-1 capitalize font-medium">{item.fit} fit • {item.theme}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Scanned Tag Success Notification Modal */}
      {scannedLabels && (
        <AIAnalysisModal 
          labels={scannedLabels} 
          onClose={() => setScannedLabels(null)} 
        />
      )}

      {/* Wardrobe Item Details with Dual-Recommendations Pop-up */}
      {selectedItem && (
        <WardrobeItemModal 
          item={selectedItem} 
          onClose={() => setSelectedItem(null)} 
          onDelete={fetchInventory}
        />
      )}
    </div>
  );
}

interface AIAnalysisModalProps {
  labels: any;
  onClose: () => void;
}

function AIAnalysisModal({ labels, onClose }: AIAnalysisModalProps) {
  return (
    <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-md flex items-center justify-center p-6 animate-fade-in" onClick={onClose}>
      <div className="bg-surface p-8 max-w-md w-full border border-border/50 shadow-editorial rounded-sm relative text-center" onClick={e => e.stopPropagation()}>
        <button onClick={onClose} className="absolute top-4 right-4 text-muted-foreground hover:text-foreground">✕</button>
        <div className="w-12 h-12 bg-accent/20 text-accent rounded-full flex items-center justify-center mx-auto mb-4 animate-pulse">
          <Sparkles size={24} />
        </div>
        <h3 className="font-display text-2xl mb-2">Atelier AI Detected</h3>
        <p className="text-muted-foreground text-xs mb-6">Our neural network classified your garment and loaded it directly to your wardrobe database.</p>
        
        <div className="space-y-3 bg-background p-4 border border-border/40 rounded-sm text-left mb-6">
          <div className="flex justify-between border-b border-border/20 pb-2 text-xs">
            <span className="text-muted-foreground font-semibold uppercase tracking-wider text-[10px]">Type</span>
            <span className="font-bold capitalize">{labels.type || "Unknown"}</span>
          </div>
          <div className="flex justify-between border-b border-border/20 pb-2 text-xs">
            <span className="text-muted-foreground font-semibold uppercase tracking-wider text-[10px]">Color</span>
            <span className="font-bold capitalize">{labels.color || "Unknown"}</span>
          </div>
          <div className="flex justify-between border-b border-border/20 pb-2 text-xs">
            <span className="text-muted-foreground font-semibold uppercase tracking-wider text-[10px]">Silhouette / Fit</span>
            <span className="font-bold capitalize">{labels.fit || "Unknown"}</span>
          </div>
          <div className="flex justify-between border-b border-border/20 pb-2 text-xs">
            <span className="text-muted-foreground font-semibold uppercase tracking-wider text-[10px]">Print / Pattern</span>
            <span className="font-bold capitalize">{labels.print_category || "plain"}</span>
          </div>
          <div className="flex justify-between text-xs">
            <span className="text-muted-foreground font-semibold uppercase tracking-wider text-[10px]">Theme Aesthetics</span>
            <span className="font-bold capitalize">{labels.theme || "casual"}</span>
          </div>
        </div>

        <button onClick={onClose} className="w-full bg-foreground text-background py-3 text-xs uppercase font-semibold tracking-wider hover:bg-foreground/90 transition shadow-soft">
          Confirm & Save
        </button>
      </div>
    </div>
  );
}

interface WardrobeItemModalProps {
  item: any;
  onClose: () => void;
  onDelete?: () => void;
}

function WardrobeItemModal({ item, onClose, onDelete }: WardrobeItemModalProps) {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<"pairings" | "similar">("pairings");
  const [deleting, setDeleting] = useState(false);

  const handleDelete = async () => {
    if (!window.confirm(`Are you sure you want to remove this ${item.color} ${item.type} from your wardrobe?`)) {
      return;
    }
    setDeleting(true);
    try {
      await api.deleteInventoryItem(item.id);
      toast.success("Successfully removed from your wardrobe!");
      if (onDelete) onDelete();
      onClose();
    } catch (e: any) {
      toast.error(e.message || "Failed to remove item");
    } finally {
      setDeleting(false);
    }
  };

  useEffect(() => {
    let active = true;
    const fetchRecommendations = async () => {
      setLoading(true);
      try {
        const res = await api.recommendForItem(item.id);
        if (active) {
          setData(res);
        }
      } catch (e: any) {
        toast.error(e.message || "Failed to load matching recommendations");
      } finally {
        if (active) setLoading(false);
      }
    };
    fetchRecommendations();
    return () => {
      active = false;
    };
  }, [item.id]);

  return (
    <div 
      className="fixed inset-0 z-50 bg-background/80 backdrop-blur-md flex items-center justify-center p-4 md:p-6 animate-fade-in"
      onClick={onClose}
    >
      <div 
        className="bg-background max-w-5xl w-full border border-border/50 shadow-editorial rounded-sm overflow-hidden flex flex-col md:flex-row relative max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        <button 
          onClick={onClose} 
          className="absolute top-4 right-4 z-10 p-2 rounded-full bg-background/80 backdrop-blur hover:bg-surface transition border border-border/40 text-muted-foreground hover:text-foreground"
        >
          <X size={18} />
        </button>

        {/* Left Side: Selected Wardrobe Item */}
        <div className="w-full md:w-[35%] bg-surface border-r border-border/30 p-6 md:p-8 flex flex-col justify-between overflow-y-auto max-h-[40vh] md:max-h-[90vh] text-left">
          <div>
            <div className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground mb-4 flex items-center gap-1.5 font-bold">
              <span className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse" /> Wardrobe Selection
            </div>
            
            <div className="aspect-[3/4] w-full overflow-hidden bg-muted rounded-sm border border-border/30 mb-6 shadow-soft">
              <img 
                src={api.getImageUrl(item.image_path)} 
                alt={item.type} 
                className="w-full h-full object-cover"
              />
            </div>

            <h3 className="font-display text-2xl md:text-3xl capitalize mb-2">{item.color} {item.type}</h3>
            <p className="text-muted-foreground text-xs mb-6 capitalize font-semibold">{item.fit} fit • {item.theme || "Casual"} aesthetic</p>
          </div>

          <div className="border-t border-border/40 pt-6 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <span className="text-[9px] uppercase tracking-[0.15em] text-muted-foreground block mb-1 font-bold">Color</span>
                <span className="text-xs font-semibold capitalize">{item.color}</span>
              </div>
              <div>
                <span className="text-[9px] uppercase tracking-[0.15em] text-muted-foreground block mb-1 font-bold">Category</span>
                <span className="text-xs font-semibold capitalize">{item.type}</span>
              </div>
              <div>
                <span className="text-[9px] uppercase tracking-[0.15em] text-muted-foreground block mb-1 font-bold">Silhouette</span>
                <span className="text-xs font-semibold capitalize">{item.fit} fit</span>
              </div>
              <div>
                <span className="text-[9px] uppercase tracking-[0.15em] text-muted-foreground block mb-1 font-bold">Theme</span>
                <span className="text-xs font-semibold capitalize">{item.theme || "Casual"}</span>
              </div>
            </div>

            <button 
              onClick={handleDelete}
              disabled={deleting}
              className="w-full mt-4 bg-destructive/10 hover:bg-destructive hover:text-destructive-foreground text-destructive text-xs uppercase tracking-wider font-bold py-3 px-4 rounded-sm transition-all duration-300 flex items-center justify-center gap-2 border border-destructive/20"
            >
              {deleting ? (
                <><Loader2 className="animate-spin" size={14} /> Removing...</>
              ) : (
                <><Trash2 size={14} /> Remove Item</>
              )}
            </button>
          </div>
        </div>

        {/* Right Side: Recommendations */}
        <div className="w-full md:w-[65%] p-6 md:p-8 flex flex-col overflow-y-auto max-h-[50vh] md:max-h-[90vh] bg-surface/30 text-left">
          {loading ? (
            <div className="flex-1 flex flex-col items-center justify-center py-16 text-center">
              <div className="relative mb-6">
                <div className="w-12 h-12 border-2 border-foreground/10 border-t-foreground rounded-full animate-spin" />
                <Sparkles size={16} className="absolute inset-0 m-auto text-muted-foreground animate-pulse" />
              </div>
              <h4 className="font-display text-xl mb-2">Curating Pairings</h4>
              <p className="text-muted-foreground text-xs max-w-xs text-center">
                Atelier AI is evaluating coordinating pieces in the lookbook database based on silhouette, theme, and color theory...
              </p>
            </div>
          ) : data ? (
            <div className="animate-reveal-up">
              <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.2em] text-muted-foreground mb-4 font-bold">
                <Sparkles size={12} className="text-accent animate-pulse" /> AI Stylist Pairing Recommendation
              </div>

              {data.reason && (
                <div className="mb-6 p-5 bg-surface border border-border/40 rounded-sm shadow-soft">
                  <p className="font-display text-base md:text-lg italic leading-relaxed text-foreground/85">
                    “{data.reason}”
                  </p>
                </div>
              )}

              {/* Tabs for Similar vs Pairings */}
              <div className="flex border border-border rounded-sm overflow-hidden bg-background mb-6">
                <button 
                  onClick={() => setActiveTab("pairings")}
                  className={`flex-1 py-2.5 text-xs uppercase tracking-wider font-bold transition-all ${
                    activeTab === "pairings" ? "bg-foreground text-background" : "hover:bg-muted text-foreground"
                  }`}
                >
                  Complete Look (Coordinates)
                </button>
                <button 
                  onClick={() => setActiveTab("similar")}
                  className={`flex-1 py-2.5 text-xs uppercase tracking-wider font-bold transition-all ${
                    activeTab === "similar" ? "bg-foreground text-background" : "hover:bg-muted text-foreground"
                  }`}
                >
                  Similar Styles (Alternatives)
                </button>
              </div>

              <div className="text-xs uppercase tracking-[0.15em] text-muted-foreground mb-4 border-b border-border/50 pb-2 flex items-center justify-between font-bold">
                <span>{activeTab === "pairings" ? "Pairings & coordinates" : "Similar Style Pieces"}</span>
                <span>{activeTab === "pairings" ? data.pairings?.length || 0 : data.similar?.length || 0} items</span>
              </div>

              {/* Render Selected List */}
              {activeTab === "pairings" ? (
                data.pairings && data.pairings.length > 0 ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {data.pairings.map((rec: any, idx: number) => (
                      <div 
                        key={rec.id || idx} 
                        className="group bg-background border border-border/30 rounded-sm overflow-hidden flex flex-col justify-between hover:border-foreground/30 hover:shadow-soft transition-all duration-300"
                      >
                        <div className="p-4 flex gap-4">
                          <div className="w-20 h-24 bg-muted overflow-hidden shrink-0 rounded-sm border border-border/20">
                            <img 
                              src={api.getImageUrl(rec.image_path)} 
                              alt={rec.name} 
                              className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                              onError={(e) => {
                                // Fallback image if recommended product image fails
                                e.currentTarget.src = "https://images.unsplash.com/photo-1523381210434-271e8be1f52b?auto=format&fit=crop&w=300&q=80";
                              }}
                            />
                          </div>
                          <div className="flex flex-col justify-between text-left">
                            <div>
                              <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold">
                                {rec.brand || "Atelier Select"}
                              </div>
                              <h5 className="text-xs font-semibold text-foreground line-clamp-2 mt-0.5" title={rec.name}>
                                {rec.name}
                              </h5>
                              <div className="text-xs font-extrabold mt-1">
                                ₹{rec.price_inr ? rec.price_inr.toLocaleString() : "1,499"}
                              </div>
                            </div>
                          </div>
                        </div>

                        {rec.reason_matching && (
                          <div className="px-4 pb-3 pt-2 border-t border-border/20 bg-surface/40 text-[11px] text-muted-foreground leading-normal italic text-left">
                            {rec.reason_matching}
                          </div>
                        )}

                        {rec.source_url && (
                          <a 
                            href={rec.source_url} 
                            target="_blank" 
                            rel="noopener noreferrer" 
                            className="w-full bg-surface-elevated hover:bg-foreground hover:text-background border-t border-border/30 py-2 text-center text-[10px] uppercase tracking-wider font-semibold flex items-center justify-center gap-1.5 transition-colors"
                          >
                            <ShoppingBag size={10} /> Shop Look <ArrowUpRight size={10} />
                          </a>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="py-8 text-center text-muted-foreground text-xs">
                    No matching coordinates found in lookbook database.
                  </div>
                )
              ) : (
                data.similar && data.similar.length > 0 ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {data.similar.map((rec: any, idx: number) => (
                      <div 
                        key={rec.id || idx} 
                        className="group bg-background border border-border/30 rounded-sm overflow-hidden flex flex-col justify-between hover:border-foreground/30 hover:shadow-soft transition-all duration-300"
                      >
                        <div className="p-4 flex gap-4">
                          <div className="w-20 h-24 bg-muted overflow-hidden shrink-0 rounded-sm border border-border/20">
                            <img 
                              src={api.getImageUrl(rec.image_path)} 
                              alt={rec.name} 
                              className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                              onError={(e) => {
                                e.currentTarget.src = "https://images.unsplash.com/photo-1523381210434-271e8be1f52b?auto=format&fit=crop&w=300&q=80";
                              }}
                            />
                          </div>
                          <div className="flex flex-col justify-between text-left">
                            <div>
                              <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold">
                                {rec.brand || "Atelier Alternative"}
                              </div>
                              <h5 className="text-xs font-semibold text-foreground line-clamp-2 mt-0.5" title={rec.name}>
                                {rec.name}
                              </h5>
                              <div className="text-xs font-extrabold mt-1">
                                ₹{rec.price_inr ? rec.price_inr.toLocaleString() : "1,899"}
                              </div>
                            </div>
                          </div>
                        </div>

                        {rec.reason_matching && (
                          <div className="px-4 pb-3 pt-2 border-t border-border/20 bg-surface/40 text-[11px] text-muted-foreground leading-normal italic text-left">
                            {rec.reason_matching}
                          </div>
                        )}

                        {rec.source_url && (
                          <a 
                            href={rec.source_url} 
                            target="_blank" 
                            rel="noopener noreferrer" 
                            className="w-full bg-surface-elevated hover:bg-foreground hover:text-background border-t border-border/30 py-2 text-center text-[10px] uppercase tracking-wider font-semibold flex items-center justify-center gap-1.5 transition-colors"
                          >
                            <ShoppingBag size={10} /> Explore Piece <ArrowUpRight size={10} />
                          </a>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="py-8 text-center text-muted-foreground text-xs">
                    No similar styling alternatives found in lookbook database.
                  </div>
                )
              )}
            </div>
          ) : (
            <div className="py-12 text-center text-muted-foreground text-sm">
              Failed to load recommendations. Please try again.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── HOME VIEW (DASHBOARD) ──────────────────────────────────────────────────
interface HomeViewProps {
  onNavigate: (tab: string) => void;
}

const LUXURY_DEFAULTS = [
  {
    id: "default-1",
    type: "POPLIN SHIRT",
    color: "Optical White",
    image: "https://lh3.googleusercontent.com/aida-public/AB6AXuDuAarssFS29z-WsnK4WHWwMu1JXCN6-9k3szjK1b18HLjZzYOA_qUt19w8cEK9fSnX_zDHgfLRhgfjTr_y4WuGMUB3lrIyRPHTOHMMc3bOjVkimZu9w2rekip6f07vxlC8O5NBtM58PlgzwbqNzoxLLWAJ98ELS7xZrmrS1kQ9CNupJN5gl4TuzDyUkPMdJkpDsdPcu6tnrRGbmbdHiUw8ax1w2zWzvz4wcWCDN9P-EkG2Y2peAsNhPYvyXNQ5bDBS5HK6fZS8qqm8"
  },
  {
    id: "default-2",
    type: "WIDE TROUSER",
    color: "Midnight Black",
    image: "https://lh3.googleusercontent.com/aida-public/AB6AXuCbHSXa1snxWGMW5F4Y3UDH2S0Ji5Pr5IEakS7ubaMGeKJ31LJBOW5daTObySB7TPFYuMVTvBMWlpY9ePQ9umTRxBEWLY87MxBqIJ-F4eCmNCtxRyPacCkejHV45aaHNjNW3VG4NVTCQcP7V0SQettqL2w_CgahFfbS30XWsjLakYsvF21taXIce4gZYR5I1IBh-2RahJoP98Erswzfab-qMY63QWKHVWyPyarWZkC05N-RzqdbnWQXhDLIF0-A6eSMFxOkjP8RZlHt"
  },
  {
    id: "default-3",
    type: "ARCHIVE TOTE",
    color: "Cognac Leather",
    image: "https://lh3.googleusercontent.com/aida-public/AB6AXuBWbvpYqxBfAMQJ-JlIaELm2AZ34pYU3gNLsvINdADcvAM57ZeynOihwltxGrERecksg8U2NAMauPXDLhjvkTywWkBp7kqFdGVgiKaXQv53_g2cBcgj5NI5qPPed90UxlwWiKWlGbvTCeZZNiR_DxRZVBYSxWLVHfnwui42-XGo1OHZKkai-hdA9WldheT47IvbPDwyiI9N7bDB5j5sHriJpbHLsVED8KLvfY-5sn_alAbWZsOIhVjJpmsFBpeavgXyvn3zNU_SYD9A"
  },
  {
    id: "default-4",
    type: "ANKLE BOOT",
    color: "Matte Calfskin",
    image: "https://lh3.googleusercontent.com/aida-public/AB6AXuDvQ5-NpTUg2cM1qpTAZw8hQ5OZcs30KdcF7ypZtrtgBRjvwrI_-EQcMWlSdqeKfvyiawXlI6bRDwoAJA7QaG3Wle_XtuoDXLkQ0MMj2vvApuvoDw7IkUUbFa6UZQV6wngEXlayMXMI8LrgUJfZiUusxrXvcsM0z4aD5MG_bYtMOjlvH-P74Ye79rAom1VCWO8cWNR3FXm4llumW5NLpX6lc9bVXGzY-b9NBcso52P927CyPn20ryJHwRyFXEiN_lwLgphPlmLqNc6u"
  }
];

const LUXURY_ACCESSORIES = [
  {
    name: "STRUCTURED CUFF",
    material: "18K Polished Gold",
    price: "$420",
    image: "https://lh3.googleusercontent.com/aida-public/AB6AXuAYuPXmIJhsDJ7eiDnbSssvRdMIzXWlImvdeermFEsFc5NdDVckbSXjxlZ1eI2X9oR8BQYW_4J0CyfiQM3JZmh2GW2XGqatkoIKGh4vaIiLWkYF2j2Xf0T5tRyGvjK-F3iD9VXM-sA4njouMdK6rMmbOdjauppYNzUKW4sR-FC_TBl3c19ERUDhhBLz0o3yL11Suih26cq3wj5dHpVMgj2KJVvlX1IewX5wQQOsTfMZD23VAuURNzIvs2cmXFB15pPnAYfAUgKRQZW6",
    comment: "Metallic cuffs add classic structure and warmth to soft layered fibers.",
    link: "https://www.bing.com/ck/a?!&&p=217ebc295688b7355ef79cc31f273f73676ca5eeba7b8c25eaf7c8b2bd53ad15JmltdHM9MTc3ODk3NjAwMA&ptn=3&ver=2&hsh=4&fclid=2025a6ea-8665-69b0-06e9-b054879d6829&u=a1L3Nob3AvcHJvZHVjdHBhZ2U_cT1TVFJVQ1RVUkVEK0NVRkZTSE9QK1NJTUlMQVIrU1RSVUNUVVJFRCtDVUZGKzE4SytQb2xpc2hlZCtHK29sZCttZW4rYnJhY2VsZXQmZmlsdGVycz1zY2VuYXJpbyUzYSUyMjE3JTIyK2dUeXBlJTNhJTIyMTIlMjIrZ0lkJTNhJTIyMzkzNzM3NTc5MDMyJTIyK2dJZEhhc2glM2ElMjIwJTIyK2dHbG9iYWxPZmZlcklkcyUzYSUyMjM5MzczNzU3OTAzMiUyMitBdWNDb250ZXh0R3VpZCUzYSUyMjAlMjIrR3JvdXBFbnRpdHlJZCUzYSUyMjM5MzczNzU3OTAzMiUyMitOb25TcG9uc29yZWRPZmZlciUzYSUyMlRydWUlMjImcHJvZHVjdHBhZ2U9dHJ1ZSZGT1JNPVNIUFBEUCZicm93c2U9dHJ1ZSZjdmlkPTg0NjgwNkFGRjE5OTQ5RUU5MEY5RjcyRTgxQjEyNEQz&ntb=1"
  },
  {
    name: "ACETATE FRAME",
    material: "Oversized Black",
    price: "$310",
    image: "https://lh3.googleusercontent.com/aida-public/AB6AXuAxGZZfGf_azuHgGQuq872m5a8xbAr3bNOjGTHyisyjpnihizOJnt46lQdbLgdj0wg1D2YhqyU9t-TpDI-K954SjBXlx-hY3BQ9usS55hNdOk2YH_Ifgy5_zKDcla0obNdVMeQttf0QY2e_H9qVWh28UdFa27UkM9sYuqxD3WLUdnsn8-3unIdFEJGjE9RmAvcVm9VZZn9_U_ChKgmDyXe4ykVgzPOLqnyq6tRXuLlRVvz7TSC5WFfQJWezHyQwvkJSGu7t5kUg7gQt",
    comment: "Thick acetate highlights structural contrast, framing neutral expressions.",
    link: "https://www.bing.com/shop?q=Oversized+Black+Acetate+Frame+Sunglasses"
  },
  {
    name: "CHRONO ARCHIVE",
    material: "Tan Leather / White Dial",
    price: "$890",
    image: "https://lh3.googleusercontent.com/aida-public/AB6AXuBnls2t9Se62niyXLUU6DsyGUaGrS1Jnkn_CXfbXAsaMj8QHvrfbBCpcCfukcn9sk0cEBOO1OVGAIvxJ9XmF2vQPZ5fkb04fe25TTO-IMFM1e-cxiVZHpC67LIMiCm0i7_WKiYQuUdsxGQKkBTNzAImTtsVWrLs0pe4AByMHVZJuq16aREbmbWBU7FX3SLVpdRsqqeNSGtgWyMP19e4bCvhRairtkUIht8fF7-OnVYi2zGjud_Wn6qK2IGufvprr9l9vw5wT-6S1vd1",
    comment: "Tactile leather bands ground monochrome combinations with traditional weight.",
    link: "https://www.bing.com/shop?q=Luxury+Tan+Leather+White+Dial+Chronograph+Watch"
  },
  {
    name: "PETITE ENVELOPE",
    material: "Patent Black Leather",
    price: "$1,200",
    image: "https://lh3.googleusercontent.com/aida-public/AB6AXuBYZkvUISPzhYeYSllc-ZebOFIYDSGyF32FC2jD1T6GhWwzkrGGqZXPZ4qa7OWXVG5s3cIsk3B2a-NSPHr22RNWgRUn_JV4f4q61cv5IwJZZXeeJZjsFDJMvNhmLZg0t4H2d8_5xlrrNn6GkHjEqrpHWbEafsRDKUl_Dai8RzAhWmS40Ymj4SSUW6Txe5RtDtAA_S9mzhIWo8iltWxyT1mAPGRwBgJ738UZbeBwD-JZB9pBwwT2MzVSTwRpHA8dmw7dgwOFj9eMndjA",
    comment: "Patent black leather reflects cool, low-angle light, elevating late silhouettes.",
    link: "https://www.bing.com/shop?q=Patent+Black+Leather+Petite+Envelope+Bag"
  }
];

function HomeView({ onNavigate }: HomeViewProps) {
  // Dashboard state
  const [wardrobeItems, setWardrobeItems] = useState<any[]>([]);
  const [calendarEntries, setCalendarEntries] = useState<any[]>([]);
  const [dailyRec, setDailyRec] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // Dynamic Stylist configs
  const [recLocation, setRecLocation] = useState("Paris");
  const [recMood, setRecMood] = useState("minimalist");
  const [recLoading, setRecLoading] = useState(false);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      const [invRes, calRes] = await Promise.all([
        api.getInventory().catch(() => ({ inventory: [] })),
        api.getCalendar().catch(() => ({ calendar: [] }))
      ]);

      const inv = invRes.inventory || [];
      const cal = calRes.calendar || [];

      setWardrobeItems(inv);
      setCalendarEntries(cal);

      // Auto-configure from last styling location
      let defaultLoc = "Paris";
      let defaultMood = "minimalist";
      if (cal.length > 0) {
        const lastLog = cal[0];
        if (lastLog.location) defaultLoc = lastLog.location;
        if (lastLog.mood) defaultMood = lastLog.mood;
      }

      setRecLocation(defaultLoc);
      setRecMood(defaultMood);

      // Fetch dynamic daily plan on mount
      if (inv.length > 0) {
        try {
          const recRes = await api.recommendDaily(defaultLoc, defaultMood);
          setDailyRec(recRes);
        } catch (e) {
          console.error("Mount recommend failed", e);
        }
      }
    } catch (e) {
      console.error("Fetch dashboard metrics failed", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const handleRegenerateStyle = async () => {
    if (wardrobeItems.length === 0) {
      toast.error("Your digital closet is currently empty. Catalog some garments first!");
      return;
    }
    setRecLoading(true);
    const loadId = toast.loading(`Compiling dynamic coordination for ${recLocation}...`);
    try {
      const res = await api.recommendDaily(recLocation, recMood);
      setDailyRec(res);
      toast.dismiss(loadId);
      toast.success("AI styling coordinates updated successfully!");
    } catch (e: any) {
      toast.dismiss(loadId);
      toast.error(e.message || "Failed to style daily coordinates");
    } finally {
      setRecLoading(false);
    }
  };

  const handlePairAccessory = (acc: any) => {
    const harmonyPercent = Math.floor(Math.random() * 8) + 90; // 90% - 97%
    toast.success(
      `Accessory Coordination: ${harmonyPercent}% Match!\n"${acc.comment}"`,
      { duration: 4000 }
    );
    if (acc.link) {
      setTimeout(() => {
        window.open(acc.link, "_blank", "noopener,noreferrer");
      }, 500);
    }
  };

  // Determine top 4 display archive garments (real uploads padded with luxury placeholders)
  const displayArchive = [...wardrobeItems].slice(0, 4);
  const paddingNeeded = 4 - displayArchive.length;
  for (let i = 0; i < paddingNeeded; i++) {
    displayArchive.push(LUXURY_DEFAULTS[displayArchive.length]);
  }

  // Generate last 7 days of style timeline dynamically (ending with Today)
  const daysOfWeek = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];
  const timelineCells = Array.from({ length: 7 }).map((_, idx) => {
    const d = new Date();
    d.setDate(d.getDate() - (6 - idx));
    const yearStr = d.getFullYear();
    const monthStr = String(d.getMonth() + 1).padStart(2, '0');
    const dayStr = String(d.getDate()).padStart(2, '0');
    const dateString = `${yearStr}-${monthStr}-${dayStr}`;
    const dayLabel = `${daysOfWeek[d.getDay()]} ${d.getDate()}`;
    const isToday = idx === 6;

    // Check if user has logged anything on this date
    const matchedLog = calendarEntries.find(entry => entry.date === dateString);
    return {
      dayLabel,
      dateString,
      isToday,
      log: matchedLog
    };
  });

  return (
    <div className="w-full bg-background text-foreground font-body-md selection:bg-surface-variant z-0 grain">
      <main className="overflow-x-hidden">
        
        {/* Hero Section */}
        <section className="min-h-[85vh] flex flex-col md:flex-row items-center gap-16 py-12">
          <div className="flex-1 space-y-10 order-2 md:order-1">
            <div className="p-12 bg-surface/40 border border-border/40 relative backdrop-blur-md">
              <span className="font-label-caps text-label-caps text-muted-foreground block mb-4">ARCHIVE 01</span>
              <h1 className="font-display text-5xl md:text-6xl text-foreground mb-8 leading-tight font-bold">
                The Digital<br />Closet
              </h1>
              <p className="font-body-lg text-body-lg text-muted-foreground max-w-md leading-relaxed mb-12">
                Your personal inventory, digitally curated. Experience a library of style where every fiber is indexed for effortless archiving.
              </p>
              <button 
                onClick={() => onNavigate("wardrobe")}
                className="bg-primary text-primary-foreground px-10 py-4 font-label-caps text-label-caps tracking-widest hover:opacity-90 transition-all duration-300"
              >
                BROWSE COLLECTION
              </button>
            </div>
          </div>
          <div className="flex-1 order-1 md:order-2 w-full">
            <div className="aspect-[4/5] w-full overflow-hidden border border-border/40 relative group">
              <img 
                alt="Luxury Wardrobe" 
                className="w-full h-full object-cover transition-transform duration-[1.5s] group-hover:scale-105" 
                src="https://lh3.googleusercontent.com/aida-public/AB6AXuCfC83OtMQjuXjoTVMAqkEu1mVBlDS8GSud-nK86x30UyYF58Y3z7mgE7mkbc_51v4Uvu30w3Bx9Tx3ziWjt1MHQjK5r8nCyqazlAR3HNvVJM943WvMA1mDrXKhhA-vdv7ns1siM3cu6Id0VAIofIlxKudgatvOrt7Q3m7SG9jADBvA8_EPcz8olfNuV8L8ruudTPjs6YuM2BNou3NRMOymVL4Td1qiZaN-vDiI2_tfeCCLofYpwUknT62stF2UK4Oysx-brgvhGTN7" 
              />
            </div>
          </div>
        </section>

        {/* Digital Wardrobe Archive Grid */}
        <section className="py-24 border-t border-border/20">
          <div className="flex flex-col md:flex-row justify-between items-baseline mb-16 gap-4">
            <h2 className="font-display text-4xl text-foreground font-bold">The Digital Archive</h2>
            <button 
              onClick={() => onNavigate("wardrobe")}
              className="flex items-center gap-2.5 font-label-caps text-label-caps text-foreground border-b border-foreground pb-1.5 group hover:opacity-80 transition-all"
            >
              <span className="material-symbols-outlined text-[18px]">upload</span>
              UPLOAD NEW ITEM
            </button>
          </div>
          
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            {displayArchive.map((item, idx) => {
              const isReal = item.id && !item.id.toString().startsWith("default");
              const imgUrl = isReal ? api.getImageUrl(item.image_path) : item.image;
              return (
                <div 
                  key={item.id || idx} 
                  onClick={() => onNavigate("wardrobe")}
                  className="group cursor-pointer"
                >
                  <div className="aspect-[3/4] bg-surface/50 border border-border/40 mb-4 overflow-hidden relative">
                    <img 
                      src={imgUrl} 
                      alt={item.type} 
                      className="w-full h-full object-cover transition-all duration-[1s] group-hover:scale-103" 
                    />
                    <div className="absolute inset-0 bg-primary/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity duration-300">
                      <span className="font-label-caps text-label-caps text-primary-foreground border border-primary-foreground px-5 py-2.5">
                        DETAILS
                      </span>
                    </div>
                  </div>
                  <p className="font-label-caps text-label-caps text-foreground">00{idx + 1} — {item.type?.toUpperCase()}</p>
                  <p className="font-body-md text-body-md text-muted-foreground capitalize">{item.color}</p>
                </div>
              );
            })}
          </div>
        </section>

        {/* AI Stylist & Weather Section */}
        <section className="bg-surface/50 py-24 border-y border-border/20">
          <div className="max-w-container-max mx-auto px-2">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-12 items-stretch">
              
              {/* Left Config Panel */}
              <div className="space-y-8 flex flex-col justify-between">
                <div className="space-y-6">
                  <h2 className="font-display text-4xl text-foreground font-bold leading-tight">
                    Personalized for Your Vibe &amp; Weather
                  </h2>
                  <div className="p-8 bg-background border border-border/40 flex items-center gap-8 relative">
                    <div className="text-center min-w-[70px]">
                      <span className="material-symbols-outlined text-[48px] text-foreground">
                        {dailyRec?.weather?.weather?.toLowerCase().includes("rain") ? "cloudy_snowing" : "cloud"}
                      </span>
                      <p className="font-label-caps text-[10px] mt-2 tracking-widest text-muted-foreground uppercase font-bold">
                        {dailyRec?.weather?.weather || "CLOUDY"}
                      </p>
                    </div>
                    <div className="h-16 w-[1px] bg-border/40"></div>
                    <div>
                      <h3 className="font-display text-2xl font-bold text-foreground">
                        {recLocation}, {dailyRec?.weather?.temperature || 18}°C
                      </h3>
                      <p className="font-body-md text-muted-foreground leading-relaxed">
                        Perfect for light layers and smart styling.
                      </p>
                    </div>
                  </div>
                </div>

                {/* Edit Controls Box */}
                <div className="bg-background border border-border/40 p-6 space-y-4">
                  <span className="font-label-caps text-[9px] tracking-widest text-muted-foreground font-bold uppercase block mb-1">
                    🔍 RE-STYLIST FILTERS
                  </span>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-[9px] uppercase tracking-widest text-muted-foreground block mb-1.5 font-bold">Location</label>
                      <input 
                        type="text" 
                        value={recLocation}
                        onChange={(e) => setRecLocation(e.target.value)}
                        placeholder="Paris"
                        className="w-full text-xs bg-surface border border-border/40 px-3 py-2 focus:outline-none focus:border-foreground"
                      />
                    </div>
                    <div>
                      <label className="text-[9px] uppercase tracking-widest text-muted-foreground block mb-1.5 font-bold">Mood / Vibe</label>
                      <input 
                        type="text" 
                        value={recMood}
                        onChange={(e) => setRecMood(e.target.value)}
                        placeholder="minimalist"
                        className="w-full text-xs bg-surface border border-border/40 px-3 py-2 focus:outline-none focus:border-foreground"
                      />
                    </div>
                  </div>
                  <button
                    onClick={handleRegenerateStyle}
                    disabled={recLoading}
                    className="w-full py-3.5 bg-foreground text-background font-label-caps text-xs tracking-widest uppercase hover:bg-foreground/90 transition-all font-semibold flex items-center justify-center gap-2"
                  >
                    {recLoading ? (
                      <>
                        <Loader2 className="animate-spin" size={12} /> COMPILING STYLE...
                      </>
                    ) : (
                      <>
                        <Sparkles size={12} /> RE-RUN AI STYLIST
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* Right Coordinate Reveal Box */}
              <div className="relative h-full">
                <div className="h-full bg-background border border-border/40 p-10 flex flex-col items-center justify-between text-center min-h-[420px] relative">
                  
                  {recLoading && (
                    <div className="absolute inset-0 bg-background/70 backdrop-blur-[2px] flex items-center justify-center z-10 animate-fade-in">
                      <div className="flex flex-col items-center gap-2">
                        <Loader2 className="animate-spin text-foreground" size={28} />
                        <span className="text-[9px] font-mono tracking-widest text-muted-foreground uppercase font-bold">Analyzing Closets...</span>
                      </div>
                    </div>
                  )}

                  <span className="font-label-caps text-label-caps text-foreground/80 tracking-widest font-bold">OUTFIT OF THE DAY</span>
                  
                  {wardrobeItems.length === 0 ? (
                    <div className="my-auto space-y-3">
                      <p className="font-display italic text-lg text-muted-foreground">"The Closet is Empty"</p>
                      <p className="text-xs text-muted-foreground/70 max-w-xs leading-relaxed mx-auto">
                        Please upload items to your archive. Our stylist will dynamically structure combinations tailored to your weather.
                      </p>
                    </div>
                  ) : dailyRec?.recommendation ? (
                    <div className="my-auto space-y-6 w-full animate-reveal-up">
                      <div className="w-full h-44 flex items-center justify-center overflow-hidden">
                        <img 
                          alt="Curated flatlay" 
                          className="h-full object-contain mix-blend-multiply opacity-80" 
                          src="https://lh3.googleusercontent.com/aida-public/AB6AXuAarY356PTfck5F68R9bpkDaCXDi8E3DIMdbkknV5sX4CqnU-1cV6Dd07DeBUqidKHeJmB5Sxq_Hgf3DZ81_Xa9SzBCwZcRot8WReOInSbE4WTdanq8hBE3UyhP_Qz_dXumtvSd2RtosUOAtbSc5oBOcQsfu8fx4AussB7fFcFQ7j36DZvxph1jofKHSx57UJ5k53P9p0ikMmRfRwtI6WzE0JrKaQU96DJeCPO656cJvsR8hX7ekWk24F8yhHFfrVsb8n7CfjLTRXSW" 
                        />
                      </div>
                      <div className="space-y-2.5">
                        <p className="font-display font-bold text-2xl italic">"{dailyRec.recommendation.outfit_name}"</p>
                        <p className="text-xs text-muted-foreground leading-relaxed max-w-md mx-auto italic px-2">
                          {dailyRec.recommendation.reason}
                        </p>
                        <div className="border-t border-border/30 pt-3 flex flex-wrap justify-center gap-1.5">
                          {dailyRec.recommendation.items?.map((item: any, i: number) => (
                            <span key={i} className="text-[9px] bg-surface border border-border/40 px-2 py-0.5 text-foreground/80 font-medium capitalize">
                              {item.color} {item.type}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="my-auto space-y-6 w-full">
                      <div className="w-full h-44 flex items-center justify-center overflow-hidden">
                        <img 
                          alt="Default curated flatlay" 
                          className="h-full object-contain mix-blend-multiply opacity-80" 
                          src="https://lh3.googleusercontent.com/aida-public/AB6AXuAarY356PTfck5F68R9bpkDaCXDi8E3DIMdbkknV5sX4CqnU-1cV6Dd07DeBUqidKHeJmB5Sxq_Hgf3DZ81_Xa9SzBCwZcRot8WReOInSbE4WTdanq8hBE3UyhP_Qz_dXumtvSd2RtosUOAtbSc5oBOcQsfu8fx4AussB7fFcFQ7j36DZvxph1jofKHSx57UJ5k53P9p0ikMmRfRwtI6WzE0JrKaQU96DJeCPO656cJvsR8hX7ekWk24F8yhHFfrVsb8n7CfjLTRXSW" 
                        />
                      </div>
                      <div className="space-y-2">
                        <p className="font-display text-2xl italic">"The Modern Minimalist"</p>
                        <p className="font-body-md text-muted-foreground text-xs">
                          Silk Camisole + Structured Blazer + Relaxed Slacks
                        </p>
                      </div>
                    </div>
                  )}

                  <button 
                    onClick={() => onNavigate("recommend")}
                    className="bg-primary text-primary-foreground px-8 py-3.5 font-label-caps text-label-caps tracking-widest hover:opacity-90 transition-all font-semibold"
                  >
                    WEAR TODAY
                  </button>
                </div>
              </div>

            </div>
          </div>
        </section>

        {/* Style Timeline Calendar Logs Grid */}
        <section className="py-24 px-margin-desktop">
          <h2 className="font-display text-4xl text-foreground font-bold mb-16">Your Style Timeline</h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-7 border-t border-l border-border/40">
            {timelineCells.map((cell, idx) => {
              const images = cell.log ? getImagesArray(cell.log.image_path) : [];
              const thumbnail = images.length > 0 ? api.getImageUrl(images[0]) : "";

              return (
                <div 
                  key={idx}
                  className={`border-b border-r border-border/40 p-4 aspect-square flex flex-col justify-between transition-all duration-300 relative group ${
                    cell.isToday ? "bg-muted/10" : "hover:bg-surface/50"
                  }`}
                >
                  <span className={`font-label-caps text-[9px] tracking-wider uppercase font-semibold ${
                    cell.isToday ? "text-foreground font-bold border-b border-foreground w-max pb-0.5" : "text-muted-foreground"
                  }`}>
                    {cell.dayLabel} {cell.isToday && "(TODAY)"}
                  </span>

                  {cell.log ? (
                    <div className="w-full h-2/3 bg-muted/20 border border-border/30 overflow-hidden relative">
                      {thumbnail ? (
                        <img 
                          src={thumbnail} 
                          className="w-full h-full object-cover transition-all duration-500" 
                          alt="timeline log" 
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-[10px] text-muted-foreground uppercase font-bold">
                          Logged
                        </div>
                      )}
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex flex-col items-center justify-center transition-opacity duration-300 p-2 text-center pointer-events-none">
                        <span className="text-[7px] text-white font-bold tracking-widest uppercase truncate w-full">
                          {cell.log.location || "PARIS"}
                        </span>
                        <span className="text-[6px] text-white/80 italic line-clamp-2 mt-1 px-1">
                          {cell.log.notes}
                        </span>
                      </div>
                    </div>
                  ) : cell.isToday ? (
                    <button 
                      onClick={() => onNavigate("calendar")}
                      className="w-full h-2/3 border border-dashed border-foreground/30 hover:border-foreground/80 flex items-center justify-center transition-colors group/btn"
                    >
                      <span className="material-symbols-outlined text-muted-foreground group-hover/btn:text-foreground transition-colors">add</span>
                    </button>
                  ) : (
                    <div className="w-full h-2/3 opacity-10 flex items-center justify-center pointer-events-none">
                      <span className="material-symbols-outlined">circle</span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>

        {/* Accessory tray - Complete the Look */}
        <section className="py-24 bg-background border-t border-border/20 overflow-hidden">
          <div className="px-margin-desktop mb-12">
            <h2 className="font-display text-4xl text-foreground font-bold">Complete the Look</h2>
            <p className="font-body-md text-muted-foreground mt-2">AI-recommended pieces that harmonize with your current archive.</p>
          </div>
          <div className="flex gap-8 overflow-x-auto px-margin-desktop hide-scrollbar pb-12">
            {LUXURY_ACCESSORIES.map((acc, index) => (
              <div 
                key={index}
                className="min-w-[280px] md:min-w-[320px] flex-shrink-0 group"
              >
                <div className="aspect-square bg-surface/50 border border-border/40 mb-6 overflow-hidden relative">
                  <img 
                    className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" 
                    src={acc.image} 
                    alt={acc.name} 
                  />
                  <div className="absolute bottom-4 left-4 right-4 translate-y-[120%] group-hover:translate-y-0 transition-transform duration-300">
                    <button 
                      onClick={() => handlePairAccessory(acc)}
                      className="w-full bg-primary text-primary-foreground py-3 font-label-caps text-xs tracking-widest font-bold uppercase hover:opacity-90 transition-opacity"
                    >
                      SHOP SIMILAR
                    </button>
                  </div>
                </div>
                <div className="flex justify-between items-start px-1">
                  <div>
                    <p className="font-label-caps text-xs tracking-widest text-foreground font-bold">{acc.name}</p>
                    <p className="font-body-md text-xs text-muted-foreground mt-0.5">{acc.material}</p>
                  </div>
                  <span className="font-label-caps text-xs tracking-widest text-foreground font-bold">{acc.price}</span>
                </div>
              </div>
            ))}
          </div>
        </section>

      </main>

      {/* Styled Luxury Footer */}
      <footer className="border-t border-border/20 bg-background py-20 mt-12">
        <div className="flex flex-col md:flex-row justify-between items-center w-full px-margin-desktop max-w-container-max mx-auto gap-8">
          <div className="font-display text-xl tracking-widest font-bold text-foreground">ATELIER</div>
          <div className="flex flex-wrap justify-center gap-8 md:gap-12">
            {["PRIVACY", "TERMS", "ARCHIVE", "CONTACT"].map((link) => (
              <a 
                key={link}
                className="font-label-caps text-[10px] tracking-widest text-muted-foreground hover:text-foreground transition-colors font-semibold" 
                href="#"
              >
                {link}
              </a>
            ))}
          </div>
          <div className="font-label-caps text-[10px] tracking-widest text-muted-foreground font-medium">
            © 2026 ATELIER. ALL RIGHTS RESERVED.
          </div>
        </div>
      </footer>
    </div>
  );
}



