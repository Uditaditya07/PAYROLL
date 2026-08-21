/**
 * Ledger — Payroll Management App (standalone / GitHub Codespaces version)
 *
 * Setup:
 *   1. npm create vite@latest ledger-payroll -- --template react
 *   2. cd ledger-payroll && npm install
 *   3. Replace the contents of src/App.jsx with this file's contents
 *      (or save this as src/PayrollApp.jsx and do:
 *        import PayrollApp from "./PayrollApp";
 *        export default PayrollApp;
 *      inside src/App.jsx)
 *   4. npm run dev
 *
 * Data persistence: uses the browser's localStorage (per-browser, per-device).
 * It is NOT synced across devices or users — for a real deployment, swap the
 * localDB helper below for calls to a real backend/database.
 *
 * Demo admin login: admin / admin123
 * Employee login: use the Employee ID as the password until an admin sets one.
 */
import React, { useState, useEffect, useMemo } from "react";

const FONT_LINK_ID = "payroll-fonts";
function ensureFonts() {
  if (typeof document === "undefined") return;
  if (document.getElementById(FONT_LINK_ID)) return;
  const link = document.createElement("link");
  link.id = FONT_LINK_ID;
  link.rel = "stylesheet";
  link.href =
    "https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;600;700&family=Inter:wght@400;500;600&family=IBM+Plex+Mono:wght@400;500;600&display=swap";
  document.head.appendChild(link);
}

const COLORS = {
  ink: "#1C2430",
  inkSoft: "#2C3746",
  paper: "#F2F1EC",
  paperCard: "#FBFAF7",
  line: "#DAD7CC",
  gold: "#B0793A",
  goldDeep: "#8A5C25",
  green: "#2F6B4F",
  greenBg: "#E4EFE8",
  amber: "#B4791C",
  amberBg: "#F5EAD5",
  red: "#AC4438",
  redBg: "#F5E3DF",
  textMuted: "#6B7280",
};

const DEPARTMENTS = ["Engineering", "Sales", "Marketing", "Operations", "Finance", "Support", "HR"];
const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];

function uid(prefix) {
  return prefix + "_" + Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
}
function currency(n) {
  const v = Number.isFinite(n) ? n : 0;
  return "$" + v.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function initials(name) {
  return name.split(" ").filter(Boolean).slice(0, 2).map((s) => s[0].toUpperCase()).join("");
}

function computePay(emp) {
  const basic = Number(emp.basic) || 0;
  const hra = Number(emp.hra) || 0;
  const allowances = Number(emp.allowances) || 0;
  const gross = basic + hra + allowances;
  const pf = round2(basic * (Number(emp.pfPercent) || 0) / 100);
  const tax = round2(gross * (Number(emp.taxPercent) || 0) / 100);
  const otherDeductions = Number(emp.otherDeductions) || 0;
  const totalDeductions = round2(pf + tax + otherDeductions);
  const net = round2(gross - totalDeductions);
  return { basic, hra, allowances, gross, pf, tax, otherDeductions, totalDeductions, net };
}
function round2(n) {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

const emptyEmployee = () => ({
  id: uid("emp"),
  empCode: "",
  name: "",
  email: "",
  password: "",
  department: DEPARTMENTS[0],
  designation: "",
  joinDate: "",
  status: "active",
  basic: "",
  hra: "",
  allowances: "",
  pfPercent: "12",
  taxPercent: "10",
  otherDeductions: "0",
  bankName: "",
  accountNumber: "",
});

const ADMIN_CREDENTIALS = { username: "admin", password: "admin123" };

// Local persistence helpers (browser localStorage) — replaces the
// Claude-artifact-only window.storage API for use outside claude.ai.
const localDB = {
  async get(key) {
    try {
      const raw = window.localStorage.getItem(key);
      return raw === null ? null : { key, value: raw };
    } catch (err) {
      console.error("localStorage get failed", err);
      return null;
    }
  },
  async set(key, value) {
    try {
      window.localStorage.setItem(key, value);
      return { key, value };
    } catch (err) {
      console.error("localStorage set failed", err);
      return null;
    }
  },
};

export default function PayrollRoot() {
  useEffect(() => { ensureFonts(); }, []);
  const [screen, setScreen] = useState("landing"); // landing | login | app
  const [session, setSession] = useState(null); // {role:'admin'} | {role:'employee', employee}
  const [employees, setEmployees] = useState([]);
  const [runs, setRuns] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const e = await localDB.get("employees").catch(() => null);
        const r = await localDB.get("payroll-runs").catch(() => null);
        if (!cancelled) {
          setEmployees(e && e.value ? JSON.parse(e.value) : []);
          setRuns(r && r.value ? JSON.parse(r.value) : []);
        }
      } catch (err) {
        console.error("Load error", err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, []);

  async function persistEmployees(next) {
    setEmployees(next);
    try { await localDB.set("employees", JSON.stringify(next)); }
    catch (err) { console.error("Save employees failed", err); }
  }
  async function persistRuns(next) {
    setRuns(next);
    try { await localDB.set("payroll-runs", JSON.stringify(next)); }
    catch (err) { console.error("Save runs failed", err); }
  }

  function handleLogin(role, employee) {
    setSession(role === "admin" ? { role: "admin" } : { role: "employee", employeeId: employee.id });
    setScreen("app");
  }
  function handleLogout() {
    setSession(null);
    setScreen("landing");
  }

  const wrapOuter = {
    fontFamily: "'Inter', ui-sans-serif, system-ui, sans-serif",
    color: COLORS.ink,
    minHeight: "600px",
    borderRadius: "12px",
    overflow: "hidden",
    border: `1px solid ${COLORS.line}`,
    position: "relative",
  };

  if (loading) {
    return (
      <div style={{ ...wrapOuter, background: COLORS.paper, display: "flex", alignItems: "center", justifyContent: "center", minHeight: 400 }}>
        <div style={{ color: COLORS.textMuted, fontFamily: "'Space Grotesk', sans-serif" }}>Loading…</div>
      </div>
    );
  }

  if (screen === "landing") {
    return <Landing wrap={wrapOuter} onSignIn={() => setScreen("login")} />;
  }
  if (screen === "login") {
    return (
      <Login
        wrap={wrapOuter}
        employees={employees}
        onBack={() => setScreen("landing")}
        onLogin={handleLogin}
      />
    );
  }

  if (session && session.role === "admin") {
    return (
      <AdminApp
        wrapOuter={wrapOuter}
        employees={employees}
        runs={runs}
        persistEmployees={persistEmployees}
        persistRuns={persistRuns}
        onLogout={handleLogout}
      />
    );
  }
  if (session && session.role === "employee") {
    const employee = employees.find((e) => e.id === session.employeeId);
    return (
      <EmployeePortal
        wrapOuter={wrapOuter}
        employee={employee}
        runs={runs}
        onLogout={handleLogout}
      />
    );
  }
  return <Landing wrap={wrapOuter} onSignIn={() => setScreen("login")} />;
}

function Landing({ wrap, onSignIn }) {
  return (
    <div style={{ ...wrap, background: COLORS.ink, color: "#F5F3EC" }}>
      <style>{`
        .pr-btn { font-family:'Inter',sans-serif; font-size:13px; font-weight:600; padding:9px 16px; border-radius:6px; border:1px solid ${COLORS.line}; background:${COLORS.paperCard}; color:${COLORS.ink}; cursor:pointer; }
        .pr-btn-primary { background:${COLORS.gold}; color:${COLORS.ink}; border-color:${COLORS.gold}; }
        .pr-btn-primary:hover { background:#C48A47; }
        .pr-btn-ghost { background:transparent; color:#F5F3EC; border-color:#3D4759; }
        .pr-btn-ghost:hover { border-color:${COLORS.gold}; }
      `}</style>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "22px 34px", borderBottom: "1px solid #2E394A" }}>
        <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: 18 }}>Ledger</div>
        <button className="pr-btn pr-btn-ghost" onClick={onSignIn}>Sign in</button>
      </div>

      <div style={{ padding: "64px 34px 40px", maxWidth: 640 }}>
        <div style={{ fontSize: 12, letterSpacing: "0.08em", textTransform: "uppercase", color: COLORS.gold, fontWeight: 600, marginBottom: 14 }}>
          Payroll, kept in order
        </div>
        <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: 38, lineHeight: 1.15, marginBottom: 16 }}>
          Run payroll like it's a ledger, not a spreadsheet.
        </div>
        <div style={{ fontSize: 15, color: "#B7BEC9", lineHeight: 1.6, marginBottom: 30 }}>
          Manage your team, run monthly payroll in one click, and give every employee a clean view of their own pay. Built for small teams who want payroll done right without the overhead.
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <button className="pr-btn pr-btn-primary" onClick={onSignIn}>Sign in to continue</button>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0,1fr))", gap: 1, background: "#2E394A", margin: "0 34px 40px", borderRadius: 10, overflow: "hidden" }}>
        {[
          ["For admins", "Add employees, set pay structures, and run monthly payroll in a few clicks."],
          ["For employees", "Sign in with an employee ID to see personal payslips and pay history."],
          ["Always up to date", "Every payroll run is saved, so past payslips are always there when needed."],
        ].map(([title, body]) => (
          <div key={title} style={{ background: "#1F2836", padding: "20px 22px" }}>
            <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 8 }}>{title}</div>
            <div style={{ fontSize: 13, color: "#9AA2B0", lineHeight: 1.55 }}>{body}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function Login({ wrap, employees, onBack, onLogin }) {
  const [role, setRole] = useState("admin");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [empCode, setEmpCode] = useState("");
  const [empPassword, setEmpPassword] = useState("");
  const [error, setError] = useState("");

  function submitAdmin() {
    if (!username.trim() || !password.trim()) { setError("Enter a username and password."); return; }
    if (username.trim() === ADMIN_CREDENTIALS.username && password === ADMIN_CREDENTIALS.password) {
      setError("");
      onLogin("admin");
    } else {
      setError("Incorrect username or password.");
    }
  }
  function submitEmployee() {
    if (!empCode.trim() || !empPassword.trim()) { setError("Enter your employee ID and password."); return; }
    const emp = employees.find((e) => e.empCode.toLowerCase() === empCode.trim().toLowerCase());
    if (!emp) { setError("No employee found with that ID."); return; }
    const expected = emp.password && emp.password.length ? emp.password : emp.empCode;
    if (empPassword !== expected) { setError("Incorrect password."); return; }
    setError("");
    onLogin("employee", emp);
  }

  return (
    <div style={{ ...wrap, background: COLORS.paper, display: "flex", alignItems: "center", justifyContent: "center", minHeight: 560 }}>
      <style>{`
        .pr-btn { font-family:'Inter',sans-serif; font-size:13px; font-weight:600; padding:9px 14px; border-radius:6px; border:1px solid ${COLORS.line}; background:${COLORS.paperCard}; color:${COLORS.ink}; cursor:pointer; }
        .pr-btn-primary { background:${COLORS.ink}; color:#F5F3EC; border-color:${COLORS.ink}; width:100%; padding:10px; }
        .pr-input { font-family:'Inter',sans-serif; font-size:13px; padding:9px 11px; border-radius:6px; border:1px solid ${COLORS.line}; background:#fff; width:100%; box-sizing:border-box; }
        .pr-tab { flex:1; text-align:center; padding:9px 0; font-size:13px; font-weight:600; cursor:pointer; color:${COLORS.textMuted}; border-bottom:2px solid transparent; }
        .pr-tab.active { color:${COLORS.ink}; border-color:${COLORS.gold}; }
      `}</style>
      <div style={{ width: 360, background: COLORS.paperCard, border: `1px solid ${COLORS.line}`, borderRadius: 12, padding: 26 }}>
        <div onClick={onBack} style={{ fontSize: 12, color: COLORS.textMuted, cursor: "pointer", marginBottom: 14 }}>&larr; Back</div>
        <div style={{ fontFamily: "'Space Grotesk',sans-serif", fontWeight: 700, fontSize: 19, marginBottom: 4 }}>Sign in</div>
        <div style={{ fontSize: 13, color: COLORS.textMuted, marginBottom: 18 }}>Choose how you'd like to sign in.</div>

        <div style={{ display: "flex", borderBottom: `1px solid ${COLORS.line}`, marginBottom: 18 }}>
          <div className={"pr-tab" + (role === "admin" ? " active" : "")} onClick={() => { setRole("admin"); setError(""); }}>Admin</div>
          <div className={"pr-tab" + (role === "employee" ? " active" : "")} onClick={() => { setRole("employee"); setError(""); }}>Employee</div>
        </div>

        {role === "admin" ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div>
              <label className="pr-label">Username</label>
              <input className="pr-input" value={username} onChange={(e) => setUsername(e.target.value)} placeholder="admin" />
            </div>
            <div>
              <label className="pr-label">Password</label>
              <input className="pr-input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" onKeyDown={(e) => e.key === "Enter" && submitAdmin()} />
            </div>
            {error && <div style={{ fontSize: 12, color: COLORS.red }}>{error}</div>}
            <button className="pr-btn pr-btn-primary" onClick={submitAdmin}>Sign in as admin</button>
            <div style={{ fontSize: 11, color: COLORS.textMuted, textAlign: "center" }}>Demo credentials: admin / admin123</div>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div>
              <label className="pr-label">Employee ID</label>
              <input className="pr-input" value={empCode} onChange={(e) => setEmpCode(e.target.value)} placeholder="EMP-1042" />
            </div>
            <div>
              <label className="pr-label">Password</label>
              <input className="pr-input" type="password" value={empPassword} onChange={(e) => setEmpPassword(e.target.value)} placeholder="••••••••" onKeyDown={(e) => e.key === "Enter" && submitEmployee()} />
            </div>
            {error && <div style={{ fontSize: 12, color: COLORS.red }}>{error}</div>}
            <button className="pr-btn pr-btn-primary" onClick={submitEmployee}>Sign in as employee</button>
            <div style={{ fontSize: 11, color: COLORS.textMuted, textAlign: "center" }}>New employees: your password is your employee ID until an admin sets one.</div>
          </div>
        )}
      </div>
    </div>
  );
}

function EmployeePortal({ wrapOuter, employee, runs, onLogout }) {
  const [payslipView, setPayslipView] = useState(null);
  if (!employee) {
    return (
      <div style={{ ...wrapOuter, background: COLORS.paper, padding: 40, textAlign: "center" }}>
        <div style={{ color: COLORS.textMuted }}>Your account could not be found. Please contact your admin.</div>
        <button className="pr-btn" style={{ marginTop: 16 }} onClick={onLogout}>Back to sign in</button>
      </div>
    );
  }
  const myRuns = runs
    .map((r) => ({ run: r, record: r.records.find((rec) => rec.employeeId === employee.id) }))
    .filter((x) => x.record)
    .sort((a, b) => (a.run.runDate < b.run.runDate ? 1 : -1));
  const latest = myRuns[0];

  return (
    <div style={{ ...wrapOuter, background: COLORS.paper }}>
      <style>{`
        .pr-btn { font-family:'Inter',sans-serif; font-size:13px; font-weight:600; padding:8px 14px; border-radius:6px; border:1px solid ${COLORS.line}; background:${COLORS.paperCard}; color:${COLORS.ink}; cursor:pointer; }
        .pr-btn:hover { border-color:${COLORS.goldDeep}; }
        .pr-card { background:${COLORS.paperCard}; border:1px solid ${COLORS.line}; border-radius:10px; padding:16px 18px; }
        .pr-mono { font-family:'IBM Plex Mono', monospace; font-variant-numeric: tabular-nums; }
        .pr-label { font-size:11px; font-weight:600; text-transform:uppercase; letter-spacing:0.05em; color:${COLORS.textMuted}; display:block; margin-bottom:4px; }
        .pr-table th { text-align:left; font-size:11px; text-transform:uppercase; letter-spacing:0.04em; color:${COLORS.textMuted}; font-weight:600; padding:8px 12px; border-bottom:1px solid ${COLORS.line}; }
        .pr-table td { padding:10px 12px; font-size:13px; border-bottom:1px solid ${COLORS.line}44; }
      `}</style>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "16px 26px", borderBottom: `1px solid ${COLORS.line}`, background: COLORS.paperCard }}>
        <div>
          <div style={{ fontFamily: "'Space Grotesk',sans-serif", fontWeight: 700, fontSize: 16 }}>Ledger</div>
          <div style={{ fontSize: 11, color: COLORS.textMuted }}>Employee portal</div>
        </div>
        <button className="pr-btn" onClick={onLogout}>Sign out</button>
      </div>

      <div style={{ padding: "22px 26px" }}>
        <div className="pr-card" style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 20 }}>
          <div style={{ width: 46, height: 46, borderRadius: "50%", background: COLORS.gold + "26", color: COLORS.goldDeep, fontWeight: 700, fontSize: 15, display: "flex", alignItems: "center", justifyContent: "center" }}>
            {initials(employee.name || "?")}
          </div>
          <div>
            <div style={{ fontWeight: 700, fontSize: 16 }}>{employee.name}</div>
            <div style={{ fontSize: 12, color: COLORS.textMuted }}>{employee.designation} · {employee.department} · {employee.empCode}</div>
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0,1fr))", gap: 14, marginBottom: 20 }}>
          <StatCard label="Most recent pay" value={latest ? currency(latest.record.net) : "—"} sub={latest ? `${latest.run.month} ${latest.run.year}` : "No payslips yet"} />
          <StatCard label="Total payslips" value={myRuns.length} />
          <StatCard label="Status" value={employee.status === "active" ? "Active" : "Inactive"} />
        </div>

        <div className="pr-card" style={{ padding: 0, overflow: "hidden" }}>
          <div style={{ padding: "12px 16px", fontWeight: 600, fontSize: 14, borderBottom: `1px solid ${COLORS.line}`, fontFamily: "'Space Grotesk',sans-serif" }}>
            Payslip history
          </div>
          {myRuns.length === 0 ? (
            <div style={{ padding: 24, textAlign: "center", color: COLORS.textMuted, fontSize: 13 }}>
              No payslips yet. They'll show up here once payroll is run.
            </div>
          ) : (
            <table className="pr-table" style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead><tr><th>Period</th><th style={{ textAlign: "right" }}>Gross</th><th style={{ textAlign: "right" }}>Net</th><th></th></tr></thead>
              <tbody>
                {myRuns.map(({ run, record }) => (
                  <tr key={run.id}>
                    <td>{run.month} {run.year}</td>
                    <td className="pr-mono" style={{ textAlign: "right" }}>{currency(record.gross)}</td>
                    <td className="pr-mono" style={{ textAlign: "right" }}>{currency(record.net)}</td>
                    <td style={{ textAlign: "right" }}>
                      <button className="pr-btn" style={{ padding: "4px 9px" }} onClick={() => setPayslipView({ run, record })}>View</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {payslipView && <PayslipModal data={payslipView} onClose={() => setPayslipView(null)} />}
    </div>
  );
}

function AdminApp({ wrapOuter, employees, runs, persistEmployees, persistRuns, onLogout }) {
  const [tab, setTab] = useState("dashboard");
  const [search, setSearch] = useState("");
  const [deptFilter, setDeptFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [modal, setModal] = useState(null); // {type:'edit'|'view', employee}
  const [form, setForm] = useState(emptyEmployee());
  const [formErrors, setFormErrors] = useState({});
  const [runMonth, setRunMonth] = useState(MONTHS[new Date().getMonth()]);
  const [runYear, setRunYear] = useState(String(new Date().getFullYear()));
  const [runBusy, setRunBusy] = useState(false);
  const [runMsg, setRunMsg] = useState("");
  const [selectedRunId, setSelectedRunId] = useState(null);
  const [payslipView, setPayslipView] = useState(null); // {run, record}
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [toast, setToast] = useState(null);

  function showToast(text, kind = "ok") {
    setToast({ text, kind });
    setTimeout(() => setToast(null), 3000);
  }

  const filteredEmployees = useMemo(() => {
    return employees.filter((e) => {
      const q = search.trim().toLowerCase();
      const matchesQ =
        !q ||
        e.name.toLowerCase().includes(q) ||
        (e.empCode || "").toLowerCase().includes(q) ||
        (e.designation || "").toLowerCase().includes(q);
      const matchesDept = deptFilter === "all" || e.department === deptFilter;
      const matchesStatus = statusFilter === "all" || e.status === statusFilter;
      return matchesQ && matchesDept && matchesStatus;
    });
  }, [employees, search, deptFilter, statusFilter]);

  const activeEmployees = useMemo(() => employees.filter((e) => e.status === "active"), [employees]);
  const monthlyPayroll = useMemo(
    () => activeEmployees.reduce((sum, e) => sum + computePay(e).gross, 0),
    [activeEmployees]
  );
  const monthlyNet = useMemo(
    () => activeEmployees.reduce((sum, e) => sum + computePay(e).net, 0),
    [activeEmployees]
  );
  const deptBreakdown = useMemo(() => {
    const map = {};
    activeEmployees.forEach((e) => {
      const gross = computePay(e).gross;
      map[e.department] = (map[e.department] || 0) + gross;
    });
    return Object.entries(map).sort((a, b) => b[1] - a[1]);
  }, [activeEmployees]);
  const maxDept = deptBreakdown.length ? deptBreakdown[0][1] : 1;

  function openAdd() {
    setForm(emptyEmployee());
    setFormErrors({});
    setModal("edit");
  }
  function openEdit(emp) {
    setForm({ ...emp });
    setFormErrors({});
    setModal("edit");
  }
  function closeModal() {
    setModal(null);
  }

  function validateForm(f) {
    const errs = {};
    if (!f.name.trim()) errs.name = "Enter a name.";
    if (!f.empCode.trim()) errs.empCode = "Enter an employee ID.";
    else if (employees.some((e) => e.empCode === f.empCode.trim() && e.id !== f.id))
      errs.empCode = "This ID is already in use.";
    if (!f.designation.trim()) errs.designation = "Enter a designation.";
    if (f.email && !/^\S+@\S+\.\S+$/.test(f.email)) errs.email = "Enter a valid email.";
    if (f.basic === "" || Number(f.basic) < 0) errs.basic = "Enter a valid basic salary.";
    if (f.hra !== "" && Number(f.hra) < 0) errs.hra = "Must be zero or more.";
    if (f.allowances !== "" && Number(f.allowances) < 0) errs.allowances = "Must be zero or more.";
    if (f.pfPercent !== "" && (Number(f.pfPercent) < 0 || Number(f.pfPercent) > 100)) errs.pfPercent = "0 to 100.";
    if (f.taxPercent !== "" && (Number(f.taxPercent) < 0 || Number(f.taxPercent) > 100)) errs.taxPercent = "0 to 100.";
    return errs;
  }

  function saveEmployee() {
    const errs = validateForm(form);
    setFormErrors(errs);
    if (Object.keys(errs).length) return;
    const exists = employees.some((e) => e.id === form.id);
    const next = exists
      ? employees.map((e) => (e.id === form.id ? { ...form, empCode: form.empCode.trim(), name: form.name.trim() } : e))
      : [...employees, { ...form, empCode: form.empCode.trim(), name: form.name.trim() }];
    persistEmployees(next);
    showToast(exists ? "Employee updated." : "Employee added.");
    setModal(null);
  }

  function deleteEmployee(id) {
    persistEmployees(employees.filter((e) => e.id !== id));
    setConfirmDelete(null);
    showToast("Employee removed.");
  }

  function toggleStatus(emp) {
    const next = employees.map((e) =>
      e.id === emp.id ? { ...e, status: e.status === "active" ? "inactive" : "active" } : e
    );
    persistEmployees(next);
  }

  async function runPayroll() {
    if (!activeEmployees.length) {
      setRunMsg("No active employees to run payroll for.");
      return;
    }
    const already = runs.find((r) => r.month === runMonth && r.year === runYear);
    if (already) {
      setRunMsg(`Payroll for ${runMonth} ${runYear} was already run on ${already.runDate}.`);
      return;
    }
    setRunBusy(true);
    setRunMsg("");
    const records = activeEmployees.map((e) => {
      const pay = computePay(e);
      return {
        employeeId: e.id,
        empCode: e.empCode,
        name: e.name,
        department: e.department,
        designation: e.designation,
        ...pay,
      };
    });
    const totalGross = round2(records.reduce((s, r) => s + r.gross, 0));
    const totalDeductions = round2(records.reduce((s, r) => s + r.totalDeductions, 0));
    const totalNet = round2(records.reduce((s, r) => s + r.net, 0));
    const run = {
      id: uid("run"),
      month: runMonth,
      year: runYear,
      runDate: new Date().toISOString().slice(0, 10),
      records,
      totalGross,
      totalDeductions,
      totalNet,
      employeeCount: records.length,
    };
    await persistRuns([run, ...runs]);
    setRunBusy(false);
    setRunMsg(`Payroll run complete for ${runMonth} ${runYear} — ${records.length} payslips generated.`);
    showToast("Payroll run complete.");
  }

  function openPayslip(run, record) {
    setPayslipView({ run, record });
  }

  const selectedRun = runs.find((r) => r.id === selectedRunId) || runs[0] || null;

  const wrap = { ...wrapOuter, background: COLORS.paper, display: "flex" };

  return (
    <div style={wrap} className="w-full">
      <style>{`
        .pr-btn { font-family:'Inter',sans-serif; font-size:13px; font-weight:600; padding:8px 14px; border-radius:6px; border:1px solid ${COLORS.line}; background:${COLORS.paperCard}; color:${COLORS.ink}; cursor:pointer; transition:all .12s ease; }
        .pr-btn:hover { border-color:${COLORS.goldDeep}; }
        .pr-btn-primary { background:${COLORS.ink}; color:#F5F3EC; border-color:${COLORS.ink}; }
        .pr-btn-primary:hover { background:${COLORS.inkSoft}; }
        .pr-btn-danger { color:${COLORS.red}; border-color:${COLORS.red}44; background:${COLORS.redBg}; }
        .pr-input, .pr-select { font-family:'Inter',sans-serif; font-size:13px; padding:8px 10px; border-radius:6px; border:1px solid ${COLORS.line}; background:#fff; color:${COLORS.ink}; width:100%; box-sizing:border-box; }
        .pr-input:focus, .pr-select:focus { outline:none; border-color:${COLORS.gold}; box-shadow:0 0 0 3px ${COLORS.gold}22; }
        .pr-label { font-size:11px; font-weight:600; text-transform:uppercase; letter-spacing:0.05em; color:${COLORS.textMuted}; display:block; margin-bottom:4px; }
        .pr-mono { font-family:'IBM Plex Mono', monospace; font-variant-numeric: tabular-nums; }
        .pr-nav-item { display:flex; align-items:center; gap:10px; padding:10px 16px; font-size:13px; font-weight:500; color:#C9CCD3; cursor:pointer; border-left:3px solid transparent; }
        .pr-nav-item:hover { background:#232C3A; color:#fff; }
        .pr-nav-item.active { background:#232C3A; color:#fff; border-left-color:${COLORS.gold}; }
        .pr-table th { text-align:left; font-size:11px; text-transform:uppercase; letter-spacing:0.04em; color:${COLORS.textMuted}; font-weight:600; padding:8px 12px; border-bottom:1px solid ${COLORS.line}; }
        .pr-table td { padding:10px 12px; font-size:13px; border-bottom:1px solid ${COLORS.line}44; }
        .pr-table tr:hover td { background:#00000006; }
        .pr-card { background:${COLORS.paperCard}; border:1px solid ${COLORS.line}; border-radius:10px; padding:16px 18px; }
        .pr-badge { font-size:11px; font-weight:600; padding:3px 9px; border-radius:20px; display:inline-block; }
      `}</style>

      {/* Sidebar */}
      <div style={{ width: 200, background: COLORS.ink, flexShrink: 0, display: "flex", flexDirection: "column", paddingTop: 18 }}>
        <div style={{ padding: "0 16px 18px", borderBottom: "1px solid #2E394A" }}>
          <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: 17, color: "#F5F3EC" }}>Ledger</div>
          <div style={{ fontSize: 11, color: "#8B93A3", marginTop: 2 }}>Payroll management</div>
        </div>
        <div style={{ paddingTop: 10 }}>
          {[
            ["dashboard", "Dashboard"],
            ["employees", "Employees"],
            ["payroll", "Run payroll"],
            ["history", "Payslip history"],
          ].map(([key, label]) => (
            <div key={key} className={"pr-nav-item" + (tab === key ? " active" : "")} onClick={() => setTab(key)}>
              {label}
            </div>
          ))}
        </div>
        <div style={{ marginTop: "auto", padding: 16 }}>
          <div style={{ fontSize: 11, color: "#5B6472", marginBottom: 10 }}>{employees.length} employees on file</div>
          <button className="pr-btn" style={{ width: "100%" }} onClick={onLogout}>Sign out</button>
        </div>
      </div>

      {/* Main */}
      <div style={{ flex: 1, padding: "22px 26px", overflow: "auto", maxHeight: 780 }}>
        {tab === "dashboard" && (
          <Dashboard
            employees={employees}
            activeEmployees={activeEmployees}
            monthlyPayroll={monthlyPayroll}
            monthlyNet={monthlyNet}
            deptBreakdown={deptBreakdown}
            maxDept={maxDept}
            runs={runs}
            onGoEmployees={() => setTab("employees")}
            onGoPayroll={() => setTab("payroll")}
          />
        )}

        {tab === "employees" && (
          <Employees
            employees={filteredEmployees}
            total={employees.length}
            search={search}
            setSearch={setSearch}
            deptFilter={deptFilter}
            setDeptFilter={setDeptFilter}
            statusFilter={statusFilter}
            setStatusFilter={setStatusFilter}
            onAdd={openAdd}
            onEdit={openEdit}
            onToggle={toggleStatus}
            onDelete={(emp) => setConfirmDelete(emp)}
          />
        )}

        {tab === "payroll" && (
          <RunPayroll
            runMonth={runMonth} setRunMonth={setRunMonth}
            runYear={runYear} setRunYear={setRunYear}
            activeEmployees={activeEmployees}
            monthlyGross={monthlyPayroll}
            monthlyNet={monthlyNet}
            onRun={runPayroll}
            busy={runBusy}
            message={runMsg}
          />
        )}

        {tab === "history" && (
          <History
            runs={runs}
            selectedRun={selectedRun}
            setSelectedRunId={setSelectedRunId}
            onOpenPayslip={openPayslip}
          />
        )}
      </div>

      {modal === "edit" && (
        <EmployeeModal
          form={form}
          setForm={setForm}
          errors={formErrors}
          onCancel={closeModal}
          onSave={saveEmployee}
        />
      )}

      {confirmDelete && (
        <ConfirmModal
          title="Remove employee?"
          body={`This removes ${confirmDelete.name} from your employee list. Past payslips already generated are not affected.`}
          confirmLabel="Remove"
          onCancel={() => setConfirmDelete(null)}
          onConfirm={() => deleteEmployee(confirmDelete.id)}
        />
      )}

      {payslipView && (
        <PayslipModal data={payslipView} onClose={() => setPayslipView(null)} />
      )}

      {toast && (
        <div style={{
          position: "absolute", bottom: 18, right: 18, background: toast.kind === "error" ? COLORS.red : COLORS.ink,
          color: "#fff", padding: "10px 16px", borderRadius: 8, fontSize: 13, fontWeight: 500, boxShadow: "0 4px 14px rgba(0,0,0,0.18)",
        }}>
          {toast.text}
        </div>
      )}
    </div>
  );
}

function StatCard({ label, value, sub }) {
  return (
    <div className="pr-card">
      <div className="pr-label">{label}</div>
      <div className="pr-mono" style={{ fontSize: 22, fontWeight: 600, marginTop: 4 }}>{value}</div>
      {sub && <div style={{ fontSize: 12, color: COLORS.textMuted, marginTop: 4 }}>{sub}</div>}
    </div>
  );
}

function Dashboard({ employees, activeEmployees, monthlyPayroll, monthlyNet, deptBreakdown, maxDept, runs, onGoEmployees, onGoPayroll }) {
  const lastRun = runs[0];
  return (
    <div>
      <PageHeader title="Dashboard" subtitle="A snapshot of your payroll, right now." />
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0,1fr))", gap: 14, marginBottom: 22 }}>
        <StatCard label="Active employees" value={activeEmployees.length} sub={`${employees.length} total on file`} />
        <StatCard label="Monthly gross payroll" value={currency(monthlyPayroll)} />
        <StatCard label="Monthly net payroll" value={currency(monthlyNet)} sub="After deductions" />
        <StatCard label="Last payroll run" value={lastRun ? `${lastRun.month.slice(0,3)} ${lastRun.year}` : "None yet"} sub={lastRun ? `${lastRun.employeeCount} payslips` : "Run your first payroll"} />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1.3fr 1fr", gap: 16 }}>
        <div className="pr-card">
          <div style={{ fontFamily: "'Space Grotesk',sans-serif", fontWeight: 600, fontSize: 14, marginBottom: 12 }}>Gross payroll by department</div>
          {deptBreakdown.length === 0 && (
            <div style={{ fontSize: 13, color: COLORS.textMuted }}>Add active employees to see a breakdown.</div>
          )}
          {deptBreakdown.map(([dept, amt]) => (
            <div key={dept} style={{ marginBottom: 10 }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 4 }}>
                <span>{dept}</span>
                <span className="pr-mono" style={{ color: COLORS.textMuted }}>{currency(amt)}</span>
              </div>
              <div style={{ height: 6, background: COLORS.line + "77", borderRadius: 4 }}>
                <div style={{ height: 6, width: `${(amt / maxDept) * 100}%`, background: COLORS.gold, borderRadius: 4 }} />
              </div>
            </div>
          ))}
        </div>

        <div className="pr-card">
          <div style={{ fontFamily: "'Space Grotesk',sans-serif", fontWeight: 600, fontSize: 14, marginBottom: 12 }}>Quick actions</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <button className="pr-btn pr-btn-primary" onClick={onGoEmployees}>Add an employee</button>
            <button className="pr-btn" onClick={onGoPayroll}>Run this month's payroll</button>
          </div>
          <div style={{ marginTop: 18, fontSize: 12, color: COLORS.textMuted, lineHeight: 1.6 }}>
            Payroll data is stored privately to your account and stays available across visits.
          </div>
        </div>
      </div>
    </div>
  );
}

function PageHeader({ title, subtitle, right }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 18 }}>
      <div>
        <div style={{ fontFamily: "'Space Grotesk',sans-serif", fontWeight: 700, fontSize: 21 }}>{title}</div>
        {subtitle && <div style={{ fontSize: 13, color: COLORS.textMuted, marginTop: 2 }}>{subtitle}</div>}
      </div>
      {right}
    </div>
  );
}

function StatusBadge({ status }) {
  const ok = status === "active";
  return (
    <span className="pr-badge" style={{ background: ok ? COLORS.greenBg : "#00000010", color: ok ? COLORS.green : COLORS.textMuted }}>
      {ok ? "Active" : "Inactive"}
    </span>
  );
}

function Employees({ employees, total, search, setSearch, deptFilter, setDeptFilter, statusFilter, setStatusFilter, onAdd, onEdit, onToggle, onDelete }) {
  return (
    <div>
      <PageHeader
        title="Employees"
        subtitle={`${total} employee${total === 1 ? "" : "s"} on file`}
        right={<button className="pr-btn pr-btn-primary" onClick={onAdd}>Add employee</button>}
      />
      <div style={{ display: "flex", gap: 10, marginBottom: 14 }}>
        <input className="pr-input" style={{ maxWidth: 260 }} placeholder="Search by name, ID, or role" value={search} onChange={(e) => setSearch(e.target.value)} />
        <select className="pr-select" style={{ maxWidth: 180 }} value={deptFilter} onChange={(e) => setDeptFilter(e.target.value)}>
          <option value="all">All departments</option>
          {DEPARTMENTS.map((d) => <option key={d} value={d}>{d}</option>)}
        </select>
        <select className="pr-select" style={{ maxWidth: 150 }} value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
          <option value="all">All statuses</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
        </select>
      </div>

      <div className="pr-card" style={{ padding: 0, overflow: "hidden" }}>
        {employees.length === 0 ? (
          <div style={{ padding: 28, textAlign: "center", color: COLORS.textMuted, fontSize: 13 }}>
            No employees match. Try a different search, or add your first employee.
          </div>
        ) : (
          <table className="pr-table" style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                <th>Employee</th><th>ID</th><th>Department</th><th>Designation</th>
                <th style={{ textAlign: "right" }}>Gross / mo</th><th style={{ textAlign: "right" }}>Net / mo</th>
                <th>Status</th><th></th>
              </tr>
            </thead>
            <tbody>
              {employees.map((e) => {
                const pay = computePay(e);
                return (
                  <tr key={e.id}>
                    <td>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <div style={{ width: 26, height: 26, borderRadius: "50%", background: COLORS.gold + "26", color: COLORS.goldDeep, fontSize: 11, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center" }}>
                          {initials(e.name || "?")}
                        </div>
                        <span style={{ fontWeight: 500 }}>{e.name}</span>
                      </div>
                    </td>
                    <td className="pr-mono">{e.empCode}</td>
                    <td>{e.department}</td>
                    <td>{e.designation}</td>
                    <td className="pr-mono" style={{ textAlign: "right" }}>{currency(pay.gross)}</td>
                    <td className="pr-mono" style={{ textAlign: "right" }}>{currency(pay.net)}</td>
                    <td><StatusBadge status={e.status} /></td>
                    <td>
                      <div style={{ display: "flex", gap: 6, justifyContent: "flex-end" }}>
                        <button className="pr-btn" style={{ padding: "5px 9px" }} onClick={() => onEdit(e)}>Edit</button>
                        <button className="pr-btn" style={{ padding: "5px 9px" }} onClick={() => onToggle(e)}>{e.status === "active" ? "Deactivate" : "Activate"}</button>
                        <button className="pr-btn pr-btn-danger" style={{ padding: "5px 9px" }} onClick={() => onDelete(e)}>Remove</button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

function EmployeeModal({ form, setForm, errors, onCancel, onSave }) {
  function set(field, value) {
    setForm({ ...form, [field]: value });
  }
  const pay = computePay(form);
  return (
    <ModalShell onCancel={onCancel} width={640}>
      <div style={{ fontFamily: "'Space Grotesk',sans-serif", fontWeight: 700, fontSize: 17, marginBottom: 16 }}>
        {form.name || form.empCode ? "Edit employee" : "Add employee"}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <Field label="Full name" error={errors.name}>
          <input className="pr-input" value={form.name} onChange={(e) => set("name", e.target.value)} placeholder="Jordan Lee" />
        </Field>
        <Field label="Employee ID" error={errors.empCode}>
          <input className="pr-input" value={form.empCode} onChange={(e) => set("empCode", e.target.value)} placeholder="EMP-1042" />
        </Field>
        <Field label="Email" error={errors.email}>
          <input className="pr-input" value={form.email} onChange={(e) => set("email", e.target.value)} placeholder="jordan@company.com" />
        </Field>
        <Field label="Portal password">
          <input className="pr-input" value={form.password} onChange={(e) => set("password", e.target.value)} placeholder="Defaults to employee ID" />
        </Field>
        <Field label="Designation" error={errors.designation}>
          <input className="pr-input" value={form.designation} onChange={(e) => set("designation", e.target.value)} placeholder="Senior engineer" />
        </Field>
        <Field label="Department">
          <select className="pr-select" value={form.department} onChange={(e) => set("department", e.target.value)}>
            {DEPARTMENTS.map((d) => <option key={d} value={d}>{d}</option>)}
          </select>
        </Field>
        <Field label="Join date">
          <input type="date" className="pr-input" value={form.joinDate} onChange={(e) => set("joinDate", e.target.value)} />
        </Field>

        <div style={{ gridColumn: "1 / -1", borderTop: `1px solid ${COLORS.line}`, marginTop: 4, paddingTop: 12, fontSize: 12, fontWeight: 600, color: COLORS.textMuted, textTransform: "uppercase", letterSpacing: "0.04em" }}>
          Compensation (monthly)
        </div>

        <Field label="Basic salary ($)" error={errors.basic}>
          <input className="pr-input" type="number" min="0" value={form.basic} onChange={(e) => set("basic", e.target.value)} placeholder="4000" />
        </Field>
        <Field label="HRA ($)" error={errors.hra}>
          <input className="pr-input" type="number" min="0" value={form.hra} onChange={(e) => set("hra", e.target.value)} placeholder="800" />
        </Field>
        <Field label="Other allowances ($)" error={errors.allowances}>
          <input className="pr-input" type="number" min="0" value={form.allowances} onChange={(e) => set("allowances", e.target.value)} placeholder="300" />
        </Field>
        <Field label="Other deductions ($)">
          <input className="pr-input" type="number" min="0" value={form.otherDeductions} onChange={(e) => set("otherDeductions", e.target.value)} placeholder="0" />
        </Field>
        <Field label="Provident fund (%)" error={errors.pfPercent}>
          <input className="pr-input" type="number" min="0" max="100" value={form.pfPercent} onChange={(e) => set("pfPercent", e.target.value)} />
        </Field>
        <Field label="Tax withholding (%)" error={errors.taxPercent}>
          <input className="pr-input" type="number" min="0" max="100" value={form.taxPercent} onChange={(e) => set("taxPercent", e.target.value)} />
        </Field>

        <div style={{ gridColumn: "1 / -1", borderTop: `1px solid ${COLORS.line}`, marginTop: 4, paddingTop: 12, fontSize: 12, fontWeight: 600, color: COLORS.textMuted, textTransform: "uppercase", letterSpacing: "0.04em" }}>
          Bank details (optional)
        </div>
        <Field label="Bank name">
          <input className="pr-input" value={form.bankName} onChange={(e) => set("bankName", e.target.value)} placeholder="First National" />
        </Field>
        <Field label="Account number">
          <input className="pr-input" value={form.accountNumber} onChange={(e) => set("accountNumber", e.target.value)} placeholder="••••4821" />
        </Field>
      </div>

      <div className="pr-card" style={{ marginTop: 14, background: COLORS.paper }}>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}>
          <span>Estimated gross / month</span>
          <span className="pr-mono" style={{ fontWeight: 600 }}>{currency(pay.gross)}</span>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginTop: 4, color: COLORS.textMuted }}>
          <span>Estimated deductions</span>
          <span className="pr-mono">{currency(pay.totalDeductions)}</span>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 14, marginTop: 6, fontWeight: 700, borderTop: `1px solid ${COLORS.line}`, paddingTop: 6 }}>
          <span>Estimated net / month</span>
          <span className="pr-mono" style={{ color: COLORS.green }}>{currency(pay.net)}</span>
        </div>
      </div>

      <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 18 }}>
        <button className="pr-btn" onClick={onCancel}>Cancel</button>
        <button className="pr-btn pr-btn-primary" onClick={onSave}>Save employee</button>
      </div>
    </ModalShell>
  );
}

function Field({ label, error, children }) {
  return (
    <div>
      <label className="pr-label">{label}</label>
      {children}
      {error && <div style={{ fontSize: 12, color: COLORS.red, marginTop: 3 }}>{error}</div>}
    </div>
  );
}

function ModalShell({ children, onCancel, width = 480 }) {
  return (
    <div style={{ position: "absolute", inset: 0, background: "rgba(20,20,18,0.45)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 20, padding: 20 }} onClick={onCancel}>
      <div
        style={{ background: "#fff", borderRadius: 12, padding: 22, width, maxWidth: "100%", maxHeight: "90%", overflow: "auto", boxShadow: "0 12px 32px rgba(0,0,0,0.22)" }}
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  );
}

function ConfirmModal({ title, body, confirmLabel, onCancel, onConfirm }) {
  return (
    <ModalShell onCancel={onCancel} width={380}>
      <div style={{ fontFamily: "'Space Grotesk',sans-serif", fontWeight: 700, fontSize: 16, marginBottom: 8 }}>{title}</div>
      <div style={{ fontSize: 13, color: COLORS.textMuted, lineHeight: 1.5 }}>{body}</div>
      <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 18 }}>
        <button className="pr-btn" onClick={onCancel}>Cancel</button>
        <button className="pr-btn pr-btn-danger" onClick={onConfirm}>{confirmLabel}</button>
      </div>
    </ModalShell>
  );
}

function RunPayroll({ runMonth, setRunMonth, runYear, setRunYear, activeEmployees, monthlyGross, monthlyNet, onRun, busy, message }) {
  const years = [];
  const cy = new Date().getFullYear();
  for (let y = cy - 1; y <= cy + 1; y++) years.push(String(y));
  return (
    <div>
      <PageHeader title="Run payroll" subtitle="Generate payslips for all active employees for a given month." />
      <div className="pr-card" style={{ maxWidth: 520 }}>
        <div style={{ display: "flex", gap: 10 }}>
          <Field label="Month">
            <select className="pr-select" value={runMonth} onChange={(e) => setRunMonth(e.target.value)}>
              {MONTHS.map((m) => <option key={m} value={m}>{m}</option>)}
            </select>
          </Field>
          <Field label="Year">
            <select className="pr-select" value={runYear} onChange={(e) => setRunYear(e.target.value)}>
              {years.map((y) => <option key={y} value={y}>{y}</option>)}
            </select>
          </Field>
        </div>

        <div style={{ marginTop: 14, borderTop: `1px solid ${COLORS.line}`, paddingTop: 12 }}>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 6 }}>
            <span>Active employees included</span>
            <span className="pr-mono" style={{ fontWeight: 600 }}>{activeEmployees.length}</span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 6 }}>
            <span>Total gross payout</span>
            <span className="pr-mono" style={{ fontWeight: 600 }}>{currency(monthlyGross)}</span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}>
            <span>Total net payout</span>
            <span className="pr-mono" style={{ fontWeight: 700, color: COLORS.green }}>{currency(monthlyNet)}</span>
          </div>
        </div>

        <button className="pr-btn pr-btn-primary" style={{ marginTop: 16, width: "100%" }} onClick={onRun} disabled={busy}>
          {busy ? "Running payroll…" : `Run payroll for ${runMonth} ${runYear}`}
        </button>
        {message && (
          <div style={{ marginTop: 10, fontSize: 13, color: message.includes("already") || message.includes("No active") ? COLORS.amber : COLORS.green }}>
            {message}
          </div>
        )}
      </div>
    </div>
  );
}

function History({ runs, selectedRun, setSelectedRunId, onOpenPayslip }) {
  if (runs.length === 0) {
    return (
      <div>
        <PageHeader title="Payslip history" subtitle="Every payroll run you've completed." />
        <div className="pr-card" style={{ textAlign: "center", color: COLORS.textMuted, padding: 32 }}>
          No payroll runs yet. Head to "Run payroll" to generate your first payslips.
        </div>
      </div>
    );
  }
  return (
    <div>
      <PageHeader title="Payslip history" subtitle="Every payroll run you've completed." />
      <div style={{ display: "grid", gridTemplateColumns: "220px 1fr", gap: 16 }}>
        <div className="pr-card" style={{ padding: 8, maxHeight: 560, overflow: "auto" }}>
          {runs.map((r) => (
            <div
              key={r.id}
              onClick={() => setSelectedRunId(r.id)}
              style={{
                padding: "10px 10px", borderRadius: 8, cursor: "pointer", marginBottom: 4,
                background: selectedRun && selectedRun.id === r.id ? COLORS.paper : "transparent",
                border: selectedRun && selectedRun.id === r.id ? `1px solid ${COLORS.line}` : "1px solid transparent",
              }}
            >
              <div style={{ fontWeight: 600, fontSize: 13 }}>{r.month} {r.year}</div>
              <div style={{ fontSize: 12, color: COLORS.textMuted }}>{r.employeeCount} payslips · {currency(r.totalNet)}</div>
            </div>
          ))}
        </div>

        {selectedRun && (
          <div className="pr-card" style={{ padding: 0, overflow: "hidden" }}>
            <div style={{ padding: "14px 16px", borderBottom: `1px solid ${COLORS.line}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <div style={{ fontFamily: "'Space Grotesk',sans-serif", fontWeight: 700, fontSize: 15 }}>{selectedRun.month} {selectedRun.year}</div>
                <div style={{ fontSize: 12, color: COLORS.textMuted }}>Run on {selectedRun.runDate}</div>
              </div>
              <div style={{ display: "flex", gap: 18, fontSize: 12 }} className="pr-mono">
                <div><div className="pr-label">Gross</div>{currency(selectedRun.totalGross)}</div>
                <div><div className="pr-label">Deductions</div>{currency(selectedRun.totalDeductions)}</div>
                <div><div className="pr-label">Net</div><span style={{ color: COLORS.green, fontWeight: 700 }}>{currency(selectedRun.totalNet)}</span></div>
              </div>
            </div>
            <table className="pr-table" style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr><th>Employee</th><th>Department</th><th style={{ textAlign: "right" }}>Gross</th><th style={{ textAlign: "right" }}>Net</th><th></th></tr>
              </thead>
              <tbody>
                {selectedRun.records.map((r) => (
                  <tr key={r.employeeId}>
                    <td>{r.name}</td>
                    <td>{r.department}</td>
                    <td className="pr-mono" style={{ textAlign: "right" }}>{currency(r.gross)}</td>
                    <td className="pr-mono" style={{ textAlign: "right" }}>{currency(r.net)}</td>
                    <td style={{ textAlign: "right" }}>
                      <button className="pr-btn" style={{ padding: "4px 9px" }} onClick={() => onOpenPayslip(selectedRun, r)}>View payslip</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function PayslipModal({ data, onClose }) {
  const { run, record } = data;
  return (
    <ModalShell onCancel={onClose} width={460}>
      <div style={{ border: `1px dashed ${COLORS.line}`, borderRadius: 10, padding: 20 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 14 }}>
          <div>
            <div style={{ fontFamily: "'Space Grotesk',sans-serif", fontWeight: 700, fontSize: 16 }}>Payslip</div>
            <div style={{ fontSize: 12, color: COLORS.textMuted }}>{run.month} {run.year}</div>
          </div>
          <div className="pr-mono" style={{ fontSize: 11, color: COLORS.textMuted, textAlign: "right" }}>
            {record.empCode}<br />Issued {run.runDate}
          </div>
        </div>

        <div style={{ marginBottom: 14 }}>
          <div style={{ fontWeight: 600, fontSize: 14 }}>{record.name}</div>
          <div style={{ fontSize: 12, color: COLORS.textMuted }}>{record.designation} · {record.department}</div>
        </div>

        <Row label="Basic salary" value={record.basic} />
        <Row label="HRA" value={record.hra} />
        <Row label="Other allowances" value={record.allowances} />
        <div style={{ borderTop: `1px solid ${COLORS.line}`, margin: "8px 0" }} />
        <Row label="Gross earnings" value={record.gross} bold />
        <div style={{ height: 8 }} />
        <Row label="Provident fund" value={-record.pf} muted />
        <Row label="Tax withheld" value={-record.tax} muted />
        {record.otherDeductions > 0 && <Row label="Other deductions" value={-record.otherDeductions} muted />}
        <div style={{ borderTop: `1px solid ${COLORS.line}`, margin: "8px 0" }} />
        <Row label="Total deductions" value={-record.totalDeductions} bold />

        <div style={{ background: COLORS.greenBg, borderRadius: 8, padding: "10px 12px", marginTop: 14, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ fontWeight: 600, fontSize: 13, color: COLORS.green }}>Net pay</span>
          <span className="pr-mono" style={{ fontWeight: 700, fontSize: 17, color: COLORS.green }}>{currency(record.net)}</span>
        </div>
      </div>
      <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 16 }}>
        <button className="pr-btn" onClick={onClose}>Close</button>
      </div>
    </ModalShell>
  );
}

function Row({ label, value, bold, muted }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, padding: "3px 0" }}>
      <span style={{ color: muted ? COLORS.textMuted : COLORS.ink, fontWeight: bold ? 700 : 400 }}>{label}</span>
      <span className="pr-mono" style={{ fontWeight: bold ? 700 : 500, color: muted ? COLORS.red : COLORS.ink }}>
        {value < 0 ? "-" : ""}{currency(Math.abs(value))}
      </span>
    </div>
  );
}
