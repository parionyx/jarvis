import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  Activity,
  ArrowUpRight,
  Bot,
  Brain,
  Check,
  ChevronDown,
  Clock,
  Code,
  Compass,
  Copy,
  Cpu,
  Database,
  ExternalLink,
  Flame,
  Globe,
  Grid,
  Hash,
  Headphones,
  Home,
  Layers,
  LayoutDashboard,
  Maximize2,
  Menu,
  MessageCircle,
  MessageSquare,
  Mic,
  MicOff,
  Minimize2,
  Minus,
  Paperclip,
  Pin,
  Play,
  Plus,
  Radio,
  RefreshCw,
  Search,
  Send,
  Server,
  Settings,
  Shield,
  ShieldCheck,
  Sparkles,
  Square,
  Terminal,
  Trash2,
  User,
  Volume2,
  VolumeX,
  Wifi,
  Wrench,
  X,
  Zap,
} from "lucide-react";
import { api } from "@/lib/api";
import type {
  ModelInfoResponse,
  SessionInfo,
  SessionMessage,
  StatusResponse,
} from "@/lib/api";
import { cn } from "@/lib/utils";
import { useTheme } from "@/themes";
import { Markdown } from "@/components/Markdown";

// Types
export type JarvisState =
  | "idle"
  | "listening"
  | "thinking"
  | "searching"
  | "acting"
  | "speaking"
  | "error";

interface PinnedSession {
  id: string;
  title: string;
  timestamp: number;
}

export function JarvisHUD({ onOpenPage }: { onOpenPage?: (path: string) => void }) {
  const { themeName, setTheme } = useTheme();

  // State Management
  const [jarvisState, setJarvisState] = useState<JarvisState>("idle");
  const [query, setQuery] = useState("");
  const [sessions, setSessions] = useState<SessionInfo[]>([]);
  const [pinnedSessions, setPinnedSessions] = useState<PinnedSession[]>(() => {
    try {
      const saved = localStorage.getItem("jarvis_pinned_sessions");
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [activeSessionMessages, setActiveSessionMessages] = useState<SessionMessage[]>([]);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [isSending, setIsSending] = useState(false);

  // System Telemetry Live States
  const [cpuUsage, setCpuUsage] = useState(12);
  const [memoryUsage, setMemoryUsage] = useState(43);
  const [coreTemp, setCoreTemp] = useState(43);
  const [uptimeSeconds, setUptimeSeconds] = useState(31592); // ~8h 46m 32s
  const [currentModel, setCurrentModel] = useState("Hy3 Free - Med");
  const [availableModels, setAvailableModels] = useState<string[]>([
    "Hy3 Free - Med",
    "Claude 3.7 Sonnet",
    "GPT-4o Omniverse",
    "Hermes 3 Llama-3.1 70B",
    "DeepSeek R1 Thinker",
    "Qwen 2.5 Coder 32B",
  ]);
  const [showModelPicker, setShowModelPicker] = useState(false);

  // Voice & Audio Controls
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [voiceMuted, setVoiceMuted] = useState(false);
  const [recognitionInstance, setRecognitionInstance] = useState<any>(null);

  // Mouse Parallax coordinates for Arc Core reaction
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const hudContainerRef = useRef<HTMLDivElement>(null);
  const dataStreamCanvasRef = useRef<HTMLCanvasElement>(null);
  const waveformCanvasRef = useRef<HTMLCanvasElement>(null);
  const statusArcCanvasRef = useRef<HTMLCanvasElement>(null);
  const tempCanvasRef = useRef<HTMLCanvasElement>(null);
  const chatScrollRef = useRef<HTMLDivElement>(null);

  // Modals & Sub-views
  const [activeModal, setActiveModal] = useState<string | null>(null);
  const [statusData, setStatusData] = useState<StatusResponse | null>(null);

  // 1. Fetch Real Sessions and Backend Status
  const loadSessions = useCallback(async () => {
    try {
      const resp = await api.getSessions(40, 0, undefined, "recent");
      if (resp && resp.sessions) {
        setSessions(resp.sessions);
      }
    } catch (err) {
      console.warn("Could not fetch sessions from Hermes API:", err);
    }
  }, []);

  const loadStatusAndModel = useCallback(async () => {
    try {
      const [status, modelInfo] = await Promise.allSettled([
        api.getStatus(),
        api.getModelInfo(),
      ]);

      if (status.status === "fulfilled" && status.value) {
        setStatusData(status.value);
        if (status.value.uptime_seconds) {
          setUptimeSeconds(Math.floor(status.value.uptime_seconds));
        }
      }

      if (modelInfo.status === "fulfilled" && modelInfo.value) {
        const info = modelInfo.value as any;
        const name = info?.model || info?.default_model || info?.name;
        if (name) {
          setCurrentModel(name);
          setAvailableModels((prev) => Array.from(new Set([name, ...prev])));
        }
      }
    } catch (e) {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    loadSessions();
    loadStatusAndModel();
    const interval = setInterval(() => {
      loadSessions();
      loadStatusAndModel();
    }, 15000);
    return () => clearInterval(interval);
  }, [loadSessions, loadStatusAndModel]);

  // 2. Fetch Messages when activeSessionId changes
  useEffect(() => {
    if (!activeSessionId) {
      setActiveSessionMessages([]);
      return;
    }
    let cancelled = false;
    setLoadingMessages(true);
    api
      .getSessionMessages(activeSessionId)
      .then((res) => {
        if (!cancelled && res?.messages) {
          setActiveSessionMessages(res.messages);
        }
      })
      .catch((err) => {
        console.warn("Failed to load session messages:", err);
      })
      .finally(() => {
        if (!cancelled) setLoadingMessages(false);
      });
    return () => {
      cancelled = true;
    };
  }, [activeSessionId]);

  // Auto-scroll chat
  useEffect(() => {
    if (chatScrollRef.current) {
      chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
    }
  }, [activeSessionMessages]);

  // 3. Live Uptime Counter and subtle telemetry fluctuations
  useEffect(() => {
    const timer = setInterval(() => {
      setUptimeSeconds((prev) => prev + 1);

      // Minor realistic fluctuations for that live HUD feel
      setCpuUsage((prev) => {
        const delta = (Math.random() - 0.48) * 3;
        return Math.max(8, Math.min(88, Math.round(prev + delta)));
      });

      setMemoryUsage((prev) => {
        const delta = (Math.random() - 0.5) * 1.5;
        return Math.max(38, Math.min(74, Math.round((prev + delta) * 10) / 10));
      });

      setCoreTemp((prev) => {
        const delta = (Math.random() - 0.5) * 0.8;
        return Math.max(40, Math.min(58, Math.round(prev + delta)));
      });
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // 4. Mouse Tracking for Parallax Reaction
  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!hudContainerRef.current) return;
    const rect = hudContainerRef.current.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width - 0.5) * 2; // -1 to 1
    const y = ((e.clientY - rect.top) / rect.height - 0.5) * 2; // -1 to 1
    setMousePos({ x, y });
  };

  // 5. Web Speech API (Voice Recognition & Voice Synthesis)
  useEffect(() => {
    if (typeof window !== "undefined") {
      const SpeechRecognition =
        (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (SpeechRecognition) {
        const recognition = new SpeechRecognition();
        recognition.continuous = false;
        recognition.interimResults = true;
        recognition.lang = "en-US";

        recognition.onstart = () => {
          setIsListening(true);
          setJarvisState("listening");
        };

        recognition.onresult = (event: any) => {
          const transcript = Array.from(event.results)
            .map((r: any) => r[0].transcript)
            .join("");
          setQuery(transcript);
        };

        recognition.onerror = () => {
          setIsListening(false);
          setJarvisState("idle");
        };

        recognition.onend = () => {
          setIsListening(false);
          if (jarvisState === "listening") {
            setJarvisState("idle");
          }
        };

        setRecognitionInstance(recognition);
      }
    }
  }, []);

  const toggleMic = () => {
    if (!recognitionInstance) {
      alert("Speech recognition is not supported in this browser. Please use Chrome/Edge.");
      return;
    }
    if (isListening) {
      recognitionInstance.stop();
      setIsListening(false);
      setJarvisState("idle");
    } else {
      try {
        recognitionInstance.start();
      } catch (e) {
        /* already started */
      }
    }
  };

  const speakText = (text: string) => {
    if (voiceMuted || typeof window === "undefined" || !("speechSynthesis" in window)) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 1.05;
    utterance.pitch = 0.95;
    utterance.onstart = () => {
      setIsSpeaking(true);
      setJarvisState("speaking");
    };
    utterance.onend = () => {
      setIsSpeaking(false);
      setJarvisState("idle");
    };
    utterance.onerror = () => {
      setIsSpeaking(false);
      setJarvisState("idle");
    };
    window.speechSynthesis.speak(utterance);
  };

  // 6. Handle Command Submission
  const handleSendMessage = async (customQuery?: string) => {
    const text = (customQuery || query).trim();
    if (!text || isSending) return;

    setQuery("");
    setIsSending(true);
    setJarvisState("thinking");

    // Add user message to active view immediately
    const userMsg: SessionMessage = {
      id: `usr_${Date.now()}`,
      role: "user",
      content: text,
      timestamp: Date.now(),
    } as any;

    setActiveSessionMessages((prev) => [...prev, userMsg]);

    try {
      // Simulate JARVIS thinking & processing or trigger Hermes API
      setTimeout(() => {
        setJarvisState("acting");
        const replies = [
          `Right away, sir. Query processed: "${text}". Running execution protocols across connected toolsets.`,
          `All systems active. Executing instruction with 98.4% confidence rating.`,
          `Diagnostic complete, sir. Task verified and dispatched to active agent environment.`,
          `Confirmed. Security parameters cleared. Awaiting further command.`,
        ];
        const jarvisReply = replies[Math.floor(Math.random() * replies.length)];

        const botMsg: SessionMessage = {
          id: `jarvis_${Date.now()}`,
          role: "assistant",
          content: jarvisReply,
          timestamp: Date.now(),
        } as any;

        setActiveSessionMessages((prev) => [...prev, botMsg]);
        setJarvisState("speaking");
        speakText(jarvisReply);
        setIsSending(false);
        setTimeout(() => setJarvisState("idle"), 2500);
      }, 1400);
    } catch (e) {
      setJarvisState("error");
      setIsSending(false);
    }
  };

  // 7. Render Animated Data Stream Matrix (Canvas)
  useEffect(() => {
    const canvas = dataStreamCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animId: number;
    let tick = 0;
    const rows = 9;
    const cols = 14;

    const render = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      tick++;

      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const x = 12 + c * 15;
          const y = 14 + r * 14;

          const isNode = (r * 7 + c + Math.floor(tick / 10)) % 11 === 0;
          const brightness = isNode ? 0.9 : 0.2 + (Math.sin(tick * 0.05 + r + c) * 0.15);

          ctx.fillStyle = `rgba(0, 229, 255, ${brightness})`;
          ctx.beginPath();
          ctx.arc(x, y, isNode ? 2.2 : 1.2, 0, Math.PI * 2);
          ctx.fill();

          if (isNode) {
            ctx.shadowColor = "#00E5FF";
            ctx.shadowBlur = 6;
          } else {
            ctx.shadowBlur = 0;
          }
        }
      }

      animId = requestAnimationFrame(render);
    };

    render();
    return () => cancelAnimationFrame(animId);
  }, []);

  // 8. Render Animated Sine Connection Wave (Canvas)
  useEffect(() => {
    const canvas = waveformCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animId: number;
    let phase = 0;

    const render = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      phase += 0.05;

      const w = canvas.width;
      const h = canvas.height;
      const midY = h / 2;

      ctx.beginPath();
      ctx.strokeStyle = "#00E5FF";
      ctx.lineWidth = 1.6;
      ctx.shadowColor = "#00E5FF";
      ctx.shadowBlur = 8;

      for (let x = 0; x < w; x++) {
        const pulse = Math.sin(x * 0.04 + phase) * 12 * Math.sin(x * 0.02);
        const noise = (Math.sin(x * 0.15 + phase * 2) * 4);
        const y = midY + pulse + noise;
        if (x === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();

      // Second harmonic line
      ctx.beginPath();
      ctx.strokeStyle = "rgba(117, 247, 255, 0.35)";
      ctx.lineWidth = 1;
      ctx.shadowBlur = 0;

      for (let x = 0; x < w; x++) {
        const y = midY + Math.cos(x * 0.03 - phase) * 8;
        if (x === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();

      animId = requestAnimationFrame(render);
    };

    render();
    return () => cancelAnimationFrame(animId);
  }, []);

  // 9. Render Rotating Mini Status Arc Reactor (Canvas)
  useEffect(() => {
    const canvas = statusArcCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animId: number;
    let angle = 0;

    const render = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      angle += 0.02;

      const cx = canvas.width / 2;
      const cy = canvas.height / 2;

      // Outer glowing ring
      ctx.beginPath();
      ctx.arc(cx, cy, 32, 0, Math.PI * 2);
      ctx.strokeStyle = "rgba(0, 229, 255, 0.2)";
      ctx.lineWidth = 2;
      ctx.stroke();

      // Rotating dashed segmented arc
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(angle);
      ctx.beginPath();
      ctx.arc(0, 0, 26, 0, Math.PI * 1.5);
      ctx.strokeStyle = "#00E5FF";
      ctx.lineWidth = 2.5;
      ctx.shadowColor = "#00E5FF";
      ctx.shadowBlur = 10;
      ctx.stroke();
      ctx.restore();

      // Counter-rotating inner ring
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(-angle * 1.4);
      ctx.beginPath();
      ctx.arc(0, 0, 18, 0, Math.PI);
      ctx.strokeStyle = "#75F7FF";
      ctx.lineWidth = 1.8;
      ctx.stroke();

      // Triangle core
      ctx.beginPath();
      for (let i = 0; i < 3; i++) {
        const a = (i * 2 * Math.PI) / 3 - Math.PI / 2;
        const x = Math.cos(a) * 11;
        const y = Math.sin(a) * 11;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.closePath();
      ctx.fillStyle = "rgba(0, 229, 255, 0.7)";
      ctx.shadowColor = "#00E5FF";
      ctx.shadowBlur = 14;
      ctx.fill();
      ctx.restore();

      animId = requestAnimationFrame(render);
    };

    render();
    return () => cancelAnimationFrame(animId);
  }, []);

  // 10. Render Core Temperature Chart
  useEffect(() => {
    const canvas = tempCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animId: number;
    let offset = 0;

    const render = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      offset += 0.03;

      const w = canvas.width;
      const h = canvas.height;

      ctx.beginPath();
      ctx.strokeStyle = "#00E5FF";
      ctx.lineWidth = 1.5;
      ctx.shadowColor = "#00E5FF";
      ctx.shadowBlur = 6;

      for (let x = 0; x < w; x++) {
        const normX = x / w;
        const y = h - 8 - Math.sin(normX * 8 + offset) * 10 - Math.cos(normX * 14) * 6;
        if (x === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();

      animId = requestAnimationFrame(render);
    };

    render();
    return () => cancelAnimationFrame(animId);
  }, []);

  // Format Uptime (HH:MM:SS)
  const formatUptime = (totalSec: number) => {
    const hrs = Math.floor(totalSec / 3600).toString().padStart(2, "0");
    const mins = Math.floor((totalSec % 3600) / 60).toString().padStart(2, "0");
    const secs = (totalSec % 60).toString().padStart(2, "0");
    return { hrs, mins, secs };
  };

  const { hrs, mins, secs } = formatUptime(uptimeSeconds);

  // Group Sessions by Today, Yesterday, and Last Week
  const filteredSessions = useMemo(() => {
    if (!searchQuery.trim()) return sessions;
    const q = searchQuery.toLowerCase();
    return sessions.filter((s) => (s.title || s.id || "").toLowerCase().includes(q));
  }, [sessions, searchQuery]);

  const categorizedSessions = useMemo(() => {
    const now = Date.now();
    const oneDay = 24 * 60 * 60 * 1000;
    const today: SessionInfo[] = [];
    const yesterday: SessionInfo[] = [];
    const lastWeek: SessionInfo[] = [];

    filteredSessions.forEach((s) => {
      const updated = s.updated_at ? new Date(s.updated_at).getTime() : now;
      const diff = now - updated;
      if (diff < oneDay) {
        today.push(s);
      } else if (diff < oneDay * 2) {
        yesterday.push(s);
      } else {
        lastWeek.push(s);
      }
    });

    return { today, yesterday, lastWeek };
  }, [filteredSessions]);

  // Toggle Pin Session
  const togglePin = (session: SessionInfo, e: React.MouseEvent) => {
    e.stopPropagation();
    setPinnedSessions((prev) => {
      const exists = prev.some((p) => p.id === session.id);
      let updated;
      if (exists) {
        updated = prev.filter((p) => p.id !== session.id);
      } else {
        updated = [...prev, { id: session.id, title: session.title || "Session", timestamp: Date.now() }];
      }
      try {
        localStorage.setItem("jarvis_pinned_sessions", JSON.stringify(updated));
      } catch {}
      return updated;
    });
  };

  const isPinned = (id: string) => pinnedSessions.some((p) => p.id === id);

  return (
    <div
      ref={hudContainerRef}
      onMouseMove={handleMouseMove}
      className={cn(
        "relative flex h-full w-full select-none flex-col overflow-hidden bg-[#02060B] font-sans text-[#EAFBFF] antialiased",
      )}
      style={{
        backgroundImage: `
          radial-gradient(circle at 50% 50%, rgba(6, 25, 45, 0.4) 0%, rgba(2, 6, 11, 0.95) 100%),
          linear-gradient(rgba(0, 229, 255, 0.02) 1px, transparent 1px),
          linear-gradient(90deg, rgba(0, 229, 255, 0.02) 1px, transparent 1px)
        `,
        backgroundSize: "100% 100%, 60px 60px, 60px 60px",
      }}
    >
      {/* ── TOP HEADER ──────────────────────────────────────────────────────── */}
      <header className="relative z-20 flex h-14 shrink-0 items-center justify-between border-b border-[#00E5FF]/15 bg-[#02060B]/80 px-4 backdrop-blur-md">
        {/* Left: Brand / Logo */}
        <div className="flex items-center gap-3">
          <div className="relative flex h-8 w-8 items-center justify-center rounded-sm border border-[#00E5FF]/40 bg-[#0A1628]/80 shadow-[0_0_12px_rgba(0,229,255,0.25)]">
            <div className="h-4 w-4 rotate-45 border border-[#00E5FF] bg-[#00E5FF]/20" />
            <div className="absolute h-2 w-2 rounded-full bg-[#00E5FF] shadow-[0_0_8px_#00E5FF]" />
          </div>
          <span className="font-['Rajdhani',sans-serif] text-xl font-bold tracking-[0.2em] text-[#00E5FF] drop-shadow-[0_0_8px_rgba(0,229,255,0.5)]">
            JARVIS
          </span>
        </div>

        {/* Center: System Online Status */}
        <div className="flex flex-col items-center justify-center">
          <div className="flex items-center gap-2 rounded-full border border-[#00E5FF]/30 bg-[#0A1628]/60 px-4 py-0.5 shadow-[0_0_15px_rgba(0,229,255,0.15)]">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#00E5FF] opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-[#00E5FF]" />
            </span>
            <span className="font-['Rajdhani',sans-serif] text-xs font-bold tracking-[0.18em] text-[#00E5FF]">
              SYSTEM ONLINE
            </span>
          </div>
          <span className="mt-0.5 text-[10px] tracking-[0.12em] text-[#66808C]">
            All systems operational
          </span>
        </div>

        {/* Right: Window / View Controls */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setActiveModal("capabilities")}
            title="Capabilities & Tools"
            className="flex h-8 w-8 items-center justify-center rounded border border-[#00E5FF]/20 bg-[#061019] text-[#66808C] transition hover:border-[#00E5FF]/60 hover:text-[#00E5FF]"
          >
            <Grid className="h-4 w-4" />
          </button>

          <button
            onClick={() => setActiveModal("settings")}
            title="System Settings"
            className="flex h-8 w-8 items-center justify-center rounded border border-[#00E5FF]/20 bg-[#061019] text-[#66808C] transition hover:border-[#00E5FF]/60 hover:text-[#00E5FF]"
          >
            <Settings className="h-4 w-4" />
          </button>

          <button
            onClick={() => {
              if (document.fullscreenElement) {
                document.exitFullscreen().catch(() => {});
              } else {
                document.documentElement.requestFullscreen().catch(() => {});
              }
            }}
            title="Fullscreen Toggle"
            className="flex h-8 w-8 items-center justify-center rounded border border-[#00E5FF]/20 bg-[#061019] text-[#66808C] transition hover:border-[#00E5FF]/60 hover:text-[#00E5FF]"
          >
            <Maximize2 className="h-4 w-4" />
          </button>
        </div>
      </header>

      {/* ── MAIN 3-PANEL BODY ────────────────────────────────────────────────── */}
      <div className="relative flex min-h-0 flex-1 overflow-hidden">
        {/* ── LEFT PANEL: SESSIONS & NAVIGATION ────────────────────────────── */}
        <aside className="relative flex w-64 shrink-0 flex-col border-r border-[#00E5FF]/15 bg-[#02060B]/85 backdrop-blur-md">
          {/* Top Quick Actions */}
          <div className="space-y-1.5 p-3">
            <div className="flex items-center justify-between pb-1">
              <span className="font-['Rajdhani',sans-serif] text-[11px] font-bold tracking-[0.14em] text-[#66808C] uppercase">
                Sessions
              </span>
            </div>

            <button
              onClick={() => {
                setActiveSessionId(null);
                setActiveSessionMessages([]);
                setJarvisState("idle");
              }}
              className="group relative flex w-full items-center justify-between rounded-md border border-[#00E5FF]/40 bg-[#0A1628]/90 px-3 py-2 text-left font-['Rajdhani',sans-serif] text-sm font-semibold tracking-wide text-[#EAFBFF] transition hover:border-[#00E5FF] hover:bg-[#00E5FF]/10 hover:shadow-[0_0_15px_rgba(0,229,255,0.2)]"
            >
              <span className="flex items-center gap-2 text-[#00E5FF]">
                <Plus className="h-4 w-4 transition-transform group-hover:rotate-90" />
                New session
              </span>
              <kbd className="rounded border border-[#00E5FF]/30 bg-[#02060B] px-1.5 py-0.5 text-[9px] text-[#66808C]">
                Ctrl N
              </kbd>
            </button>

            {/* Quick Navigation Items */}
            <div className="space-y-0.5 pt-1 text-xs">
              <button
                onClick={() => setActiveModal("capabilities")}
                className="flex w-full items-center gap-2.5 rounded px-2.5 py-1.5 text-[#66808C] transition hover:bg-[#0A1628] hover:text-[#00E5FF]"
              >
                <Zap className="h-3.5 w-3.5 text-[#00E5FF]/70" />
                <span>Capabilities</span>
              </button>
              <button
                onClick={() => setActiveModal("messaging")}
                className="flex w-full items-center gap-2.5 rounded px-2.5 py-1.5 text-[#66808C] transition hover:bg-[#0A1628] hover:text-[#00E5FF]"
              >
                <MessageSquare className="h-3.5 w-3.5 text-[#00E5FF]/70" />
                <span>Messaging</span>
              </button>
              <button
                onClick={() => setActiveModal("artifacts")}
                className="flex w-full items-center gap-2.5 rounded px-2.5 py-1.5 text-[#66808C] transition hover:bg-[#0A1628] hover:text-[#00E5FF]"
              >
                <Layers className="h-3.5 w-3.5 text-[#00E5FF]/70" />
                <span>Artifacts</span>
              </button>
              <button
                onClick={() => setActiveModal("scheduled")}
                className="flex w-full items-center gap-2.5 rounded px-2.5 py-1.5 text-[#66808C] transition hover:bg-[#0A1628] hover:text-[#00E5FF]"
              >
                <Clock className="h-3.5 w-3.5 text-[#00E5FF]/70" />
                <span>Scheduled jobs</span>
              </button>
            </div>
          </div>

          {/* Search bar */}
          <div className="px-3 pb-2">
            <div className="relative flex items-center">
              <Search className="absolute left-2.5 h-3.5 w-3.5 text-[#66808C]" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search sessions..."
                className="w-full rounded border border-[#00E5FF]/15 bg-[#061019] py-1.5 pr-2.5 pl-8 text-xs text-[#EAFBFF] placeholder-[#66808C]/60 outline-none transition focus:border-[#00E5FF]/50 focus:shadow-[0_0_8px_rgba(0,229,255,0.15)]"
              />
            </div>
          </div>

          {/* Pinned Section */}
          {pinnedSessions.length > 0 && (
            <div className="border-t border-[#00E5FF]/10 px-3 py-2">
              <div className="flex items-center gap-1 text-[10px] font-bold tracking-[0.14em] text-[#00E5FF] uppercase">
                <Pin className="h-3 w-3 rotate-45" />
                <span>Pinned</span>
              </div>
              <div className="mt-1 space-y-0.5">
                {pinnedSessions.map((pin) => (
                  <button
                    key={pin.id}
                    onClick={() => setActiveSessionId(pin.id)}
                    className={cn(
                      "group flex w-full items-center justify-between rounded px-2 py-1 text-left text-xs transition",
                      activeSessionId === pin.id
                        ? "bg-[#00E5FF]/15 text-[#00E5FF]"
                        : "text-[#EAFBFF]/80 hover:bg-[#0A1628] hover:text-[#00E5FF]",
                    )}
                  >
                    <span className="truncate pr-2">{pin.title}</span>
                    <Pin
                      onClick={(e) => {
                        e.stopPropagation();
                        setPinnedSessions((prev) => prev.filter((p) => p.id !== pin.id));
                      }}
                      className="h-3 w-3 shrink-0 text-[#00E5FF] opacity-80 hover:opacity-100"
                    />
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Scrollable Sessions List */}
          <div className="min-h-0 flex-1 overflow-y-auto px-3 py-2 scrollbar-none">
            {/* Today's Sessions */}
            {categorizedSessions.today.length > 0 && (
              <div className="mb-3">
                <div className="flex items-center justify-between pb-1 text-[10px] font-bold tracking-[0.14em] text-[#66808C] uppercase">
                  <span>Sessions</span>
                  <span className="text-[9px] text-[#66808C]/60">TODAY</span>
                </div>
                <div className="space-y-0.5">
                  {categorizedSessions.today.map((sess) => (
                    <button
                      key={sess.id}
                      onClick={() => setActiveSessionId(sess.id)}
                      className={cn(
                        "group relative flex w-full items-center justify-between rounded px-2 py-1.5 text-left text-xs transition",
                        activeSessionId === sess.id
                          ? "border border-[#00E5FF]/40 bg-[#00E5FF]/15 text-[#00E5FF] shadow-[0_0_8px_rgba(0,229,255,0.15)]"
                          : "text-[#EAFBFF]/80 hover:bg-[#0A1628] hover:text-[#00E5FF]",
                      )}
                    >
                      <div className="flex min-w-0 items-center gap-1.5">
                        <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-[#00E5FF]/60 group-hover:bg-[#00E5FF]" />
                        <span className="truncate">{sess.title || "Unnamed Session"}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <span className="text-[10px] text-[#66808C]">
                          {sess.updated_at ? "59m" : "1h"}
                        </span>
                        <Pin
                          onClick={(e) => togglePin(sess, e)}
                          className={cn(
                            "h-3 w-3 shrink-0 transition-opacity",
                            isPinned(sess.id)
                              ? "text-[#00E5FF] opacity-100"
                              : "text-[#66808C] opacity-0 group-hover:opacity-100",
                          )}
                        />
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Yesterday's Sessions */}
            {categorizedSessions.yesterday.length > 0 && (
              <div className="mb-3">
                <div className="pb-1 text-[10px] font-bold tracking-[0.14em] text-[#66808C] uppercase">
                  Yesterday
                </div>
                <div className="space-y-0.5">
                  {categorizedSessions.yesterday.map((sess) => (
                    <button
                      key={sess.id}
                      onClick={() => setActiveSessionId(sess.id)}
                      className={cn(
                        "group flex w-full items-center justify-between rounded px-2 py-1.5 text-left text-xs transition",
                        activeSessionId === sess.id
                          ? "bg-[#00E5FF]/15 text-[#00E5FF]"
                          : "text-[#EAFBFF]/80 hover:bg-[#0A1628] hover:text-[#00E5FF]",
                      )}
                    >
                      <div className="flex min-w-0 items-center gap-1.5">
                        <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-[#66808C]" />
                        <span className="truncate">{sess.title || "Untitled Session"}</span>
                      </div>
                      <span className="text-[10px] text-[#66808C]">1d</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Last Week / Older */}
            {categorizedSessions.lastWeek.length > 0 && (
              <div>
                <div className="pb-1 text-[10px] font-bold tracking-[0.14em] text-[#66808C] uppercase">
                  Last Week
                </div>
                <div className="space-y-0.5">
                  {categorizedSessions.lastWeek.map((sess) => (
                    <button
                      key={sess.id}
                      onClick={() => setActiveSessionId(sess.id)}
                      className={cn(
                        "group flex w-full items-center justify-between rounded px-2 py-1.5 text-left text-xs transition",
                        activeSessionId === sess.id
                          ? "bg-[#00E5FF]/15 text-[#00E5FF]"
                          : "text-[#EAFBFF]/80 hover:bg-[#0A1628] hover:text-[#00E5FF]",
                      )}
                    >
                      <div className="flex min-w-0 items-center gap-1.5">
                        <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-[#66808C]" />
                        <span className="truncate">{sess.title || "Untitled Session"}</span>
                      </div>
                      <span className="text-[10px] text-[#66808C]">1d</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {sessions.length === 0 && (
              <div className="py-8 text-center text-xs text-[#66808C]">
                No sessions yet. Click "+ New session" to begin.
              </div>
            )}
          </div>

          {/* Bottom Sidebar Rail */}
          <div className="flex h-12 shrink-0 items-center justify-around border-t border-[#00E5FF]/15 bg-[#02060B] px-2 text-[#66808C]">
            <button
              onClick={() => {
                setActiveSessionId(null);
                setActiveSessionMessages([]);
              }}
              title="Home Core View"
              className="rounded p-1.5 transition hover:bg-[#0A1628] hover:text-[#00E5FF]"
            >
              <Home className="h-4 w-4" />
            </button>
            <button
              onClick={() => {
                setActiveSessionId(null);
                setQuery("");
              }}
              title="New Session"
              className="rounded p-1.5 transition hover:bg-[#0A1628] hover:text-[#00E5FF]"
            >
              <Plus className="h-4 w-4" />
            </button>
            <button
              onClick={() => setActiveModal("messaging")}
              title="Meetings & Live Channels"
              className="rounded p-1.5 transition hover:bg-[#0A1628] hover:text-[#00E5FF]"
            >
              <MessageCircle className="h-4 w-4" />
            </button>
            <button
              onClick={() => setActiveModal("settings")}
              title="Configuration"
              className="rounded p-1.5 transition hover:bg-[#0A1628] hover:text-[#00E5FF]"
            >
              <Settings className="h-4 w-4" />
            </button>
          </div>
        </aside>

        {/* ── CENTER VIEW: DYNAMIC JARVIS ARC CORE HUD / CONVERSATION ──────── */}
        <main className="relative flex min-h-0 flex-1 flex-col overflow-hidden bg-[#02060B]/60">
          {/* If Active Session is open: Show Conversation Overlay */}
          {activeSessionId ? (
            <div className="relative flex min-h-0 flex-1 flex-col">
              {/* Session Header Bar */}
              <div className="flex h-12 shrink-0 items-center justify-between border-b border-[#00E5FF]/15 bg-[#0A1628]/70 px-6 backdrop-blur-md">
                <div className="flex items-center gap-3">
                  <Terminal className="h-4 w-4 text-[#00E5FF]" />
                  <span className="font-['Rajdhani',sans-serif] text-sm font-semibold tracking-wide text-[#EAFBFF]">
                    {sessions.find((s) => s.id === activeSessionId)?.title || "Active Session"}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      setActiveSessionId(null);
                      setActiveSessionMessages([]);
                    }}
                    className="flex items-center gap-1 rounded border border-[#00E5FF]/20 bg-[#061019] px-2.5 py-1 text-xs text-[#66808C] hover:border-[#00E5FF]/60 hover:text-[#00E5FF]"
                  >
                    <X className="h-3.5 w-3.5" />
                    Close View
                  </button>
                </div>
              </div>

              {/* Messages Stream */}
              <div
                ref={chatScrollRef}
                className="flex-1 space-y-4 overflow-y-auto p-6 scrollbar-none"
              >
                {loadingMessages ? (
                  <div className="flex h-full items-center justify-center gap-2 text-sm text-[#00E5FF]">
                    <RefreshCw className="h-4 w-4 animate-spin" />
                    <span>Synchronizing session memory...</span>
                  </div>
                ) : activeSessionMessages.length > 0 ? (
                  activeSessionMessages.map((msg, i) => (
                    <div
                      key={msg.id || i}
                      className={cn(
                        "flex gap-3",
                        msg.role === "user" ? "justify-end" : "justify-start",
                      )}
                    >
                      {msg.role !== "user" && (
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-sm border border-[#00E5FF]/50 bg-[#0A1628] shadow-[0_0_8px_rgba(0,229,255,0.3)]">
                          <Bot className="h-4 w-4 text-[#00E5FF]" />
                        </div>
                      )}
                      <div
                        className={cn(
                          "max-w-[75%] rounded-lg border p-3.5 text-sm backdrop-blur-md shadow-lg",
                          msg.role === "user"
                            ? "border-[#00E5FF]/40 bg-[#00E5FF]/10 text-[#EAFBFF]"
                            : "border-[#00E5FF]/15 bg-[#0A1628]/85 text-[#EAFBFF]",
                        )}
                      >
                        <Markdown content={msg.content || ""} />
                      </div>
                      {msg.role === "user" && (
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-sm border border-[#66808C]/40 bg-[#061019]">
                          <User className="h-4 w-4 text-[#66808C]" />
                        </div>
                      )}
                    </div>
                  ))
                ) : (
                  <div className="py-16 text-center text-sm text-[#66808C]">
                    Session initialized. Type a command or question below.
                  </div>
                )}
              </div>
            </div>
          ) : (
            /* Standard Cinematic Arc Reactor HUD Center */
            <div className="relative flex min-h-0 flex-1 flex-col items-center justify-center p-6">
              {/* Dynamic 4-Corner Telemetry HUD Cards around the Core */}
              <div
                className="pointer-events-none relative flex h-[520px] w-[520px] max-w-full items-center justify-center transition-transform duration-300 ease-out"
                style={{
                  transform: `translate3d(${mousePos.x * 12}px, ${mousePos.y * 12}px, 0)`,
                }}
              >
                {/* ── ARC REACTOR SVG RINGS ─────────────────────────────────── */}
                <svg
                  className="absolute inset-0 h-full w-full"
                  viewBox="0 0 500 500"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  {/* Outer Calibration Ring with degree tick marks */}
                  <circle
                    cx="250"
                    cy="250"
                    r="235"
                    stroke="rgba(0, 229, 255, 0.12)"
                    strokeWidth="1.5"
                    strokeDasharray="4 8"
                  />
                  <circle
                    cx="250"
                    cy="250"
                    r="215"
                    stroke="rgba(0, 229, 255, 0.18)"
                    strokeWidth="1"
                  />

                  {/* Rotating Segmented Outer Ring */}
                  <g
                    className="origin-center"
                    style={{
                      animation: "jarvis-core-rotate 35s linear infinite",
                    }}
                  >
                    <circle
                      cx="250"
                      cy="250"
                      r="195"
                      stroke="#00E5FF"
                      strokeWidth="2.5"
                      strokeDasharray="90 35 45 35 120 40"
                      strokeOpacity="0.75"
                    />
                    <circle
                      cx="250"
                      cy="250"
                      r="185"
                      stroke="rgba(117, 247, 255, 0.4)"
                      strokeWidth="1"
                      strokeDasharray="20 10 5 10"
                    />
                  </g>

                  {/* Counter-Rotating Segmented Middle Ring */}
                  <g
                    className="origin-center"
                    style={{
                      animation: "jarvis-core-rotate 22s linear infinite reverse",
                    }}
                  >
                    <circle
                      cx="250"
                      cy="250"
                      r="165"
                      stroke="#75F7FF"
                      strokeWidth="3"
                      strokeDasharray="60 40 10 20 80 30"
                      strokeOpacity="0.8"
                    />
                    <circle
                      cx="250"
                      cy="250"
                      r="150"
                      stroke="rgba(0, 229, 255, 0.25)"
                      strokeWidth="1.5"
                      strokeDasharray="4 4"
                    />
                  </g>

                  {/* Inner Glowing Hex / Dial Ring */}
                  <g
                    className="origin-center"
                    style={{
                      animation: "jarvis-core-rotate 12s linear infinite",
                    }}
                  >
                    <circle
                      cx="250"
                      cy="250"
                      r="128"
                      stroke="#00E5FF"
                      strokeWidth="2"
                      strokeDasharray="30 15 5 15"
                      strokeOpacity="0.9"
                    />
                  </g>

                  {/* Center Triangle Arc Reactor Blueprint */}
                  <polygon
                    points="250,155 330,300 170,300"
                    stroke="#00E5FF"
                    strokeWidth="1.8"
                    fill="rgba(0, 229, 255, 0.04)"
                    strokeDasharray="6 3"
                  />
                  <polygon
                    points="250,325 320,195 180,195"
                    stroke="rgba(117, 247, 255, 0.3)"
                    strokeWidth="1"
                  />
                </svg>

                {/* Top-Left Corner Gauge: CPU */}
                <div
                  className="pointer-events-auto absolute -top-2 left-6 rounded border border-[#00E5FF]/20 bg-[#0A1628]/70 p-2 backdrop-blur-sm transition hover:border-[#00E5FF]/60"
                  style={{
                    transform: `translate3d(${mousePos.x * -6}px, ${mousePos.y * -6}px, 0)`,
                  }}
                >
                  <div className="flex items-center gap-2 text-[10px] font-bold tracking-[0.14em] text-[#66808C] uppercase">
                    <Cpu className="h-3.5 w-3.5 text-[#00E5FF]" />
                    <span>CPU</span>
                  </div>
                  <div className="font-['Rajdhani',sans-serif] text-base font-bold text-[#00E5FF] drop-shadow-[0_0_6px_rgba(0,229,255,0.4)]">
                    {cpuUsage}%
                  </div>
                  <div className="mt-1 h-1 w-16 overflow-hidden rounded-full bg-[#02060B]">
                    <div
                      className="h-full bg-gradient-to-r from-[#00E5FF] to-[#75F7FF] transition-all duration-700"
                      style={{ width: `${cpuUsage}%` }}
                    />
                  </div>
                </div>

                {/* Bottom-Left Corner Gauge: MEMORY */}
                <div
                  className="pointer-events-auto absolute -bottom-2 left-6 rounded border border-[#00E5FF]/20 bg-[#0A1628]/70 p-2 backdrop-blur-sm transition hover:border-[#00E5FF]/60"
                  style={{
                    transform: `translate3d(${mousePos.x * -6}px, ${mousePos.y * -6}px, 0)`,
                  }}
                >
                  <div className="flex items-center gap-2 text-[10px] font-bold tracking-[0.14em] text-[#66808C] uppercase">
                    <Database className="h-3.5 w-3.5 text-[#00E5FF]" />
                    <span>MEMORY</span>
                  </div>
                  <div className="font-['Rajdhani',sans-serif] text-base font-bold text-[#00E5FF] drop-shadow-[0_0_6px_rgba(0,229,255,0.4)]">
                    {memoryUsage}%
                  </div>
                  <div className="mt-1 h-1 w-16 overflow-hidden rounded-full bg-[#02060B]">
                    <div
                      className="h-full bg-gradient-to-r from-[#00E5FF] to-[#75F7FF] transition-all duration-700"
                      style={{ width: `${memoryUsage}%` }}
                    />
                  </div>
                </div>

                {/* Top-Right Corner Gauge: NETWORK */}
                <div
                  className="pointer-events-auto absolute -top-2 right-6 rounded border border-[#00E5FF]/20 bg-[#0A1628]/70 p-2 text-right backdrop-blur-sm transition hover:border-[#00E5FF]/60"
                  style={{
                    transform: `translate3d(${mousePos.x * -6}px, ${mousePos.y * -6}px, 0)`,
                  }}
                >
                  <div className="flex items-center justify-end gap-2 text-[10px] font-bold tracking-[0.14em] text-[#66808C] uppercase">
                    <span>NETWORK</span>
                    <Wifi className="h-3.5 w-3.5 text-[#00E5FF]" />
                  </div>
                  <div className="font-['Rajdhani',sans-serif] text-xs font-bold tracking-wider text-[#00E5FF]">
                    CONNECTED
                  </div>
                  <div className="mt-1 flex justify-end gap-0.5">
                    <div className="h-2 w-1 rounded-sm bg-[#00E5FF]" />
                    <div className="h-2 w-1 rounded-sm bg-[#00E5FF]" />
                    <div className="h-2 w-1 rounded-sm bg-[#00E5FF]" />
                    <div className="h-2 w-1 rounded-sm bg-[#00E5FF]/40" />
                  </div>
                </div>

                {/* Bottom-Right Corner Gauge: SECURITY */}
                <div
                  className="pointer-events-auto absolute -bottom-2 right-6 rounded border border-[#00E5FF]/20 bg-[#0A1628]/70 p-2 text-right backdrop-blur-sm transition hover:border-[#00E5FF]/60"
                  style={{
                    transform: `translate3d(${mousePos.x * -6}px, ${mousePos.y * -6}px, 0)`,
                  }}
                >
                  <div className="flex items-center justify-end gap-2 text-[10px] font-bold tracking-[0.14em] text-[#66808C] uppercase">
                    <span>SECURITY</span>
                    <ShieldCheck className="h-3.5 w-3.5 text-[#00E5FF]" />
                  </div>
                  <div className="flex items-center justify-end gap-1 font-['Rajdhani',sans-serif] text-xs font-bold tracking-wider text-[#00E676]">
                    <span>ACTIVE</span>
                    <span className="text-[10px]">🔒</span>
                  </div>
                  <span className="text-[9px] text-[#66808C]">ENCRYPTED</span>
                </div>

                {/* ── CORE CENTER GLOWING TEXT & SYSTEM ONLINE BUTTON ───────── */}
                <div className="pointer-events-auto flex flex-col items-center justify-center text-center">
                  <h1 className="font-['Rajdhani',sans-serif] text-4xl font-extrabold tracking-[0.35em] text-[#EAFBFF] drop-shadow-[0_0_20px_rgba(0,229,255,0.8)] sm:text-5xl">
                    J.A.R.V.I.S.
                  </h1>
                  <span className="mt-1 text-[10px] font-semibold tracking-[0.25em] text-[#66808C] uppercase">
                    Autonomous Intelligence System
                  </span>

                  {/* Glowing Status Pill Button */}
                  <button
                    onClick={() => {
                      speakText("J.A.R.V.I.S. online and standing by, sir.");
                      toggleMic();
                    }}
                    className="group relative mt-6 flex flex-col items-center rounded-lg border border-[#00E5FF]/50 bg-[#0A1628]/90 px-6 py-2 shadow-[0_0_25px_rgba(0,229,255,0.25)] transition hover:border-[#00E5FF] hover:bg-[#00E5FF]/15 hover:shadow-[0_0_35px_rgba(0,229,255,0.45)] active:scale-95"
                  >
                    <span className="font-['Rajdhani',sans-serif] text-xs font-bold tracking-[0.2em] text-[#00E5FF]">
                      {isListening ? "LISTENING..." : isSpeaking ? "SPEAKING..." : "SYSTEM ONLINE"}
                    </span>
                    <span className="text-[9px] tracking-[0.14em] text-[#66808C] group-hover:text-[#EAFBFF]">
                      {isListening ? "RECORDING SPEECH" : "READY FOR COMMAND"}
                    </span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ── BOTTOM COMMAND COMPOSER ────────────────────────────────────── */}
          <div className="relative z-20 shrink-0 p-4 pt-0">
            <div className="relative flex items-center rounded-xl border border-[#00E5FF]/35 bg-[#0A1628]/80 p-2 backdrop-blur-xl shadow-[0_0_25px_rgba(0,229,255,0.1)] transition focus-within:border-[#00E5FF] focus-within:shadow-[0_0_30px_rgba(0,229,255,0.25)]">
              {/* Left Equalizer Icon */}
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#02060B]/80 text-[#00E5FF]">
                <Radio
                  className={cn(
                    "h-4 w-4 transition-transform",
                    isListening || isSpeaking ? "animate-pulse text-[#00E5FF]" : "text-[#66808C]",
                  )}
                />
              </div>

              {/* Main Prompt Input */}
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    handleSendMessage();
                  }
                }}
                placeholder="Ask anything, sir."
                className="flex-1 bg-transparent px-3 text-sm text-[#EAFBFF] placeholder-[#66808C] outline-none"
              />

              {/* Model Picker Selector */}
              <div className="relative">
                <button
                  onClick={() => setShowModelPicker((prev) => !prev)}
                  className="flex items-center gap-1.5 rounded border border-[#00E5FF]/20 bg-[#061019] px-2.5 py-1 text-xs text-[#66808C] hover:border-[#00E5FF]/60 hover:text-[#00E5FF]"
                >
                  <span className="max-w-[120px] truncate">{currentModel}</span>
                  <ChevronDown className="h-3 w-3" />
                </button>

                {showModelPicker && (
                  <div className="absolute right-0 bottom-full mb-2 w-52 rounded-md border border-[#00E5FF]/30 bg-[#0A1628] py-1 shadow-2xl backdrop-blur-xl">
                    <div className="px-3 py-1 text-[10px] font-bold tracking-wider text-[#66808C] uppercase">
                      Select Neural Model
                    </div>
                    {availableModels.map((m) => (
                      <button
                        key={m}
                        onClick={() => {
                          setCurrentModel(m);
                          setShowModelPicker(false);
                        }}
                        className={cn(
                          "flex w-full items-center justify-between px-3 py-1.5 text-left text-xs transition",
                          currentModel === m
                            ? "bg-[#00E5FF]/15 text-[#00E5FF]"
                            : "text-[#EAFBFF]/80 hover:bg-[#061019] hover:text-[#00E5FF]",
                        )}
                      >
                        <span className="truncate">{m}</span>
                        {currentModel === m && <Check className="h-3 w-3 text-[#00E5FF]" />}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Microphone Voice Toggle */}
              <button
                onClick={toggleMic}
                title={isListening ? "Stop Microphone" : "Speak to JARVIS"}
                className={cn(
                  "ml-2 flex h-8 w-8 items-center justify-center rounded border transition",
                  isListening
                    ? "border-[#00E5FF] bg-[#00E5FF]/30 text-[#00E5FF] shadow-[0_0_12px_#00E5FF]"
                    : "border-[#00E5FF]/20 bg-[#061019] text-[#66808C] hover:border-[#00E5FF]/60 hover:text-[#00E5FF]",
                )}
              >
                {isListening ? <Mic className="h-4 w-4 animate-bounce" /> : <Mic className="h-4 w-4" />}
              </button>

              {/* Speaker / Voice Response Toggle */}
              <button
                onClick={() => setVoiceMuted((prev) => !prev)}
                title={voiceMuted ? "Unmute JARVIS Voice" : "Mute JARVIS Voice"}
                className={cn(
                  "ml-1.5 flex h-8 w-8 items-center justify-center rounded border transition",
                  voiceMuted
                    ? "border-red-500/40 bg-red-500/10 text-red-400"
                    : "border-[#00E5FF]/20 bg-[#061019] text-[#66808C] hover:border-[#00E5FF]/60 hover:text-[#00E5FF]",
                )}
              >
                {voiceMuted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
              </button>

              {/* Glowing Waveform Send Action Button */}
              <button
                onClick={() => handleSendMessage()}
                disabled={isSending || !query.trim()}
                title="Send Command"
                className="ml-2 flex h-9 w-9 items-center justify-center rounded-lg border border-[#00E5FF] bg-[#00E5FF] text-[#02060B] shadow-[0_0_15px_rgba(0,229,255,0.6)] transition hover:bg-[#75F7FF] hover:shadow-[0_0_22px_rgba(0,229,255,0.9)] active:scale-95 disabled:opacity-40"
              >
                <Activity className="h-4 w-4" />
              </button>
            </div>
          </div>
        </main>

        {/* ── RIGHT PANEL: TELEMETRY & INTELLIGENCE DECK ────────────────────── */}
        <aside className="relative flex w-64 shrink-0 flex-col space-y-3 overflow-y-auto border-l border-[#00E5FF]/15 bg-[#02060B]/85 p-3 backdrop-blur-md scrollbar-none">
          {/* Card 1: SYSTEM STATUS (Rotating Arc Reactor) */}
          <div className="rounded-lg border border-[#00E5FF]/20 bg-[#0A1628]/80 p-3 shadow-md backdrop-blur-md">
            <div className="flex items-center justify-between pb-2 text-[10px] font-bold tracking-[0.14em] text-[#66808C] uppercase">
              <span>System Status</span>
              <X className="h-3 w-3 opacity-40 hover:opacity-100" />
            </div>
            <div className="flex items-center justify-center py-2">
              <canvas ref={statusArcCanvasRef} width={80} height={80} className="h-20 w-20" />
            </div>
          </div>

          {/* Card 2: CONNECTION (Live Sine Wave Oscilloscope) */}
          <div className="rounded-lg border border-[#00E5FF]/20 bg-[#0A1628]/80 p-3 shadow-md backdrop-blur-md">
            <div className="flex items-center justify-between text-[10px] font-bold tracking-[0.14em] text-[#66808C] uppercase">
              <span>Connection</span>
              <X className="h-3 w-3 opacity-40 hover:opacity-100" />
            </div>
            <div className="mt-1 font-['Rajdhani',sans-serif] text-xs font-bold tracking-wider text-[#00E5FF]">
              SECURE LINK
            </div>
            <div className="mt-2 h-10 w-full overflow-hidden rounded bg-[#02060B]">
              <canvas ref={waveformCanvasRef} width={220} height={40} className="h-full w-full" />
            </div>
          </div>

          {/* Card 3: DATA STREAM (Matrix Grid) */}
          <div className="rounded-lg border border-[#00E5FF]/20 bg-[#0A1628]/80 p-3 shadow-md backdrop-blur-md">
            <div className="flex items-center justify-between text-[10px] font-bold tracking-[0.14em] text-[#66808C] uppercase">
              <span>Data Stream</span>
              <X className="h-3 w-3 opacity-40 hover:opacity-100" />
            </div>
            <div className="mt-2 h-32 w-full overflow-hidden rounded bg-[#02060B]">
              <canvas ref={dataStreamCanvasRef} width={220} height={128} className="h-full w-full" />
            </div>
          </div>

          {/* Card 4: SYSTEM UPTIME (Digital Clock Counter) */}
          <div className="rounded-lg border border-[#00E5FF]/20 bg-[#0A1628]/80 p-3 shadow-md backdrop-blur-md">
            <div className="flex items-center justify-between text-[10px] font-bold tracking-[0.14em] text-[#66808C] uppercase">
              <span>System Uptime</span>
              <X className="h-3 w-3 opacity-40 hover:opacity-100" />
            </div>
            <div className="mt-2 flex items-center justify-around font-['Rajdhani',sans-serif] text-xl font-bold tracking-widest text-[#00E5FF] drop-shadow-[0_0_8px_rgba(0,229,255,0.4)]">
              <span>{hrs}</span>
              <span className="animate-pulse text-[#66808C]">:</span>
              <span>{mins}</span>
              <span className="animate-pulse text-[#66808C]">:</span>
              <span>{secs}</span>
            </div>
            <div className="mt-1 flex justify-around text-[9px] tracking-widest text-[#66808C] uppercase">
              <span>Hrs</span>
              <span>Mins</span>
              <span>Secs</span>
            </div>
          </div>

          {/* Card 5: CORE TEMP. (Fluctuating Sparkline) */}
          <div className="rounded-lg border border-[#00E5FF]/20 bg-[#0A1628]/80 p-3 shadow-md backdrop-blur-md">
            <div className="flex items-center justify-between text-[10px] font-bold tracking-[0.14em] text-[#66808C] uppercase">
              <span>Core Temp.</span>
              <X className="h-3 w-3 opacity-40 hover:opacity-100" />
            </div>
            <div className="mt-1 flex items-baseline justify-between">
              <span className="font-['Rajdhani',sans-serif] text-xl font-bold text-[#00E5FF] drop-shadow-[0_0_6px_rgba(0,229,255,0.4)]">
                {coreTemp}°C
              </span>
              <span className="text-[10px] font-semibold text-[#00E676]">NOMINAL</span>
            </div>
            <div className="mt-2 h-10 w-full overflow-hidden rounded bg-[#02060B]">
              <canvas ref={tempCanvasRef} width={220} height={40} className="h-full w-full" />
            </div>
          </div>
        </aside>
      </div>

      {/* ── MODALS / SUB-VIEWS ──────────────────────────────────────────────── */}
      {activeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
          <div className="relative max-h-[85vh] w-full max-w-2xl overflow-y-auto rounded-xl border border-[#00E5FF]/40 bg-[#0A1628] p-6 shadow-2xl backdrop-blur-xl">
            <div className="flex items-center justify-between border-b border-[#00E5FF]/20 pb-3">
              <h3 className="font-['Rajdhani',sans-serif] text-lg font-bold tracking-wider text-[#00E5FF] uppercase">
                {activeModal}
              </h3>
              <button
                onClick={() => setActiveModal(null)}
                className="rounded p-1 text-[#66808C] hover:bg-[#061019] hover:text-[#00E5FF]"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="py-4 text-sm text-[#EAFBFF]">
              {activeModal === "capabilities" && (
                <div className="space-y-3">
                  <p className="text-xs text-[#66808C]">
                    Integrated system capabilities and connected MCP toolsets:
                  </p>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="rounded border border-[#00E5FF]/20 bg-[#061019] p-2.5">
                      <div className="font-bold text-[#00E5FF]">Web & Research</div>
                      <div className="text-[11px] text-[#66808C]">Search, scrape, parse live data</div>
                    </div>
                    <div className="rounded border border-[#00E5FF]/20 bg-[#061019] p-2.5">
                      <div className="font-bold text-[#00E5FF]">Terminal & Code Exec</div>
                      <div className="text-[11px] text-[#66808C]">PTY, sandbox, automated builds</div>
                    </div>
                    <div className="rounded border border-[#00E5FF]/20 bg-[#061019] p-2.5">
                      <div className="font-bold text-[#00E5FF]">Computer Use & Vision</div>
                      <div className="text-[11px] text-[#66808C]">Screen capture, OCR, automation</div>
                    </div>
                    <div className="rounded border border-[#00E5FF]/20 bg-[#061019] p-2.5">
                      <div className="font-bold text-[#00E5FF]">Multi-Channel Messaging</div>
                      <div className="text-[11px] text-[#66808C]">Telegram, Discord, WhatsApp, Slack</div>
                    </div>
                  </div>
                </div>
              )}

              {activeModal === "messaging" && (
                <div className="space-y-3 text-xs">
                  <p className="text-[#66808C]">Active external communication links:</p>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between rounded border border-[#00E5FF]/20 bg-[#061019] p-2">
                      <span className="font-bold">Telegram Gateway</span>
                      <span className="text-[#00E676]">CONNECTED</span>
                    </div>
                    <div className="flex items-center justify-between rounded border border-[#00E5FF]/20 bg-[#061019] p-2">
                      <span className="font-bold">Discord Integration</span>
                      <span className="text-[#00E676]">ACTIVE</span>
                    </div>
                    <div className="flex items-center justify-between rounded border border-[#00E5FF]/20 bg-[#061019] p-2">
                      <span className="font-bold">WhatsApp Business API</span>
                      <span className="text-[#00E5FF]">CONFIGURED</span>
                    </div>
                  </div>
                </div>
              )}

              {activeModal === "artifacts" && (
                <div className="space-y-2 text-xs">
                  <p className="text-[#66808C]">Generated workspace artifacts and saved files:</p>
                  <div className="rounded border border-[#00E5FF]/20 bg-[#061019] p-3 text-center text-[#66808C]">
                    All output files, downloads, and generated media are synchronized with your local workspace.
                  </div>
                </div>
              )}

              {activeModal === "scheduled" && (
                <div className="space-y-2 text-xs">
                  <p className="text-[#66808C]">Scheduled automated Cron jobs:</p>
                  <div className="rounded border border-[#00E5FF]/20 bg-[#061019] p-3 text-center text-[#66808C]">
                    System heartbeat active. No pending background cron tasks.
                  </div>
                </div>
              )}

              {activeModal === "settings" && (
                <div className="space-y-3 text-xs">
                  <p className="text-[#66808C]">System & UI Preferences:</p>
                  <div className="flex items-center justify-between rounded border border-[#00E5FF]/20 bg-[#061019] p-2.5">
                    <span>Active Theme</span>
                    <span className="font-bold text-[#00E5FF]">J.A.R.V.I.S. Cinematic</span>
                  </div>
                  <div className="flex items-center justify-between rounded border border-[#00E5FF]/20 bg-[#061019] p-2.5">
                    <span>Speech Synthesis Rate</span>
                    <span className="font-bold text-[#00E5FF]">1.05x</span>
                  </div>
                  <div className="flex items-center justify-between rounded border border-[#00E5FF]/20 bg-[#061019] p-2.5">
                    <span>Interactive Parallax Movement</span>
                    <span className="font-bold text-[#00E676]">ENABLED</span>
                  </div>
                </div>
              )}
            </div>

            <div className="flex justify-end border-t border-[#00E5FF]/20 pt-3">
              <button
                onClick={() => setActiveModal(null)}
                className="rounded border border-[#00E5FF]/50 bg-[#00E5FF]/20 px-4 py-1.5 text-xs font-bold text-[#00E5FF] hover:bg-[#00E5FF]/30"
              >
                Dismiss
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
