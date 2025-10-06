import { notFound } from 'next/navigation';
import { createClient } from '@/app/utils/supabase/server';
import { currentUser } from '@clerk/nextjs/server';
import Link from 'next/link';
import ProfileCard from '@/app/components/ProfileCard';
import { formatTimeAgo } from '@/app/utils/profile';

interface Post {
  id: string;
  content: string;
  user_id: string;
  user_name: string;
  user_email: string;
  user_avatar: string;
  image_urls: string[];
  created_at: string;
  updated_at: string;
}

interface ProfilePageProps {
  params: Promise<{
    username: string;
  }>;
}

/**
 * Profile Page - View a user's public profile
 * Route: /profile/[username]
 * 
 * Shows:
 * - User's profile information
 * - All posts by the user
 * - Edit button if viewing own profile
 */
export default async function ProfilePage({ params }: ProfilePageProps) {
  const { username } = await params;
  const supabase = await createClient();
  const user = await currentUser();

  // Fetch profile by username
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('*')
    .eq('username', username)
    .single();

  if (profileError || !profile) {
    notFound();
  }

  // Fetch user's posts
  const { data: posts, error: postsError } = await supabase
    .from('posts')
    .select('*')
    .eq('user_id', profile.user_id)
    .order('created_at', { ascending: false })
    .limit(50);

  if (postsError) {
    console.error('Error fetching posts:', postsError);
  }

  // Check if this is the current user's profile
  const isOwnProfile = user?.id === profile.user_id;

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-2xl mx-auto px-4 py-6">
        {/* Profile Header */}
        <ProfileCard profile={profile} variant="detailed" />

        {/* Edit Profile Button */}
        {isOwnProfile && (
          <div className="mt-4">
            <Link
              href="/settings/profile"
              className="block w-full text-center bg-blue-500 hover:bg-blue-600 text-white font-medium py-3 px-6 rounded-full transition-colors"
            >
              Edit Profile
            </Link>
          </div>
        )}

        {/* Tabs Section */}
        <div className="mt-6 border-b border-gray-200 dark:border-gray-700">
          <div className="flex space-x-8">
            <button className="pb-3 border-b-2 border-blue-500 font-semibold text-blue-500">
              Posts
            </button>
            <button className="pb-3 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 font-semibold">
              Replies
            </button>
            <button className="pb-3 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 font-semibold">
              Likes
            </button>
          </div>
        </div>

        {/* Posts Feed */}
        <div className="mt-6 space-y-4">
          {posts && posts.length > 0 ? (
            posts.map((post) => (
              <PostCard key={post.id} post={post} />
            ))
          ) : (
            <div className="text-center p-8 bg-gray-50 dark:bg-gray-800 rounded-xl">
              <h3 className="text-xl font-medium mb-2">No posts yet</h3>
              <p className="text-gray-600 dark:text-gray-400">
                {isOwnProfile 
                  ? "You haven't posted anything yet. Share your first thought!"
                  : `@${username} hasn't posted anything yet.`
                }
              </p>
              {isOwnProfile && (
                <Link
                  href="/post"
                  className="inline-block mt-4 bg-blue-500 hover:bg-blue-600 text-white font-medium py-2 px-6 rounded-full transition-colors"
                >
                  Create Post
                </Link>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * PostCard Component - Displays a single post
 */
function PostCard({ post }: { post: Post }) {
  return (
    <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 p-4 shadow-sm hover:shadow-md transition-shadow">
      <div className="flex items-start space-x-3">
        <img
          src={post.user_avatar || '/default-avatar.png'}
          alt={post.user_name}
          className="w-10 h-10 rounded-full flex-shrink-0"
        />
        <div className="flex-1 min-w-0">
          <div className="flex items-center space-x-2">
            <p className="font-medium text-sm">{post.user_name}</p>
            <p className="text-xs text-gray-500 dark:text-gray-400">·</p>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {formatTimeAgo(post.created_at)}
            </p>
          </div>
          
          {post.content && (
            <p className="mt-1 text-sm whitespace-pre-wrap">{post.content}</p>
          )}
          
          {post.image_urls && post.image_urls.length > 0 && (
            <div className={`mt-3 grid gap-2 ${
              post.image_urls.length === 1 ? 'grid-cols-1' :
              post.image_urls.length === 2 ? 'grid-cols-2' :
              'grid-cols-2'
            }`}>
              {post.image_urls.map((url, index) => (
                <img
                  key={index}
                  src={url}
                  alt={`Post image ${index + 1}`}
                  className="w-full h-32 object-cover rounded-lg"
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * Helper function to format time ago
 */
function formatTimeAgo(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);
  
  if (diffInSeconds < 60) return 'now';
  if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m`;
  if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h`;
  if (diffInSeconds < 604800) return `${Math.floor(diffInSeconds / 86400)}d`;
  
  return date.toLocaleDateString();
}

/**
 * Generate metadata for the page (SEO)
 */
export async function generateMetadata({ params }: ProfilePageProps) {
  const { username } = await params;
  const supabase = await createClient();

  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name, username, bio')
    .eq('username', username)
    .single();

  if (!profile) {
    return {
      title: 'Profile Not Found',
    };
  }

  return {
    title: `${profile.full_name || profile.username} (@${profile.username}) - Bato`,
    description: profile.bio || `View ${profile.full_name || profile.username}'s profile on Bato`,
  };
}

