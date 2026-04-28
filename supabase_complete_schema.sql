-- ========================================================
-- RAHMA AL MUHDAH - COMPLETE DATABASE SCHEMA
-- ========================================================
-- Run this script in the Supabase SQL Editor to create
-- all necessary tables and policies for the platform

-- ========================================================
-- 1. COMPANIES TABLE (CRITICAL - WAS MISSING!)
-- ========================================================
CREATE TABLE IF NOT EXISTS public.companies (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  auth_user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  website TEXT,
  description TEXT,
  logo_url TEXT,
  location TEXT,
  address TEXT,
  activity_sector TEXT,
  commercial_register_url TEXT,
  tax_card_url TEXT,
  status VARCHAR(50) DEFAULT 'pending', -- 'pending', 'approved', 'rejected', 'suspended'
  verified BOOLEAN DEFAULT false,
  verification_date TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_companies_auth_user_id ON public.companies(auth_user_id);
CREATE INDEX IF NOT EXISTS idx_companies_status ON public.companies(status);
CREATE INDEX IF NOT EXISTS idx_companies_created_at ON public.companies(created_at DESC);

-- Enable Row Level Security for companies
ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;

-- Companies can view their own profile
CREATE POLICY IF NOT EXISTS "Companies can view their own data"
ON public.companies FOR SELECT
USING (auth.uid() = auth_user_id);

-- Companies can update their own profile
CREATE POLICY IF NOT EXISTS "Companies can update their own data"
ON public.companies FOR UPDATE
USING (auth.uid() = auth_user_id);

-- Admin can view all companies
CREATE POLICY IF NOT EXISTS "Admins can view all companies"
ON public.companies FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.users 
    WHERE users.auth_user_id = auth.uid() 
    AND users.role = 'admin'
  )
);

-- Admin can update any company
CREATE POLICY IF NOT EXISTS "Admins can update any company"
ON public.companies FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.users 
    WHERE users.auth_user_id = auth.uid() 
    AND users.role = 'admin'
  )
);

-- ========================================================
-- 2. JOBS TABLE (Enhanced)
-- ========================================================
CREATE TABLE IF NOT EXISTS public.jobs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  company_name TEXT NOT NULL,
  company_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  company_logo TEXT,
  positions VARCHAR(50) DEFAULT '1',
  location TEXT,
  type TEXT DEFAULT 'دوام كامل',
  salary TEXT,
  sector TEXT,
  summary TEXT,
  description TEXT,
  application_enabled BOOLEAN DEFAULT true,
  featured BOOLEAN DEFAULT false,
  status VARCHAR(50) DEFAULT 'pending', -- 'pending', 'approved', 'hidden', 'rejected'
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_jobs_company_id ON public.jobs(company_id);
CREATE INDEX IF NOT EXISTS idx_jobs_status ON public.jobs(status);
CREATE INDEX IF NOT EXISTS idx_jobs_created_at ON public.jobs(created_at DESC);

-- Enable Row Level Security for jobs
ALTER TABLE public.jobs ENABLE ROW LEVEL SECURITY;

-- Allow anyone to read approved jobs
CREATE POLICY IF NOT EXISTS "Allow public read access to approved jobs"
ON public.jobs FOR SELECT
USING (status = 'approved' AND application_enabled = true);

-- Allow companies to insert and manage their own jobs
CREATE POLICY IF NOT EXISTS "Allow companies to manage their own jobs"
ON public.jobs FOR ALL
USING (auth.uid() = company_id);

-- Admin can view all jobs
CREATE POLICY IF NOT EXISTS "Admins can view all jobs"
ON public.jobs FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.users 
    WHERE users.auth_user_id = auth.uid() 
    AND users.role = 'admin'
  )
);

-- Admin can update any job
CREATE POLICY IF NOT EXISTS "Admins can update any job"
ON public.jobs FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.users 
    WHERE users.auth_user_id = auth.uid() 
    AND users.role = 'admin'
  )
);

-- ========================================================
-- 3. APPLICATIONS TABLE (Enhanced)
-- ========================================================
CREATE TABLE IF NOT EXISTS public.applications (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  job_id UUID REFERENCES public.jobs(id) ON DELETE CASCADE NOT NULL,
  candidate_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  company_id UUID REFERENCES auth.users(id),
  status VARCHAR(50) DEFAULT 'pending', -- 'pending', 'reviewed', 'accepted', 'rejected'
  candidate_name TEXT,
  candidate_email TEXT,
  candidate_phone TEXT,
  candidate_cv_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_applications_job_id ON public.applications(job_id);
CREATE INDEX IF NOT EXISTS idx_applications_candidate_id ON public.applications(candidate_id);
CREATE INDEX IF NOT EXISTS idx_applications_company_id ON public.applications(company_id);
CREATE INDEX IF NOT EXISTS idx_applications_status ON public.applications(status);

-- RLS policies for applications
ALTER TABLE public.applications ENABLE ROW LEVEL SECURITY;

-- Candidates can see and manage their own applications
CREATE POLICY IF NOT EXISTS "Allow candidates to manage their own applications"
ON public.applications FOR ALL
USING (auth.uid() = candidate_id);

-- Companies can see applications for their jobs
CREATE POLICY IF NOT EXISTS "Allow companies to view applications for their jobs"
ON public.applications FOR SELECT
USING (auth.uid() = company_id);

-- Companies can update the status of applications sent to them
CREATE POLICY IF NOT EXISTS "Allow companies to update applications for their jobs"
ON public.applications FOR UPDATE
USING (auth.uid() = company_id);

-- Admin can view all applications
CREATE POLICY IF NOT EXISTS "Admins can view all applications"
ON public.applications FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.users 
    WHERE users.auth_user_id = auth.uid() 
    AND users.role = 'admin'
  )
);

-- ========================================================
-- 4. USERS TABLE (Admin and Management)
-- ========================================================
CREATE TABLE IF NOT EXISTS public.users (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  auth_user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  email TEXT NOT NULL UNIQUE,
  role VARCHAR(50) DEFAULT 'user', -- 'admin', 'company', 'candidate', 'user'
  name TEXT,
  avatar_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_users_auth_user_id ON public.users(auth_user_id);
CREATE INDEX IF NOT EXISTS idx_users_email ON public.users(email);
CREATE INDEX IF NOT EXISTS idx_users_role ON public.users(role);

-- Enable Row Level Security for users
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- Users can view their own profile
CREATE POLICY IF NOT EXISTS "Users can view their own profile"
ON public.users FOR SELECT
USING (auth.uid() = auth_user_id);

-- Admin can view all users
CREATE POLICY IF NOT EXISTS "Admins can view all users"
ON public.users FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.users AS admin_check
    WHERE admin_check.auth_user_id = auth.uid() 
    AND admin_check.role = 'admin'
  )
);

-- Admin can update any user
CREATE POLICY IF NOT EXISTS "Admins can update any user"
ON public.users FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.users AS admin_check
    WHERE admin_check.auth_user_id = auth.uid() 
    AND admin_check.role = 'admin'
  )
);

-- ========================================================
-- 5. ADMIN ACTIVITY LOGS TABLE (For Audit Trail)
-- ========================================================
CREATE TABLE IF NOT EXISTS public.admin_activity_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  actor TEXT NOT NULL, -- Email of the admin who performed the action
  action TEXT NOT NULL, -- Type of action (e.g., 'update_company', 'delete_job')
  target TEXT NOT NULL, -- What was affected (e.g., company name, job title)
  details TEXT, -- Additional details about the action
  level VARCHAR(20) DEFAULT 'info', -- 'info', 'warning', 'error', 'critical'
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_admin_activity_logs_actor ON public.admin_activity_logs(actor);
CREATE INDEX IF NOT EXISTS idx_admin_activity_logs_action ON public.admin_activity_logs(action);
CREATE INDEX IF NOT EXISTS idx_admin_activity_logs_created_at ON public.admin_activity_logs(created_at DESC);

-- ========================================================
-- 6. SITE SETTINGS TABLE (For Admin Configuration)
-- ========================================================
CREATE TABLE IF NOT EXISTS public.site_settings (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  key TEXT NOT NULL UNIQUE,
  value JSONB,
  description TEXT,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
  updated_by TEXT
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_site_settings_key ON public.site_settings(key);

-- ========================================================
-- 7. CANDIDATES TABLE (Optional - For Future Features)
-- ========================================================
CREATE TABLE IF NOT EXISTS public.candidates (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  auth_user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  first_name TEXT,
  last_name TEXT,
  email TEXT,
  phone TEXT,
  cv_url TEXT,
  bio TEXT,
  experience_years INTEGER,
  skills TEXT[], -- Array of skills
  location TEXT,
  status VARCHAR(50) DEFAULT 'active', -- 'active', 'inactive', 'suspended'
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_candidates_auth_user_id ON public.candidates(auth_user_id);
CREATE INDEX IF NOT EXISTS idx_candidates_email ON public.candidates(email);

-- Enable Row Level Security for candidates
ALTER TABLE public.candidates ENABLE ROW LEVEL SECURITY;

-- Candidates can view their own profile
CREATE POLICY IF NOT EXISTS "Candidates can view their own profile"
ON public.candidates FOR SELECT
USING (auth.uid() = auth_user_id);

-- Candidates can update their own profile
CREATE POLICY IF NOT EXISTS "Candidates can update their own profile"
ON public.candidates FOR UPDATE
USING (auth.uid() = auth_user_id);

-- Admin can view all candidates
CREATE POLICY IF NOT EXISTS "Admins can view all candidates"
ON public.candidates FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.users 
    WHERE users.auth_user_id = auth.uid() 
    AND users.role = 'admin'
  )
);

-- ========================================================
-- 8. MESSAGES TABLE (For Communication System)
-- ========================================================
CREATE TABLE IF NOT EXISTS public.messages (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  sender_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  recipient_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  subject TEXT,
  body TEXT NOT NULL,
  read BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_messages_sender_id ON public.messages(sender_id);
CREATE INDEX IF NOT EXISTS idx_messages_recipient_id ON public.messages(recipient_id);
CREATE INDEX IF NOT EXISTS idx_messages_read ON public.messages(read);

-- Enable Row Level Security for messages
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

-- Users can view messages sent to them or by them
CREATE POLICY IF NOT EXISTS "Users can view their own messages"
ON public.messages FOR SELECT
USING (auth.uid() = sender_id OR auth.uid() = recipient_id);

-- Users can insert messages to themselves or others
CREATE POLICY IF NOT EXISTS "Users can send messages"
ON public.messages FOR INSERT
WITH CHECK (auth.uid() = sender_id);

-- ========================================================
-- 9. CREATE HELPER FUNCTION FOR USER ROLE MANAGEMENT
-- ========================================================
CREATE OR REPLACE FUNCTION public.set_user_role(user_id UUID, new_role VARCHAR)
RETURNS void AS $$
BEGIN
  UPDATE public.users SET role = new_role WHERE auth_user_id = user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ========================================================
-- 10. CREATE HELPER FUNCTION FOR COMPANY VERIFICATION
-- ========================================================
CREATE OR REPLACE FUNCTION public.verify_company(company_id UUID)
RETURNS void AS $$
BEGIN
  UPDATE public.companies 
  SET verified = true, verification_date = NOW() 
  WHERE id = company_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ========================================================
-- END OF SCHEMA CREATION
-- ========================================================
-- After running this script:
-- 1. Check that all tables are created without errors
-- 2. Verify that all indexes are created
-- 3. Test that RLS policies are working correctly
-- 4. Insert sample data if needed for testing
-- ========================================================
