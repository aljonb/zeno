import Link from 'next/link';
import { Profile, formatJoinDate, formatCount } from '../utils/profile';

interface ProfileCardProps {
  profile: Profile;
  variant?: 'default' | 'compact' | 'detailed';
  showStats?: boolean;
  showBio?: boolean;
}

/**
 * ProfileCard Component
 * 
 * Displays user profile information in various formats.
 * 
 * Variants:
 * - default: Standard card with avatar, name, username, bio
 * - compact: Minimal view (avatar + name only)
 * - detailed: Full profile with all info and stats
 * 
 * @example
 * <ProfileCard profile={userProfile} variant="detailed" />
 */
export default function ProfileCard({ 
  profile, 
  variant = 'default',
  showStats = true,
  showBio = true 
}: ProfileCardProps) {
  
  if (variant === 'compact') {
    return <CompactProfileCard profile={profile} />;
  }

  if (variant === 'detailed') {
    return <DetailedProfileCard profile={profile} />;
  }

  return <DefaultProfileCard profile={profile} showStats={showStats} showBio={showBio} />;
}

/**
 * Compact variant - minimal profile display
 * Used in: Lists, search results, suggestions
 */
function CompactProfileCard({ profile }: { profile: Profile }) {
  return (
    <Link 
      href={`/profile/${profile.username}`}
      className="flex items-center space-x-3 p-3 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
    >
      <img
        src={profile.avatar_url || '/default-avatar.png'}
        alt={profile.full_name || profile.username || 'User'}
        className="w-10 h-10 rounded-full flex-shrink-0"
      />
      <div className="flex-1 min-w-0">
        <div className="flex items-center space-x-1">
          <p className="font-medium text-sm truncate">
            {profile.full_name || profile.username}
          </p>
          {profile.verified && (
            <svg className="w-4 h-4 text-blue-500 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
            </svg>
          )}
        </div>
        <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
          @{profile.username}
        </p>
      </div>
    </Link>
  );
}

/**
 * Default variant - standard profile card
 * Used in: Profile pages, modals
 */
function DefaultProfileCard({ 
  profile, 
  showStats, 
  showBio 
}: { 
  profile: Profile; 
  showStats: boolean; 
  showBio: boolean;
}) {
  return (
    <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 p-4 shadow-sm">
      <Link href={`/profile/${profile.username}`} className="block">
        <div className="flex items-start space-x-3">
          <img
            src={profile.avatar_url || '/default-avatar.png'}
            alt={profile.full_name || profile.username || 'User'}
            className="w-12 h-12 rounded-full flex-shrink-0"
          />
          <div className="flex-1 min-w-0">
            <div className="flex items-center space-x-1">
              <h3 className="font-semibold text-base truncate">
                {profile.full_name || profile.username}
              </h3>
              {profile.verified && (
                <svg className="w-5 h-5 text-blue-500 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
              )}
            </div>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              @{profile.username}
            </p>
          </div>
        </div>
      </Link>

      {showBio && profile.bio && (
        <p className="mt-3 text-sm text-gray-700 dark:text-gray-300">
          {profile.bio}
        </p>
      )}

      {/* Location and Website */}
      {(profile.location || profile.website) && (
        <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-gray-500 dark:text-gray-400">
          {profile.location && (
            <div className="flex items-center space-x-1">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              <span>{profile.location}</span>
            </div>
          )}
          {profile.website && (
            <a 
              href={profile.website} 
              target="_blank" 
              rel="noopener noreferrer"
              className="flex items-center space-x-1 hover:text-blue-500 transition-colors"
              onClick={(e) => e.stopPropagation()}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
              </svg>
              <span>{profile.website.replace(/^https?:\/\//, '')}</span>
            </a>
          )}
        </div>
      )}

      {/* Stats */}
      {showStats && (
        <div className="mt-3 flex items-center space-x-4 text-sm">
          <div>
            <span className="font-semibold text-gray-900 dark:text-gray-100">
              {formatCount(profile.posts_count)}
            </span>
            <span className="text-gray-500 dark:text-gray-400 ml-1">Posts</span>
          </div>
          <div>
            <span className="font-semibold text-gray-900 dark:text-gray-100">
              {formatCount(profile.following_count)}
            </span>
            <span className="text-gray-500 dark:text-gray-400 ml-1">Following</span>
          </div>
          <div>
            <span className="font-semibold text-gray-900 dark:text-gray-100">
              {formatCount(profile.followers_count)}
            </span>
            <span className="text-gray-500 dark:text-gray-400 ml-1">Followers</span>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Detailed variant - full profile header
 * Used in: Profile page header
 */
function DetailedProfileCard({ profile }: { profile: Profile }) {
  return (
    <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden">
      {/* Banner */}
      <div className="h-32 sm:h-48 bg-gradient-to-r from-blue-400 to-purple-500 relative">
        {profile.banner_url && (
          <img
            src={profile.banner_url}
            alt="Profile banner"
            className="w-full h-full object-cover"
          />
        )}
      </div>

      {/* Profile Info */}
      <div className="px-4 pb-4">
        {/* Avatar - overlaps banner */}
        <div className="flex justify-between items-start -mt-16 mb-4">
          <img
            src={profile.avatar_url || '/default-avatar.png'}
            alt={profile.full_name || profile.username || 'User'}
            className="w-24 h-24 sm:w-32 sm:h-32 rounded-full border-4 border-white dark:border-gray-900 shadow-lg"
          />
        </div>

        {/* Name and Username */}
        <div className="mb-3">
          <div className="flex items-center space-x-2">
            <h1 className="text-xl sm:text-2xl font-bold">
              {profile.full_name || profile.username}
            </h1>
            {profile.verified && (
              <svg className="w-6 h-6 text-blue-500 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
            )}
          </div>
          <p className="text-gray-500 dark:text-gray-400">@{profile.username}</p>
        </div>

        {/* Bio */}
        {profile.bio && (
          <p className="text-sm sm:text-base text-gray-700 dark:text-gray-300 mb-3">
            {profile.bio}
          </p>
        )}

        {/* Meta Info */}
        <div className="flex flex-wrap items-center gap-3 text-sm text-gray-500 dark:text-gray-400 mb-4">
          {profile.location && (
            <div className="flex items-center space-x-1">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              <span>{profile.location}</span>
            </div>
          )}
          {profile.website && (
            <a 
              href={profile.website} 
              target="_blank" 
              rel="noopener noreferrer"
              className="flex items-center space-x-1 hover:text-blue-500 transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
              </svg>
              <span className="hover:underline">{profile.website.replace(/^https?:\/\//, '')}</span>
            </a>
          )}
          <div className="flex items-center space-x-1">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            <span>{formatJoinDate(profile.created_at)}</span>
          </div>
        </div>

        {/* Stats */}
        <div className="flex items-center space-x-6 text-sm">
          <div>
            <span className="font-bold text-gray-900 dark:text-gray-100">
              {formatCount(profile.posts_count)}
            </span>
            <span className="text-gray-500 dark:text-gray-400 ml-1">Posts</span>
          </div>
          <div>
            <span className="font-bold text-gray-900 dark:text-gray-100">
              {formatCount(profile.following_count)}
            </span>
            <span className="text-gray-500 dark:text-gray-400 ml-1">Following</span>
          </div>
          <div>
            <span className="font-bold text-gray-900 dark:text-gray-100">
              {formatCount(profile.followers_count)}
            </span>
            <span className="text-gray-500 dark:text-gray-400 ml-1">Followers</span>
          </div>
        </div>
      </div>
    </div>
  );
}

