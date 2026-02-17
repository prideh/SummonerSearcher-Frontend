import { test, expect } from '@playwright/test';

test.use({ viewport: { width: 1920, height: 1080 } });

test('Guest user can search and use AI Coach without login', async ({ page }) => {
  // 1. Navigate to Search Page
  await page.goto('/search/');

  // 2. Click "AI Coach" button directly from Landing Page (if available? No, usually on Profile/Search)
  // Let's stick to the flow: Search -> Results -> AI Coach

  // Verify we are not logged in (Desktop link check)
  // We target the desktop Login link specifically to avoid ambiguity with mobile menu
  const loginLink = page.getByRole('link', { name: 'Login' }).first();
  await expect(loginLink).toBeVisible();

  // 3. Perform a Search from Landing Page (using the example button for ease)
  await page.getByText('pride#persi on EUW').click();

  // 4. Verify Redirect to Search Page
  await expect(page).toHaveURL(/\/search/);

  // 5. Verify Summoner Info is loaded
  await expect(page.getByRole('heading', { name: 'Summoner Search' })).toBeVisible();
  // Wait for the summoner name to appear
  await expect(page.getByText('pride', { exact: false }).first()).toBeVisible();

  // 6. Click "AI Coach" button
  const aiCoachButton = page.getByRole('button', { name: 'AI Coach' });
  await expect(aiCoachButton).toBeVisible();
  await aiCoachButton.click();

  // 7. Verify AI Modal opens
  const modalHeader = page.getByRole('heading', { name: 'AI Coach:' });
  await expect(modalHeader).toBeVisible();

  // 8. Select a suggested question
  const suggestion = page.getByRole('button', { name: 'Analyze my profile' });
  await expect(suggestion).toBeVisible();
  await suggestion.click();

  // 9. Verify response is generated (check for robot icon or message)
  // We wait for the "robot" icon or a model message response
  const robotIcon = page.locator('.bg-purple-600').first();
  await expect(robotIcon).toBeVisible({ timeout: 20000 }); // Give AI some time to respond
  
  // 10. Verify recent searches are saved locally
  // Navigate away and back or refresh to verify persistence
  await page.reload();
  await page.getByPlaceholder('SummonerName#TagLine').click();
  await expect(page.getByText('pride#persi')).toBeVisible();
});
