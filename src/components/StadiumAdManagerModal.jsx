import React, { useState, useRef } from 'react'
import { DEFAULT_SPONSOR_ADS, DEFAULT_AD_SETTINGS } from './stadiumAdConstants'
import { ConfirmDeleteModal } from './ConfirmDeleteModal'

export const StadiumAdManagerModal = ({
  isOpen,
  onClose,
  ads = [],
  onSaveAds,
  adSettings = DEFAULT_AD_SETTINGS,
  onSaveSettings,
}) => {
  // Navigation Tabs: 'video' | 'image' | 'text' | 'roster'
  const [activeTab, setActiveTab] = useState('video')
  const [localAds, setLocalAds] = useState(ads.length > 0 ? ads : DEFAULT_SPONSOR_ADS)
  const [localSettings, setLocalSettings] = useState(adSettings)
  const [editingAdId, setEditingAdId] = useState(null)
  const [deleteAdConfirm, setDeleteAdConfirm] = useState(null)

  // Form State for Video Ads
  const [videoSponsorName, setVideoSponsorName] = useState('')
  const [videoTagline, setVideoTagline] = useState('')
  const [videoUrl, setVideoUrl] = useState('')
  const [videoPhoneOrLink, setVideoPhoneOrLink] = useState('')
  const [videoDuration, setVideoDuration] = useState(15)

  // Form State for Image Ads
  const [imageSponsorName, setImageSponsorName] = useState('')
  const [imageTagline, setImageTagline] = useState('')
  const [imageUrl, setImageUrl] = useState('')
  const [imageAccentColor, setImageAccentColor] = useState('#38bdf8')
  const [imagePhoneOrLink, setImagePhoneOrLink] = useState('')
  const [imageDuration, setImageDuration] = useState(10)

  const imageFileInputRef = useRef(null)
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
        setImageUrl(reader.result)
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

  // Save Video Ad
  const handleSaveVideoAd = (e) => {
    e.preventDefault()
    if (!videoSponsorName.trim()) {
      alert('Please enter Sponsor / Brand Name for this Video Ad.')
      return
    }
    if (!videoUrl.trim() && !videoTagline.trim()) {
      alert('Please upload a video file or paste a valid video URL.')
      return
    }

    const adObject = {
      id: editingAdId || `ad-v-${Date.now()}`,
      sponsorName: videoSponsorName.trim(),
      mediaType: 'video',
      tagline: videoTagline.trim() || videoSponsorName.trim(),
      description: '',
      ctaText: 'Official Video Partner',
      phoneOrLink: videoPhoneOrLink.trim(),
      accentColor: '#10b981',
      logoUrl: '',
      videoUrl: videoUrl.trim(),
      active: true,
      displayDuration: Number(videoDuration) || 15,
    }

    let updatedList
    if (editingAdId) {
      updatedList = localAds.map((item) => (item.id === editingAdId ? adObject : item))
    } else {
      updatedList = [...localAds, adObject]
    }

    setLocalAds(updatedList)
    onSaveAds?.(updatedList)
    handleResetVideoForm()
    setActiveTab('roster')
  }

  // Save Image Ad
  const handleSaveImageAd = (e) => {
    e.preventDefault()
    if (!imageSponsorName.trim()) {
      alert('Please enter Sponsor / Brand Name for this Image Ad.')
      return
    }
    if (!imageUrl.trim() && !imageTagline.trim()) {
      alert('Please upload an image file or paste an image URL.')
      return
    }

    const adObject = {
      id: editingAdId || `ad-img-${Date.now()}`,
      sponsorName: imageSponsorName.trim(),
      mediaType: 'image',
      tagline: imageTagline.trim() || imageSponsorName.trim(),
      description: '',
      ctaText: 'Official Partner',
      phoneOrLink: imagePhoneOrLink.trim(),
      accentColor: imageAccentColor || '#38bdf8',
      logoUrl: imageUrl.trim(),
      videoUrl: '',
      active: true,
      displayDuration: Number(imageDuration) || 10,
    }

    let updatedList
    if (editingAdId) {
      updatedList = localAds.map((item) => (item.id === editingAdId ? adObject : item))
    } else {
      updatedList = [...localAds, adObject]
    }

    setLocalAds(updatedList)
    onSaveAds?.(updatedList)
    handleResetImageForm()
    setActiveTab('roster')
  }

  const handleResetVideoForm = () => {
    setEditingAdId(null)
    setVideoSponsorName('')
    setVideoTagline('')
    setVideoUrl('')
    setVideoPhoneOrLink('')
    setVideoDuration(15)
  }

  const handleResetImageForm = () => {
    setEditingAdId(null)
    setImageSponsorName('')
    setImageTagline('')
    setImageUrl('')
    setImageAccentColor('#38bdf8')
    setImagePhoneOrLink('')
    setImageDuration(10)
  }

  const handleStartEditAd = (ad) => {
    setEditingAdId(ad.id)
    if (ad.mediaType === 'video' || ad.videoUrl) {
      setVideoSponsorName(ad.sponsorName || '')
      setVideoTagline(ad.tagline || '')
      setVideoUrl(ad.videoUrl || '')
      setVideoPhoneOrLink(ad.phoneOrLink || '')
      setVideoDuration(ad.displayDuration || 15)
      setActiveTab('video')
    } else {
      setImageSponsorName(ad.sponsorName || '')
      setImageTagline(ad.tagline || '')
      setImageUrl(ad.logoUrl || '')
      setImageAccentColor(ad.accentColor || '#38bdf8')
      setImagePhoneOrLink(ad.phoneOrLink || '')
      setImageDuration(ad.displayDuration || 10)
      setActiveTab('image')
    }
  }

  const handleDeleteAd = (id) => {
    const target = localAds.find((a) => a.id === id)
    setDeleteAdConfirm({
      id,
      title: 'Delete Sponsor Advertisement?',
      message: `Are you sure you want to permanently delete "${target?.sponsorName || 'this advertisement'}"?`,
      itemName: target?.sponsorName,
      onConfirm: () => {
        const filtered = localAds.filter((a) => a.id !== id)
        setLocalAds(filtered)
        onSaveAds?.(filtered)
        if (editingAdId === id) {
          handleResetVideoForm()
          handleResetImageForm()
        }
        setDeleteAdConfirm(null)
      },
    })
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
  const videoAdsList = localAds.filter((a) => a.mediaType === 'video' || Boolean(a.videoUrl))
  const imageAdsList = localAds.filter((a) => a.mediaType !== 'video' && !a.videoUrl)

  // Current calculated speed in seconds
  const currentSpeedSeconds = (() => {
    const sp = localSettings.tickerSpeed
    if (typeof sp === 'number') return sp
    if (sp && !isNaN(Number(sp))) return Number(sp)
    if (sp === 'ultra-fast') return 8
    if (sp === 'fast') return 14
    if (sp === 'normal') return 22
    if (sp === 'slow') return 32
    if (sp === 'ultra-slow') return 45
    return 32
  })()

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
          maxWidth: '980px',
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
                  Stadium TV Ads Studio
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
                Manage Video Ads, Image Posters, and Dual Scrolling Text Tickers with Speed Controls.
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

        {/* 4 DISTINCT TABS: Video Ads | Image Ads | Text Tickers | Ad Library */}
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
          {/* Tab 1: Video */}
          <button
            type="button"
            onClick={() => {
              if (activeTab !== 'video') handleResetVideoForm()
              setActiveTab('video')
            }}
            style={{
              padding: '11px 14px',
              borderRadius: '10px',
              border: 'none',
              background: activeTab === 'video' ? 'linear-gradient(135deg, #10b981 0%, #059669 100%)' : 'transparent',
              color: activeTab === 'video' ? '#ffffff' : '#94a3b8',
              fontWeight: 800,
              fontSize: '13px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              boxShadow: activeTab === 'video' ? '0 4px 14px rgba(16, 185, 129, 0.35)' : 'none',
              transition: 'all 0.2s ease',
            }}
          >
            <span>🎬</span>
            <span>Video Ads ({videoAdsList.length})</span>
          </button>

          {/* Tab 2: Image */}
          <button
            type="button"
            onClick={() => {
              if (activeTab !== 'image') handleResetImageForm()
              setActiveTab('image')
            }}
            style={{
              padding: '11px 14px',
              borderRadius: '10px',
              border: 'none',
              background: activeTab === 'image' ? 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)' : 'transparent',
              color: activeTab === 'image' ? '#ffffff' : '#94a3b8',
              fontWeight: 800,
              fontSize: '13px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              boxShadow: activeTab === 'image' ? '0 4px 14px rgba(59, 130, 246, 0.35)' : 'none',
              transition: 'all 0.2s ease',
            }}
          >
            <span>🖼️</span>
            <span>Image Ads ({imageAdsList.length})</span>
          </button>

          {/* Tab 3: Text */}
          <button
            type="button"
            onClick={() => setActiveTab('text')}
            style={{
              padding: '11px 14px',
              borderRadius: '10px',
              border: 'none',
              background: activeTab === 'text' ? 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)' : 'transparent',
              color: activeTab === 'text' ? '#ffffff' : '#94a3b8',
              fontWeight: 800,
              fontSize: '13px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              boxShadow: activeTab === 'text' ? '0 4px 14px rgba(245, 158, 11, 0.35)' : 'none',
              transition: 'all 0.2s ease',
            }}
          >
            <span>📜</span>
            <span>Text Ticker & Speed</span>
          </button>

          {/* Tab 4: Library / Roster */}
          <button
            type="button"
            onClick={() => setActiveTab('roster')}
            style={{
              padding: '11px 14px',
              borderRadius: '10px',
              border: 'none',
              background: activeTab === 'roster' ? 'linear-gradient(135deg, #8b5cf6 0%, #6d28d9 100%)' : 'transparent',
              color: activeTab === 'roster' ? '#ffffff' : '#94a3b8',
              fontWeight: 800,
              fontSize: '13px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              boxShadow: activeTab === 'roster' ? '0 4px 14px rgba(139, 92, 246, 0.35)' : 'none',
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
              TAB 1: 🎬 VIDEO ADS
              ===================================================== */}
          {activeTab === 'video' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '22px' }}>
              <form onSubmit={handleSaveVideoAd} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 900, color: '#34d399', display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span>🎬</span>
                      <span>{editingAdId ? 'Edit Video Commercial' : 'Add Full-Screen Video Commercial'}</span>
                    </h3>
                    <p style={{ margin: '3px 0 0', fontSize: '12.5px', color: '#94a3b8' }}>
                      Upload an MP4/WebM video or paste a video URL to play full-screen during match standby or intervals.
                    </p>
                  </div>
                  {editingAdId && (
                    <button
                      type="button"
                      onClick={handleResetVideoForm}
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

                <div
                  style={{
                    background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.08) 0%, rgba(15, 23, 42, 0.7) 100%)',
                    border: '1.5px solid rgba(16, 185, 129, 0.35)',
                    borderRadius: '16px',
                    padding: '20px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '16px',
                  }}
                >
                  {/* 1. Sponsor Name & Video Upload */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '12.5px', fontWeight: 800, color: '#34d399', marginBottom: '6px' }}>
                        Brand / Sponsor Name *
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. Red Bull Energy"
                        value={videoSponsorName}
                        onChange={(e) => setVideoSponsorName(e.target.value)}
                        required
                        style={{
                          width: '100%',
                          padding: '12px 14px',
                          background: '#0f172a',
                          border: '1.5px solid rgba(52, 211, 153, 0.35)',
                          borderRadius: '10px',
                          color: '#ffffff',
                          fontSize: '13.5px',
                          boxSizing: 'border-box',
                        }}
                      />

                      <div style={{ marginTop: '12px' }}>
                        <label style={{ display: 'block', fontSize: '12px', fontWeight: 800, color: '#94a3b8', marginBottom: '6px' }}>
                          Tagline / Promo Message (Optional)
                        </label>
                        <input
                          type="text"
                          placeholder="e.g. Gives You Wings • Free samples at Stall #1"
                          value={videoTagline}
                          onChange={(e) => setVideoTagline(e.target.value)}
                          style={{
                            width: '100%',
                            padding: '10px 14px',
                            background: '#0f172a',
                            border: '1px solid rgba(148, 163, 184, 0.3)',
                            borderRadius: '8px',
                            color: '#ffffff',
                            fontSize: '13px',
                            boxSizing: 'border-box',
                          }}
                        />
                      </div>
                    </div>

                    <div>
                      <label style={{ display: 'block', fontSize: '12.5px', fontWeight: 800, color: '#34d399', marginBottom: '6px' }}>
                        Commercial Video File (MP4 / WebM)
                      </label>
                      <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
                        <input
                          type="file"
                          ref={videoFileInputRef}
                          accept="video/mp4,video/webm,video/ogg"
                          onChange={handleVideoUpload}
                          style={{ display: 'none' }}
                        />
                        <button
                          type="button"
                          onClick={() => videoFileInputRef.current?.click()}
                          style={{
                            flex: 1,
                            padding: '10px 16px',
                            borderRadius: '8px',
                            background: 'rgba(16, 185, 129, 0.2)',
                            border: '1px solid #10b981',
                            color: '#34d399',
                            fontWeight: 800,
                            fontSize: '12.5px',
                            cursor: 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '6px',
                          }}
                        >
                          📁 Choose Video File
                        </button>
                        {videoUrl && (
                          <button
                            type="button"
                            onClick={() => setVideoUrl('')}
                            style={{
                              padding: '10px 14px',
                              borderRadius: '8px',
                              background: 'rgba(239, 68, 68, 0.15)',
                              border: '1px solid rgba(239, 68, 68, 0.4)',
                              color: '#f87171',
                              fontSize: '12px',
                              fontWeight: 700,
                              cursor: 'pointer',
                            }}
                          >
                            Remove
                          </button>
                        )}
                      </div>
                      <input
                        type="url"
                        placeholder="Or paste direct video URL (e.g. https://.../ad.mp4)"
                        value={videoUrl.startsWith('data:') ? '✅ Video File Uploaded from Device' : videoUrl}
                        onChange={(e) => setVideoUrl(e.target.value)}
                        disabled={videoUrl.startsWith('data:')}
                        style={{
                          width: '100%',
                          padding: '10px 14px',
                          background: '#0f172a',
                          border: '1px solid rgba(16, 185, 129, 0.3)',
                          borderRadius: '8px',
                          color: '#ffffff',
                          fontSize: '12.5px',
                          boxSizing: 'border-box',
                        }}
                      />
                    </div>
                  </div>

                  {/* 2. Duration Preset Pills & Action Button */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px', borderTop: '1px solid rgba(255, 255, 255, 0.08)', paddingTop: '12px', marginTop: '4px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                      <span style={{ fontSize: '12px', fontWeight: 800, color: '#94a3b8' }}>⏱️ Duration:</span>
                      {[5, 10, 15, 20, 30].map((dur) => (
                        <button
                          key={dur}
                          type="button"
                          onClick={() => setVideoDuration(dur)}
                          style={{
                            padding: '5px 12px',
                            borderRadius: '16px',
                            background: Number(videoDuration) === dur ? 'rgba(16, 185, 129, 0.25)' : 'rgba(255, 255, 255, 0.06)',
                            border: Number(videoDuration) === dur ? '1.5px solid #10b981' : '1px solid rgba(255, 255, 255, 0.12)',
                            color: Number(videoDuration) === dur ? '#34d399' : '#94a3b8',
                            fontSize: '12px',
                            fontWeight: 800,
                            cursor: 'pointer',
                          }}
                        >
                          {dur}s {dur === 15 ? '★' : ''}
                        </button>
                      ))}
                    </div>

                    <button
                      type="submit"
                      style={{
                        background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                        color: '#ffffff',
                        border: 'none',
                        padding: '11px 24px',
                        borderRadius: '10px',
                        fontWeight: 900,
                        fontSize: '13.5px',
                        cursor: 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '8px',
                        boxShadow: '0 4px 16px rgba(16, 185, 129, 0.35)',
                      }}
                    >
                      <span>💾</span>
                      <span>{editingAdId ? 'Update Video Ad' : 'Save Video Ad'}</span>
                    </button>
                  </div>
                </div>
              </form>

              {/* Video Ads Table */}
              <div>
                <h4 style={{ margin: '0 0 10px', fontSize: '14px', fontWeight: 800, color: '#94a3b8' }}>
                  Active Video Commercials ({videoAdsList.length})
                </h4>
                {videoAdsList.length === 0 ? (
                  <div style={{ background: 'rgba(15, 23, 42, 0.5)', padding: '16px', borderRadius: '12px', textAlign: 'center', color: '#64748b', fontSize: '13px' }}>
                    No video commercials added yet. Upload or paste a video above!
                  </div>
                ) : (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '12px' }}>
                    {videoAdsList.map((ad) => (
                      <div
                        key={ad.id}
                        style={{
                          background: '#0f172a',
                          border: '1px solid rgba(16, 185, 129, 0.3)',
                          borderRadius: '12px',
                          padding: '12px 14px',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '8px',
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ fontWeight: 800, color: '#34d399', fontSize: '14px' }}>🎬 {ad.sponsorName}</span>
                          <span style={{ fontSize: '11px', color: '#94a3b8' }}>⏱️ {ad.displayDuration || 15}s</span>
                        </div>
                        <div style={{ fontSize: '12px', color: '#cbd5e1' }}>{ad.tagline}</div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '4px' }}>
                          <button
                            type="button"
                            onClick={() => handleToggleAdActive(ad.id)}
                            style={{
                              background: ad.active !== false ? 'rgba(34, 197, 94, 0.2)' : 'rgba(148, 163, 184, 0.2)',
                              color: ad.active !== false ? '#4ade80' : '#94a3b8',
                              border: 'none',
                              borderRadius: '6px',
                              padding: '4px 8px',
                              fontSize: '11px',
                              fontWeight: 800,
                              cursor: 'pointer',
                            }}
                          >
                            {ad.active !== false ? '● ACTIVE' : '○ PAUSED'}
                          </button>
                          <div style={{ display: 'flex', gap: '6px' }}>
                            <button
                              type="button"
                              onClick={() => handleStartEditAd(ad)}
                              style={{ background: '#0284c7', color: '#fff', border: 'none', borderRadius: '6px', padding: '4px 8px', fontSize: '11px', cursor: 'pointer', fontWeight: 700 }}
                            >
                              Edit
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteAd(ad.id)}
                              style={{ background: 'rgba(239, 68, 68, 0.2)', color: '#f87171', border: 'none', borderRadius: '6px', padding: '4px 8px', fontSize: '11px', cursor: 'pointer', fontWeight: 700 }}
                            >
                              Delete
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* =====================================================
              TAB 2: 🖼️ IMAGE ADS
              ===================================================== */}
          {activeTab === 'image' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '22px' }}>
              <form onSubmit={handleSaveImageAd} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 900, color: '#38bdf8', display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span>🖼️</span>
                      <span>{editingAdId ? 'Edit Image Poster / Banner' : 'Add Image Sponsor Banner / Poster'}</span>
                    </h3>
                    <p style={{ margin: '3px 0 0', fontSize: '12.5px', color: '#94a3b8' }}>
                      Upload a sponsor image poster or banner to show on the live TV top ticker bar and standby screen.
                    </p>
                  </div>
                  {editingAdId && (
                    <button
                      type="button"
                      onClick={handleResetImageForm}
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

                <div
                  style={{
                    background: 'linear-gradient(135deg, rgba(2, 132, 199, 0.08) 0%, rgba(15, 23, 42, 0.7) 100%)',
                    border: '1.5px solid rgba(56, 189, 248, 0.35)',
                    borderRadius: '16px',
                    padding: '20px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '16px',
                  }}
                >
                  {/* 1. Sponsor Name & Image Upload */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '12.5px', fontWeight: 800, color: '#38bdf8', marginBottom: '6px' }}>
                        Brand / Sponsor Name *
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. Victor Sports"
                        value={imageSponsorName}
                        onChange={(e) => setImageSponsorName(e.target.value)}
                        required
                        style={{
                          width: '100%',
                          padding: '12px 14px',
                          background: '#0f172a',
                          border: '1.5px solid rgba(56, 189, 248, 0.35)',
                          borderRadius: '10px',
                          color: '#ffffff',
                          fontSize: '13.5px',
                          boxSizing: 'border-box',
                        }}
                      />

                      <div style={{ marginTop: '12px' }}>
                        <label style={{ display: 'block', fontSize: '12px', fontWeight: 800, color: '#94a3b8', marginBottom: '6px' }}>
                          Tagline / Promo Offer (Optional)
                        </label>
                        <input
                          type="text"
                          placeholder="e.g. Flat 20% Off on all Rackets • Arena Stall #2"
                          value={imageTagline}
                          onChange={(e) => setImageTagline(e.target.value)}
                          style={{
                            width: '100%',
                            padding: '10px 14px',
                            background: '#0f172a',
                            border: '1px solid rgba(148, 163, 184, 0.3)',
                            borderRadius: '8px',
                            color: '#ffffff',
                            fontSize: '13px',
                            boxSizing: 'border-box',
                          }}
                        />
                      </div>
                    </div>

                    <div>
                      <label style={{ display: 'block', fontSize: '12.5px', fontWeight: 800, color: '#38bdf8', marginBottom: '6px' }}>
                        Image Banner / Poster File
                      </label>
                      <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
                        <input
                          type="file"
                          ref={imageFileInputRef}
                          accept="image/*"
                          onChange={handleImageUpload}
                          style={{ display: 'none' }}
                        />
                        <button
                          type="button"
                          onClick={() => imageFileInputRef.current?.click()}
                          style={{
                            flex: 1,
                            padding: '10px 16px',
                            borderRadius: '8px',
                            background: 'rgba(56, 189, 248, 0.2)',
                            border: '1px solid #38bdf8',
                            color: '#38bdf8',
                            fontWeight: 800,
                            fontSize: '12.5px',
                            cursor: 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '6px',
                          }}
                        >
                          📁 Choose Image File
                        </button>
                        {imageUrl && (
                          <button
                            type="button"
                            onClick={() => setImageUrl('')}
                            style={{
                              padding: '10px 14px',
                              borderRadius: '8px',
                              background: 'rgba(239, 68, 68, 0.15)',
                              border: '1px solid rgba(239, 68, 68, 0.4)',
                              color: '#f87171',
                              fontSize: '12px',
                              fontWeight: 700,
                              cursor: 'pointer',
                            }}
                          >
                            Remove
                          </button>
                        )}
                      </div>
                      <input
                        type="url"
                        placeholder="Or paste direct image URL (e.g. https://.../banner.png)"
                        value={imageUrl.startsWith('data:') ? '✅ Image File Uploaded from Device' : imageUrl}
                        onChange={(e) => setImageUrl(e.target.value)}
                        disabled={imageUrl.startsWith('data:')}
                        style={{
                          width: '100%',
                          padding: '10px 14px',
                          background: '#0f172a',
                          border: '1px solid rgba(56, 189, 248, 0.3)',
                          borderRadius: '8px',
                          color: '#ffffff',
                          fontSize: '12.5px',
                          boxSizing: 'border-box',
                        }}
                      />
                    </div>
                  </div>

                  {/* 2. Duration & Accent Color & Action Button */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px', borderTop: '1px solid rgba(255, 255, 255, 0.08)', paddingTop: '12px', marginTop: '4px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flexWrap: 'wrap' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span style={{ fontSize: '12px', fontWeight: 800, color: '#94a3b8' }}>⏱️ Duration:</span>
                        {[5, 10, 15, 20].map((dur) => (
                          <button
                            key={dur}
                            type="button"
                            onClick={() => setImageDuration(dur)}
                            style={{
                              padding: '5px 12px',
                              borderRadius: '16px',
                              background: Number(imageDuration) === dur ? 'rgba(56, 189, 248, 0.25)' : 'rgba(255, 255, 255, 0.06)',
                              border: Number(imageDuration) === dur ? '1.5px solid #38bdf8' : '1px solid rgba(255, 255, 255, 0.12)',
                              color: Number(imageDuration) === dur ? '#38bdf8' : '#94a3b8',
                              fontSize: '12px',
                              fontWeight: 800,
                              cursor: 'pointer',
                            }}
                          >
                            {dur}s {dur === 10 ? '★' : ''}
                          </button>
                        ))}
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span style={{ fontSize: '12px', fontWeight: 800, color: '#94a3b8' }}>🎨 Color:</span>
                        {['#38bdf8', '#10b981', '#f59e0b', '#a855f7', '#ef4444'].map((col) => (
                          <button
                            key={col}
                            type="button"
                            onClick={() => setImageAccentColor(col)}
                            style={{
                              width: '24px',
                              height: '24px',
                              borderRadius: '50%',
                              backgroundColor: col,
                              border: imageAccentColor === col ? '2px solid #ffffff' : '1px solid rgba(255,255,255,0.2)',
                              cursor: 'pointer',
                              transform: imageAccentColor === col ? 'scale(1.2)' : 'scale(1)',
                              transition: 'transform 0.15s ease',
                            }}
                          />
                        ))}
                      </div>
                    </div>

                    <button
                      type="submit"
                      style={{
                        background: 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)',
                        color: '#ffffff',
                        border: 'none',
                        padding: '11px 24px',
                        borderRadius: '10px',
                        fontWeight: 900,
                        fontSize: '13.5px',
                        cursor: 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '8px',
                        boxShadow: '0 4px 16px rgba(2, 132, 199, 0.35)',
                      }}
                    >
                      <span>💾</span>
                      <span>{editingAdId ? 'Update Image Ad' : 'Save Image Ad'}</span>
                    </button>
                  </div>
                </div>
              </form>

              {/* Image Ads Table */}
              <div>
                <h4 style={{ margin: '0 0 10px', fontSize: '14px', fontWeight: 800, color: '#94a3b8' }}>
                  Active Image Posters & Banners ({imageAdsList.length})
                </h4>
                {imageAdsList.length === 0 ? (
                  <div style={{ background: 'rgba(15, 23, 42, 0.5)', padding: '16px', borderRadius: '12px', textAlign: 'center', color: '#64748b', fontSize: '13px' }}>
                    No image banners added yet. Upload an image above!
                  </div>
                ) : (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '12px' }}>
                    {imageAdsList.map((ad) => (
                      <div
                        key={ad.id}
                        style={{
                          background: '#0f172a',
                          border: `1.5px solid ${ad.accentColor || 'rgba(56, 189, 248, 0.3)'}`,
                          borderRadius: '12px',
                          padding: '12px 14px',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '8px',
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ fontWeight: 800, color: ad.accentColor || '#38bdf8', fontSize: '14px' }}>🖼️ {ad.sponsorName}</span>
                          <span style={{ fontSize: '11px', color: '#94a3b8' }}>⏱️ {ad.displayDuration || 10}s</span>
                        </div>
                        <div style={{ fontSize: '12px', color: '#cbd5e1' }}>{ad.tagline}</div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '4px' }}>
                          <button
                            type="button"
                            onClick={() => handleToggleAdActive(ad.id)}
                            style={{
                              background: ad.active !== false ? 'rgba(34, 197, 94, 0.2)' : 'rgba(148, 163, 184, 0.2)',
                              color: ad.active !== false ? '#4ade80' : '#94a3b8',
                              border: 'none',
                              borderRadius: '6px',
                              padding: '4px 8px',
                              fontSize: '11px',
                              fontWeight: 800,
                              cursor: 'pointer',
                            }}
                          >
                            {ad.active !== false ? '● ACTIVE' : '○ PAUSED'}
                          </button>
                          <div style={{ display: 'flex', gap: '6px' }}>
                            <button
                              type="button"
                              onClick={() => handleStartEditAd(ad)}
                              style={{ background: '#0284c7', color: '#fff', border: 'none', borderRadius: '6px', padding: '4px 8px', fontSize: '11px', cursor: 'pointer', fontWeight: 700 }}
                            >
                              Edit
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteAd(ad.id)}
                              style={{ background: 'rgba(239, 68, 68, 0.2)', color: '#f87171', border: 'none', borderRadius: '6px', padding: '4px 8px', fontSize: '11px', cursor: 'pointer', fontWeight: 700 }}
                            >
                              Delete
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* =====================================================
              TAB 3: 📜 TEXT TICKERS & SCROLL SPEED CONTROLS
              ===================================================== */}
          {activeTab === 'text' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 900, color: '#f59e0b', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span>📜</span>
                    <span>Live Dual Scrolling Text Tickers & Speed Controls</span>
                  </h3>
                  <p style={{ margin: '3px 0 0', fontSize: '12.5px', color: '#94a3b8' }}>
                    Customize announcements, news, sponsor messages, and precisely adjust how fast the text scrolls across the TV screen.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    handleSettingChange('topScrollingText', '🏆 Welcome to the Badminton Championship • Report to assigned courts 10 minutes prior to schedule!')
                    handleSettingChange('bottomScrollingText', '⭐ Exclusive 20% tournament discount on all rackets & pro gear at Arena Lobby Stall #1!')
                  }}
                  style={{
                    background: 'rgba(245, 158, 11, 0.12)',
                    border: '1px solid rgba(245, 158, 11, 0.3)',
                    color: '#fbbf24',
                    padding: '6px 14px',
                    borderRadius: '8px',
                    fontSize: '12px',
                    fontWeight: 700,
                    cursor: 'pointer',
                  }}
                >
                  ✨ Load Presets
                </button>
              </div>

              {/* SPEED CONTROLS CARD */}
              <div
                style={{
                  background: 'linear-gradient(135deg, rgba(245, 158, 11, 0.08) 0%, rgba(15, 23, 42, 0.7) 100%)',
                  border: '1.5px solid rgba(245, 158, 11, 0.4)',
                  borderRadius: '16px',
                  padding: '18px 20px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '14px',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <label style={{ fontSize: '13.5px', fontWeight: 900, color: '#fbbf24', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span>⚡ Text Scroll Speed Controller</span>
                  </label>
                  <span
                    style={{
                      background: 'rgba(245, 158, 11, 0.2)',
                      border: '1px solid #f59e0b',
                      color: '#fbbf24',
                      padding: '3px 10px',
                      borderRadius: '8px',
                      fontSize: '12px',
                      fontWeight: 900,
                    }}
                  >
                    🚀 Cycle Duration: {currentSpeedSeconds}s per loop
                  </span>
                </div>

                {/* 5 Quick Presets */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '8px' }}>
                  {[
                    { label: '🐢 Ultra Slow', val: 'ultra-slow', sec: 45 },
                    { label: '🚶 Slow', val: 'slow', sec: 32 },
                    { label: '⚡ Normal', val: 'normal', sec: 22 },
                    { label: '🚀 Fast', val: 'fast', sec: 14 },
                    { label: '🔥 Ultra Fast', val: 'ultra-fast', sec: 8 },
                  ].map((spd) => {
                    const isSelected = localSettings.tickerSpeed === spd.val || currentSpeedSeconds === spd.sec
                    return (
                      <button
                        key={spd.val}
                        type="button"
                        onClick={() => handleSettingChange('tickerSpeed', spd.val)}
                        style={{
                          padding: '10px 8px',
                          borderRadius: '10px',
                          border: isSelected ? '2px solid #f59e0b' : '1px solid rgba(148, 163, 184, 0.2)',
                          background: isSelected ? 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)' : '#0f172a',
                          color: isSelected ? '#ffffff' : '#cbd5e1',
                          fontWeight: 800,
                          fontSize: '12px',
                          cursor: 'pointer',
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          gap: '2px',
                          boxShadow: isSelected ? '0 4px 14px rgba(245, 158, 11, 0.35)' : 'none',
                        }}
                      >
                        <span>{spd.label}</span>
                        <span style={{ fontSize: '10px', opacity: 0.8 }}>({spd.sec}s)</span>
                      </button>
                    )
                  })}
                </div>

                {/* Interactive Fine-Tuning Slider */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginTop: '4px' }}>
                  <span style={{ fontSize: '12px', color: '#94a3b8', fontWeight: 700, minWidth: '85px' }}>
                    Fine-Tune Speed:
                  </span>
                  <input
                    type="range"
                    min="6"
                    max="60"
                    step="1"
                    value={currentSpeedSeconds}
                    onChange={(e) => handleSettingChange('tickerSpeed', Number(e.target.value))}
                    style={{ flex: 1, accentColor: '#f59e0b', cursor: 'pointer' }}
                  />
                  <span style={{ fontSize: '13px', fontWeight: 900, color: '#fbbf24', minWidth: '45px', textAlign: 'right' }}>
                    {currentSpeedSeconds}s
                  </span>
                </div>

                {/* LIVE ANIMATED TICKER SPEED SIMULATOR */}
                <div
                  style={{
                    background: '#020617',
                    border: '1px solid rgba(245, 158, 11, 0.3)',
                    borderRadius: '12px',
                    padding: '10px 14px',
                    overflow: 'hidden',
                    position: 'relative',
                  }}
                >
                  <span style={{ fontSize: '10.5px', fontWeight: 800, color: '#f59e0b', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: '6px' }}>
                    👀 Live Speed Simulator ({currentSpeedSeconds}s Loop)
                  </span>
                  <div style={{ overflow: 'hidden', whiteSpace: 'nowrap', width: '100%', position: 'relative' }}>
                    <div
                      style={{
                        display: 'inline-block',
                        whiteSpace: 'nowrap',
                        animation: `stadiumSponsorScroll ${currentSpeedSeconds}s linear infinite`,
                        fontSize: '13px',
                        fontWeight: 700,
                        color: '#fbbf24',
                      }}
                    >
                      🏸 {localSettings.topScrollingText || 'Live scrolling text preview at current speed'} • ⭐ {localSettings.bottomScrollingText || 'Adjust speed slider to change pace!'} • 
                    </div>
                  </div>
                </div>
              </div>

              {/* Row 1 Text Input */}
              <div
                style={{
                  background: 'rgba(15, 23, 42, 0.7)',
                  border: '1px solid rgba(56, 189, 248, 0.3)',
                  borderRadius: '14px',
                  padding: '16px 18px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '8px',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <label style={{ fontSize: '13px', fontWeight: 900, color: '#38bdf8' }}>
                    📢 Row 1: Top Announcement / Match News Text
                  </label>
                  <span style={{ fontSize: '11px', color: '#94a3b8' }}>
                    {(localSettings.topScrollingText || '').length} chars
                  </span>
                </div>
                <textarea
                  rows={2}
                  placeholder="e.g. 🏆 Matches are in Quarter Finals! Refreshments available at Counter 1 • Prize distribution at 6 PM."
                  value={localSettings.topScrollingText || ''}
                  onChange={(e) => handleSettingChange('topScrollingText', e.target.value)}
                  style={{
                    width: '100%',
                    padding: '10px 14px',
                    background: '#0f172a',
                    border: '1px solid rgba(56, 189, 248, 0.3)',
                    borderRadius: '8px',
                    color: '#ffffff',
                    fontSize: '13.5px',
                    lineHeight: 1.5,
                    boxSizing: 'border-box',
                    fontFamily: 'inherit',
                  }}
                />
              </div>

              {/* Row 2 Text Input */}
              <div
                style={{
                  background: 'rgba(15, 23, 42, 0.7)',
                  border: '1px solid rgba(74, 222, 128, 0.3)',
                  borderRadius: '14px',
                  padding: '16px 18px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '8px',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <label style={{ fontSize: '13px', fontWeight: 900, color: '#4ade80' }}>
                    ⭐ Row 2: Bottom Sponsor Commercial Offer Text
                  </label>
                  <span style={{ fontSize: '11px', color: '#94a3b8' }}>
                    {(localSettings.bottomScrollingText || '').length} chars
                  </span>
                </div>
                <textarea
                  rows={2}
                  placeholder="e.g. ⭐ Flat 20% tournament discount on Yonex Astrox & Victor shoes at Arena Pro Shop Stall #1!"
                  value={localSettings.bottomScrollingText || ''}
                  onChange={(e) => handleSettingChange('bottomScrollingText', e.target.value)}
                  style={{
                    width: '100%',
                    padding: '10px 14px',
                    background: '#0f172a',
                    border: '1px solid rgba(74, 222, 128, 0.3)',
                    borderRadius: '8px',
                    color: '#ffffff',
                    fontSize: '13.5px',
                    lineHeight: 1.5,
                    boxSizing: 'border-box',
                    fontFamily: 'inherit',
                  }}
                />
              </div>
            </div>
          )}

          {/* =====================================================
              TAB 4: 📋 AD LIBRARY & TIMING SETTINGS
              ===================================================== */}
          {activeTab === 'roster' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 900, color: '#a78bfa' }}>
                    📋 Master Sponsor Ad Library & Timing
                  </h3>
                  <p style={{ margin: '3px 0 0', fontSize: '12.5px', color: '#94a3b8' }}>
                    Enable, disable, or delete existing sponsors. Configure full-screen intermission rotation timers.
                  </p>
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button
                    type="button"
                    onClick={() => {
                      handleResetVideoForm()
                      setActiveTab('video')
                    }}
                    style={{
                      background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                      color: '#ffffff',
                      border: 'none',
                      padding: '7px 14px',
                      borderRadius: '8px',
                      fontSize: '12px',
                      fontWeight: 800,
                      cursor: 'pointer',
                    }}
                  >
                    + Add Video Ad
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      handleResetImageForm()
                      setActiveTab('image')
                    }}
                    style={{
                      background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
                      color: '#ffffff',
                      border: 'none',
                      padding: '7px 14px',
                      borderRadius: '8px',
                      fontSize: '12px',
                      fontWeight: 800,
                      cursor: 'pointer',
                    }}
                  >
                    + Add Image Ad
                  </button>
                </div>
              </div>

              {/* Timing & Standby Automation Controls */}
              <div
                style={{
                  background: 'rgba(139, 92, 246, 0.08)',
                  border: '1.5px solid rgba(139, 92, 246, 0.35)',
                  borderRadius: '16px',
                  padding: '16px 20px',
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                  gap: '16px',
                }}
              >
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 800, color: '#c4b5fd', marginBottom: '6px' }}>
                    📺 Repeat Interval
                  </label>
                  <select
                    value={localSettings.fullScreenIntervalMinutes || 1}
                    onChange={(e) => handleSettingChange('fullScreenIntervalMinutes', Number(e.target.value))}
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      background: '#0f172a',
                      border: '1px solid rgba(139, 92, 246, 0.3)',
                      borderRadius: '8px',
                      color: '#ffffff',
                      fontSize: '12.5px',
                    }}
                  >
                    <option value={1}>Every 1 Minute (Recommended)</option>
                    <option value={2}>Every 2 Minutes</option>
                    <option value={3}>Every 3 Minutes</option>
                    <option value={5}>Every 5 Minutes</option>
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 800, color: '#c4b5fd', marginBottom: '6px' }}>
                    ⏱️ Ad Display Duration
                  </label>
                  <select
                    value={localSettings.fullScreenDurationSeconds || 10}
                    onChange={(e) => handleSettingChange('fullScreenDurationSeconds', Number(e.target.value))}
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      background: '#0f172a',
                      border: '1px solid rgba(139, 92, 246, 0.3)',
                      borderRadius: '8px',
                      color: '#ffffff',
                      fontSize: '12.5px',
                    }}
                  >
                    <option value={5}>5 Seconds</option>
                    <option value={8}>8 Seconds</option>
                    <option value={10}>10 Seconds (Recommended)</option>
                    <option value={15}>15 Seconds</option>
                    <option value={20}>20 Seconds</option>
                    <option value={30}>30 Seconds</option>
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 800, color: '#c4b5fd', marginBottom: '6px' }}>
                    🎭 Public Page Display Mode
                  </label>
                  <select
                    value={localSettings.publicDisplayMode || 'periodic'}
                    onChange={(e) => handleSettingChange('publicDisplayMode', e.target.value)}
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      background: '#0f172a',
                      border: '1px solid rgba(139, 92, 246, 0.3)',
                      borderRadius: '8px',
                      color: '#ffffff',
                      fontSize: '12.5px',
                    }}
                  >
                    <option value="periodic">🔄 Periodic Pop-in (Show 10s, auto-hide, repeat every 1m)</option>
                    <option value="static">📌 Always Fixed / Static (Permanently on screen)</option>
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 800, color: '#c4b5fd', marginBottom: '6px' }}>
                    🔇 Video Sound Mode
                  </label>
                  <select
                    value={localSettings.videoMuted !== false ? 'muted' : 'unmuted'}
                    onChange={(e) => handleSettingChange('videoMuted', e.target.value === 'muted')}
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      background: '#0f172a',
                      border: '1px solid rgba(139, 92, 246, 0.3)',
                      borderRadius: '8px',
                      color: '#ffffff',
                      fontSize: '12.5px',
                    }}
                  >
                    <option value="muted">🔇 Mute Videos (Quiet Live Cast)</option>
                    <option value="unmuted">🔊 Enable Audio (Sound ON)</option>
                  </select>
                </div>
              </div>

              {/* Informative timing summary badge */}
              <div
                style={{
                  background: 'rgba(56, 189, 248, 0.1)',
                  border: '1px solid rgba(56, 189, 248, 0.3)',
                  borderRadius: '10px',
                  padding: '10px 14px',
                  marginTop: '12px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  fontSize: '12px',
                  color: '#93c5fd',
                }}
              >
                <span>💡</span>
                <span>
                  <strong>Active Ad Rule:</strong> Ads will appear on screen for <strong>{localSettings.fullScreenDurationSeconds || 10} seconds</strong>, then smoothly hide and re-appear every <strong>{localSettings.fullScreenIntervalMinutes || 1} minute</strong>.
                </span>
              </div>

              {/* Master Ad Cards List */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(290px, 1fr))', gap: '14px' }}>
                {localAds.map((ad) => {
                  const isVideo = ad.mediaType === 'video' || Boolean(ad.videoUrl)
                  return (
                    <div
                      key={ad.id}
                      style={{
                        background: '#0f172a',
                        border: `1.5px solid ${isVideo ? '#10b981' : (ad.accentColor || '#38bdf8')}`,
                        borderRadius: '14px',
                        padding: '16px',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '10px',
                        opacity: ad.active !== false ? 1 : 0.6,
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span
                          style={{
                            background: isVideo ? 'rgba(16, 185, 129, 0.2)' : 'rgba(56, 189, 248, 0.2)',
                            color: isVideo ? '#34d399' : '#38bdf8',
                            fontSize: '11px',
                            fontWeight: 900,
                            padding: '3px 8px',
                            borderRadius: '6px',
                          }}
                        >
                          {isVideo ? '🎬 VIDEO AD' : '🖼️ IMAGE AD'}
                        </span>
                        <span style={{ fontSize: '11.5px', color: '#94a3b8' }}>⏱️ {ad.displayDuration || 10}s</span>
                      </div>

                      <div>
                        <h4 style={{ margin: 0, fontSize: '15px', fontWeight: 900, color: '#f8fafc' }}>
                          {ad.sponsorName}
                        </h4>
                        <p style={{ margin: '3px 0 0', fontSize: '12px', color: '#94a3b8', lineHeight: 1.4 }}>
                          {ad.tagline}
                        </p>
                      </div>

                      {ad.phoneOrLink && (
                        <div style={{ fontSize: '11px', color: '#64748b' }}>
                          📍 {ad.phoneOrLink}
                        </div>
                      )}

                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 'auto', paddingTop: '8px', borderTop: '1px solid rgba(148, 163, 184, 0.1)' }}>
                        <button
                          type="button"
                          onClick={() => handleToggleAdActive(ad.id)}
                          style={{
                            background: ad.active !== false ? 'rgba(34, 197, 94, 0.2)' : 'rgba(148, 163, 184, 0.2)',
                            color: ad.active !== false ? '#4ade80' : '#94a3b8',
                            border: 'none',
                            borderRadius: '6px',
                            padding: '5px 10px',
                            fontSize: '11.5px',
                            fontWeight: 800,
                            cursor: 'pointer',
                          }}
                        >
                          {ad.active !== false ? '● ACTIVE' : '○ PAUSED'}
                        </button>
                        <div style={{ display: 'flex', gap: '6px' }}>
                          <button
                            type="button"
                            onClick={() => handleStartEditAd(ad)}
                            style={{
                              background: '#0284c7',
                              color: '#ffffff',
                              border: 'none',
                              borderRadius: '6px',
                              padding: '5px 10px',
                              fontSize: '11.5px',
                              fontWeight: 700,
                              cursor: 'pointer',
                            }}
                          >
                            ✏️ Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteAd(ad.id)}
                            style={{
                              background: 'rgba(239, 68, 68, 0.2)',
                              color: '#f87171',
                              border: 'none',
                              borderRadius: '6px',
                              padding: '5px 10px',
                              fontSize: '11.5px',
                              fontWeight: 700,
                              cursor: 'pointer',
                            }}
                          >
                            🗑️ Delete
                          </button>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

        </div>

        {/* Modal Bottom Footer */}
        <div
          style={{
            padding: '14px 26px',
            borderTop: '1px solid rgba(148, 163, 184, 0.12)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            background: 'rgba(15, 23, 42, 0.95)',
          }}
        >
          <span style={{ fontSize: '12px', color: '#94a3b8' }}>
            ⚡ All changes sync instantly to Stadium TV Live Cast in real-time.
          </span>
          <button
            type="button"
            onClick={onClose}
            style={{
              background: 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)',
              color: '#ffffff',
              border: 'none',
              borderRadius: '10px',
              padding: '10px 24px',
              fontWeight: 900,
              fontSize: '13.5px',
              cursor: 'pointer',
              boxShadow: '0 4px 14px rgba(2, 132, 199, 0.35)',
            }}
          >
            ✓ Done / Close
          </button>
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      {deleteAdConfirm && (
        <ConfirmDeleteModal
          isOpen={true}
          title={deleteAdConfirm.title}
          message={deleteAdConfirm.message}
          itemName={deleteAdConfirm.itemName}
          confirmText="🗑️ Yes, Delete Ad"
          cancelText="✕ Cancel"
          onConfirm={deleteAdConfirm.onConfirm}
          onClose={() => setDeleteAdConfirm(null)}
        />
      )}
    </div>
  )
}
