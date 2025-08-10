/*
  # Support Ticket System Database Schema

  1. New Tables
    - `users`
      - `id` (uuid, primary key, references auth.users)
      - `email` (text, unique)
      - `full_name` (text)
      - `role` (text, enum: user/admin)
      - `avatar_url` (text, optional)
      - `created_at` (timestamp)

    - `tickets`
      - `id` (uuid, primary key)
      - `title` (text)
      - `description` (text)
      - `priority` (text, enum: low/medium/high/urgent)
      - `status` (text, enum: open/in_progress/resolved/closed)
      - `category` (text, optional)
      - `created_by` (uuid, foreign key to users)
      - `assigned_to` (uuid, foreign key to users, optional)
      - `created_at` (timestamp)
      - `updated_at` (timestamp)
      - `resolved_at` (timestamp, optional)

    - `ticket_comments`
      - `id` (uuid, primary key)
      - `ticket_id` (uuid, foreign key to tickets)
      - `user_id` (uuid, foreign key to users)
      - `comment` (text)
      - `created_at` (timestamp)

  2. Security
    - Enable RLS on all tables
    - Users can read/update their own data
    - Users can create/read tickets they created
    - Admins can access all tickets and comments
    - Users can read comments on their tickets
    - Admins and ticket creators can add comments

  3. Indexes
    - Index on tickets by status, priority, created_by, assigned_to
    - Index on comments by ticket_id
*/

-- Create users table
CREATE TABLE IF NOT EXISTS users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text UNIQUE NOT NULL,
  full_name text NOT NULL,
  role text NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'admin')),
  avatar_url text,
  created_at timestamptz DEFAULT now()
);

-- Create tickets table
CREATE TABLE IF NOT EXISTS tickets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text NOT NULL,
  priority text NOT NULL DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'resolved', 'closed')),
  category text,
  created_by uuid REFERENCES users(id) ON DELETE CASCADE,
  assigned_to uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  resolved_at timestamptz
);

-- Create ticket_comments table
CREATE TABLE IF NOT EXISTS ticket_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id uuid REFERENCES tickets(id) ON DELETE CASCADE,
  user_id uuid REFERENCES users(id) ON DELETE CASCADE,
  comment text NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE ticket_comments ENABLE ROW LEVEL SECURITY;

-- Users policies
CREATE POLICY "Users can read own data"
  ON users
  FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "Users can update own data"
  ON users
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = id);

-- Tickets policies
CREATE POLICY "Users can read tickets they created or are assigned to"
  ON tickets
  FOR SELECT
  TO authenticated
  USING (
    created_by = auth.uid() OR 
    assigned_to = auth.uid() OR
    EXISTS (
      SELECT 1 FROM users 
      WHERE users.id = auth.uid() AND users.role = 'admin'
    )
  );

CREATE POLICY "Users can create tickets"
  ON tickets
  FOR INSERT
  TO authenticated
  WITH CHECK (created_by = auth.uid());

CREATE POLICY "Admins can update any ticket, users can update their own tickets"
  ON tickets
  FOR UPDATE
  TO authenticated
  USING (
    created_by = auth.uid() OR
    EXISTS (
      SELECT 1 FROM users 
      WHERE users.id = auth.uid() AND users.role = 'admin'
    )
  );

CREATE POLICY "Admins can delete tickets"
  ON tickets
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE users.id = auth.uid() AND users.role = 'admin'
    )
  );

-- Comments policies
CREATE POLICY "Users can read comments on tickets they have access to"
  ON ticket_comments
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM tickets 
      WHERE tickets.id = ticket_comments.ticket_id AND (
        tickets.created_by = auth.uid() OR 
        tickets.assigned_to = auth.uid() OR
        EXISTS (
          SELECT 1 FROM users 
          WHERE users.id = auth.uid() AND users.role = 'admin'
        )
      )
    )
  );

CREATE POLICY "Users can create comments on tickets they have access to"
  ON ticket_comments
  FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = auth.uid() AND
    EXISTS (
      SELECT 1 FROM tickets 
      WHERE tickets.id = ticket_comments.ticket_id AND (
        tickets.created_by = auth.uid() OR 
        tickets.assigned_to = auth.uid() OR
        EXISTS (
          SELECT 1 FROM users 
          WHERE users.id = auth.uid() AND users.role = 'admin'
        )
      )
    )
  );

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_tickets_status ON tickets(status);
CREATE INDEX IF NOT EXISTS idx_tickets_priority ON tickets(priority);
CREATE INDEX IF NOT EXISTS idx_tickets_created_by ON tickets(created_by);
CREATE INDEX IF NOT EXISTS idx_tickets_assigned_to ON tickets(assigned_to);
CREATE INDEX IF NOT EXISTS idx_tickets_created_at ON tickets(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ticket_comments_ticket_id ON ticket_comments(ticket_id);

-- Function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  
  -- If status changed to resolved or closed, set resolved_at
  IF OLD.status != NEW.status AND NEW.status IN ('resolved', 'closed') AND OLD.resolved_at IS NULL THEN
    NEW.resolved_at = now();
  END IF;
  
  RETURN NEW;
END;
$$ language plpgsql;

-- Create trigger for updating timestamps
DROP TRIGGER IF EXISTS update_tickets_updated_at ON tickets;
CREATE TRIGGER update_tickets_updated_at
  BEFORE UPDATE ON tickets
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Insert demo users (these should be created through Supabase Auth in a real app)
INSERT INTO users (id, email, full_name, role) VALUES
  ('550e8400-e29b-41d4-a716-446655440001', 'admin@demo.com', 'Admin User', 'admin'),
  ('550e8400-e29b-41d4-a716-446655440002', 'user@demo.com', 'Regular User', 'user')
ON CONFLICT (id) DO NOTHING;

-- Insert demo tickets for testing
INSERT INTO tickets (title, description, priority, status, category, created_by, assigned_to) VALUES
  (
    'Computer won''t start', 
    'My computer suddenly stopped working this morning. When I press the power button, nothing happens at all. No lights, no fan noise, nothing.',
    'high',
    'open',
    'Hardware',
    '550e8400-e29b-41d4-a716-446655440002',
    '550e8400-e29b-41d4-a716-446655440001'
  ),
  (
    'Can''t access email',
    'I''m unable to log into my email account. It keeps saying my password is incorrect, but I''m sure it''s right.',
    'medium',
    'in_progress',
    'Email',
    '550e8400-e29b-41d4-a716-446655440002',
    '550e8400-e29b-41d4-a716-446655440001'
  ),
  (
    'Software installation help',
    'I need help installing the new accounting software on my machine. I have the installer but I''m not sure about the configuration steps.',
    'low',
    'resolved',
    'Software',
    '550e8400-e29b-41d4-a716-446655440002',
    '550e8400-e29b-41d4-a716-446655440001'
  );