import { useEffect, useRef, useState } from 'react';
import { Phone } from 'lucide-react';
import type { CallView, InvitationCall } from '../../calls/useInvitationCall.js';
import './duelCall.css';

export default function DuelCallControls({ model, view }: { model: InvitationCall; view: CallView }) {
  const [open, setOpen] = useState(false);
  const [showVideo, setShowVideo] = useState(true);
  const [needsPlay, setNeedsPlay] = useState(false);
  const video = useRef<HTMLVideoElement>(null);
  const audio = useRef<HTMLAudioElement>(null);
  const { grant, phase, stream } = view;
  useEffect(() => {
    const element = audio.current;
    if (!element) return;
    let live = true;
    element.srcObject = stream;
    setNeedsPlay(false);
    if (stream) void element.play().catch(() => { if (live) setNeedsPlay(true); });
    return () => { live = false; element.srcObject = null; };
  }, [stream]);
  useEffect(() => {
    const element = video.current;
    if (!element) return;
    element.srcObject = stream;
    return () => { element.srcObject = null; };
  }, [stream, showVideo, view.remoteDevices.video]);
  if (!grant) return null;
  const title = phase === 'connected' ? 'In call' : phase === 'connecting' ? 'Connecting…' : phase === 'waiting' ? 'Calling…'
    : grant.peer && !grant.otherTab ? 'Call invitation' : 'Voice & video';
  return <section className="wd-call ph-no-capture" aria-label="Private duel call">
    <audio autoPlay ref={audio} />
    {showVideo && view.remoteDevices.video && <video aria-label="Opponent camera" muted autoPlay playsInline ref={video} />}
    <button type="button" className="wd-call-toggle" data-incoming={phase === 'idle' && grant.peer && !grant.otherTab} aria-expanded={open} onClick={() => setOpen(value => !value)}>
      <Phone size={15} aria-hidden="true" /><span>{title}</span>
    </button>
    {needsPlay && <button type="button" onClick={() => void audio.current?.play().then(() => setNeedsPlay(false)).catch(() => {})}>Play sound</button>}
    {open && <div className="wd-call-panel" onKeyDown={event => { if (event.key === 'Escape') setOpen(false); }}>
      <strong>Private call</strong>
      <p role="status">{grant.otherTab ? 'Your call is open in another tab.' : phase === 'waiting' ? 'Waiting for your opponent to accept.'
        : phase === 'connecting' ? 'Connecting the private call…' : phase === 'connected'
          ? (view.remoteDevices.audio ? 'Opponent microphone on.' : 'Opponent microphone off.')
          : grant.peer ? 'Your opponent invited you to a call.' : 'Both players must accept to start.'}</p>
      <label><input type="checkbox" checked={view.choices.audio} onChange={event => model.choose('audio', event.target.checked)} /> Microphone</label>
      <label><input type="checkbox" checked={view.choices.video} onChange={event => model.choose('video', event.target.checked)} /> Camera</label>
      {view.remoteDevices.video && <label><input type="checkbox" checked={showVideo} onChange={event => setShowVideo(event.target.checked)} /> Show opponent video</label>}
      {view.notice && <p role="status">{view.notice}</p>}
      <div className="wd-call-actions">
        {phase === 'idle' && !grant.otherTab && <button type="button" onClick={model.accept}>{grant.peer ? 'Accept call' : 'Invite to call'}</button>}
        {phase === 'idle' && grant.peer && !grant.otherTab && <button type="button" onClick={model.decline}>Decline</button>}
        {phase !== 'idle' && <button type="button" onClick={() => model.leave()}>{phase === 'waiting' ? 'Cancel invitation' : 'Leave call'}</button>}
        <button type="button" onClick={() => setOpen(false)}>Close controls</button>
      </div>
    </div>}
  </section>;
}
