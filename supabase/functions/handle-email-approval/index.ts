import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.53.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

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
    const url = new URL(req.url);
    const token = url.searchParams.get('token');
    const action = url.searchParams.get('action');

    if (!token || !action) {
      return new Response(`
        <html>
          <body style="font-family: Arial, sans-serif; text-align: center; padding: 50px;">
            <h1>❌ Link Tidak Valid</h1>
            <p>Parameter yang diperlukan tidak tersedia.</p>
          </body>
        </html>
      `, {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'text/html' }
      });
    }

    console.log(`Processing email approval: token=${token}, action=${action}`);

    // Find approval record by token
    const { data: approval, error: approvalError } = await supabase
      .from('delivery_note_approvals')
      .select(`
        *,
        approval_levels!inner(name, email),
        delivery_notes!inner(delivery_number, customer_name, division)
      `)
      .eq('approval_token', token)
      .eq('status', 'pending')
      .single();

    if (approvalError || !approval) {
      console.error('Approval not found or already processed:', approvalError);
      return new Response(`
        <html>
          <body style="font-family: Arial, sans-serif; text-align: center; padding: 50px;">
            <h1>❌ Approval Tidak Ditemukan</h1>
            <p>Link approval tidak valid atau sudah diproses sebelumnya.</p>
          </body>
        </html>
      `, {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'text/html' }
      });
    }

    // Check if token is expired
    if (approval.token_expires_at && new Date(approval.token_expires_at) < new Date()) {
      return new Response(`
        <html>
          <body style="font-family: Arial, sans-serif; text-align: center; padding: 50px;">
            <h1>⏰ Link Kadaluarsa</h1>
            <p>Link approval telah kadaluarsa. Silakan minta link baru dari sistem.</p>
          </body>
        </html>
      `, {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'text/html' }
      });
    }

    const deliveryNote = approval.delivery_notes;
    const approverName = approval.approval_levels.name;
    const newStatus = action === 'approve' ? 'approved' : 'rejected';

    // Update approval status
    const { error: updateError } = await supabase
      .from('delivery_note_approvals')
      .update({
        status: newStatus,
        approved_at: new Date().toISOString(),
        notes: `Disetujui melalui email oleh ${approverName}`,
        approval_token: null, // Clear token after use
        token_expires_at: null
      })
      .eq('id', approval.id);

    if (updateError) {
      console.error('Error updating approval:', updateError);
      throw updateError;
    }

    let finalStatus = '';
    let statusColor = '';
    let statusIcon = '';

    if (action === 'reject') {
      // If rejected, update delivery note status
      await supabase
        .from('delivery_notes')
        .update({ approval_status: 'rejected' })
        .eq('id', approval.delivery_note_id);

      // Return stock for rejected delivery note
      const { data: deliveryNoteItems, error: itemsError } = await supabase
        .from('delivery_note_items')
        .select('product_id, quantity')
        .eq('delivery_note_id', approval.delivery_note_id);

      if (itemsError) {
        console.error('Error fetching delivery note items:', itemsError);
        throw itemsError;
      }

      // Create stock transactions to return the stock
      if (deliveryNoteItems && deliveryNoteItems.length > 0) {
        const stockTransactions = deliveryNoteItems.map(item => ({
          product_id: item.product_id,
          transaction_type: 'in',
          quantity: item.quantity,
          reference_number: `RETURN-${deliveryNote.delivery_number}`,
          notes: `Pengembalian stok karena surat jalan ditolak: ${deliveryNote.delivery_number}`
        }));

        const { error: stockError } = await supabase
          .from('stock_transactions')
          .insert(stockTransactions);

        if (stockError) {
          console.error('Error creating return stock transactions:', stockError);
          throw stockError;
        }

        console.log(`Stock returned for rejected delivery note: ${deliveryNote.delivery_number}`);
      }

      // Send rejection notification
      await supabase.functions.invoke('send-approval-email', {
        body: {
          deliveryNoteId: approval.delivery_note_id,
          deliveryNumber: deliveryNote.delivery_number,
          customerName: deliveryNote.customer_name,
          type: 'rejected'
        }
      });

      finalStatus = 'DITOLAK';
      statusColor = '#ef4444';
      statusIcon = '❌';
    } else {
      // Check if all approvals are now completed
      const { data: allApprovals, error: allApprovalsError } = await supabase
        .from('delivery_note_approvals')
        .select('status, approval_levels!inner(division)')
        .eq('delivery_note_id', approval.delivery_note_id)
        .eq('approval_levels.division', deliveryNote.division);

      if (allApprovalsError) {
        console.error('Error checking all approvals:', allApprovalsError);
        throw allApprovalsError;
      }

      const allApproved = allApprovals.every(a => a.status === 'approved');

      if (allApproved) {
        // All approved, update delivery note
        await supabase
          .from('delivery_notes')
          .update({ approval_status: 'approved' })
          .eq('id', approval.delivery_note_id);

        // Send approval notification
        await supabase.functions.invoke('send-approval-email', {
          body: {
            deliveryNoteId: approval.delivery_note_id,
            deliveryNumber: deliveryNote.delivery_number,
            customerName: deliveryNote.customer_name,
            type: 'approved'
          }
        });

        finalStatus = 'DISETUJUI LENGKAP';
        statusColor = '#10b981';
        statusIcon = '✅';
      } else {
        // Send next approval request
        await supabase.functions.invoke('send-approval-email', {
          body: {
            deliveryNoteId: approval.delivery_note_id,
            deliveryNumber: deliveryNote.delivery_number,
            customerName: deliveryNote.customer_name,
            type: 'approval_request'
          }
        });

        finalStatus = 'DISETUJUI (Menunggu approval berikutnya)';
        statusColor = '#f59e0b';
        statusIcon = '⏳';
      }
    }

    console.log(`Approval processed successfully: ${newStatus} for delivery note ${deliveryNote.delivery_number}`);

    return new Response(`
      <html>
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Approval Berhasil</title>
        </head>
        <body style="font-family: Arial, sans-serif; text-align: center; padding: 50px; background-color: #f5f5f5;">
          <div style="background-color: white; border-radius: 10px; padding: 40px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1); max-width: 500px; margin: 0 auto;">
            <div style="font-size: 48px; margin-bottom: 20px;">${statusIcon}</div>
            <h1 style="color: ${statusColor}; margin-bottom: 20px;">${finalStatus}</h1>
            <div style="background-color: #f9f9f9; padding: 20px; border-radius: 5px; margin: 20px 0;">
              <p style="margin: 5px 0;"><strong>No. Surat Jalan:</strong> ${deliveryNote.delivery_number}</p>
              <p style="margin: 5px 0;"><strong>Customer:</strong> ${deliveryNote.customer_name}</p>
              <p style="margin: 5px 0;"><strong>Divisi:</strong> ${deliveryNote.division}</p>
              <p style="margin: 5px 0;"><strong>Approver:</strong> ${approverName}</p>
            </div>
            <p style="color: #666; margin-top: 20px;">
              Terima kasih atas persetujuan Anda. Status telah diperbarui di sistem.
            </p>
          </div>
        </body>
      </html>
    `, {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'text/html' }
    });

  } catch (error: any) {
    console.error("Error in handle-email-approval function:", error);
    return new Response(`
      <html>
        <body style="font-family: Arial, sans-serif; text-align: center; padding: 50px;">
          <h1>❌ Terjadi Kesalahan</h1>
          <p>Mohon maaf, terjadi kesalahan saat memproses approval.</p>
          <p style="color: #666;">${error.message}</p>
        </body>
      </html>
    `, {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'text/html' }
    });
  }
};

serve(handler);