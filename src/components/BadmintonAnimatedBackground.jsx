import React, { useEffect, useState, useRef, useCallback } from 'react'

export const BadmintonAnimatedBackground = () => {
  const [shuttles, setShuttles] = useState([])
  const [smashBursts, setSmashBursts] = useState([])
  const containerRef = useRef(null)

  // Initialize floating ambient shuttlecocks with diverse speeds, angles and trajectories
  useEffect(() => {
    const initialShuttles = Array.from({ length: 7 }).map((_, i) => ({
      id: `shuttle_${i}_${Date.now()}`,
      top: `${10 + Math.random() * 80}%`,
      left: `${-5 - Math.random() * 15}%`,
      size: 20 + Math.random() * 18,
      duration: 12 + Math.random() * 16,
      delay: Math.random() * 8,
      opacity: 0.18 + Math.random() * 0.22,
      rotationSpeed: 6 + Math.random() * 8,
      wobbleDuration: 2.5 + Math.random() * 2,
    }))
    setShuttles(initialShuttles)
  }, [])

  // Interactive smash burst animation on click
  const handlePageClick = useCallback((e) => {
    // Only spawn particle burst occasionally or on empty spaces
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT') return
    const id = `smash_${Date.now()}_${Math.random()}`
    const x = e.clientX
    const y = e.clientY
    setSmashBursts((prev) => [...prev.slice(-4), { id, x, y }])
    setTimeout(() => {
      setSmashBursts((prev) => prev.filter((b) => b.id !== id))
    }, 1000)
  }, [])

  useEffect(() => {
    window.addEventListener('click', handlePageClick, { passive: true })
    return () => window.removeEventListener('click', handlePageClick)
  }, [handlePageClick])

  return (
    <div
      ref={containerRef}
      className="badminton-ambient-stage"
      style={{
        position: 'fixed',
        inset: 0,
        pointerEvents: 'none',
        zIndex: 0,
        overflow: 'hidden',
      }}
      aria-hidden="true"
    >
      {/* 1. Animated Glowing Badminton Court Grid Lines */}
      <div className="badminton-court-lines-svg-wrap">
        <svg
          className="badminton-court-lines-svg"
          viewBox="0 0 1920 1080"
          preserveAspectRatio="xMidYMid slice"
          xmlns="http://www.w3.org/2000/svg"
        >
          <defs>
            <linearGradient id="courtGlowGreen" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#10b981" stopOpacity="0.08" />
              <stop offset="50%" stopColor="#06b6d4" stopOpacity="0.16" />
              <stop offset="100%" stopColor="#3b82f6" stopOpacity="0.08" />
            </linearGradient>
            <linearGradient id="netPulseGradient" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#38bdf8" stopOpacity="0.1" />
              <stop offset="50%" stopColor="#ffffff" stopOpacity="0.35" />
              <stop offset="100%" stopColor="#38bdf8" stopOpacity="0.1" />
            </linearGradient>
          </defs>

          {/* Perspective Outer Doubles Boundary */}
          <rect
            x="160"
            y="90"
            width="1600"
            height="900"
            rx="12"
            fill="none"
            stroke="url(#courtGlowGreen)"
            strokeWidth="2"
            className="court-line-outer"
          />

          {/* Singles Sidelines (Inner) */}
          <line x1="260" y1="90" x2="260" y2="990" stroke="url(#courtGlowGreen)" strokeWidth="1.5" strokeDasharray="6 6" />
          <line x1="1660" y1="90" x2="1660" y2="990" stroke="url(#courtGlowGreen)" strokeWidth="1.5" strokeDasharray="6 6" />

          {/* Doubles Long Service Lines (Back) */}
          <line x1="160" y1="160" x2="1760" y2="160" stroke="url(#courtGlowGreen)" strokeWidth="1.5" strokeDasharray="8 8" />
          <line x1="160" y1="920" x2="1760" y2="920" stroke="url(#courtGlowGreen)" strokeWidth="1.5" strokeDasharray="8 8" />

          {/* Short Service Lines (Front) */}
          <line x1="160" y1="410" x2="1760" y2="410" stroke="url(#courtGlowGreen)" strokeWidth="1.8" />
          <line x1="160" y1="670" x2="1760" y2="670" stroke="url(#courtGlowGreen)" strokeWidth="1.8" />

          {/* Center Lines */}
          <line x1="960" y1="90" x2="960" y2="410" stroke="url(#courtGlowGreen)" strokeWidth="1.5" />
          <line x1="960" y1="670" x2="960" y2="990" stroke="url(#courtGlowGreen)" strokeWidth="1.5" />

          {/* Center NET Line (High Glow with Animated Shimmer) */}
          <line
            x1="120"
            y1="540"
            x2="1800"
            y2="540"
            stroke="url(#netPulseGradient)"
            strokeWidth="3.5"
            className="court-net-line"
          />
        </svg>
      </div>

      {/* 2. Floating Animated Neon Shuttlecocks */}
      {shuttles.map((s, idx) => (
        <div
          key={s.id}
          className="badminton-floating-shuttle"
          style={{
            top: s.top,
            animationDuration: `${s.duration}s`,
            animationDelay: `${s.delay}s`,
            opacity: s.opacity,
            width: `${s.size}px`,
            height: `${s.size}px`,
          }}
        >
          <div
            className="shuttle-wobble-inner"
            style={{ animationDuration: `${s.wobbleDuration}s` }}
          >
            {/* SVG Badminton Shuttlecock with Neon Glow */}
            <svg
              viewBox="0 0 64 64"
              width="100%"
              height="100%"
              className="shuttle-svg"
            >
              <defs>
                <filter id={`shuttleGlow_${idx}`} x="-20%" y="-20%" width="140%" height="140%">
                  <feGaussianBlur stdDeviation="3" result="blur" />
                  <feComposite in="SourceGraphic" in2="blur" operator="over" />
                </filter>
              </defs>
              {/* Feathers */}
              <path
                d="M16 12 L48 12 L38 42 L26 42 Z"
                fill="rgba(255, 255, 255, 0.45)"
                stroke="#38bdf8"
                strokeWidth="1.5"
                filter={`url(#shuttleGlow_${idx})`}
              />
              {/* Feather Lines */}
              <line x1="24" y1="12" x2="29" y2="42" stroke="#0ea5e9" strokeWidth="1" opacity="0.6" />
              <line x1="32" y1="12" x2="32" y2="42" stroke="#38bdf8" strokeWidth="1.2" opacity="0.7" />
              <line x1="40" y1="12" x2="35" y2="42" stroke="#0ea5e9" strokeWidth="1" opacity="0.6" />
              {/* Feather Ribbons */}
              <path d="M20 22 Q32 25 44 22" fill="none" stroke="#38bdf8" strokeWidth="1.2" />
              <path d="M23 32 Q32 35 41 32" fill="none" stroke="#38bdf8" strokeWidth="1.2" />
              {/* Cork Base (Head) */}
              <path
                d="M26 42 Q32 54 38 42 Z"
                fill="#fbbf24"
                stroke="#d97706"
                strokeWidth="1.5"
              />
            </svg>
          </div>
        </div>
      ))}

      {/* 3. Fast Smash Trail Animations (Periodic High-Speed Smash Slashes) */}
      <div className="smash-streak smash-streak-1" />
      <div className="smash-streak smash-streak-2" />
      <div className="smash-streak smash-streak-3" />

      {/* 4. Interactive Smash Click Bursts */}
      {smashBursts.map((burst) => (
        <div
          key={burst.id}
          className="smash-click-ripple"
          style={{
            left: `${burst.x}px`,
            top: `${burst.y}px`,
          }}
        >
          <span className="ripple-ring ring-1" />
          <span className="ripple-ring ring-2" />
          <span className="smash-shuttle-spark">🏸</span>
        </div>
      ))}
    </div>
  )
}
