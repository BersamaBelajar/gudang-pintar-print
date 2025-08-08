import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.53.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ApprovalRequest {
  deliveryNoteId: string;
  approvalLevelId: string;
  action: 'approve' | 'reject';
  notes?: string;
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

    const { deliveryNoteId, approvalLevelId, action, notes }: ApprovalRequest = await req.json();

    console.log(`Processing ${action} for delivery note ${deliveryNoteId}, approval level ${approvalLevelId}`);

    // Update approval status
    const { error: updateError } = await supabase
      .from('delivery_note_approvals')
      .update({
        status: action === 'approve' ? 'approved' : 'rejected',
        approved_at: new Date().toISOString(),
        notes: notes || null
      })
      .eq('delivery_note_id', deliveryNoteId)
      .eq('approval_level_id', approvalLevelId);

    if (updateError) {
      console.error('Error updating approval:', updateError);
      throw updateError;
    }

    if (action === 'reject') {
      // If rejected, update delivery note status to rejected
      await supabase
        .from('delivery_notes')
        .update({ approval_status: 'rejected' })
        .eq('id', deliveryNoteId);

      // Return stock for rejected delivery note
      const { data: deliveryNoteItems, error: itemsError } = await supabase
        .from('delivery_note_items')
        .select('product_id, quantity')
        .eq('delivery_note_id', deliveryNoteId);

      if (itemsError) {
        console.error('Error fetching delivery note items:', itemsError);
        throw itemsError;
      }

      // Get delivery note details for reference number
      const { data: deliveryNote, error: noteError } = await supabase
        .from('delivery_notes')
        .select('delivery_number')
        .eq('id', deliveryNoteId)
        .single();

      if (noteError) {
        console.error('Error fetching delivery note:', noteError);
        throw noteError;
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
      await fetch(`${supabaseUrl}/functions/v1/send-approval-email`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${supabaseServiceKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          deliveryNoteId,
          deliveryNumber: '', // Will be fetched in the email function
          customerName: '',
          type: 'rejected'
        }),
      });

    } else {
      // Check if all approvals are completed
      const { data: allApprovals, error: checkError } = await supabase
        .from('delivery_note_approvals')
        .select('status')
        .eq('delivery_note_id', deliveryNoteId);

      if (checkError) {
        console.error('Error checking approvals:', checkError);
        throw checkError;
      }

      const allApproved = allApprovals?.every(approval => approval.status === 'approved');

      if (allApproved) {
        // All levels approved - mark as approved
        await supabase
          .from('delivery_notes')
          .update({ approval_status: 'approved' })
          .eq('id', deliveryNoteId);

        // Send approval notification
        await fetch(`${supabaseUrl}/functions/v1/send-approval-email`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${supabaseServiceKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            deliveryNoteId,
            deliveryNumber: '',
            customerName: '',
            type: 'approved'
          }),
        });
      } else {
        // Send request to next approver
        await fetch(`${supabaseUrl}/functions/v1/send-approval-email`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${supabaseServiceKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            deliveryNoteId,
            deliveryNumber: '',
            customerName: '',
            type: 'approval_request'
          }),
        });
      }
    }

    return new Response(JSON.stringify({ 
      success: true, 
      message: `Delivery note ${action === 'approve' ? 'approved' : 'rejected'} successfully` 
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: any) {
    console.error("Error in handle-approval function:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
};

serve(handler);