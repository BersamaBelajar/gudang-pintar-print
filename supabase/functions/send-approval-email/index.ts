import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.53.0";
import { Resend } from "npm:resend@2.0.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface EmailRequest {
  deliveryNoteId: string;
  deliveryNumber: string;
  customerName: string;
  type: 'approval_request' | 'reminder' | 'approved' | 'rejected';
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    
    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('Missing Supabase configuration');
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { deliveryNoteId, deliveryNumber, customerName, type }: EmailRequest = await req.json();

    console.log(`Processing email request for delivery note ${deliveryNumber}, type: ${type}`);

    // Get delivery note details first to check division
    const { data: deliveryNote, error: deliveryError } = await supabase
      .from('delivery_notes')
      .select('division, customer_name, delivery_number')
      .eq('id', deliveryNoteId)
      .single();

    if (deliveryError) {
      console.error('Error fetching delivery note:', deliveryError);
      throw deliveryError;
    }

    // Get pending approvals with approver details filtered by division
    const { data: pendingApprovals, error: approvalsError } = await supabase
      .from('delivery_note_approvals')
      .select(`
        *,
        approval_levels!inner(name, email, level_order, division)
      `)
      .eq('delivery_note_id', deliveryNoteId)
      .eq('status', 'pending')
      .eq('approval_levels.division', deliveryNote.division)
      .order('approval_levels(level_order)', { ascending: true });

    if (approvalsError) {
      console.error('Error fetching approvals:', approvalsError);
      throw approvalsError;
    }

    if (!pendingApprovals || pendingApprovals.length === 0) {
      console.log('No pending approvals found');
      return new Response(JSON.stringify({ message: 'No pending approvals' }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Get the next approver (lowest level_order among pending)
    const nextApproval = pendingApprovals[0];
    const approverEmail = nextApproval.approval_levels.email;
    const approverName = nextApproval.approval_levels.name;

    let subject = '';
    let htmlContent = '';

    // Generate secure approval token
    const approvalToken = crypto.randomUUID();
    
    // Store the approval token in database for security
    await supabase
      .from('delivery_note_approvals')
      .update({ 
        approval_token: approvalToken,
        token_expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString() // 24 hours
      })
      .eq('id', nextApproval.id);

    const baseUrl = supabaseUrl.replace('/rest/v1', '');
    const approveUrl = `${baseUrl}/functions/v1/handle-email-approval?token=${approvalToken}&action=approve`;
    const rejectUrl = `${baseUrl}/functions/v1/handle-email-approval?token=${approvalToken}&action=reject`;

    switch (type) {
      case 'approval_request':
      case 'reminder':
        subject = `${type === 'reminder' ? '[REMINDER] ' : ''}Persetujuan Surat Jalan - ${deliveryNote.delivery_number}`;
        htmlContent = `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <h2 style="color: #333; margin-bottom: 20px;">Permintaan Persetujuan Surat Jalan</h2>
            <p>Halo ${approverName},</p>
            <p>Surat jalan berikut memerlukan persetujuan Anda:</p>
            <div style="background-color: #f5f5f5; padding: 15px; border-radius: 5px; margin: 20px 0;">
              <ul style="margin: 0; padding-left: 20px;">
                <li><strong>No. Surat Jalan:</strong> ${deliveryNote.delivery_number}</li>
                <li><strong>Customer:</strong> ${deliveryNote.customer_name}</li>
                <li><strong>Divisi:</strong> ${deliveryNote.division}</li>
                <li><strong>Level Approval:</strong> ${approverName}</li>
              </ul>
            </div>
            
            <div style="text-align: center; margin: 30px 0;">
              <p style="margin-bottom: 20px; font-weight: bold;">Klik salah satu tombol di bawah untuk memberikan persetujuan:</p>
              
              <a href="${approveUrl}" style="display: inline-block; background-color: #10b981; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; margin: 0 10px; font-weight: bold;">
                ✓ SETUJU
              </a>
              
              <a href="${rejectUrl}" style="display: inline-block; background-color: #ef4444; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; margin: 0 10px; font-weight: bold;">
                ✗ TOLAK
              </a>
            </div>
            
            <div style="border-top: 1px solid #ddd; padding-top: 20px; margin-top: 30px; color: #666; font-size: 14px;">
              <p>Atau silakan login ke sistem Gudang Pintar untuk memberikan persetujuan manual.</p>
              <p><strong>Penting:</strong> Link persetujuan ini berlaku selama 24 jam.</p>
            </div>
            
            <p style="margin-top: 20px;">Terima kasih.</p>
          </div>
        `;
        break;
      
      case 'approved':
        subject = `Surat Jalan Disetujui - ${deliveryNote.delivery_number}`;
        htmlContent = `
          <h2>Surat Jalan Telah Disetujui</h2>
          <p>Surat jalan dengan nomor ${deliveryNote.delivery_number} untuk customer ${deliveryNote.customer_name} dari divisi ${deliveryNote.division} telah disetujui dan siap untuk proses pengiriman.</p>
          <p>Terima kasih.</p>
        `;
        break;
      
      case 'rejected':
        subject = `Surat Jalan Ditolak - ${deliveryNote.delivery_number}`;
        htmlContent = `
          <h2>Surat Jalan Ditolak</h2>
          <p>Surat jalan dengan nomor ${deliveryNote.delivery_number} untuk customer ${deliveryNote.customer_name} dari divisi ${deliveryNote.division} telah ditolak.</p>
          <p>Silakan periksa sistem untuk detail lebih lanjut.</p>
          <p>Terima kasih.</p>
        `;
        break;
    }

    // Send email
    const emailResponse = await resend.emails.send({
      from: "Gudang Pintar <onboarding@resend.dev>",
      to: [approverEmail],
      subject: subject,
      html: htmlContent,
    });

    console.log("Email sent successfully:", emailResponse);

    return new Response(JSON.stringify({ 
      success: true, 
      emailId: emailResponse.data?.id,
      sentTo: approverEmail 
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: any) {
    console.error("Error in send-approval-email function:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
};

serve(handler);