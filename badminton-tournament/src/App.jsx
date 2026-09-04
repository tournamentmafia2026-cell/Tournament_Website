const stats = [
  { label: 'Players', value: '1200+' },
  { label: 'Teams', value: '86' },
  { label: 'Cities', value: '18' },
  { label: 'Matches', value: '240' },
]

const features = [
  {
    title: 'Elite Coaching',
    text: 'Top-class training sessions from certified badminton coaches and match analysts.',
    emoji: '🏸',
  },
  {
    title: 'Live Match Arena',
    text: 'Watch thrilling finals, doubles clashes, and knockout rounds in a stadium-style setup.',
    emoji: '🔥',
  },
  {
    title: 'Community Spirit',
    text: 'Build friendships, meet local players, and play in a high-energy competitive atmosphere.',
    emoji: '🤝',
  },
]

const schedule = [
  { day: 'Day 1', match: 'Opening Ceremony', time: '8:00 AM' },
  { day: 'Day 2', match: 'Singles Round 1', time: '9:00 AM' },
  { day: 'Day 3', match: 'Doubles Quarterfinals', time: '10:30 AM' },
  { day: 'Day 4', match: 'Semifinals', time: '1:00 PM' },
  { day: 'Day 5', match: 'Championship Final', time: '6:30 PM' },
]

const teams = ['Shuttle Stars', 'Smash Kings', 'Court Storm', 'Rally Force', 'Net Breakers', 'Blade Masters']

export default function App() {
  return (
    <div className="min-h-screen text-white">
      <header className="sticky top-0 z-50 border-b border-white/10 bg-slate-950/70 backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-400 font-black text-slate-950 shadow-neon">
              B
            </div>
            <div>
              <p className="text-lg font-bold">Badminton League</p>
            </div>
          </div>

          <nav className="hidden items-center gap-8 text-sm text-slate-300 md:flex">
            <a href="#home" className="hover:text-white">Home</a>
            <a href="#about" className="hover:text-white">About</a>
            <a href="#schedule" className="hover:text-white">Schedule</a>
            <a href="#teams" className="hover:text-white">Teams</a>
            <a href="#register" className="hover:text-white">Register</a>
          </nav>

          <button className="rounded-full bg-emerald-400 px-5 py-2 text-sm font-semibold text-slate-950 transition hover:bg-emerald-300">
            Join Now
          </button>
        </div>
      </header>

      <main id="home">
        <section className="mx-auto grid max-w-7xl items-center gap-12 px-6 py-20 md:grid-cols-2">
          <div>
            <p className="badge mb-6 inline-block rounded-full border border-emerald-400/30 bg-emerald-400/10 px-3 py-2 text-xs font-semibold text-emerald-300">
              2026 NATIONAL CHAMPIONSHIP
            </p>
            <h1 className="max-w-xl text-5xl font-black leading-tight tracking-tight md:text-6xl">
              Smash, rally, and dominate the court.
            </h1>
            <p className="mt-6 max-w-xl text-lg text-slate-300">
              Experience an electrifying badminton tournament with elite players, exciting finals, live commentary,
              and a tournament atmosphere built for champions.
            </p>

            <div className="mt-8 flex flex-wrap gap-4">
              <a
                href="#register"
                className="rounded-full bg-emerald-400 px-6 py-3 font-semibold text-slate-950 transition hover:bg-emerald-300"
              >
                Register Now
              </a>
              <a
                href="#schedule"
                className="rounded-full border border-white/15 bg-white/5 px-6 py-3 font-semibold text-white transition hover:bg-white/10"
              >
                View Schedule
              </a>
            </div>

            <div className="mt-10 grid grid-cols-2 gap-6 sm:grid-cols-4">
              {stats.map((item) => (
                <div key={item.label} className="rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur-sm">
                  <div className="text-2xl font-black text-emerald-300">{item.value}</div>
                  <div className="mt-1 text-sm text-slate-300">{item.label}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="relative">
            <div className="rounded-[2rem] border border-emerald-400/30 bg-slate-900/70 p-5 shadow-neon backdrop-blur-md">
              <div className="rounded-[1.5rem] border border-white/10 bg-gradient-to-br from-slate-800 via-slate-900 to-slate-950 p-6">
                <div className="flex items-center justify-between text-sm text-slate-300">
                  <span>Championship Final</span>
                  <span className="rounded-full bg-emerald-400/15 px-2 py-1 text-xs font-bold text-emerald-300">
                    LIVE
                  </span>
                </div>

                <div className="mt-6 rounded-2xl bg-slate-800/80 p-5">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Player 1</p>
                      <p className="mt-2 text-2xl font-bold">Arjun</p>
                    </div>
                    <div className="text-3xl font-black text-emerald-300">21</div>
                  </div>

                  <div className="my-4 h-px bg-white/10" />

                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Player 2</p>
                      <p className="mt-2 text-2xl font-bold">Vikram</p>
                    </div>
                    <div className="text-3xl font-black text-amber-300">18</div>
                  </div>
                </div>

                <div className="mt-6 grid grid-cols-3 gap-3 text-center text-sm">
                  <div className="rounded-xl border border-white/10 bg-white/5 p-3">
                    <div className="text-xs text-slate-400">Venue</div>
                    <div className="mt-2 font-semibold">Chennai</div>
                  </div>
                  <div className="rounded-xl border border-white/10 bg-white/5 p-3">
                    <div className="text-xs text-slate-400">Date</div>
                    <div className="mt-2 font-semibold">12 Sep</div>
                  </div>
                  <div className="rounded-xl border border-white/10 bg-white/5 p-3">
                    <div className="text-xs text-slate-400">Rounds</div>
                    <div className="mt-2 font-semibold">Knockout</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section id="about" className="mx-auto max-w-7xl px-6 py-20">
          <div className="mb-12 text-center">
            <p className="mb-3 text-sm font-bold uppercase tracking-[0.2em] text-emerald-300">Why join</p>
            <h2 className="text-4xl font-black tracking-tight">Built for true badminton enthusiasts.</h2>
          </div>

          <div className="grid gap-6 md:grid-cols-3">
            {features.map((feature) => (
              <div key={feature.title} className="rounded-3xl border border-white/10 bg-slate-900/60 p-7">
                <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-400/10 text-3xl">
                  {feature.emoji}
                </div>
                <h3 className="text-2xl font-bold">{feature.title}</h3>
                <p className="mt-4 text-slate-300">{feature.text}</p>
              </div>
            ))}
          </div>
        </section>

        <section id="schedule" className="bg-slate-900/70 py-20">
          <div className="mx-auto max-w-7xl px-6">
            <div className="mb-12 text-center">
              <p className="mb-3 text-sm font-bold uppercase tracking-[0.2em] text-emerald-300">Tournament Flow</p>
              <h2 className="text-4xl font-black tracking-tight">Match schedule</h2>
            </div>

            <div className="overflow-hidden rounded-3xl border border-white/10 bg-slate-950/70">
              {schedule.map((item, index) => (
                <div
                  key={item.day}
                  className={`grid grid-cols-1 gap-3 px-6 py-5 text-sm md:grid-cols-3 ${
                    index !== schedule.length - 1 ? 'border-b border-white/10' : ''
                  }`}
                >
                  <div className="font-bold text-emerald-300">{item.day}</div>
                  <div className="text-slate-200">{item.match}</div>
                  <div className="text-slate-400 md:text-right">{item.time}</div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section id="teams" className="mx-auto max-w-7xl px-6 py-20">
          <div className="mb-12 text-center">
            <p className="mb-3 text-sm font-bold uppercase tracking-[0.2em] text-emerald-300">Featured Teams</p>
            <h2 className="text-4xl font-black tracking-tight">Top contenders</h2>
          </div>

          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {teams.map((team, index) => (
              <div key={team} className="rounded-2xl border border-white/10 bg-white/5 p-6">
                <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-emerald-400/15 text-lg font-bold text-emerald-300">
                  {index + 1}
                </div>
                <h3 className="text-xl font-bold">{team}</h3>
                <p className="mt-3 text-slate-300">Waiting to battle for the title in the next big showdown.</p>
              </div>
            ))}
          </div>
        </section>

        <section id="register" className="mx-auto max-w-5xl px-6 pb-24 pt-8">
          <div className="rounded-[2rem] border border-emerald-400/30 bg-gradient-to-r from-emerald-500/15 via-slate-900 to-slate-900 p-8 md:p-12">
            <div className="flex flex-col gap-8 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="mb-2 text-sm font-bold uppercase tracking-[0.2em] text-emerald-300">Register Today</p>
                <h2 className="text-3xl font-black md:text-4xl">Reserve your spot for the next tournament.</h2>
              </div>

              <button className="rounded-full bg-emerald-400 px-7 py-3 font-semibold text-slate-950 transition hover:bg-emerald-300">
                Book Entry
              </button>
            </div>
          </div>
        </section>
      </main>
    </div>
  )
}
