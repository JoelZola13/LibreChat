import {
  getMarketplaceAgentIconId,
  isStreetBotModelId,
} from '~/components/Agents/StreetAgentIcon';

describe('StreetAgentIcon resolver', () => {
  it.each([
    ['agent/street_profile_agent', 'street-profile'],
    ['agent/messaging_agent', 'messaging'],
    ['agent/groups_agent', 'groups'],
    ['agent/profiles_agent', 'profiles'],
    ['agent/word_on_the_street_agent', 'word-on-the-street'],
  ])('maps %s to its own marketplace icon', (modelId, iconId) => {
    expect(getMarketplaceAgentIconId(modelId)).toBe(iconId);
  });

  it('maps selected agent labels instead of falling back to StreetBot', () => {
    expect(getMarketplaceAgentIconId('Messaging Agent')).toBe('messaging');
    expect(getMarketplaceAgentIconId('Groups Agent')).toBe('groups');
    expect(getMarketplaceAgentIconId('Street Profile Agent')).toBe('street-profile');
  });

  it('keeps StreetBot detection limited to StreetBot models', () => {
    expect(isStreetBotModelId('streetbot-0.1')).toBe(true);
    expect(isStreetBotModelId('streetbot-1-0')).toBe(true);
    expect(isStreetBotModelId('agent/messaging_agent')).toBe(false);
    expect(isStreetBotModelId('agent/groups_agent')).toBe(false);
  });
});
