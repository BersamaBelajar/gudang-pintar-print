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

    // Get pending approvals with approver details
    const { data: pendingApprovals, error: approvalsError } = await supabase
      .from('delivery_note_approvals')
      .select(`
        *,
        approval_levels(name, email, level_order)
      `)
      .eq('delivery_note_id', deliveryNoteId)
      .eq('status', 'pending')
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

    switch (type) {
      case 'approval_request':
      case 'reminder':
        subject = `${type === 'reminder' ? '[REMINDER] ' : ''}Persetujuan Surat Jalan - ${deliveryNumber}`;
        htmlContent = `
          <h2>Permintaan Persetujuan Surat Jalan</h2>
          <p>Halo ${approverName},</p>
          <p>Surat jalan berikut memerlukan persetujuan Anda:</p>
          <ul>
            <li><strong>No. Surat Jalan:</strong> ${deliveryNumber}</li>
            <li><strong>Customer:</strong> ${customerName}</li>
            <li><strong>Level Approval:</strong> ${approverName}</li>
          </ul>
          <p>Silakan login ke sistem Gudang Pintar untuk memberikan persetujuan.</p>
          <p>Terima kasih.</p>
        `;
        break;
      
      case 'approved':
        subject = `Surat Jalan Disetujui - ${deliveryNumber}`;
        htmlContent = `
          <h2>Surat Jalan Telah Disetujui</h2>
          <p>Surat jalan dengan nomor ${deliveryNumber} untuk customer ${customerName} telah disetujui dan siap untuk proses pengiriman.</p>
          <p>Terima kasih.</p>
        `;
        break;
      
      case 'rejected':
        subject = `Surat Jalan Ditolak - ${deliveryNumber}`;
        htmlContent = `
          <h2>Surat Jalan Ditolak</h2>
          <p>Surat jalan dengan nomor ${deliveryNumber} untuk customer ${customerName} telah ditolak.</p>
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