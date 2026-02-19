import { useState, useEffect, useRef, useCallback } from "react";
import { Sun, Moon, Mail, ArrowRight, ChevronDown, Zap, Link2, Code2, Users, Inbox, FileSearch, ShieldCheck, Send, X, Loader2 } from "lucide-react";

// ─── Theme ───────────────────────────────────────────────────────────────────
const light = {
  bg: "bg-white",
  bgAlt: "bg-slate-50",
  text: "text-slate-900",
  secondary: "text-slate-600",
  muted: "text-slate-400",
  border: "border-slate-200",
  card: "bg-white border-slate-200",
  cardHover: "hover:border-[#4F63A4]/40 hover:shadow-lg",
  nav: "bg-white/80 border-slate-200",
  pill: "bg-slate-100 text-slate-600",
  input: "bg-white border-slate-300 text-slate-900 placeholder-slate-400",
  flowBox: "bg-white border-slate-200",
  flowBoxHighlight: "bg-[#4F63A4]/5 border-[#4F63A4]/30",
  spotlightBg: "bg-gradient-to-br from-[#4F63A4]/5 to-[#4F63A4]/10 border-[#4F63A4]/20",
  stepNum: "bg-[#4F63A4]/10 text-[#4F63A4]",
};
const dark = {
  bg: "bg-[#0B1120]",
  bgAlt: "bg-[#0F172A]",
  text: "text-slate-100",
  secondary: "text-slate-400",
  muted: "text-slate-500",
  border: "border-slate-800",
  card: "bg-[#111B33] border-slate-700/50",
  cardHover: "hover:border-[#4F63A4]/40 hover:shadow-lg hover:shadow-[#4F63A4]/5",
  nav: "bg-[#0B1120]/80 border-slate-800",
  pill: "bg-slate-800 text-slate-400",
  input: "bg-[#111B33] border-slate-700 text-slate-100 placeholder-slate-500",
  flowBox: "bg-[#111B33] border-slate-700/50",
  flowBoxHighlight: "bg-[#4F63A4]/10 border-[#4F63A4]/30",
  spotlightBg: "bg-gradient-to-br from-[#4F63A4]/10 to-[#4F63A4]/5 border-[#4F63A4]/20",
  stepNum: "bg-[#4F63A4]/15 text-[#4F63A4]",
};

// ─── Scroll reveal hook ──────────────────────────────────────────────────────
function useReveal() {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { setVisible(true); observer.disconnect(); } },
      { threshold: 0.15 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  return { ref, visible };
}

function Reveal({ children, delay = 0, className = "" }: { children: React.ReactNode; delay?: number; className?: string }) {
  const { ref, visible } = useReveal();
  return (
    <div
      ref={ref}
      className={`transition-all duration-700 ${className}`}
      style={{
        transitionDelay: `${delay}ms`,
        opacity: visible ? 1 : 0,
        transform: visible ? "translateY(0)" : "translateY(24px)",
      }}
    >
      {children}
    </div>
  );
}

// ─── Main component ──────────────────────────────────────────────────────────
export default function ComingSoon() {
  const [isDark, setIsDark] = useState(true);
  const [contactOpen, setContactOpen] = useState(false);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [formData, setFormData] = useState({ name: "", email: "", message: "" });
  const t = isDark ? dark : light;

  useEffect(() => {
    if (isDark) {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  }, [isDark]);

  const handleContact = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    setSending(true);
    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });
      if (res.ok) {
        setSent(true);
        setFormData({ name: "", email: "", message: "" });
      }
    } catch {
      // fail silently for now
    } finally {
      setSending(false);
    }
  }, [formData]);

  const scrollTo = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
  };

  // ── Features data ────────────────────────────────────────────────────────
  const features = [
    {
      icon: Zap,
      title: "Instant time to value",
      desc: "No lengthy implementation projects. Configure a new intake process in minutes — define your workflow, set up an email inbox, and start receiving structured data. Works across any team or department.",
    },
    {
      icon: Link2,
      title: "Interoperable",
      desc: "Connects to all modern tools via REST API. extrapl doesn't replace your systems — it feeds them. Data extracted today flows into the tools your teams already use.",
    },
    {
      icon: Code2,
      title: "Extensible",
      desc: "Build your own extraction logic, validation rules, and workflows on top of the platform. Code-based tools let you handle edge cases specific to your industry or process.",
    },
    {
      icon: Users,
      title: "Easy to use",
      desc: "Intuitive interface that teams can pick up immediately — no lengthy training programs or change management required. Users review and validate AI-extracted data, not learn a new system.",
    },
  ];

  const steps = [
    { n: "1", title: "Receive", desc: "Documents arrive via dedicated email inboxes or direct upload. Any format.", icon: Inbox },
    { n: "2", title: "Extract", desc: "AI reads every document — text, scanned, handwritten — and pulls structured data.", icon: FileSearch },
    { n: "3", title: "Validate", desc: "Extracted data is cross-checked against your knowledge base and business rules.", icon: ShieldCheck },
    { n: "4", title: "Deliver", desc: "Clean data flows into your workflow. Teams see status, take action, move on.", icon: Send },
  ];

  const useCases = [
    { title: "Vendor Onboarding", desc: "Collect compliance docs, extract certifications, validate against requirements." },
    { title: "Tender Submissions", desc: "Receive bids via email, extract pricing and specs, compare across vendors." },
    { title: "Client Applications", desc: "Process application forms, verify identity documents, route for approval." },
  ];

  const spotlightBullets = [
    "Auto-reply validates document completeness",
    "Policy numbers matched against database",
    "Status chain tracks each claim through workflow",
    "Configurable per claim type — no code changes needed",
  ];

  return (
    <div className={`min-h-screen ${t.bg} ${t.text} transition-colors duration-500`}>
      {/* ─── Navigation ──────────────────────────────────────────────────── */}
      <nav className={`fixed top-0 inset-x-0 z-50 backdrop-blur-md ${t.nav} border-b transition-colors duration-500`}>
        <div className="max-w-6xl mx-auto flex items-center justify-between px-6 h-16">
          <div className="flex items-center gap-1.5 cursor-pointer" onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}>
            <span className="text-xl font-bold tracking-tight">extrapl</span>
            <div className="w-2 h-2 rounded-full bg-[#4F63A4] mt-0.5" />
          </div>
          <div className="flex items-center gap-6">
            <button onClick={() => scrollTo("how")} className={`text-sm font-medium ${t.secondary} hover:${t.text} transition-colors hidden sm:inline`}>Workflow</button>
            <button onClick={() => scrollTo("features")} className={`text-sm font-medium ${t.secondary} hover:${t.text} transition-colors hidden sm:inline`}>Features</button>
            <button onClick={() => scrollTo("uc-main")} className={`text-sm font-medium ${t.secondary} hover:${t.text} transition-colors hidden sm:inline`}>Use Cases</button>
            <button
              onClick={() => setIsDark(!isDark)}
              className={`p-2 rounded-full transition-all duration-300 ${isDark ? "bg-slate-800/60 hover:bg-slate-700 text-amber-400" : "bg-slate-100 hover:bg-slate-200 text-slate-600"}`}
              aria-label="Toggle theme"
            >
              {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>
          </div>
        </div>
      </nav>

      {/* ─── Hero ────────────────────────────────────────────────────────── */}
      <section className="min-h-screen flex flex-col items-center justify-center px-6 pt-16">
        <div className="text-center max-w-3xl mx-auto">
          <Reveal>
            <div className="flex items-center justify-center gap-2 mb-3">
              <span className="text-6xl sm:text-7xl md:text-8xl font-bold tracking-tight">extrapl</span>
              <div className="w-3 h-3 md:w-4 md:h-4 rounded-full bg-[#4F63A4] mt-2 md:mt-3" />
            </div>
            <p className={`text-lg sm:text-xl md:text-2xl font-light mt-3 ${t.secondary}`}>
              seamless data intake
            </p>
          </Reveal>

          <Reveal delay={200}>
            <div className="flex items-center justify-center gap-3 sm:gap-5 mb-10 mt-6">
              {["Intake", "Analysis", "Output"].map((label) => (
                <div key={label} className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs sm:text-sm font-medium ${t.pill}`}>
                  <div className="w-1.5 h-1.5 rounded-full bg-[#4F63A4]" />
                  {label}
                </div>
              ))}
            </div>
          </Reveal>

          <Reveal delay={350}>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3 mt-4">
              <button
                onClick={() => setContactOpen(true)}
                className="inline-flex items-center gap-2 px-6 py-3 rounded-lg bg-[#4F63A4] text-white font-medium hover:bg-[#3D4F8A] transition-colors text-sm"
              >
                <Mail className="w-4 h-4" />
                Contact Us
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => scrollTo("how")}
                className={`inline-flex items-center gap-2 px-6 py-3 rounded-lg border font-medium transition-colors text-sm ${t.border} ${t.secondary} hover:border-[#4F63A4]/50`}
              >
                See How It Works
              </button>
            </div>
          </Reveal>
        </div>

        <button
          onClick={() => scrollTo("how")}
          className={`absolute bottom-10 animate-bounce ${t.muted}`}
          aria-label="Scroll down"
        >
          <ChevronDown className="w-6 h-6" />
        </button>
      </section>

      {/* ─── How It Works ────────────────────────────────────────────────── */}
      <section id="how" className={`py-24 px-6 ${t.bgAlt} transition-colors duration-500`}>
        <div className="max-w-6xl mx-auto">
          <Reveal>
            <div className="mb-16">
              <span className={`text-xs font-semibold tracking-widest uppercase ${t.muted}`}>How It Works</span>
              <h2 className="text-3xl sm:text-4xl font-bold mt-3">
                A translation layer between incoming data and your systems.
              </h2>
              <p className={`mt-4 text-lg max-w-2xl ${t.secondary}`}>
                Data comes in messy. extrapl delivers it structured — ready for your systems, your teams, your decisions.
              </p>
            </div>
          </Reveal>

          {/* Flow diagram */}
          <Reveal delay={150}>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6 mb-20 items-stretch">
              {/* External Parties */}
              <div className={`rounded-xl border p-6 text-center ${t.flowBox} transition-colors duration-500`}>
                <div className={`inline-flex items-center justify-center w-12 h-12 rounded-full mb-4 ${t.stepNum}`}>
                  <Inbox className="w-5 h-5" />
                </div>
                <h3 className="font-semibold text-lg mb-2">External Parties</h3>
                <p className={`text-sm ${t.secondary}`}>
                  Clients, vendors, and partners send documents via email or upload — PDFs, spreadsheets, images, scans.
                </p>
              </div>

              {/* extrapl (center) */}
              <div className={`rounded-xl border p-6 text-center ${t.flowBoxHighlight} transition-colors duration-500 relative`}>
                <div className="inline-flex items-center justify-center w-12 h-12 rounded-full mb-4 bg-[#4F63A4]/20 text-[#4F63A4]">
                  <FileSearch className="w-5 h-5" />
                </div>
                <div className="flex items-center justify-center gap-1.5 mb-2">
                  <h3 className="font-semibold text-lg">extrapl</h3>
                  <div className="w-2 h-2 rounded-full bg-[#4F63A4]" />
                </div>
                <p className={`text-sm ${t.secondary}`}>
                  AI-powered extraction, validation, and routing — configurable per process, no code required.
                </p>
                {/* Arrows (desktop only) */}
                <div className="hidden md:block absolute left-0 top-1/2 -translate-x-full -translate-y-1/2 px-2">
                  <ArrowRight className={`w-5 h-5 ${t.muted}`} />
                </div>
                <div className="hidden md:block absolute right-0 top-1/2 translate-x-full -translate-y-1/2 px-2">
                  <ArrowRight className={`w-5 h-5 ${t.muted}`} />
                </div>
              </div>

              {/* Your Organization */}
              <div className={`rounded-xl border p-6 text-center ${t.flowBox} transition-colors duration-500`}>
                <div className={`inline-flex items-center justify-center w-12 h-12 rounded-full mb-4 ${t.stepNum}`}>
                  <Send className="w-5 h-5" />
                </div>
                <h3 className="font-semibold text-lg mb-2">Your Organization</h3>
                <p className={`text-sm ${t.secondary}`}>
                  Clean, structured data flows into your existing systems, databases, and team workflows — instantly.
                </p>
              </div>
            </div>
          </Reveal>

          {/* 4 Steps */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {steps.map((step, i) => (
              <Reveal key={step.n} delay={i * 100}>
                <div className={`rounded-xl border p-6 ${t.card} ${t.cardHover} transition-all duration-300 h-full`}>
                  <div className={`inline-flex items-center justify-center w-10 h-10 rounded-lg mb-4 text-sm font-bold ${t.stepNum}`}>
                    {step.n}
                  </div>
                  <h3 className="font-semibold text-lg mb-2">{step.title}</h3>
                  <p className={`text-sm ${t.secondary}`}>{step.desc}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ─── Features ────────────────────────────────────────────────────── */}
      <section id="features" className={`py-24 px-6 ${t.bg} transition-colors duration-500`}>
        <div className="max-w-6xl mx-auto">
          <Reveal>
            <div className="text-center mb-16">
              <span className={`text-xs font-semibold tracking-widest uppercase ${t.muted}`}>Features</span>
              <h2 className="text-3xl sm:text-4xl font-bold mt-3">
                Built for real-world intake complexity.
              </h2>
            </div>
          </Reveal>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {features.map((f, i) => (
              <Reveal key={f.title} delay={i * 100}>
                <div className={`rounded-xl border p-8 ${t.card} ${t.cardHover} transition-all duration-300 h-full`}>
                  <div className={`inline-flex items-center justify-center w-12 h-12 rounded-xl mb-5 ${t.stepNum}`}>
                    <f.icon className="w-5 h-5" />
                  </div>
                  <h3 className="font-semibold text-xl mb-3">{f.title}</h3>
                  <p className={`text-sm leading-relaxed ${t.secondary}`}>{f.desc}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ─── Use Cases ───────────────────────────────────────────────────── */}
      <section id="uc-main" className={`py-24 px-6 ${t.bgAlt} transition-colors duration-500`}>
        <div className="max-w-6xl mx-auto">
          <Reveal>
            <div className="text-center mb-16">
              <span className={`text-xs font-semibold tracking-widest uppercase ${t.muted}`}>Use Cases</span>
              <h2 className="text-3xl sm:text-4xl font-bold mt-3">
                extrapl works for any process where external data needs to flow into internal systems.
              </h2>
            </div>
          </Reveal>

          {/* Spotlight */}
          <Reveal delay={100}>
            <div className={`rounded-2xl border p-8 md:p-10 mb-10 ${t.spotlightBg} transition-colors duration-500`}>
              <span className={`text-xs font-semibold tracking-widest uppercase ${t.muted}`}>Spotlight</span>
              <h3 className="text-2xl font-bold mt-2 mb-4">Damage Claims Intake</h3>
              <p className={`text-sm leading-relaxed mb-6 max-w-3xl ${t.secondary}`}>
                A claims team receives hundreds of submissions per week — each with different document types, varying completeness, and data that needs to match policy records. Before extrapl, every claim required manual screening, data entry, and follow-up emails.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {spotlightBullets.map((bullet) => (
                  <div key={bullet} className="flex items-start gap-3">
                    <div className="w-1.5 h-1.5 rounded-full bg-[#4F63A4] mt-2 flex-shrink-0" />
                    <span className={`text-sm ${t.secondary}`}>{bullet}</span>
                  </div>
                ))}
              </div>
            </div>
          </Reveal>

          {/* Use case cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {useCases.map((uc, i) => (
              <Reveal key={uc.title} delay={i * 100}>
                <div className={`rounded-xl border p-6 ${t.card} ${t.cardHover} transition-all duration-300 h-full`}>
                  <h3 className="font-semibold text-lg mb-3">{uc.title}</h3>
                  <p className={`text-sm ${t.secondary}`}>{uc.desc}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ─── CTA ─────────────────────────────────────────────────────────── */}
      <section className={`py-24 px-6 ${t.bg} transition-colors duration-500`}>
        <div className="max-w-3xl mx-auto text-center">
          <Reveal>
            <h2 className="text-3xl sm:text-4xl font-bold mb-4">Let your data flow.</h2>
            <p className={`text-lg mb-8 ${t.secondary}`}>
              Stop manually translating documents into your systems. extrapl handles the intake — you handle the decisions.
            </p>
            <button
              onClick={() => setContactOpen(true)}
              className="inline-flex items-center gap-2 px-8 py-3.5 rounded-lg bg-[#4F63A4] text-white font-medium hover:bg-[#3D4F8A] transition-colors group"
            >
              <Mail className="w-4 h-4" />
              Contact Us
              <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
            </button>
          </Reveal>
        </div>
      </section>

      {/* ─── Footer ──────────────────────────────────────────────────────── */}
      <footer className={`py-8 px-6 border-t ${t.border} ${t.bg} transition-colors duration-500`}>
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <span className="text-sm font-semibold">extrapl</span>
            <div className="w-1.5 h-1.5 rounded-full bg-[#4F63A4]" />
          </div>
          <span className={`text-xs ${t.muted}`}>&copy; {new Date().getFullYear()} extrapl. All rights reserved.</span>
        </div>
      </footer>

      {/* ─── Floating Contact Button ─────────────────────────────────────── */}
      <button
        onClick={() => { setContactOpen(true); setSent(false); }}
        className="fixed bottom-6 right-6 z-40 flex items-center gap-2 px-5 py-3 rounded-full bg-[#4F63A4] text-white font-medium shadow-lg hover:bg-[#3D4F8A] transition-all hover:shadow-xl group"
      >
        <Mail className="w-4 h-4" />
        Contact Us
        <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
      </button>

      {/* ─── Contact Modal ───────────────────────────────────────────────── */}
      {contactOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setContactOpen(false)} />
          <div className={`relative w-full max-w-md rounded-2xl border p-8 shadow-2xl ${isDark ? "bg-[#111B33] border-slate-700" : "bg-white border-slate-200"} transition-colors duration-500`}>
            <button
              onClick={() => setContactOpen(false)}
              className={`absolute top-4 right-4 p-1.5 rounded-full transition-colors ${isDark ? "hover:bg-slate-700 text-slate-400" : "hover:bg-slate-100 text-slate-500"}`}
            >
              <X className="w-4 h-4" />
            </button>

            <div className="flex items-center gap-2 mb-1">
              <h3 className="text-xl font-bold">Get in touch</h3>
              <div className="w-2 h-2 rounded-full bg-[#4F63A4]" />
            </div>
            <p className={`text-sm mb-6 ${t.secondary}`}>We'd love to hear from you.</p>

            {sent ? (
              <div className="text-center py-8">
                <div className="w-12 h-12 mx-auto mb-4 rounded-full bg-green-500/20 flex items-center justify-center">
                  <ShieldCheck className="w-6 h-6 text-green-500" />
                </div>
                <h4 className="font-semibold text-lg mb-2">Message sent!</h4>
                <p className={`text-sm ${t.secondary}`}>We'll get back to you soon.</p>
              </div>
            ) : (
              <form onSubmit={handleContact} className="space-y-4">
                <div>
                  <label className={`text-xs font-medium ${t.secondary} mb-1 block`}>Name</label>
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData((p) => ({ ...p, name: e.target.value }))}
                    placeholder="Your name"
                    className={`w-full px-4 py-2.5 rounded-lg border text-sm transition-colors ${t.input} focus:outline-none focus:ring-2 focus:ring-[#4F63A4]/50 focus:border-[#4F63A4]`}
                  />
                </div>
                <div>
                  <label className={`text-xs font-medium ${t.secondary} mb-1 block`}>Email</label>
                  <input
                    type="email"
                    required
                    value={formData.email}
                    onChange={(e) => setFormData((p) => ({ ...p, email: e.target.value }))}
                    placeholder="you@company.com"
                    className={`w-full px-4 py-2.5 rounded-lg border text-sm transition-colors ${t.input} focus:outline-none focus:ring-2 focus:ring-[#4F63A4]/50 focus:border-[#4F63A4]`}
                  />
                </div>
                <div>
                  <label className={`text-xs font-medium ${t.secondary} mb-1 block`}>Message</label>
                  <textarea
                    required
                    rows={4}
                    value={formData.message}
                    onChange={(e) => setFormData((p) => ({ ...p, message: e.target.value }))}
                    placeholder="Tell us about your use case..."
                    className={`w-full px-4 py-2.5 rounded-lg border text-sm transition-colors resize-none ${t.input} focus:outline-none focus:ring-2 focus:ring-[#4F63A4]/50 focus:border-[#4F63A4]`}
                  />
                </div>
                <button
                  type="submit"
                  disabled={sending}
                  className="w-full flex items-center justify-center gap-2 px-6 py-3 rounded-lg bg-[#4F63A4] text-white font-medium hover:bg-[#3D4F8A] transition-colors disabled:opacity-60"
                >
                  {sending ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Sending...
                    </>
                  ) : (
                    <>
                      <Send className="w-4 h-4" />
                      Send Message
                    </>
                  )}
                </button>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
