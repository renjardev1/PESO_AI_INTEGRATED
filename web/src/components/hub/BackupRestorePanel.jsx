import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArchiveRestore,
  Database,
  Download,
  FileUp,
  HardDriveDownload,
  LoaderCircle,
  RefreshCw,
  ShieldAlert,
} from 'lucide-react';
import { apiFetch } from '../../utils/authClient';

const palette = {
  page: '#fdf8f2',
  sidebar: '#fff8f0',
  surface: '#ffffff',
  border: '#f0dece',
  text: '#2d1f0e',
  secondary: '#a07050',
  hint: '#c4916a',
  accent: '#b85c1a',
  accentSoft: '#f5e6d3',
  accentHover: '#fdf0e4',
  liveBg: '#fef3ea',
  liveBorder: '#f5c89a',
  dangerBg: '#fde8e0',
  dangerText: '#c04a2a',
  successBg: '#e8f5e0',
  successText: '#4a7a2a',
};

const shell = {
  card: {
    background: palette.surface,
    border: `1px solid ${palette.border}`,
    borderRadius: 14,
    padding: 20,
  },
  sectionTitle: {
    fontSize: 10,
    fontWeight: 900,
    letterSpacing: '0.16em',
    textTransform: 'uppercase',
    color: palette.hint,
  },
  heading: {
    fontSize: 18,
    fontWeight: 900,
    color: palette.text,
  },
  body: {
    fontSize: 14,
    color: palette.secondary,
  },
};

const formatDateTime = (value) => {
  if (!value) return 'No backup yet';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Unknown';
  return date.toLocaleString('en-PH', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const actionButtonStyle = (filled = false, danger = false) => ({
  height: 44,
  borderRadius: 10,
  border: `1px solid ${danger ? palette.dangerText : filled ? palette.accent : palette.border}`,
  background: danger ? palette.dangerText : filled ? palette.accent : palette.surface,
  color: danger || filled ? '#fff' : palette.text,
  fontSize: 13,
  fontWeight: 800,
  padding: '0 16px',
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 8,
  cursor: 'pointer',
});

const RestoreConfirmModal = ({ item, busy, onCancel, onConfirm }) => {
  if (!item) return null;

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 110, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div
        onClick={busy ? undefined : onCancel}
        style={{ position: 'absolute', inset: 0, background: 'rgba(71, 42, 16, 0.22)', backdropFilter: 'blur(6px)' }}
      />
      <div style={{ ...shell.card, position: 'relative', width: '100%', maxWidth: 460, background: palette.surface }}>
        <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}>
          <div style={{ width: 44, height: 44, borderRadius: 12, border: `1px solid ${palette.liveBorder}`, background: palette.dangerBg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <ShieldAlert size={20} color={palette.dangerText} />
          </div>
          <div style={{ flex: 1 }}>
            <p style={shell.sectionTitle}>Confirmation Required</p>
            <h4 style={{ ...shell.heading, marginTop: 6 }}>This will overwrite current data</h4>
            <p style={{ ...shell.body, marginTop: 10 }}>
              You are about to restore <strong>{item.filename}</strong>. Make sure you have a fresh backup before continuing.
            </p>
          </div>
        </div>

        <div style={{ marginTop: 18, ...shell.card, padding: 14, background: palette.page }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: palette.secondary }}>
            <span style={{ fontWeight: 700 }}>Backup source</span>
            <span style={{ fontWeight: 800 }}>{item.source || 'upload'}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: palette.secondary, marginTop: 8 }}>
            <span style={{ fontWeight: 700 }}>Timestamp</span>
            <span style={{ fontWeight: 800 }}>{formatDateTime(item.updatedAt || item.createdAt)}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: palette.secondary, marginTop: 8 }}>
            <span style={{ fontWeight: 700 }}>Size</span>
            <span style={{ fontWeight: 800 }}>{item.sizeLabel || 'Uploaded file'}</span>
          </div>
        </div>

        <div style={{ marginTop: 18, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <button type="button" onClick={onCancel} disabled={busy} style={actionButtonStyle(false, false)}>
            Cancel
          </button>
          <button type="button" onClick={onConfirm} disabled={busy} style={actionButtonStyle(true, true)}>
            {busy ? <LoaderCircle size={16} className="animate-spin" /> : <ArchiveRestore size={16} />}
            Restore Now
          </button>
        </div>
      </div>
    </div>
  );
};

export const BackupRestorePanel = ({ currentUser, showToast }) => {
  const [backups, setBackups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [restoringFile, setRestoringFile] = useState(null);
  const [pendingRestore, setPendingRestore] = useState(null);
  const [meta, setMeta] = useState({ backupDirectory: '', database: '', lastBackupAt: null });
  const uploadRef = useRef(null);

  const canManage = useMemo(
    () => currentUser?.role === 'Main Admin' || currentUser?.role === 'Super Admin',
    [currentUser?.role]
  );

  const loadBackups = async (quiet = false) => {
    if (!quiet) setLoading(true);
    try {
      const response = await apiFetch('/api/admin/backups');
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.message || 'Unable to load backups');

      const data = payload.data || {};
      setBackups(Array.isArray(data.backups) ? data.backups : []);
      setMeta({
        backupDirectory: data.backupDirectory || '',
        database: data.database || '',
        lastBackupAt: data.lastBackupAt || null,
      });
    } catch (error) {
      setBackups([]);
      showToast(error.message || 'Failed to load backups', 'error');
    } finally {
      if (!quiet) setLoading(false);
    }
  };

  useEffect(() => {
    loadBackups();
  }, []);

  const handleCreateBackup = async () => {
    setCreating(true);
    try {
      const response = await apiFetch('/api/admin/backup', { method: 'POST' });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.message || 'Unable to create backup');
      showToast(payload.message || 'Backup created', 'success');
      await loadBackups(true);
    } catch (error) {
      showToast(error.message || 'Backup creation failed', 'error');
    } finally {
      setCreating(false);
    }
  };

  const handleDownload = async (filename) => {
    try {
      const response = await apiFetch(`/api/backups/${encodeURIComponent(filename)}/download`);
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload.message || 'Unable to download backup');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = filename;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      window.URL.revokeObjectURL(url);
      showToast(`Downloaded ${filename}`, 'info');
    } catch (error) {
      showToast(error.message || 'Download failed', 'error');
    }
  };

  const handleRestoreSelected = async () => {
    if (!pendingRestore?.filename) return;
    setRestoringFile(pendingRestore.filename);
    try {
      const response = await apiFetch('/api/admin/restore', {
        method: 'POST',
        body: JSON.stringify({ filename: pendingRestore.filename }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.message || 'Restore failed');
      showToast(payload.message || 'Restore completed', 'warning');
      setPendingRestore(null);
      await loadBackups(true);
    } catch (error) {
      showToast(error.message || 'Restore failed', 'error');
    } finally {
      setRestoringFile(null);
    }
  };

  const handleUploadRestore = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    setUploading(true);
    try {
      const content = await file.text();
      const response = await apiFetch('/api/admin/restore', {
        method: 'POST',
        body: JSON.stringify({
          uploadedFile: {
            name: file.name,
            content,
          },
        }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.message || 'Restore failed');
      showToast(payload.message || 'Restore completed', 'warning');
      await loadBackups(true);
    } catch (error) {
      showToast(error.message || 'Restore failed', 'error');
    } finally {
      setUploading(false);
    }
  };

  const lastBackup = backups[0] || null;

  return (
    <>
      <RestoreConfirmModal
        item={pendingRestore}
        busy={!!restoringFile}
        onCancel={() => setPendingRestore(null)}
        onConfirm={handleRestoreSelected}
      />

      <div style={{ background: palette.page, display: 'flex', flexDirection: 'column', gap: 16, maxHeight: '68vh', overflowY: 'auto', paddingRight: 4 }}>
        <div style={{ ...shell.card, background: palette.sidebar }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16 }}>
            <div>
              <p style={shell.sectionTitle}>Backup & Restore</p>
              <h4 style={{ ...shell.heading, marginTop: 6 }}>Admin Recovery Controls</h4>
              <p style={{ ...shell.body, marginTop: 8 }}>
                Encrypted backups are stored with timestamps and can be downloaded or restored from this settings panel.
              </p>
            </div>
            <div style={{ borderRadius: 12, padding: '10px 12px', border: `1px solid ${palette.liveBorder}`, background: palette.liveBg, minWidth: 132, textAlign: 'right' }}>
              <div style={{ ...shell.sectionTitle, color: palette.accent }}>Access</div>
              <div style={{ marginTop: 6, fontWeight: 900, color: canManage ? palette.accent : palette.secondary }}>
                {canManage ? 'Main Admin' : 'Restricted'}
              </div>
            </div>
          </div>

          <div style={{ marginTop: 16, display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))' }}>
            <div style={shell.card}>
              <div style={shell.sectionTitle}>Last Backup</div>
              <div style={{ marginTop: 10, fontSize: 14, fontWeight: 800, color: palette.text }}>{formatDateTime(meta.lastBackupAt)}</div>
            </div>
            <div style={shell.card}>
              <div style={shell.sectionTitle}>Latest Size</div>
              <div style={{ marginTop: 10, fontSize: 14, fontWeight: 800, color: palette.text }}>{lastBackup?.sizeLabel || 'N/A'}</div>
            </div>
            <div style={shell.card}>
              <div style={shell.sectionTitle}>Status</div>
              <div style={{ marginTop: 10, fontSize: 14, fontWeight: 800, color: palette.successText }}>{lastBackup ? 'Ready' : 'Waiting'}</div>
            </div>
            <div style={shell.card}>
              <div style={shell.sectionTitle}>Backup Folder</div>
              <div style={{ marginTop: 10, fontSize: 12, fontWeight: 700, color: palette.text, wordBreak: 'break-word' }}>
                {meta.backupDirectory || 'api/backups'}
              </div>
            </div>
          </div>
        </div>

        <div style={shell.card}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
            <div>
              <p style={shell.sectionTitle}>Backup</p>
              <p style={{ ...shell.body, marginTop: 6 }}>Create a full encrypted snapshot of the current database state.</p>
            </div>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              <button type="button" onClick={() => loadBackups()} disabled={loading} style={actionButtonStyle(false, false)}>
                <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
                Refresh
              </button>
              <button type="button" onClick={handleCreateBackup} disabled={!canManage || creating} style={actionButtonStyle(true, false)}>
                {creating ? <LoaderCircle size={15} className="animate-spin" /> : <HardDriveDownload size={15} />}
                Create Backup
              </button>
            </div>
          </div>
        </div>

        <div style={shell.card}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
            <div>
              <p style={shell.sectionTitle}>Restore</p>
              <p style={{ ...shell.body, marginTop: 6 }}>Select a saved backup or upload an encrypted JSON backup file from disk.</p>
            </div>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              <button type="button" onClick={() => uploadRef.current?.click()} disabled={!canManage || uploading} style={actionButtonStyle(false, false)}>
                {uploading ? <LoaderCircle size={15} className="animate-spin" /> : <FileUp size={15} />}
                Upload Backup File
              </button>
              <input ref={uploadRef} type="file" accept=".json" onChange={handleUploadRestore} style={{ display: 'none' }} />
            </div>
          </div>

          <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
            {loading ? (
              <div style={{ ...shell.card, background: palette.page, display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 120 }}>
                <LoaderCircle size={22} className="animate-spin" color={palette.hint} />
              </div>
            ) : backups.length === 0 ? (
              <div style={{ ...shell.card, background: palette.page, textAlign: 'center' }}>
                <Database size={20} color={palette.hint} style={{ margin: '0 auto' }} />
                <div style={{ marginTop: 12, fontWeight: 800, color: palette.text }}>No backups found</div>
                <div style={{ marginTop: 6, fontSize: 13, color: palette.secondary }}>Create your first backup to populate this list.</div>
              </div>
            ) : (
              backups.map((item) => {
                const busy = restoringFile === item.filename;
                return (
                  <div key={`${item.source}-${item.filename}`} style={{ ...shell.card, background: palette.page, padding: 16 }}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                          <div style={{ fontWeight: 900, color: palette.text, fontSize: 15 }}>{item.filename}</div>
                          <span style={{ borderRadius: 999, padding: '4px 10px', fontSize: 10, fontWeight: 900, letterSpacing: '0.12em', textTransform: 'uppercase', border: `1px solid ${palette.liveBorder}`, background: item.source === 'seed' ? palette.liveBg : palette.successBg, color: item.source === 'seed' ? palette.accent : palette.successText }}>
                            {item.source}
                          </span>
                          {item.encrypted && (
                            <span style={{ borderRadius: 999, padding: '4px 10px', fontSize: 10, fontWeight: 900, letterSpacing: '0.12em', textTransform: 'uppercase', border: `1px solid ${palette.border}`, background: palette.surface, color: palette.accent }}>
                              AES-256
                            </span>
                          )}
                        </div>
                        <div style={{ marginTop: 10, display: 'flex', gap: 18, rowGap: 6, flexWrap: 'wrap', fontSize: 12, color: palette.secondary }}>
                          <span><strong>Status:</strong> Ready</span>
                          <span><strong>Updated:</strong> {formatDateTime(item.updatedAt)}</span>
                          <span><strong>Size:</strong> {item.sizeLabel}</span>
                        </div>
                      </div>

                      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                        <button type="button" onClick={() => handleDownload(item.filename)} style={actionButtonStyle(false, false)}>
                          <Download size={15} />
                          Download
                        </button>
                        <button
                          type="button"
                          onClick={() => setPendingRestore(item)}
                          disabled={!canManage || !!restoringFile}
                          style={actionButtonStyle(true, true)}
                        >
                          {busy ? <LoaderCircle size={15} className="animate-spin" /> : <ArchiveRestore size={15} />}
                          Restore
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </>
  );
};
