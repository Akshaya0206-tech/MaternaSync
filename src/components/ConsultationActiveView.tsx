import { useState } from 'react';
import type { PatientEpisode } from '../types/patient';
import { 
  ArrowLeft, 
  CheckCircle2, 
  MessageSquare, 
  ShieldCheck, 
  User, 
  Save, 
  Calendar
} from 'lucide-react';

interface ConsultationActiveViewProps {
  episode: PatientEpisode;
  onReturnToTodaysBrief: () => void;
  onNavigateToPhase1: () => void;
}

export const ConsultationActiveView: React.FC<ConsultationActiveViewProps> = ({
  episode,
  onReturnToTodaysBrief,
  onNavigateToPhase1
}) => {
  const [consultationNotes, setConsultationNotes] = useState(
    `CONSULTATION PROGRESS NOTE\nPatient: ${episode.patientName} (MRN: ${episode.mrn})\nGestational Age: ${episode.gestationalAgeWeeks}w ${episode.gestationalAgeDays}d\n\n1. PATIENT PORTAL INQUIRY REVIEW:\nReviewed morning BP 134/86 mmHg and headache reported at 07:15 AM.\nPatient reports headache resolved after rest and hydration.\n\n2. PHYSICAL EXAM & VITALS:\nBP: 126/80 mmHg | FHR: 142 bpm | Fundal Height: 32 cm\n\n3. PLAN & FOLLOW-UP COMMITMENTS:\n- Confirmed MFM 32-week growth scan scheduled for Oct 2, 2026.\n- Continue diet-controlled GDMA1 monitoring log.\n- Reviewed preeclampsia red-flag precautions.`
  );
  const [bpInput, setBpInput] = useState('126/80');
  const [fhrInput, setFhrInput] = useState('142');
  const [fundalHeightInput, setFundalHeightInput] = useState('32');
  const [isSaved, setIsSaved] = useState(false);

  const handleSave = () => {
    setIsSaved(true);
    setTimeout(() => setIsSaved(false), 3000);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Top Banner */}
      <div 
        className="glass-panel"
        style={{
          padding: '16px 24px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '12px',
          borderLeft: '4px solid var(--emerald-raw)'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div 
            style={{
              width: '40px',
              height: '40px',
              borderRadius: '10px',
              background: 'var(--emerald-raw-bg)',
              color: 'var(--emerald-raw)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              border: '1px solid var(--emerald-raw-border)'
            }}
          >
            <User size={22} />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span 
                style={{
                  background: 'var(--emerald-raw-bg)',
                  color: 'var(--emerald-raw)',
                  border: '1px solid var(--emerald-raw-border)',
                  fontSize: '0.7rem',
                  padding: '2px 8px',
                  borderRadius: '4px',
                  fontWeight: 800
                }}
              >
                ACTIVE CONSULTATION
              </span>
              <strong style={{ fontSize: '1.15rem', color: 'var(--text-primary)' }}>
                {episode.patientName} ({episode.mrn})
              </strong>
            </div>
            <span style={{ fontSize: '0.775rem', color: 'var(--text-secondary)' }}>
              Gestational Age: {episode.gestationalAgeWeeks}w {episode.gestationalAgeDays}d • Attending: {episode.primaryClinician}
            </span>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <button 
            onClick={onReturnToTodaysBrief}
            className="btn-secondary"
            style={{ fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '6px' }}
          >
            <ArrowLeft size={14} /> Back to Today's Brief
          </button>
          <button 
            onClick={onNavigateToPhase1}
            className="btn-secondary"
            style={{ fontSize: '0.8rem' }}
          >
            View Phase 1 Context
          </button>
        </div>
      </div>

      {/* Main Split Layout: Left Consultation Note Entry | Right Today's Brief Reference Drawer */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(420px, 1fr))', gap: '20px' }}>
        
        {/* Left Column: Active Clinical Note & Vitals Entry */}
        <div className="glass-panel" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <h3 style={{ fontSize: '1.05rem', color: 'var(--text-primary)', margin: 0, fontWeight: 700 }}>
              Clinical Encounter Progress Note
            </h3>
            <span style={{ fontSize: '0.725rem', color: 'var(--text-muted)' }}>
              Non-diagnostic raw EHR entry draft
            </span>
          </div>

          {/* Quick Vital Entry */}
          <div 
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(110px, 1fr))',
              gap: '10px',
              background: 'var(--bg-tertiary)',
              padding: '12px',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--border-color)'
            }}
          >
            <div>
              <label style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 600, display: 'block', marginBottom: '2px' }}>
                BP (mmHg)
              </label>
              <input
                type="text"
                value={bpInput}
                onChange={(e) => setBpInput(e.target.value)}
                style={{ width: '100%', background: 'var(--bg-primary)', border: '1px solid var(--border-color)', borderRadius: '4px', padding: '4px 8px', color: 'var(--accent-cyan)', fontWeight: 700, fontSize: '0.85rem' }}
              />
            </div>

            <div>
              <label style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 600, display: 'block', marginBottom: '2px' }}>
                FHR (bpm)
              </label>
              <input
                type="text"
                value={fhrInput}
                onChange={(e) => setFhrInput(e.target.value)}
                style={{ width: '100%', background: 'var(--bg-primary)', border: '1px solid var(--border-color)', borderRadius: '4px', padding: '4px 8px', color: 'var(--accent-cyan)', fontWeight: 700, fontSize: '0.85rem' }}
              />
            </div>

            <div>
              <label style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 600, display: 'block', marginBottom: '2px' }}>
                FUNDAL HT (cm)
              </label>
              <input
                type="text"
                value={fundalHeightInput}
                onChange={(e) => setFundalHeightInput(e.target.value)}
                style={{ width: '100%', background: 'var(--bg-primary)', border: '1px solid var(--border-color)', borderRadius: '4px', padding: '4px 8px', color: 'var(--accent-cyan)', fontWeight: 700, fontSize: '0.85rem' }}
              />
            </div>
          </div>

          {/* Note Area */}
          <textarea
            value={consultationNotes}
            onChange={(e) => setConsultationNotes(e.target.value)}
            rows={14}
            style={{
              width: '100%',
              background: 'var(--bg-primary)',
              border: '1px solid var(--border-color)',
              borderRadius: 'var(--radius-md)',
              padding: '14px',
              color: 'var(--text-primary)',
              fontFamily: 'var(--font-mono)',
              fontSize: '0.825rem',
              lineHeight: 1.5,
              resize: 'vertical'
            }}
          />

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderTop: '1px solid var(--border-color)', paddingTop: '12px' }}>
            <span style={{ fontSize: '0.75rem', color: isSaved ? 'var(--emerald-raw)' : 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '4px' }}>
              {isSaved ? <CheckCircle2 size={14} /> : null}
              {isSaved ? 'Consultation progress note saved to episode records!' : 'All entries are clinician-authored and non-interpretive.'}
            </span>

            <button 
              onClick={handleSave} 
              className="btn-primary"
              style={{ fontSize: '0.825rem', display: 'flex', alignItems: 'center', gap: '6px' }}
            >
              <Save size={14} /> Save Progress Note
            </button>
          </div>
        </div>

        {/* Right Column: Preserved Today's Brief Context Drawer */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          
          {/* Unanswered Patient Questions Card */}
          <div 
            className="glass-panel" 
            style={{ 
              padding: '16px', 
              borderLeft: '4px solid #ec4899',
              background: 'rgba(236, 72, 153, 0.05)'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
              <MessageSquare size={16} style={{ color: '#ec4899' }} />
              <strong style={{ fontSize: '0.875rem', color: 'var(--text-primary)' }}>
                Preserved Patient Question
              </strong>
            </div>

            <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', margin: '0 0 6px 0', fontStyle: 'italic' }}>
              "My home BP was 134/86 this morning and I have a dull frontal headache since waking up. Should I take Tylenol or come in early?"
            </p>
            <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
              Source: #MSG-9921 • Discussed during today's visit
            </span>
          </div>

          {/* Pending Commitments Quick Reference */}
          <div className="glass-panel" style={{ padding: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
              <Calendar size={16} style={{ color: 'var(--amber-pending)' }} />
              <strong style={{ fontSize: '0.875rem', color: 'var(--text-primary)' }}>
                Open Care Commitments to Confirm
              </strong>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {[
                { title: 'MFM 32-Week Doppler Growth Consult', desc: 'Confirm appointment scheduled for Oct 2, 2026', owner: 'Referral Coordinator' },
                { title: 'Week 32 Glucose Log Review', desc: 'Fasting average 91 mg/dL, 2-hr avg 116 mg/dL', owner: 'Rachel Lin, RD' },
                { title: 'External Radiology Report Retrieval', desc: 'PACS Transfer from Metro Imaging Center', owner: 'Medical Records' }
              ].map((item, idx) => (
                <div 
                  key={idx}
                  style={{
                    background: 'var(--bg-tertiary)',
                    padding: '8px 12px',
                    borderRadius: 'var(--radius-sm)',
                    border: '1px solid var(--border-color)',
                    fontSize: '0.775rem'
                  }}
                >
                  <strong style={{ color: 'var(--text-primary)', display: 'block' }}>{item.title}</strong>
                  <span style={{ color: 'var(--text-secondary)' }}>{item.desc}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Clinical Safety Gate Notice */}
          <div 
            style={{
              background: 'var(--bg-tertiary)',
              border: '1px solid var(--border-color)',
              borderRadius: 'var(--radius-md)',
              padding: '14px',
              fontSize: '0.75rem',
              color: 'var(--text-muted)',
              display: 'flex',
              alignItems: 'flex-start',
              gap: '10px'
            }}
          >
            <ShieldCheck size={18} style={{ color: 'var(--emerald-raw)', flexShrink: 0, marginTop: '2px' }} />
            <div>
              <strong style={{ color: 'var(--text-secondary)', display: 'block', marginBottom: '2px' }}>
                Preserved Phase 1 & 2 Non-Diagnostic Context
              </strong>
              <span>
                All clinical decisions, diagnoses, and orders remain 100% under the direction of the attending care provider. MaternaSync provides structured context organization only.
              </span>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
};
