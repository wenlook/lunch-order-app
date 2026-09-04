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
} from "lucide-react";

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

import { storageGet, storageSet, storageDelete, storageList } from "./storage";

function statusLabel(status) {
  if (status === "confirmed") return "paid";
  if (status === "rejected") return "rejected";
  return "pending";
}

function toneForStatus(status) {
  if (status === "confirmed") return "confirmed";
  if (status === "rejected") return "rejected";
  return "pending";
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
    <div className="flex items-center justify-center gap-2 py-16 text-[#7A7166]">
      <Loader2 className="w-5 h-5 animate-spin" />
      <span className="text-sm">{label}</span>
    </div>
  );
}

function DashedDivider() {
  return (
    <div className="w-full border-t-2 border-dashed my-3" style={{ borderColor: "#DCD3C2" }} />
  );
}

function BackRow({ onBack, label }) {
  return (
    <button onClick={onBack} className="flex items-center gap-1.5 text-sm text-[#7A7166]">
      <ArrowLeft className="w-4 h-4" />
      {label}
    </button>
  );
}

function Shell({ children }) {
  return (
    <div className="min-h-screen w-full flex justify-center" style={{ background: "#FAF6EE" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,400;0,9..144,600;0,9..144,700;1,9..144,500&family=Inter:wght@400;500;600;700&display=swap');
        .fo-serif { font-family: 'Fraunces', serif; }
        .fo-sans { font-family: 'Inter', sans-serif; }
        .fo-num { font-variant-numeric: tabular-nums; }
      `}</style>
      <div className="w-full max-w-md min-h-screen fo-sans" style={{ color: "#241F1A" }}>
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
  const [orderResetKey, setOrderResetKey] = useState(0);

  const loadCore = useCallback(async () => {
    const [menuVal, qrVal] = await Promise.all([
      storageGet("menu:current"),
      storageGet("payment:qr"),
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
      <Shell>
        <Spinner label="Opening today's menu…" />
      </Shell>
    );
  }

  return (
    <Shell>
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
          onSuccess={() => setScreen("admin")}
        />
      )}
      {screen === "admin" && (
        <AdminPanel
          menu={menu}
          qr={qr}
          onSaveMenu={saveMenu}
          onSaveQr={saveQr}
          onLock={() => setScreen("home")}
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
    <div className="px-6 pt-14 pb-10 flex flex-col min-h-screen">
      <div className="flex-1">
        <div className="flex items-center gap-2 text-[#B8842E] mb-3">
          <ChefHat className="w-5 h-5" />
          <span className="text-xs uppercase tracking-wider font-semibold">
            {prettyDate(todayStr())}
          </span>
        </div>
        <h1 className="fo-serif text-4xl leading-tight mb-2" style={{ color: "#1F1A14" }}>
          What's on
          <br />
          today's order?
        </h1>
        <p className="text-[#7A7166] text-sm mb-10">
          {dishCount > 0
            ? `${dishCount} dish${dishCount > 1 ? "es" : ""} posted for today.${
                menu.isOpen ? "" : " Ordering is currently closed."
              }`
            : "No dishes posted yet — check back soon."}
        </p>

        <button
          onClick={onOrder}
          className="w-full text-left rounded-lg p-5 mb-4 flex items-center justify-between transition-transform active:scale-[0.98]"
          style={{ background: "#1F5F5B", color: "#FAF6EE" }}
        >
          <div>
            <div className="fo-serif text-xl mb-1">Order lunch</div>
            <div className="text-xs opacity-80">Pick your dishes and pay</div>
          </div>
          <ShoppingBag className="w-6 h-6 shrink-0" />
        </button>

        <button
          onClick={onAdmin}
          className="w-full text-left rounded-lg p-5 flex items-center justify-between border transition-transform active:scale-[0.98]"
          style={{ borderColor: "#DCD3C2", background: "transparent" }}
        >
          <div>
            <div className="fo-serif text-xl mb-1">Admin</div>
            <div className="text-xs text-[#7A7166]">Update dishes &amp; check payments</div>
          </div>
          <Lock className="w-5 h-5 shrink-0 text-[#7A7166]" />
        </button>
      </div>

      <p className="text-center text-[10px] text-[#B3A992] mt-10">
        Internal lunch ordering · not affiliated with Touch 'n Go
      </p>
    </div>
  );
}

/* ---------------------------------------------------------------
   User ordering flow
--------------------------------------------------------------- */

function UserFlow({ menu, qr, onBack, onRefreshMenu, onDone }) {
  const [step, setStep] = useState("name"); // name | menu | checkout | submitted
  const [name, setName] = useState("");
  const [cart, setCart] = useState({}); // dishId -> qty
  const [customItems, setCustomItems] = useState([]); // [{id, name, qty}]
  const [customFoodName, setCustomFoodName] = useState("");
  const [proofImage, setProofImage] = useState("");
  const [submittedOrder, setSubmittedOrder] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [qrZoomed, setQrZoomed] = useState(false);
  const [closedMessage, setClosedMessage] = useState("");

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
    .filter(([, qty]) => qty > 0)
    .map(([dishId, qty]) => {
      const dish = dishes.find((d) => d.id === dishId);
      return dish
        ? { dishId, name: dish.name, desc: dish.desc || "", price: dish.price, qty }
        : null;
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

  function setQty(dishId, qty) {
    setCart((c) => ({ ...c, [dishId]: Math.max(0, qty) }));
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

  function handleProofFile(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setProofImage(reader.result);
    reader.readAsDataURL(file);
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

    const order = {
      id: uid("o"),
      date: todayStr(),
      name: name.trim(),
      items,
      total,
      paymentMethod: "tng",
      proofImage,
      status: "submitted",
      createdAt: Date.now(),
    };
    await storageSet(`order:${order.date}:${order.id}`, JSON.stringify(order));
    setSubmittedOrder(order);
    setSubmitting(false);
    setStep("submitted");
  }

  if (step === "name") {
    return (
      <div className="px-6 pt-8 pb-10 min-h-screen flex flex-col">
        <BackRow onBack={onBack} label="Home" />
        <h2 className="fo-serif text-2xl mt-6 mb-1">Who's ordering?</h2>
        <p className="text-sm text-[#7A7166] mb-6">So the admin knows whose order this is.</p>
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
          style={{ borderColor: "#DCD3C2", background: "#FFFFFF" }}
        />
        <div className="flex-1" />
        <button
          disabled={
            !name.trim() ||
            !menu.isOpen ||
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
    return (
      <div className="min-h-screen flex flex-col pb-28">
        <div className="px-6 pt-8">
          <BackRow onBack={() => setStep("name")} label="Back" />
          <h2 className="fo-serif text-2xl mt-6 mb-1">Today's menu</h2>
          <p className="text-sm text-[#7A7166] mb-5">{prettyDate(todayStr())}</p>
        </div>

        <div className="px-6 flex-1">
          {dishes.map((dish, idx) => {
            const qty = cart[dish.id] || 0;
            return (
              <div key={dish.id}>
                <div className="flex items-start justify-between py-3">
                  <div className="pr-3">
                    <div className="fo-serif text-lg leading-snug">{dish.name}</div>
                    {dish.extraName && (
                      <div className="text-xs text-[#7A7166] italic mt-0.5">{dish.extraName}</div>
                    )}
                    {dish.desc && (
                      <div className="text-xs text-[#7A7166] mt-0.5">{dish.desc}</div>
                    )}
                    <div className="fo-num text-sm mt-1 text-[#B8842E] font-semibold">
                      {money(dish.price)}
                    </div>
                  </div>
                  {qty === 0 ? (
                    <button
                      onClick={() => setQty(dish.id, 1)}
                      className="shrink-0 rounded-md px-4 py-2 text-sm font-semibold"
                      style={{ background: "#1F5F5B", color: "#FAF6EE" }}
                    >
                      Add
                    </button>
                  ) : (
                    <div
                      className="shrink-0 flex items-center gap-3 rounded-md px-2 py-1.5"
                      style={{ background: "#F0EADA" }}
                    >
                      <button
                        onClick={() => setQty(dish.id, qty - 1)}
                        className="w-6 h-6 flex items-center justify-center rounded"
                        style={{ color: "#1F5F5B" }}
                      >
                        <Minus className="w-4 h-4" />
                      </button>
                      <span className="fo-num text-sm font-semibold w-4 text-center">{qty}</span>
                      <button
                        onClick={() => setQty(dish.id, qty + 1)}
                        className="w-6 h-6 flex items-center justify-center rounded"
                        style={{ color: "#1F5F5B" }}
                      >
                        <Plus className="w-4 h-4" />
                      </button>
                    </div>
                  )}
                </div>
                {idx < dishes.length - 1 && <DashedDivider />}
              </div>
            );
          })}

          {menu.customEnabled && menu.customPrice != null && (
            <div className="mt-2">
              <div className="text-xs uppercase tracking-wide font-semibold text-[#7A7166] mb-2">
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
                  className="flex-1 border rounded-md px-3 py-2.5 text-sm outline-none"
                  style={{ borderColor: "#DCD3C2", background: "#FFFFFF" }}
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
              <p className="text-[10px] text-[#B3A992] mt-2">
                {money(offMenuPrice)} each, set by the admin.
              </p>
            </div>
          )}
        </div>

        <div
          className="fixed bottom-0 left-0 right-0 flex justify-center"
          style={{ background: "linear-gradient(transparent, #FAF6EE 20%)" }}
        >
          <div className="w-full max-w-md px-6 pb-6 pt-4">
            <button
              disabled={items.length === 0}
              onClick={() => setStep("checkout")}
              className="w-full rounded-lg py-3.5 font-semibold disabled:opacity-40 flex items-center justify-between px-5 transition-transform active:scale-[0.98]"
              style={{ background: "#1F5F5B", color: "#FAF6EE" }}
            >
              <span>
                {items.length === 0
                  ? "Select a dish to continue"
                  : `Review order · ${items.reduce((s, i) => s + i.qty, 0)} item(s)`}
              </span>
              {items.length > 0 && <span className="fo-num">{money(total)}</span>}
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (step === "checkout") {
    return (
      <>
      <div className="px-6 pt-8 pb-10 min-h-screen flex flex-col">
        <BackRow onBack={() => setStep("menu")} label="Edit order" />
        <h2 className="fo-serif text-2xl mt-6 mb-1">Pay &amp; confirm</h2>
        <p className="text-sm text-[#7A7166] mb-5">{name}</p>

        <div className="rounded-lg p-4 border mb-5" style={{ borderColor: "#DCD3C2", background: "#FFFFFF" }}>
          {items.map((it, idx) => (
            <div key={it.dishId}>
              <div className="flex justify-between text-sm py-1.5">
                <div>
                  <div>
                    {it.qty}× {it.name}
                  </div>
                  {it.desc && (
                    <div className="text-xs text-[#7A7166] mt-0.5">{it.desc}</div>
                  )}
                </div>
                <span className="fo-num shrink-0 pl-2">{money(it.price * it.qty)}</span>
              </div>
              {idx < items.length - 1 && (
                <div className="border-t border-dashed my-0.5" style={{ borderColor: "#EEE7D8" }} />
              )}
            </div>
          ))}
          <div className="border-t mt-2 pt-2 flex justify-between fo-serif text-lg" style={{ borderColor: "#DCD3C2" }}>
            <span>Total</span>
            <span className="fo-num">{money(total)}</span>
          </div>
        </div>

        <div
          className="rounded-lg p-5 border mb-5 flex flex-col items-center text-center"
          style={{ borderColor: "#DCD3C2", background: "#FFFFFF" }}
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
            <p className="text-[10px] text-[#B3A992] -mt-2 mb-1">Tap the QR to enlarge</p>
          )}
          <div className="text-xs uppercase tracking-wide text-[#7A7166] font-semibold mb-1">
            Scan with TnG eWallet
          </div>
          {qr.payeeName && <div className="fo-serif text-base">{qr.payeeName}</div>}
          <div className="fo-num text-2xl font-semibold mt-2" style={{ color: "#1F5F5B" }}>
            {money(total)}
          </div>
          {qr.note && <p className="text-xs text-[#7A7166] mt-2">{qr.note}</p>}
          {!qr.imageDataUrl && (
            <p className="text-xs text-[#B33A2E] mt-2">Admin hasn't uploaded a QR code yet.</p>
          )}
        </div>

        <div
          className="rounded-lg p-4 border mb-5"
          style={{ borderColor: "#DCD3C2", background: "#FFFFFF" }}
        >
          <div className="text-xs uppercase tracking-wide font-semibold text-[#7A7166] mb-3">
            Upload payment screenshot
          </div>
          {proofImage ? (
            <div className="flex flex-col items-center">
              <img
                src={proofImage}
                alt="Payment screenshot preview"
                className="w-full max-w-[220px] rounded-lg mb-3 border"
                style={{ borderColor: "#DCD3C2" }}
              />
              <label
                className="text-xs font-semibold px-4 py-2 rounded-md border cursor-pointer"
                style={{ borderColor: "#DCD3C2" }}
              >
                Replace screenshot
                <input type="file" accept="image/*" onChange={handleProofFile} className="hidden" />
              </label>
            </div>
          ) : (
            <label
              className="flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed py-8 cursor-pointer"
              style={{ borderColor: "#DCD3C2" }}
            >
              <ImagePlus className="w-6 h-6" style={{ color: "#B3A992" }} />
              <span className="text-sm font-semibold" style={{ color: "#1F5F5B" }}>
                Tap to upload a screenshot
              </span>
              <span className="text-xs text-[#7A7166]">Your TnG payment confirmation</span>
              <input type="file" accept="image/*" onChange={handleProofFile} className="hidden" />
            </label>
          )}
        </div>

        <p className="text-xs text-[#7A7166] mb-5 text-center leading-relaxed">
          Pay the exact amount above via TnG, upload a screenshot of the
          confirmation, then tap the button below. Your order will be
          marked <em>pending</em> until the admin confirms the transfer
          landed.
        </p>

        <div className="flex-1" />
        <button
          disabled={submitting || !proofImage}
          onClick={handleSubmitOrder}
          className="w-full rounded-lg py-3.5 font-semibold flex items-center justify-center gap-2 transition-transform active:scale-[0.98] disabled:opacity-60"
          style={{ background: "#1F5F5B", color: "#FAF6EE" }}
        >
          {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
          I've completed payment — submit order
        </button>
        {!proofImage && (
          <p className="text-center text-xs text-[#B8842E] mt-2">
            Upload your payment screenshot to continue
          </p>
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
            style={{ background: "#FFFFFF", padding: "20px" }}
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
      <div className="px-6 pt-16 pb-10 min-h-screen flex flex-col items-center text-center">
        <div className="w-16 h-16 rounded-full flex items-center justify-center mb-5" style={{ background: "#1F5F5B" }}>
          <Check className="w-8 h-8" style={{ color: "#FAF6EE" }} />
        </div>
        <h2 className="fo-serif text-2xl mb-2">Order submitted</h2>
        <p className="text-sm text-[#7A7166] mb-6 max-w-xs">
          Thanks, {submittedOrder.name.split(" ")[0]}. Your order is{" "}
          <Stamp tone={toneForStatus(submittedOrder.status)}>
            {statusLabel(submittedOrder.status)}
          </Stamp>{" "}
          until the admin confirms your payment came through.
        </p>
        <div className="rounded-lg p-4 border w-full text-left mb-8" style={{ borderColor: "#DCD3C2", background: "#FFFFFF" }}>
          {submittedOrder.items.map((it) => (
            <div key={it.dishId} className="flex justify-between text-sm py-1">
              <span>
                {it.qty}× {it.name}
              </span>
              <span className="fo-num">{money(it.price * it.qty)}</span>
            </div>
          ))}
          <div className="border-t mt-2 pt-2 flex justify-between fo-serif" style={{ borderColor: "#DCD3C2" }}>
            <span>Total paid</span>
            <span className="fo-num">{money(submittedOrder.total)}</span>
          </div>
        </div>
        <button
          onClick={onDone}
          className="w-full rounded-lg py-3.5 font-semibold border"
          style={{ borderColor: "#DCD3C2" }}
        >
          Done
        </button>
      </div>
    );
  }

  return null;
}

/* ---------------------------------------------------------------
   Admin login
--------------------------------------------------------------- */

function AdminLogin({ onBack, onSuccess }) {
  const [pass, setPass] = useState("");
  const [confirmPass, setConfirmPass] = useState("");
  const [hasPasscode, setHasPasscode] = useState(null); // null = loading
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    (async () => {
      const val = await storageGet("admin:passcode");
      setHasPasscode(!!val);
    })();
  }, []);

  async function handleLogin() {
    setError("");
    const val = await storageGet("admin:passcode");
    if (val === pass && pass.length > 0) {
      onSuccess();
    } else {
      setError("Wrong passcode.");
    }
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
    setBusy(false);
    onSuccess();
  }

  if (hasPasscode === null) {
    return <Spinner label="Loading…" />;
  }

  return (
    <div className="px-6 pt-8 pb-10 min-h-screen flex flex-col">
      <BackRow onBack={onBack} label="Home" />
      <div className="flex-1 flex flex-col justify-center">
        <div className="w-12 h-12 rounded-full flex items-center justify-center mb-5" style={{ background: "#F0EADA" }}>
          <Lock className="w-5 h-5" style={{ color: "#1F5F5B" }} />
        </div>
        <h2 className="fo-serif text-2xl mb-1">
          {hasPasscode ? "Admin passcode" : "Set an admin passcode"}
        </h2>
        <p className="text-sm text-[#7A7166] mb-6">
          {hasPasscode
            ? "Enter the passcode to manage today's menu and orders."
            : "No passcode set yet — create one now. Anyone with it can manage the menu."}
        </p>
        <input
          type="password"
          autoFocus
          value={pass}
          onChange={(e) => setPass(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && hasPasscode && handleLogin()}
          placeholder="Passcode"
          className="w-full border rounded-lg px-4 py-3 text-base outline-none mb-3"
          style={{ borderColor: "#DCD3C2", background: "#FFFFFF" }}
        />
        {!hasPasscode && (
          <input
            type="password"
            value={confirmPass}
            onChange={(e) => setConfirmPass(e.target.value)}
            placeholder="Confirm passcode"
            className="w-full border rounded-lg px-4 py-3 text-base outline-none mb-3"
            style={{ borderColor: "#DCD3C2", background: "#FFFFFF" }}
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
        <p className="text-[10px] text-[#B3A992] mt-4 text-center leading-relaxed">
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

function AdminPanel({ menu, qr, onSaveMenu, onSaveQr, onLock }) {
  const [tab, setTab] = useState("menu"); // menu | qr | orders

  return (
    <div className="min-h-screen flex flex-col">
      <div className="px-6 pt-8">
        <div className="flex items-center justify-between mb-4">
          <h2 className="fo-serif text-2xl">Admin</h2>
          <button
            onClick={onLock}
            className="flex items-center gap-1.5 text-xs font-semibold text-[#7A7166] border rounded-md px-3 py-1.5"
            style={{ borderColor: "#DCD3C2" }}
          >
            <LogOut className="w-3.5 h-3.5" />
            Lock
          </button>
        </div>
        <div className="flex gap-1 border-b" style={{ borderColor: "#DCD3C2" }}>
          {[
            { id: "menu", label: "Menu" },
            { id: "qr", label: "Payment QR" },
            { id: "orders", label: "Orders" },
          ].map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className="px-3 py-2.5 text-sm font-semibold -mb-px border-b-2"
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
      </div>
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
  const [price, setPrice] = useState("");
  const [desc, setDesc] = useState("");
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
    setPrice("");
    setDesc("");
    setEditingId(null);
  }

  async function handleAddOrUpdate() {
    const priceNum = parseFloat(price);
    if (!name.trim() || isNaN(priceNum) || priceNum < 0) return;
    let next;
    if (editingId) {
      next = dishes.map((d) =>
        d.id === editingId
          ? { ...d, name: name.trim(), extraName: extraName.trim(), price: priceNum, desc: desc.trim() }
          : d
      );
    } else {
      next = [
        ...dishes,
        {
          id: uid("d"),
          name: name.trim(),
          extraName: extraName.trim(),
          price: priceNum,
          desc: desc.trim(),
        },
      ];
    }
    setDishes(next);
    resetForm();
    await persist({ dishes: next });
  }

  function startEdit(dish) {
    setEditingId(dish.id);
    setName(dish.name);
    setExtraName(dish.extraName || "");
    setPrice(String(dish.price));
    setDesc(dish.desc || "");
  }

  async function handleDelete(id) {
    const next = dishes.filter((d) => d.id !== id);
    setDishes(next);
    if (editingId === id) resetForm();
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
        style={{ borderColor: "#DCD3C2", background: "#FFFFFF" }}
      >
        <div>
          <div className="text-sm font-semibold">Ordering is {isOpen ? "open" : "closed"}</div>
          <div className="text-xs text-[#7A7166]">
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
        style={{ borderColor: "#DCD3C2", background: "#FFFFFF" }}
      >
        <div className="flex items-center justify-between mb-1">
          <div>
            <div className="text-sm font-semibold">
              Off-menu requests {customEnabled ? "on" : "off"}
            </div>
            <div className="text-xs text-[#7A7166]">
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
              style={{ borderColor: "#DCD3C2" }}
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

      <div className="mb-2 text-xs uppercase tracking-wide font-semibold text-[#7A7166]">
        Today's dishes ({dishes.length})
      </div>

      {dishes.length === 0 && (
        <p className="text-sm text-[#B3A992] mb-4">Nothing posted yet — add your first dish below.</p>
      )}

      {dishes.map((dish, idx) => (
        <div key={dish.id}>
          <div className="flex items-start justify-between py-2.5">
            <div className="pr-3">
              <div className="fo-serif text-base">{dish.name}</div>
              {dish.extraName && (
                <div className="text-xs text-[#7A7166] italic">{dish.extraName}</div>
              )}
              {dish.desc && <div className="text-xs text-[#7A7166]">{dish.desc}</div>}
              <div className="fo-num text-sm text-[#B8842E] font-semibold mt-0.5">
                {money(dish.price)}
              </div>
            </div>
            <div className="flex gap-1.5 shrink-0">
              <button
                onClick={() => startEdit(dish)}
                className="w-8 h-8 flex items-center justify-center rounded-md border"
                style={{ borderColor: "#DCD3C2" }}
              >
                <Pencil className="w-3.5 h-3.5" style={{ color: "#7A7166" }} />
              </button>
              <button
                onClick={() => handleDelete(dish.id)}
                className="w-8 h-8 flex items-center justify-center rounded-md border"
                style={{ borderColor: "#DCD3C2" }}
              >
                <Trash2 className="w-3.5 h-3.5" style={{ color: "#B33A2E" }} />
              </button>
            </div>
          </div>
          {idx < dishes.length - 1 && <DashedDivider />}
        </div>
      ))}

      <div className="rounded-lg border p-4 mt-6" style={{ borderColor: "#DCD3C2", background: "#FFFFFF" }}>
        <div className="text-sm font-semibold mb-3">{editingId ? "Edit dish" : "Add a dish"}</div>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Dish name"
          className="w-full border rounded-md px-3 py-2.5 text-sm outline-none mb-2"
          style={{ borderColor: "#DCD3C2" }}
        />
        <input
          value={extraName}
          onChange={(e) => setExtraName(e.target.value)}
          placeholder="Extra dish name (optional)"
          className="w-full border rounded-md px-3 py-2.5 text-sm outline-none mb-2"
          style={{ borderColor: "#DCD3C2" }}
        />
        <input
          value={price}
          onChange={(e) => setPrice(e.target.value)}
          placeholder="Price (RM)"
          type="number"
          step="0.10"
          min="0"
          className="w-full border rounded-md px-3 py-2.5 text-sm outline-none mb-2 fo-num"
          style={{ borderColor: "#DCD3C2" }}
        />
        <input
          value={desc}
          onChange={(e) => setDesc(e.target.value)}
          placeholder="Description (optional)"
          className="w-full border rounded-md px-3 py-2.5 text-sm outline-none mb-3"
          style={{ borderColor: "#DCD3C2" }}
        />
        <div className="flex gap-2">
          {editingId && (
            <button
              onClick={resetForm}
              className="px-4 py-2.5 rounded-md text-sm font-semibold border"
              style={{ borderColor: "#DCD3C2" }}
            >
              Cancel
            </button>
          )}
          <button
            disabled={!name.trim() || !price || saving}
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
      <p className="text-sm text-[#7A7166] mb-5">
        Upload a screenshot of your TnG QR code. Colleagues will see this and
        the order total on the payment screen, or choose to pay you later
        instead.
      </p>

      <div
        className="rounded-lg border p-5 flex flex-col items-center mb-5"
        style={{ borderColor: "#DCD3C2", background: "#FFFFFF" }}
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
          style={{ borderColor: "#DCD3C2" }}
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
        style={{ borderColor: "#DCD3C2" }}
      />
      <input
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder="Extra note (optional, e.g. add your name in TnG remarks)"
        className="w-full border rounded-md px-3 py-2.5 text-sm outline-none mb-4"
        style={{ borderColor: "#DCD3C2" }}
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

  async function handleDelete(order) {
    setBusyId(order.key);
    await storageDelete(order.key);
    setOrders((prev) => prev.filter((o) => o.key !== order.key));
    setConfirmingId(null);
    setBusyId(null);
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

  return (
    <div>
      <div className="flex items-center gap-2 mb-4">
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="border rounded-md px-3 py-2 text-sm outline-none"
          style={{ borderColor: "#DCD3C2" }}
        />
        <button
          onClick={() => loadOrders(date)}
          className="w-9 h-9 flex items-center justify-center rounded-md border shrink-0"
          style={{ borderColor: "#DCD3C2" }}
        >
          <RefreshCw className="w-4 h-4 text-[#7A7166]" />
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
          style={{ borderColor: "#DCD3C2", background: "#FFFFFF" }}
        >
          <div className="text-xs uppercase tracking-wide font-semibold text-[#7A7166] mb-3">
            Orders by amount
          </div>
          {amountBreakdown.map((row, idx) => (
            <div key={row.amount}>
              <div className="flex items-center justify-between py-1.5">
                <span className="fo-num text-sm font-semibold" style={{ color: "#1F5F5B" }}>
                  {money(row.amount)}
                </span>
                <span className="text-xs text-[#7A7166]">
                  {row.count} order{row.count > 1 ? "s" : ""}
                </span>
              </div>
              {idx < amountBreakdown.length - 1 && (
                <div className="border-t border-dashed" style={{ borderColor: "#EEE7D8" }} />
              )}
            </div>
          ))}
          <p className="text-[10px] text-[#B3A992] mt-3">
            Excludes rejected orders — handy for matching against your bank/TnG statement.
          </p>
        </div>
      )}

      {loading ? (
        <Spinner label="Loading orders…" />
      ) : orders.length === 0 ? (
        <p className="text-sm text-[#B3A992] text-center py-10">
          No orders for {prettyDate(date)} yet.
        </p>
      ) : (
        <div className="flex flex-col gap-3">
          {orders.map((order) => (
            <div
              key={order.key}
              className="rounded-lg border p-4"
              style={{ borderColor: "#DCD3C2", background: "#FFFFFF" }}
            >
              <div className="flex items-start justify-between mb-2">
                <div>
                  <div className="fo-serif text-base">{order.name}</div>
                  <div className="text-[11px] text-[#B3A992]">
                    {new Date(order.createdAt).toLocaleTimeString("en-MY", {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </div>
                </div>
                <Stamp tone={toneForStatus(order.status)}>{statusLabel(order.status)}</Stamp>
              </div>

              <div className="mb-2">
                {order.items.map((it, idx) => (
                  <div key={idx} className="text-xs text-[#7A7166] py-0.5">
                    <span className="font-medium" style={{ color: "#1F1A14" }}>
                      {it.qty}× {it.name}
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
                    style={{ borderColor: "#DCD3C2" }}
                  />
                  <div className="text-[10px] text-[#7A7166] mt-1">Tap to view proof</div>
                </button>
              )}

              <div className="flex items-center justify-between">
                <span className="fo-num text-lg font-semibold" style={{ color: "#1F5F5B" }}>
                  {money(order.total)}
                </span>
                {order.status === "submitted" && (
                  <div className="flex gap-2">
                    <button
                      disabled={busyId === order.key}
                      onClick={() => updateStatus(order, "rejected")}
                      className="px-3 py-1.5 rounded-md text-xs font-semibold border flex items-center gap-1"
                      style={{ borderColor: "#DCD3C2", color: "#B33A2E" }}
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
                {(order.status === "confirmed" || order.status === "rejected") && (
                  <button
                    disabled={busyId === order.key}
                    onClick={() =>
                      updateStatus(order, order.status === "confirmed" ? "rejected" : "confirmed")
                    }
                    className="text-xs text-[#7A7166] underline"
                  >
                    change
                  </button>
                )}
              </div>

              {confirmingId === order.key ? (
                <div
                  className="flex items-center justify-between mt-3 pt-3 border-t"
                  style={{ borderColor: "#EEE7D8" }}
                >
                  <span className="text-xs text-[#B33A2E]">Delete this order?</span>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setConfirmingId(null)}
                      className="px-3 py-1 rounded-md text-xs font-semibold border"
                      style={{ borderColor: "#DCD3C2" }}
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
                <button
                  onClick={() => setConfirmingId(order.key)}
                  className="text-xs text-[#B3A992] underline mt-2 flex items-center gap-1"
                >
                  <Trash2 className="w-3 h-3" />
                  Delete order
                </button>
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
            style={{ background: "#FFFFFF", padding: "12px" }}
          />
          <p className="text-xs mt-4" style={{ color: "#C7BCA8" }}>
            Tap anywhere to close
          </p>
        </div>
      )}
    </div>
  );
}

function StatBox({ label, value, sub, tone }) {
  const colors = {
    neutral: "#1F1A14",
    confirmed: "#1F5F5B",
    pending: "#B8842E",
    rejected: "#B33A2E",
    later: "#6B5CA5",
  };
  return (
    <div className="rounded-lg border p-3 text-center" style={{ borderColor: "#DCD3C2", background: "#FFFFFF" }}>
      <div className="fo-num text-lg font-semibold" style={{ color: colors[tone] }}>
        {value}
      </div>
      <div className="text-[10px] uppercase tracking-wide text-[#7A7166] mt-0.5">{label}</div>
      {sub && <div className="fo-num text-[10px] text-[#B3A992] mt-0.5">{sub}</div>}
    </div>
  );
}
