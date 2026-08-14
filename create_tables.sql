-- Run this SQL in your Supabase SQL Editor to create the dispatch_logs table

CREATE TABLE IF NOT EXISTS public.dispatch_logs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    grn_number TEXT NOT NULL,
    product_variety TEXT,
    size TEXT,
    qty_boxes INTEGER NOT NULL DEFAULT 0,
    transport_name TEXT,
    party_name TEXT,
    raw_text TEXT,
    sender_phone TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS or grant access if needed
ALTER TABLE public.dispatch_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public full access to dispatch_logs" ON public.dispatch_logs
    FOR ALL USING (true) WITH CHECK (true);
