import { test, expect } from '@playwright/test';

test.use({ viewport: { width: 1920, height: 1080 } });

test('Search for player and view seasonal profile', async ({ page }) => {
  // 1. Navigate to Landing Page
  await page.goto('/');
  // 1.5 Navigate to Search Page
  // We need to go to the search page to access the search bar
  await page.getByRole('link', { name: 'Search' }).click();
  await expect(page).toHaveURL(/\/search/);

  // 2. Perform Search
  // The SearchBar component has a single input with placeholder "SummonerName#TagLine"
  const searchInput = page.getByPlaceholder('SummonerName#TagLine');
  await expect(searchInput).toBeVisible();
  
  await searchInput.fill('lagily#lol');
  
  // Select Region (defaults to EUW usually, checking if we need to set it)
  const regionSelect = page.getByLabel('Select Region');
  if (await regionSelect.isVisible()) {
      await regionSelect.selectOption('EUW1'); // Using value from SearchBar.tsx options
  }

  // Click Search
  await page.getByRole('button', { name: 'Search' }).click();

  // 3. Verify Navigation to Search Page
  // URL should contain the search params
  // Expect URL to match pattern /search?gameName=lagily&tagLine=euw...
  await expect(page).toHaveURL(/GameName=lagily/i);
  await expect(page).toHaveURL(/tagLine=lol/i);

  // 4. Verify Profile Loaded
  // Check for the heading with the summoner name
  await expect(page.getByRole('heading', { name: /lagily/i })).toBeVisible();

  // 5. Open Full Seasonal Profile
  const viewProfileBtn = page.getByRole('button', { name: 'View Full Seasonal Profile' });
  await expect(viewProfileBtn).toBeVisible();
  await viewProfileBtn.click();

  // 6. Verify Seasonal Profile Modal/Section
  await expect(page.getByRole('heading', { name: 'Seasonal Performance' })).toBeVisible();

  // 7. Verify some content in the profile
  await expect(page.getByText('Champion Statistics')).toBeVisible();
  // Use first() because "Winrate" might appear in multiple places (summary vs checks)
  await expect(page.getByText('Winrate').first()).toBeVisible();
});
