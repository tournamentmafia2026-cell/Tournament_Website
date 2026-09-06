import { supabase } from './supabaseClient';

const sanitizeDate = (d) => {
  if (!d) return null;
  if (typeof d === 'string') {
    const trimmed = d.trim();
    if (!trimmed) return null;
    if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;
    const parsed = new Date(trimmed);
    if (!isNaN(parsed.getTime())) {
      return parsed.toISOString().split('T')[0];
    }
    return null;
  }
  if (typeof d === 'number') {
    const parsed = new Date(d);
    if (!isNaN(parsed.getTime())) {
      return parsed.toISOString().split('T')[0];
    }
  }
  return null;
};

const sanitizeTimestamp = (ts) => {
  if (!ts) return null;
  if (typeof ts === 'number') {
    const parsed = new Date(ts);
    return isNaN(parsed.getTime()) ? null : parsed.toISOString();
  }
  if (typeof ts === 'string') {
    const trimmed = ts.trim();
    if (!trimmed) return null;
    const parsed = new Date(trimmed);
    return isNaN(parsed.getTime()) ? null : parsed.toISOString();
  }
  return null;
};

/**
 * Service for syncing Badminton Tournament Data with Supabase
 */
export const SupabaseService = {
  // --- Tournaments ---
  async getTournaments() {
    if (!supabase) return null;
    try {
      const { data, error } = await supabase
        .from('tournaments')
        .select('*')
        .order('id', { ascending: true });
      if (error) throw error;
      return data;
    } catch (err) {
      console.warn('Supabase Tournaments fetch status:', err.message);
      return null;
    }
  },

  async upsertTournament(tournament) {
    if (!supabase || !tournament) return null;
    try {
      const strId = String(tournament.id);
      const startDate = sanitizeDate(tournament.startDate || tournament.start_date);
      const endDate = sanitizeDate(tournament.endDate || tournament.end_date);
      const totalDays = Number(tournament.totalDays || tournament.total_days) || 1;
      const completedAt = sanitizeTimestamp(tournament.completedAt || tournament.completed_at);

      const { data, error } = await supabase
        .from('tournaments')
        .upsert({
          id: strId,
          match_name: tournament.matchName || tournament.match_name || 'Badminton Championship',
          match_address: tournament.matchAddress || tournament.match_address || '',
          court_name: tournament.courtName || tournament.court_name || '',
          categories: Array.isArray(tournament.categories) ? tournament.categories : ['Men Singles'],
          participants: Array.isArray(tournament.participants) ? tournament.participants : [],
          authenticators: Array.isArray(tournament.authenticators) ? tournament.authenticators : [],
          start_date: startDate,
          end_date: endDate,
          total_days: totalDays,
          organizer_name: tournament.organizerName || tournament.organizer_name || '',
          organizer_mobile: tournament.organizerMobile || tournament.organizer_mobile || '',
          image: tournament.image || '',
          winner: tournament.winner || '',
          category_winners: tournament.categoryWinners || tournament.category_winners || {},
          completed_at: completedAt,
          updated_at: new Date().toISOString()
        })
        .select();
      if (error) {
        console.error('Supabase Tournaments sync error:', error);
        throw error;
      }
      return data;
    } catch (err) {
      console.warn('Supabase Tournaments sync status:', err.message);
      return null;
    }
  },

  async deleteTournament(tournamentId) {
    if (!supabase || !tournamentId) return false;
    try {
      const strId = String(tournamentId);
      await supabase
        .from('tournaments')
        .delete()
        .eq('id', strId);

      const numId = Number(tournamentId);
      if (!isNaN(numId)) {
        await supabase
          .from('tournaments')
          .delete()
          .eq('id', numId);
      }

      await supabase
        .from('tournament_draws')
        .delete()
        .eq('tournament_id', strId);

      if (!isNaN(numId)) {
        await supabase
          .from('tournament_draws')
          .delete()
          .eq('tournament_id', numId);
      }

      await supabase
        .from('credentials')
        .delete()
        .eq('assigned_match_id', strId);

      return true;
    } catch (err) {
      console.warn('Supabase Delete sync status:', err.message);
      return false;
    }
  },

  async deleteTournamentDraw(drawId) {
    if (!supabase || !drawId) return false;
    try {
      const strId = String(drawId);
      await supabase
        .from('tournament_draws')
        .delete()
        .eq('id', strId);
      return true;
    } catch (err) {
      console.warn('Supabase Draw Delete status:', err.message);
      return false;
    }
  },

  subscribeToTournaments(onUpdate) {
    if (!supabase) {
      return { unsubscribe: () => {} };
    }
    return supabase
      .channel('tournaments_realtime_channel')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'tournaments' },
        (payload) => {
          onUpdate(payload);
        }
      )
      .subscribe();
  },

  subscribeToTournamentDraws(onUpdate) {
    if (!supabase) {
      return { unsubscribe: () => {} };
    }
    return supabase
      .channel('draws_realtime_channel')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'tournament_draws' },
        (payload) => {
          onUpdate(payload);
        }
      )
      .subscribe();
  },

  // --- Draws & Fixtures ---
  async getAllTournamentDraws() {
    if (!supabase) return null;
    try {
      const { data, error } = await supabase
        .from('tournament_draws')
        .select('*');
      if (error) throw error;
      return data;
    } catch (err) {
      console.warn('Supabase All Draws fetch status:', err.message);
      return null;
    }
  },

  async getTournamentDraws(tournamentId) {
    if (!supabase) return null;
    try {
      const { data, error } = await supabase
        .from('tournament_draws')
        .select('*')
        .eq('tournament_id', tournamentId);
      if (error) throw error;
      return data;
    } catch (err) {
      console.warn('Supabase Draws fetch status:', err.message);
      return null;
    }
  },

  async upsertTournamentDraw(id, tournamentId, category, drawData, isPublished = false) {
    if (!supabase) return null;
    try {
      const { data, error } = await supabase
        .from('tournament_draws')
        .upsert({
          id: id,
          tournament_id: tournamentId,
          category: category,
          draw_data: drawData,
          is_published: isPublished,
          updated_at: new Date().toISOString()
        })
        .select();
      if (error) throw error;
      return data;
    } catch (err) {
      console.warn('Supabase Draw upsert status:', err.message);
      return null;
    }
  },

  // --- Live Score / Match Realtime ---
  async updateLiveMatch(matchData) {
    if (!supabase) return null;
    try {
      const { data, error } = await supabase
        .from('live_matches')
        .upsert({
          ...matchData,
          updated_at: new Date().toISOString()
        })
        .select();
      if (error) throw error;
      return data;
    } catch (err) {
      console.warn('Supabase Live Match sync status:', err.message);
      return null;
    }
  },

  subscribeToLiveMatches(onUpdate) {
    if (!supabase) {
      return { unsubscribe: () => {} };
    }
    return supabase
      .channel('live_matches_channel')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'live_matches' },
        (payload) => {
          onUpdate(payload);
        }
      )
      .subscribe();
  },

  // --- Credentials ---
  async getCredentials() {
    if (!supabase) return null;
    try {
      const { data, error } = await supabase
        .from('credentials')
        .select('*');
      if (error) throw error;
      return data;
    } catch (err) {
      console.warn('Supabase Credentials fetch status:', err.message);
      return null;
    }
  },

  async upsertCredential(cred) {
    if (!supabase) return null;
    try {
      const { data, error } = await supabase
        .from('credentials')
        .upsert({
          id: String(cred.id || cred.username),
          username: cred.username,
          password: cred.password,
          name: cred.name || cred.authName || cred.username,
          assigned_match_id: cred.assignedMatchId || cred.assigned_match_id || null,
          assigned_match_name: cred.assignedMatchName || cred.assigned_match_name || '',
          court_name: cred.courtName || cred.court_name || cred.assignedCourt || '',
          scope: cred.scope || 'umpire',
          expiry: cred.expiry || '24 Hours',
          role: cred.role || 'umpire',
          status: cred.status || 'active'
        })
        .select();
      if (error) throw error;
      return data;
    } catch (err) {
      console.warn('Supabase Credential upsert status:', err.message);
      return null;
    }
  },

  async deleteCredential(idOrUsername) {
    if (!supabase || !idOrUsername) return false;
    try {
      const target = String(idOrUsername);
      await supabase
        .from('credentials')
        .delete()
        .eq('id', target);
      await supabase
        .from('credentials')
        .delete()
        .eq('username', target);
      return true;
    } catch (err) {
      console.warn('Supabase Credential delete status:', err.message);
      return false;
    }
  }
};

export default SupabaseService;
