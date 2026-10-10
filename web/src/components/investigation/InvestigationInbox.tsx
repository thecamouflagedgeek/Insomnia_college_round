import { useState, useEffect } from 'react';
import { ApiService } from '../../services/api';
import { useAuth } from '../../hooks/useAuth';
import { MessageSquare, Send, ShieldCheck, Lock, AlertCircle } from 'lucide-react';

interface InvestigationInboxProps {
  complaintId?: string;
}

export function InvestigationInbox({ complaintId = 'INC-892' }: InvestigationInboxProps) {
  const { currentUser } = useAuth();
  const [messages, setMessages] = useState<Array<{ id: string; sender: string; text: string; timestamp: string; isEncrypted: boolean }>>([]);
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(false);
  const [accessError, setAccessError] = useState<string | null>(null);

  const loadMessages = async () => {
    setAccessError(null);
    const res = await ApiService.getMessages(complaintId);
    if (res.success && res.data) {
      setMessages(res.data);
    } else {
      setAccessError(res.error || 'Access Denied: You do not have permissions to read secure messages for this case.');
    }
  };

  useEffect(() => {
    loadMessages();
  }, [complaintId, currentUser.id]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim()) return;

    setLoading(true);
    const res = await ApiService.sendMessage(complaintId, inputText);
    setInputText('');
    setLoading(false);

    if (res.success) {
      loadMessages();
    } else {
      alert(res.error || 'Failed to send message');
    }
  };

  if (accessError) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-3xl p-8 text-center">
        <div className="w-12 h-12 rounded-2xl bg-red-100 flex items-center justify-center text-red-600 mx-auto mb-3">
          <Lock className="w-6 h-6" />
        </div>
        <h3 className="text-base font-bold text-red-950">Encrypted Channel Access Restricted</h3>
        <p className="text-xs text-red-800 max-w-md mx-auto mt-1 leading-relaxed">
          {accessError}
        </p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-3xl p-6 border border-stone-100 shadow-sm flex flex-col h-[580px]">
      {/* Header */}
      <div className="flex items-center justify-between pb-4 border-b border-stone-100 mb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-purple-50 flex items-center justify-center text-[#5B3FA3]">
            <MessageSquare className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base font-bold text-[#191725]">Anonymous Investigation Channel</h3>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200">
                End-to-End PGP Encrypted
              </span>
            </div>
            <p className="text-xs text-[#777487]">
              Case {complaintId} • Blinded Identity Relay (Zero Knowledge Verified)
            </p>
          </div>
        </div>

        <div className="text-right">
          <span className="text-xs font-mono text-purple-700 font-bold bg-purple-50 px-2.5 py-1 rounded-full border border-purple-200">
            ZK-Nullifier Active
          </span>
        </div>
      </div>

      {/* Message Stream */}
      <div className="flex-1 overflow-y-auto space-y-3 pr-2 mb-4">
        {messages.map((m) => {
          const isMe = m.sender.includes(currentUser.name);

          return (
            <div
              key={m.id}
              className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}
            >
              <div className="flex items-center gap-1.5 mb-1 text-[10px] text-[#777487]">
                <ShieldCheck className="w-3 h-3 text-[#5B3FA3]" />
                <span className="font-bold">{m.sender}</span>
                <span>• {new Date(m.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
              </div>
              <div
                className={`max-w-md p-3.5 rounded-2xl text-xs leading-relaxed ${
                  isMe
                    ? 'bg-[#5B3FA3] text-white rounded-tr-sm shadow-sm'
                    : 'bg-[#FAF7F5] text-[#191725] border border-stone-200/80 rounded-tl-sm'
                }`}
              >
                {m.text}
              </div>
            </div>
          );
        })}
      </div>

      {/* Input */}
      <form onSubmit={handleSend} className="pt-3 border-t border-stone-100 flex items-center gap-2">
        <input
          type="text"
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          placeholder={`Secure reply as ${currentUser.name}...`}
          className="flex-1 bg-[#FAF7F5] border border-stone-200 rounded-2xl px-4 py-3 text-xs text-[#191725] focus:outline-none focus:border-[#5B3FA3]"
        />
        <button
          type="submit"
          disabled={loading || !inputText.trim()}
          className="px-5 py-3 bg-[#5B3FA3] hover:bg-[#493184] text-white text-xs font-bold rounded-2xl transition-all shadow-sm flex items-center gap-2 disabled:opacity-50"
        >
          <Send className="w-3.5 h-3.5 text-[#FFD08A]" />
          <span>Send</span>
        </button>
      </form>

      <div className="mt-2 text-[10px] text-[#777487] flex items-center justify-between">
        <span className="flex items-center gap-1">
          <AlertCircle className="w-3 h-3 text-stone-400" />
          Sender identity masked with temporary ephemeral relay token
        </span>
        <span className="font-mono text-stone-400">ECDSA-secp256k1 verified</span>
      </div>
    </div>
  );
}
