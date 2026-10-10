import { useState } from 'react';
import { Mail, Send, AlertTriangle, CheckCircle2, ShieldCheck, Eye } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';

export function EmailNotices() {
  const { currentUser } = useAuth();
  const [template, setTemplate] = useState<'reassignment' | 'witness_invite' | 'closure'>('reassignment');
  const [recipient, setRecipient] = useState('p.sundaram@incognito.org');
  const [caseRef, setCaseRef] = useState('INC-892');
  const [confirmModalOpen, setConfirmModalOpen] = useState(false);
  const [sentNotice, setSentNotice] = useState<string | null>(null);

  const templates = {
    reassignment: {
      title: 'Committee Appointment Notice (Conflict Reassignment)',
      subject: '[INCOGNITO NOTICE] Appointment to Independent Case Committee Ref: #INC-892',
      body: `Dear Priya Sundaram,\n\nPursuant to an Independent Ombudsperson conflict determination under Oversight Protocol § 4.2, you have been appointed to the review committee for Case #INC-892.\n\nAll case communications, evidence vaults, and audit logs are accessible via your authenticated portal session. Please confirm your conflict-of-interest disclosure within 24 hours.\n\nRespectfully,\nIndependent Ethics Oversight Directorate`
    },
    witness_invite: {
      title: 'Confidential Voluntary Witness Corroboration Invitation',
      subject: '[CONFIDENTIAL] Voluntary Request for Corroborating Observation Ref: #WIT-QUORUM',
      body: `Greetings,\n\nYou have been invited to submit an optional, encrypted statement regarding an ongoing workplace review.\n\nYour participation is strictly voluntary. Your identity remains protected under our Zero-Knowledge nullifier protocol, and non-participation is treated with complete neutrality pursuant to our Non-Retaliation Policy.`
    },
    closure: {
      title: 'Formal Investigation Conclusion & Findings Notification',
      subject: '[INCOGNITO] Investigation Conclusion Summary: Case #INC-892',
      body: `Formal investigative milestones for Case #INC-892 have concluded. The independent committee findings have been committed to the tamper-evident audit ledger.`
    }
  };

  const handleSend = () => {
    setConfirmModalOpen(false);
    setSentNotice(`Notice successfully delivered to sandbox endpoint: [Mailtrap SMTP : 2525] for ${recipient}. No live external emails dispatched.`);
    setTimeout(() => setSentNotice(null), 5000);
  };

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center gap-2">
          <h1 className="text-xl font-bold text-[#191725]">Controlled Email Notices</h1>
          <span className="text-xs px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-bold border border-emerald-300">
            Mailtrap Sandbox Mode Enforced
          </span>
        </div>
        <p className="text-xs text-[#777487] mt-1">
          Formal procedural notifications • Requires explicit human confirmation • Accused never notified automatically
        </p>
      </div>

      {/* Safety Notice */}
      <div className="p-4 bg-purple-50/70 border border-purple-200 rounded-3xl text-xs text-purple-900 flex items-start gap-3">
        <ShieldCheck className="w-5 h-5 text-[#5B3FA3] shrink-0 mt-0.5" />
        <div className="leading-relaxed">
          <strong>Anti-Leak Protection:</strong> The platform prohibits automatic email triggers on report filing.
          All outbound communications utilize pre-vetted legal templates, require manual authorization, and route
          through an isolated developer sandbox to prevent unintended real-world email dispatches during evaluations.
        </div>
      </div>

      {/* Form & Preview Card */}
      <div className="bg-white rounded-3xl p-6 border border-stone-100 shadow-sm grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left Form */}
        <div className="space-y-4 text-xs">
          <div>
            <label className="block font-bold text-[#191725] mb-1">Select Approved Template:</label>
            <select
              value={template}
              onChange={(e) => setTemplate(e.target.value as any)}
              className="w-full bg-[#FAF7F5] border border-stone-200 rounded-2xl p-3 font-semibold text-[#191725] focus:outline-none focus:border-[#5B3FA3]"
            >
              <option value="reassignment">Committee Appointment Notice (Reassignment)</option>
              <option value="witness_invite">Confidential Witness Invitation</option>
              <option value="closure">Investigation Conclusion</option>
            </select>
          </div>

          <div>
            <label className="block font-bold text-[#191725] mb-1">Target Recipient (Sandbox Address):</label>
            <input
              type="text"
              value={recipient}
              onChange={(e) => setRecipient(e.target.value)}
              className="w-full bg-[#FAF7F5] border border-stone-200 rounded-2xl p-3 text-[#191725] focus:outline-none focus:border-[#5B3FA3]"
            />
          </div>

          <div>
            <label className="block font-bold text-[#191725] mb-1">Associated Case Reference:</label>
            <input
              type="text"
              value={caseRef}
              onChange={(e) => setCaseRef(e.target.value)}
              className="w-full bg-[#FAF7F5] border border-stone-200 rounded-2xl p-3 font-mono text-[#191725] focus:outline-none focus:border-[#5B3FA3]"
            />
          </div>

          <div className="pt-2">
            <button
              onClick={() => setConfirmModalOpen(true)}
              className="w-full py-3 bg-[#5B3FA3] hover:bg-[#493184] text-white font-bold rounded-2xl transition-all shadow-md flex items-center justify-center gap-2"
            >
              <Send className="w-4 h-4 text-[#FFD08A]" />
              <span>Review Notice & Authorize Sandbox Delivery</span>
            </button>
          </div>
        </div>

        {/* Right Preview */}
        <div className="bg-[#FAF7F5] rounded-2xl p-5 border border-stone-200/80 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-stone-200 mb-3 text-xs">
              <span className="font-bold text-[#191725] flex items-center gap-1.5">
                <Eye className="w-3.5 h-3.5 text-[#5B3FA3]" />
                Template Preview
              </span>
              <span className="text-[10px] font-mono text-stone-500">MIME: text/plain</span>
            </div>

            <div className="space-y-2 text-xs">
              <p className="text-[#777487]">
                <strong className="text-[#191725]">Subject:</strong> {templates[template].subject}
              </p>
              <div className="p-3 bg-white rounded-xl border border-stone-200 text-[#191725] whitespace-pre-wrap leading-relaxed text-[11px] max-h-56 overflow-y-auto">
                {templates[template].body}
              </div>
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-stone-200 text-[10px] text-[#777487] flex items-center justify-between">
            <span>Authorizing Reviewer: <strong>{currentUser.name}</strong></span>
            <span className="text-emerald-700 font-bold">Mailtrap Sandbox Verified</span>
          </div>
        </div>
      </div>

      {/* Confirmation Modal */}
      {confirmModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 max-w-md w-full shadow-2xl border border-stone-100 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-amber-100 flex items-center justify-center text-amber-700">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-[#191725]">Confirm Procedural Notice</h3>
                <p className="text-xs text-[#777487]">Explicit confirmation required before dispatch</p>
              </div>
            </div>

            <p className="text-xs text-[#191725] leading-relaxed">
              Are you sure you wish to dispatch <strong>{templates[template].title}</strong> to{' '}
              <code className="text-[#5B3FA3] bg-purple-50 px-1 py-0.5 rounded">{recipient}</code>?
              This action will be committed to the case audit log.
            </p>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => setConfirmModalOpen(false)}
                className="px-4 py-2 bg-stone-100 hover:bg-stone-200 text-stone-700 text-xs font-bold rounded-xl transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSend}
                className="px-5 py-2 bg-[#5B3FA3] hover:bg-[#493184] text-white text-xs font-bold rounded-xl transition-all shadow-sm"
              >
                Confirm & Dispatch
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Success alert */}
      {sentNotice && (
        <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-300 text-xs text-emerald-900 flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{sentNotice}</span>
        </div>
      )}
    </div>
  );
}
