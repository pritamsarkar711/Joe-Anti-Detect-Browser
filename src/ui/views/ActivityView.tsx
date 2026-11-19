import { useMemo, useState } from 'react';
import { useStore, type ActivityEntry } from '@/state/store';
import { downloadFile } from '@joe/core';
import { Icon, type IconName } from '@/ui/Icons';
import { Button, Empty, Stat, Segmented } from '@/ui/Primitives';

const ICONS: Record<ActivityEntry['kind'], IconName> = {
  launch: 'play', stop: 'stop', create: 'plus', delete: 'trash', proxy: 'globe',
  sync: 'refresh', import: 'upload', export: 'download', check: 'check',
};

export function ActivityView() {
  const s = useStore();
  const [filter, setFilter] = useState<'all' | 'launch' | 'create' | 'sync'>('all');
  const list = useMemo(() => s.activity.filter((a) => filter === 'all' || (filter === 'launch' ? a.kind === 'launch' || a.kind === 'stop' : filter === 'create' ? a.kind === 'create' || a.kind === 'delete' || a.kind === 'import' || a.kind === 'export' : a.kind === 'sync' || a.kind === 'check' || a.kind === 'proxy')), [s.activity, filter]);

  return (
    <div className="view">
      <div className="stat-row">
        <Stat label="Events" value={s.activity.length} icon="activity" />
        <Stat label="Launches" value={s.activity.filter((a) => a.kind === 'launch').length} icon="play" tone="teal" />
        <Stat label="Sync messages" value={s.syncEvents.length} icon="link" tone="blue" />
        <Stat label="Retention" value="400" icon="clock" tone="amber" />
      </div>
      <div className="panel">
        <div className="toolbar">
          <div className="toolbar-left"><Segmented value={filter} onChange={setFilter} options={[{ value: 'all', label: 'All' }, { value: 'launch', label: 'Sessions' }, { value: 'create', label: 'Changes' }, { value: 'sync', label: 'Sync' }]} /></div>
          <div className="toolbar-right"><Button icon="download" size="sm" onClick={() => {
            downloadFile('joe-activity.json', JSON.stringify(s.activity, null, 2));
            s.toast('Activity exported');
          }}>Export log</Button></div>
        </div>
        {list.length === 0 ? <Empty icon="activity" title="No events yet" hint="Create or launch a profile to see activity here." /> : (
          <div className="timeline">
            {list.map((a) => (
              <div className="timeline-row" key={a.id}>
                <span className={`tl-icon tl-${a.kind}`}><Icon name={ICONS[a.kind]} size={14} /></span>
                <time>{new Date(a.at).toLocaleString()}</time>
                <strong>{a.text}</strong>
                {a.meta && <code>{a.meta}</code>}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
