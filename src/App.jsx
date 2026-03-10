// src/App.jsx — v2: historial por mes, gráficos, responsive

import { useState, useEffect, useMemo } from "react";
import { supabase } from "./supabaseClient";

// ─── THEME ────────────────────────────────────────────────────────────────────
function useColorScheme() {
  const [dark, setDark] = useState(window.matchMedia("(prefers-color-scheme: dark)").matches);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = e => setDark(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);
  return dark;
}

const DARK = {
  bg: "#0F0F13", surface: "#17171E", card: "#1E1E28", border: "#2A2A38",
  accent: "#4f0c28", accentSoft: "#6C63FF22", green: "#2ECC8A", greenSoft: "#2ECC8A18",
  red: "#FF5C7A", text: "#F0F0FF", muted: "#8888AA", yellow: "#FFD166",
};
const LIGHT = {
  bg: "#F2F2F7", surface: "#FFFFFF", card: "#FFFFFF", border: "#E0E0EA",
  accent: "#4f0c28", accentSoft: "#6C63FF15", green: "#1AAE6F", greenSoft: "#1AAE6F15",
  red: "#E8334A", text: "#0F0F1A", muted: "#8888AA", yellow: "#B8860B",
};
function getColors(dark) { return dark ? DARK : LIGHT; }

function getGlobalStyles(C, isDark) { return `
  @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600;700&family=Space+Grotesk:wght@400;500;600;700&display=swap');
  * { box-sizing: border-box; margin: 0; padding: 0; }
  input, button, select { font-family: 'DM Sans', sans-serif; }
  input, select { outline: none; color: ${C.text}; background: ${C.card}; }
  input:focus, select:focus { border-color: ${C.accent} !important; }
  input::placeholder { color: ${C.muted}; }
  body { background: ${C.bg}; }
  ::-webkit-scrollbar { width: 4px; }
  ::-webkit-scrollbar-thumb { background: ${C.border}; border-radius: 2px; }
  .btn-hover { transition: all 0.2s; cursor: pointer; }
  .btn-hover:hover:not(:disabled) { filter: brightness(1.08); transform: translateY(-1px); }
  .btn-hover:disabled { opacity: 0.4; cursor: not-allowed; transform: none !important; }
  .row-hover { transition: background 0.15s; }
  .row-hover:hover { background: ${C.border} !important; }
  .card-shadow { box-shadow: ${isDark ? "none" : "0 1px 8px #0000000F"}; }
  @media (min-width: 900px) {
    .admin-layout { display: grid !important; grid-template-columns: 240px 1fr; min-height: 100vh; }
    .admin-sidebar { display: flex !important; }
    .mobile-header { display: none !important; }
    .bottom-nav { display: none !important; }
    .main-pad { padding: 36px !important; }
    .charts-grid { display: grid !important; grid-template-columns: 1fr 1fr; gap: 16px; }
    .stats-grid { display: grid !important; grid-template-columns: repeat(4, 1fr); gap: 12px; }
    .members-grid { grid-template-columns: repeat(4, 1fr) !important; }
    .fab-desktop { display: flex !important; }
    .fab-mobile { display: none !important; }
  }
  @media (max-width: 899px) {
    .fab-desktop { display: none !important; }
  }
`; }

// ─── CONSTANTS ────────────────────────────────────────────────────────────────
const USER_PROFILES = {
  "loremalamud@gmail.com":  { id: "lore",  name: "Lore",  role: "admin", color: "#CE93D8" },
  "pabloschvartz@gmail.com":  { id: "pablo",  name: "Pablo",  role: "admin", color: "#80DEEA" },
  "matiasschvartz2324@gmail.com": { id: "mati", name: "Mati", role: "user",  color: "#91ffca" },
  "valentinaschvartz@gmail.com": { id: "valen", name: "Valen", role: "admin",  color: "#d6a5cf" },
};
const ALL_USERS = Object.values(USER_PROFILES);
const PALETTE = ["#6C63FF","#2ECC8A","#FF5C7A","#FFD166","#4FC3F7","#CE93D8","#FFAB91","#A5D6A7","#80DEEA","#F48FB1","#BCAAA4","#FF8A65"];
const ICONS = ["🏠","🚗","🛒","💡","💧","🔥","📡","💊","📚","🎮","👕","✈️","🍔","☕","🐾","💰","🎁","🏋️","🎵","🏥","🏦","📦","🌱","🎨","🧴","🧹"];
const MONTHS_ES = ["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"];

function formatAmount(n) { return "$" + Number(n).toLocaleString("es-AR"); }
function getUserById(id) { return ALL_USERS.find(u => u.id === id) || { name: "?", color: "#8888AA" }; }
function getMonthKey(date) {
  const d = new Date(date);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}
function currentMonthKey() { return getMonthKey(new Date()); }
function prevMonthKey() {
  const d = new Date();
  d.setMonth(d.getMonth() - 1);
  return getMonthKey(d);
}
function monthLabel(key) {
  if (!key) return "";
  const [y, m] = key.split("-");
  return `${MONTHS_ES[parseInt(m) - 1]} ${y}`;
}
function daysInMonth(key) {
  const [y, m] = key.split("-").map(Number);
  return new Date(y, m, 0).getDate();
}

// ─── LOGIN ────────────────────────────────────────────────────────────────────
function LoginScreen() {
  const isDark = useColorScheme();
  const C = getColors(isDark);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showPass, setShowPass] = useState(false);

  async function handleLogin() {
    if (!email || !password) return;
    setLoading(true); setError("");
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) setError("Email o contraseña incorrectos");
    setLoading(false);
  }

  return (
    <div style={{ minHeight: "100vh", background: C.bg, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "24px", fontFamily: "'DM Sans', sans-serif" }}>
      <style>{getGlobalStyles(C, isDark)}</style>
      <div style={{ width: "100%", maxWidth: 400 }}>
        <div style={{ textAlign: "center", marginBottom: 40 }}>
          <div style={{ fontSize: 52, marginBottom: 12 }}>🏡</div>
          <h1 style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 30, fontWeight: 700, color: C.text, marginBottom: 6 }}>Schvartz</h1>
          <p style={{ color: C.muted, fontSize: 14 }}>Ingresá con tu cuenta</p>
        </div>
        <div className="card-shadow" style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 20, padding: "28px 24px" }}>
          <div style={{ marginBottom: 16 }}>
            <label style={{ display: "block", color: C.muted, fontSize: 12, fontWeight: 600, textTransform: "uppercase", letterSpacing: 1, marginBottom: 8 }}>Email</label>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} onKeyDown={e => e.key === "Enter" && handleLogin()} placeholder="tu@email.com"
              style={{ width: "100%", border: `1.5px solid ${C.border}`, borderRadius: 12, padding: "13px 16px", fontSize: 15 }} />
          </div>
          <div style={{ marginBottom: 24 }}>
            <label style={{ display: "block", color: C.muted, fontSize: 12, fontWeight: 600, textTransform: "uppercase", letterSpacing: 1, marginBottom: 8 }}>Contraseña</label>
            <div style={{ position: "relative" }}>
              <input type={showPass ? "text" : "password"} value={password} onChange={e => setPassword(e.target.value)} onKeyDown={e => e.key === "Enter" && handleLogin()} placeholder="••••••••"
                style={{ width: "100%", border: `1.5px solid ${C.border}`, borderRadius: 12, padding: "13px 44px 13px 16px", fontSize: 15 }} />
              <button onClick={() => setShowPass(!showPass)} style={{ position: "absolute", right: 14, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", fontSize: 18, color: C.muted }}>{showPass ? "🙈" : "👁️"}</button>
            </div>
          </div>
          {error && <div style={{ background: C.red + "18", border: `1px solid ${C.red}44`, borderRadius: 10, padding: "10px 14px", marginBottom: 16, color: C.red, fontSize: 13, fontWeight: 500 }}>⚠️ {error}</div>}
          <button className="btn-hover" onClick={handleLogin} disabled={!email || !password || loading}
            style={{ width: "100%", background: C.accent, color: "white", border: "none", padding: "15px", borderRadius: 12, fontSize: 16, fontWeight: 700 }}>
            {loading ? "Entrando..." : "Entrar →"}
          </button>
        </div>
        <p style={{ textAlign: "center", color: C.muted, fontSize: 12, marginTop: 20 }}>¿Olvidaste tu contraseña? Pedísela a mamá o papá 😄</p>
      </div>
    </div>
  );
}

// ─── MANAGE CATEGORIES MODAL ──────────────────────────────────────────────────
function ManageCategoriesModal({ onClose, groups, categories, onRefresh }) {
  const isDark = useColorScheme();
  const C = getColors(isDark);
  const [view, setView] = useState("list");
  const [selectedGroup, setSelectedGroup] = useState(null);
  const [groupName, setGroupName] = useState("");
  const [groupIcon, setGroupIcon] = useState("📁");
  const [groupColor, setGroupColor] = useState(PALETTE[0]);
  const [catName, setCatName] = useState("");
  const [catIcon, setCatIcon] = useState("📦");
  const [loading, setLoading] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(null);

  async function saveGroup() {
    if (!groupName.trim()) return;
    setLoading(true);
    await supabase.from("category_groups").insert([{ name: groupName.trim(), icon: groupIcon, color: groupColor }]);
    await onRefresh(); setGroupName(""); setGroupIcon("📁"); setGroupColor(PALETTE[0]); setView("list"); setLoading(false);
  }
  async function saveCat() {
    if (!catName.trim() || !selectedGroup) return;
    setLoading(true);
    await supabase.from("categories").insert([{ name: catName.trim(), icon: catIcon, group_id: selectedGroup.id }]);
    await onRefresh(); setCatName(""); setCatIcon("📦"); setView("list"); setLoading(false);
  }
  async function deleteGroup(id) {
    setLoading(true);
    await supabase.from("category_groups").delete().eq("id", id);
    await onRefresh(); setDeleteConfirm(null); setLoading(false);
  }
  async function deleteCat(id) {
    setLoading(true);
    await supabase.from("categories").delete().eq("id", id);
    await onRefresh(); setDeleteConfirm(null); setLoading(false);
  }

  return (
    <div style={{ position: "fixed", inset: 0, background: "#000000BB", display: "flex", alignItems: "flex-end", justifyContent: "center", zIndex: 1000, backdropFilter: "blur(4px)" }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{ background: C.surface, borderRadius: "24px 24px 0 0", width: "100%", maxWidth: 560, border: `1px solid ${C.border}`, borderBottom: "none", maxHeight: "85vh", display: "flex", flexDirection: "column" }}>
        <div style={{ padding: "24px 24px 16px", borderBottom: `1px solid ${C.border}`, display: "flex", justifyContent: "space-between", alignItems: "center", flexShrink: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            {view !== "list" && <button onClick={() => setView("list")} style={{ background: "none", border: "none", color: C.muted, fontSize: 20, cursor: "pointer" }}>←</button>}
            <h2 style={{ color: C.text, fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: 18 }}>
              {view === "list" ? "Categorías" : view === "newGroup" ? "Nueva categoría" : `Subcategoría en ${selectedGroup?.name}`}
            </h2>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", color: C.muted, fontSize: 22, cursor: "pointer" }}>✕</button>
        </div>
        <div style={{ overflowY: "auto", flex: 1, padding: "20px 24px 32px" }}>
          {view === "list" && (
            <div>
              <button className="btn-hover" onClick={() => setView("newGroup")}
                style={{ width: "100%", background: C.accentSoft, border: `1.5px dashed ${C.accent}`, borderRadius: 12, padding: "14px", color: C.accent, fontWeight: 600, fontSize: 14, marginBottom: 20, display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
                <span style={{ fontSize: 18 }}>+</span> Nueva categoría
              </button>
              {groups.length === 0 && <div style={{ textAlign: "center", padding: "30px 0", color: C.muted }}><div style={{ fontSize: 40, marginBottom: 10 }}>📂</div><p>Todavía no hay categorías.</p></div>}
              {groups.map(g => {
                const gCats = categories.filter(c => c.group_id === g.id);
                async function toggleExclude() {
                  await supabase.from("category_groups").update({ exclude_from_ranking: !g.exclude_from_ranking }).eq("id", g.id);
                  await onRefresh();
                }
                return (
                  <div key={g.id} className="card-shadow" style={{ background: C.card, borderRadius: 14, border: `1px solid ${g.color}44`, marginBottom: 12, overflow: "hidden" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "14px 16px", borderBottom: gCats.length > 0 ? `1px solid ${C.border}` : "none" }}>
                      <div style={{ width: 36, height: 36, background: g.color + "22", borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18 }}>{g.icon}</div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 700, fontSize: 15, color: C.text }}>{g.name}</div>
                        <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 2 }}>
                          <div style={{ fontSize: 11, color: C.muted }}>{gCats.length} subcategoría{gCats.length !== 1 ? "s" : ""}</div>
                          {g.exclude_from_ranking && <span style={{ fontSize: 10, background: C.yellow + "22", color: C.yellow, border: `1px solid ${C.yellow}44`, borderRadius: 4, padding: "1px 6px", fontWeight: 600 }}>excluida del ranking</span>}
                        </div>
                      </div>
                      <button onClick={toggleExclude} title={g.exclude_from_ranking ? "Incluir en ranking" : "Excluir del ranking"}
                        style={{ background: g.exclude_from_ranking ? C.yellow + "22" : C.card, border: `1px solid ${g.exclude_from_ranking ? C.yellow : C.border}`, color: g.exclude_from_ranking ? C.yellow : C.muted, borderRadius: 8, padding: "5px 8px", fontSize: 14, cursor: "pointer", marginRight: 4 }}>
                        🏆
                      </button>
                      <button onClick={() => { setSelectedGroup(g); setView("newCat"); }} style={{ background: C.accentSoft, border: "none", color: C.accent, borderRadius: 8, padding: "5px 10px", fontSize: 12, fontWeight: 600, cursor: "pointer", marginRight: 6 }}>+ Sub</button>
                      {deleteConfirm === g.id ? (
                        <div style={{ display: "flex", gap: 6 }}>
                          <button onClick={() => deleteGroup(g.id)} style={{ background: C.red + "22", border: "none", color: C.red, borderRadius: 8, padding: "5px 10px", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>Eliminar</button>
                          <button onClick={() => setDeleteConfirm(null)} style={{ background: C.border, border: "none", color: C.muted, borderRadius: 8, padding: "5px 10px", fontSize: 12, cursor: "pointer" }}>Cancelar</button>
                        </div>
                      ) : <button onClick={() => setDeleteConfirm(g.id)} style={{ background: "none", border: "none", color: C.muted, fontSize: 18, cursor: "pointer" }}>🗑️</button>}
                    </div>
                    {gCats.map((c, i) => (
                      <div key={c.id} className="row-hover" style={{ display: "flex", alignItems: "center", gap: 10, padding: "11px 16px", borderBottom: i < gCats.length - 1 ? `1px solid ${C.border}` : "none", background: "transparent" }}>
                        <span style={{ fontSize: 16 }}>{c.icon}</span>
                        <span style={{ flex: 1, fontSize: 14, color: C.text }}>{c.name}</span>
                        {deleteConfirm === c.id ? (
                          <div style={{ display: "flex", gap: 6 }}>
                            <button onClick={() => deleteCat(c.id)} style={{ background: C.red + "22", border: "none", color: C.red, borderRadius: 8, padding: "4px 8px", fontSize: 11, fontWeight: 600, cursor: "pointer" }}>Eliminar</button>
                            <button onClick={() => setDeleteConfirm(null)} style={{ background: C.border, border: "none", color: C.muted, borderRadius: 8, padding: "4px 8px", fontSize: 11, cursor: "pointer" }}>No</button>
                          </div>
                        ) : <button onClick={() => setDeleteConfirm(c.id)} style={{ background: "none", border: "none", color: C.muted, fontSize: 16, cursor: "pointer" }}>🗑️</button>}
                      </div>
                    ))}
                  </div>
                );
              })}
              {groups.length > 0 && (
                <div style={{ background: C.accentSoft, border: `1px solid ${C.accent}33`, borderRadius: 10, padding: "10px 14px", marginTop: 4, fontSize: 12, color: C.muted, lineHeight: 1.5 }}>
                  💡 Tocá <strong>🏆</strong> en una categoría para excluirla del ranking. Útil para gastos compartidos del hogar.
                </div>
              )}
            </div>
          )}
          {view === "newGroup" && (
            <div>
              <div style={{ marginBottom: 20 }}>
                <label style={{ display: "block", color: C.muted, fontSize: 12, fontWeight: 600, textTransform: "uppercase", letterSpacing: 1, marginBottom: 8 }}>Nombre</label>
                <input value={groupName} onChange={e => setGroupName(e.target.value)} placeholder="Ej: Casa, Auto, Salud..."
                  style={{ width: "100%", border: `1.5px solid ${C.border}`, borderRadius: 12, padding: "13px 16px", fontSize: 16 }} />
              </div>
              <div style={{ marginBottom: 20 }}>
                <label style={{ display: "block", color: C.muted, fontSize: 12, fontWeight: 600, textTransform: "uppercase", letterSpacing: 1, marginBottom: 8 }}>Ícono</label>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(9, 1fr)", gap: 6 }}>
                  {ICONS.map(ic => <button key={ic} onClick={() => setGroupIcon(ic)} style={{ background: groupIcon === ic ? C.accentSoft : C.card, border: `1.5px solid ${groupIcon === ic ? C.accent : C.border}`, borderRadius: 8, padding: "8px 4px", cursor: "pointer", fontSize: 18, textAlign: "center" }}>{ic}</button>)}
                </div>
              </div>
              <div style={{ marginBottom: 28 }}>
                <label style={{ display: "block", color: C.muted, fontSize: 12, fontWeight: 600, textTransform: "uppercase", letterSpacing: 1, marginBottom: 8 }}>Color</label>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  {PALETTE.map(col => <button key={col} onClick={() => setGroupColor(col)} style={{ width: 32, height: 32, background: col, borderRadius: "50%", border: groupColor === col ? `3px solid ${C.text}` : "3px solid transparent", cursor: "pointer", boxShadow: groupColor === col ? `0 0 0 2px ${col}` : "none" }} />)}
                </div>
              </div>
              {groupName && <div style={{ background: groupColor + "18", border: `1px solid ${groupColor}44`, borderRadius: 12, padding: "14px 16px", marginBottom: 20, display: "flex", alignItems: "center", gap: 10 }}><span style={{ fontSize: 24 }}>{groupIcon}</span><span style={{ fontWeight: 700, fontSize: 16, color: C.text }}>{groupName}</span></div>}
              <button className="btn-hover" onClick={saveGroup} disabled={!groupName.trim() || loading} style={{ width: "100%", background: C.accent, color: "white", border: "none", padding: "15px", borderRadius: 12, fontSize: 16, fontWeight: 700 }}>{loading ? "Guardando..." : "Crear categoría"}</button>
            </div>
          )}
          {view === "newCat" && (
            <div>
              <div style={{ background: selectedGroup?.color + "18", border: `1px solid ${selectedGroup?.color}44`, borderRadius: 12, padding: "12px 16px", marginBottom: 20, display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ fontSize: 20 }}>{selectedGroup?.icon}</span><span style={{ fontWeight: 600, color: C.text }}>{selectedGroup?.name}</span>
              </div>
              <div style={{ marginBottom: 20 }}>
                <label style={{ display: "block", color: C.muted, fontSize: 12, fontWeight: 600, textTransform: "uppercase", letterSpacing: 1, marginBottom: 8 }}>Nombre de la subcategoría</label>
                <input value={catName} onChange={e => setCatName(e.target.value)} placeholder="Ej: Luz, Agua, Gas..." style={{ width: "100%", border: `1.5px solid ${C.border}`, borderRadius: 12, padding: "13px 16px", fontSize: 16 }} />
              </div>
              <div style={{ marginBottom: 28 }}>
                <label style={{ display: "block", color: C.muted, fontSize: 12, fontWeight: 600, textTransform: "uppercase", letterSpacing: 1, marginBottom: 8 }}>Ícono</label>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(9, 1fr)", gap: 6 }}>
                  {ICONS.map(ic => <button key={ic} onClick={() => setCatIcon(ic)} style={{ background: catIcon === ic ? C.accentSoft : C.card, border: `1.5px solid ${catIcon === ic ? C.accent : C.border}`, borderRadius: 8, padding: "8px 4px", cursor: "pointer", fontSize: 18, textAlign: "center" }}>{ic}</button>)}
                </div>
              </div>
              <button className="btn-hover" onClick={saveCat} disabled={!catName.trim() || loading} style={{ width: "100%", background: C.accent, color: "white", border: "none", padding: "15px", borderRadius: 12, fontSize: 16, fontWeight: 700 }}>{loading ? "Guardando..." : "Agregar subcategoría"}</button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── ADD EXPENSE MODAL ────────────────────────────────────────────────────────
function AddExpenseModal({ onClose, onAdd, currentProfile, groups, categories }) {
  const isDark = useColorScheme();
  const C = getColors(isDark);
  const [selectedGroup, setSelectedGroup] = useState(null);
  const [selectedCat, setSelectedCat] = useState(null);
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const groupCats = selectedGroup ? categories.filter(c => c.group_id === selectedGroup.id) : [];

  async function handleSubmit() {
    if (!selectedGroup || !amount) return;
    setLoading(true);
    await onAdd({ user_id: currentProfile.id, group_id: selectedGroup.id, category_id: selectedCat?.id || null, category: selectedCat ? `${selectedGroup.name} › ${selectedCat.name}` : selectedGroup.name, amount: parseFloat(amount), note, date: new Date().toISOString().split("T")[0] });
    setLoading(false); setDone(true);
    setTimeout(() => { setDone(false); onClose(); }, 1200);
  }

  return (
    <div style={{ position: "fixed", inset: 0, background: "#00000099", display: "flex", alignItems: "flex-end", justifyContent: "center", zIndex: 1000, backdropFilter: "blur(4px)" }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{ background: C.surface, borderRadius: "24px 24px 0 0", width: "100%", maxWidth: 520, border: `1px solid ${C.border}`, borderBottom: "none", maxHeight: "90vh", display: "flex", flexDirection: "column" }}>
        {done ? (
          <div style={{ textAlign: "center", padding: "40px 20px" }}>
            <div style={{ fontSize: 56, marginBottom: 12 }}>✅</div>
            <p style={{ color: C.green, fontWeight: 600, fontSize: 18 }}>¡Guardado!</p>
          </div>
        ) : (
          <>
            <div style={{ padding: "24px 24px 16px", borderBottom: `1px solid ${C.border}`, display: "flex", justifyContent: "space-between", alignItems: "center", flexShrink: 0 }}>
              <h2 style={{ color: C.text, fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: 20 }}>Nuevo gasto</h2>
              <button onClick={onClose} style={{ background: "none", border: "none", color: C.muted, fontSize: 22, cursor: "pointer" }}>✕</button>
            </div>
            <div style={{ overflowY: "auto", flex: 1, padding: "20px 24px 32px" }}>
              {groups.length === 0 ? (
                <div style={{ textAlign: "center", padding: "30px 0", color: C.muted }}><div style={{ fontSize: 40, marginBottom: 10 }}>📂</div><p>Primero creá categorías usando el botón ⚙️.</p></div>
              ) : (
                <>
                  <div style={{ marginBottom: 20 }}>
                    <label style={{ display: "block", color: C.muted, fontSize: 12, fontWeight: 600, textTransform: "uppercase", letterSpacing: 1, marginBottom: 10 }}>Categoría</label>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8 }}>
                      {groups.map(g => (
                        <button key={g.id} onClick={() => { setSelectedGroup(g); setSelectedCat(null); }}
                          style={{ background: selectedGroup?.id === g.id ? g.color + "33" : C.card, border: `1.5px solid ${selectedGroup?.id === g.id ? g.color : C.border}`, borderRadius: 12, padding: "12px 8px", cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", gap: 5 }}>
                          <span style={{ fontSize: 24 }}>{g.icon}</span>
                          <span style={{ fontSize: 11, color: selectedGroup?.id === g.id ? g.color : C.muted, fontWeight: 600, textAlign: "center" }}>{g.name}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                  {selectedGroup && groupCats.length > 0 && (
                    <div style={{ marginBottom: 20 }}>
                      <label style={{ display: "block", color: C.muted, fontSize: 12, fontWeight: 600, textTransform: "uppercase", letterSpacing: 1, marginBottom: 10 }}>Subcategoría <span style={{ fontWeight: 400 }}>(opcional)</span></label>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                        {groupCats.map(c => (
                          <button key={c.id} onClick={() => setSelectedCat(selectedCat?.id === c.id ? null : c)}
                            style={{ background: selectedCat?.id === c.id ? selectedGroup.color + "33" : C.card, border: `1.5px solid ${selectedCat?.id === c.id ? selectedGroup.color : C.border}`, borderRadius: 10, padding: "8px 14px", cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}>
                            <span style={{ fontSize: 16 }}>{c.icon}</span>
                            <span style={{ fontSize: 13, color: selectedCat?.id === c.id ? selectedGroup.color : C.muted, fontWeight: 600 }}>{c.name}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                  <div style={{ marginBottom: 16 }}>
                    <label style={{ display: "block", color: C.muted, fontSize: 12, fontWeight: 600, textTransform: "uppercase", letterSpacing: 1, marginBottom: 8 }}>Monto ($)</label>
                    <input type="number" value={amount} onChange={e => setAmount(e.target.value)} placeholder="0"
                      style={{ width: "100%", border: `1.5px solid ${C.border}`, borderRadius: 12, padding: "14px 16px", fontSize: 28, fontWeight: 700, fontFamily: "'Space Grotesk', sans-serif" }} />
                  </div>
                  <div style={{ marginBottom: 24 }}>
                    <label style={{ display: "block", color: C.muted, fontSize: 12, fontWeight: 600, textTransform: "uppercase", letterSpacing: 1, marginBottom: 8 }}>Nota (opcional)</label>
                    <input type="text" value={note} onChange={e => setNote(e.target.value)} placeholder="Ej: Factura de mayo..."
                      style={{ width: "100%", border: `1.5px solid ${C.border}`, borderRadius: 12, padding: "12px 16px", fontSize: 15 }} />
                  </div>
                  <button className="btn-hover" onClick={handleSubmit} disabled={!selectedGroup || !amount || loading}
                    style={{ width: "100%", background: C.accent, color: "white", border: "none", padding: "16px", borderRadius: 14, fontSize: 16, fontWeight: 700 }}>
                    {loading ? "Guardando..." : "Agregar gasto"}
                  </button>
                </>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ─── CHARTS ───────────────────────────────────────────────────────────────────

// Donut chart
function DonutChart({ data, size = 160 }) {
  const r = 56, cx = 80, cy = 80;
  const total = data.reduce((s, d) => s + d.value, 0);
  if (total === 0) return <div style={{ width: size, height: size, display: "flex", alignItems: "center", justifyContent: "center", color: "#8888AA", fontSize: 12 }}>Sin datos</div>;
  const slices = data.reduce((acc, d) => {
    const pct = d.value / total;
    const len = pct * (2 * Math.PI * r);
    const dash = `${len} ${2 * Math.PI * r - len}`;
    const prev = acc.length > 0 ? acc[acc.length - 1].nextOffset : 0;
    return [...acc, { ...d, dash, rotate: prev * 360 - 90, nextOffset: prev + pct }];
  }, []);
  return (
    <svg width={size} height={size} viewBox="0 0 160 160">
      {slices.map((s, i) => (
        <circle key={i} cx={cx} cy={cy} r={r} fill="none" stroke={s.color} strokeWidth="22"
          strokeDasharray={s.dash} strokeDashoffset="0"
          style={{ transform: `rotate(${s.rotate}deg)`, transformOrigin: `${cx}px ${cy}px` }} />
      ))}
      <text x={cx} y={cy - 6} textAnchor="middle" fill="#8888AA" fontSize="11" fontFamily="DM Sans">Total</text>
      <text x={cx} y={cy + 12} textAnchor="middle" fill="currentColor" fontSize="13" fontWeight="700" fontFamily="Space Grotesk">{formatAmount(total)}</text>
    </svg>
  );
}

// Bar chart — mes actual vs mes anterior
function BarChart({ currentData, prevData, groups, C }) {
  const allGroupIds = [...new Set([...currentData.map(d => d.id), ...prevData.map(d => d.id)])];
  if (allGroupIds.length === 0) return <div style={{ color: C.muted, textAlign: "center", padding: "30px 0", fontSize: 13 }}>Sin datos para comparar</div>;
  const maxVal = Math.max(...allGroupIds.flatMap(id => {
    const cur = currentData.find(d => d.id === id)?.total || 0;
    const prev = prevData.find(d => d.id === id)?.total || 0;
    return [cur, prev];
  }), 1);

  return (
    <div style={{ overflowX: "auto" }}>
      <div style={{ display: "flex", gap: 16, alignItems: "flex-end", minWidth: allGroupIds.length * 80, padding: "8px 4px 0" }}>
        {allGroupIds.map(id => {
          const group = groups.find(g => g.id === id);
          if (!group) return null;
          const cur = currentData.find(d => d.id === id)?.total || 0;
          const prev = prevData.find(d => d.id === id)?.total || 0;
          const maxH = 100;
          return (
            <div key={id} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 6, minWidth: 60 }}>
              <div style={{ display: "flex", alignItems: "flex-end", gap: 4, height: maxH }}>
                {prev > 0 && (
                  <div style={{ width: 14, height: Math.max((prev / maxVal) * maxH, 4), background: group.color + "55", borderRadius: "4px 4px 0 0", transition: "height 0.5s" }} title={`Mes anterior: ${formatAmount(prev)}`} />
                )}
                <div style={{ width: 14, height: Math.max((cur / maxVal) * maxH, 4), background: group.color, borderRadius: "4px 4px 0 0", transition: "height 0.5s" }} title={`Mes actual: ${formatAmount(cur)}`} />
              </div>
              <span style={{ fontSize: 14 }}>{group.icon}</span>
              <span style={{ fontSize: 9, color: C.muted, fontWeight: 600, textAlign: "center", maxWidth: 60, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{group.name}</span>
            </div>
          );
        })}
      </div>
      <div style={{ display: "flex", gap: 12, marginTop: 12, justifyContent: "center" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 5 }}><div style={{ width: 10, height: 10, background: C.accent + "55", borderRadius: 2 }} /><span style={{ fontSize: 11, color: C.muted }}>Mes anterior</span></div>
        <div style={{ display: "flex", alignItems: "center", gap: 5 }}><div style={{ width: 10, height: 10, background: C.accent, borderRadius: 2 }} /><span style={{ fontSize: 11, color: C.muted }}>Mes actual</span></div>
      </div>
    </div>
  );
}

// Line chart — gastos diarios
function LineChart({ expenses, monthKey, C }) {
  const days = daysInMonth(monthKey);
  const dailyTotals = Array.from({ length: days }, (_, i) => {
    const day = String(i + 1).padStart(2, "0");
    const dateStr = `${monthKey}-${day}`;
    return expenses.filter(e => e.date === dateStr).reduce((s, e) => s + e.amount, 0);
  });
  const max = Math.max(...dailyTotals, 1);
  const W = 280, H = 80, pad = 8;
  const points = dailyTotals.map((v, i) => {
    const x = pad + (i / (days - 1)) * (W - pad * 2);
    const y = H - pad - (v / max) * (H - pad * 2);
    return `${x},${y}`;
  }).join(" ");

  const hasData = dailyTotals.some(v => v > 0);
  if (!hasData) return <div style={{ color: C.muted, textAlign: "center", padding: "30px 0", fontSize: 13 }}>Sin gastos este mes</div>;

  return (
    <div style={{ overflowX: "auto" }}>
      <svg width="100%" viewBox={`0 0 ${W} ${H}`} style={{ minWidth: 200 }}>
        <defs>
          <linearGradient id="lineGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={C.accent} stopOpacity="0.3" />
            <stop offset="100%" stopColor={C.accent} stopOpacity="0" />
          </linearGradient>
        </defs>
        <polyline points={points} fill="none" stroke={C.accent} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
        {dailyTotals.map((v, i) => {
          if (v === 0) return null;
          const x = pad + (i / Math.max(days - 1, 1)) * (W - pad * 2);
          const y = H - pad - (v / max) * (H - pad * 2);
          return <circle key={i} cx={x} cy={y} r="3" fill={C.accent} />;
        })}
      </svg>
      <div style={{ display: "flex", justifyContent: "space-between", marginTop: 4 }}>
        <span style={{ fontSize: 10, color: C.muted }}>1</span>
        <span style={{ fontSize: 10, color: C.muted }}>{Math.ceil(days / 2)}</span>
        <span style={{ fontSize: 10, color: C.muted }}>{days}</span>
      </div>
    </div>
  );
}

// ─── HISTORY MODAL ────────────────────────────────────────────────────────────
function HistoryModal({ onClose, allExpenses, groups, categories, C }) {
  const monthKeys = useMemo(() => {
    const keys = [...new Set(allExpenses.map(e => getMonthKey(e.date)))].sort().reverse();
    return keys.filter(k => k !== currentMonthKey());
  }, [allExpenses]);

  const [selectedMonth, setSelectedMonth] = useState(monthKeys[0] || "");
  const monthExpenses = allExpenses.filter(e => getMonthKey(e.date) === selectedMonth);
  const total = monthExpenses.reduce((s, e) => s + e.amount, 0);

  return (
    <div style={{ position: "fixed", inset: 0, background: "#000000BB", display: "flex", alignItems: "flex-end", justifyContent: "center", zIndex: 1000, backdropFilter: "blur(4px)" }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{ background: C.surface, borderRadius: "24px 24px 0 0", width: "100%", maxWidth: 600, border: `1px solid ${C.border}`, borderBottom: "none", maxHeight: "88vh", display: "flex", flexDirection: "column" }}>
        <div style={{ padding: "24px 24px 16px", borderBottom: `1px solid ${C.border}`, display: "flex", justifyContent: "space-between", alignItems: "center", flexShrink: 0 }}>
          <h2 style={{ color: C.text, fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: 20 }}>📅 Historial</h2>
          <button onClick={onClose} style={{ background: "none", border: "none", color: C.muted, fontSize: 22, cursor: "pointer" }}>✕</button>
        </div>

        {monthKeys.length === 0 ? (
          <div style={{ textAlign: "center", padding: "40px 20px", color: C.muted }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>📭</div>
            <p>No hay historial de meses anteriores todavía.</p>
          </div>
        ) : (
          <>
            <div style={{ padding: "16px 24px", borderBottom: `1px solid ${C.border}`, flexShrink: 0 }}>
              <div style={{ display: "flex", gap: 8, overflowX: "auto", paddingBottom: 4 }}>
                {monthKeys.map(k => (
                  <button key={k} onClick={() => setSelectedMonth(k)}
                    style={{ background: selectedMonth === k ? C.accent : C.card, border: `1px solid ${selectedMonth === k ? C.accent : C.border}`, borderRadius: 10, padding: "8px 14px", cursor: "pointer", color: selectedMonth === k ? "white" : C.muted, fontSize: 13, fontWeight: 600, whiteSpace: "nowrap", flexShrink: 0 }}>
                    {monthLabel(k)}
                  </button>
                ))}
              </div>
            </div>
            <div style={{ overflowY: "auto", flex: 1, padding: "20px 24px 32px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                <span style={{ color: C.muted, fontSize: 14 }}>{monthExpenses.length} gastos</span>
                <span style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: 22, color: C.text }}>{formatAmount(total)}</span>
              </div>
              {monthExpenses.length === 0 ? (
                <div style={{ textAlign: "center", padding: "20px", color: C.muted }}>No hay gastos en este mes.</div>
              ) : (
                <div style={{ background: C.card, borderRadius: 16, border: `1px solid ${C.border}`, overflow: "hidden" }}>
                  {[...monthExpenses].sort((a, b) => new Date(b.date) - new Date(a.date)).map((e, i, arr) => {
                    const group = groups.find(g => g.id === e.group_id);
                    const cat = categories.find(c => c.id === e.category_id);
                    const user = getUserById(e.user_id);
                    return (
                      <div key={e.id} className="row-hover" style={{ display: "flex", alignItems: "center", gap: 12, padding: "13px 16px", borderBottom: i < arr.length - 1 ? `1px solid ${C.border}` : "none", background: "transparent" }}>
                        <div style={{ width: 38, height: 38, background: (group?.color || C.accent) + "22", borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, flexShrink: 0 }}>{cat?.icon || group?.icon || "📦"}</div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontWeight: 600, fontSize: 13, color: C.text }}>{group?.name}{cat ? ` › ${cat.name}` : ""}</div>
                          <div style={{ fontSize: 11, color: C.muted }}>{user.avatar} {user.name}{e.note ? ` · ${e.note}` : ""}</div>
                        </div>
                        <div style={{ textAlign: "right", flexShrink: 0 }}>
                          <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, color: C.red, fontSize: 14 }}>{formatAmount(e.amount)}</div>
                          <div style={{ fontSize: 10, color: C.muted }}>{e.date}</div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ─── ADMIN DASHBOARD ──────────────────────────────────────────────────────────
function AdminDashboard({ expenses, currentProfile, onAdd, onLogout, groups, categories, onRefresh }) {
  const isDark = useColorScheme();
  const C = getColors(isDark);
  const [showManage, setShowManage] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [activeSection, setActiveSection] = useState("dashboard");

  const mk = currentMonthKey();
  const pmk = prevMonthKey();
  const curExpenses = useMemo(() => expenses.filter(e => getMonthKey(e.date) === mk), [expenses, mk]);
  const prevExpenses = useMemo(() => expenses.filter(e => getMonthKey(e.date) === pmk), [expenses, pmk]);

  const total = curExpenses.reduce((s, e) => s + e.amount, 0);
  const prevTotal = prevExpenses.reduce((s, e) => s + e.amount, 0);
  const diff = total - prevTotal;
  const diffPct = prevTotal > 0 ? ((diff / prevTotal) * 100).toFixed(0) : null;

  const byGroupCur = groups.map(g => ({ ...g, total: curExpenses.filter(e => e.group_id === g.id).reduce((s, e) => s + e.amount, 0) })).filter(g => g.total > 0).sort((a, b) => b.total - a.total);
  const byGroupPrev = groups.map(g => ({ ...g, total: prevExpenses.filter(e => e.group_id === g.id).reduce((s, e) => s + e.amount, 0) })).filter(g => g.total > 0);
  const excludedGroupIds = new Set(groups.filter(g => g.exclude_from_ranking).map(g => g.id));
  const byUser = ALL_USERS.map(u => {
    const rankingExp = curExpenses.filter(e => e.user_id === u.id && !excludedGroupIds.has(e.group_id));
    return { ...u, total: rankingExp.reduce((s, e) => s + e.amount, 0), count: rankingExp.length };
  }).filter(u => u.total > 0).sort((a, b) => b.total - a.total);
  const rankingTotal = byUser.reduce((s, u) => s + u.total, 0);
  const donutData = byGroupCur.map(g => ({ color: g.color, value: g.total }));

  const NAV = [{ id: "dashboard", icon: "📊", label: "Dashboard" }, { id: "gastos", icon: "📋", label: "Gastos" }, { id: "miembros", icon: "👨‍👩‍👧‍👦", label: "Miembros" }];

  return (
    <div style={{ minHeight: "100vh", background: C.bg, fontFamily: "'DM Sans', sans-serif", color: C.text }}>
      <style>{getGlobalStyles(C, isDark)}</style>

      <div className="admin-layout" style={{ minHeight: "100vh" }}>
        {/* ── SIDEBAR DESKTOP ── */}
        <div className="admin-sidebar" style={{ display: "none", flexDirection: "column", background: C.surface, borderRight: `1px solid ${C.border}`, padding: "28px 16px", position: "sticky", top: 0, height: "100vh", boxShadow: isDark ? "none" : "2px 0 12px #0000000A" }}>
          <div style={{ marginBottom: 32 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4, padding: "0 8px" }}>
              <span style={{ fontSize: 26 }}>🏡</span>
              <span style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: 17, color: C.text }}>Schvartz</span>
            </div>
            <span style={{ fontSize: 10, color: C.accent, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1, padding: "0 8px" }}>Panel Admin</span>
          </div>
          {NAV.map(t => (
            <button key={t.id} className="btn-hover" onClick={() => setActiveSection(t.id)}
              style={{ display: "flex", alignItems: "center", gap: 10, padding: "11px 12px", borderRadius: 10, border: "none", cursor: "pointer", marginBottom: 2, background: activeSection === t.id ? C.accentSoft : "transparent", color: activeSection === t.id ? C.accent : C.muted, fontWeight: activeSection === t.id ? 600 : 400, fontSize: 14, width: "100%", textAlign: "left" }}>
              <span style={{ fontSize: 18 }}>{t.icon}</span> {t.label}
            </button>
          ))}
          <button className="btn-hover" onClick={() => setShowHistory(true)}
            style={{ display: "flex", alignItems: "center", gap: 10, padding: "11px 12px", borderRadius: 10, border: "none", cursor: "pointer", marginBottom: 2, background: "transparent", color: C.muted, fontSize: 14, width: "100%", textAlign: "left" }}>
            <span style={{ fontSize: 18 }}>📅</span> Historial
          </button>
          <button className="btn-hover" onClick={() => setShowManage(true)}
            style={{ display: "flex", alignItems: "center", gap: 10, padding: "11px 12px", borderRadius: 10, border: "none", cursor: "pointer", background: "transparent", color: C.muted, fontSize: 14, width: "100%", textAlign: "left" }}>
            <span style={{ fontSize: 18 }}>⚙️</span> Categorías
          </button>
          <div style={{ marginTop: "auto", borderTop: `1px solid ${C.border}`, paddingTop: 16 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12, padding: "0 4px" }}>
              <span style={{ fontSize: 26 }}>{currentProfile.avatar}</span>
              <div>
                <div style={{ fontWeight: 600, fontSize: 14, color: C.text }}>{currentProfile.name}</div>
                <div style={{ fontSize: 11, color: C.accent, fontWeight: 600 }}>Admin</div>
              </div>
            </div>
            <button onClick={onLogout} style={{ background: "none", border: `1px solid ${C.border}`, color: C.muted, padding: "8px 12px", borderRadius: 8, cursor: "pointer", fontSize: 13, width: "100%" }}>Cerrar sesión</button>
          </div>
        </div>

        {/* ── MAIN CONTENT ── */}
        <div className="main-pad" style={{ padding: "16px 16px 80px", overflowY: "auto" }}>

          {/* Mobile header */}
          <div className="mobile-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
            <div>
              <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: 20, color: C.text }}>Hola, {currentProfile.name} {currentProfile.avatar}</div>
              <div style={{ color: C.muted, fontSize: 12 }}>{monthLabel(mk)}</div>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={() => setShowHistory(true)} style={{ background: C.card, border: `1px solid ${C.border}`, color: C.muted, padding: "7px 10px", borderRadius: 8, cursor: "pointer", fontSize: 13 }}>📅</button>
              <button onClick={() => setShowManage(true)} style={{ background: C.card, border: `1px solid ${C.border}`, color: C.muted, padding: "7px 10px", borderRadius: 8, cursor: "pointer", fontSize: 13 }}>⚙️</button>
              <button onClick={onLogout} style={{ background: "none", border: `1px solid ${C.border}`, color: C.muted, padding: "7px 10px", borderRadius: 8, cursor: "pointer", fontSize: 12 }}>Salir</button>
            </div>
          </div>

          {/* Desktop section title */}
          <div style={{ display: "none" }} className="desktop-only">
            <h1 style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: 26, color: C.text, marginBottom: 4 }}>
              {NAV.find(n => n.id === activeSection)?.label || "Dashboard"}
            </h1>
            <div style={{ color: C.muted, fontSize: 14, marginBottom: 28 }}>{monthLabel(mk)}</div>
          </div>

          {/* ── DASHBOARD SECTION ── */}
          {(activeSection === "dashboard") && (
            <div>
              {/* Stat cards */}
              <div className="stats-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 20 }}>
                <div className="card-shadow" style={{ background: C.card, borderRadius: 16, padding: "18px 20px", border: `1px solid ${C.border}` }}>
                  <div style={{ color: C.muted, fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: 1, marginBottom: 8 }}>Total del mes</div>
                  <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 28, fontWeight: 700, color: C.text }}>{formatAmount(total)}</div>
                  {diffPct !== null && (
                    <div style={{ fontSize: 12, color: diff > 0 ? C.red : C.green, marginTop: 4, fontWeight: 600 }}>
                      {diff > 0 ? "▲" : "▼"} {Math.abs(diffPct)}% vs mes anterior
                    </div>
                  )}
                </div>
                <div className="card-shadow" style={{ background: C.card, borderRadius: 16, padding: "18px 20px", border: `1px solid ${C.border}` }}>
                  <div style={{ color: C.muted, fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: 1, marginBottom: 8 }}>Gastos cargados</div>
                  <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 28, fontWeight: 700, color: C.text }}>{curExpenses.length}</div>
                  <div style={{ fontSize: 12, color: C.muted, marginTop: 4 }}>este mes</div>
                </div>
                <div className="card-shadow" style={{ background: C.card, borderRadius: 16, padding: "18px 20px", border: `1px solid ${C.border}` }}>
                  <div style={{ color: C.muted, fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: 1, marginBottom: 8 }}>Mes anterior</div>
                  <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 28, fontWeight: 700, color: C.text }}>{formatAmount(prevTotal)}</div>
                  <div style={{ fontSize: 12, color: C.muted, marginTop: 4 }}>{monthLabel(pmk)}</div>
                </div>
                <div className="card-shadow" style={{ background: C.card, borderRadius: 16, padding: "18px 20px", border: `1px solid ${C.border}` }}>
                  <div style={{ color: C.muted, fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: 1, marginBottom: 8 }}>Categorías</div>
                  <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 28, fontWeight: 700, color: C.text }}>{groups.length}</div>
                  <div style={{ fontSize: 12, color: C.muted, marginTop: 4 }}>configuradas</div>
                </div>
              </div>

              {/* Charts row */}
              <div className="charts-grid" style={{ marginBottom: 20 }}>
                {/* Donut */}
                <div className="card-shadow" style={{ background: C.card, borderRadius: 16, padding: "20px", border: `1px solid ${C.border}` }}>
                  <h3 style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: 14, marginBottom: 16, color: C.text }}>Distribución por categoría</h3>
                  <div style={{ display: "flex", gap: 20, alignItems: "center", flexWrap: "wrap" }}>
                    <DonutChart data={donutData} size={140} />
                    <div style={{ flex: 1, minWidth: 120 }}>
                      {byGroupCur.slice(0, 6).map(g => (
                        <div key={g.id} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                          <div style={{ width: 10, height: 10, background: g.color, borderRadius: "50%", flexShrink: 0 }} />
                          <span style={{ fontSize: 12, color: C.text, flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{g.icon} {g.name}</span>
                          <span style={{ fontSize: 11, color: C.muted, fontWeight: 600, flexShrink: 0 }}>{total > 0 ? Math.round((g.total / total) * 100) : 0}%</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Line chart */}
                <div className="card-shadow" style={{ background: C.card, borderRadius: 16, padding: "20px", border: `1px solid ${C.border}` }}>
                  <h3 style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: 14, marginBottom: 4, color: C.text }}>Gastos diarios</h3>
                  <div style={{ color: C.muted, fontSize: 11, marginBottom: 16 }}>{monthLabel(mk)}</div>
                  <LineChart expenses={curExpenses} monthKey={mk} C={C} />
                </div>
              </div>

              {/* Bar chart */}
              <div className="card-shadow" style={{ background: C.card, borderRadius: 16, padding: "20px", marginBottom: 20, border: `1px solid ${C.border}` }}>
                <h3 style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: 14, marginBottom: 4, color: C.text }}>Categorías: este mes vs anterior</h3>
                <div style={{ color: C.muted, fontSize: 11, marginBottom: 16 }}>{monthLabel(pmk)} → {monthLabel(mk)}</div>
                <BarChart currentData={byGroupCur} prevData={byGroupPrev} groups={groups} C={C} />
              </div>

              <div className="card-shadow" style={{ background: C.card, borderRadius: 16, padding: "20px", border: `1px solid ${C.border}` }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 }}>
                  <h3 style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: 14, color: C.text }}>🏆 Ranking del mes</h3>
                  {excludedGroupIds.size > 0 && (
                    <span style={{ fontSize: 11, background: C.yellow + "22", color: C.yellow, border: `1px solid ${C.yellow}44`, borderRadius: 6, padding: "2px 8px", fontWeight: 600 }}>
                      {excludedGroupIds.size} categ. excluida{excludedGroupIds.size > 1 ? "s" : ""}
                    </span>
                  )}
                </div>
                {byUser.length === 0 ? (
                  <div style={{ textAlign: "center", color: C.muted, padding: "16px 0", fontSize: 13 }}>Nadie cargó gastos todavía</div>
                ) : byUser.map((u, i) => (
                  <div key={u.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 0", borderBottom: i < byUser.length - 1 ? `1px solid ${C.border}` : "none" }}>
                    <div style={{ width: 28, height: 28, background: u.color + "22", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, fontWeight: 700, color: u.color, flexShrink: 0 }}>{i + 1}</div>
                    <span style={{ fontSize: 24 }}>{u.avatar}</span>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 600, fontSize: 14, color: C.text }}>{u.name}</div>
                      <div style={{ height: 4, background: C.border, borderRadius: 2, marginTop: 4, overflow: "hidden" }}>
                        <div style={{ height: "100%", width: `${rankingTotal > 0 ? (u.total / rankingTotal) * 100 : 0}%`, background: u.color, borderRadius: 2 }} />
                      </div>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, color: u.color, fontSize: 15 }}>{formatAmount(u.total)}</div>
                      <div style={{ fontSize: 11, color: C.muted }}>{u.count} gastos</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── GASTOS SECTION ── */}
          {activeSection === "gastos" && (
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                <h2 style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: 20, color: C.text }}>Gastos de {monthLabel(mk)}</h2>
                <span style={{ fontSize: 13, color: C.muted }}>{curExpenses.length} registros · {formatAmount(total)}</span>
              </div>
              {curExpenses.length === 0 ? (
                <div className="card-shadow" style={{ background: C.card, borderRadius: 16, padding: "40px", border: `1px solid ${C.border}`, textAlign: "center", color: C.muted }}>
                  <div style={{ fontSize: 36, marginBottom: 10 }}>📋</div>
                  <p>No hay gastos cargados este mes.</p>
                </div>
              ) : (
                <div className="card-shadow" style={{ background: C.card, borderRadius: 16, border: `1px solid ${C.border}`, overflow: "hidden" }}>
                  {[...curExpenses].sort((a, b) => new Date(b.date) - new Date(a.date)).map((e, i, arr) => {
                    const group = groups.find(g => g.id === e.group_id);
                    const cat = categories.find(c => c.id === e.category_id);
                    const user = getUserById(e.user_id);
                    return (
                      <div key={e.id} className="row-hover" style={{ display: "flex", alignItems: "center", gap: 12, padding: "14px 16px", borderBottom: i < arr.length - 1 ? `1px solid ${C.border}` : "none", background: "transparent" }}>
                        <div style={{ width: 40, height: 40, background: (group?.color || C.accent) + "22", borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, flexShrink: 0 }}>{cat?.icon || group?.icon || "📦"}</div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontWeight: 600, fontSize: 14, color: C.text }}>{group?.name}{cat ? ` › ${cat.name}` : ""}</div>
                          <div style={{ fontSize: 12, color: C.muted }}>{user.avatar} {user.name}{e.note ? ` · ${e.note}` : ""}</div>
                        </div>
                        <div style={{ textAlign: "right", flexShrink: 0 }}>
                          <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, color: C.red }}>{formatAmount(e.amount)}</div>
                          <div style={{ fontSize: 11, color: C.muted }}>{e.date}</div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* ── MIEMBROS SECTION ── */}
          {activeSection === "miembros" && (
            <div>
              <h2 style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: 20, color: C.text, marginBottom: 16 }}>Miembros</h2>
              <div className="members-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 20 }}>
                {ALL_USERS.map(u => {
                  const uExp = curExpenses.filter(e => e.user_id === u.id);
                  const uTotal = uExp.reduce((s, e) => s + e.amount, 0);
                  return (
                    <div key={u.id} className="card-shadow" style={{ background: C.card, borderRadius: 16, padding: "18px", border: `1px solid ${u.color}33` }}>
                      <div style={{ fontSize: 32, marginBottom: 8 }}>{u.avatar}</div>
                      <div style={{ fontWeight: 700, fontSize: 16, color: C.text, marginBottom: 2 }}>{u.name}</div>
                      <div style={{ fontSize: 11, color: u.role === "admin" ? C.accent : C.green, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1, marginBottom: 10 }}>{u.role === "admin" ? "Admin" : "Familiar"}</div>
                      <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: 20, color: u.color, marginBottom: 2 }}>{formatAmount(uTotal)}</div>
                      <div style={{ fontSize: 11, color: C.muted }}>{uExp.length} gastos este mes</div>
                      <div style={{ height: 4, background: C.border, borderRadius: 2, marginTop: 10, overflow: "hidden" }}>
                        <div style={{ height: "100%", width: `${total > 0 ? (uTotal / total) * 100 : 0}%`, background: u.color, borderRadius: 2 }} />
                      </div>
                    </div>
                  );
                })}
              </div>
              {ALL_USERS.map(u => {
                const uExp = curExpenses.filter(e => e.user_id === u.id);
                const uGroups = groups.map(g => ({ ...g, total: uExp.filter(e => e.group_id === g.id).reduce((s, e) => s + e.amount, 0) })).filter(g => g.total > 0);
                if (uGroups.length === 0) return null;
                return (
                  <div key={u.id} className="card-shadow" style={{ background: C.card, borderRadius: 16, padding: "18px", marginBottom: 12, border: `1px solid ${C.border}` }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
                      <span style={{ fontSize: 22 }}>{u.avatar}</span>
                      <span style={{ fontWeight: 700, fontSize: 15, color: C.text }}>{u.name}</span>
                    </div>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                      {uGroups.map(g => (
                        <div key={g.id} style={{ background: g.color + "18", border: `1px solid ${g.color}44`, borderRadius: 8, padding: "4px 10px", fontSize: 12, color: g.color, fontWeight: 500 }}>
                          {g.icon} {g.name} · {formatAmount(g.total)}
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Bottom nav mobile */}
      <div className="bottom-nav" style={{ position: "fixed", bottom: 0, left: 0, right: 0, background: C.surface, borderTop: `1px solid ${C.border}`, display: "flex", alignItems: "center", padding: "8px 8px 16px", boxShadow: isDark ? "none" : "0 -2px 12px #0000000D" }}>
        {NAV.map(t => (
          <button key={t.id} onClick={() => setActiveSection(t.id)} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 2, background: "none", border: "none", cursor: "pointer", padding: "6px 0", color: activeSection === t.id ? C.accent : C.muted, fontSize: 10, fontWeight: activeSection === t.id ? 700 : 400 }}>
            <span style={{ fontSize: 20 }}>{t.icon}</span>{t.label}
          </button>
        ))}
        <button onClick={() => setShowHistory(true)} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 2, background: "none", border: "none", cursor: "pointer", padding: "6px 0", color: C.muted, fontSize: 10 }}>
          <span style={{ fontSize: 20 }}>📅</span>Historial
        </button>
        <button onClick={() => setShowManage(true)} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 2, background: "none", border: "none", cursor: "pointer", padding: "6px 0", color: C.muted, fontSize: 10 }}>
          <span style={{ fontSize: 20 }}>⚙️</span>Categ.
        </button>
        <button onClick={onAdd} style={{ background: C.accent, border: "none", borderRadius: "50%", width: 48, height: 48, fontSize: 24, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: `0 4px 20px ${C.accent}66`, flexShrink: 0, color: "white" }}>+</button>
      </div>

      {/* FAB desktop */}
      <button className="fab-desktop btn-hover" onClick={onAdd} style={{ position: "fixed", bottom: 32, right: 32, background: C.accent, border: "none", borderRadius: 16, padding: "14px 24px", fontSize: 15, fontWeight: 700, cursor: "pointer", alignItems: "center", gap: 8, boxShadow: `0 4px 24px ${C.accent}66`, color: "white", zIndex: 50 }}>
        <span style={{ fontSize: 20 }}>+</span> Agregar gasto
      </button>

      {showManage && <ManageCategoriesModal onClose={() => setShowManage(false)} groups={groups} categories={categories} onRefresh={onRefresh} />}
      {showHistory && <HistoryModal onClose={() => setShowHistory(false)} allExpenses={expenses} groups={groups} categories={categories} C={C} />}
    </div>
  );
}

// ─── USER PANEL ───────────────────────────────────────────────────────────────
function UserPanel({ expenses, currentProfile, onAdd, onLogout, groups, categories, onRefresh }) {
  const isDark = useColorScheme();
  const C = getColors(isDark);
  const [showManage, setShowManage] = useState(false);
  const [showHistory, setShowHistory] = useState(false);

  const mk = currentMonthKey();
  const myExpenses = useMemo(() => expenses.filter(e => e.user_id === currentProfile.id && getMonthKey(e.date) === mk).sort((a, b) => new Date(b.created_at) - new Date(a.created_at)), [expenses, currentProfile.id, mk]);
  const myTotal = myExpenses.reduce((s, e) => s + e.amount, 0);
  const myAllExpenses = expenses.filter(e => e.user_id === currentProfile.id);

  return (
    <div style={{ minHeight: "100vh", background: C.bg, fontFamily: "'DM Sans', sans-serif", color: C.text }}>
      <style>{getGlobalStyles(C, isDark)}</style>

      <div style={{ maxWidth: 520, margin: "0 auto", padding: "0 0 80px" }}>
        {/* Header */}
        <div style={{ padding: "28px 20px 20px", background: C.surface, borderBottom: `1px solid ${C.border}`, boxShadow: isDark ? "none" : "0 1px 8px #0000000A" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20 }}>
            <div>
              <div style={{ fontSize: 12, color: C.muted, marginBottom: 3 }}>Hola,</div>
              <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: 24, color: C.text }}>{currentProfile.name} {currentProfile.avatar}</div>
              <div style={{ fontSize: 12, color: C.muted, marginTop: 2 }}>{monthLabel(mk)}</div>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={() => setShowHistory(true)} style={{ background: C.card, border: `1px solid ${C.border}`, color: C.muted, padding: "7px 10px", borderRadius: 8, cursor: "pointer", fontSize: 13 }}>📅</button>
              <button onClick={() => setShowManage(true)} style={{ background: C.card, border: `1px solid ${C.border}`, color: C.muted, padding: "7px 10px", borderRadius: 8, cursor: "pointer", fontSize: 13 }}>⚙️</button>
              <button onClick={onLogout} style={{ background: "none", border: `1px solid ${C.border}`, color: C.muted, padding: "7px 10px", borderRadius: 8, cursor: "pointer", fontSize: 12 }}>Salir</button>
            </div>
          </div>
          <div style={{ background: `linear-gradient(135deg, ${currentProfile.color}22, ${C.card})`, border: `1px solid ${currentProfile.color}44`, borderRadius: 16, padding: "18px" }}>
            <div style={{ fontSize: 11, color: C.muted, fontWeight: 600, textTransform: "uppercase", letterSpacing: 1, marginBottom: 6 }}>Mis gastos del mes</div>
            <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 32, fontWeight: 700, color: C.text }}>{formatAmount(myTotal)}</div>
            <div style={{ fontSize: 12, color: C.muted, marginTop: 4 }}>{myExpenses.length} registros · {monthLabel(mk)}</div>
          </div>
        </div>

        {/* Add button */}
        <div style={{ padding: "16px 20px 12px" }}>
          <button className="btn-hover" onClick={onAdd} style={{ width: "100%", background: C.accent, color: "white", border: "none", borderRadius: 16, padding: "17px", fontSize: 16, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, boxShadow: `0 4px 20px ${C.accent}55` }}>
            <span style={{ fontSize: 22 }}>+</span> Agregar nuevo gasto
          </button>
        </div>

        {/* My expenses */}
        <div style={{ padding: "4px 20px 40px" }}>
          <h3 style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: 15, marginBottom: 12, color: C.muted, textTransform: "uppercase", letterSpacing: 1, fontSize: 11 }}>MIS GASTOS</h3>
          {myExpenses.length === 0 ? (
            <div style={{ textAlign: "center", padding: "40px 20px", color: C.muted }}>
              <div style={{ fontSize: 48, marginBottom: 12 }}>🌱</div>
              <p>Todavía no cargaste gastos este mes.</p>
            </div>
          ) : (
            <div className="card-shadow" style={{ background: C.card, borderRadius: 16, border: `1px solid ${C.border}`, overflow: "hidden" }}>
              {myExpenses.map((e, i) => {
                const group = groups.find(g => g.id === e.group_id);
                const cat = categories.find(c => c.id === e.category_id);
                return (
                  <div key={e.id} className="row-hover" style={{ display: "flex", alignItems: "center", gap: 12, padding: "14px 16px", borderBottom: i < myExpenses.length - 1 ? `1px solid ${C.border}` : "none", background: "transparent" }}>
                    <div style={{ width: 42, height: 42, background: (group?.color || C.accent) + "22", borderRadius: 12, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, flexShrink: 0 }}>{cat?.icon || group?.icon || "📦"}</div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 600, fontSize: 14, color: C.text }}>{group?.name}{cat ? ` › ${cat.name}` : ""}</div>
                      {e.note && <div style={{ fontSize: 12, color: C.muted, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{e.note}</div>}
                      <div style={{ fontSize: 11, color: C.muted }}>{e.date}</div>
                    </div>
                    <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: 16, color: C.red, flexShrink: 0 }}>{formatAmount(e.amount)}</div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {showManage && <ManageCategoriesModal onClose={() => setShowManage(false)} groups={groups} categories={categories} onRefresh={onRefresh} />}
      {showHistory && <HistoryModal onClose={() => setShowHistory(false)} allExpenses={myAllExpenses} groups={groups} categories={categories} C={C} />}
    </div>
  );
}

// ─── APP ROOT ─────────────────────────────────────────────────────────────────
export default function App() {
  const isDark = useColorScheme();
  const C = getColors(isDark);
  const [session, setSession] = useState(null);
  const [currentProfile, setCurrentProfile] = useState(null);
  const [expenses, setExpenses] = useState([]);
  const [groups, setGroups] = useState([]);
  const [categories, setCategories] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session?.user?.email) setCurrentProfile(USER_PROFILES[session.user.email] || null);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, session) => {
      setSession(session);
      if (session?.user?.email) setCurrentProfile(USER_PROFILES[session.user.email] || null);
      else setCurrentProfile(null);
    });
    return () => subscription.unsubscribe();
  }, []);

  async function fetchAll() {
    setLoading(true);
    const [{ data: exp }, { data: grp }, { data: cat }] = await Promise.all([
      supabase.from("expenses").select("*").order("created_at", { ascending: false }),
      supabase.from("category_groups").select("*").order("created_at"),
      supabase.from("categories").select("*").order("created_at"),
    ]);
    setExpenses(exp || []);
    setGroups(grp || []);
    setCategories(cat || []);
    setLoading(false);
  }

  useEffect(() => {
    if (!session) return;
    fetchAll();
    const channel = supabase.channel("all-changes")
      .on("postgres_changes", { event: "*", schema: "public", table: "expenses" }, fetchAll)
      .on("postgres_changes", { event: "*", schema: "public", table: "category_groups" }, fetchAll)
      .on("postgres_changes", { event: "*", schema: "public", table: "categories" }, fetchAll)
      .subscribe();
    return () => supabase.removeChannel(channel);
  }, [session]);

  async function handleAdd(expense) { await supabase.from("expenses").insert([expense]); }
  async function handleLogout() { await supabase.auth.signOut(); }

  if (!session) return <LoginScreen />;

  if (!currentProfile) return (
    <div style={{ minHeight: "100vh", background: C.bg, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", color: C.text, fontFamily: "'DM Sans', sans-serif", padding: 24 }}>
      <style>{getGlobalStyles(C, isDark)}</style>
      <div style={{ fontSize: 48, marginBottom: 16 }}>🤔</div>
      <p style={{ marginBottom: 16, color: C.muted }}>Este email no está registrado en la familia.</p>
      <button onClick={handleLogout} style={{ background: C.accent, color: "white", border: "none", padding: "12px 24px", borderRadius: 12, cursor: "pointer", fontWeight: 600 }}>Salir</button>
    </div>
  );

  if (loading && expenses.length === 0 && groups.length === 0) return (
    <div style={{ minHeight: "100vh", background: C.bg, display: "flex", alignItems: "center", justifyContent: "center", color: C.muted, fontFamily: "'DM Sans', sans-serif" }}>
      <style>{getGlobalStyles(C, isDark)}</style>
      Cargando...
    </div>
  );

  return (
    <>
      {currentProfile.role === "admin"
        ? <AdminDashboard expenses={expenses} currentProfile={currentProfile} onAdd={() => setShowModal(true)} onLogout={handleLogout} groups={groups} categories={categories} onRefresh={fetchAll} />
        : <UserPanel expenses={expenses} currentProfile={currentProfile} onAdd={() => setShowModal(true)} onLogout={handleLogout} groups={groups} categories={categories} onRefresh={fetchAll} />}
      {showModal && <AddExpenseModal onClose={() => setShowModal(false)} onAdd={handleAdd} currentProfile={currentProfile} groups={groups} categories={categories} />}
    </>
  );
}