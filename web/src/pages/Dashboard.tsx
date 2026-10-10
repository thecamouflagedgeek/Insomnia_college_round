import { useState, useEffect } from 'react';
import { Complaint } from '../types/complaint';
import { CommitteeChallenge } from '../types/committee';
import { ApiService } from '../services/api';
import { StatCard } from '../components/ui/StatCard';
import { ComplaintTable } from '../components/complaints/ComplaintTable';
import { ResolutionTrendsChart } from '../components/ui/ResolutionTrendsChart';
import { ReflectReformCard } from '../components/ui/ReflectReformCard';
import { NavPage } from '../components/layout/Sidebar';
import { useAuth } from '../hooks/useAuth';
import {
  FolderGit2,
  AlertTriangle,
  Radio,
  ShieldCheck,
  Calendar as CalendarIcon,
  CheckSquare,
  MessageSquare,
  ArrowRight,
  Send,
  ChevronRight
} from 'lucide-react';

interface DashboardProps {
  onNavigate: (page: NavPage, selectedCaseId?: string) => void;
}

export function Dashboard({ onNavigate }: DashboardProps) {
  const { currentUser } = useAuth();
  const [complaints, setComplaints] = useState<Complaint[]>([]);
  const [challenges, setChallenges] = useState<CommitteeChallenge[]>([]);
  const [loading, setLoading] = useState(true);

  // Investigation tasks checklist state
  const [tasks, setTasks] = useState([
    { id: 't1', title: 'Adjudicate supervisory conflict challenge for Case INC-892', time: '10:00 AM', done: false, caseId: 'INC-892' },
    { id: 't2', title: 'Verify ZK Merkle roots against Polygon contract', time: '11:30 AM', done: true },
    { id: 't3', title: 'Collate Witness Alpha & Beta voluntary statements', time: '02:00 PM', done: false, caseId: 'INC-892' },
    { id: 't4', title: 'Review statistical compensation distribution anomalies', time: '04:15 PM', done: false }
  ]);

  const loadData = async () => {
    setLoading(true);
    const [cRes, chRes] = await Promise.all([
      ApiService.getReports(),
      ApiService.getChallenges()
    ]);
    if (cRes.data) setComplaints(cRes.data);
    if (chRes.data) setChallenges(chRes.data);
    setLoading(false);
  };

  useEffect(() => {
    loadData();
  }, [currentUser.id]);

  const toggleTask = (id: string) => {
    setTasks(tasks.map(t => t.id === id ? { ...t, done: !t.done } : t));
  };

  const pendingChallenge = challenges.find(ch => ch.status === 'pending_independent_review');
  const activeCasesCount = complaints.length;
  const criticalCount = complaints.filter(c => c.severity === 'critical').length;

  return (
    <div className="space-y-6">
      {/* 1. Stat Cards Row matching reference aesthetic */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Active Complaints Queue"
          value={activeCasesCount}
          subtitle="Accessible under current role"
          icon={<FolderGit2 className="w-5 h-5 text-[#5B3FA3]" />}
          badge={{ text: `${criticalCount} Critical`, variant: 'warning' }}
          onClick={() => onNavigate('reports')}
        />

        <StatCard
          title="Committee Challenges"
          value={challenges.filter(c => c.status === 'pending_independent_review').length}
          subtitle="Pending conflict adjudication"
          icon={<AlertTriangle className="w-5 h-5 text-amber-600" />}
          badge={{ text: 'Action Required', variant: 'warning' }}
          highlight={true}
          onClick={() => onNavigate('committee')}
        />

        <StatCard
          title="Witness Quorum Live"
          value="2 Active"
          subtitle="Blinded corroboration in flight"
          icon={<Radio className="w-5 h-5 text-[#5B3FA3]" />}
          badge={{ text: 'Protected', variant: 'purple' }}
          onClick={() => onNavigate('witness')}
        />

        <StatCard
          title="Cryptographic Integrity"
          value="100%"
          subtitle="Polygon PoS Commitments Verified"
          icon={<ShieldCheck className="w-5 h-5 text-emerald-600" />}
          badge={{ text: 'Tamper Proof', variant: 'success' }}
        />
      </div>

      {/* 2. Prominent Case Resolution Trend Graph */}
      <ResolutionTrendsChart />

      {/* Reflect & Reform (live backend, HR/oversight roles) */}
      <ReflectReformCard />

      {/* 3. Main Grid: Left Primary Workflow + Right Reference Panels (Calendar, Tasks, Chat) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column (8 cols): Banner + Priority Complaints */}
        <div className="lg:col-span-8 space-y-6">
          {/* Prominent Purple Notification Card matching reference image */}
          {pendingChallenge && (
            <div className="bg-[#5B3FA3] text-white rounded-3xl p-6 shadow-md relative overflow-hidden border border-purple-400/20">
              <div className="absolute -right-8 -top-8 w-36 h-36 bg-[#FFD08A]/15 rounded-full blur-2xl pointer-events-none" />

              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-white/15 flex items-center justify-center shrink-0 border border-white/20">
                    <AlertTriangle className="w-5 h-5 text-[#FFD08A]" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-mono font-bold text-[#FFD08A] uppercase tracking-wider">
                        High Priority Conflict Challenge
                      </span>
                      <span className="text-[10px] bg-white/20 px-2 py-0.5 rounded-full font-bold">
                        Case {pendingChallenge.complaintId}
                      </span>
                    </div>
                    <h3 className="text-base font-bold text-white mt-1">
                      {pendingChallenge.challengedMemberName} challenged on grounds of supervisory conflict
                    </h3>
                    <p className="text-xs text-purple-200 mt-1 max-w-xl leading-relaxed">
                      {pendingChallenge.conflictDetails}
                    </p>
                  </div>
                </div>

                <button
                  onClick={() => onNavigate('committee')}
                  className="px-4 py-2.5 bg-[#FFD08A] hover:bg-[#ffe0ad] text-[#191725] text-xs font-bold rounded-2xl transition-all shadow-sm shrink-0 flex items-center gap-1.5"
                >
                  <span>Review in Committee</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          )}

          {/* Active Complaint Queue Section */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base font-bold text-[#191725]">Priority Investigation Queue</h2>
                <p className="text-xs text-[#777487]">
                  Role-authorized cases filtered with zero reporter identity leakage
                </p>
              </div>

              <button
                onClick={() => onNavigate('reports')}
                className="text-xs font-bold text-[#5B3FA3] hover:underline flex items-center gap-1"
              >
                <span>View Full Roster</span>
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>

            {loading ? (
              <div className="p-8 text-center bg-white rounded-3xl border border-stone-100 text-xs text-[#777487]">
                Loading cases...
              </div>
            ) : (
              <ComplaintTable
                complaints={complaints.slice(0, 4)}
                onSelectComplaint={(c) => onNavigate('report_details', c.id)}
              />
            )}
          </div>
        </div>

        {/* Right Column (4 cols): Calendar, Today's Investigative Tasks, Channel Preview matching reference image */}
        <div className="lg:col-span-4 space-y-6">
          {/* Calendar Widget matching reference image */}
          <div className="bg-white rounded-3xl p-5 border border-stone-100 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <CalendarIcon className="w-4 h-4 text-[#5B3FA3]" />
                <h3 className="text-xs font-bold text-[#191725]">October, 2026</h3>
              </div>
              <span className="text-[10px] text-[#777487] font-semibold">Sprint Week 4</span>
            </div>

            {/* Calendar grid representation */}
            <div className="grid grid-cols-7 gap-1 text-center text-[10px]">
              {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => (
                <span key={d} className="font-bold text-[#777487] py-1">
                  {d}
                </span>
              ))}
              {/* Day numbers */}
              {[4, 5, 6, 7, 8, 9, 10].map((d) => {
                const isToday = d === 10;
                const isChallengeDay = d === 9;

                return (
                  <div
                    key={d}
                    className={`py-2 rounded-xl flex flex-col items-center justify-center transition-colors ${
                      isToday
                        ? 'bg-[#5B3FA3] text-white font-bold shadow-sm'
                        : isChallengeDay
                        ? 'bg-[#FFD08A] text-[#191725] font-bold'
                        : 'text-stone-600 hover:bg-[#FAF7F5]'
                    }`}
                  >
                    <span>{d}</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Today's Investigative Tasks matching reference image */}
          <div className="bg-white rounded-3xl p-5 border border-stone-100 shadow-sm space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-stone-100">
              <div className="flex items-center gap-2">
                <CheckSquare className="w-4 h-4 text-[#5B3FA3]" />
                <h3 className="text-xs font-bold text-[#191725]">
                  Investigation Milestones ({tasks.filter(t => !t.done).length})
                </h3>
              </div>
            </div>

            <div className="space-y-2">
              {tasks.map((task) => (
                <div
                  key={task.id}
                  onClick={() => toggleTask(task.id)}
                  className={`p-3 rounded-2xl border text-xs cursor-pointer transition-all flex items-start gap-2.5 ${
                    task.done
                      ? 'bg-stone-50 border-stone-200/60 opacity-60'
                      : 'bg-[#FAF7F5] border-stone-200/80 hover:border-[#5B3FA3]/40'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={task.done}
                    onChange={() => {}}
                    className="mt-0.5 rounded text-[#5B3FA3] focus:ring-0 cursor-pointer"
                  />
                  <div className="flex-1 min-w-0">
                    <p
                      className={`font-semibold text-[#191725] leading-tight ${
                        task.done ? 'line-through text-stone-400' : ''
                      }`}
                    >
                      {task.title}
                    </p>
                    <span className="text-[10px] text-[#777487] block mt-1">{task.time}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Secure Channel Preview matching reference image */}
          <div className="bg-white rounded-3xl p-5 border border-stone-100 shadow-sm space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-stone-100">
              <div className="flex items-center gap-2">
                <MessageSquare className="w-4 h-4 text-[#5B3FA3]" />
                <h3 className="text-xs font-bold text-[#191725]">Anonymous Relay Feed</h3>
              </div>
              <span className="text-[10px] text-emerald-700 font-bold bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                Live
              </span>
            </div>

            <div className="p-3 bg-[#FAF7F5] rounded-2xl border border-stone-200/70 text-xs space-y-2">
              <div className="flex items-center justify-between text-[10px] text-[#777487]">
                <span className="font-bold text-[#191725]">EMP-ZK-88219</span>
                <span>Case INC-892</span>
              </div>
              <p className="text-[#777487] text-[11px] leading-relaxed">
                &quot;Hashes of original quarterly evaluations have been committed to the vault...&quot;
              </p>
            </div>

            <button
              onClick={() => onNavigate('inbox')}
              className="w-full py-2 bg-stone-100 hover:bg-[#5B3FA3] hover:text-white text-[#191725] text-xs font-bold rounded-xl transition-colors flex items-center justify-center gap-1.5"
            >
              <span>Open Secure Channel</span>
              <Send className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
