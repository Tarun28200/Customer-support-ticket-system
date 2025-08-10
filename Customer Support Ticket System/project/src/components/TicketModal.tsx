import React, { useState, useEffect } from 'react';
import { Ticket, TicketComment, User } from '../types';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { 
  XIcon, 
  CalendarIcon, 
  UserIcon, 
  MessageSquareIcon,
  SaveIcon
} from 'lucide-react';

interface TicketModalProps {
  ticket: Ticket | null;
  isOpen: boolean;
  onClose: () => void;
  onUpdate: (id: string, updates: Partial<Ticket>) => void;
}

export const TicketModal: React.FC<TicketModalProps> = ({ 
  ticket, 
  isOpen, 
  onClose, 
  onUpdate 
}) => {
  const { user } = useAuth();
  const [comments, setComments] = useState<TicketComment[]>([]);
  const [newComment, setNewComment] = useState('');
  const [admins, setAdmins] = useState<User[]>([]);
  const [editMode, setEditMode] = useState(false);
  const [editData, setEditData] = useState<Partial<Ticket>>({});
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (ticket) {
      fetchComments();
      fetchAdmins();
      setEditData({
        status: ticket.status,
        priority: ticket.priority,
        assigned_to: ticket.assigned_to
      });
    }
  }, [ticket]);

  const fetchComments = async () => {
    if (!ticket) return;

    try {
      const { data, error } = await supabase
        .from('ticket_comments')
        .select(`
          *,
          user:user_id(id, full_name)
        `)
        .eq('ticket_id', ticket.id)
        .order('created_at', { ascending: true });

      if (error) throw error;
      setComments(data || []);
    } catch (error) {
      console.error('Error fetching comments:', error);
    }
  };

  const fetchAdmins = async () => {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('role', 'admin');

      if (error) throw error;
      setAdmins(data || []);
    } catch (error) {
      console.error('Error fetching admins:', error);
    }
  };

  const addComment = async () => {
    if (!ticket || !newComment.trim()) return;

    try {
      const { error } = await supabase
        .from('ticket_comments')
        .insert([{
          ticket_id: ticket.id,
          user_id: user?.id,
          comment: newComment
        }]);

      if (error) throw error;
      
      setNewComment('');
      await fetchComments();
    } catch (error) {
      console.error('Error adding comment:', error);
    }
  };

  const handleUpdate = async () => {
    if (!ticket) return;

    setLoading(true);
    try {
      await onUpdate(ticket.id, editData);
      setEditMode(false);
    } catch (error) {
      console.error('Error updating ticket:', error);
    } finally {
      setLoading(false);
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'urgent':
        return 'bg-red-100 text-red-800';
      case 'high':
        return 'bg-orange-100 text-orange-800';
      case 'medium':
        return 'bg-yellow-100 text-yellow-800';
      case 'low':
        return 'bg-green-100 text-green-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  if (!isOpen || !ticket) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex items-end justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:block sm:p-0">
        <div className="fixed inset-0 transition-opacity bg-gray-500 bg-opacity-75" onClick={onClose} />

        <div className="inline-block w-full max-w-4xl my-8 overflow-hidden text-left align-bottom transition-all transform bg-white rounded-lg shadow-xl sm:align-middle">
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
            <div>
              <h2 className="text-xl font-semibold text-gray-900">{ticket.title}</h2>
              <p className="text-sm text-gray-500">Ticket ID: {ticket.id.slice(0, 8)}</p>
            </div>
            <div className="flex items-center gap-2">
              {user?.role === 'admin' && (
                <button
                  onClick={() => setEditMode(!editMode)}
                  className="px-4 py-2 text-sm font-medium text-blue-600 bg-blue-50 rounded-lg hover:bg-blue-100"
                >
                  {editMode ? 'Cancel' : 'Edit'}
                </button>
              )}
              <button
                onClick={onClose}
                className="p-2 text-gray-400 hover:text-gray-600 rounded-lg"
              >
                <XIcon className="w-5 h-5" />
              </button>
            </div>
          </div>

          <div className="flex-1 max-h-96 overflow-y-auto">
            {/* Ticket Details */}
            <div className="px-6 py-4 border-b border-gray-200">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <h3 className="text-sm font-medium text-gray-700 mb-2">Description</h3>
                  <p className="text-gray-900">{ticket.description}</p>
                </div>
                
                <div className="space-y-4">
                  {/* Status */}
                  <div>
                    <label className="text-sm font-medium text-gray-700">Status</label>
                    {editMode && user?.role === 'admin' ? (
                      <select
                        value={editData.status}
                        onChange={(e) => setEditData({ ...editData, status: e.target.value as any })}
                        className="mt-1 block w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="open">Open</option>
                        <option value="in_progress">In Progress</option>
                        <option value="resolved">Resolved</option>
                        <option value="closed">Closed</option>
                      </select>
                    ) : (
                      <p className="mt-1 text-sm capitalize">{ticket.status.replace('_', ' ')}</p>
                    )}
                  </div>

                  {/* Priority */}
                  <div>
                    <label className="text-sm font-medium text-gray-700">Priority</label>
                    {editMode && user?.role === 'admin' ? (
                      <select
                        value={editData.priority}
                        onChange={(e) => setEditData({ ...editData, priority: e.target.value as any })}
                        className="mt-1 block w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="low">Low</option>
                        <option value="medium">Medium</option>
                        <option value="high">High</option>
                        <option value="urgent">Urgent</option>
                      </select>
                    ) : (
                      <span className={`mt-1 inline-block px-2 py-1 text-xs font-medium rounded-full ${getPriorityColor(ticket.priority)}`}>
                        {ticket.priority}
                      </span>
                    )}
                  </div>

                  {/* Assignee */}
                  <div>
                    <label className="text-sm font-medium text-gray-700">Assigned To</label>
                    {editMode && user?.role === 'admin' ? (
                      <select
                        value={editData.assigned_to || ''}
                        onChange={(e) => setEditData({ ...editData, assigned_to: e.target.value || null })}
                        className="mt-1 block w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="">Unassigned</option>
                        {admins.map((admin) => (
                          <option key={admin.id} value={admin.id}>
                            {admin.full_name}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <p className="mt-1 text-sm">
                        {ticket.assignee ? ticket.assignee.full_name : 'Unassigned'}
                      </p>
                    )}
                  </div>

                  {/* Created */}
                  <div>
                    <label className="text-sm font-medium text-gray-700">Created</label>
                    <p className="mt-1 text-sm text-gray-600 flex items-center gap-1">
                      <CalendarIcon className="w-4 h-4" />
                      {formatDate(ticket.created_at)}
                    </p>
                  </div>

                  {/* Created By */}
                  <div>
                    <label className="text-sm font-medium text-gray-700">Created By</label>
                    <p className="mt-1 text-sm text-gray-600 flex items-center gap-1">
                      <UserIcon className="w-4 h-4" />
                      {ticket.user?.full_name || 'Unknown'}
                    </p>
                  </div>
                </div>
              </div>

              {editMode && user?.role === 'admin' && (
                <div className="flex justify-end mt-6">
                  <button
                    onClick={handleUpdate}
                    disabled={loading}
                    className="flex items-center gap-2 px-4 py-2 text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50"
                  >
                    {loading ? (
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <SaveIcon className="w-4 h-4" />
                    )}
                    Save Changes
                  </button>
                </div>
              )}
            </div>

            {/* Comments */}
            <div className="px-6 py-4">
              <h3 className="text-lg font-medium text-gray-900 mb-4 flex items-center gap-2">
                <MessageSquareIcon className="w-5 h-5" />
                Comments ({comments.length})
              </h3>

              <div className="space-y-4 mb-6">
                {comments.map((comment) => (
                  <div key={comment.id} className="flex gap-3">
                    <div className="flex-shrink-0 w-8 h-8 bg-gray-200 rounded-full flex items-center justify-center">
                      <span className="text-xs font-medium text-gray-600">
                        {comment.user?.full_name?.charAt(0).toUpperCase()}
                      </span>
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-sm font-medium text-gray-900">
                          {comment.user?.full_name}
                        </span>
                        <span className="text-xs text-gray-500">
                          {formatDate(comment.created_at)}
                        </span>
                      </div>
                      <p className="text-sm text-gray-700">{comment.comment}</p>
                    </div>
                  </div>
                ))}

                {comments.length === 0 && (
                  <p className="text-sm text-gray-500 text-center py-4">
                    No comments yet. Be the first to add one!
                  </p>
                )}
              </div>

              {/* Add Comment */}
              <div className="flex gap-3">
                <div className="flex-shrink-0 w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center">
                  <span className="text-xs font-medium text-white">
                    {user?.full_name?.charAt(0).toUpperCase()}
                  </span>
                </div>
                <div className="flex-1">
                  <textarea
                    value={newComment}
                    onChange={(e) => setNewComment(e.target.value)}
                    placeholder="Add a comment..."
                    rows={3}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                  <div className="flex justify-end mt-2">
                    <button
                      onClick={addComment}
                      disabled={!newComment.trim()}
                      className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50"
                    >
                      Add Comment
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};