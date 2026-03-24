'use client';

import React, { useState, useRef } from 'react';
import AppIcon from '@/components/ui/AppIcon';
import { createClient } from '@/lib/supabase/client';
import toast from 'react-hot-toast';

interface RequestSummary {
  id: string;
  source: 'cart' | 'form';
  customer_name: string;
  customer_email: string;
  items?: any[];
  total?: number;
  category?: string;
  message?: string;
}

interface Props {
  request: RequestSummary;
  onClose: () => void;
  onSent: () => void;
}

export default function QuoteResponseModal({ request, onClose, onSent }: Props) {
  const supabase = createClient();
  const [form, setForm] = useState({
    message:      '',
    observations: '',
    requirements: '',
  });
  const [pdfFile, setPdfFile]         = useState<File | null>(null);
  const [uploading, setUploading]     = useState(false);
  const [sending, setSending]         = useState(false);
  const fileRef                       = useRef<HTMLInputElement>(null);

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement | HTMLInputElement>) =>
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));

  const handlePdfSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) { toast.error('PDF muito grande. Máximo 10MB.'); return; }
    if (file.type !== 'application/pdf') { toast.error('Somente arquivos PDF são aceitos.'); return; }
    setPdfFile(file);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSending(true);
    try {
      let pdf_url  = null;
      let pdf_name = null;

      // Upload do PDF se anexado
      if (pdfFile) {
        setUploading(true);
        const filename = `${Date.now()}-${request.id.slice(0, 8)}.pdf`;
        const { error: uploadErr } = await supabase.storage
          .from('quote-pdfs').upload(filename, pdfFile, { contentType: 'application/pdf', upsert: true });
        if (uploadErr) throw uploadErr;
        const { data: urlData } = supabase.storage.from('quote-pdfs').getPublicUrl(filename);
        pdf_url  = urlData.publicUrl;
        pdf_name = pdfFile.name;
        setUploading(false);
      }

      // Monta resumo de produtos
      const products_summary = request.source === 'cart'
        ? request.items?.map((i: any) => ({
            name: i.name, quantity: i.quantity, unit: i.unit,
            price: i.price, total: i.price * i.quantity,
          })) ?? []
        : [{ category: request.category, message: request.message }];

      // Salva resposta no banco
      const { error } = await supabase.from('quote_responses').insert([{
        request_id:       request.id,
        request_type:     request.source,
        customer_email:   request.customer_email,
        customer_name:    request.customer_name,
        message:          form.message || null,
        products_summary,
        observations:     form.observations || null,
        requirements:     form.requirements || null,
        pdf_url,
        pdf_name,
        status: 'sent',
      }]);
      if (error) throw error;

      toast.success(`Resposta enviada para ${request.customer_name}!`);
      onSent();
    } catch (err: any) {
      toast.error(err?.message ?? 'Erro ao enviar resposta.');
    } finally {
      setSending(false);
      setUploading(false);
    }
  };

  return (
    <div className="fixed inset-0 modal-backdrop z-[60] flex items-center justify-center p-4">
      <div className="bg-white rounded-4xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-red-xl border border-border">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-border px-8 py-5 flex items-center justify-between rounded-t-4xl z-10">
          <div>
            <h2 className="text-xl font-bold text-foreground">Responder Orçamento</h2>
            <p className="text-[11px] text-muted mt-0.5">Para: <strong>{request.customer_name}</strong> · {request.customer_email}</p>
          </div>
          <button onClick={onClose} className="w-10 h-10 rounded-xl bg-surface hover:bg-border transition-colors flex items-center justify-center">
            <AppIcon name="XMarkIcon" size={18} className="text-muted" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-8 space-y-6">
          {/* Resumo dos itens solicitados */}
          <div className="p-5 rounded-2xl bg-surface border border-border">
            <p className="text-[10px] uppercase tracking-widest font-bold text-muted mb-3">Itens Solicitados</p>
            {request.source === 'cart' && request.items ? (
              <div className="space-y-2">
                {request.items.map((item: any, i: number) => (
                  <div key={i} className="flex items-center justify-between text-sm">
                    <span className="font-medium text-foreground">{item.quantity}× {item.name}</span>
                    <span className="text-primary font-bold">R$ {(item.price * item.quantity).toFixed(2).replace('.', ',')}</span>
                  </div>
                ))}
                {request.total && (
                  <div className="flex items-center justify-between text-sm font-bold border-t border-border pt-2 mt-2">
                    <span>Total</span>
                    <span className="text-primary text-base">R$ {request.total.toFixed(2).replace('.', ',')}</span>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-sm text-muted">
                <span className="font-medium">Categoria:</span> {request.category}
                {request.message && <p className="mt-1">{request.message}</p>}
              </div>
            )}
          </div>

          {/* Mensagem principal */}
          <div>
            <label className="text-[10px] uppercase tracking-[0.25em] font-bold text-muted block mb-2">
              Mensagem para o Cliente
            </label>
            <textarea name="message" rows={4} value={form.message} onChange={handleChange}
              placeholder="Ex: Olá! Segue nossa proposta para os itens solicitados. Temos disponibilidade imediata..."
              className="w-full px-4 py-3 rounded-xl border border-border bg-white text-sm focus:outline-none focus:border-primary transition-colors resize-none" />
          </div>

          {/* Observações */}
          <div>
            <label className="text-[10px] uppercase tracking-[0.25em] font-bold text-muted block mb-2">
              Observações
            </label>
            <textarea name="observations" rows={2} value={form.observations} onChange={handleChange}
              placeholder="Ex: Prazo de entrega: 3 dias úteis. Frete grátis acima de R$ 500."
              className="w-full px-4 py-3 rounded-xl border border-border bg-white text-sm focus:outline-none focus:border-primary transition-colors resize-none" />
          </div>

          {/* Requisitos para fechar */}
          <div>
            <label className="text-[10px] uppercase tracking-[0.25em] font-bold text-muted block mb-2">
              Requisitos para Finalizar a Compra
            </label>
            <textarea name="requirements" rows={2} value={form.requirements} onChange={handleChange}
              placeholder="Ex: Enviar comprovante de CNPJ. Pagamento: 50% na confirmação + 50% na entrega."
              className="w-full px-4 py-3 rounded-xl border border-border bg-white text-sm focus:outline-none focus:border-primary transition-colors resize-none" />
          </div>

          {/* Anexar PDF */}
          <div>
            <label className="text-[10px] uppercase tracking-[0.25em] font-bold text-muted block mb-2">
              Anexar Modelo de Orçamento (PDF)
            </label>
            <input ref={fileRef} type="file" accept="application/pdf" onChange={handlePdfSelect} className="hidden" />
            {pdfFile ? (
              <div className="flex items-center gap-3 p-4 rounded-xl bg-primary/8 border border-primary/20">
                <AppIcon name="DocumentTextIcon" size={24} className="text-primary shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-foreground truncate">{pdfFile.name}</p>
                  <p className="text-[11px] text-muted">{(pdfFile.size / 1024).toFixed(0)} KB</p>
                </div>
                <button type="button" onClick={() => setPdfFile(null)}
                  className="w-8 h-8 rounded-lg bg-white border border-border flex items-center justify-center text-muted hover:text-primary transition-colors">
                  <AppIcon name="XMarkIcon" size={14} />
                </button>
              </div>
            ) : (
              <button type="button" onClick={() => fileRef.current?.click()}
                className="w-full py-4 rounded-xl border-2 border-dashed border-border hover:border-primary/40 hover:bg-primary/5 transition-all flex items-center justify-center gap-3 text-muted hover:text-primary">
                <AppIcon name="ArrowUpTrayIcon" size={20} />
                <span className="text-sm font-medium">Clique para anexar PDF (máx 10MB)</span>
              </button>
            )}
          </div>

          {/* Ações */}
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose}
              className="flex-1 py-3.5 rounded-xl border border-border text-sm font-bold text-foreground hover:bg-surface transition-colors">
              Cancelar
            </button>
            <button type="submit" disabled={sending || uploading}
              className="flex-1 py-3.5 rounded-xl bg-primary text-white text-sm font-bold hover:bg-primary-dark transition-all shadow-red-lg disabled:opacity-60 flex items-center justify-center gap-2">
              {sending || uploading ? (
                <><svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>{uploading ? 'Enviando PDF...' : 'Enviando...'}</>
              ) : (
                <><AppIcon name="PaperAirplaneIcon" size={16} />Enviar Resposta</>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
