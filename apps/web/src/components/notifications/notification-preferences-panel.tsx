"use client";

import {
  ALL_CHANNELS,
  CHANNEL_LABELS,
  type NotificationChannelType,
  type NotificationPreferencesResponse,
} from "./notifications.types";

export function NotificationPreferencesPanel({
  prefsData,
  lineInput,
  setLineInput,
  onLinkLine,
  onUnlinkLine,
  onTogglePrefChannel,
}: {
  prefsData: NotificationPreferencesResponse;
  lineInput: string;
  setLineInput: (val: string) => void;
  onLinkLine: () => void;
  onUnlinkLine: () => void;
  onTogglePrefChannel: (event: string, ch: NotificationChannelType, defaultChs: NotificationChannelType[]) => void;
}) {
  return (
    <div className="space-y-5">
      <div className="rounded-lg border bg-white p-4 shadow-sm">
        <h2 className="text-sm font-semibold text-gray-800">ผูกบัญชี LINE Official Account (LINE Login)</h2>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <input
            type="text"
            aria-label="LINE User ID"
            placeholder="กรอก LINE User ID จาก LINE Login เช่น U1234567890"
            value={lineInput}
            onChange={(e) => setLineInput(e.target.value)}
            className="w-72 rounded border px-3 py-1.5 text-xs"
          />
          <button
            type="button"
            onClick={onLinkLine}
            className="rounded bg-teal-700 px-3 py-1.5 text-xs font-medium text-white hover:bg-teal-800"
          >
            ผูกบัญชี LINE
          </button>
          {prefsData.lineUserId && (
            <button
              type="button"
              onClick={onUnlinkLine}
              className="rounded border border-rose-600 px-3 py-1.5 text-xs font-medium text-rose-700 hover:bg-rose-50"
            >
              ยกเลิกผูก LINE
            </button>
          )}
        </div>
      </div>

      <div className="overflow-x-auto rounded-lg border bg-white shadow-sm">
        <table className="w-full border-collapse text-xs">
          <thead>
            <tr className="bg-gray-50 text-left text-gray-600">
              <th className="border-b p-3">เหตุการณ์แจ้งเตือน</th>
              {ALL_CHANNELS.map((ch) => (
                <th key={ch} className="border-b p-3 text-center">
                  {CHANNEL_LABELS[ch]}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {prefsData.rules.map((r) => {
              const effective = prefsData.preferences[r.event] ?? r.channels;
              return (
                <tr key={r.event} className="border-b hover:bg-gray-50">
                  <td className="p-3">
                    <div className="font-medium text-gray-900">{r.description}</div>
                    <div className="text-[11px] text-gray-400">{r.event}</div>
                  </td>
                  {ALL_CHANNELS.map((ch) => (
                    <td key={ch} className="p-3 text-center">
                      <input
                        type="checkbox"
                        aria-label={`${r.event}-${ch}`}
                        checked={effective.includes(ch)}
                        onChange={() => onTogglePrefChannel(r.event, ch, r.channels)}
                      />
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
