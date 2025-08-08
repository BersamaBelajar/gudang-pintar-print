-- Add approval_token and token_expires_at columns to delivery_note_approvals table
ALTER TABLE public.delivery_note_approvals 
ADD COLUMN approval_token UUID,
ADD COLUMN token_expires_at TIMESTAMP WITH TIME ZONE;

-- Create index for faster token lookups
CREATE INDEX idx_delivery_note_approvals_token ON public.delivery_note_approvals(approval_token) WHERE approval_token IS NOT NULL;