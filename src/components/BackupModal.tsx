import { useRef, useState } from 'react';
import { exportBackup, importBackup } from '../services/backup';

interface Props {
  onClose: () => void;
}

export function BackupModal({ onClose }: Props) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [status, setStatus] = useState<{ type: 'ok' | 'error'; message: string } | null>(null);
  const [importing, setImporting] = useState(false);

  const handleImport = async (file: File) => {
    setImporting(true);
    const result = await importBackup(file);
    setImporting(false);
    setStatus(
      result.success
        ? { type: 'ok', message: 'Backup restaurat cu succes.' }
        : { type: 'error', message: result.error ?? 'Import eșuat.' }
    );
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 flex items-end justify-center">
      <div className="bg-zinc-900 border-t border-zinc-800 rounded-t-3xl w-full max-w-md p-5 pb-8">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-base font-bold text-white">Backup date</h2>
          <button onClick={onClose} aria-label="Închide" className="text-zinc-400 hover:text-white text-xl leading-none px-1">×</button>
        </div>

        <p className="text-xs text-zinc-500 mb-4 leading-relaxed">
          Datele sunt salvate doar local, pe acest dispozitiv. Exportă un backup înainte să schimbi telefonul sau să ștergi cache-ul browserului.
        </p>

        <button
          onClick={() => exportBackup()}
          className="w-full h-11 bg-zinc-800 hover:bg-zinc-700 text-white font-semibold rounded-xl text-sm mb-3"
        >
          Exportă backup (JSON)
        </button>

        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={importing}
          className="w-full h-11 bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-zinc-950 font-bold rounded-xl text-sm"
        >
          {importing ? 'Se importă...' : 'Importă backup'}
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="application/json"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleImport(file);
            e.target.value = '';
          }}
        />

        {status && (
          <p className={`text-xs mt-3 ${status.type === 'ok' ? 'text-emerald-400' : 'text-rose-400'}`}>
            {status.message}
          </p>
        )}
      </div>
    </div>
  );
}
