import { test, expect } from '@playwright/test';

test('AI Coach flow: Login -> Change Region -> Rank 4 -> Ask question', async ({ page }) => {
  // 1. Login with dummy account
  await page.goto('/login');
  await page.getByRole('button', { name: 'Fill with Dummy Account' }).click();
  await page.getByRole('button', { name: 'Sign In' }).click();
  
  // landing page after login
  await expect(page).toHaveURL(/\/(dashboard)?/);

  // 2. Change Server to NA
  const regionSelect = page.getByLabel('Region:'); // The label text is "Region:" in DashboardPage.tsx


  await page.locator('#region-select').selectOption('NA1');

  // wait for leaderboard to reload/update.
  // dashboard shows "Loading..." skeleton when loading.
  // we wait for the skeleton to disappear.
  await expect(page.locator('.animate-pulse').first()).not.toBeVisible({ timeout: 10000 });

  // 3. Click current Rank 4 player (arbitrary number I chose)
  // Desktop table rows: tbody tr
  // Rank #4 is the 4th row (index 3).
  const rank4Row = page.locator('tbody tr').nth(3);
  await rank4Row.click();

  // 4. Verify we are on search page
  await expect(page).toHaveURL(/\/search/);

  // Wait for loading to complete (skeleton to disappear)
  // Increased timeout to 45s since we could be fetching a full profile
  await expect(page.locator('.animate-pulse').first()).not.toBeVisible({ timeout: 45000 });

  // Check if we hit a "Not Found" error
  const errorMsg = page.getByText('Summoner Not Found');
  if (await errorMsg.isVisible()) {
    throw new Error('Summoner not found during test execution');
  }

  // 5. Open Gemini AI Chat
  const aiButton = page.getByRole('button', { name: 'AI Coach' });
  await expect(aiButton).toBeVisible();
  await aiButton.click();

  // 6. Ask a Question
  const chatInput = page.getByPlaceholder('Ask a question about this player...');
  await expect(chatInput).toBeVisible();
  await chatInput.fill('List my standout statistics');
  
  // Click Send
  await page.locator('input[placeholder="Ask a question about this player..."] + button').click();

  // 7. Wait for response
  // First, verify user message appears
  await expect(page.getByText('List my standout statistics')).toBeVisible();

  // Wait for the typing indicator (bouncing dots) to appear
  // This confirms the request was sent
  const loadingDots = page.locator('.animate-bounce').first();
  await expect(loadingDots).toBeVisible();

  // Wait for the typing indicator to disappear (response received)
  // AI generation can take time, so we give it a generous timeout (45s)
  await expect(loadingDots).not.toBeVisible({ timeout: 45000 });

  // Verify we have a response (at least 2 messages with the robot icon: greeting + response)
  // or simple check that the last message is from the model
  await expect(page.getByText('🤖').nth(2)).toBeVisible(); // 0 is header, 1 is greeting, 2 is response icon


  // Test successful if we got here without timeout. need to expand to verify content
});
