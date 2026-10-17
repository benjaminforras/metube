// Pure display helpers for a download row. They live outside App so the row
// components can share them with the App methods that still need them (bulk
// download, share, and the specs that call them on App).
import { Download, DownloadTypeOption } from './interfaces';

// The labels below describe a queued or finished download the way the form
// labels it, looked up in the server's catalog (`types`, its download types)
// under the download's own type.
function typeEntry(types: DownloadTypeOption[], download: Download): DownloadTypeOption | undefined {
  return types.find(t => t.id === download.download_type);
}

function encodeFolderPath(folder: string): string {
  return folder
    .split('/')
    .filter(segment => segment.length > 0)
    .map(segment => encodeURIComponent(segment))
    .join('/') + '/';
}

function baseDirFor(config: Record<string, unknown>, download: Download): string {
  // Must match the server's directory rule exactly: ytdl.py writes to
  // AUDIO_DOWNLOAD_DIR on download_type alone. Treating any .mp3 as audio
  // sent the link to audio_download/ for mp3s produced under a video-type
  // download (a postprocessor, a preset, or a legacy record), which the
  // server had written to DOWNLOAD_DIR -- a 404 whenever the two differ.
  let baseDir = (download.download_type === 'audio'
    ? config['PUBLIC_HOST_AUDIO_URL']
    : config['PUBLIC_HOST_URL']) as string;
  if (download.folder) {
    baseDir += encodeFolderPath(download.folder);
  }
  return baseDir;
}

export function buildDownloadLink(config: Record<string, unknown>, download: Download): string {
  return baseDirFor(config, download) + encodeURIComponent(download.filename);
}

export function buildChapterDownloadLink(
  config: Record<string, unknown>,
  download: Download,
  chapterFilename: string,
): string {
  return baseDirFor(config, download) + encodeURIComponent(chapterFilename);
}

export function chapterFileName(filepath: string): string {
  const parts = filepath.split('/');
  return parts[parts.length - 1];
}

export function resultItemTooltip(download: Download): string {
  const parts = [];
  if (download.msg) {
    parts.push(download.msg);
  }
  if (download.error) {
    parts.push(download.error);
  }
  return parts.join(' | ');
}

export function formatQualityLabel(download: Download, types: DownloadTypeOption[]): string {
  const q = download.quality;
  const type = typeEntry(types, download);
  const format = type?.format.options.find(f => f.id === download.format);
  if (type && format && !format.quality) {
    return '-';
  }
  if (!q) return '';
  const label = format?.quality?.options.find(o => o.id === q)?.text;
  return label ?? q.charAt(0).toUpperCase() + q.slice(1);
}

export function downloadTypeLabel(download: Download, types: DownloadTypeOption[]): string {
  const type = download.download_type || '';
  return typeEntry(types, download)?.text ?? type.charAt(0).toUpperCase() + type.slice(1);
}

// The format the download was queued with, so a queued item can be told apart
// while it is still downloading.
export function formatLabel(download: Download, types: DownloadTypeOption[]): string {
  const format = (download.format || '').trim();
  if (!format) {
    return '-';
  }
  // Records without a type still find their label under any type.
  const options = typeEntry(types, download)?.format.options ?? types.flatMap(t => t.format.options);
  return options.find(o => o.id === format)?.text ?? format.toUpperCase();
}

export function formatCodecLabel(download: Download, types: DownloadTypeOption[]): string {
  const type = typeEntry(types, download);
  if (type && !type.codec) {
    const format = (download.format || '').toUpperCase();
    return format || '-';
  }
  const codec = download.codec;
  if (!codec) return '-';
  return type?.codec?.options.find(c => c.id === codec)?.text ?? codec;
}

// 'preparing' (yt-dlp starting up) and 'postprocessing' (ffmpeg merging,
// re-encoding or splitting once the bytes have landed) both have real work in
// flight with no percentage to report, so the bar runs animated at full width
// instead of showing a number that cannot move.
export function isIndeterminate(download: Download): boolean {
  return download.status === 'preparing' || download.status === 'postprocessing';
}

export function liveCountdownSeconds(download: Download, nowMs: number): number | null {
  const ts = download.live_release_timestamp;
  if (ts == null || download.status !== 'scheduled') {
    return null;
  }
  return Math.max(0, ts - nowMs / 1000);
}
