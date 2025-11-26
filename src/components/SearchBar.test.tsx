import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import SearchBar from './SearchBar';
import userEvent from '@testing-library/user-event';

describe('SearchBar', () => {
  const defaultProps = {
    searchInput: '',
    setSearchInput: vi.fn(),
    region: 'EUW1',
    setRegion: vi.fn(),
    handleSearchClick: vi.fn(),
    handleKeyDown: vi.fn(),
    loading: false,
    recentSearches: [],
    showRecent: false,
    setShowRecent: vi.fn(),
    handleClearRecentSearches: vi.fn(),
    startSearch: vi.fn(),
  };

  it('renders correctly', () => {
    render(<SearchBar {...defaultProps} />);
    expect(screen.getByPlaceholderText('SummonerName#TagLine')).toBeInTheDocument();
    expect(screen.getByText('Search')).toBeInTheDocument();
    expect(screen.getByDisplayValue('EUW')).toBeInTheDocument();
  });

  it('calls setSearchInput when typing', async () => {
    const setSearchInput = vi.fn();
    render(<SearchBar {...defaultProps} setSearchInput={setSearchInput} />);
    
    const input = screen.getByPlaceholderText('SummonerName#TagLine');
    await userEvent.type(input, 'Test');
    
    expect(setSearchInput).toHaveBeenCalled();
  });

  it('calls setRegion when changing region', async () => {
    const setRegion = vi.fn();
    render(<SearchBar {...defaultProps} setRegion={setRegion} />);
    
    const select = screen.getByLabelText('Select Region');
    await userEvent.selectOptions(select, 'NA1');
    
    expect(setRegion).toHaveBeenCalledWith('NA1');
  });

  it('calls handleSearchClick when clicking search button', async () => {
    const handleSearchClick = vi.fn();
    render(<SearchBar {...defaultProps} handleSearchClick={handleSearchClick} />);
    
    const button = screen.getByText('Search');
    await userEvent.click(button);
    
    expect(handleSearchClick).toHaveBeenCalled();
  });

  it('shows recent searches when focused and has recent searches', () => {
    const recentSearches = [{ query: 'Test#123', server: 'EUW1' }];
    render(<SearchBar {...defaultProps} recentSearches={recentSearches} showRecent={true} />);
    
    expect(screen.getByText('Test#123')).toBeInTheDocument();
  });

  it('calls startSearch when clicking a recent search', async () => {
    const startSearch = vi.fn();
    const recentSearches = [{ query: 'Test#123', server: 'EUW1' }];
    render(<SearchBar {...defaultProps} recentSearches={recentSearches} showRecent={true} startSearch={startSearch} />);
    
    const recentItem = screen.getByText('Test#123');
    await userEvent.click(recentItem);
    
    expect(startSearch).toHaveBeenCalledWith('Test', '123', 'EUW1');
  });
});
