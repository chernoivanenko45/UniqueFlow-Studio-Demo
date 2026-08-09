# UniqueFlow Full Beta delivery worker

This Worker keeps the installer in a private R2 bucket and issues a short-lived
download path when a visitor opens `/download`.

Bindings:

- `BETA_FILES`: private R2 bucket containing the installer.
- `BETA_LINKS`: KV namespace for 15-minute download tokens and a lightweight
  download counter.
- `BETA_OPEN`: set to `true` while the beta is accepting downloads.
- `BETA_OBJECT_KEY`: installer object key.
- `BETA_FILENAME`: filename shown by the browser.

The public website links only to `/download`; the R2 object itself is not
public. Set `BETA_OPEN` to `false` and redeploy to close new downloads.
