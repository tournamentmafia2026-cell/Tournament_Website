export const DEFAULT_SPONSOR_ADS = [
  {
    id: 'ad-1',
    sponsorName: 'YONEX',
    mediaType: 'image',
    tagline: 'Official Shuttlecock & Tournament Equipment Partner • Far Beyond Ordinary',
    description: 'Explore the revolutionary Astrox & Nanoflare Series rackets. Trusted by world champions across BWF tournaments worldwide.',
    ctaText: 'Visit Pro Stall #1',
    phoneOrLink: 'www.yonex.com',
    accentColor: '#38bdf8',
    logoUrl: 'https://images.unsplash.com/photo-1626224583764-f87db24ac4ea?w=400&auto=format&fit=crop&q=80',
    videoUrl: '',
    active: true,
    displayDuration: 12,
  },
  {
    id: 'ad-2',
    sponsorName: 'VICTOR SPORTS',
    mediaType: 'image',
    tagline: 'Exclusive 20% Tournament Discount on all Rackets & Shoes at the Arena Lobby!',
    description: 'Special tournament offer: Flat 20% off on all Victor Thruster & Auraspeed series when you show your participant badge.',
    ctaText: 'Stall #2 Arena Lobby',
    phoneOrLink: '+91 98765 43210',
    accentColor: '#f59e0b',
    logoUrl: 'https://images.unsplash.com/photo-1613918108466-292b78a8ef95?w=400&auto=format&fit=crop&q=80',
    videoUrl: '',
    active: true,
    displayDuration: 10,
  },
  {
    id: 'ad-3',
    sponsorName: 'HYDRATE+ ISOTONIC',
    mediaType: 'video',
    tagline: 'Electrolytes & Rapid Hydration for Peak Badminton Performance!',
    description: 'Instant recovery & stamina replenishment between sets. Grab your free ice-cold electrolyte drink at refreshment counters 1 & 2.',
    ctaText: 'Free Samples at Counters 1 & 2',
    phoneOrLink: 'Counters 1 & 2',
    accentColor: '#10b981',
    logoUrl: '',
    videoUrl: 'https://assets.mixkit.co/videos/preview/mixkit-badminton-player-hitting-a-shuttlecock-41619-large.mp4',
    active: true,
    displayDuration: 15,
  },
  {
    id: 'ad-4',
    sponsorName: 'PRIME SMASH ACADEMY',
    mediaType: 'image',
    tagline: 'High-Performance Professional Badminton Coaching • Summer Batches Open!',
    description: 'State-of-the-art wooden synthetic courts, BWF certified international coaches, video analysis, and fitness conditioning programs.',
    ctaText: 'Admissions Open • Register Today',
    phoneOrLink: '+91 99887 76655',
    accentColor: '#a855f7',
    logoUrl: 'https://images.unsplash.com/photo-1599586120429-48281b6f0ece?w=400&auto=format&fit=crop&q=80',
    videoUrl: '',
    active: true,
    displayDuration: 10,
  },
]

export const DEFAULT_AD_SETTINGS = {
  showBannerBar: true,
  showInTicker: true,
  showOnPublicPage: true, // Show Sponsor Banners & Tickers on Public Spectator & Fixtures Page
  publicDisplayMode: 'periodic', // 'periodic' (10s show, 1min cycle) | 'static' (always visible)
  showFloatingSpotlight: false,
  fullScreenIntervalMinutes: 1, // Repeat every 1 minute
  fullScreenDurationSeconds: 10, // Display duration in seconds (10s)
  tickerSpeed: 'slow', // 'ultra-slow' | 'slow' | 'normal' | 'fast' | 'ultra-fast' | seconds number
  topScrollingText: '🏆 Welcome to the Championship • Please report to your assigned court 10 minutes before match time.',
  bottomScrollingText: '⭐ Special Tournament Offer: Flat 20% off on all pro badminton gear at Arena Lobby Stall #1!',
  videoMuted: true,
  autoLoopVideo: true,
  intermissionMode: false,
  rotationInterval: 10,
}



