#!/usr/bin/env python3
"""Read-only macOS disk cleanup scanner.

Finds large files, large folders, and files that have not been accessed recently.
It never deletes or modifies scanned files.
"""

from __future__ import annotations

import argparse
import csv
import fnmatch
import heapq
import html
import json
import os
import subprocess
import sys
import tempfile
import time
from dataclasses import asdict, dataclass
from datetime import datetime
from pathlib import Path
from typing import Iterable
from urllib.parse import quote


DEFAULT_EXCLUDE_NAMES = {
    ".DocumentRevisions-V100",
    ".Spotlight-V100",
    ".TemporaryItems",
    ".Trashes",
    ".fseventsd",
}


@dataclass(frozen=True)
class FileRecord:
    path: str
    size_bytes: int
    accessed_at: float
    modified_at: float


@dataclass(frozen=True)
class DirRecord:
    path: str
    size_bytes: int
    file_count: int


@dataclass(frozen=True)
class ScanError:
    path: str
    error: str


@dataclass
class ScanStats:
    roots_seen: int = 0
    dirs_scanned: int = 0
    files_scanned: int = 0
    bytes_scanned: int = 0
    skipped_paths: int = 0
    errors_seen: int = 0


class BoundedHeap:
    def __init__(self, limit: int) -> None:
        self.limit = max(0, limit)
        self._heap: list[tuple[int, int, object]] = []
        self._counter = 0

    def push(self, key: int, value: object) -> None:
        if self.limit == 0:
            return
        item = (key, self._counter, value)
        self._counter += 1
        if len(self._heap) < self.limit:
            heapq.heappush(self._heap, item)
            return
        if key > self._heap[0][0]:
            heapq.heapreplace(self._heap, item)

    def values_desc(self) -> list[object]:
        return [item[2] for item in sorted(self._heap, reverse=True)]


class Scanner:
    def __init__(
        self,
        *,
        days_old: int,
        min_old_size: int,
        top_limit: int,
        old_limit: int,
        dir_limit: int,
        excludes: list[str],
        cross_volumes: bool,
        max_depth: int | None,
    ) -> None:
        self.now = time.time()
        self.cutoff = self.now - (days_old * 24 * 60 * 60)
        self.min_old_size = min_old_size
        self.excludes = excludes
        self.cross_volumes = cross_volumes
        self.max_depth = max_depth
        self.stats = ScanStats()
        self.errors: list[ScanError] = []
        self.large_files = BoundedHeap(top_limit)
        self.old_files = BoundedHeap(old_limit)
        self.large_dirs = BoundedHeap(dir_limit)

    def scan(self, roots: list[Path]) -> None:
        for root in roots:
            self.stats.roots_seen += 1
            self._scan_root(root)

    def _scan_root(self, root: Path) -> None:
        try:
            stat = root.stat()
        except OSError as exc:
            self._record_error(root, exc)
            return

        root_dev = stat.st_dev
        if root.is_dir():
            self._scan_dir(root, depth=0, root_dev=root_dev)
        elif root.is_file():
            self._record_file(root, stat)
        else:
            self.stats.skipped_paths += 1

    def _scan_dir(self, path: Path, *, depth: int, root_dev: int) -> tuple[int, int]:
        if self._is_excluded(path):
            self.stats.skipped_paths += 1
            return 0, 0
        if self.max_depth is not None and depth > self.max_depth:
            self.stats.skipped_paths += 1
            return 0, 0

        self.stats.dirs_scanned += 1
        total_size = 0
        file_count = 0

        try:
            with os.scandir(path) as entries:
                for entry in entries:
                    child_path = Path(entry.path)
                    try:
                        if entry.is_symlink():
                            self.stats.skipped_paths += 1
                            continue
                        if self._is_excluded(child_path):
                            self.stats.skipped_paths += 1
                            continue

                        entry_stat = entry.stat(follow_symlinks=False)
                        if not self.cross_volumes and entry_stat.st_dev != root_dev:
                            self.stats.skipped_paths += 1
                            continue

                        if entry.is_dir(follow_symlinks=False):
                            child_size, child_files = self._scan_dir(
                                child_path,
                                depth=depth + 1,
                                root_dev=root_dev,
                            )
                            total_size += child_size
                            file_count += child_files
                        elif entry.is_file(follow_symlinks=False):
                            self._record_file(child_path, entry_stat)
                            total_size += entry_stat.st_size
                            file_count += 1
                    except OSError as exc:
                        self._record_error(child_path, exc)
        except OSError as exc:
            self._record_error(path, exc)

        record = DirRecord(str(path), total_size, file_count)
        self.large_dirs.push(total_size, record)
        return total_size, file_count

    def _record_file(self, path: Path, stat: os.stat_result) -> None:
        size = int(stat.st_size)
        record = FileRecord(
            path=str(path),
            size_bytes=size,
            accessed_at=float(stat.st_atime),
            modified_at=float(stat.st_mtime),
        )
        self.stats.files_scanned += 1
        self.stats.bytes_scanned += size
        self.large_files.push(size, record)

        if size >= self.min_old_size and stat.st_atime < self.cutoff:
            self.old_files.push(size, record)

    def _is_excluded(self, path: Path) -> bool:
        name = path.name
        path_text = str(path)
        return any(
            fnmatch.fnmatch(name, pattern) or fnmatch.fnmatch(path_text, pattern)
            for pattern in self.excludes
        )

    def _record_error(self, path: Path, exc: OSError) -> None:
        self.stats.errors_seen += 1
        self.errors.append(ScanError(str(path), str(exc)))


def parse_size(value: str) -> int:
    text = value.strip().lower().replace("ib", "b")
    units = {
        "b": 1,
        "k": 1024,
        "kb": 1024,
        "m": 1024**2,
        "mb": 1024**2,
        "g": 1024**3,
        "gb": 1024**3,
        "t": 1024**4,
        "tb": 1024**4,
    }
    number = ""
    suffix = ""
    for char in text:
        if char.isdigit() or char == ".":
            number += char
        elif not char.isspace():
            suffix += char
    if not number:
        raise argparse.ArgumentTypeError(f"Invalid size: {value}")
    multiplier = units.get(suffix or "b")
    if multiplier is None:
        raise argparse.ArgumentTypeError(f"Invalid size unit: {value}")
    return int(float(number) * multiplier)


def human_size(size: int) -> str:
    units = ["B", "KB", "MB", "GB", "TB", "PB"]
    value = float(size)
    for unit in units:
        if value < 1024 or unit == units[-1]:
            if unit == "B":
                return f"{int(value)} {unit}"
            return f"{value:.1f} {unit}"
        value /= 1024
    return f"{size} B"


def format_time(timestamp: float) -> str:
    try:
        return datetime.fromtimestamp(timestamp).strftime("%Y-%m-%d %H:%M:%S")
    except (OSError, OverflowError, ValueError):
        return ""


def file_url(path_text: str) -> str:
    return "file://" + quote(path_text)


def default_roots(include_library: bool) -> list[Path]:
    home = Path.home()
    names = ["Downloads", "Desktop", "Documents", "Movies", "Music", "Pictures"]
    if include_library:
        names.append("Library")
    roots = [home / name for name in names if (home / name).exists()]
    return roots or [home]


def resolve_roots(paths: list[str], include_library: bool) -> list[Path]:
    if not paths:
        return default_roots(include_library)
    return [Path(os.path.expandvars(path)).expanduser() for path in paths]


def create_report_dir(output: str | None) -> Path:
    candidates: list[Path]
    if output:
        candidates = [Path(output).expanduser()]
    else:
        candidates = [
            Path.home() / "Desktop" / "Disk Cleanup Reports",
            Path(tempfile.gettempdir()) / "disk-cleanup-reports",
        ]

    timestamp = datetime.now().strftime("scan-%Y%m%d-%H%M%S")
    last_error: Exception | None = None
    for base in candidates:
        try:
            base.mkdir(parents=True, exist_ok=True)
            report_dir = base / timestamp
            suffix = 2
            while report_dir.exists():
                report_dir = base / f"{timestamp}-{suffix}"
                suffix += 1
            report_dir.mkdir()
            return report_dir
        except OSError as exc:
            last_error = exc

    raise SystemExit(f"Could not create report directory: {last_error}")


def write_csv(path: Path, rows: Iterable[dict[str, object]], fieldnames: list[str]) -> None:
    with path.open("w", newline="", encoding="utf-8") as file:
        writer = csv.DictWriter(file, fieldnames=fieldnames)
        writer.writeheader()
        for row in rows:
            writer.writerow(row)


def file_row(record: FileRecord, now: float) -> dict[str, object]:
    return {
        "size_bytes": record.size_bytes,
        "size": human_size(record.size_bytes),
        "days_since_access": max(0, int((now - record.accessed_at) // 86400)),
        "accessed_at": format_time(record.accessed_at),
        "modified_at": format_time(record.modified_at),
        "path": record.path,
    }


def dir_row(record: DirRecord) -> dict[str, object]:
    return {
        "size_bytes": record.size_bytes,
        "size": human_size(record.size_bytes),
        "file_count": record.file_count,
        "path": record.path,
    }


def write_reports(
    *,
    report_dir: Path,
    scanner: Scanner,
    roots: list[Path],
    days_old: int,
    min_old_size: int,
    elapsed: float,
) -> Path:
    large_files = [record for record in scanner.large_files.values_desc()]
    old_files = [record for record in scanner.old_files.values_desc()]
    large_dirs = [record for record in scanner.large_dirs.values_desc()]

    write_csv(
        report_dir / "large-files.csv",
        (file_row(record, scanner.now) for record in large_files),
        ["size_bytes", "size", "days_since_access", "accessed_at", "modified_at", "path"],
    )
    write_csv(
        report_dir / "old-files.csv",
        (file_row(record, scanner.now) for record in old_files),
        ["size_bytes", "size", "days_since_access", "accessed_at", "modified_at", "path"],
    )
    write_csv(
        report_dir / "large-folders.csv",
        (dir_row(record) for record in large_dirs),
        ["size_bytes", "size", "file_count", "path"],
    )
    write_csv(
        report_dir / "errors.csv",
        (asdict(error) for error in scanner.errors),
        ["path", "error"],
    )

    summary = {
        "generated_at": datetime.now().isoformat(timespec="seconds"),
        "elapsed_seconds": round(elapsed, 2),
        "roots": [str(root) for root in roots],
        "days_old": days_old,
        "old_cutoff": format_time(scanner.cutoff),
        "min_old_size_bytes": min_old_size,
        "min_old_size": human_size(min_old_size),
        "stats": asdict(scanner.stats),
        "reports": {
            "html": str(report_dir / "report.html"),
            "large_files_csv": str(report_dir / "large-files.csv"),
            "old_files_csv": str(report_dir / "old-files.csv"),
            "large_folders_csv": str(report_dir / "large-folders.csv"),
            "errors_csv": str(report_dir / "errors.csv"),
        },
    }
    (report_dir / "summary.json").write_text(
        json.dumps(summary, indent=2),
        encoding="utf-8",
    )
    write_html_report(
        report_dir / "report.html",
        summary=summary,
        large_files=large_files,
        old_files=old_files,
        large_dirs=large_dirs,
        errors=scanner.errors,
        now=scanner.now,
    )
    return report_dir / "report.html"


def html_file_table(records: list[FileRecord], now: float) -> str:
    if not records:
        return "<p>No matching files found.</p>"
    rows = []
    for record in records:
        row = file_row(record, now)
        size_label = str(row["size"])
        days_since_access = str(row["days_since_access"])
        accessed_at = str(row["accessed_at"])
        modified_at = str(row["modified_at"])
        rows.append(
            "<tr>"
            f"<td data-sort='{record.size_bytes}'>{html.escape(size_label)}</td>"
            f"<td data-sort='{days_since_access}'>{html.escape(days_since_access)}</td>"
            f"<td>{html.escape(accessed_at)}</td>"
            f"<td>{html.escape(modified_at)}</td>"
            f"<td><a href='{html.escape(file_url(record.path))}'>{html.escape(record.path)}</a></td>"
            "</tr>"
        )
    return (
        "<table><thead><tr>"
        "<th>Size</th><th>Days Since Access</th><th>Accessed</th><th>Modified</th><th>Path</th>"
        "</tr></thead><tbody>"
        + "\n".join(rows)
        + "</tbody></table>"
    )


def html_dir_table(records: list[DirRecord]) -> str:
    if not records:
        return "<p>No folders found.</p>"
    rows = []
    for record in records:
        rows.append(
            "<tr>"
            f"<td data-sort='{record.size_bytes}'>{html.escape(human_size(record.size_bytes))}</td>"
            f"<td data-sort='{record.file_count}'>{record.file_count}</td>"
            f"<td><a href='{html.escape(file_url(record.path))}'>{html.escape(record.path)}</a></td>"
            "</tr>"
        )
    return (
        "<table><thead><tr><th>Size</th><th>Files</th><th>Path</th></tr></thead><tbody>"
        + "\n".join(rows)
        + "</tbody></table>"
    )


def html_error_table(errors: list[ScanError]) -> str:
    if not errors:
        return "<p>No permission or scan errors were recorded.</p>"
    rows = [
        "<tr>"
        f"<td>{html.escape(error.path)}</td>"
        f"<td>{html.escape(error.error)}</td>"
        "</tr>"
        for error in errors[:200]
    ]
    more = ""
    if len(errors) > 200:
        more = f"<p>Showing first 200 of {len(errors)} errors. See errors.csv for the full list.</p>"
    return (
        more
        + "<table><thead><tr><th>Path</th><th>Error</th></tr></thead><tbody>"
        + "\n".join(rows)
        + "</tbody></table>"
    )


def write_html_report(
    path: Path,
    *,
    summary: dict[str, object],
    large_files: list[FileRecord],
    old_files: list[FileRecord],
    large_dirs: list[DirRecord],
    errors: list[ScanError],
    now: float,
) -> None:
    stats = summary["stats"]
    assert isinstance(stats, dict)
    roots = summary["roots"]
    assert isinstance(roots, list)
    roots_html = "".join(f"<li>{html.escape(str(root))}</li>" for root in roots)
    content = f"""<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Disk Cleanup Report</title>
  <style>
    :root {{
      color-scheme: light dark;
      --bg: #f8fafc;
      --panel: #ffffff;
      --text: #172033;
      --muted: #526071;
      --line: #d6dde6;
      --accent: #0f766e;
      --warn: #a16207;
    }}
    @media (prefers-color-scheme: dark) {{
      :root {{
        --bg: #101418;
        --panel: #171d24;
        --text: #e6edf3;
        --muted: #a9b5c1;
        --line: #2a3542;
        --accent: #5eead4;
        --warn: #facc15;
      }}
    }}
    body {{
      margin: 0;
      background: var(--bg);
      color: var(--text);
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      line-height: 1.45;
    }}
    main {{
      max-width: 1180px;
      margin: 0 auto;
      padding: 32px 20px 48px;
    }}
    h1, h2 {{
      margin: 0 0 12px;
    }}
    h1 {{
      font-size: 34px;
    }}
    h2 {{
      font-size: 22px;
      margin-top: 32px;
    }}
    .summary {{
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
      gap: 12px;
      margin: 18px 0 24px;
    }}
    .metric {{
      background: var(--panel);
      border: 1px solid var(--line);
      border-radius: 8px;
      padding: 14px;
    }}
    .metric strong {{
      display: block;
      font-size: 24px;
    }}
    .metric span, .note, .roots {{
      color: var(--muted);
    }}
    .note {{
      border-left: 4px solid var(--warn);
      padding: 8px 0 8px 12px;
      margin: 20px 0;
    }}
    table {{
      width: 100%;
      border-collapse: collapse;
      background: var(--panel);
      border: 1px solid var(--line);
      border-radius: 8px;
      overflow: hidden;
      display: block;
      overflow-x: auto;
    }}
    th, td {{
      border-bottom: 1px solid var(--line);
      padding: 9px 10px;
      text-align: left;
      vertical-align: top;
      white-space: nowrap;
    }}
    th {{
      cursor: pointer;
      color: var(--muted);
      font-size: 13px;
      user-select: none;
    }}
    td:last-child {{
      white-space: normal;
      min-width: 360px;
      word-break: break-word;
    }}
    a {{
      color: var(--accent);
      text-decoration: none;
    }}
    a:hover {{
      text-decoration: underline;
    }}
    code {{
      background: color-mix(in srgb, var(--panel) 78%, var(--line));
      border: 1px solid var(--line);
      border-radius: 5px;
      padding: 1px 5px;
    }}
  </style>
</head>
<body>
<main>
  <h1>Disk Cleanup Report</h1>
  <p class="roots">Generated {html.escape(str(summary["generated_at"]))}. Scanned:</p>
  <ul class="roots">{roots_html}</ul>
  <div class="summary">
    <div class="metric"><strong>{human_size(int(stats["bytes_scanned"]))}</strong><span>Total file bytes scanned</span></div>
    <div class="metric"><strong>{stats["files_scanned"]}</strong><span>Files scanned</span></div>
    <div class="metric"><strong>{stats["dirs_scanned"]}</strong><span>Folders scanned</span></div>
    <div class="metric"><strong>{stats["errors_seen"]}</strong><span>Permission or scan errors</span></div>
  </div>
  <p class="note">This report is read-only. Do not delete anything just because it appears here. Open the file or folder, confirm you do not need it, then move it to Trash manually.</p>
  <p>Old-file candidates are at least <code>{html.escape(str(summary["min_old_size"]))}</code> and were last accessed before <code>{html.escape(str(summary["old_cutoff"]))}</code>. macOS access times are useful clues, but they are not perfect for every app or cloud-synced file.</p>

  <h2>Largest Files</h2>
  {html_file_table(large_files, now)}

  <h2>Old Files Over Threshold</h2>
  {html_file_table(old_files, now)}

  <h2>Largest Folders</h2>
  {html_dir_table(large_dirs)}

  <h2>Errors</h2>
  {html_error_table(errors)}
</main>
<script>
  for (const table of document.querySelectorAll("table")) {{
    const headers = table.querySelectorAll("th");
    headers.forEach((header, index) => {{
      header.addEventListener("click", () => {{
        const tbody = table.querySelector("tbody");
        const rows = Array.from(tbody.querySelectorAll("tr"));
        const ascending = header.dataset.ascending !== "true";
        rows.sort((a, b) => {{
          const av = a.children[index].dataset.sort ?? a.children[index].textContent;
          const bv = b.children[index].dataset.sort ?? b.children[index].textContent;
          const an = Number(av);
          const bn = Number(bv);
          const result = Number.isFinite(an) && Number.isFinite(bn)
            ? an - bn
            : String(av).localeCompare(String(bv));
          return ascending ? result : -result;
        }});
        header.dataset.ascending = String(ascending);
        rows.forEach((row) => tbody.appendChild(row));
      }});
    }});
  }}
</script>
</body>
</html>
"""
    path.write_text(content, encoding="utf-8")


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description="Find large files, old files, and large folders on macOS without deleting anything.",
    )
    parser.add_argument(
        "paths",
        nargs="*",
        help="Folders or files to scan. Defaults to common home folders: Downloads, Desktop, Documents, Movies, Music, Pictures.",
    )
    parser.add_argument(
        "--days",
        type=int,
        default=30,
        help="Flag files not accessed in this many days. Default: 30.",
    )
    parser.add_argument(
        "--min-size",
        type=parse_size,
        default=parse_size("100M"),
        help="Minimum size for old-file candidates. Examples: 50M, 1G. Default: 100M.",
    )
    parser.add_argument("--top", type=int, default=100, help="How many largest files to keep. Default: 100.")
    parser.add_argument(
        "--old-limit",
        type=int,
        default=500,
        help="How many old-file candidates to keep. Default: 500.",
    )
    parser.add_argument(
        "--dir-limit",
        type=int,
        default=100,
        help="How many largest folders to keep. Default: 100.",
    )
    parser.add_argument(
        "--output",
        help="Parent folder for reports. Default: ~/Desktop/Disk Cleanup Reports, falling back to /tmp.",
    )
    parser.add_argument(
        "--exclude",
        action="append",
        default=[],
        help="Exclude a file or folder glob. Can be repeated. Examples: --exclude '*.app' --exclude '*/node_modules/*'.",
    )
    parser.add_argument(
        "--no-default-excludes",
        action="store_true",
        help="Do not exclude macOS metadata folders such as .Spotlight-V100.",
    )
    parser.add_argument(
        "--include-library",
        action="store_true",
        help="Add ~/Library when using the default paths.",
    )
    parser.add_argument(
        "--cross-volumes",
        action="store_true",
        help="Follow mounted volumes encountered under a scanned root.",
    )
    parser.add_argument(
        "--max-depth",
        type=int,
        help="Limit folder recursion depth. Omit for a full recursive scan.",
    )
    parser.add_argument(
        "--open",
        action="store_true",
        help="Open the HTML report when the scan completes.",
    )
    return parser


def main(argv: list[str] | None = None) -> int:
    parser = build_parser()
    args = parser.parse_args(argv)
    if args.days < 1:
        parser.error("--days must be at least 1")
    if args.max_depth is not None and args.max_depth < 0:
        parser.error("--max-depth must be 0 or greater")

    roots = resolve_roots(args.paths, args.include_library)
    excludes = list(args.exclude)
    if not args.no_default_excludes:
        excludes.extend(DEFAULT_EXCLUDE_NAMES)

    report_dir = create_report_dir(args.output)
    scanner = Scanner(
        days_old=args.days,
        min_old_size=args.min_size,
        top_limit=args.top,
        old_limit=args.old_limit,
        dir_limit=args.dir_limit,
        excludes=excludes,
        cross_volumes=args.cross_volumes,
        max_depth=args.max_depth,
    )

    print("Scanning:")
    for root in roots:
        print(f"  {root}")
    print("No files will be deleted or modified.")

    started = time.time()
    scanner.scan(roots)
    elapsed = time.time() - started
    html_report = write_reports(
        report_dir=report_dir,
        scanner=scanner,
        roots=roots,
        days_old=args.days,
        min_old_size=args.min_size,
        elapsed=elapsed,
    )

    print()
    print(f"Scanned {scanner.stats.files_scanned} files in {elapsed:.1f}s.")
    print(f"Total file bytes scanned: {human_size(scanner.stats.bytes_scanned)}")
    print(f"Largest-file report: {report_dir / 'large-files.csv'}")
    print(f"Old-file report: {report_dir / 'old-files.csv'}")
    print(f"Large-folder report: {report_dir / 'large-folders.csv'}")
    print(f"HTML report: {html_report}")
    if scanner.stats.errors_seen:
        print(f"Scan errors: {scanner.stats.errors_seen} (see {report_dir / 'errors.csv'})")

    if args.open:
        try:
            subprocess.run(["open", str(html_report)], check=False)
        except OSError as exc:
            print(f"Could not open report automatically: {exc}", file=sys.stderr)

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
