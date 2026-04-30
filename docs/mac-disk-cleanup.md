# Mac Disk Cleanup Scanner

This project includes a read-only cleanup scanner for macOS:

- `scripts/mac_disk_cleanup_scan.py`
- `scripts/run-disk-cleanup-scan.command`

It finds large files, large folders, and files that have not been accessed recently. It does not delete, move, rename, or modify anything.

## Fastest Way

1. Open Finder.
2. Go to `/Users/biscuitdh/Projects/Kosher Site/scripts`.
3. Double-click `run-disk-cleanup-scan.command`.
4. If macOS asks whether to open it, choose `Open`.
5. Wait for the scan to finish.
6. Your browser should open an HTML report automatically.
7. Review the report before deleting anything.

The default scan checks:

- `~/Downloads`
- `~/Desktop`
- `~/Documents`
- `~/Movies`
- `~/Music`
- `~/Pictures`

It flags old-file candidates when they are at least `100 MB` and have not been accessed in `30` days.

## Terminal Usage

1. Open Terminal.
2. Run this command:

   ```sh
   cd "/Users/biscuitdh/Projects/Kosher Site"
   ```

3. Run the scanner:

   ```sh
   python3 scripts/mac_disk_cleanup_scan.py --open
   ```

4. Review the generated HTML report.

## Scan Your Whole Home Folder

This can take longer and may show permission errors for protected macOS folders.

```sh
cd "/Users/biscuitdh/Projects/Kosher Site"
python3 scripts/mac_disk_cleanup_scan.py ~ --days 30 --min-size 250M --top 300 --old-limit 1000 --dir-limit 300 --open
```

## Scan Downloads Only

```sh
cd "/Users/biscuitdh/Projects/Kosher Site"
python3 scripts/mac_disk_cleanup_scan.py ~/Downloads --days 30 --min-size 50M --open
```

## Scan External Drive Or Folder

Replace the path with the folder you want to scan:

```sh
cd "/Users/biscuitdh/Projects/Kosher Site"
python3 scripts/mac_disk_cleanup_scan.py "/Volumes/My Drive" --days 30 --min-size 100M --open
```

## Report Files

Each run creates a timestamped report folder, normally under:

```text
~/Desktop/Disk Cleanup Reports
```

The report folder contains:

- `report.html`: browser-friendly summary.
- `large-files.csv`: largest files found.
- `old-files.csv`: files over the size threshold that have old access times.
- `large-folders.csv`: largest folders found.
- `errors.csv`: permission or scan errors.
- `summary.json`: machine-readable summary.

## If You See Permission Errors

macOS may block Terminal from reading some folders. To grant access:

1. Open `System Settings`.
2. Click `Privacy & Security`.
3. Click `Full Disk Access`.
4. Click the `+` button.
5. Add `Terminal` from `/Applications/Utilities/Terminal.app`.
6. Turn the switch on for `Terminal`.
7. Quit Terminal completely.
8. Reopen Terminal.
9. Run the scan again.

## Safe Cleanup Workflow

1. Open `report.html`.
2. Start with `Largest Files` and `Old Files Over Threshold`.
3. Click a file path to inspect it.
4. Confirm what the file is.
5. If you are sure it is disposable, move it to Trash in Finder.
6. Do not empty Trash immediately.
7. Use your Mac normally for a day or two.
8. Empty Trash only after you are confident nothing important was removed.

Good first cleanup targets are usually old `.dmg`, `.pkg`, `.zip`, exported videos, duplicate downloads, and stale build folders. Be more careful with Photos libraries, app data, tax documents, password manager exports, source code, and anything inside `~/Library`.

## Notes About Access Time

The "not accessed in over a month" check uses macOS file access time. It is a useful clue, not a guarantee. Some apps and cloud-sync providers do not update access times exactly the way Finder's "Last opened" field suggests. Treat the old-file list as a review queue, not an automatic deletion list.
