import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  ChefHat,
  Lock,
  ArrowLeft,
  Plus,
  Minus,
  Trash2,
  Pencil,
  QrCode,
  Check,
  X,
  Loader2,
  ShoppingBag,
  ImagePlus,
  RefreshCw,
  LogOut,
  Mail,
  Home,
  Users,
  HelpCircle,
  Bell,
  ShoppingCart,
  Search,
  Eye,
  EyeOff,
  Sun,
  Moon,
  Settings,
  MessageCircle,
} from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

/* ---------------------------------------------------------------
   Helpers
--------------------------------------------------------------- */

function todayStr() {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function prettyDate(dateStr) {
  const [y, m, d] = dateStr.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  return dt.toLocaleDateString("en-MY", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
}

function money(n) {
  return `RM ${Number(n || 0).toFixed(2)}`;
}

function uid(prefix) {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

// A random ID persisted in this browser's localStorage, so the same
// device can be recognized across visits even if the person types a
// different name each time. This is what makes blocking "stick" — name
// matching alone can always be beaten by typing something else.
// Limitation: it's tied to this browser/device, not a real identity — it
// resets if they clear site data, use a different browser, or a different
// phone, so it raises the bar rather than being unbeatable.
function getDeviceId() {
  try {
    let id = localStorage.getItem("lunchOrderDeviceId");
    if (!id) {
      id =
        typeof crypto !== "undefined" && crypto.randomUUID
          ? crypto.randomUUID()
          : uid("dev");
      localStorage.setItem("lunchOrderDeviceId", id);
    }
    return id;
  } catch (e) {
    return null;
  }
}

// Firestore documents have a hard 1MB limit. A raw iOS screenshot —
// especially one with a photo-rich ad banner, like a payment-app screen —
// can be large enough on its own to blow past that once base64-encoded,
// which made orders silently fail to save even though the app showed
// "submitted". Resizing + re-compressing every uploaded image keeps it
// comfortably small regardless of what the original screenshot contained.
function compressImageFile(file, maxDim = 1280, quality = 0.72) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        let { width, height } = img;
        if (width > maxDim || height > maxDim) {
          if (width > height) {
            height = Math.round((height * maxDim) / width);
            width = maxDim;
          } else {
            width = Math.round((width * maxDim) / height);
            height = maxDim;
          }
        }
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, width, height);
        try {
          resolve(canvas.toDataURL("image/jpeg", quality));
        } catch (e) {
          reject(e);
        }
      };
      img.onerror = reject;
      img.src = reader.result;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function itemLabel(it) {
  return it.extraName ? `${it.name} (${it.extraName})` : it.name;
}

// Used specifically for the admin's item-quantity summary/tally, so
// "small"/"big"-style variants are counted separately whether the admin
// put that distinction in "Extra dish name" or in "Description".
function summaryLabel(it) {
  if (it.extraName) return `${it.name} (${it.extraName})`;
  if (it.desc) return `${it.name} (${it.desc})`;
  return it.name;
}

function normalizeName(s) {
  return (s || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

// Matches a typed name against a blocked entry even if one is a partial
// version of the other. Two strategies combined:
// 1. Word-based: "Jun Yang" matches "Gan Jun Yang" because every word in
//    one is found in the other (handles space-separated names safely,
//    without flagging someone mid-typing a different similar name).
// 2. Length-gated substring: catches names with no spaces (e.g. Chinese
//    characters) where word-splitting doesn't apply, but only once at
//    least 4 characters are typed, to avoid false positives on the first
//    couple of keystrokes.
// It cannot match across languages/scripts on its own — an English name
// won't match a Chinese name for the same person — so for colleagues who
// might type either, add both as separate entries in the Blocked tab.
function namesMatch(typed, blocked) {
  const t = normalizeName(typed);
  const b = normalizeName(blocked);
  if (!t || !b) return false;
  if (t === b) return true;

  const tWords = t.split(" ").filter(Boolean);
  const bWords = b.split(" ").filter(Boolean);
  if (tWords.length > 1 || bWords.length > 1) {
    const tSubsetOfB = tWords.every((w) => bWords.includes(w));
    const bSubsetOfT = bWords.every((w) => tWords.includes(w));
    if (tSubsetOfB || bSubsetOfT) return true;
  }

  if (t.length >= 4 && b.length >= 4 && (t.includes(b) || b.includes(t))) {
    return true;
  }
  return false;
}

import { storageGet, storageSet, storageDelete, storageList } from "./storage";

function statusLabel(status) {
  if (status === "confirmed") return "paid";
  if (status === "rejected") return "not paid";
  return "pending";
}

function toneForStatus(status) {
  if (status === "confirmed") return "confirmed";
  if (status === "rejected") return "rejected";
  return "pending";
}

function paymentMethodLabel(method) {
  if (method === "cash") return "Cash";
  if (method === "bank") return "Bank";
  return "TnG";
}

/* ---------------------------------------------------------------
   Small UI atoms
--------------------------------------------------------------- */

function Stamp({ children, tone = "pending" }) {
  const tones = {
    pending: "border-[#B8842E] text-[#B8842E]",
    confirmed: "border-[#1F5F5B] text-[#1F5F5B]",
    rejected: "border-[#B33A2E] text-[#B33A2E]",
    later: "border-[#6B5CA5] text-[#6B5CA5]",
  };
  return (
    <span
      className={`inline-block border-2 rounded-sm px-2 py-0.5 text-[10px] tracking-wide font-bold uppercase -rotate-2 ${tones[tone]}`}
      style={{ fontFamily: "'Inter', sans-serif" }}
    >
      {children}
    </span>
  );
}

function Spinner({ label }) {
  return (
    <div className="flex items-center justify-center gap-2 py-16 text-[var(--text-muted)]">
      <Loader2 className="w-5 h-5 animate-spin" />
      <span className="text-sm">{label}</span>
    </div>
  );
}

function DashedDivider() {
  return (
    <div className="w-full border-t-2 border-dashed my-3" style={{ borderColor: "var(--border-c)" }} />
  );
}

function BackRow({ onBack, label }) {
  return (
    <button onClick={onBack} className="flex items-center gap-1.5 text-sm text-[var(--text-muted)]">
      <ArrowLeft className="w-4 h-4" />
      {label}
    </button>
  );
}

function BottomNav({ active, onNavigate, cartCount }) {
  const tabs = [
    { id: "menu", label: "Menu", icon: Home },
    { id: "others", label: "Others", icon: Users },
    { id: "help", label: "Help", icon: HelpCircle },
    { id: "status", label: "Status", icon: Bell },
    { id: "cart", label: "Cart", icon: ShoppingCart, badge: cartCount },
  ];
  return (
    <div
      className="fixed bottom-0 left-0 right-0 flex justify-center z-40"
      style={{ background: "var(--bg-card)", borderTop: "1px solid #DCD3C2" }}
    >
      <div className="w-full max-w-md flex items-stretch">
        {tabs.map((t) => {
          const Icon = t.icon;
          const isActive = active === t.id;
          const disabled = t.id === "cart" && !cartCount;
          return (
            <button
              key={t.id}
              onClick={() => !disabled && onNavigate(t.id)}
              disabled={disabled}
              className="flex-1 flex flex-col items-center justify-center py-2.5 gap-0.5 disabled:opacity-35"
            >
              <div className="relative">
                <Icon className="w-5 h-5" style={{ color: isActive ? "#1F5F5B" : "#B3A992" }} />
                {!!t.badge && (
                  <span
                    className="absolute -top-1.5 -right-2 min-w-[16px] h-4 px-1 rounded-full flex items-center justify-center text-[9px] font-bold fo-num"
                    style={{ background: "#B33A2E", color: "#FFFFFF" }}
                  >
                    {t.badge}
                  </span>
                )}
              </div>
              <span
                className="text-[10px] font-medium"
                style={{ color: isActive ? "#1F5F5B" : "#B3A992" }}
              >
                {t.label}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function ThemeToggleButton({ darkMode, onToggle }) {
  return (
    <button
      onClick={onToggle}
      className="w-9 h-9 rounded-full flex items-center justify-center border shrink-0"
      style={{ borderColor: "var(--border-c)" }}
      title={darkMode ? "Switch to light mode" : "Switch to dark mode"}
    >
      {darkMode ? (
        <Sun className="w-4 h-4" style={{ color: "var(--text-muted)" }} />
      ) : (
        <Moon className="w-4 h-4" style={{ color: "var(--text-muted)" }} />
      )}
    </button>
  );
}

// Simple swipe-down-to-refresh: only activates when the page is already
// scrolled to the very top (so it doesn't interfere with normal scrolling
// further down), and calls onRefresh once the drag passes a threshold.
// Works the same way in a regular mobile browser tab and in a "added to
// home screen" standalone app, unlike the browser's own native
// pull-to-refresh, which only works in a normal browser tab.
function PullToRefresh({ onRefresh, children }) {
  const [pullDistance, setPullDistance] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const startYRef = useRef(null);
  const pullingRef = useRef(false);
  const refreshingRef = useRef(false);
  const containerRef = useRef(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    async function doRefresh() {
      refreshingRef.current = true;
      setRefreshing(true);
      setPullDistance(48);
      try {
        await onRefresh();
      } finally {
        refreshingRef.current = false;
        setRefreshing(false);
        setPullDistance(0);
      }
    }

    function handleTouchStart(e) {
      if (window.scrollY <= 0 && !refreshingRef.current) {
        startYRef.current = e.touches[0].clientY;
        pullingRef.current = true;
      } else {
        startYRef.current = null;
        pullingRef.current = false;
      }
    }

    function handleTouchMove(e) {
      if (!pullingRef.current || startYRef.current == null) return;
      const delta = e.touches[0].clientY - startYRef.current;
      if (delta > 0 && window.scrollY <= 0) {
        // Must actually prevent the default here (requires a non-passive
        // listener) — otherwise Android's own "pull down to reload"
        // fires at the same time and does a full page reload, wiping
        // all app state and dropping back to the very first screen.
        e.preventDefault();
        setPullDistance(Math.min(delta * 0.5, 70));
      } else {
        pullingRef.current = false;
        setPullDistance(0);
      }
    }

    function handleTouchEnd() {
      if (!pullingRef.current) return;
      pullingRef.current = false;
      startYRef.current = null;
      setPullDistance((current) => {
        if (current > 48 && !refreshingRef.current) {
          doRefresh();
          return current;
        }
        return 0;
      });
    }

    el.addEventListener("touchstart", handleTouchStart, { passive: true });
    el.addEventListener("touchmove", handleTouchMove, { passive: false });
    el.addEventListener("touchend", handleTouchEnd, { passive: true });
    el.addEventListener("touchcancel", handleTouchEnd, { passive: true });

    return () => {
      el.removeEventListener("touchstart", handleTouchStart);
      el.removeEventListener("touchmove", handleTouchMove);
      el.removeEventListener("touchend", handleTouchEnd);
      el.removeEventListener("touchcancel", handleTouchEnd);
    };
  }, [onRefresh]);

  return (
    <div ref={containerRef} style={{ overscrollBehaviorY: "contain" }}>
      <div
        className="flex items-center justify-center overflow-hidden"
        style={{
          height: pullDistance,
          transition: refreshing ? "none" : "height 0.15s ease-out",
        }}
      >
        {pullDistance > 8 && (
          <Loader2
            className={`w-5 h-5 ${refreshing ? "animate-spin" : ""}`}
            style={{
              color: "#1F5F5B",
              transform: refreshing ? "none" : `rotate(${pullDistance * 4}deg)`,
            }}
          />
        )}
      </div>
      {children}
    </div>
  );
}

function Shell({ children, darkMode }) {
  return (
    <div
      className={`min-h-[100dvh] w-full flex justify-center ${darkMode ? "dark" : ""}`}
      style={{ background: "var(--bg-page)" }}
    >
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,400;0,9..144,600;0,9..144,700;1,9..144,500&family=Inter:wght@400;500;600;700&display=swap');
        :root {
          --bg-page: #FAF6EE;
          --bg-card: #FFFFFF;
          --border-c: #DCD3C2;
          --border-light: #EEE7D8;
          --text-primary: #241F1A;
          --text-muted: #7A7166;
          --text-faint: #B3A992;
        }
        .dark {
          --bg-page: #1C1A17;
          --bg-card: #26231F;
          --border-c: #3D3833;
          --border-light: #332F2A;
          --text-primary: #F2EDE4;
          --text-muted: #B9AFA0;
          --text-faint: #8C8275;
        }
        .fo-serif { font-family: 'Fraunces', serif; }
        .fo-sans { font-family: 'Inter', sans-serif; }
        .fo-num { font-variant-numeric: tabular-nums; }
        html, body { overscroll-behavior-y: contain; }
      `}</style>
      <div className="w-full max-w-md min-h-[100dvh] fo-sans" style={{ color: "var(--text-primary)" }}>
        {children}
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------
   Root App
--------------------------------------------------------------- */

export default function FoodOrderApp() {
  const [screen, setScreen] = useState("home"); // home | user | adminLogin | admin
  const [booting, setBooting] = useState(true);
  const [menu, setMenu] = useState({ isOpen: true, dishes: [], updatedAt: null });
  const [qr, setQr] = useState({ imageDataUrl: "", payeeName: "", note: "" });
  const [blocklist, setBlocklist] = useState([]);
  const [blockedDevices, setBlockedDevices] = useState([]);
  const [orderResetKey, setOrderResetKey] = useState(0);
  const [adminSessionId, setAdminSessionId] = useState(null);
  const [darkMode, setDarkMode] = useState(() => {
    try {
      return localStorage.getItem("lunchOrderDarkMode") === "1";
    } catch (e) {
      return false;
    }
  });

  function toggleDarkMode() {
    setDarkMode((v) => {
      const next = !v;
      try {
        localStorage.setItem("lunchOrderDarkMode", next ? "1" : "0");
      } catch (e) {}
      return next;
    });
  }

  const loadCore = useCallback(async () => {
    const [menuVal, qrVal, blocklistVal, blockedDevicesVal] = await Promise.all([
      storageGet("menu:current"),
      storageGet("payment:qr"),
      storageGet("admin:blocklist"),
      storageGet("admin:blockedDevices"),
    ]);
    if (menuVal) {
      try {
        setMenu(JSON.parse(menuVal));
      } catch (e) {}
    }
    if (qrVal) {
      try {
        setQr(JSON.parse(qrVal));
      } catch (e) {}
    }
    if (blocklistVal) {
      try {
        setBlocklist(JSON.parse(blocklistVal));
      } catch (e) {}
    }
    if (blockedDevicesVal) {
      try {
        setBlockedDevices(JSON.parse(blockedDevicesVal));
      } catch (e) {}
    }
    setBooting(false);
  }, []);

  useEffect(() => {
    loadCore();
  }, [loadCore]);

  const saveMenu = useCallback(async (nextMenu) => {
    setMenu(nextMenu);
    await storageSet("menu:current", JSON.stringify(nextMenu));
  }, []);

  const saveQr = useCallback(async (nextQr) => {
    setQr(nextQr);
    await storageSet("payment:qr", JSON.stringify(nextQr));
  }, []);

  if (booting) {
    return (
      <Shell darkMode={darkMode}>
        <Spinner label="Opening today's menu…" />
      </Shell>
    );
  }

  return (
    <Shell darkMode={darkMode}>
      {screen === "home" && (
        <HomeScreen
          menu={menu}
          onOrder={() => setScreen("user")}
          onAdmin={() => setScreen("adminLogin")}
        />
      )}
      {screen === "user" && (
        <UserFlow
          key={orderResetKey}
          menu={menu}
          qr={qr}
          blocklist={blocklist}
          blockedDevices={blockedDevices}
          darkMode={darkMode}
          onToggleDarkMode={toggleDarkMode}
          onBack={() => setScreen("home")}
          onRefreshMenu={loadCore}
          onDone={() => {
            setOrderResetKey((k) => k + 1);
            setScreen("home");
          }}
        />
      )}
      {screen === "adminLogin" && (
        <AdminLogin
          onBack={() => setScreen("home")}
          onSuccess={(sessionId) => {
            setAdminSessionId(sessionId);
            setScreen("admin");
          }}
        />
      )}
      {screen === "admin" && (
        <AdminPanel
          menu={menu}
          qr={qr}
          onSaveMenu={saveMenu}
          onSaveQr={saveQr}
          sessionId={adminSessionId}
          onLock={async () => {
            await storageDelete("admin:activeSession");
            setAdminSessionId(null);
            setScreen("home");
          }}
          darkMode={darkMode}
          onToggleDarkMode={toggleDarkMode}
        />
      )}
    </Shell>
  );
}

/* ---------------------------------------------------------------
   Home / role select
--------------------------------------------------------------- */

function HomeScreen({ menu, onOrder, onAdmin }) {
  const dishCount = menu.dishes?.length || 0;
  return (
    <div className="px-6 pt-14 pb-10 flex flex-col min-h-[100dvh]">
      <div className="flex-1">
        <div className="flex items-center gap-2 text-[#B8842E] mb-3">
          <ChefHat className="w-5 h-5" />
          <span className="text-xs uppercase tracking-wider font-semibold">
            {prettyDate(todayStr())}
          </span>
        </div>
        <h1 className="fo-serif text-4xl leading-tight mb-2" style={{ color: "var(--text-primary)" }}>
          What's on
          <br />
          today's order?
        </h1>
        <p className="text-[var(--text-muted)] text-sm mb-10">
          {dishCount > 0
            ? `${dishCount} dish${dishCount > 1 ? "es" : ""} posted for today.${
                menu.isOpen ? "" : " Ordering is currently closed."
              }`
            : "No dishes posted yet — check back soon."}
        </p>

        <button
          onClick={onOrder}
          disabled={!menu.isOpen}
          className="w-full text-left rounded-lg p-5 mb-4 flex items-center justify-between transition-transform active:scale-[0.98] disabled:active:scale-100"
          style={{
            background: menu.isOpen ? "#1F7A4C" : "#B33A2E",
            color: "#FAF6EE",
            opacity: menu.isOpen ? 1 : 0.85,
            cursor: menu.isOpen ? "pointer" : "not-allowed",
          }}
        >
          <div>
            <div className="fo-serif text-xl mb-1">Order lunch</div>
            <div className="text-xs opacity-80">
              {menu.isOpen ? "Pick your dishes and pay" : "Ordering is closed right now"}
            </div>
          </div>
          <ShoppingBag className="w-6 h-6 shrink-0" />
        </button>

        <button
          onClick={onAdmin}
          className="w-full text-left rounded-lg p-5 flex items-center justify-between border transition-transform active:scale-[0.98]"
          style={{ borderColor: "var(--border-c)", background: "transparent" }}
        >
          <div>
            <div className="fo-serif text-xl mb-1" style={{ color: "var(--text-primary)" }}>
              Admin
            </div>
            <div className="text-xs text-[var(--text-muted)]">Update dishes &amp; check payments</div>
          </div>
          <Lock className="w-5 h-5 shrink-0 text-[var(--text-muted)]" />
        </button>
      </div>

      <p className="text-center text-[10px] text-[var(--text-faint)] mt-10">
        Develop for internal use.
      </p>
    </div>
  );
}

/* ---------------------------------------------------------------
   User ordering flow
--------------------------------------------------------------- */

function UserFlow({
  menu,
  qr,
  blocklist,
  blockedDevices,
  darkMode,
  onToggleDarkMode,
  onBack,
  onRefreshMenu,
  onDone,
}) {
  const [step, setStep] = useState("name"); // name | menu | checkout | submitted
  const [name, setName] = useState("");
  const [deviceId] = useState(() => getDeviceId());
  const [cart, setCart] = useState({}); // `${dishId}__${sizeId||"base"}` -> {dishId, sizeId, qty}
  const [customItems, setCustomItems] = useState([]); // [{id, name, qty}]
  const [dishOptionSelections, setDishOptionSelections] = useState({}); // dishId -> {groupId: choiceId}
  const [dishSizeSelections, setDishSizeSelections] = useState({}); // dishId -> sizeId
  const [detailDish, setDetailDish] = useState(null);
  const [modalQty, setModalQty] = useState(1);
  const [customFoodName, setCustomFoodName] = useState("");
  const [proofImage, setProofImage] = useState("");
  const [proofUploading, setProofUploading] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [menuSearch, setMenuSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [submittedOrder, setSubmittedOrder] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [qrZoomed, setQrZoomed] = useState(false);
  const [closedMessage, setClosedMessage] = useState("");
  const [othersOrders, setOthersOrders] = useState([]);
  const [othersLoading, setOthersLoading] = useState(false);
  const [othersLoaded, setOthersLoaded] = useState(false);
  const [myOrders, setMyOrders] = useState([]);
  const [myStatusLoading, setMyStatusLoading] = useState(false);

  async function loadOthersOrders() {
    setOthersLoading(true);
    const keys = await storageList(`order:${todayStr()}:`);
    const results = await Promise.all(
      keys.map(async (k) => {
        const val = await storageGet(k);
        if (!val) return null;
        try {
          return JSON.parse(val);
        } catch (e) {
          return null;
        }
      })
    );
    setOthersOrders(results.filter(Boolean).filter((o) => o.status !== "rejected"));
    setOthersLoading(false);
    setOthersLoaded(true);
  }

  async function loadMyStatus() {
    setMyStatusLoading(true);
    const keys = await storageList("order:");
    const results = await Promise.all(
      keys.map(async (k) => {
        const val = await storageGet(k);
        if (!val) return null;
        try {
          return { key: k, ...JSON.parse(val) };
        } catch (e) {
          return null;
        }
      })
    );
    const today = todayStr();
    // Show everything from today (paid or not), plus anything from an
    // earlier day that's still unpaid — so an unpaid name doesn't quietly
    // disappear the next day just because the date changed.
    setMyOrders(
      results
        .filter(Boolean)
        .filter((o) => o.date === today || o.status !== "confirmed")
        .sort((a, b) => b.createdAt - a.createdAt)
    );
    setMyStatusLoading(false);
  }

  function handleNavigate(dest) {
    if (dest === "cart") {
      setStep("checkout");
      return;
    }
    setStep(dest);
    if (dest === "others" && !othersLoaded) loadOthersOrders();
    if (dest === "status") loadMyStatus();
  }

  useEffect(() => {
    onRefreshMenu();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // While the colleague is browsing the menu or at checkout (not yet
  // submitted), periodically re-check whether the admin has closed
  // ordering, and if so, send them back to the start.
  useEffect(() => {
    if (step !== "menu" && step !== "checkout") return;
    const interval = setInterval(async () => {
      const freshMenuVal = await storageGet("menu:current");
      if (!freshMenuVal) return;
      try {
        const freshMenu = JSON.parse(freshMenuVal);
        if (freshMenu.isOpen === false) {
          onClosedMidOrder();
        }
      } catch (e) {}
    }, 15000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step]);

  function onClosedMidOrder() {
    setClosedMessage("Ordering just closed while you were choosing — please check with the admin.");
    setStep("name");
  }

  const dishes = menu.dishes || [];
  const dishItems = Object.entries(cart)
    .filter(([, c]) => c.qty > 0)
    .map(([key, c]) => {
      const dish = dishes.find((d) => d.id === c.dishId);
      if (!dish) return null;
      let price = dish.price;
      let sizeLabel = "";
      if (c.sizeId && dish.sizes) {
        const size = dish.sizes.find((s) => s.id === c.sizeId);
        if (size) {
          price = size.price;
          sizeLabel = size.label;
        }
      }
      const optionChoices = c.choices || [];
      const optionsPriceTotal = optionChoices.reduce((s, o) => s + (o.priceAdj || 0), 0);
      const comboLabel = [sizeLabel, ...optionChoices.map((o) => o.label)].filter(Boolean).join(", ");
      return {
        dishId: key,
        name: dish.name,
        extraName: comboLabel || dish.extraName || "",
        desc: dish.desc || "",
        price: price + optionsPriceTotal,
        qty: c.qty,
      };
    })
    .filter(Boolean);
  const offMenuPrice = menu.customPrice != null ? menu.customPrice : 0;
  const offMenuItems = customItems.map((c) => ({
    dishId: c.id,
    name: c.name,
    desc: "Off-menu request",
    price: offMenuPrice,
    qty: c.qty,
    custom: true,
  }));
  const items = [...dishItems, ...offMenuItems];
  const total = items.reduce((sum, it) => sum + it.price * it.qty, 0);

  // Colleagues configure size + custom options (e.g. sambal/ice/sugar
  // level) before adding a dish — this tracks their current in-progress
  // choice per dish, defaulting to the first option in each group.
  function getSelectedChoiceId(dish, group) {
    return dishOptionSelections[dish.id]?.[group.id] ?? (group.choices[0] && group.choices[0].id);
  }
  function setOptionChoice(dishId, groupId, choiceId) {
    setDishOptionSelections((prev) => ({
      ...prev,
      [dishId]: { ...(prev[dishId] || {}), [groupId]: choiceId },
    }));
  }
  function getSelectedSizeId(dish) {
    if (!dish.sizes || dish.sizes.length === 0) return null;
    return dishSizeSelections[dish.id] ?? dish.sizes[0].id;
  }
  function setSizeChoice(dishId, sizeId) {
    setDishSizeSelections((prev) => ({ ...prev, [dishId]: sizeId }));
  }
  function getDishTotalQty(dishId) {
    return Object.values(cart)
      .filter((c) => c.dishId === dishId)
      .reduce((s, c) => s + c.qty, 0);
  }
  function getComboKey(dish, sizeId) {
    const groups = dish.optionGroups || [];
    const choiceIds = groups.map((g) => getSelectedChoiceId(dish, g)).filter(Boolean).sort();
    return `${dish.id}__${sizeId || "base"}__${choiceIds.join(",")}`;
  }
  function setCartQty(dish, sizeId, qty) {
    const key = getComboKey(dish, sizeId);
    const groups = dish.optionGroups || [];
    const choices = groups
      .map((g) => {
        const choiceId = getSelectedChoiceId(dish, g);
        const choice = g.choices.find((c) => c.id === choiceId);
        return choice ? { label: choice.label, priceAdj: choice.priceAdj } : null;
      })
      .filter(Boolean);
    setCart((c) => ({
      ...c,
      [key]: { dishId: dish.id, sizeId: sizeId || null, choices, qty: Math.max(0, qty) },
    }));
  }
  function getCartQty(dish, sizeId) {
    return cart[getComboKey(dish, sizeId)]?.qty || 0;
  }

  function addCustomItem() {
    if (!customFoodName.trim()) return;
    setCustomItems((prev) => [...prev, { id: uid("c"), name: customFoodName.trim(), qty: 1 }]);
    setCustomFoodName("");
  }

  function setCustomItemQty(id, qty) {
    if (qty <= 0) {
      setCustomItems((prev) => prev.filter((c) => c.id !== id));
      return;
    }
    setCustomItems((prev) => prev.map((c) => (c.id === id ? { ...c, qty } : c)));
  }

  // Lets colleagues tweak or remove an item right on the checkout screen,
  // in case they change their mind, without going back to the menu.
  // `it.dishId` is either a cart key (regular/sized/customized dish) or a
  // custom-item id (off-menu request) — resolved to the right underlying
  // state accordingly.
  function adjustCheckoutItemQty(it, delta) {
    if (it.custom) {
      const current = customItems.find((c) => c.id === it.dishId)?.qty || 0;
      setCustomItemQty(it.dishId, current + delta);
      return;
    }
    setCart((prev) => {
      const entry = prev[it.dishId];
      if (!entry) return prev;
      const nextQty = Math.max(0, entry.qty + delta);
      if (nextQty === 0) {
        const next = { ...prev };
        delete next[it.dishId];
        return next;
      }
      return { ...prev, [it.dishId]: { ...entry, qty: nextQty } };
    });
  }

  function removeCheckoutItem(it) {
    if (it.custom) {
      setCustomItems((prev) => prev.filter((c) => c.id !== it.dishId));
      return;
    }
    setCart((prev) => {
      const next = { ...prev };
      delete next[it.dishId];
      return next;
    });
  }

  function handleProofFile(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setProofUploading(true);
    compressImageFile(file)
      .then((dataUrl) => {
        setProofImage(dataUrl);
        setProofUploading(false);
      })
      .catch(() => {
        // Fall back to the raw file if compression fails for any reason
        // (better to risk a large upload than block them entirely).
        const reader = new FileReader();
        reader.onload = () => {
          setProofImage(reader.result);
          setProofUploading(false);
        };
        reader.onerror = () => setProofUploading(false);
        reader.readAsDataURL(file);
      });
  }

  async function handleSubmitOrder() {
    // Re-check ordering is still open right before submitting, in case
    // the admin closed it while this colleague was mid-order.
    setSubmitting(true);
    const freshMenuVal = await storageGet("menu:current");
    let stillOpen = menu.isOpen;
    if (freshMenuVal) {
      try {
        stillOpen = JSON.parse(freshMenuVal).isOpen !== false;
      } catch (e) {}
    }
    if (!stillOpen) {
      setSubmitting(false);
      onClosedMidOrder();
      return;
    }

    // Re-check the blocklist too, in case the admin blocked this person
    // while they were mid-order. Checks both the typed name AND this
    // browser's device ID, so a block sticks even if they try a different
    // name from the same device.
    const [freshBlocklistVal, freshBlockedDevicesVal] = await Promise.all([
      storageGet("admin:blocklist"),
      storageGet("admin:blockedDevices"),
    ]);
    let freshBlocklist = blocklist || [];
    if (freshBlocklistVal) {
      try {
        freshBlocklist = JSON.parse(freshBlocklistVal);
      } catch (e) {}
    }
    let freshBlockedDevices = blockedDevices || [];
    if (freshBlockedDevicesVal) {
      try {
        freshBlockedDevices = JSON.parse(freshBlockedDevicesVal);
      } catch (e) {}
    }
    const nameBlocked = freshBlocklist.some((n) => namesMatch(name, n));
    const deviceBlocked = deviceId && freshBlockedDevices.some((d) => d.deviceId === deviceId);
    if (nameBlocked || deviceBlocked) {
      setSubmitting(false);
      setClosedMessage(
        "Order unsuccessful — you have a pending payment from a previous order. Please settle up with the admin before ordering again."
      );
      setStep("name");
      return;
    }

    const order = {
      id: uid("o"),
      date: todayStr(),
      name: name.trim(),
      items,
      total,
      paymentMethod: "tng",
      proofImage,
      deviceId: deviceId || null,
      // Trust the uploaded screenshot by default and mark paid right away —
      // the admin reviews the screenshot afterward and can flip this to
      // "not paid" if it looks fake, or tag it as cash/bank instead.
      status: proofImage ? "confirmed" : "submitted",
      createdAt: Date.now(),
    };
    const saved = await storageSet(`order:${order.date}:${order.id}`, JSON.stringify(order));
    if (!saved) {
      setSubmitting(false);
      setSubmitError(
        "Couldn't submit your order — please try again. If this keeps happening, try a smaller/lighter screenshot."
      );
      return;
    }
    setSubmitError("");
    setSubmittedOrder(order);
    setSubmitting(false);
    setStep("submitted");
  }

  if (step === "name") {
    const isDeviceBlocked =
      deviceId && (blockedDevices || []).some((d) => d.deviceId === deviceId);
    const isBlocked =
      isDeviceBlocked ||
      (name.trim() !== "" && (blocklist || []).some((n) => namesMatch(name, n)));
    return (
      <div className="px-6 pt-8 pb-10 min-h-[100dvh] flex flex-col">
        <BackRow onBack={onBack} label="Home" />
        <h2 className="fo-serif text-2xl mt-6 mb-1">Who's ordering?</h2>
        <p className="text-sm text-[var(--text-muted)] mb-6">So the admin knows whose order this is.</p>
        {closedMessage && (
          <div
            className="rounded-lg border p-3 mb-4 text-xs"
            style={{ borderColor: "#B33A2E", background: "#FBEEEC", color: "#B33A2E" }}
          >
            {closedMessage}
          </div>
        )}
        <input
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Your name"
          className="w-full border rounded-lg px-4 py-3 text-base outline-none"
          style={{ borderColor: "var(--border-c)", background: "var(--bg-card)" }}
        />
        {isBlocked && (
          <p className="text-xs text-[#B33A2E] mt-3">
            You have a pending payment from a previous order. Please settle up
            with the admin before ordering again.
          </p>
        )}
        <div className="flex-1" />
        <button
          disabled={
            !name.trim() ||
            !menu.isOpen ||
            isBlocked ||
            (dishes.length === 0 && !(menu.customEnabled && menu.customPrice != null))
          }
          onClick={() => setStep("menu")}
          className="w-full rounded-lg py-3.5 font-semibold disabled:opacity-40 transition-transform active:scale-[0.98]"
          style={{ background: "#1F5F5B", color: "#FAF6EE" }}
        >
          Continue
        </button>
        {!menu.isOpen && (
          <p className="text-center text-xs text-[#B33A2E] mt-3">Ordering is closed for today.</p>
        )}
        {menu.isOpen && dishes.length === 0 && menu.customEnabled && menu.customPrice != null && (
          <p className="text-center text-xs text-[#B8842E] mt-3">
            No dishes posted yet — you can still request something below.
          </p>
        )}
        {menu.isOpen && dishes.length === 0 && !(menu.customEnabled && menu.customPrice != null) && (
          <p className="text-center text-xs text-[#B8842E] mt-3">No dishes posted yet.</p>
        )}
      </div>
    );
  }

  if (step === "menu") {
    const categories = Array.from(
      new Set(dishes.map((d) => (d.category || "").trim() || "Menu"))
    );
    const mainDishes = dishes.filter((d) => d.isMain);
    const q = menuSearch.trim().toLowerCase();
    let visibleDishes = dishes;
    if (q) {
      visibleDishes = dishes.filter(
        (d) =>
          d.name.toLowerCase().includes(q) ||
          (d.category || "").toLowerCase().includes(q)
      );
    } else if (selectedCategory !== "All") {
      visibleDishes = dishes.filter((d) => (d.category || "Menu") === selectedCategory);
    }
    visibleDishes = q ? visibleDishes : visibleDishes.filter((d) => !d.isMain);

    const renderDishCard = (dish) => {
      const cartQty = getDishTotalQty(dish.id);
      const priceDisplay =
        dish.sizes && dish.sizes.length > 0
          ? `From ${money(Math.min(...dish.sizes.map((s) => s.price)))}`
          : money(dish.price);
      return (
        <button
          key={dish.id}
          type="button"
          disabled={dish.soldOut}
          onClick={() => {
            setDetailDish(dish);
            setModalQty(1);
          }}
          className="rounded-lg border overflow-hidden relative text-left w-full"
          style={{
            borderColor: "var(--border-c)",
            background: "var(--bg-card)",
            opacity: dish.soldOut ? 0.6 : 1,
            cursor: dish.soldOut ? "not-allowed" : "pointer",
          }}
        >
          {dish.soldOut && (
            <div
              className="absolute text-center text-[9px] font-bold uppercase tracking-wide py-1"
              style={{
                width: "130px",
                top: "14px",
                right: "-37px",
                transform: "rotate(45deg)",
                background: "#B33A2E",
                color: "#FFFFFF",
                zIndex: 10,
              }}
            >
              Sold out
            </div>
          )}
          {cartQty > 0 && (
            <div
              className="absolute top-2 left-2 w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold fo-num z-10"
              style={{ background: "#1F5F5B", color: "#FAF6EE" }}
            >
              {cartQty}
            </div>
          )}
          {dish.image ? (
            <img
              src={dish.image}
              alt={dish.name}
              className="w-full h-24 object-cover"
              style={{ display: "block" }}
            />
          ) : (
            <div
              className="w-full h-24 flex items-center justify-center"
              style={{ background: "#F0EADA" }}
            >
              <ChefHat className="w-6 h-6" style={{ color: "#D8C7A8" }} />
            </div>
          )}
          <div className="p-3">
            <div className="flex items-center gap-1 flex-wrap mb-0.5">
              <span className="fo-serif text-sm leading-snug">{dish.name}</span>
              {dish.isMain && <span style={{ color: "#B8842E", fontSize: "11px" }}>★</span>}
            </div>
            {dish.extraName && (
              <div className="text-[10px] text-[var(--text-muted)] italic mb-0.5">{dish.extraName}</div>
            )}
            {dish.soldOut ? (
              <div className="text-xs font-semibold mt-1" style={{ color: "#B33A2E" }}>
                Not available today
              </div>
            ) : (
              <div className="fo-num text-sm text-[#B8842E] font-semibold mt-0.5">{priceDisplay}</div>
            )}
          </div>
        </button>
      );
    };

    const detailUnitPrice = detailDish
      ? (() => {
          let base = detailDish.price;
          const sizeId = getSelectedSizeId(detailDish);
          if (sizeId && detailDish.sizes) {
            const size = detailDish.sizes.find((s) => s.id === sizeId);
            if (size) base = size.price;
          }
          const groups = detailDish.optionGroups || [];
          const optionsTotal = groups.reduce((sum, g) => {
            const choiceId = getSelectedChoiceId(detailDish, g);
            const choice = g.choices.find((c) => c.id === choiceId);
            return sum + (choice ? choice.priceAdj : 0);
          }, 0);
          return base + optionsTotal;
        })()
      : 0;

    function handleAddFromModal() {
      if (!detailDish) return;
      const sizeId = getSelectedSizeId(detailDish);
      const current = getCartQty(detailDish, sizeId);
      setCartQty(detailDish, sizeId, current + modalQty);
      setDetailDish(null);
    }

    const dishDetailModal = detailDish && (
      <div
        className="fixed inset-0 z-50 flex items-end justify-center"
        style={{ background: "rgba(31,26,20,0.6)" }}
        onClick={() => setDetailDish(null)}
      >
        <div
          onClick={(e) => e.stopPropagation()}
          className="w-full max-w-md rounded-t-2xl overflow-y-auto"
          style={{ background: "var(--bg-card)", maxHeight: "88vh" }}
        >
          <div className="relative">
            {detailDish.image ? (
              <img src={detailDish.image} alt={detailDish.name} className="w-full h-44 object-cover" />
            ) : (
              <div className="w-full h-24" style={{ background: "#F0EADA" }} />
            )}
            <button
              onClick={() => setDetailDish(null)}
              className="absolute top-3 right-3 w-8 h-8 rounded-full flex items-center justify-center"
              style={{ background: "rgba(255,255,255,0.9)" }}
            >
              <X className="w-4 h-4" style={{ color: "#241F1A" }} />
            </button>
          </div>

          <div className="p-5">
            <h3 className="fo-serif text-xl mb-1">{detailDish.name}</h3>
            {detailDish.extraName && (
              <div className="text-xs text-[var(--text-muted)] italic mb-1">{detailDish.extraName}</div>
            )}
            {detailDish.desc && (
              <p className="text-sm text-[var(--text-muted)] mb-3">{detailDish.desc}</p>
            )}

            {detailDish.sizes && detailDish.sizes.length > 0 && (
              <div className="mb-4">
                <div className="text-xs uppercase tracking-wide font-semibold text-[var(--text-muted)] mb-2">
                  Size
                </div>
                <div className="flex flex-wrap gap-2">
                  {detailDish.sizes.map((size) => {
                    const active = getSelectedSizeId(detailDish) === size.id;
                    return (
                      <button
                        key={size.id}
                        onClick={() => setSizeChoice(detailDish.id, size.id)}
                        className="px-3 py-2 rounded-lg border text-sm"
                        style={{
                          borderColor: active ? "#1F5F5B" : "var(--border-c)",
                          background: active ? "#1F5F5B" : "transparent",
                          color: active ? "#FAF6EE" : "var(--text-primary)",
                        }}
                      >
                        {size.label} · {money(size.price)}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {(detailDish.optionGroups || []).map((group) => (
              <div key={group.id} className="mb-4">
                <div className="text-xs uppercase tracking-wide font-semibold text-[var(--text-muted)] mb-2">
                  {group.name}
                </div>
                <div className="flex flex-wrap gap-2">
                  {group.choices.map((choice) => {
                    const active = getSelectedChoiceId(detailDish, group) === choice.id;
                    return (
                      <button
                        key={choice.id}
                        onClick={() => setOptionChoice(detailDish.id, group.id, choice.id)}
                        className="px-3 py-2 rounded-lg border text-sm"
                        style={{
                          borderColor: active ? "#1F5F5B" : "var(--border-c)",
                          background: active ? "#1F5F5B" : "transparent",
                          color: active ? "#FAF6EE" : "var(--text-primary)",
                        }}
                      >
                        {choice.label}
                        {choice.priceAdj > 0 ? ` +${money(choice.priceAdj)}` : ""}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}

            <div className="flex items-center justify-between mb-5">
              <span className="text-sm font-semibold">Quantity</span>
              <div
                className="flex items-center gap-3 rounded-md px-2 py-1.5"
                style={{ background: "#F0EADA" }}
              >
                <button
                  onClick={() => setModalQty((q) => Math.max(1, q - 1))}
                  className="w-7 h-7 flex items-center justify-center"
                  style={{ color: "#1F5F5B" }}
                >
                  <Minus className="w-4 h-4" />
                </button>
                <span className="fo-num text-sm font-semibold w-4 text-center">{modalQty}</span>
                <button
                  onClick={() => setModalQty((q) => q + 1)}
                  className="w-7 h-7 flex items-center justify-center"
                  style={{ color: "#1F5F5B" }}
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>
            </div>

            <button
              onClick={handleAddFromModal}
              className="w-full rounded-lg py-3.5 font-semibold flex items-center justify-center gap-2"
              style={{ background: "#1F5F5B", color: "#FAF6EE" }}
            >
              Add to cart · {money(detailUnitPrice * modalQty)}
            </button>
          </div>
        </div>
      </div>
    );

    return (
      <PullToRefresh onRefresh={onRefreshMenu}>
      <div className="min-h-[100dvh] flex flex-col pb-24">
        <div className="px-6 pt-8">
          <div className="flex items-center justify-between">
            <BackRow onBack={() => setStep("name")} label="Back" />
            <ThemeToggleButton darkMode={darkMode} onToggle={onToggleDarkMode} />
          </div>
          <h2 className="fo-serif text-2xl mt-6 mb-1">Today's menu</h2>
          <p className="text-sm text-[var(--text-muted)] mb-4">{prettyDate(todayStr())}</p>

          <div className="relative mb-4">
            <Search
              className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2"
              style={{ color: "#B3A992" }}
            />
            <input
              value={menuSearch}
              onChange={(e) => setMenuSearch(e.target.value)}
              placeholder="Search dishes"
              className="w-full border rounded-lg pl-9 pr-3 py-2.5 text-sm outline-none"
              style={{ borderColor: "var(--border-c)", background: "var(--bg-card)" }}
            />
          </div>
        </div>

        {mainDishes.length > 0 && !q && (
          <div className="px-6 mb-4">
            <div
              className="text-xs uppercase tracking-wide font-semibold mb-2"
              style={{ color: "#B8842E" }}
            >
              ★ Today's Special
            </div>
            <div className="flex gap-3 overflow-x-auto pb-1" style={{ WebkitOverflowScrolling: "touch" }}>
              {mainDishes.map((dish) => (
                <div key={dish.id} className="w-40 shrink-0">
                  {renderDishCard(dish)}
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="px-6 flex gap-3 flex-1">
          {categories.length > 1 && !q && (
            <div className="w-16 shrink-0 flex flex-col gap-1.5">
              <button
                onClick={() => setSelectedCategory("All")}
                className="rounded-lg py-2.5 text-center text-[10px] font-semibold"
                style={{
                  background: selectedCategory === "All" ? "#FFFFFF" : "transparent",
                  border: selectedCategory === "All" ? "1px solid #DCD3C2" : "1px solid transparent",
                  color: selectedCategory === "All" ? "#1F5F5B" : "#B3A992",
                }}
              >
                All
              </button>
              {categories.map((cat) => (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(cat)}
                  className="rounded-lg py-2.5 px-1 text-center text-[10px] font-semibold leading-tight"
                  style={{
                    background: selectedCategory === cat ? "#FFFFFF" : "transparent",
                    border: selectedCategory === cat ? "1px solid #DCD3C2" : "1px solid transparent",
                    color: selectedCategory === cat ? "#1F5F5B" : "#B3A992",
                  }}
                >
                  {cat}
                </button>
              ))}
            </div>
          )}

          <div className="flex-1">
            {visibleDishes.length === 0 ? (
              <p className="text-sm text-[var(--text-faint)] text-center py-10">No dishes found.</p>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                {visibleDishes.map((dish) => renderDishCard(dish))}
              </div>
            )}

            {menu.customEnabled && menu.customPrice != null && (
              <div className="mt-5">
                <div className="text-xs uppercase tracking-wide font-semibold text-[var(--text-muted)] mb-2">
                  Not on the menu?
                </div>
                {customItems.map((c) => (
                  <div key={c.id} className="flex items-center justify-between py-2">
                    <div className="pr-3">
                      <div className="text-sm">{c.name}</div>
                      <div className="fo-num text-xs text-[#B8842E]">{money(offMenuPrice)} each</div>
                    </div>
                    <div
                      className="shrink-0 flex items-center gap-3 rounded-md px-2 py-1.5"
                      style={{ background: "#F0EADA" }}
                    >
                      <button
                        onClick={() => setCustomItemQty(c.id, c.qty - 1)}
                        className="w-6 h-6 flex items-center justify-center rounded"
                        style={{ color: "#1F5F5B" }}
                      >
                        <Minus className="w-4 h-4" />
                      </button>
                      <span className="fo-num text-sm font-semibold w-4 text-center">{c.qty}</span>
                      <button
                        onClick={() => setCustomItemQty(c.id, c.qty + 1)}
                        className="w-6 h-6 flex items-center justify-center rounded"
                        style={{ color: "#1F5F5B" }}
                      >
                        <Plus className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
                <div className="flex items-center gap-2 mt-1">
                  <input
                    value={customFoodName}
                    onChange={(e) => setCustomFoodName(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && addCustomItem()}
                    placeholder="Type what you'd like"
                    className="flex-1 border rounded-md px-3 py-2.5 text-sm outline-none min-w-0"
                    style={{ borderColor: "var(--border-c)", background: "var(--bg-card)" }}
                  />
                  <button
                    onClick={addCustomItem}
                    disabled={!customFoodName.trim()}
                    className="shrink-0 rounded-md px-4 py-2.5 text-sm font-semibold disabled:opacity-40"
                    style={{ background: "#1F5F5B", color: "#FAF6EE" }}
                  >
                    Add
                  </button>
                </div>
                <p className="text-[10px] text-[var(--text-faint)] mt-2">
                  {money(offMenuPrice)} each, set by the admin.
                </p>
              </div>
            )}
          </div>
        </div>

        {items.length > 0 && (
          <button
            onClick={() => setStep("checkout")}
            className="fixed left-0 right-0 bottom-16 flex justify-center z-30"
          >
            <div
              className="w-full max-w-md px-6 py-2.5 flex items-center justify-between text-sm font-semibold"
              style={{ background: "#1F5F5B", color: "#FAF6EE" }}
            >
              <span>{items.reduce((s, i) => s + i.qty, 0)} item(s) selected</span>
              <span className="fo-num">{money(total)} →</span>
            </div>
          </button>
        )}
        <BottomNav
          active="menu"
          onNavigate={handleNavigate}
          cartCount={items.reduce((s, i) => s + i.qty, 0)}
        />
      </div>
      {dishDetailModal}
      </PullToRefresh>
    );
  }

  if (step === "others") {
    const rows = [];
    othersOrders.forEach((o) => {
      o.items.forEach((it) => {
        rows.push({ name: o.name, label: summaryLabel(it), qty: it.qty });
      });
    });
    const totalQty = rows.reduce((s, r) => s + r.qty, 0);
    const chartData = (() => {
      const counts = {};
      rows.forEach((r) => {
        counts[r.label] = (counts[r.label] || 0) + r.qty;
      });
      return Object.entries(counts)
        .map(([name, qty]) => ({ name, qty }))
        .sort((a, b) => b.qty - a.qty);
    })();

    return (
      <PullToRefresh onRefresh={loadOthersOrders}>
      <div className="px-6 pt-8 pb-24 min-h-[100dvh] flex flex-col">
        <div className="flex items-start justify-between">
          <h2 className="fo-serif text-2xl mt-2 mb-1">What everyone's ordering</h2>
          <ThemeToggleButton darkMode={darkMode} onToggle={onToggleDarkMode} />
        </div>
        <p className="text-sm text-[var(--text-muted)] mb-5">{prettyDate(todayStr())}</p>

        {othersLoading ? (
          <Spinner label="Loading orders…" />
        ) : rows.length === 0 ? (
          <p className="text-sm text-[var(--text-faint)] text-center py-10">No orders yet today.</p>
        ) : (
          <>
            <div
              className="rounded-lg border p-4 mb-5"
              style={{ borderColor: "var(--border-c)", background: "var(--bg-card)" }}
            >
              {rows.map((r, idx) => (
                <div key={idx}>
                  <div className="flex justify-between text-sm py-1.5">
                    <span>
                      {r.name} - {r.label}
                    </span>
                    <span className="fo-num font-semibold" style={{ color: "#1F5F5B" }}>
                      = {r.qty}
                    </span>
                  </div>
                  {idx < rows.length - 1 && (
                    <div className="border-t border-dashed" style={{ borderColor: "var(--border-light)" }} />
                  )}
                </div>
              ))}
              <div
                className="border-t mt-2 pt-2 flex justify-between fo-serif text-lg"
                style={{ borderColor: "var(--border-c)" }}
              >
                <span>Total</span>
                <span className="fo-num">= {totalQty}</span>
              </div>
            </div>

            {chartData.length > 0 && (
              <div
                className="rounded-lg border p-4 mb-5"
                style={{ borderColor: "var(--border-c)", background: "var(--bg-card)" }}
              >
                <div className="text-xs uppercase tracking-wide font-semibold text-[var(--text-muted)] mb-3">
                  Most ordered
                </div>
                <ResponsiveContainer width="100%" height={Math.max(160, chartData.length * 42)}>
                  <BarChart
                    data={chartData}
                    layout="vertical"
                    margin={{ left: 8, right: 24, top: 4, bottom: 4 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#EEE7D8" />
                    <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11, fill: "#7A7166" }} />
                    <YAxis
                      type="category"
                      dataKey="name"
                      width={130}
                      tick={{ fontSize: 11, fill: "#241F1A" }}
                    />
                    <Tooltip
                      formatter={(value) => [value, "Ordered"]}
                      contentStyle={{ fontSize: 12, borderRadius: 8, borderColor: "var(--border-c)" }}
                    />
                    <Bar dataKey="qty" fill="#1F5F5B" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </>
        )}
        <BottomNav
          active="others"
          onNavigate={handleNavigate}
          cartCount={items.reduce((s, i) => s + i.qty, 0)}
        />
      </div>
      </PullToRefresh>
    );
  }

  if (step === "help") {
    return (
      <div className="px-6 pt-8 pb-24 min-h-[100dvh] flex flex-col">
        <div className="flex items-start justify-between">
          <h2 className="fo-serif text-2xl mt-2 mb-1">Help</h2>
          <ThemeToggleButton darkMode={darkMode} onToggle={onToggleDarkMode} />
        </div>
        <p className="text-sm text-[var(--text-muted)] mb-5">
          Order didn't go through, or not sure it was received? Message the
          admin directly on WhatsApp.
        </p>

        <a
          href="https://wa.me/601111642143"
          target="_blank"
          rel="noopener noreferrer"
          className="w-full rounded-lg py-3.5 font-semibold flex items-center justify-center gap-2 mb-3"
          style={{ background: "#25D366", color: "#FFFFFF" }}
        >
          <MessageCircle className="w-4 h-4" />
          Chat on WhatsApp
        </a>
        <p className="text-xs text-[var(--text-faint)] text-center">
          Fastest way to reach the admin directly
        </p>

        <div className="flex-1" />
        <BottomNav
          active="help"
          onNavigate={handleNavigate}
          cartCount={items.reduce((s, i) => s + i.qty, 0)}
        />
      </div>
    );
  }

  if (step === "status") {
    return (
      <PullToRefresh onRefresh={loadMyStatus}>
      <div className="px-6 pt-8 pb-24 min-h-[100dvh] flex flex-col">
        <div className="flex items-start justify-between">
          <h2 className="fo-serif text-2xl mt-2 mb-1">Order status</h2>
          <ThemeToggleButton darkMode={darkMode} onToggle={onToggleDarkMode} />
        </div>
        <p className="text-sm text-[var(--text-muted)] mb-5">
          {prettyDate(todayStr())} · everyone's orders · unpaid ones stay listed until settled
        </p>

        {myStatusLoading ? (
          <Spinner label="Loading orders…" />
        ) : myOrders.length === 0 ? (
          <p className="text-sm text-[var(--text-faint)] text-center py-10">
            No orders yet — tap Menu below to get started.
          </p>
        ) : (
          <div className="flex flex-col gap-3">
            {myOrders.map((o) => {
              const isMine = namesMatch(name, o.name);
              const isToday = o.date === todayStr();
              return (
                <div
                  key={o.key}
                  className="rounded-lg border p-4"
                  style={{
                    borderColor: isMine ? "#1F5F5B" : "var(--border-c)",
                    background: "var(--bg-card)",
                  }}
                >
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <div className="fo-serif text-base">{o.name}</div>
                      <div className="text-[11px] text-[var(--text-faint)]">
                        {isToday
                          ? new Date(o.createdAt).toLocaleTimeString("en-MY", {
                              hour: "2-digit",
                              minute: "2-digit",
                            })
                          : new Date(o.createdAt).toLocaleString("en-MY", {
                              day: "numeric",
                              month: "short",
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                        {!isToday && (
                          <span className="ml-1 font-semibold" style={{ color: "#B33A2E" }}>
                            · unresolved
                          </span>
                        )}
                      </div>
                    </div>
                    <Stamp tone={toneForStatus(o.status)}>
                      {o.status === "confirmed"
                        ? paymentMethodLabel(o.paymentMethod)
                        : statusLabel(o.status)}
                    </Stamp>
                  </div>
                  <div className="text-sm mb-2">
                    {o.items.map((it) => `${it.qty}× ${itemLabel(it)}`).join(", ")}
                  </div>
                  <div className="flex justify-between fo-serif text-base">
                    <span>Total</span>
                    <span className="fo-num">{money(o.total)}</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
        <BottomNav
          active="status"
          onNavigate={handleNavigate}
          cartCount={items.reduce((s, i) => s + i.qty, 0)}
        />
      </div>
      </PullToRefresh>
    );
  }

  if (step === "checkout") {
    return (
      <>
      <div className="px-6 pt-8 pb-10 min-h-[100dvh] flex flex-col">
        <BackRow onBack={() => setStep("menu")} label="Edit order" />
        <h2 className="fo-serif text-2xl mt-6 mb-1">Pay &amp; confirm</h2>
        <p className="text-sm text-[var(--text-muted)] mb-5">{name}</p>

        <div className="rounded-lg p-4 border mb-5" style={{ borderColor: "var(--border-c)", background: "var(--bg-card)" }}>
          {items.length === 0 ? (
            <p className="text-sm text-[var(--text-faint)] text-center py-4">
              Your cart is empty — go back and add something.
            </p>
          ) : (
            items.map((it, idx) => (
              <div key={it.dishId}>
                <div className="flex justify-between text-sm py-1.5 gap-2">
                  <div className="min-w-0">
                    <div className="truncate">{itemLabel(it)}</div>
                    {it.desc && (
                      <div className="text-xs text-[var(--text-muted)] mt-0.5">{it.desc}</div>
                    )}
                  </div>
                  <span className="fo-num shrink-0 pl-2">{money(it.price * it.qty)}</span>
                </div>
                <div className="flex items-center justify-between pb-1.5">
                  <div
                    className="flex items-center gap-2 rounded-md px-1.5 py-1"
                    style={{ background: "#F0EADA" }}
                  >
                    <button
                      onClick={() => adjustCheckoutItemQty(it, -1)}
                      className="w-6 h-6 flex items-center justify-center"
                      style={{ color: "#1F5F5B" }}
                    >
                      <Minus className="w-3.5 h-3.5" />
                    </button>
                    <span className="fo-num text-xs font-semibold w-4 text-center">{it.qty}</span>
                    <button
                      onClick={() => adjustCheckoutItemQty(it, 1)}
                      className="w-6 h-6 flex items-center justify-center"
                      style={{ color: "#1F5F5B" }}
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <button
                    onClick={() => removeCheckoutItem(it)}
                    className="text-xs text-[#B33A2E] underline flex items-center gap-1"
                  >
                    <Trash2 className="w-3 h-3" />
                    Remove
                  </button>
                </div>
                {idx < items.length - 1 && (
                  <div className="border-t border-dashed my-0.5" style={{ borderColor: "var(--border-light)" }} />
                )}
              </div>
            ))
          )}
          <div className="border-t mt-2 pt-2 flex justify-between fo-serif text-lg" style={{ borderColor: "var(--border-c)" }}>
            <span>Total</span>
            <span className="fo-num">{money(total)}</span>
          </div>
        </div>

        <div
          className="rounded-lg p-5 border mb-5 flex flex-col items-center text-center"
          style={{ borderColor: "var(--border-c)", background: "var(--bg-card)" }}
        >
          {qr.imageDataUrl ? (
            <button
              type="button"
              onClick={() => setQrZoomed(true)}
              className="mb-3 rounded"
            >
              <img
                src={qr.imageDataUrl}
                alt="TnG payment QR code"
                className="w-48 h-48 object-contain rounded"
              />
            </button>
          ) : (
            <div
              className="w-48 h-48 flex items-center justify-center rounded mb-3"
              style={{ background: "#F0EADA", color: "#B3A992" }}
            >
              <QrCode className="w-12 h-12" />
            </div>
          )}
          {qr.imageDataUrl && (
            <p className="text-[10px] text-[var(--text-faint)] -mt-2 mb-1">Tap the QR to enlarge</p>
          )}
          <div className="text-xs uppercase tracking-wide text-[var(--text-muted)] font-semibold mb-1">
            Scan with TnG eWallet
          </div>
          {qr.payeeName && <div className="fo-serif text-base">{qr.payeeName}</div>}
          <div className="fo-num text-2xl font-semibold mt-2" style={{ color: "#1F5F5B" }}>
            {money(total)}
          </div>
          {qr.note && <p className="text-xs text-[var(--text-muted)] mt-2">{qr.note}</p>}
          {!qr.imageDataUrl && (
            <p className="text-xs text-[#B33A2E] mt-2">Admin hasn't uploaded a QR code yet.</p>
          )}
        </div>

        <div
          className="rounded-lg p-4 border mb-5"
          style={{ borderColor: "var(--border-c)", background: "var(--bg-card)" }}
        >
          <div className="text-xs uppercase tracking-wide font-semibold text-[var(--text-muted)] mb-3">
            Upload payment screenshot
          </div>
          {proofUploading ? (
            <div className="flex flex-col items-center py-8">
              <Loader2 className="w-6 h-6 animate-spin mb-2" style={{ color: "#1F5F5B" }} />
              <span className="text-xs text-[var(--text-muted)]">Processing photo…</span>
            </div>
          ) : proofImage ? (
            <div className="flex flex-col items-center">
              <img
                src={proofImage}
                alt="Payment screenshot preview"
                className="w-full max-w-[220px] rounded-lg mb-3 border"
                style={{ borderColor: "var(--border-c)" }}
              />
              <label
                className="text-xs font-semibold px-4 py-2 rounded-md border cursor-pointer"
                style={{ borderColor: "var(--border-c)" }}
              >
                Replace screenshot
                <input type="file" accept="image/*" onChange={handleProofFile} className="hidden" />
              </label>
            </div>
          ) : (
            <label
              className="flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed py-8 cursor-pointer"
              style={{ borderColor: "var(--border-c)" }}
            >
              <ImagePlus className="w-6 h-6" style={{ color: "#B3A992" }} />
              <span className="text-sm font-semibold" style={{ color: "#1F5F5B" }}>
                Tap to upload a screenshot
              </span>
              <span className="text-xs text-[var(--text-muted)]">Your TnG payment confirmation</span>
              <input type="file" accept="image/*" onChange={handleProofFile} className="hidden" />
            </label>
          )}
        </div>

        <p className="text-xs text-[var(--text-muted)] mb-5 text-center leading-relaxed">
          Pay the exact amount above via TnG, upload a screenshot of the
          confirmation, then tap the button below. Your order will show as{" "}
          <em>paid</em> right away — the admin double-checks screenshots
          afterward and will follow up if anything looks off.
        </p>

        {submitError && (
          <div
            className="rounded-lg border p-3 mb-4 text-xs"
            style={{ borderColor: "#B33A2E", background: "#FBEEEC", color: "#B33A2E" }}
          >
            {submitError}
          </div>
        )}

        <div className="flex-1" />
        <button
          disabled={submitting || proofUploading || !proofImage || items.length === 0}
          onClick={handleSubmitOrder}
          className="w-full rounded-lg py-3.5 font-semibold flex items-center justify-center gap-2 transition-transform active:scale-[0.98] disabled:opacity-60"
          style={{ background: "#1F5F5B", color: "#FAF6EE" }}
        >
          {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
          I've completed payment — submit order
        </button>
        {items.length === 0 ? (
          <p className="text-center text-xs text-[#B33A2E] mt-2">
            Your cart is empty — go back to the menu to add something.
          </p>
        ) : (
          !proofImage &&
          !proofUploading && (
            <p className="text-center text-xs text-[#B8842E] mt-2">
              Upload your payment screenshot to continue
            </p>
          )
        )}
      </div>
      {qrZoomed && qr.imageDataUrl && (
        <div
          className="fixed inset-0 z-50 flex flex-col items-center justify-center p-6"
          style={{ background: "rgba(31,26,20,0.94)" }}
          onClick={() => setQrZoomed(false)}
        >
          <img
            src={qr.imageDataUrl}
            alt="TnG payment QR code enlarged"
            className="w-full max-w-sm rounded-lg"
            style={{ background: "var(--bg-card)", padding: "20px" }}
          />
          {qr.payeeName && (
            <div className="fo-serif text-lg mt-4" style={{ color: "#FAF6EE" }}>
              {qr.payeeName}
            </div>
          )}
          <div className="fo-num text-2xl font-semibold mt-1" style={{ color: "#FAF6EE" }}>
            {money(total)}
          </div>
          <p className="text-xs mt-4" style={{ color: "#C7BCA8" }}>
            Tap anywhere to close
          </p>
        </div>
      )}
      </>
    );
  }

  if (step === "submitted" && submittedOrder) {
    return (
      <div className="px-6 pt-16 pb-10 min-h-[100dvh] flex flex-col items-center text-center">
        <div className="w-16 h-16 rounded-full flex items-center justify-center mb-5" style={{ background: "#1F5F5B" }}>
          <Check className="w-8 h-8" style={{ color: "#FAF6EE" }} />
        </div>
        <h2 className="fo-serif text-2xl mb-2">Order submitted</h2>
        <p className="text-sm text-[var(--text-muted)] mb-6 max-w-xs">
          Thanks, {submittedOrder.name.split(" ")[0]}. Your order is{" "}
          <Stamp tone={toneForStatus(submittedOrder.status)}>
            {statusLabel(submittedOrder.status)}
          </Stamp>
          {submittedOrder.status === "confirmed"
            ? ". The admin will double-check your screenshot afterward."
            : " until the admin confirms your payment came through."}
        </p>
        <div className="rounded-lg p-4 border w-full text-left mb-8" style={{ borderColor: "var(--border-c)", background: "var(--bg-card)" }}>
          {submittedOrder.items.map((it) => (
            <div key={it.dishId} className="flex justify-between text-sm py-1">
              <span>
                {it.qty}× {itemLabel(it)}
              </span>
              <span className="fo-num">{money(it.price * it.qty)}</span>
            </div>
          ))}
          <div className="border-t mt-2 pt-2 flex justify-between fo-serif" style={{ borderColor: "var(--border-c)" }}>
            <span>Total paid</span>
            <span className="fo-num">{money(submittedOrder.total)}</span>
          </div>
        </div>
        <button
          onClick={() => {
            setCart({});
            setCustomItems([]);
            setProofImage("");
            setSubmitError("");
            setStep("menu");
          }}
          className="w-full rounded-lg py-3.5 font-semibold border mb-20"
          style={{ borderColor: "var(--border-c)" }}
        >
          Back to menu
        </button>
        <BottomNav active="status" onNavigate={handleNavigate} cartCount={0} />
      </div>
    );
  }

  return null;
}

/* ---------------------------------------------------------------
   Admin login
--------------------------------------------------------------- */

// If another admin's session was active more recently than this, block a
// new login. If the last heartbeat is older than this, treat it as
// abandoned (e.g. they closed the tab without locking) and allow in.
const ADMIN_SESSION_STALE_MS = 90000;

function AdminLogin({ onBack, onSuccess }) {
  const [pass, setPass] = useState("");
  const [confirmPass, setConfirmPass] = useState("");
  const [hasPasscode, setHasPasscode] = useState(null); // null = loading
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [showPass, setShowPass] = useState(false);

  useEffect(() => {
    (async () => {
      const val = await storageGet("admin:passcode");
      setHasPasscode(!!val);
    })();
  }, []);

  async function claimSession() {
    const sessionId = uid("sess");
    await storageSet("admin:activeSession", JSON.stringify({ sessionId, lastSeenAt: Date.now() }));
    return sessionId;
  }

  async function checkSessionFree() {
    const val = await storageGet("admin:activeSession");
    if (!val) return true;
    try {
      const session = JSON.parse(val);
      return Date.now() - session.lastSeenAt > ADMIN_SESSION_STALE_MS;
    } catch (e) {
      return true;
    }
  }

  async function handleLogin() {
    setError("");
    const val = await storageGet("admin:passcode");
    if (val !== pass || pass.length === 0) {
      setError("Wrong passcode.");
      return;
    }
    const free = await checkSessionFree();
    if (!free) {
      setError("Another person is currently using the admin panel with this passcode. Please wait and try again.");
      return;
    }
    const sessionId = await claimSession();
    onSuccess(sessionId);
  }

  async function handleCreate() {
    setError("");
    if (pass.length < 4) {
      setError("Use at least 4 characters.");
      return;
    }
    if (pass !== confirmPass) {
      setError("Passcodes don't match.");
      return;
    }
    setBusy(true);
    await storageSet("admin:passcode", pass);
    const sessionId = await claimSession();
    setBusy(false);
    onSuccess(sessionId);
  }

  if (hasPasscode === null) {
    return <Spinner label="Loading…" />;
  }

  return (
    <div className="px-6 pt-8 pb-10 min-h-[100dvh] flex flex-col">
      <BackRow onBack={onBack} label="Home" />
      <div className="flex-1 flex flex-col justify-center">
        <div className="w-12 h-12 rounded-full flex items-center justify-center mb-5" style={{ background: "#F0EADA" }}>
          <Lock className="w-5 h-5" style={{ color: "#1F5F5B" }} />
        </div>
        <h2 className="fo-serif text-2xl mb-1">
          {hasPasscode ? "Admin passcode" : "Set an admin passcode"}
        </h2>
        <p className="text-sm text-[var(--text-muted)] mb-6">
          {hasPasscode
            ? "Enter the passcode to manage today's menu and orders."
            : "No passcode set yet — create one now. Anyone with it can manage the menu."}
        </p>
        <div className="relative mb-3">
          <input
            type={showPass ? "text" : "password"}
            autoFocus
            value={pass}
            onChange={(e) => setPass(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && hasPasscode && handleLogin()}
            placeholder="Passcode"
            className="w-full border rounded-lg pl-4 pr-11 py-3 text-base outline-none"
            style={{ borderColor: "var(--border-c)", background: "var(--bg-card)" }}
          />
          <button
            type="button"
            onClick={() => setShowPass((v) => !v)}
            className="absolute right-3 top-1/2 -translate-y-1/2"
            style={{ color: "#7A7166" }}
          >
            {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
        </div>
        {!hasPasscode && (
          <input
            type={showPass ? "text" : "password"}
            value={confirmPass}
            onChange={(e) => setConfirmPass(e.target.value)}
            placeholder="Confirm passcode"
            className="w-full border rounded-lg px-4 py-3 text-base outline-none mb-3"
            style={{ borderColor: "var(--border-c)", background: "var(--bg-card)" }}
          />
        )}
        {error && <p className="text-xs text-[#B33A2E] mb-3">{error}</p>}
        <button
          disabled={busy}
          onClick={hasPasscode ? handleLogin : handleCreate}
          className="w-full rounded-lg py-3.5 font-semibold transition-transform active:scale-[0.98] disabled:opacity-60"
          style={{ background: "#1F5F5B", color: "#FAF6EE" }}
        >
          {hasPasscode ? "Enter" : "Save passcode & continue"}
        </button>

        <p className="text-[10px] text-[var(--text-faint)] mt-4 text-center leading-relaxed">
          This is a light gate for a small internal tool, not bank-grade
          security — don't reuse a sensitive password here.
        </p>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------
   Admin panel
--------------------------------------------------------------- */

function AdminPanel({ menu, qr, onSaveMenu, onSaveQr, onLock, darkMode, onToggleDarkMode, sessionId }) {
  const [tab, setTab] = useState("menu"); // menu | qr | orders | orderlist
  const [showSettings, setShowSettings] = useState(false);

  // Keep this session marked "active" while the admin panel stays open, so
  // another login attempt elsewhere is correctly blocked. If this tab is
  // closed without tapping Lock, the heartbeat simply stops and the lock
  // expires on its own after ADMIN_SESSION_STALE_MS.
  useEffect(() => {
    if (!sessionId) return;
    const beat = () => {
      storageSet("admin:activeSession", JSON.stringify({ sessionId, lastSeenAt: Date.now() }));
    };
    beat();
    const interval = setInterval(beat, 30000);
    return () => clearInterval(interval);
  }, [sessionId]);

  return (
    <div className="min-h-[100dvh] flex flex-col">
      <div className="px-6 pt-8">
        <div className="flex items-center justify-between mb-4">
          <h2 className="fo-serif text-2xl">Admin</h2>
          <div className="flex items-center gap-2">
            <ThemeToggleButton darkMode={darkMode} onToggle={onToggleDarkMode} />
            <button
              onClick={() => setShowSettings((v) => !v)}
              className="w-9 h-9 rounded-full flex items-center justify-center border shrink-0"
              style={{
                borderColor: showSettings ? "#1F5F5B" : "var(--border-c)",
                background: showSettings ? "#F0EADA" : "transparent",
              }}
              title="Settings"
            >
              <Settings className="w-4 h-4" style={{ color: showSettings ? "#1F5F5B" : "var(--text-muted)" }} />
            </button>
            <button
              onClick={onLock}
              className="flex items-center gap-1.5 text-xs font-semibold text-[var(--text-muted)] border rounded-md px-3 py-1.5"
              style={{ borderColor: "var(--border-c)" }}
            >
              <LogOut className="w-3.5 h-3.5" />
              Lock
            </button>
          </div>
        </div>

        {showSettings && <ChangePasscodeForm />}

        <div
          className="flex gap-1 border-b overflow-x-auto overflow-y-hidden"
          style={{
            borderColor: "var(--border-c)",
            WebkitOverflowScrolling: "touch",
            overscrollBehaviorX: "contain",
            touchAction: "pan-x",
          }}
        >
          {[
            { id: "menu", label: "Menu" },
            { id: "qr", label: "QR" },
            { id: "orders", label: "Orders" },
            { id: "orderlist", label: "List" },
            { id: "blocked", label: "Blocked" },
          ].map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className="px-3 py-2.5 text-sm font-semibold -mb-px border-b-2 whitespace-nowrap shrink-0"
              style={{
                borderColor: tab === t.id ? "#1F5F5B" : "transparent",
                color: tab === t.id ? "#1F5F5B" : "#B3A992",
              }}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <div className="px-6 pt-5 pb-10 flex-1">
        {tab === "menu" && <MenuEditor menu={menu} onSaveMenu={onSaveMenu} />}
        {tab === "qr" && <QrEditor qr={qr} onSaveQr={onSaveQr} />}
        {tab === "orders" && <OrdersPanel />}
        {tab === "orderlist" && <OrderListPanel />}
        {tab === "blocked" && <BlockedUsersPanel />}
      </div>
    </div>
  );
}

function ChangePasscodeForm() {
  const [newPass, setNewPass] = useState("");
  const [confirmPass, setConfirmPass] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    setError("");
    if (newPass.length < 4) {
      setError("Use at least 4 characters.");
      return;
    }
    if (newPass !== confirmPass) {
      setError("Passcodes don't match.");
      return;
    }
    setSaving(true);
    const ok = await storageSet("admin:passcode", newPass);
    setSaving(false);
    if (!ok) {
      setError(
        "Couldn't save — your Firestore security rules may still be blocking passcode updates. Check the firestore.rules file."
      );
      return;
    }
    setSaved(true);
    setNewPass("");
    setConfirmPass("");
    setTimeout(() => setSaved(false), 2000);
  }

  return (
    <div
      className="rounded-lg border p-4 mb-4"
      style={{ borderColor: "var(--border-c)", background: "var(--bg-card)" }}
    >
      <div className="text-sm font-semibold mb-1">Change admin passcode</div>
      <p className="text-xs text-[var(--text-muted)] mb-3">
        You're already logged in, so this is safe to change any time — no
        need to know the old one.
      </p>
      <div className="relative mb-2">
        <input
          type={showPass ? "text" : "password"}
          value={newPass}
          onChange={(e) => setNewPass(e.target.value)}
          placeholder="New passcode"
          className="w-full border rounded-md pl-3 pr-10 py-2.5 text-sm outline-none"
          style={{ borderColor: "var(--border-c)" }}
        />
        <button
          type="button"
          onClick={() => setShowPass((v) => !v)}
          className="absolute right-3 top-1/2 -translate-y-1/2"
          style={{ color: "var(--text-muted)" }}
        >
          {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
        </button>
      </div>
      <input
        type={showPass ? "text" : "password"}
        value={confirmPass}
        onChange={(e) => setConfirmPass(e.target.value)}
        placeholder="Confirm new passcode"
        className="w-full border rounded-md px-3 py-2.5 text-sm outline-none mb-2"
        style={{ borderColor: "var(--border-c)" }}
      />
      {error && <p className="text-xs text-[#B33A2E] mb-2">{error}</p>}
      <button
        disabled={!newPass || !confirmPass || saving}
        onClick={handleSave}
        className="w-full rounded-md py-2.5 text-sm font-semibold disabled:opacity-40 flex items-center justify-center gap-1.5"
        style={{ background: "#1F5F5B", color: "#FAF6EE" }}
      >
        {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
        {saved ? "Saved!" : "Save new passcode"}
      </button>
    </div>
  );
}

function MenuEditor({ menu, onSaveMenu }) {
  const [dishes, setDishes] = useState(menu.dishes || []);
  const [isOpen, setIsOpen] = useState(menu.isOpen !== false);
  const [customEnabled, setCustomEnabled] = useState(!!menu.customEnabled);
  const [customPrice, setCustomPrice] = useState(
    menu.customPrice != null ? String(menu.customPrice) : ""
  );
  const [name, setName] = useState("");
  const [extraName, setExtraName] = useState("");
  const [category, setCategory] = useState("");
  const [price, setPrice] = useState("");
  const [desc, setDesc] = useState("");
  const [isMain, setIsMain] = useState(false);
  const [hasSizes, setHasSizes] = useState(false);
  const [sizesDraft, setSizesDraft] = useState([]); // [{id, label, price}]
  const [hasOptions, setHasOptions] = useState(false);
  const [optionGroupsDraft, setOptionGroupsDraft] = useState([]); // [{id, name, choices:[{id,label,priceAdj}]}]
  const [image, setImage] = useState("");
  const [imageUploading, setImageUploading] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setDishes(menu.dishes || []);
    setIsOpen(menu.isOpen !== false);
    setCustomEnabled(!!menu.customEnabled);
    setCustomPrice(menu.customPrice != null ? String(menu.customPrice) : "");
  }, [menu]);

  async function persist(overrides = {}) {
    setSaving(true);
    await onSaveMenu({
      dishes,
      isOpen,
      customEnabled,
      customPrice: customPrice ? parseFloat(customPrice) : null,
      updatedAt: Date.now(),
      ...overrides,
    });
    setSaving(false);
  }

  function resetForm() {
    setName("");
    setExtraName("");
    setCategory("");
    setPrice("");
    setDesc("");
    setIsMain(false);
    setHasSizes(false);
    setSizesDraft([]);
    setHasOptions(false);
    setOptionGroupsDraft([]);
    setImage("");
    setEditingId(null);
  }

  function handleDishImageFile(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setImageUploading(true);
    // Every dish photo lives inside the single shared "menu" document
    // (all dishes together), which has a hard 1MB Firestore limit — so
    // these need to stay much smaller than a typical photo upload, or a
    // handful of dish photos could break saving the whole menu.
    compressImageFile(file, 320, 0.55)
      .then((dataUrl) => {
        setImage(dataUrl);
        setImageUploading(false);
      })
      .catch(() => setImageUploading(false));
  }

  function addSizeRow() {
    setSizesDraft((prev) => [...prev, { id: uid("sz"), label: "", price: "" }]);
  }
  function updateSizeRow(id, field, value) {
    setSizesDraft((prev) => prev.map((s) => (s.id === id ? { ...s, [field]: value } : s)));
  }
  function removeSizeRow(id) {
    setSizesDraft((prev) => prev.filter((s) => s.id !== id));
  }

  function addOptionGroup() {
    setOptionGroupsDraft((prev) => [...prev, { id: uid("og"), name: "", choices: [] }]);
  }
  function updateOptionGroupName(groupId, value) {
    setOptionGroupsDraft((prev) =>
      prev.map((g) => (g.id === groupId ? { ...g, name: value } : g))
    );
  }
  function removeOptionGroup(groupId) {
    setOptionGroupsDraft((prev) => prev.filter((g) => g.id !== groupId));
  }
  function addChoice(groupId) {
    setOptionGroupsDraft((prev) =>
      prev.map((g) =>
        g.id === groupId
          ? { ...g, choices: [...g.choices, { id: uid("ch"), label: "", priceAdj: "" }] }
          : g
      )
    );
  }
  function updateChoice(groupId, choiceId, field, value) {
    setOptionGroupsDraft((prev) =>
      prev.map((g) =>
        g.id === groupId
          ? {
              ...g,
              choices: g.choices.map((c) => (c.id === choiceId ? { ...c, [field]: value } : c)),
            }
          : g
      )
    );
  }
  function removeChoice(groupId, choiceId) {
    setOptionGroupsDraft((prev) =>
      prev.map((g) =>
        g.id === groupId ? { ...g, choices: g.choices.filter((c) => c.id !== choiceId) } : g
      )
    );
  }

  async function handleAddOrUpdate() {
    const sizes = hasSizes
      ? sizesDraft
          .filter((s) => s.label.trim() && s.price !== "")
          .map((s) => ({ id: s.id, label: s.label.trim(), price: parseFloat(s.price) || 0 }))
      : [];
    const optionGroups = hasOptions
      ? optionGroupsDraft
          .filter((g) => g.name.trim())
          .map((g) => ({
            id: g.id,
            name: g.name.trim(),
            choices: g.choices
              .filter((c) => c.label.trim())
              .map((c) => ({ id: c.id, label: c.label.trim(), priceAdj: parseFloat(c.priceAdj) || 0 })),
          }))
          .filter((g) => g.choices.length > 0)
      : [];
    const priceNum = parseFloat(price);
    if (!name.trim()) return;
    if (hasSizes) {
      if (sizes.length === 0) return;
    } else if (isNaN(priceNum) || priceNum < 0) {
      return;
    }
    const dishData = {
      name: name.trim(),
      extraName: extraName.trim(),
      category: category.trim(),
      price: hasSizes ? sizes[0].price : priceNum,
      sizes,
      optionGroups,
      desc: desc.trim(),
      isMain,
      image,
    };
    let next;
    if (editingId) {
      next = dishes.map((d) => (d.id === editingId ? { ...d, ...dishData } : d));
    } else {
      next = [...dishes, { id: uid("d"), ...dishData }];
    }
    setDishes(next);
    resetForm();
    await persist({ dishes: next });
  }

  function startEdit(dish) {
    setEditingId(dish.id);
    setName(dish.name);
    setExtraName(dish.extraName || "");
    setCategory(dish.category || "");
    setPrice(String(dish.price));
    setDesc(dish.desc || "");
    setIsMain(!!dish.isMain);
    const sizes = dish.sizes || [];
    setHasSizes(sizes.length > 0);
    setSizesDraft(sizes.map((s) => ({ id: s.id, label: s.label, price: String(s.price) })));
    const groups = dish.optionGroups || [];
    setHasOptions(groups.length > 0);
    setOptionGroupsDraft(
      groups.map((g) => ({
        id: g.id,
        name: g.name,
        choices: g.choices.map((c) => ({ id: c.id, label: c.label, priceAdj: String(c.priceAdj) })),
      }))
    );
    setImage(dish.image || "");
  }

  async function handleDelete(id) {
    const next = dishes.filter((d) => d.id !== id);
    setDishes(next);
    if (editingId === id) resetForm();
    await persist({ dishes: next });
  }

  async function toggleMain(id) {
    const next = dishes.map((d) => (d.id === id ? { ...d, isMain: !d.isMain } : d));
    setDishes(next);
    await persist({ dishes: next });
  }

  async function toggleSoldOut(id) {
    const next = dishes.map((d) => (d.id === id ? { ...d, soldOut: !d.soldOut } : d));
    setDishes(next);
    await persist({ dishes: next });
  }

  async function toggleOpen() {
    const next = !isOpen;
    setIsOpen(next);
    await persist({ isOpen: next });
  }

  async function toggleCustomEnabled() {
    const next = !customEnabled;
    setCustomEnabled(next);
    await persist({ customEnabled: next });
  }

  async function saveCustomPrice() {
    const priceNum = parseFloat(customPrice);
    if (isNaN(priceNum) || priceNum < 0) return;
    await persist({ customEnabled, customPrice: priceNum });
  }

  return (
    <div>
      <div
        className="rounded-lg border p-4 mb-5 flex items-center justify-between"
        style={{ borderColor: "var(--border-c)", background: "var(--bg-card)" }}
      >
        <div>
          <div className="text-sm font-semibold">Ordering is {isOpen ? "open" : "closed"}</div>
          <div className="text-xs text-[var(--text-muted)]">
            {isOpen ? "Colleagues can place orders now." : "Colleagues can't order right now."}
          </div>
        </div>
        <button
          onClick={toggleOpen}
          className="w-12 h-7 rounded-full relative shrink-0 transition-colors"
          style={{ background: isOpen ? "#1F5F5B" : "#DCD3C2" }}
        >
          <span
            className="absolute top-0.5 w-6 h-6 rounded-full bg-white transition-all"
            style={{ left: isOpen ? "22px" : "2px" }}
          />
        </button>
      </div>

      <div
        className="rounded-lg border p-4 mb-5"
        style={{ borderColor: "var(--border-c)", background: "var(--bg-card)" }}
      >
        <div className="flex items-center justify-between mb-1">
          <div>
            <div className="text-sm font-semibold">
              Off-menu requests {customEnabled ? "on" : "off"}
            </div>
            <div className="text-xs text-[var(--text-muted)]">
              {customEnabled
                ? "Colleagues can type something not on the menu."
                : "Colleagues can only pick from the dishes above."}
            </div>
          </div>
          <button
            onClick={toggleCustomEnabled}
            className="w-12 h-7 rounded-full relative shrink-0 transition-colors"
            style={{ background: customEnabled ? "#1F5F5B" : "#DCD3C2" }}
          >
            <span
              className="absolute top-0.5 w-6 h-6 rounded-full bg-white transition-all"
              style={{ left: customEnabled ? "22px" : "2px" }}
            />
          </button>
        </div>
        {customEnabled && (
          <div className="flex items-center gap-2 mt-3">
            <input
              value={customPrice}
              onChange={(e) => setCustomPrice(e.target.value)}
              placeholder="Price per off-menu item (RM)"
              type="number"
              step="0.10"
              min="0"
              className="flex-1 border rounded-md px-3 py-2.5 text-sm outline-none fo-num"
              style={{ borderColor: "var(--border-c)" }}
            />
            <button
              onClick={saveCustomPrice}
              disabled={!customPrice || saving}
              className="shrink-0 rounded-md px-4 py-2.5 text-sm font-semibold disabled:opacity-40"
              style={{ background: "#1F5F5B", color: "#FAF6EE" }}
            >
              Save
            </button>
          </div>
        )}
        {customEnabled && menu.customPrice == null && !customPrice && (
          <p className="text-xs text-[#B33A2E] mt-2">Set a price before colleagues can use this.</p>
        )}
      </div>

      <div className="mb-2 text-xs uppercase tracking-wide font-semibold text-[var(--text-muted)]">
        Today's dishes ({dishes.length})
      </div>

      {dishes.length === 0 && (
        <p className="text-sm text-[var(--text-faint)] mb-4">Nothing posted yet — add your first dish below.</p>
      )}

      {dishes.map((dish, idx) => (
        <div key={dish.id}>
          <div className="flex items-start justify-between py-2.5 gap-2">
            {dish.image && (
              <img
                src={dish.image}
                alt={dish.name}
                className="w-12 h-12 rounded-md object-cover border shrink-0"
                style={{ borderColor: "var(--border-c)" }}
              />
            )}
            <div className="pr-3 flex-1 min-w-0">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="fo-serif text-base">{dish.name}</span>
                {dish.isMain && (
                  <span
                    className="text-[9px] font-bold uppercase px-1.5 py-0.5 rounded"
                    style={{ background: "#F0EADA", color: "#B8842E" }}
                  >
                    ★ Main
                  </span>
                )}
                {dish.soldOut && (
                  <span
                    className="text-[9px] font-bold uppercase px-1.5 py-0.5 rounded"
                    style={{ background: "#FBEEEC", color: "#B33A2E" }}
                  >
                    Sold out
                  </span>
                )}
                {dish.category && (
                  <span
                    className="text-[9px] font-semibold uppercase px-1.5 py-0.5 rounded"
                    style={{ background: "#F0EADA", color: "#7A7166" }}
                  >
                    {dish.category}
                  </span>
                )}
              </div>
              {dish.extraName && (
                <div className="text-xs text-[var(--text-muted)] italic">{dish.extraName}</div>
              )}
              {dish.desc && <div className="text-xs text-[var(--text-muted)]">{dish.desc}</div>}
              {dish.sizes && dish.sizes.length > 0 ? (
                <div className="fo-num text-sm text-[#B8842E] font-semibold mt-0.5">
                  {dish.sizes.map((s) => `${s.label} ${money(s.price)}`).join(" · ")}
                </div>
              ) : (
                <div className="fo-num text-sm text-[#B8842E] font-semibold mt-0.5">
                  {money(dish.price)}
                </div>
              )}
              {dish.optionGroups && dish.optionGroups.length > 0 && (
                <div className="text-[10px] text-[var(--text-muted)] mt-0.5">
                  {dish.optionGroups
                    .map((g) => `${g.name}: ${g.choices.map((c) => c.label).join("/")}`)
                    .join(" · ")}
                </div>
              )}
            </div>
            <div className="flex gap-1.5 shrink-0">
              <button
                onClick={() => toggleSoldOut(dish.id)}
                className="w-8 h-8 flex items-center justify-center rounded-md border"
                style={{
                  borderColor: dish.soldOut ? "#B33A2E" : "#DCD3C2",
                  background: dish.soldOut ? "#FBEEEC" : "transparent",
                }}
                title="Mark as sold out"
              >
                <X className="w-3.5 h-3.5" style={{ color: dish.soldOut ? "#B33A2E" : "#B3A992" }} />
              </button>
              <button
                onClick={() => toggleMain(dish.id)}
                className="w-8 h-8 flex items-center justify-center rounded-md border"
                style={{
                  borderColor: dish.isMain ? "#B8842E" : "#DCD3C2",
                  background: dish.isMain ? "#F0EADA" : "transparent",
                }}
                title="Feature as Main dish"
              >
                <span style={{ color: dish.isMain ? "#B8842E" : "#B3A992", fontSize: "14px" }}>★</span>
              </button>
              <button
                onClick={() => startEdit(dish)}
                className="w-8 h-8 flex items-center justify-center rounded-md border"
                style={{ borderColor: "var(--border-c)" }}
              >
                <Pencil className="w-3.5 h-3.5" style={{ color: "#7A7166" }} />
              </button>
              <button
                onClick={() => handleDelete(dish.id)}
                className="w-8 h-8 flex items-center justify-center rounded-md border"
                style={{ borderColor: "var(--border-c)" }}
              >
                <Trash2 className="w-3.5 h-3.5" style={{ color: "#B33A2E" }} />
              </button>
            </div>
          </div>
          {idx < dishes.length - 1 && <DashedDivider />}
        </div>
      ))}

      <div className="rounded-lg border p-4 mt-6" style={{ borderColor: "var(--border-c)", background: "var(--bg-card)" }}>
        <div className="text-sm font-semibold mb-3">{editingId ? "Edit dish" : "Add a dish"}</div>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Dish name"
          className="w-full border rounded-md px-3 py-2.5 text-sm outline-none mb-2"
          style={{ borderColor: "var(--border-c)" }}
        />
        <input
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          placeholder="Category (optional, e.g. Rice, Drinks)"
          className="w-full border rounded-md px-3 py-2.5 text-sm outline-none mb-2"
          style={{ borderColor: "var(--border-c)" }}
        />

        <div className="flex items-center justify-between rounded-md border p-3 mb-2" style={{ borderColor: "var(--border-c)" }}>
          <div>
            <div className="text-sm font-medium">This dish has size options</div>
            <div className="text-xs text-[var(--text-muted)]">e.g. Small / Big, each with its own price</div>
          </div>
          <button
            onClick={() => setHasSizes((v) => !v)}
            className="w-11 h-6 rounded-full relative shrink-0 transition-colors"
            style={{ background: hasSizes ? "#1F5F5B" : "#DCD3C2" }}
          >
            <span
              className="absolute top-0.5 w-5 h-5 rounded-full bg-white transition-all"
              style={{ left: hasSizes ? "22px" : "2px" }}
            />
          </button>
        </div>

        {hasSizes ? (
          <div className="mb-2">
            {sizesDraft.map((s) => (
              <div key={s.id} className="flex items-center gap-2 mb-2">
                <input
                  value={s.label}
                  onChange={(e) => updateSizeRow(s.id, "label", e.target.value)}
                  placeholder="Size label (e.g. Small)"
                  className="flex-1 min-w-0 border rounded-md px-3 py-2 text-sm outline-none"
                  style={{ borderColor: "var(--border-c)" }}
                />
                <input
                  value={s.price}
                  onChange={(e) => updateSizeRow(s.id, "price", e.target.value)}
                  placeholder="RM"
                  type="number"
                  step="0.10"
                  min="0"
                  className="w-20 shrink-0 border rounded-md px-2 py-2 text-sm outline-none fo-num"
                  style={{ borderColor: "var(--border-c)" }}
                />
                <button
                  type="button"
                  onClick={() => removeSizeRow(s.id)}
                  className="w-8 h-8 shrink-0 flex items-center justify-center"
                >
                  <X className="w-4 h-4" style={{ color: "#B33A2E" }} />
                </button>
              </div>
            ))}
            <button
              type="button"
              onClick={addSizeRow}
              className="text-xs font-semibold flex items-center gap-1"
              style={{ color: "#1F5F5B" }}
            >
              <Plus className="w-3.5 h-3.5" />
              Add size
            </button>
          </div>
        ) : (
          <input
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            placeholder="Price (RM)"
            type="number"
            step="0.10"
            min="0"
            className="w-full border rounded-md px-3 py-2.5 text-sm outline-none mb-2 fo-num"
            style={{ borderColor: "var(--border-c)" }}
          />
        )}

        <input
          value={desc}
          onChange={(e) => setDesc(e.target.value)}
          placeholder="Description (optional)"
          className="w-full border rounded-md px-3 py-2.5 text-sm outline-none mb-2"
          style={{ borderColor: "var(--border-c)" }}
        />

        <div className="rounded-md border p-3 mb-2" style={{ borderColor: "var(--border-c)" }}>
          <div className="text-sm font-medium mb-2">Photo (optional)</div>
          {imageUploading ? (
            <div className="flex items-center gap-2 py-2">
              <Loader2 className="w-4 h-4 animate-spin" style={{ color: "#1F5F5B" }} />
              <span className="text-xs text-[var(--text-muted)]">Processing photo…</span>
            </div>
          ) : image ? (
            <div className="flex items-center gap-3">
              <img src={image} alt="Dish preview" className="w-16 h-16 object-cover rounded-md border" style={{ borderColor: "var(--border-c)" }} />
              <button
                type="button"
                onClick={() => setImage("")}
                className="text-xs font-semibold px-3 py-1.5 rounded-md border"
                style={{ borderColor: "var(--border-c)", color: "#B33A2E" }}
              >
                Remove photo
              </button>
            </div>
          ) : (
            <label
              className="flex items-center justify-center gap-2 rounded-md border-2 border-dashed py-3 cursor-pointer"
              style={{ borderColor: "var(--border-c)" }}
            >
              <ImagePlus className="w-4 h-4" style={{ color: "var(--text-faint)" }} />
              <span className="text-xs font-semibold" style={{ color: "#1F5F5B" }}>Upload a photo</span>
              <input type="file" accept="image/*" onChange={handleDishImageFile} className="hidden" />
            </label>
          )}
          <p className="text-[10px] text-[var(--text-faint)] mt-2">
            Kept small on purpose — all dishes share one saved menu, so photos
            are compressed automatically.
          </p>
        </div>

        <div className="flex items-center justify-between rounded-md border p-3 mb-2" style={{ borderColor: "var(--border-c)" }}>
          <div>
            <div className="text-sm font-medium">This dish has custom options</div>
            <div className="text-xs text-[var(--text-muted)]">e.g. Sambal level, Ice level, Sugar level</div>
          </div>
          <button
            onClick={() => setHasOptions((v) => !v)}
            className="w-11 h-6 rounded-full relative shrink-0 transition-colors"
            style={{ background: hasOptions ? "#1F5F5B" : "#DCD3C2" }}
          >
            <span
              className="absolute top-0.5 w-5 h-5 rounded-full bg-white transition-all"
              style={{ left: hasOptions ? "22px" : "2px" }}
            />
          </button>
        </div>

        {hasOptions && (
          <div className="mb-2">
            {optionGroupsDraft.map((group) => (
              <div
                key={group.id}
                className="rounded-md border p-3 mb-2"
                style={{ borderColor: "var(--border-c)" }}
              >
                <div className="flex items-center gap-2 mb-2">
                  <input
                    value={group.name}
                    onChange={(e) => updateOptionGroupName(group.id, e.target.value)}
                    placeholder="Option name (e.g. Sambal)"
                    className="flex-1 min-w-0 border rounded-md px-3 py-2 text-sm outline-none"
                    style={{ borderColor: "var(--border-c)" }}
                  />
                  <button
                    type="button"
                    onClick={() => removeOptionGroup(group.id)}
                    className="w-8 h-8 shrink-0 flex items-center justify-center"
                  >
                    <Trash2 className="w-4 h-4" style={{ color: "#B33A2E" }} />
                  </button>
                </div>
                {group.choices.map((choice) => (
                  <div key={choice.id} className="flex items-center gap-2 mb-1.5 pl-2">
                    <input
                      value={choice.label}
                      onChange={(e) => updateChoice(group.id, choice.id, "label", e.target.value)}
                      placeholder="Choice (e.g. Extra sambal)"
                      className="flex-1 min-w-0 border rounded-md px-3 py-1.5 text-sm outline-none"
                      style={{ borderColor: "var(--border-c)" }}
                    />
                    <input
                      value={choice.priceAdj}
                      onChange={(e) => updateChoice(group.id, choice.id, "priceAdj", e.target.value)}
                      placeholder="+RM"
                      type="number"
                      step="0.10"
                      className="w-16 shrink-0 border rounded-md px-2 py-1.5 text-sm outline-none fo-num"
                      style={{ borderColor: "var(--border-c)" }}
                    />
                    <button
                      type="button"
                      onClick={() => removeChoice(group.id, choice.id)}
                      className="w-7 h-7 shrink-0 flex items-center justify-center"
                    >
                      <X className="w-3.5 h-3.5" style={{ color: "#B33A2E" }} />
                    </button>
                  </div>
                ))}
                <button
                  type="button"
                  onClick={() => addChoice(group.id)}
                  className="text-xs font-semibold flex items-center gap-1 pl-2 mt-1"
                  style={{ color: "#1F5F5B" }}
                >
                  <Plus className="w-3.5 h-3.5" />
                  Add choice
                </button>
              </div>
            ))}
            <button
              type="button"
              onClick={addOptionGroup}
              className="text-xs font-semibold flex items-center gap-1"
              style={{ color: "#1F5F5B" }}
            >
              <Plus className="w-3.5 h-3.5" />
              Add option group
            </button>
            <p className="text-[10px] text-[var(--text-faint)] mt-2">
              Leave price at RM0 for a free choice (e.g. "No sambal"). Each
              group is a separate choice — a drink could have both an Ice
              group and a Sugar group.
            </p>
          </div>
        )}

        <div className="flex items-center justify-between rounded-md border p-3 mb-3" style={{ borderColor: "var(--border-c)" }}>
          <div>
            <div className="text-sm font-medium">Feature as Main dish</div>
            <div className="text-xs text-[var(--text-muted)]">Shows at the top of the menu for colleagues</div>
          </div>
          <button
            onClick={() => setIsMain((v) => !v)}
            className="w-11 h-6 rounded-full relative shrink-0 transition-colors"
            style={{ background: isMain ? "#B8842E" : "#DCD3C2" }}
          >
            <span
              className="absolute top-0.5 w-5 h-5 rounded-full bg-white transition-all"
              style={{ left: isMain ? "22px" : "2px" }}
            />
          </button>
        </div>

        <div className="flex gap-2">
          {editingId && (
            <button
              onClick={resetForm}
              className="px-4 py-2.5 rounded-md text-sm font-semibold border"
              style={{ borderColor: "var(--border-c)" }}
            >
              Cancel
            </button>
          )}
          <button
            disabled={!name.trim() || (hasSizes ? sizesDraft.length === 0 : !price) || saving}
            onClick={handleAddOrUpdate}
            className="flex-1 rounded-md py-2.5 text-sm font-semibold disabled:opacity-40 flex items-center justify-center gap-1.5"
            style={{ background: "#1F5F5B", color: "#FAF6EE" }}
          >
            {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            {editingId ? "Save changes" : "Add dish"}
          </button>
        </div>
      </div>
    </div>
  );
}

function QrEditor({ qr, onSaveQr }) {
  const [imageDataUrl, setImageDataUrl] = useState(qr.imageDataUrl || "");
  const [payeeName, setPayeeName] = useState(qr.payeeName || "");
  const [note, setNote] = useState(qr.note || "");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const fileRef = useRef(null);

  function handleFile(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setImageDataUrl(reader.result);
    reader.readAsDataURL(file);
  }

  async function handleSave() {
    setSaving(true);
    await onSaveQr({ imageDataUrl, payeeName: payeeName.trim(), note: note.trim() });
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 1800);
  }

  return (
    <div>
      <p className="text-sm text-[var(--text-muted)] mb-5">
        Upload a screenshot of your TnG QR code. Colleagues will see this and
        the order total on the payment screen, or choose to pay you later
        instead.
      </p>

      <div
        className="rounded-lg border p-5 flex flex-col items-center mb-5"
        style={{ borderColor: "var(--border-c)", background: "var(--bg-card)" }}
      >
        {imageDataUrl ? (
          <img src={imageDataUrl} alt="TnG QR preview" className="w-44 h-44 object-contain mb-3 rounded" />
        ) : (
          <div
            className="w-44 h-44 flex items-center justify-center rounded mb-3"
            style={{ background: "#F0EADA", color: "#B3A992" }}
          >
            <QrCode className="w-10 h-10" />
          </div>
        )}
        <input ref={fileRef} type="file" accept="image/*" onChange={handleFile} className="hidden" />
        <button
          onClick={() => fileRef.current?.click()}
          className="flex items-center gap-1.5 text-sm font-semibold px-4 py-2 rounded-md border"
          style={{ borderColor: "var(--border-c)" }}
        >
          <ImagePlus className="w-4 h-4" />
          {imageDataUrl ? "Replace image" : "Upload QR image"}
        </button>
      </div>

      <input
        value={payeeName}
        onChange={(e) => setPayeeName(e.target.value)}
        placeholder="Payee name shown to colleagues (e.g. Ah Lian)"
        className="w-full border rounded-md px-3 py-2.5 text-sm outline-none mb-2"
        style={{ borderColor: "var(--border-c)" }}
      />
      <input
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder="Extra note (optional, e.g. add your name in TnG remarks)"
        className="w-full border rounded-md px-3 py-2.5 text-sm outline-none mb-4"
        style={{ borderColor: "var(--border-c)" }}
      />

      <button
        disabled={saving}
        onClick={handleSave}
        className="w-full rounded-md py-3 text-sm font-semibold flex items-center justify-center gap-1.5 disabled:opacity-60"
        style={{ background: "#1F5F5B", color: "#FAF6EE" }}
      >
        {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : saved ? <Check className="w-4 h-4" /> : null}
        {saved ? "Saved" : "Save payment details"}
      </button>
    </div>
  );
}

function OrdersPanel() {
  const [date, setDate] = useState(todayStr());
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState(null);
  const [zoomedProof, setZoomedProof] = useState(null);
  const [confirmingId, setConfirmingId] = useState(null);
  const [copyStatus, setCopyStatus] = useState("");

  const loadOrders = useCallback(async (d) => {
    setLoading(true);
    const keys = await storageList(`order:${d}:`);
    const results = await Promise.all(
      keys.map(async (k) => {
        const val = await storageGet(k);
        if (!val) return null;
        try {
          return { key: k, ...JSON.parse(val) };
        } catch (e) {
          return null;
        }
      })
    );
    setOrders(results.filter(Boolean).sort((a, b) => b.createdAt - a.createdAt));
    setLoading(false);
  }, []);

  useEffect(() => {
    loadOrders(date);
  }, [date, loadOrders]);

  async function updateStatus(order, status) {
    setBusyId(order.key);
    const next = { ...order, status };
    delete next.key;
    await storageSet(order.key, JSON.stringify(next));
    setOrders((prev) => prev.map((o) => (o.key === order.key ? { ...o, status } : o)));
    setBusyId(null);
  }

  // method is 'tng' | 'cash' | 'bank' | 'not_paid'. The first three mark the
  // order paid (confirmed) and tag how it was actually settled; 'not_paid'
  // flags it as rejected, e.g. after spotting a faked screenshot.
  async function setOrderPayment(order, method) {
    setBusyId(order.key);
    const status = method === "not_paid" ? "rejected" : "confirmed";
    const paymentMethod = method === "not_paid" ? order.paymentMethod : method;
    const next = { ...order, status, paymentMethod };
    delete next.key;
    await storageSet(order.key, JSON.stringify(next));
    setOrders((prev) =>
      prev.map((o) => (o.key === order.key ? { ...o, status, paymentMethod } : o))
    );
    setBusyId(null);
  }

  async function handleDelete(order) {
    setBusyId(order.key);
    await storageDelete(order.key);
    setOrders((prev) => prev.filter((o) => o.key !== order.key));
    setConfirmingId(null);
    setBusyId(null);
  }

  async function blockOrder(order) {
    const trimmedName = order.name.trim();
    if (!trimmedName) return;

    const [nameVal, deviceVal] = await Promise.all([
      storageGet("admin:blocklist"),
      storageGet("admin:blockedDevices"),
    ]);

    let names = [];
    if (nameVal) {
      try {
        names = JSON.parse(nameVal);
      } catch (e) {}
    }
    if (!names.some((n) => n.toLowerCase() === trimmedName.toLowerCase())) {
      names = [...names, trimmedName];
    }

    let devices = [];
    if (deviceVal) {
      try {
        devices = JSON.parse(deviceVal);
      } catch (e) {}
    }
    if (order.deviceId && !devices.some((d) => d.deviceId === order.deviceId)) {
      devices = [...devices, { deviceId: order.deviceId, name: trimmedName, blockedAt: Date.now() }];
    }

    await Promise.all([
      storageSet("admin:blocklist", JSON.stringify(names)),
      storageSet("admin:blockedDevices", JSON.stringify(devices)),
    ]);
  }

  const totalCount = orders.length;
  const paid = orders.filter((o) => o.status === "confirmed");
  const pending = orders.filter((o) => o.status === "submitted");
  const rejected = orders.filter((o) => o.status === "rejected");
  const paidTotal = paid.reduce((s, o) => s + o.total, 0);

  const amountBreakdown = (() => {
    const counts = {};
    orders
      .filter((o) => o.status !== "rejected")
      .forEach((o) => {
        const key = o.total.toFixed(2);
        counts[key] = (counts[key] || 0) + 1;
      });
    return Object.entries(counts)
      .map(([amount, count]) => ({ amount: Number(amount), count }))
      .sort((a, b) => a.amount - b.amount);
  })();

  const itemBreakdown = (() => {
    const counts = {};
    orders
      .filter((o) => o.status !== "rejected")
      .forEach((o) => {
        o.items.forEach((it) => {
          counts[summaryLabel(it)] = (counts[summaryLabel(it)] || 0) + it.qty;
        });
      });
    return Object.entries(counts)
      .map(([name, qty]) => ({ name, qty }))
      .sort((a, b) => b.qty - a.qty);
  })();
  const totalItemQty = itemBreakdown.reduce((s, r) => s + r.qty, 0);

  function buildSummaryText() {
    const lines = [`Lunch order summary — ${prettyDate(date)}`, ""];
    if (itemBreakdown.length > 0) {
      itemBreakdown.forEach((row) => lines.push(`${row.name}: ${row.qty}`));
      lines.push("", `Total items: ${totalItemQty}`);
    } else {
      lines.push("No items ordered.");
    }
    lines.push(
      "",
      `Orders: ${totalCount}  (Paid: ${paid.length}, Awaiting confirm: ${pending.length}, Rejected: ${rejected.length})`,
      `Amount collected (paid): ${money(paidTotal)}`
    );
    return lines.join("\n");
  }

  function handleEmailExport() {
    const subject = encodeURIComponent(`Lunch order summary — ${prettyDate(date)}`);
    const body = encodeURIComponent(buildSummaryText());
    window.location.href = `mailto:?subject=${subject}&body=${body}`;
  }

  async function handleCopySummary() {
    try {
      await navigator.clipboard.writeText(buildSummaryText());
      setCopyStatus("Copied!");
    } catch (e) {
      setCopyStatus("Couldn't copy");
    }
    setTimeout(() => setCopyStatus(""), 2000);
  }

  return (
    <div>
      <div className="flex items-center gap-2 mb-4">
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="border rounded-md px-3 py-2 text-sm outline-none"
          style={{ borderColor: "var(--border-c)" }}
        />
        <button
          onClick={() => loadOrders(date)}
          className="w-9 h-9 flex items-center justify-center rounded-md border shrink-0"
          style={{ borderColor: "var(--border-c)" }}
        >
          <RefreshCw className="w-4 h-4 text-[var(--text-muted)]" />
        </button>
      </div>

      <div className="grid grid-cols-3 gap-2 mb-5">
        <StatBox label="Total orders" value={totalCount} tone="neutral" />
        <StatBox label="Paid" value={paid.length} sub={money(paidTotal)} tone="confirmed" />
        <StatBox label="Awaiting confirm" value={pending.length} tone="pending" />
      </div>
      {rejected.length > 0 && (
        <div className="grid grid-cols-1 gap-2 mb-5">
          <StatBox label="Rejected" value={rejected.length} tone="rejected" />
        </div>
      )}

      {amountBreakdown.length > 0 && (
        <div
          className="rounded-lg border p-4 mb-5"
          style={{ borderColor: "var(--border-c)", background: "var(--bg-card)" }}
        >
          <div className="text-xs uppercase tracking-wide font-semibold text-[var(--text-muted)] mb-3">
            Orders by amount
          </div>
          {amountBreakdown.map((row, idx) => (
            <div key={row.amount}>
              <div className="flex items-center justify-between py-1.5">
                <span className="fo-num text-sm font-semibold" style={{ color: "#1F5F5B" }}>
                  {money(row.amount)}
                </span>
                <span className="text-xs text-[var(--text-muted)]">
                  {row.count} order{row.count > 1 ? "s" : ""}
                </span>
              </div>
              {idx < amountBreakdown.length - 1 && (
                <div className="border-t border-dashed" style={{ borderColor: "var(--border-light)" }} />
              )}
            </div>
          ))}
          <p className="text-[10px] text-[var(--text-faint)] mt-3">
            Excludes rejected orders — handy for matching against your bank/TnG statement.
          </p>
        </div>
      )}

      {itemBreakdown.length > 0 && (
        <div
          className="rounded-lg border p-4 mb-5"
          style={{ borderColor: "var(--border-c)", background: "var(--bg-card)" }}
        >
          <div className="text-xs uppercase tracking-wide font-semibold text-[var(--text-muted)] mb-3">
            Item summary
          </div>
          {itemBreakdown.map((row, idx) => (
            <div key={row.name}>
              <div className="flex items-center justify-between py-1.5">
                <span className="text-sm">{row.name}</span>
                <span className="fo-num text-sm font-semibold" style={{ color: "#1F5F5B" }}>
                  {row.qty}
                </span>
              </div>
              {idx < itemBreakdown.length - 1 && (
                <div className="border-t border-dashed" style={{ borderColor: "var(--border-light)" }} />
              )}
            </div>
          ))}
          <div
            className="border-t mt-2 pt-2 flex justify-between text-sm font-semibold"
            style={{ borderColor: "var(--border-c)" }}
          >
            <span>Total items</span>
            <span className="fo-num">{totalItemQty}</span>
          </div>

          <div className="flex gap-2 mt-4">
            <button
              onClick={handleEmailExport}
              className="flex-1 rounded-md py-2.5 text-sm font-semibold flex items-center justify-center gap-1.5"
              style={{ background: "#1F5F5B", color: "#FAF6EE" }}
            >
              <Mail className="w-4 h-4" />
              Email summary
            </button>
            <button
              onClick={handleCopySummary}
              className="shrink-0 rounded-md px-4 py-2.5 text-sm font-semibold border"
              style={{ borderColor: "var(--border-c)" }}
            >
              {copyStatus || "Copy"}
            </button>
          </div>
          <p className="text-[10px] text-[var(--text-faint)] mt-2">
            Opens your email app with the summary pre-filled — just tap Send.
          </p>
        </div>
      )}

      {loading ? (
        <Spinner label="Loading orders…" />
      ) : orders.length === 0 ? (
        <p className="text-sm text-[var(--text-faint)] text-center py-10">
          No orders for {prettyDate(date)} yet.
        </p>
      ) : (
        <div className="flex flex-col gap-3">
          {orders.map((order) => (
            <div
              key={order.key}
              className="rounded-lg border p-4"
              style={{ borderColor: "var(--border-c)", background: "var(--bg-card)" }}
            >
              <div className="flex items-start justify-between mb-2">
                <div>
                  <div className="fo-serif text-base">{order.name}</div>
                  <div className="text-[11px] text-[var(--text-faint)]">
                    {new Date(order.createdAt).toLocaleTimeString("en-MY", {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </div>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <Stamp tone={toneForStatus(order.status)}>{statusLabel(order.status)}</Stamp>
                  {order.status === "confirmed" && (
                    <span className="text-[10px] font-semibold text-[var(--text-muted)]">
                      via {paymentMethodLabel(order.paymentMethod)}
                    </span>
                  )}
                </div>
              </div>

              <div className="mb-2">
                {order.items.map((it, idx) => (
                  <div key={idx} className="text-xs text-[var(--text-muted)] py-0.5">
                    <span className="font-medium" style={{ color: "var(--text-primary)" }}>
                      {it.qty}× {itemLabel(it)}
                    </span>
                    {it.desc && <span> — {it.desc}</span>}
                    {it.custom && <span className="text-[#B8842E]"> (off-menu)</span>}
                  </div>
                ))}
              </div>

              {order.proofImage && (
                <button
                  type="button"
                  onClick={() => setZoomedProof(order.proofImage)}
                  className="mb-3"
                >
                  <img
                    src={order.proofImage}
                    alt="Payment screenshot"
                    className="w-16 h-16 object-cover rounded-md border"
                    style={{ borderColor: "var(--border-c)" }}
                  />
                  <div className="text-[10px] text-[var(--text-muted)] mt-1">Tap to view proof</div>
                </button>
              )}

              <div className="flex items-center justify-between mb-2">
                <span className="fo-num text-lg font-semibold" style={{ color: "#1F5F5B" }}>
                  {money(order.total)}
                </span>
                {order.status === "submitted" && (
                  <div className="flex gap-2">
                    <button
                      disabled={busyId === order.key}
                      onClick={() => updateStatus(order, "rejected")}
                      className="px-3 py-1.5 rounded-md text-xs font-semibold border flex items-center gap-1"
                      style={{ borderColor: "var(--border-c)", color: "#B33A2E" }}
                    >
                      <X className="w-3.5 h-3.5" />
                      Reject
                    </button>
                    <button
                      disabled={busyId === order.key}
                      onClick={() => updateStatus(order, "confirmed")}
                      className="px-3 py-1.5 rounded-md text-xs font-semibold flex items-center gap-1"
                      style={{ background: "#1F5F5B", color: "#FAF6EE" }}
                    >
                      <Check className="w-3.5 h-3.5" />
                      Mark as paid
                    </button>
                  </div>
                )}
              </div>

              {(order.status === "confirmed" || order.status === "rejected") && (
                <div>
                  <div className="text-[10px] uppercase tracking-wide font-semibold text-[var(--text-muted)] mb-1.5">
                    Paid via / override
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {[
                      { id: "tng", label: "TnG" },
                      { id: "cash", label: "Cash" },
                      { id: "bank", label: "Bank" },
                    ].map((m) => {
                      const active = order.status === "confirmed" && order.paymentMethod === m.id;
                      return (
                        <button
                          key={m.id}
                          disabled={busyId === order.key}
                          onClick={() => setOrderPayment(order, m.id)}
                          className="px-2.5 py-1 rounded-md text-xs font-semibold border"
                          style={{
                            borderColor: active ? "#1F5F5B" : "#DCD3C2",
                            background: active ? "#1F5F5B" : "transparent",
                            color: active ? "#FAF6EE" : "#7A7166",
                          }}
                        >
                          {m.label}
                        </button>
                      );
                    })}
                    <button
                      disabled={busyId === order.key}
                      onClick={() => setOrderPayment(order, "not_paid")}
                      className="px-2.5 py-1 rounded-md text-xs font-semibold border"
                      style={{
                        borderColor: order.status === "rejected" ? "#B33A2E" : "#DCD3C2",
                        background: order.status === "rejected" ? "#B33A2E" : "transparent",
                        color: order.status === "rejected" ? "#FAF6EE" : "#B33A2E",
                      }}
                    >
                      Not paid
                    </button>
                  </div>
                </div>
              )}

              {confirmingId === order.key ? (
                <div
                  className="flex items-center justify-between mt-3 pt-3 border-t"
                  style={{ borderColor: "var(--border-light)" }}
                >
                  <span className="text-xs text-[#B33A2E]">Delete this order?</span>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setConfirmingId(null)}
                      className="px-3 py-1 rounded-md text-xs font-semibold border"
                      style={{ borderColor: "var(--border-c)" }}
                    >
                      Cancel
                    </button>
                    <button
                      disabled={busyId === order.key}
                      onClick={() => handleDelete(order)}
                      className="px-3 py-1 rounded-md text-xs font-semibold flex items-center gap-1"
                      style={{ background: "#B33A2E", color: "#FAF6EE" }}
                    >
                      {busyId === order.key ? (
                        <Loader2 className="w-3 h-3 animate-spin" />
                      ) : (
                        <Trash2 className="w-3 h-3" />
                      )}
                      Delete
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-3 mt-2">
                  <button
                    onClick={() => setConfirmingId(order.key)}
                    className="text-xs text-[var(--text-faint)] underline flex items-center gap-1"
                  >
                    <Trash2 className="w-3 h-3" />
                    Delete order
                  </button>
                  {order.status !== "confirmed" && (
                    <button
                      onClick={() => blockOrder(order)}
                      disabled={busyId === order.key}
                      className="text-xs text-[#B33A2E] underline flex items-center gap-1"
                    >
                      <Lock className="w-3 h-3" />
                      Block {order.name.split(" ")[0]}
                    </button>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {zoomedProof && (
        <div
          className="fixed inset-0 z-50 flex flex-col items-center justify-center p-6"
          style={{ background: "rgba(31,26,20,0.94)" }}
          onClick={() => setZoomedProof(null)}
        >
          <img
            src={zoomedProof}
            alt="Payment screenshot enlarged"
            className="w-full max-w-sm rounded-lg"
            style={{ background: "var(--bg-card)", padding: "12px" }}
          />
          <p className="text-xs mt-4" style={{ color: "#C7BCA8" }}>
            Tap anywhere to close
          </p>
        </div>
      )}
    </div>
  );
}

function OrderListPanel() {
  const [date, setDate] = useState(todayStr());
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);

  const loadOrders = useCallback(async (d) => {
    setLoading(true);
    const keys = await storageList(`order:${d}:`);
    const results = await Promise.all(
      keys.map(async (k) => {
        const val = await storageGet(k);
        if (!val) return null;
        try {
          return { key: k, ...JSON.parse(val) };
        } catch (e) {
          return null;
        }
      })
    );
    setOrders(results.filter(Boolean).sort((a, b) => a.createdAt - b.createdAt));
    setLoading(false);
  }, []);

  useEffect(() => {
    loadOrders(date);
  }, [date, loadOrders]);

  // Only orders the admin has confirmed as paid count as "successful".
  const successfulOrders = orders.filter((o) => o.status === "confirmed");

  const rows = [];
  successfulOrders.forEach((o) => {
    o.items.forEach((it) => {
      rows.push({ name: o.name, label: summaryLabel(it), qty: it.qty });
    });
  });
  const totalQty = rows.reduce((s, r) => s + r.qty, 0);

  const chartData = (() => {
    const counts = {};
    rows.forEach((r) => {
      counts[r.label] = (counts[r.label] || 0) + r.qty;
    });
    return Object.entries(counts)
      .map(([name, qty]) => ({ name, qty }))
      .sort((a, b) => b.qty - a.qty);
  })();

  return (
    <div>
      <div className="flex items-center gap-2 mb-4">
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="border rounded-md px-3 py-2 text-sm outline-none"
          style={{ borderColor: "var(--border-c)" }}
        />
        <button
          onClick={() => loadOrders(date)}
          className="w-9 h-9 flex items-center justify-center rounded-md border shrink-0"
          style={{ borderColor: "var(--border-c)" }}
        >
          <RefreshCw className="w-4 h-4 text-[var(--text-muted)]" />
        </button>
      </div>

      <div className="text-xs uppercase tracking-wide font-semibold text-[var(--text-muted)] mb-3">
        Paid orders — {prettyDate(date)}
      </div>

      {loading ? (
        <Spinner label="Loading orders…" />
      ) : rows.length === 0 ? (
        <p className="text-sm text-[var(--text-faint)] text-center py-10">
          No paid orders for {prettyDate(date)} yet.
        </p>
      ) : (
        <div
          className="rounded-lg border p-4 mb-5"
          style={{ borderColor: "var(--border-c)", background: "var(--bg-card)" }}
        >
          {rows.map((r, idx) => (
            <div key={idx}>
              <div className="flex justify-between text-sm py-1.5">
                <span>
                  {idx + 1}) {r.name} - {r.label}
                </span>
                <span className="fo-num font-semibold" style={{ color: "#1F5F5B" }}>
                  = {r.qty}
                </span>
              </div>
              {idx < rows.length - 1 && (
                <div className="border-t border-dashed" style={{ borderColor: "var(--border-light)" }} />
              )}
            </div>
          ))}
          <div
            className="border-t mt-2 pt-2 flex justify-between fo-serif text-lg"
            style={{ borderColor: "var(--border-c)" }}
          >
            <span>Total</span>
            <span className="fo-num">= {totalQty}</span>
          </div>
        </div>
      )}

      {chartData.length > 0 && (
        <div
          className="rounded-lg border p-4"
          style={{ borderColor: "var(--border-c)", background: "var(--bg-card)" }}
        >
          <div className="text-xs uppercase tracking-wide font-semibold text-[var(--text-muted)] mb-3">
            Most ordered
          </div>
          <ResponsiveContainer width="100%" height={Math.max(160, chartData.length * 42)}>
            <BarChart data={chartData} layout="vertical" margin={{ left: 8, right: 24, top: 4, bottom: 4 }}>
              <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#EEE7D8" />
              <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11, fill: "#7A7166" }} />
              <YAxis
                type="category"
                dataKey="name"
                width={130}
                tick={{ fontSize: 11, fill: "#241F1A" }}
              />
              <Tooltip
                formatter={(value) => [value, "Ordered"]}
                contentStyle={{ fontSize: 12, borderRadius: 8, borderColor: "var(--border-c)" }}
              />
              <Bar dataKey="qty" fill="#1F5F5B" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}

function BlockedUsersPanel() {
  const [blocked, setBlocked] = useState([]);
  const [blockedDevices, setBlockedDevices] = useState([]);
  const [newName, setNewName] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [scanning, setScanning] = useState(false);

  const loadAll = useCallback(async () => {
    setLoading(true);
    const [nameVal, deviceVal] = await Promise.all([
      storageGet("admin:blocklist"),
      storageGet("admin:blockedDevices"),
    ]);
    if (nameVal) {
      try {
        setBlocked(JSON.parse(nameVal));
      } catch (e) {
        setBlocked([]);
      }
    } else {
      setBlocked([]);
    }
    if (deviceVal) {
      try {
        setBlockedDevices(JSON.parse(deviceVal));
      } catch (e) {
        setBlockedDevices([]);
      }
    } else {
      setBlockedDevices([]);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  async function persistBlocklist(next) {
    setSaving(true);
    setBlocked(next);
    await storageSet("admin:blocklist", JSON.stringify(next));
    setSaving(false);
  }

  async function persistDevices(next) {
    setSaving(true);
    setBlockedDevices(next);
    await storageSet("admin:blockedDevices", JSON.stringify(next));
    setSaving(false);
  }

  async function addBlocked() {
    const trimmed = newName.trim();
    if (!trimmed) return;
    setScanning(true);

    let nextNames = blocked;
    if (!blocked.some((n) => n.toLowerCase() === trimmed.toLowerCase())) {
      nextNames = [...blocked, trimmed];
      setBlocked(nextNames);
      await storageSet("admin:blocklist", JSON.stringify(nextNames));
    }

    // Find every past order whose name matches (even loosely, e.g. "junyang"
    // for "Gan Jun Yang"), and block the device behind each one too — so
    // this single action makes the block stick regardless of what name
    // they try next, not just an exact-name match going forward.
    const allOrderKeys = await storageList("order:");
    const allOrders = await Promise.all(
      allOrderKeys.map(async (k) => {
        const val = await storageGet(k);
        if (!val) return null;
        try {
          return JSON.parse(val);
        } catch (e) {
          return null;
        }
      })
    );
    const matchingDeviceIds = new Set();
    allOrders.filter(Boolean).forEach((o) => {
      if (o.deviceId && namesMatch(trimmed, o.name)) {
        matchingDeviceIds.add(o.deviceId);
      }
    });

    if (matchingDeviceIds.size > 0) {
      let nextDevices = blockedDevices;
      matchingDeviceIds.forEach((deviceId) => {
        if (!nextDevices.some((d) => d.deviceId === deviceId)) {
          nextDevices = [...nextDevices, { deviceId, name: trimmed, blockedAt: Date.now() }];
        }
      });
      setBlockedDevices(nextDevices);
      await storageSet("admin:blockedDevices", JSON.stringify(nextDevices));
    }

    setScanning(false);
    setNewName("");
  }

  async function removeBlocked(nameToRemove) {
    await persistBlocklist(blocked.filter((n) => n !== nameToRemove));
  }

  async function removeBlockedDevice(deviceId) {
    await persistDevices(blockedDevices.filter((d) => d.deviceId !== deviceId));
  }

  return (
    <div>
      <p className="text-sm text-[var(--text-muted)] mb-5">
        Block a colleague who still owes payment from a previous order.
        While blocked, they'll see "order unsuccessful" and can't submit a
        new order until you remove them here — usually once they've paid up.
        Typing a name below also scans their past orders and blocks the
        device(s) behind them, so the block sticks even if they try
        ordering under a different name afterward.
      </p>

      <div
        className="rounded-lg border p-4 mb-5"
        style={{ borderColor: "var(--border-c)", background: "var(--bg-card)" }}
      >
        <div className="flex items-center gap-2">
          <input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && addBlocked()}
            placeholder="Name exactly as they typed it"
            className="flex-1 border rounded-md px-3 py-2.5 text-sm outline-none"
            style={{ borderColor: "var(--border-c)" }}
          />
          <button
            onClick={addBlocked}
            disabled={!newName.trim() || scanning}
            className="shrink-0 rounded-md px-4 py-2.5 text-sm font-semibold disabled:opacity-40 flex items-center gap-1.5"
            style={{ background: "#B33A2E", color: "#FAF6EE" }}
          >
            {scanning && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            {scanning ? "Blocking…" : "Block"}
          </button>
        </div>
        <p className="text-[10px] text-[var(--text-faint)] mt-2">
          Tip: avoid blocking a very short or common name/word on its own
          (e.g. just "Jun") since it may also match other colleagues who
          share that partial name. If a colleague might type an English name
          one time and a Chinese name another, block both — the device found
          from either one gets blocked too, so you only need to catch one.
        </p>
      </div>

      <div className="mb-2 text-xs uppercase tracking-wide font-semibold text-[var(--text-muted)]">
        Blocked names ({blocked.length})
      </div>

      {loading ? (
        <Spinner label="Loading…" />
      ) : blocked.length === 0 ? (
        <p className="text-sm text-[var(--text-faint)] mb-5">No names blocked right now.</p>
      ) : (
        <div
          className="rounded-lg border p-4 mb-5"
          style={{ borderColor: "var(--border-c)", background: "var(--bg-card)" }}
        >
          {blocked.map((n, idx) => (
            <div key={n}>
              <div className="flex items-center justify-between py-2">
                <span className="text-sm">{n}</span>
                <button
                  onClick={() => removeBlocked(n)}
                  disabled={saving}
                  className="text-xs font-semibold px-3 py-1.5 rounded-md border"
                  style={{ borderColor: "var(--border-c)", color: "#1F5F5B" }}
                >
                  Unblock
                </button>
              </div>
              {idx < blocked.length - 1 && (
                <div className="border-t border-dashed" style={{ borderColor: "var(--border-light)" }} />
              )}
            </div>
          ))}
        </div>
      )}

      <div className="mb-2 text-xs uppercase tracking-wide font-semibold text-[var(--text-muted)]">
        Blocked devices ({blockedDevices.length})
      </div>
      <p className="text-xs text-[var(--text-muted)] mb-3">
        These stick regardless of what name is typed on that device — added
        automatically when you tap "Block [Name]" on an order.
      </p>

      {loading ? null : blockedDevices.length === 0 ? (
        <p className="text-sm text-[var(--text-faint)]">No devices blocked right now.</p>
      ) : (
        <div
          className="rounded-lg border p-4"
          style={{ borderColor: "var(--border-c)", background: "var(--bg-card)" }}
        >
          {blockedDevices.map((d, idx) => (
            <div key={d.deviceId}>
              <div className="flex items-center justify-between py-2">
                <div>
                  <div className="text-sm">{d.name}</div>
                  <div className="text-[10px] text-[var(--text-faint)]">
                    Blocked{" "}
                    {d.blockedAt
                      ? new Date(d.blockedAt).toLocaleDateString("en-MY", {
                          day: "numeric",
                          month: "short",
                        })
                      : ""}
                  </div>
                </div>
                <button
                  onClick={() => removeBlockedDevice(d.deviceId)}
                  disabled={saving}
                  className="text-xs font-semibold px-3 py-1.5 rounded-md border"
                  style={{ borderColor: "var(--border-c)", color: "#1F5F5B" }}
                >
                  Unblock
                </button>
              </div>
              {idx < blockedDevices.length - 1 && (
                <div className="border-t border-dashed" style={{ borderColor: "var(--border-light)" }} />
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}


function StatBox({ label, value, sub, tone }) {
  const colors = {
    neutral: "var(--text-primary)",
    confirmed: "#1F5F5B",
    pending: "#B8842E",
    rejected: "#B33A2E",
    later: "#6B5CA5",
  };
  return (
    <div className="rounded-lg border p-3 text-center" style={{ borderColor: "var(--border-c)", background: "var(--bg-card)" }}>
      <div className="fo-num text-lg font-semibold" style={{ color: colors[tone] }}>
        {value}
      </div>
      <div className="text-[10px] uppercase tracking-wide text-[var(--text-muted)] mt-0.5">{label}</div>
      {sub && <div className="fo-num text-[10px] text-[var(--text-faint)] mt-0.5">{sub}</div>}
    </div>
  );
}
