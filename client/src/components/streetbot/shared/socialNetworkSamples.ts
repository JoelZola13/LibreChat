export type SocialSampleProfile = {
  id: string;
  user_id: string;
  username: string;
  display_name: string;
  primary_roles: string[];
  tagline: string;
  avatar_url: string;
  city: string;
  country: string;
  location_display: string;
  availability_status: 'open' | 'busy';
  is_featured: boolean;
  is_verified: boolean;
  followers_count: number;
};

export type SocialSampleGroup = {
  id: number;
  name: string;
  description: string;
  avatar_url: string | null;
  member_count: number;
  tags: string[];
  category: string;
  is_public: boolean;
  is_member: boolean;
  channel_slug: string;
  channel_id: string;
  agents: string[];
  featured_post_id: string;
  featured_member_usernames: string[];
  message_count: number;
  last_message: {
    content: string;
    timestamp: string;
    author: string;
    is_agent: boolean;
  };
};

export type SocialSampleForumPost = {
  id: string;
  category_id: string | null;
  category_name: string;
  category_slug: string;
  title: string;
  content_preview: string;
  author_id: string;
  author_name: string;
  author_username: string;
  is_anonymous: false;
  anonymous_name: null;
  post_type: 'discussion' | 'question' | 'story' | 'resource' | 'announcement';
  tags: string[];
  status: 'published';
  is_pinned: boolean;
  is_featured: boolean;
  view_count: number;
  reply_count: number;
  like_count: number;
  is_liked: boolean;
  is_bookmarked: boolean;
  last_activity_at: string;
  created_at: string;
  related_group_id: number;
  related_group_name: string;
  related_channel_id: string;
  media?: Array<{
    type: 'image' | 'meme' | 'video';
    url?: string;
    videoSrc?: string;
    alt?: string;
    caption?: string;
    topText?: string;
    bottomText?: string;
    title?: string;
    duration?: string;
  }>;
};

export type SocialSampleMessage = {
  id: string;
  content: string;
  createdAt: string;
  author: {
    id: string;
    username: string;
    displayName: string;
    avatarUrl: string | null;
    isAgent: boolean;
  };
};

export const SOCIAL_SAMPLE_PROFILES: SocialSampleProfile[] = [
  {
    id: 'sample-profile-graffiti-ghost',
    user_id: 'sample-user-graffiti-ghost',
    username: 'graffiti_ghost',
    display_name: 'Ghost',
    primary_roles: ['Visual Artist', 'Muralist'],
    tagline: 'Art belongs to everyone',
    avatar_url: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=400',
    city: 'Toronto',
    country: 'Canada',
    location_display: 'Toronto, Canada',
    availability_status: 'open',
    is_featured: true,
    is_verified: true,
    followers_count: 34500,
  },
  {
    id: 'sample-profile-dj-solaris',
    user_id: 'sample-user-dj-solaris',
    username: 'dj_solaris',
    display_name: 'DJ Solaris',
    primary_roles: ['DJ', 'Music Producer'],
    tagline: 'Future sounds from the diaspora',
    avatar_url: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400',
    city: 'Toronto',
    country: 'Canada',
    location_display: 'Toronto, Canada',
    availability_status: 'open',
    is_featured: true,
    is_verified: true,
    followers_count: 28900,
  },
  {
    id: 'sample-profile-fatima-hassan',
    user_id: 'sample-user-fatima-hassan',
    username: 'film_by_fatima',
    display_name: 'Fatima Hassan',
    primary_roles: ['Filmmaker', 'Creative Director'],
    tagline: 'Documenting community power in motion',
    avatar_url: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=400',
    city: 'Toronto',
    country: 'Canada',
    location_display: 'Toronto, Canada',
    availability_status: 'busy',
    is_featured: true,
    is_verified: true,
    followers_count: 19600,
  },
  {
    id: 'sample-profile-suki-park',
    user_id: 'sample-user-suki-park',
    username: 'suki_still',
    display_name: 'Suki Park',
    primary_roles: ['Photographer', 'Writer'],
    tagline: 'Portraits, zines, and neighbourhood archives',
    avatar_url: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=400',
    city: 'Toronto',
    country: 'Canada',
    location_display: 'Toronto, Canada',
    availability_status: 'open',
    is_featured: false,
    is_verified: true,
    followers_count: 8700,
  },
];

export const SOCIAL_SAMPLE_GROUPS: SocialSampleGroup[] = [
  {
    id: 9001,
    name: 'Street Voices Creators Circle',
    description:
      'A working room for artists, writers, producers, and storytellers planning collaborations across Street Voices.',
    avatar_url: 'https://images.unsplash.com/photo-1528605248644-14dd04022da1?w=500',
    member_count: 42,
    tags: ['collaboration', 'portfolio', 'community'],
    category: 'creative',
    is_public: true,
    is_member: true,
    channel_slug: 'content',
    channel_id: 'channel-content',
    agents: ['communication-manager', 'social-agent'],
    featured_post_id: 'sample-post-creator-collab',
    featured_member_usernames: ['graffiti_ghost', 'dj_solaris', 'suki_still'],
    message_count: 18,
    last_message: {
      content: 'Fatima is looking for one more photographer for the weekend shoot.',
      timestamp: '2026-05-13T04:40:00.000Z',
      author: 'Suki Park',
      is_agent: false,
    },
  },
  {
    id: 9002,
    name: 'Media Training Cohort',
    description:
      'Academy learners, instructors, and alumni sharing assignments, story ideas, and production feedback.',
    avatar_url: 'https://images.unsplash.com/photo-1517048676732-d65bc937f952?w=500',
    member_count: 31,
    tags: ['academy', 'media-training', 'assignments'],
    category: 'academy',
    is_public: true,
    is_member: true,
    channel_slug: 'communication',
    channel_id: 'channel-communication',
    agents: ['auto-router', 'calendar-agent'],
    featured_post_id: 'sample-post-media-training',
    featured_member_usernames: ['film_by_fatima', 'dj_solaris'],
    message_count: 24,
    last_message: {
      content: 'The interview checklist is pinned in Messages before Thursday lab.',
      timestamp: '2026-05-13T04:12:00.000Z',
      author: 'Auto Router',
      is_agent: true,
    },
  },
  {
    id: 9010,
    name: 'Toronto Photographers',
    description:
      'A city-wide photo group for street photographers, event shooters, portrait artists, and visual storytellers sharing locations, prompts, and paid leads.',
    avatar_url: 'https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?w=500',
    member_count: 128,
    tags: ['photography', 'toronto', 'photo-walks'],
    category: 'photography',
    is_public: true,
    is_member: true,
    channel_slug: 'photo-walks',
    channel_id: 'channel-photo-walks',
    agents: ['content-manager', 'calendar-agent'],
    featured_post_id: 'sample-post-open-mic-recap',
    featured_member_usernames: ['suki_still', 'film_by_fatima'],
    message_count: 73,
    last_message: {
      content: 'Saturday golden-hour walk is starting near Kensington Market. Bring a 35mm if you have one.',
      timestamp: '2026-05-20T04:50:00.000Z',
      author: 'Suki Park',
      is_agent: false,
    },
  },
  {
    id: 9011,
    name: 'Black Videographers Network',
    description:
      'A production room for Black camera operators, editors, directors, drone pilots, and DPs sharing gigs, crew calls, gear tips, and reel feedback.',
    avatar_url: 'https://images.unsplash.com/photo-1516035069371-29a1b244cc32?w=500',
    member_count: 96,
    tags: ['videography', 'black-creatives', 'crew-calls'],
    category: 'video-production',
    is_public: true,
    is_member: true,
    channel_slug: 'crew-calls',
    channel_id: 'channel-crew-calls',
    agents: ['content-manager', 'social-agent'],
    featured_post_id: 'sample-post-reel-street-interviews',
    featured_member_usernames: ['film_by_fatima', 'dj_solaris'],
    message_count: 61,
    last_message: {
      content: 'Looking for a second shooter for a community safety reel this weekend.',
      timestamp: '2026-05-20T04:35:00.000Z',
      author: 'Fatima Hassan',
      is_agent: false,
    },
  },
  {
    id: 9012,
    name: 'Women Writers Room',
    description:
      'A supportive critique and accountability group for women essayists, poets, journalists, grant writers, screenwriters, and culture writers.',
    avatar_url: 'https://images.unsplash.com/photo-1522202176988-66273c2fd55f?w=500',
    member_count: 84,
    tags: ['writing', 'women-creatives', 'critique'],
    category: 'writing',
    is_public: true,
    is_member: false,
    channel_slug: 'drafts',
    channel_id: 'channel-drafts',
    agents: ['article-writer', 'grant-writer'],
    featured_post_id: 'sample-post-meme-deadline',
    featured_member_usernames: ['suki_still', 'film_by_fatima'],
    message_count: 44,
    last_message: {
      content: 'Tonight’s prompt: write the first paragraph of the story you keep avoiding.',
      timestamp: '2026-05-20T03:58:00.000Z',
      author: 'Suki Park',
      is_agent: false,
    },
  },
  {
    id: 9013,
    name: 'Creative Directors Lab',
    description:
      'Moodboards, decks, campaign concepts, pitch reviews, art direction references, and collaboration calls for creative directors and producers.',
    avatar_url: 'https://images.unsplash.com/photo-1519389950473-47ba0277781c?w=500',
    member_count: 72,
    tags: ['creative-direction', 'campaigns', 'moodboards'],
    category: 'creative-direction',
    is_public: true,
    is_member: true,
    channel_slug: 'concepts',
    channel_id: 'channel-concepts',
    agents: ['content-manager', 'project-manager'],
    featured_post_id: 'sample-post-creator-collab',
    featured_member_usernames: ['film_by_fatima', 'graffiti_ghost'],
    message_count: 39,
    last_message: {
      content: 'Drop visual references for the youth media launch board before Thursday.',
      timestamp: '2026-05-20T03:20:00.000Z',
      author: 'Fatima Hassan',
      is_agent: false,
    },
  },
  {
    id: 9014,
    name: 'Podcast Hosts & Personalities',
    description:
      'A group for hosts, interviewers, on-camera personalities, podcasters, and moderators developing segments, guest lists, and clip ideas.',
    avatar_url: 'https://images.unsplash.com/photo-1590602847861-f357a9332bbc?w=500',
    member_count: 67,
    tags: ['podcasting', 'hosting', 'interviews'],
    category: 'audio-video',
    is_public: true,
    is_member: false,
    channel_slug: 'episodes',
    channel_id: 'channel-episodes',
    agents: ['social-agent', 'calendar-agent'],
    featured_post_id: 'sample-post-reel-open-mic-crowd',
    featured_member_usernames: ['dj_solaris', 'film_by_fatima'],
    message_count: 52,
    last_message: {
      content: 'Who can host the recap segment after the open mic photos drop?',
      timestamp: '2026-05-20T02:58:00.000Z',
      author: 'DJ Solaris',
      is_agent: false,
    },
  },
  {
    id: 9015,
    name: 'Streetwear Designers Exchange',
    description:
      'Designers, stylists, screen printers, photographers, and models sharing lookbooks, drops, vendor leads, and fit-check inspiration.',
    avatar_url: 'https://images.unsplash.com/photo-1523398002811-999ca8dec234?w=500',
    member_count: 112,
    tags: ['fashion', 'streetwear', 'lookbooks'],
    category: 'fashion',
    is_public: true,
    is_member: false,
    channel_slug: 'drops',
    channel_id: 'channel-drops',
    agents: ['social-media', 'content-manager'],
    featured_post_id: 'sample-post-mural-progress',
    featured_member_usernames: ['graffiti_ghost', 'suki_still'],
    message_count: 46,
    last_message: {
      content: 'Looking for a photographer for a Sunday lookbook shoot near Queen West.',
      timestamp: '2026-05-20T02:25:00.000Z',
      author: 'Ghost',
      is_agent: false,
    },
  },
  {
    id: 9016,
    name: 'Grant & Funding Leads',
    description:
      'A practical group for artists and nonprofits sharing grant deadlines, budget templates, collaborator letters, and funding wins.',
    avatar_url: 'https://images.unsplash.com/photo-1554224155-6726b3ff858f?w=500',
    member_count: 143,
    tags: ['grants', 'funding', 'deadlines'],
    category: 'funding',
    is_public: true,
    is_member: true,
    channel_slug: 'deadlines',
    channel_id: 'channel-deadlines',
    agents: ['grant-manager', 'budget-manager'],
    featured_post_id: 'sample-post-meme-one-more-change',
    featured_member_usernames: ['film_by_fatima', 'suki_still'],
    message_count: 88,
    last_message: {
      content: 'New arts council deadline added. The budget template is pinned.',
      timestamp: '2026-05-20T01:45:00.000Z',
      author: 'Auto Router',
      is_agent: true,
    },
  },
  {
    id: 9017,
    name: 'Youth Film Crew',
    description:
      'A hands-on film crew space for youth directors, editors, sound recordists, PAs, and mentors building shorts, reels, and documentaries.',
    avatar_url: 'https://images.unsplash.com/photo-1485846234645-a62644f84728?w=500',
    member_count: 59,
    tags: ['film', 'youth-media', 'production'],
    category: 'film',
    is_public: true,
    is_member: true,
    channel_slug: 'set-life',
    channel_id: 'channel-set-life',
    agents: ['media-program-researcher', 'calendar-agent'],
    featured_post_id: 'sample-post-reel-street-check',
    featured_member_usernames: ['film_by_fatima', 'dj_solaris'],
    message_count: 34,
    last_message: {
      content: 'Call sheet draft is ready. We need one more PA for Saturday morning.',
      timestamp: '2026-05-19T23:30:00.000Z',
      author: 'Fatima Hassan',
      is_agent: false,
    },
  },
  {
    id: 9018,
    name: 'Muralists & Street Artists',
    description:
      'A visual art group for muralists, aerosol artists, illustrators, public art crews, and photographers documenting wall projects.',
    avatar_url: 'https://images.unsplash.com/photo-1518998053901-5348d3961a04?w=500',
    member_count: 78,
    tags: ['murals', 'public-art', 'street-art'],
    category: 'visual-art',
    is_public: true,
    is_member: false,
    channel_slug: 'walls',
    channel_id: 'channel-walls',
    agents: ['content-manager', 'social-agent'],
    featured_post_id: 'sample-post-mural-progress',
    featured_member_usernames: ['graffiti_ghost', 'suki_still'],
    message_count: 41,
    last_message: {
      content: 'Need two more hands for detail day on the youth wall.',
      timestamp: '2026-05-19T22:10:00.000Z',
      author: 'Ghost',
      is_agent: false,
    },
  },
  {
    id: 9019,
    name: 'Editors & Motion Designers',
    description:
      'A post-production group for editors, colorists, motion designers, captioners, and social clip makers swapping workflows and critique.',
    avatar_url: 'https://images.unsplash.com/photo-1574717024653-61fd2cf4d44d?w=500',
    member_count: 64,
    tags: ['editing', 'motion-design', 'reels'],
    category: 'post-production',
    is_public: true,
    is_member: true,
    channel_slug: 'timelines',
    channel_id: 'channel-timelines',
    agents: ['content-manager', 'social-media'],
    featured_post_id: 'sample-post-meme-community-manager',
    featured_member_usernames: ['dj_solaris', 'film_by_fatima'],
    message_count: 29,
    last_message: {
      content: 'Drop your caption export settings. We are comparing Shorts and Reels workflows.',
      timestamp: '2026-05-19T21:40:00.000Z',
      author: 'DJ Solaris',
      is_agent: false,
    },
  },
];

export const SOCIAL_SAMPLE_FORUM_POSTS: SocialSampleForumPost[] = [
  {
    id: 'sample-post-reel-open-mic-crowd',
    category_id: null,
    category_name: 'Success Stories',
    category_slug: 'success-stories',
    title: 'REEL: the crowd finishing the hook at last night’s open mic',
    content_preview:
      'Quick vertical clip from the end of the showcase. This is the kind of short-form moment that could live directly in Word On The Street and still open into a full player.',
    author_id: 'sample-user-dj-solaris',
    author_name: 'DJ Solaris',
    author_username: 'dj_solaris',
    is_anonymous: false,
    anonymous_name: null,
    post_type: 'story',
    tags: ['reel', 'open-mic', 'performance'],
    status: 'published',
    is_pinned: false,
    is_featured: true,
    view_count: 891,
    reply_count: 42,
    like_count: 156,
    is_liked: false,
    is_bookmarked: false,
    last_activity_at: '2026-05-20T06:05:00.000Z',
    created_at: '2026-05-20T05:48:00.000Z',
    related_group_id: 9001,
    related_group_name: 'Street Voices Creators Circle',
    related_channel_id: 'channel-content',
    media: [
      {
        type: 'video',
        url: 'https://images.unsplash.com/photo-1501612780327-45045538702b?w=900',
        videoSrc: 'https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4',
        alt: 'A performer on stage with a crowd at a live music event',
        title: 'Open mic crowd moment',
        duration: '0:32',
        caption: 'Reel preview: tap to play.',
      },
    ],
  },
  {
    id: 'sample-post-meme-one-more-change',
    category_id: null,
    category_name: 'Off Topic',
    category_slug: 'off-topic',
    title: 'MEME: “just one more tiny edit”',
    content_preview:
      'For everyone who has ever said the final cut was final, then opened the project file twelve more times.',
    author_id: 'sample-user-fatima-hassan',
    author_name: 'Fatima Hassan',
    author_username: 'film_by_fatima',
    is_anonymous: false,
    anonymous_name: null,
    post_type: 'discussion',
    tags: ['meme', 'editing', 'creator-life'],
    status: 'published',
    is_pinned: false,
    is_featured: true,
    view_count: 734,
    reply_count: 58,
    like_count: 201,
    is_liked: false,
    is_bookmarked: false,
    last_activity_at: '2026-05-20T05:55:00.000Z',
    created_at: '2026-05-20T05:35:00.000Z',
    related_group_id: 9001,
    related_group_name: 'Street Voices Creators Circle',
    related_channel_id: 'channel-content',
    media: [
      {
        type: 'meme',
        topText: 'CLIENT: JUST ONE TINY CHANGE',
        bottomText: 'THE TIMELINE: 37 NEW LAYERS',
        caption: 'Creator-life meme.',
      },
    ],
  },
  {
    id: 'sample-post-reel-street-check',
    category_id: null,
    category_name: 'Creative Collaborations',
    category_slug: 'creative-collaborations',
    title: 'REEL: street check-in before the community shoot',
    content_preview:
      'A 40-second vertical update from the field team. This shows how Word On The Street can hold quick video updates without turning the feed into a heavy video wall.',
    author_id: 'sample-user-suki-park',
    author_name: 'Suki Park',
    author_username: 'suki_still',
    is_anonymous: false,
    anonymous_name: null,
    post_type: 'resource',
    tags: ['reel', 'behind-the-scenes', 'shoot-day'],
    status: 'published',
    is_pinned: false,
    is_featured: false,
    view_count: 502,
    reply_count: 16,
    like_count: 88,
    is_liked: false,
    is_bookmarked: false,
    last_activity_at: '2026-05-20T05:28:00.000Z',
    created_at: '2026-05-20T05:05:00.000Z',
    related_group_id: 9002,
    related_group_name: 'Media Training Cohort',
    related_channel_id: 'channel-communication',
    media: [
      {
        type: 'video',
        url: 'https://images.unsplash.com/photo-1495020689067-958852a7765e?w=900',
        videoSrc: 'https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4',
        alt: 'A creator filming a street interview with a camera',
        title: 'Street check-in reel',
        duration: '0:40',
        caption: 'Field update before the shoot.',
      },
    ],
  },
  {
    id: 'sample-post-meme-community-manager',
    category_id: null,
    category_name: 'Off Topic',
    category_slug: 'off-topic',
    title: 'MEME: community manager after three group chats',
    content_preview:
      'The group chat, the email thread, and the comments all needed an answer at the exact same time.',
    author_id: 'sample-user-graffiti-ghost',
    author_name: 'Ghost',
    author_username: 'graffiti_ghost',
    is_anonymous: false,
    anonymous_name: null,
    post_type: 'discussion',
    tags: ['meme', 'community', 'group-chat'],
    status: 'published',
    is_pinned: false,
    is_featured: false,
    view_count: 457,
    reply_count: 24,
    like_count: 119,
    is_liked: false,
    is_bookmarked: false,
    last_activity_at: '2026-05-20T05:10:00.000Z',
    created_at: '2026-05-20T04:52:00.000Z',
    related_group_id: 9001,
    related_group_name: 'Street Voices Creators Circle',
    related_channel_id: 'channel-content',
    media: [
      {
        type: 'meme',
        topText: 'ME: I WILL REPLY AFTER LUNCH',
        bottomText: 'ALSO ME: ANSWERING 19 NOTIFICATIONS AT ONCE',
        caption: 'Community manager mode.',
      },
    ],
  },
  {
    id: 'sample-post-creator-collab',
    category_id: null,
    category_name: 'Creative Collaborations',
    category_slug: 'creative-collaborations',
    title: 'Looking for collaborators for a Street Voices mini-doc',
    content_preview:
      'Fatima is putting together a short documentary about artists documenting neighbourhood change. Ghost can handle mural stills, Solaris offered music supervision, and the Creators Circle is collecting volunteers.',
    author_id: 'sample-user-fatima-hassan',
    author_name: 'Fatima Hassan',
    author_username: 'film_by_fatima',
    is_anonymous: false,
    anonymous_name: null,
    post_type: 'discussion',
    tags: ['documentary', 'collaboration', 'portfolio'],
    status: 'published',
    is_pinned: true,
    is_featured: true,
    view_count: 284,
    reply_count: 14,
    like_count: 39,
    is_liked: false,
    is_bookmarked: false,
    last_activity_at: '2026-05-13T04:42:00.000Z',
    created_at: '2026-05-12T22:15:00.000Z',
    related_group_id: 9001,
    related_group_name: 'Street Voices Creators Circle',
    related_channel_id: 'channel-content',
    media: [
      {
        type: 'image',
        url: 'https://images.unsplash.com/photo-1492684223066-81342ee5ff30?w=1200',
        alt: 'Community creators filming a neighbourhood event at night',
        caption: 'Location scout from the mini-doc team.',
      },
    ],
  },
  {
    id: 'sample-post-media-training',
    category_id: null,
    category_name: 'Success Stories',
    category_slug: 'success-stories',
    title: 'First media-training cohort is ready for interview week',
    content_preview:
      'Learners are pairing up to record short community interviews. The cohort is using Groups for prep, Messages for quick feedback, and Profiles to publish finished work.',
    author_id: 'sample-user-suki-park',
    author_name: 'Suki Park',
    author_username: 'suki_still',
    is_anonymous: false,
    anonymous_name: null,
    post_type: 'story',
    tags: ['academy', 'interviews', 'community-media'],
    status: 'published',
    is_pinned: false,
    is_featured: true,
    view_count: 198,
    reply_count: 9,
    like_count: 28,
    is_liked: false,
    is_bookmarked: false,
    last_activity_at: '2026-05-13T03:58:00.000Z',
    created_at: '2026-05-12T18:05:00.000Z',
    related_group_id: 9002,
    related_group_name: 'Media Training Cohort',
    related_channel_id: 'channel-communication',
    media: [
      {
        type: 'image',
        url: 'https://images.unsplash.com/photo-1517048676732-d65bc937f952?w=1200',
        alt: 'Media trainees gathered around a workshop table',
        caption: 'Interview lab prep before field recording week.',
      },
      {
        type: 'image',
        url: 'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?w=1200',
        alt: 'Laptop showing a collaborative media project',
      },
    ],
  },
  {
    id: 'sample-post-open-mic-recap',
    category_id: null,
    category_name: 'Success Stories',
    category_slug: 'success-stories',
    title: 'Open mic night filled the room and the recap photos are live',
    content_preview:
      'The Thursday open mic turned into a packed community showcase. Poets, singers, and first-time hosts shared the stage, and the photo team uploaded highlights for everyone who performed.',
    author_id: 'sample-user-dj-solaris',
    author_name: 'DJ Solaris',
    author_username: 'dj_solaris',
    is_anonymous: false,
    anonymous_name: null,
    post_type: 'story',
    tags: ['open-mic', 'photos', 'community-night'],
    status: 'published',
    is_pinned: false,
    is_featured: true,
    view_count: 412,
    reply_count: 26,
    like_count: 84,
    is_liked: false,
    is_bookmarked: false,
    last_activity_at: '2026-05-13T02:20:00.000Z',
    created_at: '2026-05-12T23:30:00.000Z',
    related_group_id: 9001,
    related_group_name: 'Street Voices Creators Circle',
    related_channel_id: 'channel-content',
    media: [
      {
        type: 'image',
        url: 'https://images.unsplash.com/photo-1501386761578-eac5c94b800a?w=1200',
        alt: 'Performer on stage at a crowded live event',
        caption: 'Open mic highlights from Thursday night.',
      },
      {
        type: 'image',
        url: 'https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?w=1200',
        alt: 'Audience watching a live community performance',
      },
    ],
  },
  {
    id: 'sample-post-mural-progress',
    category_id: null,
    category_name: 'Creative Collaborations',
    category_slug: 'creative-collaborations',
    title: 'Mural progress check: youth wall needs two more painters',
    content_preview:
      'Ghost posted progress photos from the youth wall project. The base colors are down, the lettering is sketched, and the team needs two more painters for the final detail day.',
    author_id: 'sample-user-graffiti-ghost',
    author_name: 'Ghost',
    author_username: 'graffiti_ghost',
    is_anonymous: false,
    anonymous_name: null,
    post_type: 'discussion',
    tags: ['mural', 'volunteers', 'public-art'],
    status: 'published',
    is_pinned: false,
    is_featured: false,
    view_count: 236,
    reply_count: 17,
    like_count: 51,
    is_liked: false,
    is_bookmarked: false,
    last_activity_at: '2026-05-12T21:45:00.000Z',
    created_at: '2026-05-12T19:10:00.000Z',
    related_group_id: 9001,
    related_group_name: 'Street Voices Creators Circle',
    related_channel_id: 'channel-content',
    media: [
      {
        type: 'image',
        url: 'https://images.unsplash.com/photo-1518998053901-5348d3961a04?w=1200',
        alt: 'Colorful mural wall in progress',
        caption: 'Base layer is down. Detail day is next.',
      },
    ],
  },
  {
    id: 'sample-post-resource-table',
    category_id: null,
    category_name: 'Rights & Advocacy',
    category_slug: 'rights-advocacy',
    title: 'Resource table from the pop-up clinic',
    content_preview:
      'The advocacy team shared a quick visual recap from the pop-up clinic: housing forms, legal aid contacts, mental health supports, and harm reduction kits were all available in one place.',
    author_id: 'sample-user-suki-park',
    author_name: 'Suki Park',
    author_username: 'suki_still',
    is_anonymous: false,
    anonymous_name: null,
    post_type: 'resource',
    tags: ['resources', 'legal-aid', 'clinic'],
    status: 'published',
    is_pinned: false,
    is_featured: false,
    view_count: 165,
    reply_count: 8,
    like_count: 33,
    is_liked: false,
    is_bookmarked: false,
    last_activity_at: '2026-05-12T17:25:00.000Z',
    created_at: '2026-05-12T16:00:00.000Z',
    related_group_id: 9002,
    related_group_name: 'Media Training Cohort',
    related_channel_id: 'channel-communication',
    media: [
      {
        type: 'image',
        url: 'https://images.unsplash.com/photo-1521791136064-7986c2920216?w=1200',
        alt: 'Community support team sharing resources at a table',
        caption: 'Pop-up clinic resource table.',
      },
    ],
  },
  {
    id: 'sample-post-meme-deadline',
    category_id: null,
    category_name: 'Off Topic',
    category_slug: 'off-topic',
    title: 'When the grant deadline is tonight and the budget tab still says TBD',
    content_preview:
      'A little meme therapy for everyone finishing applications this week. Drop your best "creative admin" survival jokes in the replies.',
    author_id: 'sample-user-dj-solaris',
    author_name: 'DJ Solaris',
    author_username: 'dj_solaris',
    is_anonymous: false,
    anonymous_name: null,
    post_type: 'discussion',
    tags: ['meme', 'creative-admin', 'grant-season'],
    status: 'published',
    is_pinned: false,
    is_featured: false,
    view_count: 321,
    reply_count: 31,
    like_count: 96,
    is_liked: false,
    is_bookmarked: false,
    last_activity_at: '2026-05-12T15:35:00.000Z',
    created_at: '2026-05-12T14:55:00.000Z',
    related_group_id: 9001,
    related_group_name: 'Street Voices Creators Circle',
    related_channel_id: 'channel-content',
    media: [
      {
        type: 'meme',
        topText: 'ME: I JUST NEED ONE SIMPLE BUDGET',
        bottomText: 'THE SPREADSHEET: ENABLE ITERATIVE CALCULATIONS?',
        caption: 'Grant deadline energy.',
      },
    ],
  },
  {
    id: 'sample-post-reel-street-interviews',
    category_id: null,
    category_name: 'Creative Collaborations',
    category_slug: 'creative-collaborations',
    title: 'Reel draft: asking people what community safety means',
    content_preview:
      'First cut from today’s street interviews is ready for feedback. We kept it under a minute so it can work as a Reel, TikTok, or Shorts post.',
    author_id: 'sample-user-fatima-hassan',
    author_name: 'Fatima Hassan',
    author_username: 'film_by_fatima',
    is_anonymous: false,
    anonymous_name: null,
    post_type: 'resource',
    tags: ['reel', 'street-interviews', 'video'],
    status: 'published',
    is_pinned: false,
    is_featured: false,
    view_count: 508,
    reply_count: 19,
    like_count: 73,
    is_liked: false,
    is_bookmarked: false,
    last_activity_at: '2026-05-12T13:15:00.000Z',
    created_at: '2026-05-12T12:40:00.000Z',
    related_group_id: 9001,
    related_group_name: 'Street Voices Creators Circle',
    related_channel_id: 'channel-content',
    media: [
      {
        type: 'video',
        url: 'https://images.unsplash.com/photo-1516035069371-29a1b244cc32?w=900',
        videoSrc: 'https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4',
        alt: 'Camera operator filming street interviews',
        title: 'Street interview reel draft',
        duration: '0:47',
        caption: 'Tap-through preview for short-form video.',
      },
    ],
  },
];

export const SOCIAL_SAMPLE_GROUP_MESSAGES: Record<number, SocialSampleMessage[]> = {
  9001: [
    {
      id: 'sample-msg-creators-1',
      content: 'I posted the mini-doc call in Word On The Street. Drop your roles in this thread so we can match people up.',
      createdAt: '2026-05-13T04:05:00.000Z',
      author: {
        id: 'sample-user-fatima-hassan',
        username: 'film_by_fatima',
        displayName: 'Fatima Hassan',
        avatarUrl: SOCIAL_SAMPLE_PROFILES[2].avatar_url,
        isAgent: false,
      },
    },
    {
      id: 'sample-msg-creators-2',
      content: 'I can cover murals and stills. Also happy to share locations from my Street Profile portfolio.',
      createdAt: '2026-05-13T04:18:00.000Z',
      author: {
        id: 'sample-user-graffiti-ghost',
        username: 'graffiti_ghost',
        displayName: 'Ghost',
        avatarUrl: SOCIAL_SAMPLE_PROFILES[0].avatar_url,
        isAgent: false,
      },
    },
  ],
  9002: [
    {
      id: 'sample-msg-cohort-1',
      content: 'Interview week checklist is ready. Profiles, release forms, and assignment links are all connected from here.',
      createdAt: '2026-05-13T03:42:00.000Z',
      author: {
        id: 'auto-router',
        username: 'auto-router',
        displayName: 'Auto Router',
        avatarUrl: null,
        isAgent: true,
      },
    },
  ],
};

export function mergeSocialItems<T>(
  primary: T[],
  secondary: T[],
  getKey: (item: T) => string | number,
) {
  const merged = new Map<string | number, T>();
  secondary.forEach((item) => merged.set(getKey(item), item));
  primary.forEach((item) => merged.set(getKey(item), item));
  return Array.from(merged.values());
}

export function getSampleAuthorProfilesMap() {
  return SOCIAL_SAMPLE_PROFILES.reduce<Record<string, any>>((acc, profile) => {
    acc[profile.user_id] = {
      user_id: profile.user_id,
      username: profile.username,
      display_name: profile.display_name,
      avatar_url: profile.avatar_url,
      is_verified: profile.is_verified,
      is_featured: profile.is_featured,
      primary_roles: profile.primary_roles,
    };
    return acc;
  }, {});
}

export function getSamplePostsForUsername(username?: string | null) {
  if (!username) return [];
  return SOCIAL_SAMPLE_FORUM_POSTS.filter((post) => post.author_username === username);
}

export function getSampleGroupsForUsername(username?: string | null) {
  if (!username) return [];
  return SOCIAL_SAMPLE_GROUPS.filter((group) =>
    group.featured_member_usernames.includes(username),
  );
}

export function getSampleGroupById(id?: string | number | null) {
  if (id === undefined || id === null) return null;
  return SOCIAL_SAMPLE_GROUPS.find((group) => String(group.id) === String(id)) || null;
}

export function getSampleMessagesForGroupId(id?: string | number | null) {
  if (id === undefined || id === null) return [];
  return SOCIAL_SAMPLE_GROUP_MESSAGES[Number(id)] || [];
}

export function getProfileMessageHref(username?: string | null) {
  return username ? `/messages?compose=${encodeURIComponent(username)}` : '/messages';
}

export function getGroupMessagesHref(group: { id: number; channel_id?: string | null }) {
  return group.channel_id
    ? `/messages?channel=${encodeURIComponent(group.channel_id)}`
    : `/groups/${group.id}?tab=chat`;
}

export function getGroupForumHref(group: { id: number; featured_post_id?: string | null }) {
  return group.featured_post_id
    ? `/word-on-the-street?post=${encodeURIComponent(group.featured_post_id)}`
    : `/word-on-the-street?group=${encodeURIComponent(String(group.id))}`;
}
