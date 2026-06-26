import { useEffect, useState } from "react";
import { apiUrl } from "../api";

function HealthCheck() {
  const [status, setStatus] = useState(null);

  useEffect(() => {
    fetch(apiUrl("/api/health"))
      .then((res) => res.json())
      .then((data) => setStatus(data))
      .catch(() => setStatus({ status: 'error', service: "Backend not connected" }));
  }, []);

  const isHealthy = status?.status === 'ok';

  return (
    <div
      className="flex min-h-screen items-center justify-center bg-bg p-6 font-sans"
    >
      <div
        className="w-full max-w-[480px] rounded-lg border border-line bg-surface-elevated p-10 shadow-card-md"
      >
        <div className="mb-6 flex items-center gap-3">
          <div
            className="flex h-10 w-10 items-center justify-center rounded-[10px] bg-amber"
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
              <path d="M12 2C8 2 5 5 5 9c0 2.5 1.2 4.7 3 6.1V20a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1v-4.9c1.8-1.4 3-3.6 3-6.1 0-4-3-7-7-7z" fill="white"/>
            </svg>
          </div>
          <div>
            <div className="text-[18px] font-extrabold text-white">BeeKeepr</div>
            <div className="text-[12px] text-ink-muted">System Health Check</div>
          </div>
        </div>

        {!status ? (
          <div className="flex items-center gap-2 text-ink-secondary">
            <span className="animate-pulse text-[20px]">⏳</span>
            <span className="text-[14px]">Checking system status…</span>
          </div>
        ) : (
          <div>
            <div
              className={
                'mb-3 flex items-center gap-2 rounded-md border p-3 ' +
                (isHealthy
                  ? 'border-green-200 bg-green-50'
                  : 'border-red-200 bg-red-50')
              }
            >
              <span className="text-[16px]">{isHealthy ? '✅' : '❌'}</span>
              <span
                className="text-[14px] font-semibold"
                style={{ color: isHealthy ? '#16a34a' : '#dc2626' }}
              >
                {isHealthy ? 'System Healthy' : 'System Error'}
              </span>
            </div>

            <div className="flex flex-col gap-2">
              {status.db && (
                <div className="text-[13px] text-ink-secondary">
                  <strong>Database:</strong>{' '}
                  <span style={{ color: status.db === 'ok' ? '#16a34a' : '#dc2626', fontWeight: 600 }}>
                    {status.db === 'ok' ? 'Connected' : 'Unreachable'}
                  </span>
                </div>
              )}
              {status.uptime_s !== undefined && (
                <div className="text-[13px] text-ink-secondary">
                  <strong>Uptime:</strong> {Math.floor(status.uptime_s / 60)}m {status.uptime_s % 60}s
                </div>
              )}
              {status.timestamp && (
                <div className="text-[13px] text-ink-secondary">
                  <strong>Server time:</strong> {new Date(status.timestamp).toLocaleString()}
                </div>
              )}
              {status.service && (
                <div className="text-[13px] text-ink-secondary">
                  <strong>Service:</strong> {status.service}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default HealthCheck;
