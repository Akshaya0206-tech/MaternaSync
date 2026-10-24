/** Run against isolated demo servers; see README for commands.
 * PLAYWRIGHT_MODULE may point to an existing Playwright installation.
 */
import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { pathToFileURL } from "node:url";

const modulePath = process.env.PLAYWRIGHT_MODULE;
const { chromium } = await import(
  modulePath ? pathToFileURL(modulePath).href : "playwright"
);
const browser = await chromium.launch({ headless: true, args: ["--mute-audio"] }); // some screens can read aloud
const context = await browser.newContext({
  viewport: { width: 1440, height: 1000 },
});
const page = await context.newPage();
const errors = [];
page.on("pageerror", (error) => errors.push(error.message));
const base = process.env.TEST_BASE_URL || "http://127.0.0.1:5174";
await mkdir(".test-output", { recursive: true });

async function login(role, path) {
  await page.goto(`${base}/signin`);
  // Start each role in a clean authenticated context.
  await page.evaluate(() => localStorage.removeItem("maternasync_token"));
  await page.goto(`${base}/signin`);
  await page.getByRole("button", { name: new RegExp(`Demo ${role}`) }).click();
  await page.waitForURL(`**/${path}/dashboard`);
}
async function navigate(path, heading) {
  await page.goto(`${base}${path}`);
  await page.getByRole("heading", { name: heading, exact: true }).waitFor();
}
async function success(text) {
  await page.getByRole("status").filter({ hasText: text }).waitFor();
}
const stamp = Date.now();

try {
  await login("Patient", "patient");
  await navigate("/patient/daily-log", "Daily check-in");
  await page.getByLabel("Systolic BP (mmHg)").fill("117");
  await page.getByLabel("Diastolic BP (mmHg)").fill("76");
  await page
    .getByLabel("Symptoms or anything you want your team to know")
    .fill(`Browser check-in ${stamp}`);
  await page
    .getByRole("button", { name: "Save check-in", exact: true })
    .click();
  await success("Your check-in was saved");
  await page.reload();
  await page.getByText(`Browser check-in ${stamp}`, { exact: false }).waitFor();
  await page.screenshot({
    path: ".test-output/patient-check-in.png",
    fullPage: true,
  });
  await navigate("/patient/consent", "Sharing & consent");
  await page
    .getByLabel("Recipient phone with country code")
    .fill("+919999999999");
  const expiry = new Date(Date.now() + 86400000 * 2);
  const local = new Date(expiry.getTime() - expiry.getTimezoneOffset() * 60000)
    .toISOString()
    .slice(0, 16);
  await page.getByLabel("Permission expires").fill(local);
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: "Save permission" }).click();
  await success("Sharing permission recorded");
  await page.getByRole("button", { name: "Revoke / opt out" }).last().click();
  await success("Permission revoked");
  await navigate("/patient/companion", "Care companion");
  await page.getByLabel("Language /").selectOption("ta");
  await page.getByRole("heading", { name: "பராமரிப்புத் துணை" }).waitFor();
  await page
    .getByRole("link", { name: "எனது பராமரிப்புக் குழுவிடம் கேளுங்கள்" })
    .waitFor();
  await navigate("/patient/care-plan", "My care plan");
  await page.getByLabel("Preferred date and time").fill(local);
  await page
    .getByLabel("Visit type", { exact: true })
    .fill(`Browser visit ${stamp}`);
  await page.getByRole("button", { name: "Request visit" }).click();
  await success("Request sent");

  await login("Care Team", "care-team");
  await navigate("/care-team/clinic", "Shared clinic overview");
  await page.getByRole("link", { name: "Sarah Jenkins", exact: true }).click();
  await page.getByRole("button", { name: "Tasks, visits & outcomes" }).click();
  const visit = page
    .locator("article")
    .filter({ hasText: `Browser visit ${stamp}` });
  await visit.getByRole("button", { name: "Confirm visit" }).click();
  await success("Appointment updated");
  await page.screenshot({
    path: ".test-output/care-team-workspace.png",
    fullPage: true,
  });

  await login("Doctor", "doctor");
  await navigate("/doctor/clinic", "Shared clinic overview");
  await page.getByRole("link", { name: "Sarah Jenkins", exact: true }).click();
  await page.getByText(`Browser check-in ${stamp}`, { exact: false }).waitFor();
  await page.screenshot({
    path: ".test-output/doctor-trends.png",
    fullPage: true,
  });
  await page
    .getByRole("button", { name: "Document studio", exact: true })
    .click();
  await page
    .getByLabel("Document type", { exact: true })
    .selectOption("certificate");
  await page
    .getByLabel("Verified source / approved visit")
    .selectOption({ index: 1 });
  await page.getByRole("button", { name: "Create editable draft" }).click();
  await success("Draft prepared");
  await page
    .getByLabel(/Document text/)
    .fill(`Reviewed browser certificate ${stamp}. Synthetic data only.`);
  await page.getByLabel(/I reviewed the source/).check();
  await page.getByRole("button", { name: "Save, sign & release" }).click();
  await page.getByText(/Signed by Dr. Eleanor Vance/).waitFor();
  await navigate("/doctor/guidelines", "Clinical Guidelines");
  await page.getByRole("button", { name: "Manage Sources", exact: true }).waitFor();
  await navigate("/doctor/library", "Clinical reference library");
  await page.getByLabel("Search title, topic or passage").fill("ICMR");
  await page
    .getByRole("button", { name: "Read source & history" })
    .first()
    .click();
  await page.getByRole("link", { name: "Open official source" }).waitFor();
  await page.screenshot({
    path: ".test-output/reference-library.png",
    fullPage: true,
  });

  await login("Patient", "patient");
  await navigate("/patient/care-plan", "My care plan");
  await page
    .getByText(`Reviewed browser certificate ${stamp}. Synthetic data only.`, {
      exact: true,
    })
    .waitFor();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForFunction(
    () => document.querySelector(".sidebar").getBoundingClientRect().right <= 1,
  );
  await page.getByRole("button", { name: "Open navigation" }).click();
  await page.getByRole("button", { name: "Close navigation" }).click();
  await page.waitForFunction(
    () => document.querySelector(".sidebar").getBoundingClientRect().right <= 1,
  );
  await page.screenshot({
    path: ".test-output/patient-mobile.png",
    fullPage: true,
  });
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth > window.innerWidth + 1,
  );
  assert.equal(overflow, false, "Mobile page must not overflow horizontally");
  assert.deepEqual(errors, [], "No browser runtime errors");
  console.log(
    "PASS: all three demo logins, check-in persistence, consent revoke, Tamil navigation, appointment triage, document approval/release, references, mobile layout.",
  );
} catch (error) {
  await page.screenshot({
    path: ".test-output/browser-failure.png",
    fullPage: true,
  });
  console.error("Browser URL:", page.url(), "Runtime errors:", errors);
  console.error((await page.locator("body").innerText()).slice(-6000));
  throw error;
} finally {
  await browser.close();
}
