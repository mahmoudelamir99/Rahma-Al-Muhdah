import argparse
import json
import mimetypes
import os
import re
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import unquote

ARABIC_TEXT_RE = re.compile(r"[\u0600-\u06ff]")


LEGACY_DEMO_NAME_MARKERS = ("اختبار", "tiba store", "creative trips", "شركة النور", "شركة البيان", "demo")


def normalize_runtime_text(value: object) -> str:
    return str(value or "").strip().lower()


def is_legacy_demo_runtime_name(value: object) -> bool:
    normalized = normalize_runtime_text(value)
    return any(marker in normalized for marker in LEGACY_DEMO_NAME_MARKERS) or (
        "اختبار" in normalized and re.search(r"\d{6,}", normalized)
    )


def runtime_text_score(value: object) -> int:
    text = str(value or "").strip()
    if not text:
        return -1

    visible = len(re.findall(r"[A-Za-z0-9\u0600-\u06ff]", text))
    arabic = len(ARABIC_TEXT_RE.findall(text))
    question_marks = text.count("?")
    return visible + arabic * 2 - question_marks * 5


def pick_runtime_text(*values: object) -> str:
    candidates = [str(value or "").strip() for value in values if str(value or "").strip()]
    if not candidates:
        return ""
    return sorted(candidates, key=runtime_text_score, reverse=True)[0]


def merge_runtime_records(current: object, incoming: object) -> dict:
    merged = dict(current) if isinstance(current, dict) else {}
    incoming_dict = dict(incoming) if isinstance(incoming, dict) else {}

    for key, value in incoming_dict.items():
        existing = merged.get(key)

        if isinstance(value, str):
            merged[key] = pick_runtime_text(existing, value)
            continue

        if isinstance(value, bool):
            if key == "applicationEnabled":
                merged[key] = bool(existing) and value if existing is not None else value
            else:
                merged[key] = bool(existing) or value if existing is not None else value
            continue

        if isinstance(value, (int, float)) and isinstance(existing, (int, float)):
            merged[key] = max(existing, value)
            continue

        if isinstance(value, list):
            merged[key] = value or existing or []
            continue

        if value is None:
            merged[key] = existing if existing is not None else None
            continue

        merged[key] = value

    return merged


def dedupe_runtime_items(items: list, key_candidates):
    merged: dict[str, dict] = {}

    for item in items:
        if not isinstance(item, dict):
            continue

        keys = [normalize_runtime_text(candidate(item)) for candidate in key_candidates]
        keys = [key for key in keys if key]
        if not keys:
            continue

        existing = next((merged[key] for key in keys if key in merged), None)
        next_item = merge_runtime_records(existing, item) if existing else dict(item)

        for key in keys:
            merged[key] = next_item

    unique: dict[str, dict] = {}
    for item in merged.values():
        unique_key = (
            normalize_runtime_text(item.get("id"))
            or normalize_runtime_text(item.get("requestId"))
            or normalize_runtime_text(item.get("name"))
            or normalize_runtime_text(item.get("title"))
        )
        unique[unique_key or str(id(item))] = item

    return list(unique.values())


def dedupe_runtime_companies(items: list):
    return dedupe_runtime_items(
        items,
        [
            lambda item: item.get("id"),
            lambda item: item.get("name"),
        ],
    )


def dedupe_runtime_jobs(items: list):
    return dedupe_runtime_items(
        items,
        [
            lambda item: item.get("id"),
            lambda item: f"{item.get('title', '')}::{item.get('companyName', '')}::{item.get('location', '')}",
        ],
    )


def dedupe_runtime_applications(items: list):
    return dedupe_runtime_items(
        items,
        [
            lambda item: item.get("requestId") or item.get("id"),
            lambda item: f"{item.get('applicantPhone', '')}::{item.get('jobTitle', '')}::{item.get('companyName', '')}",
        ],
    )


def is_placeholder_runtime_id(value: object) -> bool:
    return bool(re.match(r"^(company|job|application)-[-_]+$", normalize_runtime_text(value)))


def has_meaningful_runtime_value(value: object) -> bool:
    return bool(normalize_runtime_text(value))


def is_meaningful_runtime_job(job: object) -> bool:
    if not isinstance(job, dict):
        return False
    return has_meaningful_runtime_value(job.get("title")) and has_meaningful_runtime_value(job.get("companyName"))


def is_meaningful_runtime_application(application: object) -> bool:
    if not isinstance(application, dict):
        return False

    has_identifier = has_meaningful_runtime_value(application.get("requestId") or application.get("id"))
    has_core_data = any(
        has_meaningful_runtime_value(application.get(key))
        for key in ("applicantName", "applicantPhone", "jobTitle", "companyName")
    )
    return has_identifier and has_core_data


def is_meaningful_runtime_company(company: object, related_company_names: set[str]) -> bool:
    if not isinstance(company, dict):
        return False
    if not has_meaningful_runtime_value(company.get("name")):
        return False

    has_structured_data = any(
        has_meaningful_runtime_value(company.get(key))
        for key in ("email", "phone", "address", "summary", "imageUrl")
    ) or float(company.get("openings") or 0) > 0 or bool(company.get("notes"))

    if not is_placeholder_runtime_id(company.get("id")):
        return True

    return has_structured_data or normalize_runtime_text(company.get("name")) in related_company_names


def sanitize_runtime_payload(payload: object):
    next_payload = dict(payload) if isinstance(payload, dict) else {}

    if isinstance(next_payload.get("jobs"), list):
        next_payload["jobs"] = [
            job
            for job in next_payload["jobs"]
            if not is_legacy_demo_runtime_name((job or {}).get("companyName"))
            and not is_legacy_demo_runtime_name((job or {}).get("title"))
            and not is_legacy_demo_runtime_name((job or {}).get("id"))
        ]
        next_payload["jobs"] = [job for job in dedupe_runtime_jobs(next_payload["jobs"]) if is_meaningful_runtime_job(job)]

    if isinstance(next_payload.get("applications"), list):
        next_payload["applications"] = [
            application
            for application in dedupe_runtime_applications(next_payload["applications"])
            if is_meaningful_runtime_application(application)
        ]

    if isinstance(next_payload.get("companies"), list):
        related_company_names = {
            normalize_runtime_text(item.get("companyName"))
            for item in [*(next_payload.get("jobs") or []), *(next_payload.get("applications") or [])]
            if isinstance(item, dict) and normalize_runtime_text(item.get("companyName"))
        }
        next_payload["companies"] = [
            company
            for company in next_payload["companies"]
            if not is_legacy_demo_runtime_name((company or {}).get("name"))
            and not is_legacy_demo_runtime_name((company or {}).get("id"))
        ]
        next_payload["companies"] = [
            company
            for company in dedupe_runtime_companies(next_payload["companies"])
            if is_meaningful_runtime_company(company, related_company_names)
        ]

    return next_payload


class DirectoryHandler(BaseHTTPRequestHandler):
    root = os.getcwd()
    spa_fallback = False
    runtime_sync_path = "/__runtime-sync__/public-runtime"
    runtime_file = None

    def log_message(self, format, *args):
        print("%s - - [%s] %s" % (self.client_address[0], self.log_date_time_string(), format % args))

    def _resolve_path(self, request_path: str):
        path = request_path.split("?", 1)[0].split("#", 1)[0]
        path = unquote(path)
        path = path.lstrip("/")
        path = path.replace("/", os.sep)

        if not path:
            return os.path.join(self.root, "index.html")

        candidate = os.path.abspath(os.path.join(self.root, path))
        root_abs = os.path.abspath(self.root)
        if os.path.commonpath([candidate, root_abs]) != root_abs:
            return None

        if os.path.isdir(candidate):
            index_file = os.path.join(candidate, "index.html")
            if os.path.isfile(index_file):
                return index_file

        if os.path.isfile(candidate):
            return candidate

        if not os.path.splitext(candidate)[1]:
            html_candidate = candidate + ".html"
            if os.path.isfile(html_candidate):
                return html_candidate

        if self.spa_fallback:
            index_file = os.path.join(self.root, "index.html")
            if os.path.isfile(index_file):
                return index_file

        return None

    def _send_file(self, file_path: str):
        content_type = mimetypes.guess_type(file_path)[0] or "application/octet-stream"
        if content_type.startswith("text/") or content_type in {"application/javascript", "application/json", "image/svg+xml"}:
            content_type = f"{content_type}; charset=utf-8" if "charset=" not in content_type else content_type

        with open(file_path, "rb") as fh:
            data = fh.read()

        self.send_response(200)
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()

        if self.command != "HEAD":
            self.wfile.write(data)

    def _send_cors_headers(self):
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, HEAD, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.send_header("Access-Control-Max-Age", "86400")

    def _is_runtime_sync_request(self):
        path = self.path.split("?", 1)[0].split("#", 1)[0]
        return path == self.runtime_sync_path

    def _get_runtime_file_path(self):
        return self.runtime_file or os.path.join(self.root, "admin-runtime.shared.json")

    def do_OPTIONS(self):
        if not self._is_runtime_sync_request():
            self.send_error(404, "File not found")
            return

        self.send_response(204)
        self._send_cors_headers()
        self.end_headers()

    def do_GET(self):
        if self._is_runtime_sync_request():
            target_path = self._get_runtime_file_path()
            try:
                with open(target_path, "r", encoding="utf-8") as handle:
                    payload = json.load(handle)
            except FileNotFoundError:
                payload = {}

            data = json.dumps(sanitize_runtime_payload(payload), ensure_ascii=False, indent=2).encode("utf-8")

            self.send_response(200)
            self._send_cors_headers()
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.send_header("Content-Length", str(len(data)))
            self.end_headers()
            if self.command != "HEAD":
                self.wfile.write(data)
            return

        file_path = self._resolve_path(self.path)
        if not file_path:
            self.send_error(404, "File not found")
            return
        self._send_file(file_path)

    def do_POST(self):
        if not self._is_runtime_sync_request():
            self.send_error(404, "File not found")
            return

        content_length = int(self.headers.get("Content-Length", "0") or 0)
        raw_body = self.rfile.read(content_length).decode("utf-8") if content_length else "{}"

        try:
            payload = json.loads(raw_body or "{}")
        except json.JSONDecodeError:
            self.send_response(400)
            self._send_cors_headers()
            response = json.dumps({"ok": False}, ensure_ascii=False).encode("utf-8")
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.send_header("Content-Length", str(len(response)))
            self.end_headers()
            if self.command != "HEAD":
                self.wfile.write(response)
            return

        target_path = self._get_runtime_file_path()
        payload = sanitize_runtime_payload(payload)
        with open(target_path, "w", encoding="utf-8") as handle:
            json.dump(payload, handle, ensure_ascii=False, indent=2)
            handle.write("\n")

        response = json.dumps({"ok": True}, ensure_ascii=False).encode("utf-8")
        self.send_response(200)
        self._send_cors_headers()
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(response)))
        self.end_headers()
        if self.command != "HEAD":
            self.wfile.write(response)

    def do_HEAD(self):
        self.do_GET()


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--root", required=True)
    parser.add_argument("--port", required=True, type=int)
    parser.add_argument("--spa-fallback", action="store_true")
    parser.add_argument("--runtime-file")
    args = parser.parse_args()

    DirectoryHandler.root = args.root
    DirectoryHandler.spa_fallback = args.spa_fallback
    DirectoryHandler.runtime_file = os.path.abspath(args.runtime_file) if args.runtime_file else None

    server = ThreadingHTTPServer(("0.0.0.0", args.port), DirectoryHandler)
    print(f"Serving {os.path.abspath(args.root)} on port {args.port}")
    server.serve_forever()


if __name__ == "__main__":
    main()
