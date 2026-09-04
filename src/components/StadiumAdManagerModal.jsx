import React, { useState, useRef } from 'react'
import { DEFAULT_SPONSOR_ADS, DEFAULT_AD_SETTINGS } from './stadiumAdConstants'

export const StadiumAdManagerModal = ({
  isOpen,
  onClose,
  ads = [],
  onSaveAds,
  adSettings = DEFAULT_AD_SETTINGS,
  onSaveSettings,
}) => {
  // Navigation Tabs: 'text' | 'fullscreen' | 'timing' | 'roster'
  const [activeTab, setActiveTab] = useState('text')
  const [localAds, setLocalAds] = useState(ads.length > 0 ? ads : DEFAULT_SPONSOR_ADS)
  const [localSettings, setLocalSettings] = useState(adSettings)
  const [editingAdId, setEditingAdId] = useState(null)

  // Full Screen Media Form State
  const [mediaType, setMediaType] = useState('video') // 'video' | 'image'
  const [sponsorName, setSponsorName] = useState('')
  const [tagline, setTagline] = useState('')
  const [videoUrl, setVideoUrl] = useState('')
  const [logoUrl, setLogoUrl] = useState('')
  const [phoneOrLink, setPhoneOrLink] = useState('')

  const fileInputRef = useRef(null)
  const videoFileInputRef = useRef(null)

  if (!isOpen) return null

  // Handle Image File Upload
  const handleImageUpload = (e) => {
    const file = e.target.files?.[0]
    if (file) {
      if (file.size > 8 * 1024 * 1024) {
        alert('Image is larger than 8MB. Please choose a smaller image.')
        return
      }
      const reader = new FileReader()
      reader.onloadend = () => {
        setLogoUrl(reader.result)
      }
      reader.readAsDataURL(file)
    }
  }

  // Handle Video File Upload
  const handleVideoUpload = (e) => {
    const file = e.target.files?.[0]
    if (file) {
      if (file.size > 50 * 1024 * 1024) {
        alert('Video file is larger than 50MB. For larger videos, please paste a direct video URL.')
        return
      }
      const reader = new FileReader()
      reader.onloadend = () => {
        setVideoUrl(reader.result)
      }
      reader.readAsDataURL(file)
    }
  }

  const handleSaveMediaAd = (e) => {
    e.preventDefault()
    if (!sponsorName.trim()) {
      alert('Please enter Sponsor / Brand Name.')
      return
    }

    if (mediaType === 'image' && !logoUrl.trim() && !tagline.trim()) {
      alert('Please upload an Image file or paste an Image URL.')
      return
    }
    if (mediaType === 'video' && !videoUrl.trim() && !tagline.trim()) {
      alert('Please upload a Video file or paste a Video URL.')
      return
    }

    const adObject = {
      id: editingAdId || `ad-${Date.now()}`,
      sponsorName: sponsorName.trim(),
      badge: mediaType === 'video' ? '🎬 Video Sponsor' : '🖼️ Image Sponsor',
      tier: 'gold',
      mediaType,
      tagline: tagline.trim() || sponsorName.trim(),
      description: '',
      ctaText: 'Official Partner',
      phoneOrLink: phoneOrLink.trim(),
      accentColor: mediaType === 'video' ? '#10b981' : '#38bdf8',
      logoUrl: mediaType === 'image' ? logoUrl : '',
      videoUrl: mediaType === 'video' ? videoUrl : '',
      active: true,
      displayDuration: 10,
    }

    if (editingAdId) {
      const updated = localAds.map((item) => (item.id === editingAdId ? adObject : item))
      setLocalAds(updated)
      onSaveAds?.(updated)
    } else {
      const created = [...localAds, adObject]
      setLocalAds(created)
      onSaveAds?.(created)
    }

    handleResetMediaForm()
    setActiveTab('roster')
  }

  const handleResetMediaForm = () => {
    setEditingAdId(null)
    setSponsorName('')
    setTagline('')
    setVideoUrl('')
    setLogoUrl('')
    setPhoneOrLink('')
  }

  const handleStartEdit = (ad) => {
    setEditingAdId(ad.id)
    setMediaType(ad.mediaType === 'video' || ad.videoUrl ? 'video' : 'image')
    setSponsorName(ad.sponsorName || '')
    setTagline(ad.tagline || '')
    setVideoUrl(ad.videoUrl || '')
    setLogoUrl(ad.logoUrl || '')
    setPhoneOrLink(ad.phoneOrLink || '')
    setActiveTab('fullscreen')
  }

  const handleDeleteAd = (id) => {
    if (window.confirm('Delete this sponsor item?')) {
      const filtered = localAds.filter((a) => a.id !== id)
      setLocalAds(filtered)
      onSaveAds?.(filtered)
      if (editingAdId === id) handleResetMediaForm()
    }
  }

  const handleToggleAdActive = (id) => {
    const updated = localAds.map((a) => (a.id === id ? { ...a, active: !a.active } : a))
    setLocalAds(updated)
    onSaveAds?.(updated)
  }

  const handleSettingChange = (key, val) => {
    const next = { ...localSettings, [key]: val }
    setLocalSettings(next)
    onSaveSettings?.(next)
  }

  const activeAds = localAds.filter((a) => a.active !== false)

  return (
    <div
      className="stadium-ad-modal-overlay"
      onClick={onClose}
      onMouseDown={(e) => e.stopPropagation()}
      onTouchStart={(e) => e.stopPropagation()}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 999999,
        backgroundColor: 'rgba(2, 6, 23, 0.88)',
        backdropFilter: 'blur(10px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px',
      }}
    >
      <div
        className="stadium-ad-modal-content"
        onClick={(e) => e.stopPropagation()}
        onMouseDown={(e) => e.stopPropagation()}
        style={{
          width: '100%',
          maxWidth: '960px',
          maxHeight: '94vh',
          backgroundColor: '#090d16',
          border: '1.5px solid rgba(56, 189, 248, 0.35)',
          borderRadius: '24px',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 25px 70px rgba(0, 0, 0, 0.9), 0 0 50px rgba(56, 189, 248, 0.15)',
          overflow: 'hidden',
          color: '#ffffff',
        }}
      >
        {/* Top Header */}
        <div
          style={{
            padding: '18px 26px',
            borderBottom: '1px solid rgba(148, 163, 184, 0.12)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            background: 'linear-gradient(135deg, rgba(30, 41, 59, 0.7) 0%, rgba(15, 23, 42, 0.95) 100%)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            <div
              style={{
                width: '44px',
                height: '44px',
                borderRadius: '12px',
                background: 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '22px',
                boxShadow: '0 4px 14px rgba(2, 132, 199, 0.4)',
              }}
            >
              📺
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 900, color: '#f8fafc', letterSpacing: '-0.01em' }}>
                  Stadium TV Ads & Ticker Studio
                </h2>
                <span
                  style={{
                    background: 'rgba(34, 197, 94, 0.15)',
                    border: '1px solid #22c55e',
                    color: '#4ade80',
                    fontSize: '11px',
                    fontWeight: 800,
                    padding: '2px 9px',
                    borderRadius: '999px',
                  }}
                >
                  ● {activeAds.length} Active Ads
                </span>
              </div>
              <p style={{ margin: '3px 0 0', fontSize: '12px', color: '#94a3b8' }}>
                Separate management for Dual Scrolling Text Tickers, Full-Screen Video/Image Ads & Automation Timers.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{
              background: 'rgba(255, 255, 255, 0.06)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              color: '#cbd5e1',
              fontSize: '18px',
              width: '36px',
              height: '36px',
              borderRadius: '10px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'all 0.2s ease',
            }}
          >
            ✕
          </button>
        </div>

        {/* Tab Switcher Bar */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(4, 1fr)',
            background: 'rgba(15, 23, 42, 0.7)',
            borderBottom: '1px solid rgba(148, 163, 184, 0.12)',
            padding: '6px 16px',
            gap: '8px',
          }}
        >
          <button
            type="button"
            onClick={() => setActiveTab('text')}
            style={{
              padding: '10px 14px',
              borderRadius: '10px',
              border: 'none',
              background: activeTab === 'text' ? 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)' : 'transparent',
              color: activeTab === 'text' ? '#ffffff' : '#94a3b8',
              fontWeight: 800,
              fontSize: '13px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              boxShadow: activeTab === 'text' ? '0 4px 14px rgba(2, 132, 199, 0.35)' : 'none',
              transition: 'all 0.2s ease',
            }}
          >
            <span>📜</span>
            <span>Scrolling Text Tickers</span>
          </button>

          <button
            type="button"
            onClick={() => {
              if (!editingAdId) handleResetMediaForm()
              setActiveTab('fullscreen')
            }}
            style={{
              padding: '10px 14px',
              borderRadius: '10px',
              border: 'none',
              background: activeTab === 'fullscreen' ? 'linear-gradient(135deg, #059669 0%, #047857 100%)' : 'transparent',
              color: activeTab === 'fullscreen' ? '#ffffff' : '#94a3b8',
              fontWeight: 800,
              fontSize: '13px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              boxShadow: activeTab === 'fullscreen' ? '0 4px 14px rgba(5, 150, 105, 0.35)' : 'none',
              transition: 'all 0.2s ease',
            }}
          >
            <span>🎬</span>
            <span>{editingAdId ? 'Edit Full-Screen Ad' : 'Full-Screen Video/Image'}</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('timing')}
            style={{
              padding: '10px 14px',
              borderRadius: '10px',
              border: 'none',
              background: activeTab === 'timing' ? 'linear-gradient(135deg, #8b5cf6 0%, #6d28d9 100%)' : 'transparent',
              color: activeTab === 'timing' ? '#ffffff' : '#94a3b8',
              fontWeight: 800,
              fontSize: '13px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              boxShadow: activeTab === 'timing' ? '0 4px 14px rgba(139, 92, 246, 0.35)' : 'none',
              transition: 'all 0.2s ease',
            }}
          >
            <span>⏱️</span>
            <span>Timing & Automation</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('roster')}
            style={{
              padding: '10px 14px',
              borderRadius: '10px',
              border: 'none',
              background: activeTab === 'roster' ? 'linear-gradient(135deg, #334155 0%, #1e293b 100%)' : 'transparent',
              color: activeTab === 'roster' ? '#ffffff' : '#94a3b8',
              fontWeight: 800,
              fontSize: '13px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              boxShadow: activeTab === 'roster' ? '0 4px 14px rgba(51, 65, 85, 0.35)' : 'none',
              transition: 'all 0.2s ease',
            }}
          >
            <span>📋</span>
            <span>Ad Library ({localAds.length})</span>
          </button>
        </div>

        {/* Modal Scrollable Body */}
        <div style={{ padding: '24px', overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: '20px' }}>
          
          {/* =====================================================
              TAB 1: SCROLLING TEXT TICKERS (TOP & BOTTOM DEDICATED)
              ===================================================== */}
          {activeTab === 'text' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 900, color: '#38bdf8' }}>
                    📜 Live Stadium Dual Scrolling Text Banners
                  </h3>
                  <p style={{ margin: '3px 0 0', fontSize: '12.5px', color: '#94a3b8' }}>
                    Type your custom text below. Both rows will auto-scroll continuously across the bottom of the TV Live Cast.
                  </p>
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button
                    type="button"
                    onClick={() => {
                      handleSettingChange('topScrollingText', '🏆 Welcome to the Badminton Championship • Report to assigned courts 10 minutes prior to schedule!')
                      handleSettingChange('bottomScrollingText', '⭐ Exclusive 20% tournament discount on all rackets & pro gear at Arena Lobby Stall #1!')
                    }}
                    style={{
                      background: 'rgba(56, 189, 248, 0.12)',
                      border: '1px solid rgba(56, 189, 248, 0.3)',
                      color: '#38bdf8',
                      padding: '6px 14px',
                      borderRadius: '8px',
                      fontSize: '12px',
                      fontWeight: 700,
                      cursor: 'pointer',
                    }}
                  >
                    ✨ Load Sample Presets
                  </button>
                </div>
              </div>

              {/* Row 1 Text Input */}
              <div
                style={{
                  background: 'linear-gradient(135deg, rgba(2, 132, 199, 0.08) 0%, rgba(15, 23, 42, 0.7) 100%)',
                  border: '1.5px solid rgba(56, 189, 248, 0.4)',
                  borderRadius: '16px',
                  padding: '18px 20px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '10px',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <label style={{ fontSize: '13px', fontWeight: 900, color: '#38bdf8', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span>📢 Row 1: Top Scrolling Announcement Text</span>
                  </label>
                  <span style={{ fontSize: '11px', color: '#94a3b8' }}>
                    {(localSettings.topScrollingText || '').length} characters
                  </span>
                </div>
                <textarea
                  rows={2}
                  placeholder="e.g. 🏆 Matches are in Quarter Finals! Refreshments available at Counter 1 • Prize distribution starts at 6 PM."
                  value={localSettings.topScrollingText || ''}
                  onChange={(e) => handleSettingChange('topScrollingText', e.target.value)}
                  style={{
                    width: '100%',
                    padding: '12px 16px',
                    background: '#0f172a',
                    border: '1px solid rgba(56, 189, 248, 0.3)',
                    borderRadius: '10px',
                    color: '#ffffff',
                    fontSize: '14px',
                    lineHeight: 1.5,
                    boxSizing: 'border-box',
                    fontFamily: 'inherit',
                    resize: 'none',
                  }}
                />
              </div>

              {/* Row 2 Text Input */}
              <div
                style={{
                  background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.08) 0%, rgba(15, 23, 42, 0.7) 100%)',
                  border: '1.5px solid rgba(74, 222, 128, 0.4)',
                  borderRadius: '16px',
                  padding: '18px 20px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '10px',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <label style={{ fontSize: '13px', fontWeight: 900, color: '#4ade80', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span>⭐ Row 2: Bottom Scrolling Special Offer / Sponsor Text</span>
                  </label>
                  <span style={{ fontSize: '11px', color: '#94a3b8' }}>
                    {(localSettings.bottomScrollingText || '').length} characters
                  </span>
                </div>
                <textarea
                  rows={2}
                  placeholder="e.g. 🔥 Special Offer: 20% discount on all badminton equipment at Stall #1 • Energy drinks at Counter 2!"
                  value={localSettings.bottomScrollingText || ''}
                  onChange={(e) => handleSettingChange('bottomScrollingText', e.target.value)}
                  style={{
                    width: '100%',
                    padding: '12px 16px',
                    background: '#0f172a',
                    border: '1px solid rgba(74, 222, 128, 0.3)',
                    borderRadius: '10px',
                    color: '#ffffff',
                    fontSize: '14px',
                    lineHeight: 1.5,
                    boxSizing: 'border-box',
                    fontFamily: 'inherit',
                    resize: 'none',
                  }}
                />
              </div>

              {/* Live Ticker Simulator Preview */}
              <div
                style={{
                  background: '#020617',
                  border: '1px solid rgba(148, 163, 184, 0.2)',
                  borderRadius: '14px',
                  padding: '14px 18px',
                  overflow: 'hidden',
                }}
              >
                <span style={{ fontSize: '11px', fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: '8px' }}>
                  📺 Live TV Ticker Simulator (Real-Time Preview)
                </span>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <div style={{ background: '#0f172a', padding: '6px 12px', borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <span style={{ background: '#0284c7', color: '#fff', fontSize: '10px', fontWeight: 900, padding: '2px 6px', borderRadius: '4px' }}>
                      ROW 1
                    </span>
                    <span style={{ fontSize: '12.5px', color: '#38bdf8', fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {localSettings.topScrollingText || '(No text entered for Row 1)'}
                    </span>
                  </div>
                  <div style={{ background: '#0f172a', padding: '6px 12px', borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <span style={{ background: '#059669', color: '#fff', fontSize: '10px', fontWeight: 900, padding: '2px 6px', borderRadius: '4px' }}>
                      ROW 2
                    </span>
                    <span style={{ fontSize: '12.5px', color: '#4ade80', fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {localSettings.bottomScrollingText || '(No text entered for Row 2)'}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* =====================================================
              TAB 2: FULL-SCREEN VIDEO & IMAGE ADS FORM
              ===================================================== */}
          {activeTab === 'fullscreen' && (
            <form
              onSubmit={handleSaveMediaAd}
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '18px',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 900, color: '#34d399' }}>
                    {editingAdId ? '✏️ Edit Full-Screen Commercial' : '🎬 Add Full-Screen Video or Image Sponsor'}
                  </h3>
                  <p style={{ margin: '3px 0 0', fontSize: '12.5px', color: '#94a3b8' }}>
                    This ad will run automatically in full-screen during standby (no live matches) and on interval during live matches.
                  </p>
                </div>
                {editingAdId && (
                  <button
                    type="button"
                    onClick={handleResetMediaForm}
                    style={{
                      background: 'rgba(239, 68, 68, 0.15)',
                      border: '1px solid rgba(239, 68, 68, 0.3)',
                      color: '#f87171',
                      padding: '6px 12px',
                      borderRadius: '8px',
                      fontSize: '12px',
                      fontWeight: 700,
                      cursor: 'pointer',
                    }}
                  >
                    ✕ Cancel Edit
                  </button>
                )}
              </div>

              {/* Media Type Selector */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                <button
                  type="button"
                  onClick={() => setMediaType('video')}
                  style={{
                    padding: '14px 18px',
                    borderRadius: '14px',
                    border: mediaType === 'video' ? '2px solid #10b981' : '1.5px solid rgba(148, 163, 184, 0.2)',
                    background: mediaType === 'video' ? 'rgba(16, 185, 129, 0.15)' : '#0f172a',
                    color: mediaType === 'video' ? '#34d399' : '#94a3b8',
                    fontWeight: 900,
                    fontSize: '14px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '10px',
                    boxShadow: mediaType === 'video' ? '0 4px 16px rgba(16, 185, 129, 0.25)' : 'none',
                    transition: 'all 0.2s ease',
                  }}
                >
                  <span style={{ fontSize: '20px' }}>🎬</span>
                  <span>Full-Screen Video Commercial</span>
                </button>

                <button
                  type="button"
                  onClick={() => setMediaType('image')}
                  style={{
                    padding: '14px 18px',
                    borderRadius: '14px',
                    border: mediaType === 'image' ? '2px solid #38bdf8' : '1.5px solid rgba(148, 163, 184, 0.2)',
                    background: mediaType === 'image' ? 'rgba(56, 189, 248, 0.15)' : '#0f172a',
                    color: mediaType === 'image' ? '#38bdf8' : '#94a3b8',
                    fontWeight: 900,
                    fontSize: '14px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '10px',
                    boxShadow: mediaType === 'image' ? '0 4px 16px rgba(56, 189, 248, 0.25)' : 'none',
                    transition: 'all 0.2s ease',
                  }}
                >
                  <span style={{ fontSize: '20px' }}>🖼️</span>
                  <span>Full-Screen Image Sponsor</span>
                </button>
              </div>

              {/* Sponsor Name & Details */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                <div>
                  <label style={{ fontSize: '12px', fontWeight: 800, color: '#cbd5e1', marginBottom: '6px', display: 'block' }}>
                    Sponsor / Brand Name:
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. YONEX / VICTOR SPORTS / PRIME ACADEMY"
                    value={sponsorName}
                    onChange={(e) => setSponsorName(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '10px 14px',
                      background: '#0f172a',
                      border: '1px solid rgba(148, 163, 184, 0.3)',
                      borderRadius: '10px',
                      color: '#ffffff',
                      fontSize: '13.5px',
                      boxSizing: 'border-box',
                    }}
                  />
                </div>

                <div>
                  <label style={{ fontSize: '12px', fontWeight: 800, color: '#cbd5e1', marginBottom: '6px', display: 'block' }}>
                    Contact / Stall / Website (Optional):
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Stall #1 • +91 98765 43210 • www.yonex.com"
                    value={phoneOrLink}
                    onChange={(e) => setPhoneOrLink(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '10px 14px',
                      background: '#0f172a',
                      border: '1px solid rgba(148, 163, 184, 0.3)',
                      borderRadius: '10px',
                      color: '#ffffff',
                      fontSize: '13.5px',
                      boxSizing: 'border-box',
                    }}
                  />
                </div>
              </div>

              {/* Upload Dropzones */}
              {mediaType === 'video' && (
                <div style={{ background: '#0f172a', padding: '16px', borderRadius: '14px', border: '1.5px dashed #10b981' }}>
                  <label style={{ fontSize: '12.5px', fontWeight: 800, color: '#34d399', marginBottom: '10px', display: 'block' }}>
                    🎬 Video Source (Upload File or Paste Link):
                  </label>
                  <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                    <input
                      type="file"
                      ref={videoFileInputRef}
                      accept="video/mp4,video/webm,video/ogg"
                      style={{ display: 'none' }}
                      onChange={handleVideoUpload}
                    />
                    <button
                      type="button"
                      onClick={() => videoFileInputRef.current?.click()}
                      style={{
                        background: 'linear-gradient(135deg, #059669 0%, #047857 100%)',
                        border: 'none',
                        color: '#ffffff',
                        padding: '10px 18px',
                        borderRadius: '10px',
                        fontWeight: 800,
                        fontSize: '13px',
                        cursor: 'pointer',
                        whiteSpace: 'nowrap',
                        boxShadow: '0 4px 12px rgba(5, 150, 105, 0.35)',
                      }}
                    >
                      📁 Upload MP4/WebM File
                    </button>
                    <span style={{ color: '#64748b', fontSize: '12px' }}>OR</span>
                    <input
                      type="url"
                      placeholder="Paste direct .mp4 video URL (e.g. https://.../video.mp4)"
                      value={videoUrl}
                      onChange={(e) => setVideoUrl(e.target.value)}
                      style={{
                        flex: 1,
                        padding: '10px 14px',
                        background: '#1e293b',
                        border: '1px solid rgba(148, 163, 184, 0.3)',
                        borderRadius: '10px',
                        color: '#ffffff',
                        fontSize: '13px',
                      }}
                    />
                  </div>

                  {videoUrl && (
                    <div style={{ marginTop: '14px' }}>
                      <span style={{ fontSize: '11px', color: '#94a3b8', display: 'block', marginBottom: '6px' }}>Video Player Preview:</span>
                      <video
                        src={videoUrl}
                        controls
                        muted
                        style={{ maxHeight: '180px', borderRadius: '10px', border: '1px solid #334155' }}
                      />
                    </div>
                  )}
                </div>
              )}

              {mediaType === 'image' && (
                <div style={{ background: '#0f172a', padding: '16px', borderRadius: '14px', border: '1.5px dashed #38bdf8' }}>
                  <label style={{ fontSize: '12.5px', fontWeight: 800, color: '#38bdf8', marginBottom: '10px', display: 'block' }}>
                    🖼️ Image Source (Upload File or Paste Link):
                  </label>
                  <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                    <input
                      type="file"
                      ref={fileInputRef}
                      accept="image/*"
                      style={{ display: 'none' }}
                      onChange={handleImageUpload}
                    />
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      style={{
                        background: 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)',
                        border: 'none',
                        color: '#ffffff',
                        padding: '10px 18px',
                        borderRadius: '10px',
                        fontWeight: 800,
                        fontSize: '13px',
                        cursor: 'pointer',
                        whiteSpace: 'nowrap',
                        boxShadow: '0 4px 12px rgba(2, 132, 199, 0.35)',
                      }}
                    >
                      📁 Upload Image File
                    </button>
                    <span style={{ color: '#64748b', fontSize: '12px' }}>OR</span>
                    <input
                      type="url"
                      placeholder="Paste direct Image URL (e.g. https://.../banner.png)"
                      value={logoUrl}
                      onChange={(e) => setLogoUrl(e.target.value)}
                      style={{
                        flex: 1,
                        padding: '10px 14px',
                        background: '#1e293b',
                        border: '1px solid rgba(148, 163, 184, 0.3)',
                        borderRadius: '10px',
                        color: '#ffffff',
                        fontSize: '13px',
                      }}
                    />
                  </div>

                  {logoUrl && (
                    <div style={{ marginTop: '14px' }}>
                      <span style={{ fontSize: '11px', color: '#94a3b8', display: 'block', marginBottom: '6px' }}>Image Banner Preview:</span>
                      <img
                        src={logoUrl}
                        alt="Preview"
                        style={{ maxHeight: '180px', borderRadius: '10px', border: '1px solid #334155', objectFit: 'contain' }}
                      />
                    </div>
                  )}
                </div>
              )}

              {/* Tagline / Headline */}
              <div>
                <label style={{ fontSize: '12px', fontWeight: 800, color: '#cbd5e1', marginBottom: '6px', display: 'block' }}>
                  Commercial Headline / Promotion Message:
                </label>
                <input
                  type="text"
                  placeholder="e.g. Exclusive 20% Tournament Discount on all Rackets & Shoes at the Arena Lobby!"
                  value={tagline}
                  onChange={(e) => setTagline(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '10px 14px',
                    background: '#0f172a',
                    border: '1px solid rgba(148, 163, 184, 0.3)',
                    borderRadius: '10px',
                    color: '#ffffff',
                    fontSize: '13.5px',
                    boxSizing: 'border-box',
                  }}
                />
              </div>

              {/* Submit */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button
                  type="submit"
                  style={{
                    background: 'linear-gradient(135deg, #16a34a 0%, #15803d 100%)',
                    border: '1px solid #86efac',
                    color: '#ffffff',
                    padding: '12px 28px',
                    borderRadius: '12px',
                    fontWeight: 900,
                    fontSize: '14px',
                    cursor: 'pointer',
                    boxShadow: '0 4px 16px rgba(22, 163, 74, 0.4)',
                  }}
                >
                  {editingAdId ? '💾 Update Full-Screen Ad' : '➕ Save & Add to Full-Screen Rotation'}
                </button>
              </div>
            </form>
          )}

          {/* =====================================================
              TAB 3: TIMING & AUTOMATION CONTROLS
              ===================================================== */}
          {activeTab === 'timing' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 900, color: '#c4b5fd' }}>
                  ⏱️ Live Broadcast Timing & Display Automation
                </h3>
                <p style={{ margin: '3px 0 0', fontSize: '12.5px', color: '#94a3b8' }}>
                  Fine-tune full-screen commercial intervals, display duration, and ticker scrolling speed.
                </p>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                {/* Interval Box */}
                <div style={{ background: '#0f172a', padding: '18px', borderRadius: '16px', border: '1px solid rgba(139, 92, 246, 0.3)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
                    <span style={{ fontSize: '24px' }}>⏱️</span>
                    <div>
                      <strong style={{ fontSize: '14px', color: '#f8fafc' }}>Full-Screen Ad Interval</strong>
                      <span style={{ fontSize: '12px', color: '#94a3b8', display: 'block' }}>Triggered during live matches</span>
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '10px' }}>
                    <span style={{ fontSize: '13px', color: '#cbd5e1' }}>Every</span>
                    <input
                      type="number"
                      min="1"
                      max="60"
                      value={localSettings.fullScreenIntervalMinutes || 2}
                      onChange={(e) => handleSettingChange('fullScreenIntervalMinutes', Math.max(1, parseInt(e.target.value, 10) || 1))}
                      style={{
                        width: '70px',
                        padding: '6px 10px',
                        background: '#1e293b',
                        border: '1.5px solid #8b5cf6',
                        borderRadius: '8px',
                        color: '#c4b5fd',
                        fontWeight: 900,
                        fontSize: '15px',
                        textAlign: 'center',
                      }}
                    />
                    <span style={{ fontSize: '13px', color: '#cbd5e1' }}>minutes</span>
                  </div>
                </div>

                {/* Duration Box */}
                <div style={{ background: '#0f172a', padding: '18px', borderRadius: '16px', border: '1px solid rgba(56, 189, 248, 0.3)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
                    <span style={{ fontSize: '24px' }}>⏳</span>
                    <div>
                      <strong style={{ fontSize: '14px', color: '#f8fafc' }}>Display Duration</strong>
                      <span style={{ fontSize: '12px', color: '#94a3b8', display: 'block' }}>How long full-screen stays visible</span>
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '10px' }}>
                    <input
                      type="number"
                      min="3"
                      max="120"
                      value={localSettings.fullScreenDurationSeconds || 10}
                      onChange={(e) => handleSettingChange('fullScreenDurationSeconds', Math.max(3, parseInt(e.target.value, 10) || 10))}
                      style={{
                        width: '70px',
                        padding: '6px 10px',
                        background: '#1e293b',
                        border: '1.5px solid #38bdf8',
                        borderRadius: '8px',
                        color: '#38bdf8',
                        fontWeight: 900,
                        fontSize: '15px',
                        textAlign: 'center',
                      }}
                    />
                    <span style={{ fontSize: '13px', color: '#cbd5e1' }}>seconds per ad</span>
                  </div>
                </div>
              </div>

              {/* Scroll Speed & Audio */}
              <div style={{ background: '#0f172a', padding: '18px', borderRadius: '16px', border: '1px solid rgba(148, 163, 184, 0.2)', display: 'flex', flexWrap: 'wrap', gap: '20px', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <span style={{ fontSize: '22px' }}>⚡</span>
                  <div>
                    <strong style={{ fontSize: '13.5px', color: '#f8fafc', display: 'block' }}>All Tickers Scroll Speed</strong>
                    <span style={{ fontSize: '12px', color: '#94a3b8' }}>Applies identically to Top Ribbon and Bottom Tickers</span>
                  </div>
                  <select
                    value={localSettings.tickerSpeed || 'slow'}
                    onChange={(e) => handleSettingChange('tickerSpeed', e.target.value)}
                    style={{
                      padding: '7px 14px',
                      background: '#1e293b',
                      border: '1px solid rgba(148, 163, 184, 0.3)',
                      borderRadius: '8px',
                      color: '#f8fafc',
                      fontWeight: 800,
                      fontSize: '13px',
                      cursor: 'pointer',
                    }}
                  >
                    <option value="slow">Slow & Legible (Recommended for TV)</option>
                    <option value="normal">Normal</option>
                    <option value="fast">Fast</option>
                  </select>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '13.5px', color: '#cbd5e1', fontWeight: 700 }}>
                    <input
                      type="checkbox"
                      checked={localSettings.videoMuted !== false}
                      onChange={(e) => handleSettingChange('videoMuted', e.target.checked)}
                    />
                    <span>🔇 Mute Video Commercial Audio</span>
                  </label>
                </div>
              </div>
            </div>
          )}

          {/* =====================================================
              TAB 4: AD LIBRARY & ROSTER
              ===================================================== */}
          {activeTab === 'roster' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 900, color: '#f8fafc' }}>
                    Sponsor & Commercial Media Library ({localAds.length})
                  </h3>
                  <span style={{ fontSize: '12px', color: '#94a3b8' }}>
                    Toggle ads ON/OFF, edit media, or preview
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    handleResetMediaForm()
                    setActiveTab('fullscreen')
                  }}
                  style={{
                    background: 'linear-gradient(135deg, #059669 0%, #047857 100%)',
                    border: 'none',
                    color: '#ffffff',
                    padding: '8px 16px',
                    borderRadius: '10px',
                    fontWeight: 800,
                    fontSize: '13px',
                    cursor: 'pointer',
                  }}
                >
                  ➕ Add New Media Ad
                </button>
              </div>

              {localAds.length === 0 ? (
                <div style={{ padding: '40px', textAlign: 'center', background: '#0f172a', borderRadius: '16px', color: '#94a3b8' }}>
                  No sponsor ads added yet. Switch to the Full-Screen tab to add a video or image sponsor!
                </div>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '10px' }}>
                  {localAds.map((ad) => {
                    const isVideo = ad.mediaType === 'video' || ad.videoUrl
                    const isImage = ad.mediaType === 'image' || ad.logoUrl

                    return (
                      <div
                        key={ad.id}
                        style={{
                          background: '#0f172a',
                          border: ad.active !== false ? '1px solid rgba(56, 189, 248, 0.3)' : '1px solid rgba(148, 163, 184, 0.1)',
                          opacity: ad.active !== false ? 1 : 0.6,
                          borderRadius: '14px',
                          padding: '12px 18px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          gap: '14px',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flex: 1, minWidth: 0 }}>
                          <span style={{ fontSize: '26px' }}>
                            {isVideo ? '🎬' : '🖼️'}
                          </span>
                          <div style={{ minWidth: 0 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <strong style={{ fontSize: '14px', color: '#f8fafc' }}>{ad.sponsorName}</strong>
                              <span
                                style={{
                                  background: isVideo ? 'rgba(16, 185, 129, 0.2)' : 'rgba(56, 189, 248, 0.2)',
                                  color: isVideo ? '#34d399' : '#38bdf8',
                                  fontSize: '10.5px',
                                  fontWeight: 800,
                                  padding: '2px 7px',
                                  borderRadius: '6px',
                                }}
                              >
                                {isVideo ? 'VIDEO' : 'IMAGE'}
                              </span>
                            </div>
                            <p style={{ margin: '2px 0 0', fontSize: '12px', color: '#94a3b8', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                              {ad.tagline || ad.description}
                            </p>
                          </div>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <button
                            type="button"
                            onClick={() => handleToggleAdActive(ad.id)}
                            style={{
                              background: ad.active !== false ? 'rgba(34, 197, 94, 0.2)' : 'rgba(148, 163, 184, 0.2)',
                              border: 'none',
                              color: ad.active !== false ? '#4ade80' : '#94a3b8',
                              padding: '6px 12px',
                              borderRadius: '8px',
                              fontSize: '12px',
                              fontWeight: 800,
                              cursor: 'pointer',
                            }}
                          >
                            {ad.active !== false ? '● ACTIVE' : 'OFF'}
                          </button>
                          <button
                            type="button"
                            onClick={() => handleStartEdit(ad)}
                            style={{
                              background: '#1e293b',
                              border: '1px solid rgba(148, 163, 184, 0.3)',
                              color: '#e2e8f0',
                              padding: '6px 12px',
                              borderRadius: '8px',
                              fontSize: '12px',
                              fontWeight: 700,
                              cursor: 'pointer',
                            }}
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteAd(ad.id)}
                            style={{
                              background: 'rgba(239, 68, 68, 0.15)',
                              border: '1px solid rgba(239, 68, 68, 0.3)',
                              color: '#fca5a5',
                              padding: '6px 10px',
                              borderRadius: '8px',
                              fontSize: '12px',
                              fontWeight: 700,
                              cursor: 'pointer',
                            }}
                          >
                            🗑️
                          </button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
