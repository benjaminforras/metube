// The download form's defaults, as edited on the Settings page and stored on
// the server (see normalize_user_defaults in app/main.py).
export interface FormDefaults {
  download_type: string;
  video: { codec: string; format: string; quality: string };
  audio: { format: string; quality: string };
  captions: { format: string; subtitle_language: string; subtitle_mode: string };
  audio_tags: string;
  folder: string;
  custom_name_prefix: string;
  auto_start: boolean;
  playlist_item_limit: number;
  sponsorblock: boolean;
  split_by_chapters: boolean;
  chapter_template: string;
  ytdl_options_presets: string[];
  check_interval_minutes: number;
  title_regex: string;
  skip_subscriber_only: boolean;
  // Not a form option: how many downloads the server runs at once.
  max_concurrent_downloads: number;
}
