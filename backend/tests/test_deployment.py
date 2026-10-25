"""What a deployment on another host needs from the API: the page's address is allowed, nobody else's is, and the files that
describe the Vercel side say what they should. Same isolated synthetic database as the other tests."""
import json
import unittest
from pathlib import Path

import testenv  # noqa: F401: sets the isolated database and settings before the app is imported

from fastapi.testclient import TestClient

from backend.app import config
from backend.app.main import app

ROOT = Path(__file__).resolve().parents[2]
VERCEL_PAGE = "https://maternasync-test.vercel.app"
PREVIEW_PAGE = "https://maternasync-abc123-preview.vercel.app"


class CrossOriginTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.context = TestClient(app)
        cls.client = cls.context.__enter__()

    @classmethod
    def tearDownClass(cls):
        cls.context.__exit__(None, None, None)

    def preflight(self, origin, method="PATCH", path="/api/v2/continuity/preferences"):
        return self.client.options(path, headers={"Origin": origin, "Access-Control-Request-Method": method,
                                                  "Access-Control-Request-Headers": "authorization,content-type"})

    def test_the_page_on_vercel_may_call_the_api_with_every_method_it_uses(self):
        for method in ("GET", "POST", "PATCH", "PUT", "DELETE"):
            with self.subTest(method=method):
                result = self.preflight(VERCEL_PAGE, method)
                self.assertEqual(result.status_code, 200)
                self.assertEqual(result.headers["access-control-allow-origin"], VERCEL_PAGE)
                self.assertIn(method, result.headers["access-control-allow-methods"])
                self.assertIn("authorization", result.headers["access-control-allow-headers"].lower())

    def test_preview_addresses_that_match_the_pattern_are_allowed_and_nobody_else(self):
        self.assertEqual(self.preflight(PREVIEW_PAGE).headers.get("access-control-allow-origin"), PREVIEW_PAGE)
        for stranger in ("https://evil.example", "https://maternasync-test.vercel.app.evil.example", "https://maternasync-abc123-preview.vercel.app.evil.example", "http://maternasync-test.vercel.app"):
            with self.subTest(origin=stranger):
                result = self.preflight(stranger)
                self.assertNotIn("access-control-allow-origin", result.headers)
                self.assertEqual(result.status_code, 400)

    def test_local_development_is_still_allowed_and_a_real_answer_carries_the_header(self):
        self.assertEqual(self.preflight("http://localhost:5173").headers["access-control-allow-origin"], "http://localhost:5173")
        answer = self.client.get("/api/health", headers={"Origin": VERCEL_PAGE})
        self.assertEqual((answer.status_code, answer.headers["access-control-allow-origin"]), (200, VERCEL_PAGE))
        self.assertNotIn("access-control-allow-origin", self.client.get("/api/health", headers={"Origin": "https://evil.example"}).headers)

    def test_the_list_is_read_from_the_environment_and_a_bare_star_is_never_accepted(self):
        self.assertEqual(config.parse_origins(" https://a.example/ , ,https://b.example,*"), ["https://a.example", "https://b.example"])
        self.assertEqual(config.parse_origins("*"), [])
        self.assertEqual(config.parse_origins(""), [])
        self.assertIn(VERCEL_PAGE, config.CORS_ORIGINS)  # the trailing slash in the test environment was removed
        self.assertNotIn("*", config.CORS_ORIGINS)
        self.assertEqual(config.CORS_ORIGINS[:2], config.LOCAL_ORIGINS)


class VercelFilesTests(unittest.TestCase):
    def test_vercel_json_builds_the_vite_app_and_sends_deep_links_to_the_page_but_never_the_api(self):
        settings = json.loads((ROOT / "vercel.json").read_text(encoding="utf-8"))
        self.assertEqual((settings["framework"], settings["buildCommand"], settings["outputDirectory"]), ("vite", "npm run build", "dist"))
        fallback = next(r for r in settings["rewrites"] if r["destination"] == "/index.html")
        self.assertIn("api/", fallback["source"])  # an unknown /api/... must be a 404, not the page, so a mistake shows up as an error
        headers = {h["key"]: h["value"] for rule in settings["headers"] for h in rule["headers"]}
        self.assertEqual(headers["X-Content-Type-Options"], "nosniff")
        self.assertIn("microphone=(self)", headers["Permissions-Policy"])  # voice input and the location card need these
        self.assertIn("geolocation=(self)", headers["Permissions-Policy"])
        self.assertNotIn("backend", json.dumps(settings))  # no server address is baked in: the address comes from VITE_API_BASE_URL

    def test_nothing_that_belongs_to_the_server_is_uploaded_to_vercel(self):
        ignored = (ROOT / ".vercelignore").read_text(encoding="utf-8").split()
        for name in ("backend", "tests", "node_modules"):
            self.assertIn(name, ignored)
        self.assertIn(".vercel", (ROOT / ".gitignore").read_text(encoding="utf-8"))

    def test_the_backend_image_runs_one_worker_and_keeps_its_data_on_the_disk(self):
        dockerfile = (ROOT / "backend" / "Dockerfile").read_text(encoding="utf-8")
        self.assertIn("--workers 1", dockerfile)  # SQLite and the scheduler must not be run twice
        self.assertIn("/data", dockerfile)
        self.assertIn("HEALTHCHECK", dockerfile)
        self.assertIn("api/health", dockerfile)
        blueprint = (ROOT / "render.yaml").read_text(encoding="utf-8")
        for needle in ("healthCheckPath: /api/health", "mountPath: /data", "MATERNASYNC_JWT_SECRET", "generateValue: true", "MATERNASYNC_CORS_ORIGINS"):
            self.assertIn(needle, blueprint)


if __name__ == "__main__":
    unittest.main()
