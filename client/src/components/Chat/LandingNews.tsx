import { memo } from 'react';

// Sample news data - in production, this would come from an API
const newsItems = [
  {
    id: 1,
    image: 'https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?w=400&h=250&fit=crop',
    tags: ['Street Voices', 'Street Voices'],
    title: 'MADMAN Summit: Behind The Mask Of Masculinity Builds Space For Black Men To Speak, Heal, And Connect',
    href: '/news/1',
  },
  {
    id: 2,
    image: 'https://images.unsplash.com/photo-1573164713988-8665fc963095?w=400&h=250&fit=crop',
    tags: ['Street Voices', 'Street Voices'],
    title: 'Bankers and Black business owners to meet up at summit addressing systemic racism in banking',
    href: '/news/2',
  },
  {
    id: 3,
    image: 'https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?w=400&h=250&fit=crop',
    tags: ['Street Voices', 'Street Voices'],
    title: 'It Requires Nearly 80 Hours a Week to Afford a One Bedroom in Toronto',
    href: '/news/3',
  },
];

const NewsCard = memo(({
  image,
  tags,
  title,
  href,
}: {
  image: string;
  tags: string[];
  title: string;
  href: string;
}) => {
  return (
    <a
      href={href}
      style={{
        display: 'block',
        position: 'relative',
        borderRadius: 16,
        overflow: 'hidden',
        textDecoration: 'none',
        aspectRatio: '4 / 3',
        minHeight: 200,
        background: '#1a1b26',
      }}
    >
      {/* Background Image */}
      <img
        src={image}
        alt=""
        style={{
          position: 'absolute',
          inset: 0,
          width: '100%',
          height: '100%',
          objectFit: 'cover',
        }}
        loading="lazy"
      />

      {/* Gradient Overlay */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: 'linear-gradient(to top, rgba(0,0,0,0.85) 0%, rgba(0,0,0,0.4) 50%, rgba(0,0,0,0.2) 100%)',
        }}
      />

      {/* Content */}
      <div
        style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          padding: 16,
        }}
      >
        {/* Tags */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
          {tags.map((tag, idx) => (
            <span
              key={idx}
              style={{
                padding: '4px 10px',
                fontSize: 11,
                fontWeight: 500,
                fontFamily: 'Rubik, sans-serif',
                borderRadius: 4,
                background: idx === 0 ? '#FFD60A' : 'transparent',
                color: idx === 0 ? '#14151D' : '#E6E7F2',
                border: idx === 0 ? 'none' : '1px solid rgba(255,255,255,0.5)',
              }}
            >
              {tag}
            </span>
          ))}
        </div>

        {/* Title */}
        <h3
          style={{
            color: '#fff',
            fontSize: 14,
            fontWeight: 500,
            fontFamily: 'Rubik, sans-serif',
            lineHeight: 1.4,
            margin: 0,
            display: '-webkit-box',
            WebkitLineClamp: 3,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
          }}
        >
          {title}
        </h3>
      </div>
    </a>
  );
});

const LandingNews = memo(() => {
  return (
    <section
      style={{
        width: '100%',
        maxWidth: 1200,
        margin: '0 auto',
        padding: '40px 24px 60px',
      }}
    >
      {/* Section Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 16,
          marginBottom: 24,
        }}
      >
        <h2
          style={{
            color: '#E6E7F2',
            fontSize: 16,
            fontWeight: 500,
            fontFamily: 'Rubik, sans-serif',
            margin: 0,
            whiteSpace: 'nowrap',
          }}
        >
          Latest News
        </h2>
        <div
          style={{
            flex: 1,
            height: 1,
            background: 'linear-gradient(to right, rgba(188, 189, 208, 0.3), transparent)',
          }}
        />
      </div>

      {/* News Grid */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
          gap: 24,
        }}
      >
        {newsItems.map((item) => (
          <NewsCard
            key={item.id}
            image={item.image}
            tags={item.tags}
            title={item.title}
            href={item.href}
          />
        ))}
      </div>
    </section>
  );
});

LandingNews.displayName = 'LandingNews';
NewsCard.displayName = 'NewsCard';

export default LandingNews;
