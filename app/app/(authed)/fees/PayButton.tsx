'use client';
import { useState } from 'react';
import { confirmPaymentAction, startPaymentAction } from '@/app/app/portal-actions';

declare global {
  interface Window {
    Razorpay?: new (o: Record<string, unknown>) => { open: () => void };
  }
}

function loadCheckout(): Promise<boolean> {
  if (window.Razorpay) return Promise.resolve(true);
  return new Promise((resolve) => {
    const s = document.createElement('script');
    s.src = 'https://checkout.razorpay.com/v1/checkout.js';
    s.onload = () => resolve(true);
    s.onerror = () => resolve(false);
    document.body.appendChild(s);
  });
}

/** UPI / card / net banking through Razorpay Checkout; the server verifies the signature before recording. */
export function PayButton({ label }: { label: string }) {
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  async function pay() {
    setBusy(true);
    setMsg(null);
    const r = await startPaymentAction(null, new FormData());
    if (r.error || !r.order) {
      setMsg(r.error ?? 'Could not start the payment.');
      setBusy(false);
      return;
    }
    if (!(await loadCheckout()) || !window.Razorpay) {
      setMsg('The payment page could not load. Check your connection and try again.');
      setBusy(false);
      return;
    }
    const o = r.order;
    new window.Razorpay({
      key: o.key,
      order_id: o.id,
      amount: o.amount,
      currency: 'INR',
      name: 'Bhargava Junior College',
      description: `Fee instalment · ${o.name}`,
      handler: (res: { razorpay_order_id: string; razorpay_payment_id: string; razorpay_signature: string }) => {
        const fd = new FormData();
        fd.set('orderId', res.razorpay_order_id);
        fd.set('paymentId', res.razorpay_payment_id);
        fd.set('signature', res.razorpay_signature);
        fd.set('amount', String(o.amount));
        void confirmPaymentAction(fd);
      },
      modal: { ondismiss: () => setBusy(false) },
      theme: { color: '#7D1F2C' },
    }).open();
  }
  return (
    <div>
      <button type="button" onClick={pay} disabled={busy} className="btn-primary w-full py-3">{busy ? 'Opening…' : label}</button>
      {msg && <p role="alert" className="mt-2 text-sm text-red-700 dark:text-red-300">{msg}</p>}
    </div>
  );
}
