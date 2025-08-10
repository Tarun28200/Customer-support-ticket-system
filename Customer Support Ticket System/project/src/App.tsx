import React, { useState } from 'react';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { AuthForm } from './components/AuthForm';
import { Layout } from './components/Layout';
import { TicketList } from './components/TicketList';
import { TicketModal } from './components/TicketModal';
import { CreateTicket } from './components/CreateTicket';
import { Dashboard } from './components/Dashboard';
import { useTickets } from './hooks/useTickets';
import { Ticket } from './types';

const AppContent: React.FC = () => {
  const { user, loading } = useAuth();
  const [activeTab, setActiveTab] = useState('tickets');
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  
  const { updateTicket } = useTickets();

  const handleTicketSelect = (ticket: Ticket) => {
    setSelectedTicket(ticket);
    setIsModalOpen(true);
  };

  const handleTicketUpdate = async (id: string, updates: Partial<Ticket>) => {
    await updateTicket(id, updates);
    setIsModalOpen(false);
    setSelectedTicket(null);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!user) {
    return <AuthForm />;
  }

  const renderContent = () => {
    switch (activeTab) {
      case 'tickets':
        return <TicketList onTicketSelect={handleTicketSelect} />;
      case 'create':
        return <CreateTicket />;
      case 'dashboard':
        return user.role === 'admin' ? <Dashboard /> : <TicketList onTicketSelect={handleTicketSelect} />;
      case 'users':
        return user.role === 'admin' ? <div className="p-6">Users management coming soon...</div> : <TicketList onTicketSelect={handleTicketSelect} />;
      default:
        return <TicketList onTicketSelect={handleTicketSelect} />;
    }
  };

  return (
    <>
      <Layout activeTab={activeTab} onTabChange={setActiveTab}>
        {renderContent()}
      </Layout>
      
      <TicketModal
        ticket={selectedTicket}
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setSelectedTicket(null);
        }}
        onUpdate={handleTicketUpdate}
      />
    </>
  );
};

function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}

export default App;