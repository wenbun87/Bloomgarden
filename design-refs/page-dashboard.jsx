/* ==========  Dashboard page ========== */

function StatTile({ label, value, icon: IconComp, sprig: SprigComp, onClick }) {
  return (
    <div className="stat" onClick={onClick} style={onClick ? {cursor: "pointer"} : undefined}>
      <div className="stat-label"><IconComp /> {label}</div>
      <div className="stat-value">{value}</div>
      {SprigComp && <div className="stat-sprig">{SprigComp}</div>}
    </div>
  );
}

function DashboardPage({ todos, ideas, scheduled, setPage, toggleTodo, openIdea }) {
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "morning" : hour < 18 ? "afternoon" : "evening";
  const today = new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });
  const openTodos = todos.filter(t => !t.done);
  const recentIdeas = ideas.slice(0, 3);
  const fromIso = window.todayIso ? window.todayIso() : new Date().toISOString().slice(0, 10);
  const upcoming = scheduled
    .filter(s => s.date && s.date >= fromIso)
    .sort((a, b) => a.date.localeCompare(b.date) || (a.time || "").localeCompare(b.time || ""))
    .slice(0, 3);
  const seedCount = ideas.filter(i => i.status === "seed").length;
  const growingCount = ideas.filter(i => i.status === "growing").length;
  const ripeCount = ideas.filter(i => i.status === "ripe").length;

  return (
    <div className="sprout">
      <div className="page-head">
        <div>
          <h1 className="page-title">Good <em>{greeting}</em>, Wen.</h1>
          <div className="page-sub">
            <span>{today}</span>
            <span className="dot" />
            <span className="italic">{ripeCount} {ripeCount === 1 ? "idea is" : "ideas are"} ripe for picking</span>
            <span className="dot" />
            <span>🌤 22°C</span>
          </div>
        </div>
        <div className="row">
          <button className="btn"><Icon.Search /> Search</button>
          <button className="btn btn-primary" onClick={() => setPage("ideas")}>
            <Icon.Plus /> Plant an idea
          </button>
        </div>
      </div>

      <div className="stats">
        <StatTile label="Seeds" value={seedCount} icon={Icon.Idea} sprig={<Sprig.Star size={56} color="var(--line)" style={{opacity: 0.6}} />} onClick={() => setPage("ideas")} />
        <StatTile label="Growing" value={growingCount} icon={Icon.Studio} sprig={<Sprig.Leaf size={56} color="currentColor" />} onClick={() => setPage("ideas")} />
        <StatTile label="Ripe" value={ripeCount} icon={Icon.Sparkle} sprig={<Sprig.Sprout size={70} color="currentColor" />} onClick={() => setPage("ideas")} />
        <StatTile label="Scheduled" value={scheduled.length} icon={Icon.Calendar} sprig={<Sprig.Swirl size={56} color="currentColor" />} onClick={() => setPage("calendar")} />
      </div>

      {/* Two-col row: Today + Recent ideas */}
      <div className="dash-row" style={{display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--gap)", marginBottom: "var(--gap)"}}>
        <div className="card">
          <div className="card-head" style={{marginBottom: 12}}>
            <div>
              <div className="card-title">Today's <em>to-dos</em></div>
              <div className="card-sub" style={{marginBottom: 0}}>{openTodos.length} waiting for you</div>
            </div>
            <button className="btn btn-sm btn-ghost" onClick={() => setPage("todos")}>See all</button>
          </div>
          {openTodos.length === 0 ? (
            <div style={{padding: "20px 0", textAlign: "center", color: "var(--ink-soft)", fontSize: 14, fontStyle: "italic"}}>
              All clear. Time to plant something new?
            </div>
          ) : (
            <div className="col" style={{gap: 0}}>
              {openTodos.slice(0, 4).map((t, i) => (
                <label key={t.id} className="row" style={{
                  padding: "10px 4px", gap: 14, cursor: "pointer", borderBottom: "1px dashed var(--line-soft)",
                }}>
                  <Check checked={t.done} onClick={() => toggleTodo(t.id)} />
                  <span style={{
                    flex: 1,
                    minWidth: 0,
                    overflowWrap: "anywhere",
                    textDecoration: t.done ? "line-through" : "none",
                    color: t.done ? "var(--ink-mute)" : "var(--ink)",
                    fontSize: 14,
                  }}>{t.text}</span>
                  <span className="badge badge-soft" style={{flexShrink: 0}}>{t.tag}</span>
                </label>
              ))}
            </div>
          )}
        </div>

        <div className="card">
          <div className="card-head" style={{marginBottom: 12}}>
            <div>
              <div className="card-title">Recent <em>ideas</em></div>
              <div className="card-sub" style={{marginBottom: 0}}>Fresh from the bank</div>
            </div>
            <button className="btn btn-sm btn-ghost" onClick={() => setPage("ideas")}>See all</button>
          </div>
          <div className="col" style={{gap: 10}}>
            {recentIdeas.map(idea => (
              <div key={idea.id} style={{
                padding: "10px 12px", borderRadius: "var(--radius-sm)",
                border: "1px solid var(--line)", background: "var(--bg-elev)",
                cursor: "pointer", transition: "all 0.18s ease",
              }}
              onClick={() => openIdea(idea.id)}
              onMouseEnter={e => e.currentTarget.style.background = "var(--surface)"}
              onMouseLeave={e => e.currentTarget.style.background = "var(--bg-elev)"}
              >
                <div className="row" style={{gap: 8, marginBottom: 4}}>
                  <span className="badge" style={{
                    background: idea.status === "seed" ? "var(--line-soft)" : idea.status === "growing" ? "var(--accent-soft)" : "var(--pop-soft)",
                    color: idea.status === "seed" ? "var(--ink-soft)" : idea.status === "growing" ? "var(--accent-ink)" : "var(--pop)",
                  }}>{idea.status}</span>
                  <span className="small mute">{idea.age}</span>
                </div>
                <div style={{fontWeight: 500, fontSize: 14, marginBottom: 2}}>{idea.title}</div>
                <div className="small mute" style={{lineHeight: 1.5}}>{idea.note}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Upcoming + Quick actions */}
      <div className="dash-row" style={{display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--gap)"}}>
        <div className="card">
          <div className="card-head" style={{marginBottom: 12}}>
            <div>
              <div className="card-title">Upcoming <em>drops</em></div>
              <div className="card-sub" style={{marginBottom: 0}}>Next 7 days</div>
            </div>
            <button className="btn btn-sm btn-ghost" onClick={() => setPage("calendar")}>Calendar</button>
          </div>
          {upcoming.length === 0 ? (
            <div style={{padding: "20px 0", textAlign: "center", color: "var(--ink-soft)", fontSize: 14, fontStyle: "italic"}}>
              Nothing scheduled yet — head to the Studio to grow something.
            </div>
          ) : (
            <div className="col" style={{gap: 10}}>
              {upcoming.map(s => {
                const meta = platformMeta[s.platform];
                const Pi = meta.Icon;
                return (
                  <div key={s.id} style={{
                    padding: "10px 12px", borderRadius: "var(--radius-sm)",
                    border: "1px solid var(--line)", background: "var(--bg-elev)",
                    borderLeft: `3px solid ${meta.color}`,
                    transition: "all 0.18s ease",
                    cursor: "pointer",
                  }}
                  onClick={() => s.ideaId && openIdea(s.ideaId)}
                  onMouseEnter={e => { if(s.ideaId) e.currentTarget.style.background = "var(--surface)"; }}
                  onMouseLeave={e => e.currentTarget.style.background = "var(--bg-elev)"}
                  >
                    <div className="row" style={{gap: 8, marginBottom: 4}}>
                      <Pi style={{width: 12, height: 12, color: meta.color}} />
                      <span className="small mute">{window.formatDateShort ? window.formatDateShort(s.date) : s.date}</span>
                    </div>
                    <div style={{fontWeight: 500, fontSize: 14}}>{s.title}</div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="card" style={{
          background: "linear-gradient(135deg, var(--accent) 0%, var(--pop) 100%)",
          color: "#fff",
          position: "relative",
          overflow: "hidden",
        }}>
          <div style={{position: "relative", zIndex: 2}}>
            <div className="card-title" style={{color: "#fff", marginBottom: 8}}>
              Ready to <em style={{color: "#f5c6bd"}}>create</em>?
            </div>
            <div className="card-sub" style={{color: "rgba(255,255,255,0.85)", marginBottom: 20}}>
              Turn ideas into words, fast.
            </div>
            <button 
              className="btn" 
              onClick={() => setPage("studio")}
              style={{
                background: "rgba(255,255,255,0.98)",
                color: "var(--ink)",
                border: "none",
              }}
            >
              <Icon.Sparkle /> Open the Studio
            </button>
          </div>
          <div style={{
            position: "absolute",
            right: -30, bottom: -30,
            width: 140, height: 140,
            opacity: 0.15,
          }}>
            <Sprig.Sprout size={140} color="#fff" />
          </div>
        </div>
      </div>
    </div>
  );
}

Object.assign(window, { DashboardPage });
