INSERT INTO platform_settings (key, value, description) VALUES
  (
    'ops_google_sheets',
    '{"enabled":false,"webhook_url":"","sheet_name":"CREATYV tasks"}',
    'Optional Google Apps Script webhook for syncing internal production tasks to Google Sheets'
  )
ON CONFLICT (key) DO NOTHING;
