import { supabase } from './supabaseClient';

/**
 * Service for syncing Badminton Tournament Data with Supabase
 */
export const SupabaseService = {
  // --- Tournaments ---
  async getTournaments() {
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
    try {
      const { data, error } = await supabase
        .from('tournaments')
        .upsert({
          id: tournament.id,
          match_name: tournament.matchName || tournament.match_name,
          match_address: tournament.matchAddress || tournament.match_address,
          court_name: tournament.courtName || tournament.court_name,
          categories: tournament.categories || [],
          start_date: tournament.startDate || tournament.start_date,
          end_date: tournament.endDate || tournament.end_date,
          total_days: tournament.totalDays || tournament.total_days || 1,
          organizer_name: tournament.organizerName || tournament.organizer_name,
          organizer_mobile: tournament.organizerMobile || tournament.organizer_mobile,
          image: tournament.image || '',
          winner: tournament.winner || '',
          category_winners: tournament.categoryWinners || tournament.category_winners || {},
          completed_at: tournament.completedAt || tournament.completed_at || null,
          updated_at: new Date().toISOString()
        })
        .select();
      if (error) throw error;
      return data;
    } catch (err) {
      console.warn('Supabase Tournaments sync status:', err.message);
      return null;
    }
  },

  async deleteTournament(tournamentId) {
    try {
      const { error } = await supabase
        .from('tournaments')
        .delete()
        .eq('id', tournamentId);
      if (error) throw error;
      return true;
    } catch (err) {
      console.warn('Supabase Delete sync status:', err.message);
      return false;
    }
  },

  // --- Draws & Fixtures ---
  async getTournamentDraws(tournamentId) {
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
    try {
      const { data, error } = await supabase
        .from('credentials')
        .upsert({
          id: cred.id,
          username: cred.username,
          password: cred.password,
          name: cred.name,
          assigned_match_id: cred.assignedMatchId || cred.assigned_match_id,
          assigned_match_name: cred.assignedMatchName || cred.assigned_match_name,
          court_name: cred.courtName || cred.court_name,
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
  }
};

export default SupabaseService;
