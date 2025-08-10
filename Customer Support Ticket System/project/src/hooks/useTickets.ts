import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Ticket } from '../types';
import { useAuth } from '../contexts/AuthContext';

interface UseTicketsProps {
  status?: string;
  priority?: string;
  assignee?: string;
  search?: string;
}

export const useTickets = (filters: UseTicketsProps = {}) => {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();

  useEffect(() => {
    fetchTickets();
  }, [filters, user]);

  const fetchTickets = async () => {
    try {
      let query = supabase
        .from('tickets')
        .select(`
          *,
          user:created_by(id, email, full_name),
          assignee:assigned_to(id, email, full_name)
        `)
        .order('created_at', { ascending: false });

      // Apply role-based filtering
      if (user?.role === 'user') {
        query = query.eq('created_by', user.id);
      }

      // Apply filters
      if (filters.status && filters.status !== 'all') {
        query = query.eq('status', filters.status);
      }

      if (filters.priority && filters.priority !== 'all') {
        query = query.eq('priority', filters.priority);
      }

      if (filters.assignee && filters.assignee !== 'all') {
        query = query.eq('assigned_to', filters.assignee);
      }

      if (filters.search) {
        query = query.or(`title.ilike.%${filters.search}%,description.ilike.%${filters.search}%`);
      }

      const { data, error } = await query;

      if (error) throw error;
      setTickets(data || []);
    } catch (error) {
      console.error('Error fetching tickets:', error);
    } finally {
      setLoading(false);
    }
  };

  const createTicket = async (ticketData: Omit<Ticket, 'id' | 'created_at' | 'updated_at'>) => {
    try {
      const { data, error } = await supabase
        .from('tickets')
        .insert([{
          ...ticketData,
          created_by: user?.id
        }])
        .select()
        .single();

      if (error) throw error;
      await fetchTickets();
      return data;
    } catch (error) {
      console.error('Error creating ticket:', error);
      throw error;
    }
  };

  const updateTicket = async (id: string, updates: Partial<Ticket>) => {
    try {
      const { data, error } = await supabase
        .from('tickets')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      await fetchTickets();
      return data;
    } catch (error) {
      console.error('Error updating ticket:', error);
      throw error;
    }
  };

  const deleteTicket = async (id: string) => {
    try {
      const { error } = await supabase
        .from('tickets')
        .delete()
        .eq('id', id);

      if (error) throw error;
      await fetchTickets();
    } catch (error) {
      console.error('Error deleting ticket:', error);
      throw error;
    }
  };

  return {
    tickets,
    loading,
    createTicket,
    updateTicket,
    deleteTicket,
    refetch: fetchTickets
  };
};