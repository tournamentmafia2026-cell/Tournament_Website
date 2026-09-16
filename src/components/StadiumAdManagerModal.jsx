import React, { useState, useRef } from 'react'
import { DEFAULT_SPONSOR_ADS, DEFAULT_AD_SETTINGS } from './stadiumAdConstants'
import { ConfirmDeleteModal } from './ConfirmDeleteModal'

const ACCENT_COLORS = [
  { label: 'Sky Blue', value: '#38bdf8' },
  { label: 'Amber Gold', value: '#f59e0b' },
  { label: 'Emerald Green', value: '#10b981' },
  { label: 'Purple', value: '#a855f7' },
  { label: 'Rose Red', value: '#f43f5e' },
  { label: 'Orange', value: '#f97316' },
]

export const StadiumAdManagerModal = ({
  isOpen,
  onClose,
  ads = [],
  onSaveAds,
  adSettings = DEFAULT_AD_SETTINGS,
  onSaveSettings,
}) => {
  const [activeTab, setActiveTab] = useState('sponsors') // 'sponsors' | 'settings'
  const [localAds, setLocalAds] = useState(() => (ads && ads.length > 0 ? ads : DEFAULT_SPONSOR_ADS))
  const [localSettings, setLocalSettings] = useState(() => ({ ...DEFAULT_AD_SETTINGS, ...adSettings }))

  // Form State for Add / Edit
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [editingAdId, setEditingAdId] = useState(null)
  const [formSponsorName, setFormSponsorName] = useState('')
  const [formTagline, setFormTagline] = useState('')
  const [formDescription, setFormDescription] = useState('')
  const [formMediaType, setFormMediaType] = useState('image') // 'image' | 'video'
  const [formMediaUrl, setFormMediaUrl] = useState('')
  const [formPhoneOrLink, setFormPhoneOrLink] = useState('')
  const [formAccentColor, setFormAccentColor] = useState('#38bdf8')
  const [formDuration, setFormDuration] = useState(10)
  const [deleteConfirmAd, setDeleteConfirmAd] = useState(null)

  const fileInputRef = useRef(null)

  if (!isOpen) return null

  // Open Form to Add New
  const handleOpenAddNew = () => {
    setEditingAdId(null)
    setFormSponsorName('')
    setFormTagline('')
    setFormDescription('')
    setFormMediaType('image')
    setFormMediaUrl('')
    setFormPhoneOrLink('')
    setFormAccentColor('#38bdf8')
    setFormDuration(10)
    setIsFormOpen(true)
  }

  // Open Form to Edit Existing
  const handleOpenEdit = (ad) => {
    setEditingAdId(ad.id)
    setFormSponsorName(ad.sponsorName || '')
    setFormTagline(ad.tagline || '')
    setFormDescription(ad.description || '')
    setFormMediaType(ad.mediaType === 'video' || ad.videoUrl ? 'video' : 'image')
    setFormMediaUrl(ad.videoUrl || ad.logoUrl || '')
    setFormPhoneOrLink(ad.phoneOrLink || '')
    setFormAccentColor(ad.accentColor || '#38bdf8')
    setFormDuration(Number(ad.displayDuration) || 10)
    setIsFormOpen(true)
  }

  // Handle Local File Upload
  const handleFileUpload = (e) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (formMediaType === 'video') {
      if (file.size > 50 * 1024 * 1024) {
        alert('Video file is larger than 50MB. Please use a smaller file or paste a video URL.')
        return
      }
    } else {
      if (file.size > 8 * 1024 * 1024) {
        alert('Image is larger than 8MB. Please choose a smaller image.')
        return
      }
    }

    const reader = new FileReader()
    reader.onloadend = () => {
      setFormMediaUrl(reader.result)
    }
    reader.readAsDataURL(file)
  }

  // Save Sponsor Ad
  const handleSaveForm = (e) => {
    e?.preventDefault()
    if (!formSponsorName.trim()) {
      alert('Please enter a Brand / Sponsor Name.')
      return
    }

    const newAd = {
      id: editingAdId || `sponsor-${Date.now()}`,
      sponsorName: formSponsorName.trim(),
      mediaType: formMediaType,
      tagline: formTagline.trim() || `${formSponsorName.trim()} • Official Partner`,
      description: formDescription.trim(),
      ctaText: 'Official Partner',
      phoneOrLink: formPhoneOrLink.trim(),
      accentColor: formAccentColor,
      logoUrl: formMediaType === 'image' ? formMediaUrl.trim() : '',
      videoUrl: formMediaType === 'video' ? formMediaUrl.trim() : '',
      active: true,
      displayDuration: Number(formDuration) || 10,
    }

    let updatedList
    if (editingAdId) {
      updatedList = localAds.map((a) => (a.id === editingAdId ? { ...a, ...newAd } : a))
    } else {
      updatedList = [newAd, ...localAds]
    }

    setLocalAds(updatedList)
    if (onSaveAds) onSaveAds(updatedList)
    setIsFormOpen(false)
    setEditingAdId(null)
  }

  // Toggle Active/Inactive
  const handleToggleActive = (id) => {
    const updated = localAds.map((a) => (a.id === id ? { ...a, active: a.active === false } : a))
    setLocalAds(updated)
    if (onSaveAds) onSaveAds(updated)
  }

  // Delete Sponsor
  const handleDeleteSponsor = () => {
    if (!deleteConfirmAd) return
    const updated = localAds.filter((a) => a.id !== deleteConfirmAd.id)
    setLocalAds(updated)
    if (onSaveAds) onSaveAds(updated)
    setDeleteConfirmAd(null)
  }

  // Update Ad Settings
  const handleUpdateSetting = (key, value) => {
    const next = { ...localSettings, [key]: value }
    setLocalSettings(next)
    if (onSaveSettings) onSaveSettings(next)
  }

  // Reset to Defaults
  const handleResetDefaults = () => {
    if (window.confirm('Reset all ads & settings to standard defaults?')) {
      setLocalAds(DEFAULT_SPONSOR_ADS)
      setLocalSettings(DEFAULT_AD_SETTINGS)
      if (onSaveAds) onSaveAds(DEFAULT_SPONSOR_ADS)
      if (onSaveSettings) onSaveSettings(DEFAULT_AD_SETTINGS)
    }
  }

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(2, 6, 23, 0.85)',
        backdropFilter: 'blur(8px)',
        zIndex: 99999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px',
        animation: 'fadeIn 0.2s ease-out',
      }}
      onClick={onClose}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '860px',
          maxHeight: '92vh',
          backgroundColor: '#0f172a',
          border: '1.5px solid #334155',
          borderRadius: '20px',
          boxShadow: '0 25px 60px rgba(0, 0, 0, 0.7), 0 0 30px rgba(56, 189, 248, 0.15)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          color: '#f8fafc',
          fontFamily: "'Outfit', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* MODAL HEADER */}
        <div
          style={{
            padding: '18px 24px',
            background: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)',
            borderBottom: '1.5px solid #334155',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <span style={{ fontSize: '26px' }}>📢</span>
            <div>
              <h2 style={{ margin: 0, fontSize: '19px', fontWeight: '900', color: '#ffffff', letterSpacing: '-0.02em' }}>
                Ads & Sponsors Manager
              </h2>
              <p style={{ margin: '2px 0 0', fontSize: '12.5px', color: '#94a3b8' }}>
                Manage live stream banners, sponsor slideshow, and broadcast timing
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            style={{
              background: 'rgba(255, 255, 255, 0.08)',
              border: '1px solid rgba(255, 255, 255, 0.15)',
              color: '#94a3b8',
              width: '34px',
              height: '34px',
              borderRadius: '10px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '16px',
              fontWeight: '900',
              cursor: 'pointer',
              transition: 'all 0.2s',
            }}
          >
            ✕
          </button>
        </div>

        {/* NAVIGATION TABS */}
        <div
          style={{
            display: 'flex',
            gap: '8px',
            padding: '12px 24px',
            background: '#0b1120',
            borderBottom: '1px solid #1e293b',
          }}
        >
          <button
            type="button"
            onClick={() => setActiveTab('sponsors')}
            style={{
              padding: '9px 18px',
              borderRadius: '10px',
              fontSize: '13.5px',
              fontWeight: '800',
              cursor: 'pointer',
              border: activeTab === 'sponsors' ? '1.5px solid #38bdf8' : '1px solid transparent',
              background: activeTab === 'sponsors' ? 'rgba(56, 189, 248, 0.15)' : 'transparent',
              color: activeTab === 'sponsors' ? '#38bdf8' : '#94a3b8',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              transition: 'all 0.2s',
            }}
          >
            <span>⭐ Sponsors List</span>
            <span
              style={{
                background: activeTab === 'sponsors' ? '#0284c7' : '#334155',
                color: '#ffffff',
                padding: '2px 7px',
                borderRadius: '999px',
                fontSize: '11px',
                fontWeight: '900',
              }}
            >
              {localAds.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('settings')}
            style={{
              padding: '9px 18px',
              borderRadius: '10px',
              fontSize: '13.5px',
              fontWeight: '800',
              cursor: 'pointer',
              border: activeTab === 'settings' ? '1.5px solid #38bdf8' : '1px solid transparent',
              background: activeTab === 'settings' ? 'rgba(56, 189, 248, 0.15)' : 'transparent',
              color: activeTab === 'settings' ? '#38bdf8' : '#94a3b8',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              transition: 'all 0.2s',
            }}
          >
            <span>⚙️ Broadcast Timing & Tickers</span>
          </button>
        </div>

        {/* MODAL BODY (SCROLLABLE) */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px' }}>
          {activeTab === 'sponsors' ? (
            <div>
              {/* Top Action Bar */}
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: '16px',
                }}
              >
                <div>
                  <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '800', color: '#f8fafc' }}>
                    Active Tournament Sponsors ({localAds.filter((a) => a.active !== false).length} Active)
                  </h3>
                  <p style={{ margin: '2px 0 0', fontSize: '12px', color: '#94a3b8' }}>
                    Sponsors rotate every 10 seconds automatically on the Live Cast screen.
                  </p>
                </div>

                {!isFormOpen && (
                  <button
                    type="button"
                    onClick={handleOpenAddNew}
                    style={{
                      background: 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)',
                      border: '1.5px solid #38bdf8',
                      color: '#ffffff',
                      padding: '8px 18px',
                      borderRadius: '10px',
                      fontSize: '13px',
                      fontWeight: '800',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      boxShadow: '0 4px 12px rgba(2, 132, 199, 0.35)',
                    }}
                  >
                    <span>➕ Add Sponsor</span>
                  </button>
                )}
              </div>

              {/* ADD / EDIT SPONSOR FORM */}
              {isFormOpen && (
                <form
                  onSubmit={handleSaveForm}
                  style={{
                    background: '#1e293b',
                    border: '1.5px solid #38bdf8',
                    borderRadius: '16px',
                    padding: '20px',
                    marginBottom: '24px',
                    boxShadow: '0 10px 30px rgba(0, 0, 0, 0.4)',
                    animation: 'fadeIn 0.25s ease-out',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                    <h4 style={{ margin: 0, fontSize: '15px', fontWeight: '900', color: '#38bdf8' }}>
                      {editingAdId ? '✏️ Edit Sponsor' : '✨ Add New Sponsor'}
                    </h4>
                    <button
                      type="button"
                      onClick={() => setIsFormOpen(false)}
                      style={{ background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer', fontWeight: '800' }}
                    >
                      ✕ Cancel
                    </button>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '14px', marginBottom: '14px' }}>
                    {/* Brand Name */}
                    <div>
                      <label style={{ display: 'block', fontSize: '12px', fontWeight: '800', color: '#cbd5e1', marginBottom: '4px' }}>
                        Brand / Sponsor Name *
                      </label>
                      <input
                        type="text"
                        value={formSponsorName}
                        onChange={(e) => setFormSponsorName(e.target.value)}
                        placeholder="e.g. YONEX / VICTOR / ACADEMY"
                        style={{
                          width: '100%',
                          background: '#0f172a',
                          border: '1.5px solid #334155',
                          borderRadius: '8px',
                          padding: '8px 12px',
                          color: '#ffffff',
                          fontSize: '13px',
                          outline: 'none',
                        }}
                        required
                      />
                    </div>

                    {/* Tagline / Offer */}
                    <div>
                      <label style={{ display: 'block', fontSize: '12px', fontWeight: '800', color: '#cbd5e1', marginBottom: '4px' }}>
                        Offer / Tagline Headline
                      </label>
                      <input
                        type="text"
                        value={formTagline}
                        onChange={(e) => setFormTagline(e.target.value)}
                        placeholder="e.g. Flat 20% Off on Rackets at Stall #1"
                        style={{
                          width: '100%',
                          background: '#0f172a',
                          border: '1.5px solid #334155',
                          borderRadius: '8px',
                          padding: '8px 12px',
                          color: '#ffffff',
                          fontSize: '13px',
                          outline: 'none',
                        }}
                      />
                    </div>
                  </div>

                  {/* Media Type & Upload */}
                  <div style={{ background: '#0f172a', padding: '14px', borderRadius: '12px', border: '1px solid #334155', marginBottom: '14px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '10px' }}>
                      <span style={{ fontSize: '12px', fontWeight: '800', color: '#cbd5e1' }}>Media Type:</span>
                      <button
                        type="button"
                        onClick={() => setFormMediaType('image')}
                        style={{
                          background: formMediaType === 'image' ? '#0284c7' : '#1e293b',
                          color: '#ffffff',
                          border: '1px solid #38bdf8',
                          padding: '4px 12px',
                          borderRadius: '6px',
                          fontSize: '12px',
                          fontWeight: '800',
                          cursor: 'pointer',
                        }}
                      >
                        🖼️ Image / Banner
                      </button>
                      <button
                        type="button"
                        onClick={() => setFormMediaType('video')}
                        style={{
                          background: formMediaType === 'video' ? '#0284c7' : '#1e293b',
                          color: '#ffffff',
                          border: '1px solid #38bdf8',
                          padding: '4px 12px',
                          borderRadius: '6px',
                          fontSize: '12px',
                          fontWeight: '800',
                          cursor: 'pointer',
                        }}
                      >
                        🎬 Video Ad
                      </button>
                    </div>

                    <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                      <input
                        type="text"
                        value={formMediaUrl}
                        onChange={(e) => setFormMediaUrl(e.target.value)}
                        placeholder={formMediaType === 'video' ? 'Paste Video URL (or upload below)' : 'Paste Image URL (or upload below)'}
                        style={{
                          flex: 1,
                          background: '#1e293b',
                          border: '1.5px solid #334155',
                          borderRadius: '8px',
                          padding: '8px 12px',
                          color: '#ffffff',
                          fontSize: '12.5px',
                          outline: 'none',
                        }}
                      />
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept={formMediaType === 'video' ? 'video/*' : 'image/*'}
                        style={{ display: 'none' }}
                        onChange={handleFileUpload}
                      />
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        style={{
                          background: '#334155',
                          border: '1px solid #475569',
                          color: '#f8fafc',
                          padding: '8px 14px',
                          borderRadius: '8px',
                          fontSize: '12px',
                          fontWeight: '800',
                          cursor: 'pointer',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        📁 Choose File
                      </button>
                    </div>

                    {/* Preview */}
                    {formMediaUrl && (
                      <div style={{ marginTop: '10px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <span style={{ fontSize: '11px', color: '#94a3b8' }}>Preview:</span>
                        {formMediaType === 'video' ? (
                          <video src={formMediaUrl} autoPlay muted loop style={{ height: '48px', borderRadius: '6px' }} />
                        ) : (
                          <img src={formMediaUrl} alt="Preview" style={{ height: '48px', borderRadius: '6px', objectFit: 'contain' }} />
                        )}
                        <button
                          type="button"
                          onClick={() => setFormMediaUrl('')}
                          style={{ background: 'transparent', border: 'none', color: '#ef4444', fontSize: '11px', cursor: 'pointer', fontWeight: '800' }}
                        >
                          Remove Media
                        </button>
                      </div>
                    )}
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '14px', marginBottom: '16px' }}>
                    {/* Website / Phone / Location */}
                    <div>
                      <label style={{ display: 'block', fontSize: '12px', fontWeight: '800', color: '#cbd5e1', marginBottom: '4px' }}>
                        Website / Phone / Stall # (Optional)
                      </label>
                      <input
                        type="text"
                        value={formPhoneOrLink}
                        onChange={(e) => setFormPhoneOrLink(e.target.value)}
                        placeholder="e.g. www.brand.com / +91 98765 43210"
                        style={{
                          width: '100%',
                          background: '#0f172a',
                          border: '1.5px solid #334155',
                          borderRadius: '8px',
                          padding: '8px 12px',
                          color: '#ffffff',
                          fontSize: '13px',
                          outline: 'none',
                        }}
                      />
                    </div>

                    {/* Accent Color */}
                    <div>
                      <label style={{ display: 'block', fontSize: '12px', fontWeight: '800', color: '#cbd5e1', marginBottom: '6px' }}>
                        Theme Color
                      </label>
                      <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                        {ACCENT_COLORS.map((c) => (
                          <button
                            key={c.value}
                            type="button"
                            onClick={() => setFormAccentColor(c.value)}
                            style={{
                              width: '24px',
                              height: '24px',
                              borderRadius: '50%',
                              backgroundColor: c.value,
                              border: formAccentColor === c.value ? '2.5px solid #ffffff' : 'none',
                              cursor: 'pointer',
                              padding: 0,
                            }}
                            title={c.label}
                          />
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Form Submit Actions */}
                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                    <button
                      type="button"
                      onClick={() => setIsFormOpen(false)}
                      style={{
                        background: '#334155',
                        border: 'none',
                        color: '#cbd5e1',
                        padding: '8px 16px',
                        borderRadius: '8px',
                        fontSize: '13px',
                        fontWeight: '800',
                        cursor: 'pointer',
                      }}
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      style={{
                        background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                        border: 'none',
                        color: '#ffffff',
                        padding: '8px 20px',
                        borderRadius: '8px',
                        fontSize: '13px',
                        fontWeight: '900',
                        cursor: 'pointer',
                        boxShadow: '0 4px 12px rgba(16, 185, 129, 0.35)',
                      }}
                    >
                      💾 Save Sponsor
                    </button>
                  </div>
                </form>
              )}

              {/* SPONSOR ADS LIST */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {localAds.map((ad, idx) => {
                  const isActive = ad.active !== false
                  return (
                    <div
                      key={ad.id || idx}
                      style={{
                        background: isActive ? '#1e293b' : '#0f172a',
                        border: `1.5px solid ${isActive ? '#334155' : '#1e293b'}`,
                        borderRadius: '14px',
                        padding: '14px 18px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: '14px',
                        opacity: isActive ? 1 : 0.6,
                        transition: 'all 0.2s',
                      }}
                    >
                      {/* Left: Thumbnail & Info */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flex: 1, minWidth: 0 }}>
                        {/* Thumbnail */}
                        <div
                          style={{
                            width: '56px',
                            height: '56px',
                            borderRadius: '10px',
                            background: '#030712',
                            border: `1.5px solid ${ad.accentColor || '#38bdf8'}40`,
                            overflow: 'hidden',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            flexShrink: 0,
                          }}
                        >
                          {ad.mediaType === 'video' || ad.videoUrl ? (
                            <span style={{ fontSize: '20px' }}>🎬</span>
                          ) : ad.logoUrl ? (
                            <img src={ad.logoUrl} alt={ad.sponsorName} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                          ) : (
                            <span style={{ fontSize: '22px' }}>⭐</span>
                          )}
                        </div>

                        {/* Text Info */}
                        <div style={{ minWidth: 0 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '3px' }}>
                            <h4 style={{ margin: 0, fontSize: '15px', fontWeight: '900', color: '#ffffff' }}>
                              {ad.sponsorName}
                            </h4>
                            <span
                              style={{
                                fontSize: '10px',
                                fontWeight: '900',
                                color: ad.accentColor || '#38bdf8',
                                background: `${ad.accentColor || '#38bdf8'}18`,
                                padding: '2px 8px',
                                borderRadius: '4px',
                                textTransform: 'uppercase',
                              }}
                            >
                              {ad.mediaType === 'video' ? '🎬 Video' : '🖼️ Image'}
                            </span>
                          </div>

                          <p
                            style={{
                              margin: 0,
                              fontSize: '12.5px',
                              color: '#94a3b8',
                              whiteSpace: 'nowrap',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                            }}
                          >
                            {ad.tagline || 'Official Tournament Partner'}
                          </p>

                          {ad.phoneOrLink && (
                            <span style={{ fontSize: '11px', color: '#38bdf8', fontWeight: '700', marginTop: '2px', display: 'inline-block' }}>
                              📍 {ad.phoneOrLink}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Right: Actions & Toggle */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
                        <button
                          type="button"
                          onClick={() => handleToggleActive(ad.id)}
                          style={{
                            background: isActive ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                            border: `1px solid ${isActive ? '#10b981' : '#ef4444'}`,
                            color: isActive ? '#34d399' : '#f87171',
                            padding: '5px 12px',
                            borderRadius: '8px',
                            fontSize: '11.5px',
                            fontWeight: '800',
                            cursor: 'pointer',
                          }}
                        >
                          {isActive ? '● Active' : '○ Hidden'}
                        </button>

                        <button
                          type="button"
                          onClick={() => handleOpenEdit(ad)}
                          style={{
                            background: '#334155',
                            border: '1px solid #475569',
                            color: '#ffffff',
                            padding: '6px 12px',
                            borderRadius: '8px',
                            fontSize: '12px',
                            fontWeight: '800',
                            cursor: 'pointer',
                          }}
                        >
                          ✏️ Edit
                        </button>

                        <button
                          type="button"
                          onClick={() => setDeleteConfirmAd(ad)}
                          style={{
                            background: 'rgba(239, 68, 68, 0.15)',
                            border: '1px solid rgba(239, 68, 68, 0.4)',
                            color: '#fca5a5',
                            padding: '6px 10px',
                            borderRadius: '8px',
                            fontSize: '12px',
                            cursor: 'pointer',
                          }}
                          title="Delete Sponsor"
                        >
                          🗑️
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          ) : (
            /* TAB 2: BROADCAST & TIMING SETTINGS */
            <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
              {/* Card 1: Live Ad Interval */}
              <div style={{ background: '#1e293b', border: '1.5px solid #334155', borderRadius: '14px', padding: '18px' }}>
                <h4 style={{ margin: '0 0 6px', fontSize: '15px', fontWeight: '900', color: '#f8fafc' }}>
                  ⏱️ Ad Frequency During Live Matches
                </h4>
                <p style={{ margin: '0 0 14px', fontSize: '12.5px', color: '#94a3b8' }}>
                  When matches are live, ads will popup for 10 seconds, then return automatically to the live match stream.
                </p>

                <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                  {[
                    { label: 'Every 1 Minute', value: 1 },
                    { label: 'Every 2 Minutes', value: 2 },
                    { label: 'Every 5 Minutes', value: 5 },
                    { label: 'Every 10 Minutes', value: 10 },
                  ].map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => handleUpdateSetting('fullScreenIntervalMinutes', opt.value)}
                      style={{
                        background: localSettings.fullScreenIntervalMinutes === opt.value ? '#0284c7' : '#0f172a',
                        border: localSettings.fullScreenIntervalMinutes === opt.value ? '1.5px solid #38bdf8' : '1px solid #334155',
                        color: '#ffffff',
                        padding: '8px 16px',
                        borderRadius: '8px',
                        fontSize: '13px',
                        fontWeight: '800',
                        cursor: 'pointer',
                        transition: 'all 0.2s',
                      }}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Card 2: Top Scrolling Announcement Text */}
              <div style={{ background: '#1e293b', border: '1.5px solid #334155', borderRadius: '14px', padding: '18px' }}>
                <h4 style={{ margin: '0 0 6px', fontSize: '15px', fontWeight: '900', color: '#f8fafc' }}>
                  📢 Top Scrolling Announcement Text
                </h4>
                <p style={{ margin: '0 0 10px', fontSize: '12.5px', color: '#94a3b8' }}>
                  This message scrolls continuously at the top of the TV scoreboard.
                </p>

                <input
                  type="text"
                  value={localSettings.topScrollingText || ''}
                  onChange={(e) => handleUpdateSetting('topScrollingText', e.target.value)}
                  placeholder="e.g. 🏆 Welcome to the Championship • Please report to assigned court 10 mins early."
                  style={{
                    width: '100%',
                    background: '#0f172a',
                    border: '1.5px solid #334155',
                    borderRadius: '8px',
                    padding: '10px 14px',
                    color: '#ffffff',
                    fontSize: '13px',
                    outline: 'none',
                  }}
                />
              </div>

              {/* Card 3: Bottom Sponsor Ticker Text */}
              <div style={{ background: '#1e293b', border: '1.5px solid #334155', borderRadius: '14px', padding: '18px' }}>
                <h4 style={{ margin: '0 0 6px', fontSize: '15px', fontWeight: '900', color: '#f8fafc' }}>
                  🏷️ Bottom Official Sponsor Scrolling Ticker
                </h4>
                <p style={{ margin: '0 0 10px', fontSize: '12.5px', color: '#94a3b8' }}>
                  Promotional text scrolling across the bottom banner of the Live Cast.
                </p>

                <input
                  type="text"
                  value={localSettings.bottomScrollingText || ''}
                  onChange={(e) => handleUpdateSetting('bottomScrollingText', e.target.value)}
                  placeholder="e.g. ⭐ Special Offer: Flat 20% off on all pro badminton gear at Arena Lobby Stall #1!"
                  style={{
                    width: '100%',
                    background: '#0f172a',
                    border: '1.5px solid #334155',
                    borderRadius: '8px',
                    padding: '10px 14px',
                    color: '#ffffff',
                    fontSize: '13px',
                    outline: 'none',
                  }}
                />
              </div>

              {/* Reset Defaults */}
              <div style={{ display: 'flex', justifyContent: 'flex-start', marginTop: '10px' }}>
                <button
                  type="button"
                  onClick={handleResetDefaults}
                  style={{
                    background: 'transparent',
                    border: '1px solid #475569',
                    color: '#94a3b8',
                    padding: '8px 16px',
                    borderRadius: '8px',
                    fontSize: '12px',
                    fontWeight: '800',
                    cursor: 'pointer',
                  }}
                >
                  ↺ Reset All to Defaults
                </button>
              </div>
            </div>
          )}
        </div>

        {/* FOOTER */}
        <div
          style={{
            padding: '14px 24px',
            background: '#0b1120',
            borderTop: '1.5px solid #334155',
            display: 'flex',
            justifyContent: 'flex-end',
          }}
        >
          <button
            type="button"
            onClick={onClose}
            style={{
              background: 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)',
              border: 'none',
              color: '#ffffff',
              padding: '9px 24px',
              borderRadius: '10px',
              fontSize: '13.5px',
              fontWeight: '900',
              cursor: 'pointer',
              boxShadow: '0 4px 12px rgba(2, 132, 199, 0.35)',
            }}
          >
            Done / Close
          </button>
        </div>
      </div>

      {/* Delete Confirmation Dialog */}
      <ConfirmDeleteModal
        isOpen={Boolean(deleteConfirmAd)}
        onClose={() => setDeleteConfirmAd(null)}
        onConfirm={handleDeleteSponsor}
        title="Delete Sponsor"
        message={`Are you sure you want to remove ${deleteConfirmAd?.sponsorName || 'this sponsor'}?`}
      />
    </div>
  )
}
