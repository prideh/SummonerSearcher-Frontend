import { test, expect } from '@playwright/test';

test('User can login with dummy account and view #1 ranked player', async ({ page }) => {
  // 1. Navigate to Login Page
  await page.goto('/login');

  // 2. Fill Dummy Credentials
  await page.getByRole('button', { name: 'Fill with Dummy Account' }).click();

  // 3. Click Sign In
  await page.getByRole('button', { name: 'Sign In' }).click();

  // 4. Verify Redirect to Dashboard
  await expect(page).toHaveURL(/\/dashboard/, { timeout: 10000 });
  await expect(page.getByRole('heading', { name: 'Challenger Leaderboard' })).toBeVisible();

  // 5. Click the #1 Ranked Player
  // We target the first row in the table body
  const firstRow = page.locator('tbody tr').first();
  await expect(firstRow).toBeVisible();
  
  // Capture the name of the player to verify later (optional, but good practice)
  // The name is in the second cell
  const playerName = await firstRow.locator('td').nth(1).innerText();
  console.log(`Clicking on player: ${playerName}`);

  await firstRow.click();

  // 6. Verify Redirect to Search Page
  await expect(page).toHaveURL(/\/search/);
  
  // 7. Verify we see the Summoner Search page and potential profile info
  await expect(page.getByRole('heading', { name: 'Summoner Search' })).toBeVisible();
  
  // Optional: Verify the input or profile matches the clicked player
  // Splitting by newline because innerText might contain the tag "PlayerName\n#Tag"
  // Just checking the URL parameters might be easier/safer
  const url = page.url();
  expect(url).toContain('gameName=');
  expect(url).toContain('tagLine=');

  // 8. Expand a Match Detail
  // The match history items are likely loaded by now.
  // We'll target the first expand button in the match history list.
  const expandButton = page.getByLabel('Expand match details').first();
  await expect(expandButton).toBeVisible();
  
  await expandButton.click();

  // 9. Verify Match Details Display
  // Check for the presence of the tabs which indicates the details are open
  await expect(page.getByRole('button', { name: 'Scoreboard' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Graphs' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Runes' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Analysis' })).toBeVisible();

  // 10. Verify content within the active tab (Scoreboard is default)
  // Check for the "Blue Team" or "Red Team" header which is part of the ScoreboardTab content
  await expect(page.getByText('Blue Team', { exact: false }).first()).toBeVisible();
});
