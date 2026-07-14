import { test, expect } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

const FIXTURES_DIR = path.join(__dirname, 'fixtures');
const SCREENSHOTS_DIR = path.join(__dirname, 'screenshots');

const fixtures = [
  { file: 'fixture-1-garbage.json', name: 'garbage' },
  { file: 'fixture-2-cyber-fraud.json', name: 'cyber-fraud' },
  { file: 'fixture-3-domestic-violence.json', name: 'domestic-violence' },
  { file: 'fixture-4-property.json', name: 'property-dispute' },
];

function loadFixture(name: string) {
  const filePath = path.join(FIXTURES_DIR, name);
  return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
}

function ensureDir(dir: string) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

test.describe('QA Baseline - Visual Regression', () => {
  for (const fixture of fixtures) {
    test(`Fixture: ${fixture.name}`, async ({ page }) => {
      const data = loadFixture(fixture.file);
      const fixtureDir = path.join(SCREENSHOTS_DIR, fixture.name);
      ensureDir(fixtureDir);

      // Navigate to intake page
      await page.goto('/intake');
      await page.waitForLoadState('networkidle');
      
      // Wait for form to be visible
      await expect(page.locator('input[name="fullName"]')).toBeVisible({ timeout: 10000 });
      
      // Screenshot 1: Initial form (empty)
      await page.screenshot({ 
        path: path.join(fixtureDir, '01-initial-form.png'), 
        fullPage: true 
      });

      // Fill basic details
      await page.fill('input[name="fullName"]', data.fullName);
      await page.fill('input[name="contact"]', data.contact);
      await page.fill('input[name="stateOrUT"]', data.stateOrUT);
      
      // Select case type - click search input to open dropdown, then click case type button
      await page.click('input[placeholder*="Case ID" i], input[placeholder*="filter" i], input[placeholder*="Search" i]');
      await page.waitForTimeout(300);
      await page.click(`button:has-text("${data.caseType}")`);
      
      await page.fill('input[name="incidentDate"]', data.incidentDate);
      await page.fill('input[name="amountLost"]', data.amountLost);
      await page.fill('input[name="oppositeParty"]', data.oppositeParty);
      
      // Fill story
      await page.fill('textarea[name="story"]', data.story);
      
      // Screenshot 2: After story entered
      await page.screenshot({ 
        path: path.join(fixtureDir, '02-after-story.png'), 
        fullPage: true 
      });

      // Select proofs
      for (const proof of data.proofs) {
        const checkbox = page.locator(`input[type="checkbox"][value="${proof}"]`);
        if (await checkbox.count() > 0) {
          await checkbox.check();
        }
      }
      
      // Select reliefs
      for (const relief of data.relief) {
        const checkbox = page.locator(`input[type="checkbox"][value="${relief}"]`);
        if (await checkbox.count() > 0) {
          await checkbox.check();
        }
      }

      // Click Generate Case Summary
      await page.click('button:has-text("Generate Case Summary")');
      await page.waitForTimeout(3000);
      
      // Screenshot 3: Preview section
      await page.screenshot({ 
        path: path.join(fixtureDir, '03-preview-section.png'), 
        fullPage: true 
      });

      // Try AI Analyze if button exists
      const aiAnalyzeBtn = page.locator('button:has-text("AI Analyze")');
      if (await aiAnalyzeBtn.count() > 0) {
        await aiAnalyzeBtn.click();
        await page.waitForTimeout(8000);
        await page.screenshot({ 
          path: path.join(fixtureDir, '04-ai-analyze.png'), 
          fullPage: true 
        });
      }

      // Try AI Followups if button exists
      const aiFollowupsBtn = page.locator('button:has-text("AI Followups")');
      if (await aiFollowupsBtn.count() > 0) {
        await aiFollowupsBtn.click();
        await page.waitForTimeout(8000);
        await page.screenshot({ 
          path: path.join(fixtureDir, '05-ai-followups.png'), 
          fullPage: true 
        });
      }

      // Try AI Review if button exists
      const aiReviewBtn = page.locator('button:has-text("AI Review")');
      if (await aiReviewBtn.count() > 0) {
        await aiReviewBtn.click();
        await page.waitForTimeout(8000);
        await page.screenshot({ 
          path: path.join(fixtureDir, '06-ai-review.png'), 
          fullPage: true 
        });
      }

      // Try Generate Draft if button exists
      const generateDraftBtn = page.locator('button:has-text("Generate Draft"), button:has-text("Generate Legal Aid")');
      if (await generateDraftBtn.count() > 0) {
        await generateDraftBtn.click();
        await page.waitForTimeout(5000);
        await page.screenshot({ 
          path: path.join(fixtureDir, '07-draft-generated.png'), 
          fullPage: true 
        });
      }

      // Final screenshot
      await page.screenshot({ 
        path: path.join(fixtureDir, '08-final-state.png'), 
        fullPage: true 
      });
    });
  }
});